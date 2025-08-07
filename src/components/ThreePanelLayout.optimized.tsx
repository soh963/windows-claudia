/**
 * Optimized Three Panel Layout Component
 * Simplified state management and removed debug code
 */

import React, { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressTracker } from '@/components/ProgressTracker';
import TaskTimeline from '@/components/TaskTimeline';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BarChart3, Calendar } from 'lucide-react';
import { 
  cn, 
  animations, 
  transitions, 
  panelWidths, 
  createToggleHandler 
} from '@/lib/ui-utils';

interface ThreePanelLayoutProps {
  children: React.ReactNode;
  className?: string;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
}

// Memoized toggle button component
const PanelToggleButton = memo<{
  visible: boolean;
  onClick: () => void;
  position: 'left' | 'right';
  icon: React.ReactNode;
  secondaryIcon: React.ReactNode;
  title: string;
}>(({ visible, onClick, position, icon, secondaryIcon, title }) => {
  if (visible) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transitions.fast}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-50",
        position === 'left' ? "left-2" : "right-2"
      )}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className="h-12 w-8 p-0 shadow-md hover:shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        title={title}
      >
        <div className="flex flex-col items-center gap-1">
          {icon}
          {secondaryIcon}
        </div>
      </Button>
    </motion.div>
  );
});

PanelToggleButton.displayName = 'PanelToggleButton';

// Memoized panel component
const Panel = memo<{
  visible: boolean;
  position: 'left' | 'right';
  width: number;
  children: React.ReactNode;
}>(({ visible, position, width, children }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={transitions.normal}
          className={cn(
            "flex-shrink-0 overflow-hidden",
            position === 'left' ? "border-r" : "border-l",
            "border-border"
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

Panel.displayName = 'Panel';

export const ThreePanelLayoutOptimized: React.FC<ThreePanelLayoutProps> = memo(({
  children,
  className,
  leftPanelVisible = false,
  rightPanelVisible = false,
  onToggleLeftPanel,
  onToggleRightPanel,
}) => {
  const [leftVisible, setLeftVisible] = useState(leftPanelVisible);
  const [rightVisible, setRightVisible] = useState(rightPanelVisible);

  // Optimized toggle handlers using utility function
  const handleToggleLeft = useCallback(
    createToggleHandler(setLeftVisible, (newState) => {
      onToggleLeftPanel?.();
    }),
    [onToggleLeftPanel]
  );

  const handleToggleRight = useCallback(
    createToggleHandler(setRightVisible, (newState) => {
      onToggleRightPanel?.();
    }),
    [onToggleRightPanel]
  );

  return (
    <div className={cn("h-full flex bg-background", className)}>
      {/* Left Panel - Progress Tracker */}
      <Panel 
        visible={leftVisible} 
        position="left" 
        width={panelWidths.normal}
      >
        <ProgressTracker 
          className="h-full w-full" 
          onClose={handleToggleLeft}
        />
      </Panel>

      {/* Left Panel Toggle */}
      <PanelToggleButton
        visible={leftVisible}
        onClick={handleToggleLeft}
        position="left"
        icon={<ChevronRight className="h-3 w-3" />}
        secondaryIcon={<BarChart3 className="h-3 w-3" />}
        title="Show Progress Tracker"
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 relative">
        {children}
      </div>

      {/* Right Panel Toggle */}
      <PanelToggleButton
        visible={rightVisible}
        onClick={handleToggleRight}
        position="right"
        icon={<ChevronLeft className="h-3 w-3" />}
        secondaryIcon={<Calendar className="h-3 w-3" />}
        title="Show Task Timeline"
      />

      {/* Right Panel - Task Timeline */}
      <Panel 
        visible={rightVisible} 
        position="right" 
        width={panelWidths.wide}
      >
        <TaskTimeline 
          className="h-full w-full" 
          onClose={handleToggleRight}
        />
      </Panel>
    </div>
  );
});

ThreePanelLayoutOptimized.displayName = 'ThreePanelLayoutOptimized';

export default ThreePanelLayoutOptimized;