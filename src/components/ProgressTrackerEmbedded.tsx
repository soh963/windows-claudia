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
  AlertTriangle,
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  Minimize2,
  Maximize2,
  X,
  RefreshCw,
  Settings,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import {
  ProgressTrackerProps,
  ProgressTrackerState,
  ProgressData,
  ModelType,
  TaskStatus,
  Task,
  PROGRESS_COLORS,
  MODEL_COLORS,
  DEFAULT_PROGRESS_CONFIG,
} from '@/types/progressTracker';

/**
 * ProgressTrackerEmbedded - A comprehensive progress tracking component
 * designed to be embedded in chat windows with minimal interface disruption
 */
export const ProgressTrackerEmbedded: React.FC<ProgressTrackerProps> = ({
  className,
  position = 'top-right',
  maxWidth = 300,
  minWidth = 200,
  onClose,
  onModelSwitch,
  onTaskSelect,
  config,
  data,
}) => {
  const [state, setState] = useState<ProgressTrackerState>({
    isExpanded: false,
    selectedModel: 'claude',
    selectedTask: null,
    viewMode: 'overview',
    notifications: [],
  });

  const finalConfig = useMemo(() => ({ ...DEFAULT_PROGRESS_CONFIG, ...config }), [config]);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoCollapseTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-collapse functionality
  useEffect(() => {
    if (finalConfig.autoCollapse && state.isExpanded) {
      autoCollapseTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, isExpanded: false }));
      }, finalConfig.collapseDelay);
    }

    return () => {
      if (autoCollapseTimeoutRef.current) {
        clearTimeout(autoCollapseTimeoutRef.current);
      }
    };
  }, [state.isExpanded, finalConfig.autoCollapse, finalConfig.collapseDelay]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!data) {
      return {
        totalTasks: 0,
        activeTasks: 0,
        completedTasks: 0,
        errorRate: 0,
        successRate: 0,
        averageResponseTime: 0,
        throughput: 0,
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
      successRate: totalTasks > 0 ? ((completedTasks - errorTasks) / totalTasks) * 100 : 0,
      averageResponseTime: (data.modelPerformance.claude.responseTime + data.modelPerformance.gemini.responseTime) / 2,
      throughput: data.throughput,
    };
  }, [data]);

  const toggleExpanded = useCallback(() => {
    setState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
    if (autoCollapseTimeoutRef.current) {
      clearTimeout(autoCollapseTimeoutRef.current);
    }
  }, []);

  const handleModelSwitch = useCallback((model: ModelType) => {
    setState(prev => ({ ...prev, selectedModel: model }));
    onModelSwitch?.(model);
  }, [onModelSwitch]);

  const handleTaskSelect = useCallback((task: Task | null) => {
    setState(prev => ({ ...prev, selectedTask: task }));
    onTaskSelect?.(task);
  }, [onTaskSelect]);

  const handleViewModeChange = useCallback((viewMode: ProgressTrackerState['viewMode']) => {
    setState(prev => ({ ...prev, viewMode }));
  }, []);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  }[position];

  // Circular progress calculation
  const circularProgress = useMemo(() => {
    if (!data) return 0;
    return data.actualAchievement;
  }, [data]);

  // Chart data preparation
  const progressChartData = useMemo(() => {
    if (!data?.progressHistory) return [];
    return data.progressHistory.slice(-20).map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      progress: point.progress,
      tasks: point.activeTasksCount,
    }));
  }, [data?.progressHistory]);

  const performanceChartData = useMemo(() => {
    if (!data?.performanceHistory) return [];
    return data.performanceHistory.slice(-10).map(point => ({
      time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      claude: point.claude.responseTime,
      gemini: point.gemini.responseTime,
      claudeSuccess: point.claude.successRate,
      geminiSuccess: point.gemini.successRate,
    }));
  }, [data?.performanceHistory]);

  // Status icon helper
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <X className="h-3 w-3 text-gray-500" />;
      default:
        return <Clock className="h-3 w-3 text-yellow-500" />;
    }
  };

  if (!data) {
    return null;
  }

  return (
    <TooltipProvider>
      <motion.div
        ref={containerRef}
        className={cn(
          'fixed z-50',
          positionClasses,
          className
        )}
        style={{
          width: state.isExpanded ? maxWidth : minWidth,
          minWidth: minWidth,
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="shadow-lg border-border/50 backdrop-blur-sm bg-background/95">
          {/* Header - Always Visible */}
          <CardHeader className="pb-2 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
                {metrics.activeTasks > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {metrics.activeTasks}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-1">
                {finalConfig.enableRealTimeUpdates && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
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
              {/* Circular Progress */}
              <div className="relative">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="hsl(var(--muted))"
                    strokeWidth="3"
                    fill="transparent"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - circularProgress / 100)}`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium">{Math.round(circularProgress)}%</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex-1 ml-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Tasks:</span>
                  <span className="font-medium">{metrics.completedTasks}/{metrics.totalTasks}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Success:</span>
                  <span className="font-medium text-green-600">
                    {metrics.successRate.toFixed(0)}%
                  </span>
                </div>
                {metrics.errorRate > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Errors:</span>
                    <span className="font-medium text-red-600">
                      {metrics.errorRate.toFixed(0)}%
                    </span>
                  </div>
                )}
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
                  {/* Model Selection */}
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

                  {/* Model Performance Metrics */}
                  {finalConfig.showModelComparison && (
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

                  {/* Performance Chart */}
                  {finalConfig.showPerformanceGraphs && progressChartData.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Activity Timeline</span>
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      </div>
                      <div className="h-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={progressChartData}>
                            <defs>
                              <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="progress"
                              stroke="hsl(var(--primary))"
                              fillOpacity={1}
                              fill="url(#progressGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Active Tasks List */}
                  {data.activeTasks.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium">Active Tasks</span>
                      <ScrollArea className="max-h-20">
                        <div className="space-y-1">
                          {data.activeTasks.slice(0, 3).map((task) => (
                            <div
                              key={task.id}
                              className={cn(
                                'flex items-center space-x-2 p-1 rounded cursor-pointer transition-colors',
                                state.selectedTask?.id === task.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                              )}
                              onClick={() => handleTaskSelect(task)}
                            >
                              {getStatusIcon(task.status)}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">{task.name}</div>
                                {task.status === 'in_progress' && (
                                  <Progress value={task.progress} className="h-1 mt-1" />
                                )}
                              </div>
                            </div>
                          ))}
                          {data.activeTasks.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center py-1">
                              +{data.activeTasks.length - 3} more tasks
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Current Task Details */}
                  {data.currentTask && (
                    <div className="space-y-1 p-2 rounded bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Current Task</span>
                        {getStatusIcon(data.currentTask.status)}
                      </div>
                      <div className="text-xs text-muted-foreground">{data.currentTask.name}</div>
                      {data.currentTask.status === 'in_progress' && (
                        <div className="space-y-1">
                          <Progress value={data.currentTask.progress} className="h-1.5" />
                          <div className="flex justify-between text-xs">
                            <span>{data.currentTask.progress}% complete</span>
                            {data.estimatedTimeRemaining && (
                              <span>{Math.round(data.estimatedTimeRemaining / 1000)}s remaining</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Model Comparison Chart */}
                  {finalConfig.showModelComparison && performanceChartData.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium">Response Time Comparison</span>
                      <div className="h-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={performanceChartData}>
                            <Bar dataKey="claude" fill={MODEL_COLORS.claude} />
                            <Bar dataKey="gemini" fill={MODEL_COLORS.gemini} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground">
                            {metrics.throughput.toFixed(1)} tasks/min
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Task throughput</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {data.sessionMetrics.endTime && (
                      <Badge variant="outline" className="h-5 px-1.5 text-xs">
                        Session Complete
                      </Badge>
                    )}
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

export default ProgressTrackerEmbedded;