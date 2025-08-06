import React, { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { StatusBar } from './StatusBar';
import { ProgressTracker } from './ProgressTracker';
import { useMonitoringStore } from '@/stores/monitoringStore';
import { useMonitoringIntegration } from '@/hooks/useMonitoringIntegration';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressMonitorProps {
  className?: string;
}

export const ProgressMonitor: React.FC<ProgressMonitorProps> = ({ className }) => {
  const { isProgressTrackerVisible, toggleProgressTracker } = useMonitoringStore();
  
  // Initialize monitoring integration
  useMonitoringIntegration();

  return (
    <>
      {/* Progress Tracker Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "fixed left-4 bottom-10 z-40 h-10 w-10 p-0 rounded-full shadow-lg",
          "bg-background/80 backdrop-blur-sm hover:bg-background/90",
          "transition-all duration-200",
          isProgressTrackerVisible && "opacity-0 pointer-events-none",
          className
        )}
        onClick={toggleProgressTracker}
      >
        <BarChart3 className="h-5 w-5" />
      </Button>

      {/* Progress Tracker Panel */}
      <AnimatePresence>
        {isProgressTrackerVisible && (
          <ProgressTracker onClose={toggleProgressTracker} />
        )}
      </AnimatePresence>

      {/* Status Bar */}
      <StatusBar />
    </>
  );
};

export default ProgressMonitor;