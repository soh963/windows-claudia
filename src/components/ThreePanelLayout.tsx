/**
 * Three Panel Layout Component
 * Integrates ProgressTracker (left), main content (center), and TaskTimeline (right)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ProgressTracker } from '@/components/ProgressTracker';
import TaskTimeline from '@/components/TaskTimeline';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BarChart3, Calendar } from 'lucide-react';
import { useUIStore } from '@/lib/stores/uiStore';

// The UIStore now handles duplicate prevention centrally

interface ThreePanelLayoutProps {
  children: React.ReactNode;
  className?: string;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
}

export const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({
  children,
  className,
  leftPanelVisible = false,  // This prop is kept for backward compatibility but we'll use store state
  rightPanelVisible = false, // Default to hidden for Task Timeline
  onToggleLeftPanel,
  onToggleRightPanel,
}) => {
  // Use the global UI store state for panel visibility
  const { 
    isProgressTrackerVisible, 
    isTaskTimelineVisible,
    toggleProgressTracker,
    toggleTaskTimeline 
  } = useUIStore();
  
  // Sync the props with store on mount/change (for backward compatibility)
  useEffect(() => {
    // Only update store if prop explicitly says to show and store doesn't already show
    if (leftPanelVisible && !isProgressTrackerVisible) {
      toggleProgressTracker('ThreePanelLayout-prop');
    }
  }, [leftPanelVisible]);

  useEffect(() => {
    // Sync task timeline visibility
    if (rightPanelVisible !== isTaskTimelineVisible) {
      if (rightPanelVisible && !isTaskTimelineVisible) {
        toggleTaskTimeline('ThreePanelLayout-prop');
      } else if (!rightPanelVisible && isTaskTimelineVisible) {
        toggleTaskTimeline('ThreePanelLayout-prop');
      }
    }
  }, [rightPanelVisible]);

  // Cleanup is now handled by UIStore

  const handleToggleLeft = () => {
    // Use the global UI store toggle which handles duplicate prevention
    const success = toggleProgressTracker('ThreePanelLayout');
    
    if (success) {
      console.log(`[ThreePanelLayout] ProgressTracker toggled successfully`);
    } else {
      console.log(`[ThreePanelLayout] ProgressTracker toggle handled by UIStore`);
    }
    
    onToggleLeftPanel?.();
  };

  const handleToggleRight = () => {
    // Use the global UI store toggle for task timeline
    toggleTaskTimeline('ThreePanelLayout');
    onToggleRightPanel?.();
  };

  return (
    <div className={cn("h-full flex bg-background", className)}>
      {/* Left Panel - Progress Tracker */}
      <AnimatePresence>
        {isProgressTrackerVisible && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-shrink-0 border-r border-border overflow-hidden"
          >
            <ProgressTracker 
              key="three-panel-progress-tracker" // Unique key to prevent React conflicts
              className="h-full w-full" 
              onClose={handleToggleLeft}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Panel Toggle Button */}
      {!isProgressTrackerVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-50"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleLeft}
            className="h-12 w-8 p-0 shadow-md hover:shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            title="Show Progress Tracker"
          >
            <div className="flex flex-col items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <BarChart3 className="h-3 w-3" />
            </div>
          </Button>
        </motion.div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 relative">
        {children}
      </div>

      {/* Right Panel Toggle Button */}
      {!isTaskTimelineVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-50"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleRight}
            className="h-12 w-8 p-0 shadow-md hover:shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            title="Show Task Timeline"
          >
            <div className="flex flex-col items-center gap-1">
              <ChevronLeft className="h-3 w-3" />
              <Calendar className="h-3 w-3" />
            </div>
          </Button>
        </motion.div>
      )}

      {/* Right Panel - Task Timeline */}
      <AnimatePresence>
        {isTaskTimelineVisible && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-shrink-0 border-l border-border overflow-hidden"
          >
            <TaskTimeline 
              className="h-full w-full" 
              onClose={handleToggleRight}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThreePanelLayout;