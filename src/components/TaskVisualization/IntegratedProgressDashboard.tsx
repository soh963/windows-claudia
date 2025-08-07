import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  BarChart3, 
  Activity,
  SplitSquareHorizontal,
  PanelLeftOpen,
  PanelRightOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Import existing components
import { ProgressTracker } from '../ProgressTracker';
import { TaskVisualizationDashboard } from './TaskVisualizationDashboard';
import { useRealTimeVisualization } from '@/hooks/useRealTimeVisualization';

interface IntegratedProgressDashboardProps {
  className?: string;
  defaultLayout?: 'split' | 'dashboard-only' | 'tracker-only';
  showToggle?: boolean;
}

export const IntegratedProgressDashboard: React.FC<IntegratedProgressDashboardProps> = ({
  className,
  defaultLayout = 'split',
  showToggle = true,
}) => {
  const [layout, setLayout] = useState<'split' | 'dashboard-only' | 'tracker-only'>(defaultLayout);
  const [isDashboardFullscreen, setIsDashboardFullscreen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<HTMLDivElement>(null);

  // Initialize real-time visualization
  const { isLoading, error, lastUpdated } = useRealTimeVisualization({
    enabled: true,
    updateInterval: 5000,
  });

  const handleLayoutChange = (newLayout: typeof layout) => {
    setLayout(newLayout);
    setIsDashboardFullscreen(false);
  };

  const handleDashboardFullscreen = () => {
    setIsDashboardFullscreen(!isDashboardFullscreen);
  };

  // Accessibility props for keyboard navigation
  const accessibilityProps = {
    role: 'main',
    'aria-label': 'Task Progress Visualization Dashboard',
    'aria-live': 'polite' as const,
    'aria-busy': isLoading,
  };

  if (isDashboardFullscreen) {
    return (
      <div 
        className={cn('fixed inset-0 bg-background z-50', className)}
        {...accessibilityProps}
      >
        <TaskVisualizationDashboard
          isFullscreen={true}
          onToggleFullscreen={handleDashboardFullscreen}
        />
      </div>
    );
  }

  return (
    <div 
      className={cn('h-full flex flex-col', className)}
      {...accessibilityProps}
    >
      {/* Header with Layout Controls */}
      {showToggle && (
        <div className="p-4 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Progress & Visualization</h2>
              {error && (
                <div 
                  className="text-xs text-destructive"
                  role="alert"
                  aria-live="assertive"
                >
                  Update failed
                </div>
              )}
              {lastUpdated > 0 && (
                <div className="text-xs text-muted-foreground">
                  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={layout === 'tracker-only' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleLayoutChange('tracker-only')}
                className="h-8 px-3"
                aria-label="Show progress tracker only"
              >
                <PanelLeftOpen className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Tracker</span>
              </Button>
              <Button
                variant={layout === 'split' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleLayoutChange('split')}
                className="h-8 px-3"
                aria-label="Show split view with both tracker and dashboard"
              >
                <SplitSquareHorizontal className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Split</span>
              </Button>
              <Button
                variant={layout === 'dashboard-only' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleLayoutChange('dashboard-only')}
                className="h-8 px-3"
                aria-label="Show visualization dashboard only"
              >
                <PanelRightOpen className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Progress Tracker Panel */}
        {layout !== 'dashboard-only' && (
          <motion.div
            ref={trackerRef}
            initial={false}
            animate={{ 
              width: layout === 'tracker-only' ? '100%' : '350px',
              opacity: 1 
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex-shrink-0 border-r"
            role="complementary"
            aria-label="Task Progress Tracker"
          >
            <ProgressTracker 
              className="h-full"
              onClose={layout === 'tracker-only' ? undefined : () => handleLayoutChange('dashboard-only')}
            />
          </motion.div>
        )}

        {/* Separator */}
        {layout === 'split' && (
          <Separator orientation="vertical" className="w-px" />
        )}

        {/* Dashboard Panel */}
        {layout !== 'tracker-only' && (
          <motion.div
            ref={dashboardRef}
            initial={false}
            animate={{ 
              flex: layout === 'dashboard-only' ? 1 : '1 1 0%',
              opacity: 1 
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="min-w-0"
            role="main"
            aria-label="Task Visualization Dashboard"
          >
            <TaskVisualizationDashboard
              className="h-full"
              onToggleFullscreen={handleDashboardFullscreen}
            />
          </motion.div>
        )}
      </div>

      {/* Accessibility announcements */}
      <div className="sr-only" aria-live="polite">
        {isLoading && 'Loading visualization data'}
        {error && `Error loading data: ${error}`}
        {layout === 'split' && 'Split view active: showing both progress tracker and visualization dashboard'}
        {layout === 'tracker-only' && 'Progress tracker view active'}
        {layout === 'dashboard-only' && 'Visualization dashboard view active'}
      </div>
    </div>
  );
};

export default IntegratedProgressDashboard;