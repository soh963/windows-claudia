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
import { useMonitoringStore } from '@/stores/monitoringStore';

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
  leftPanelVisible = true,
  rightPanelVisible = true,
  onToggleLeftPanel,
  onToggleRightPanel,
}) => {
  const { toggleProgressTracker } = useMonitoringStore();
  const [leftVisible, setLeftVisible] = useState(leftPanelVisible);
  const [rightVisible, setRightVisible] = useState(rightPanelVisible);

  useEffect(() => {
    setLeftVisible(leftPanelVisible);
  }, [leftPanelVisible]);

  useEffect(() => {
    setRightVisible(rightPanelVisible);
  }, [rightPanelVisible]);

  const handleToggleLeft = () => {
    const newState = !leftVisible;
    setLeftVisible(newState);
    onToggleLeftPanel?.();
  };

  const handleToggleRight = () => {
    const newState = !rightVisible;
    setRightVisible(newState);
    onToggleRightPanel?.();
  };

  return (
    <div className={cn("h-full flex bg-background", className)}>
      {/* Left Panel - Progress Tracker */}
      <AnimatePresence>
        {leftVisible && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-shrink-0 border-r border-border overflow-hidden"
          >
            <ProgressTracker 
              className="h-full w-full" 
              onClose={handleToggleLeft}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Panel Toggle Button */}
      {!leftVisible && (
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
      {!rightVisible && (
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
        {rightVisible && (
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