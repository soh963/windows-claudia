import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Activity, Settings, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { ProgressTrackerEmbedded } from './ProgressTrackerEmbedded';
import { ClaudeCodeSession } from './ClaudeCodeSession';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { ModelType, Task } from '@/types/progressTracker';

interface ChatWindowWithProgressTrackerProps {
  session?: any;
  initialProjectPath?: string;
  onBack: () => void;
  onProjectSettings?: (projectPath: string) => void;
  className?: string;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
}

/**
 * ChatWindowWithProgressTracker - Integration example showing how to embed
 * the ProgressTracker component in a chat window without interfering with chat functionality.
 * 
 * This demonstrates:
 * 1. Proper positioning of the progress tracker
 * 2. Real-time progress tracking during chat sessions
 * 3. Model performance comparison between Claude and Gemini
 * 4. Task lifecycle management for chat operations
 */
export const ChatWindowWithProgressTracker: React.FC<ChatWindowWithProgressTrackerProps> = ({
  session,
  initialProjectPath,
  onBack,
  onProjectSettings,
  className,
  onStreamingChange,
}) => {
  // Progress tracking state
  const {
    progressData,
    startTask,
    updateTask,
    completeTask,
    recordModelRequest,
    switchModel,
  } = useProgressTracking({
    enableRealTime: true,
    updateInterval: 1000,
    autoStartSession: true,
  });

  // UI state
  const [showProgressTracker, setShowProgressTracker] = useState(true);
  const [currentModel, setCurrentModel] = useState<ModelType>('claude');
  const [isStreamingActive, setIsStreamingActive] = useState(false);

  // Track streaming state changes
  const handleStreamingChange = useCallback((isStreaming: boolean, sessionId: string | null) => {
    setIsStreamingActive(isStreaming);
    
    if (isStreaming) {
      // Start a new task when streaming begins
      startTask({
        name: `${currentModel.charAt(0).toUpperCase() + currentModel.slice(1)} Request`,
        description: `Processing request with ${currentModel}`,
        priority: 'medium',
        category: 'ai_request',
        model: currentModel,
      });
    }
    
    // Forward to parent handler
    onStreamingChange?.(isStreaming, sessionId);
  }, [currentModel, startTask, onStreamingChange]);

  // Handle model switching
  const handleModelSwitch = useCallback((model: ModelType) => {
    setCurrentModel(model);
    switchModel(model);
    
    // If there's an active task, update it to reflect the model change
    if (progressData.currentTask) {
      updateTask(progressData.currentTask.id, { model });
    }
  }, [switchModel, progressData.currentTask, updateTask]);

  // Handle task selection
  const handleTaskSelect = useCallback((task: Task | null) => {
    // Could implement task detail view or other interactions
    console.log('Selected task:', task);
  }, []);

  // Simulate task completion for demo purposes
  useEffect(() => {
    if (progressData.currentTask && progressData.currentTask.status === 'in_progress') {
      // Simulate progress updates
      const interval = setInterval(() => {
        const task = progressData.currentTask;
        if (task && task.progress < 100) {
          const newProgress = Math.min(100, task.progress + Math.random() * 20);
          updateTask(task.id, { progress: newProgress });
          
          // Complete task when progress reaches 100
          if (newProgress >= 100) {
            const responseTime = Date.now() - task.startTime;
            const success = Math.random() > 0.1; // 90% success rate
            
            completeTask(task.id, success);
            recordModelRequest(
              task.model || currentModel,
              responseTime,
              success,
              {
                input: Math.floor(Math.random() * 1000),
                output: Math.floor(Math.random() * 1500),
                total: Math.floor(Math.random() * 2500),
              }
            );
          }
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, [progressData.currentTask, updateTask, completeTask, recordModelRequest, currentModel]);

  return (
    <TooltipProvider>
      <div className={cn('relative h-full w-full', className)}>
        {/* Main Chat Interface */}
        <ClaudeCodeSession
          session={session}
          initialProjectPath={initialProjectPath}
          onBack={onBack}
          onProjectSettings={onProjectSettings}
          onStreamingChange={handleStreamingChange}
          className="h-full"
        />

        {/* Progress Tracker Toggle Button - Only when hidden */}
        {!showProgressTracker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed top-4 right-4 z-40"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 shadow-lg bg-background/95 backdrop-blur-sm"
                  onClick={() => setShowProgressTracker(true)}
                >
                  <Activity className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show progress tracker</p>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        )}

        {/* Progress Tracker - Embedded */}
        <AnimatePresence>
          {showProgressTracker && (
            <ProgressTrackerEmbedded
              position="top-right"
              maxWidth={300}
              minWidth={200}
              data={progressData}
              onClose={() => setShowProgressTracker(false)}
              onModelSwitch={handleModelSwitch}
              onTaskSelect={handleTaskSelect}
              config={{
                autoCollapse: true,
                collapseDelay: 10000, // 10 seconds
                showNotifications: true,
                enableRealTimeUpdates: true,
                showModelComparison: true,
                showPerformanceGraphs: true,
              }}
              className="animate-in slide-in-from-right-2"
            />
          )}
        </AnimatePresence>

        {/* Streaming Indicator Overlay */}
        {isStreamingActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30"
          >
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 backdrop-blur-sm rounded-full border border-primary/20">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-xs text-primary font-medium">
                {currentModel.charAt(0).toUpperCase() + currentModel.slice(1)} is thinking...
              </span>
            </div>
          </motion.div>
        )}

        {/* Performance Indicator - Bottom Right Corner */}
        {progressData.modelPerformance[currentModel].totalRequests > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 right-4 z-30"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 px-2 py-1 bg-background/95 backdrop-blur-sm rounded-md border shadow-sm text-xs">
                  <Monitor className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {progressData.modelPerformance[currentModel].responseTime.toFixed(0)}ms
                  </span>
                  <span className="text-green-600">
                    {progressData.modelPerformance[currentModel].successRate.toFixed(0)}%
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">{currentModel.charAt(0).toUpperCase() + currentModel.slice(1)} Performance</p>
                  <p>Avg Response: {progressData.modelPerformance[currentModel].responseTime.toFixed(0)}ms</p>
                  <p>Success Rate: {progressData.modelPerformance[currentModel].successRate.toFixed(1)}%</p>
                  <p>Total Requests: {progressData.modelPerformance[currentModel].totalRequests}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default ChatWindowWithProgressTracker;