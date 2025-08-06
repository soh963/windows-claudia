import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  Sparkles,
  Brain,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import {
  ProgressTrackerProps,
  ProgressTrackerState,
  ModelType,
  TaskStatus,
  Task,
  DEFAULT_PROGRESS_CONFIG,
} from '@/types/progressTracker';

interface ChatProgressTrackerProps extends Omit<ProgressTrackerProps, 'position'> {
  /**
   * Embedded position in chat window
   */
  position?: 'top' | 'bottom' | 'sidebar';
  /**
   * Show mini mode - ultra compact for space-constrained situations
   */
  miniMode?: boolean;
  /**
   * Integration with session data
   */
  sessionId?: string;
  currentModel?: ModelType;
  isStreaming?: boolean;
  messageCount?: number;
}

/**
 * ChatProgressTracker - A specialized progress tracker designed specifically 
 * for integration into chat windows with minimal space usage
 */
export const ChatProgressTracker: React.FC<ChatProgressTrackerProps> = ({
  className,
  position = 'top',
  maxWidth = 280,
  minWidth = 160,
  miniMode = false,
  onClose,
  onModelSwitch,
  onTaskSelect,
  config,
  data,
  sessionId,
  currentModel = 'claude',
  isStreaming = false,
  messageCount = 0,
}) => {
  const [state, setState] = useState<ProgressTrackerState>({
    isExpanded: false,
    selectedModel: currentModel,
    selectedTask: null,
    viewMode: 'overview',
    notifications: [],
  });

  const finalConfig = useMemo(() => ({ ...DEFAULT_PROGRESS_CONFIG, ...config }), [config]);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoCollapseTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-collapse functionality for non-mini mode
  useEffect(() => {
    if (!miniMode && finalConfig.autoCollapse && state.isExpanded) {
      autoCollapseTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, isExpanded: false }));
      }, finalConfig.collapseDelay);
    }

    return () => {
      if (autoCollapseTimeoutRef.current) {
        clearTimeout(autoCollapseTimeoutRef.current);
      }
    };
  }, [state.isExpanded, finalConfig.autoCollapse, finalConfig.collapseDelay, miniMode]);

  // Update selected model when prop changes
  useEffect(() => {
    setState(prev => ({ ...prev, selectedModel: currentModel }));
  }, [currentModel]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!data) {
      return {
        totalTasks: messageCount,
        activeTasks: isStreaming ? 1 : 0,
        completedTasks: messageCount,
        errorRate: 0,
        successRate: messageCount > 0 ? 95 : 0,
        averageResponseTime: 1200,
        throughput: messageCount > 0 ? messageCount / 10 : 0, // messages per minute estimate
      };
    }

    const totalTasks = data.activeTasks.length + data.completedTasks.length;
    const activeTasks = data.activeTasks.length;
    const completedTasks = data.completedTasks.length;
    const errorTasks = data.completedTasks.filter(task => task.status === 'error').length;
    
    return {
      totalTasks,
      activeTasks,
      completedTasks,
      errorRate: totalTasks > 0 ? (errorTasks / totalTasks) * 100 : 0,
      successRate: totalTasks > 0 ? ((completedTasks - errorTasks) / totalTasks) * 100 : 95,
      averageResponseTime: (data.modelPerformance.claude.responseTime + data.modelPerformance.gemini.responseTime) / 2,
      throughput: data.throughput,
    };
  }, [data, messageCount, isStreaming]);

  const toggleExpanded = useCallback(() => {
    if (!miniMode) {
      setState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
      if (autoCollapseTimeoutRef.current) {
        clearTimeout(autoCollapseTimeoutRef.current);
      }
    }
  }, [miniMode]);

  const handleModelSwitch = useCallback((model: ModelType) => {
    setState(prev => ({ ...prev, selectedModel: model }));
    onModelSwitch?.(model);
  }, [onModelSwitch]);


  // Position classes
  const positionClasses = {
    'top': 'border-b',
    'bottom': 'border-t',
    'sidebar': 'border-r',
  }[position];

  // Circular progress calculation
  const circularProgress = useMemo(() => {
    if (data?.actualAchievement !== undefined) {
      return data.actualAchievement;
    }
    return metrics.successRate;
  }, [data?.actualAchievement, metrics.successRate]);

  // Model icon helper
  const getModelIcon = (model: ModelType) => {
    switch (model) {
      case 'claude':
        return <Sparkles className="h-3 w-3 text-purple-500" />;
      case 'gemini':
        return <Brain className="h-3 w-3 text-blue-500" />;
      default:
        return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };


  // Mini mode render
  if (miniMode) {
    return (
      <TooltipProvider>
        <motion.div
          className={cn(
            'flex items-center gap-2 px-2 py-1 bg-background/50 backdrop-blur-sm border rounded-md',
            positionClasses,
            className
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Current model indicator */}
          <div className="flex items-center gap-1">
            {getModelIcon(currentModel)}
            <span className="text-xs font-medium text-muted-foreground">
              {currentModel.charAt(0).toUpperCase() + currentModel.slice(1)}
            </span>
          </div>

          <Separator orientation="vertical" className="h-4" />

          {/* Mini progress indicator */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="w-4 h-4 transform -rotate-90">
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="hsl(var(--muted))"
                  strokeWidth="1.5"
                  fill="transparent"
                />
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 6}`}
                  strokeDashoffset={`${2 * Math.PI * 6 * (1 - circularProgress / 100)}`}
                  className="transition-all duration-500"
                />
              </svg>
            </div>
            <span className="text-xs font-medium">{Math.round(circularProgress)}%</span>
          </div>

          {/* Message count */}
          {messageCount > 0 && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="h-4 px-1.5 text-xs">
                    {messageCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{messageCount} messages in session</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600">Live</span>
              </div>
            </>
          )}

          {/* Expand button */}
          {!miniMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-auto"
              onClick={toggleExpanded}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
        </motion.div>
      </TooltipProvider>
    );
  }

  // Full embedded mode render
  return (
    <TooltipProvider>
      <motion.div
        ref={containerRef}
        className={cn(
          'w-full border-0',
          positionClasses,
          className
        )}
        style={{
          maxWidth,
          minWidth,
        }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="shadow-none border-0 bg-transparent">
          {/* Header - Always Visible */}
          <CardHeader className="pb-2 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Session Progress</CardTitle>
                {(isStreaming || metrics.activeTasks > 0) && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {isStreaming ? 1 : metrics.activeTasks}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-1">
                {/* Real-time indicator */}
                {(isStreaming || finalConfig.enableRealTimeUpdates) && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
                {/* Current model indicator */}
                <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/50 rounded text-xs">
                  {getModelIcon(currentModel)}
                  <span>{currentModel}</span>
                </div>
                {/* Expand/collapse button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={toggleExpanded}
                >
                  {state.isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
                {onClose && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={onClose}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Compact View - Always Visible */}
          <CardContent className="px-3 py-2 pt-0">
            <div className="flex items-center justify-between">
              {/* Progress circle with session info */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <svg className="w-10 h-10 transform -rotate-90">
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="hsl(var(--muted))"
                      strokeWidth="2.5"
                      fill="transparent"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2.5"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={`${2 * Math.PI * 16 * (1 - circularProgress / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium">{Math.round(circularProgress)}%</span>
                  </div>
                </div>

                {/* Session stats */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Messages:</span>
                    <span className="font-medium">{messageCount}</span>
                    {isStreaming && (
                      <Badge variant="outline" className="h-4 px-1 text-xs">
                        Streaming
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Success:</span>
                    <span className="font-medium text-green-600">
                      {metrics.successRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick performance indicator */}
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  ~{metrics.averageResponseTime.toFixed(0)}ms
                </div>
                <div className="text-xs font-medium">
                  {metrics.throughput.toFixed(1)}/min
                </div>
              </div>
            </div>
          </CardContent>

          {/* Expanded View */}
          <AnimatePresence>
            {state.isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Separator />
                <CardContent className="px-3 py-2 space-y-3">
                  {/* Model comparison toggle */}
                  {finalConfig.showModelComparison && (
                    <div className="flex items-center space-x-1">
                      <Button
                        variant={state.selectedModel === 'claude' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleModelSwitch('claude')}
                      >
                        Claude
                      </Button>
                      <Button
                        variant={state.selectedModel === 'gemini' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleModelSwitch('gemini')}
                      >
                        Gemini
                      </Button>
                    </div>
                  )}

                  {/* Model performance metrics */}
                  {data && finalConfig.showModelComparison && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Response:</span>
                          <span className="font-medium">
                            {data.modelPerformance[state.selectedModel].responseTime}ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Success:</span>
                          <span className="font-medium text-green-600">
                            {data.modelPerformance[state.selectedModel].successRate.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Requests:</span>
                          <span className="font-medium">
                            {data.modelPerformance[state.selectedModel].totalRequests}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Errors:</span>
                          <span className="font-medium text-red-600">
                            {data.modelPerformance[state.selectedModel].errorCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Current streaming task indicator */}
                  {isStreaming && (
                    <div className="p-2 rounded bg-primary/5 border border-primary/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">Current Request</span>
                        <div className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                          <span className="text-xs text-primary">Processing</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {currentModel.charAt(0).toUpperCase() + currentModel.slice(1)} is generating response...
                      </div>
                    </div>
                  )}

                  {/* Session info */}
                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <span>Session ID: {sessionId ? sessionId.slice(-8) : 'N/A'}</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
};

export default ChatProgressTracker;