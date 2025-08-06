import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  ProgressData, 
  Task, 
  ModelType, 
  ModelPerformanceMetrics, 
  SessionMetrics,
  UseProgressTrackingOptions, 
  UseProgressTrackingReturn,
  TaskStatus,
  ProgressEvent
} from '@/types/progressTracker';

/**
 * useProgressTracking Hook
 * 
 * Comprehensive hook for managing progress tracking data, including:
 * - Task lifecycle management
 * - Model performance tracking
 * - Real-time metrics calculation
 * - Historical data management
 * - Session management
 * 
 * @param options Configuration options for the hook
 * @returns Progress tracking state and management functions
 */
export const useProgressTracking = (
  options: UseProgressTrackingOptions = {}
): UseProgressTrackingReturn => {
  const {
    updateInterval = 1000,
    enableRealTime = true,
    historyRetention = 100,
    autoStartSession = true,
  } = options;

  // Core state
  const [tasks, setTasks] = useState<Map<string, Task>>(new Map());
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics>({
    sessionId: '',
    startTime: Date.now(),
    totalTasks: 0,
    completedTasks: 0,
    errorRate: 0,
    averageTaskDuration: 0,
    overallProgress: 0,
  });

  // Model performance tracking
  const [modelMetrics, setModelMetrics] = useState<{
    claude: ModelPerformanceMetrics;
    gemini: ModelPerformanceMetrics;
  }>({
    claude: {
      responseTime: 0,
      accuracy: 100,
      errorCount: 0,
      successRate: 100,
      totalRequests: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      latency: { min: 0, max: 0, avg: 0, p95: 0 },
    },
    gemini: {
      responseTime: 0,
      accuracy: 100,
      errorCount: 0,
      successRate: 100,
      totalRequests: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      latency: { min: 0, max: 0, avg: 0, p95: 0 },
    },
  });

  // Historical data
  const [progressHistory, setProgressHistory] = useState<ProgressData['progressHistory']>([]);
  const [performanceHistory, setPerformanceHistory] = useState<ProgressData['performanceHistory']>([]);

  // Hook state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelType>('claude');

  // Refs for cleanup and intervals
  const intervalRef = useRef<NodeJS.Timeout>();
  const eventListenersRef = useRef<Array<() => void>>([]);
  const latencyBufferRef = useRef<{ claude: number[]; gemini: number[] }>({
    claude: [],
    gemini: [],
  });

  // Initialize session
  useEffect(() => {
    if (autoStartSession && !sessionMetrics.sessionId) {
      startSession();
    }

    return () => {
      // Cleanup
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      eventListenersRef.current.forEach(cleanup => cleanup());
    };
  }, [autoStartSession]);

  // Real-time updates
  useEffect(() => {
    if (enableRealTime && updateInterval > 0) {
      intervalRef.current = setInterval(() => {
        updateHistoricalData();
        calculateMetrics();
      }, updateInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [enableRealTime, updateInterval]);

  // Calculate derived metrics
  const progressData = useMemo((): ProgressData => {
    const tasksArray = Array.from(tasks.values());
    const activeTasks = tasksArray.filter(task => 
      task.status === 'in_progress' || task.status === 'pending'
    );
    const completedTasks = tasksArray.filter(task => 
      task.status === 'completed' || task.status === 'error' || task.status === 'cancelled'
    );

    const errorTasks = completedTasks.filter(task => task.status === 'error');
    const successfulTasks = completedTasks.filter(task => task.status === 'completed');

    const totalTasks = tasksArray.length;
    const errorRate = totalTasks > 0 ? (errorTasks.length / totalTasks) * 100 : 0;
    
    const overallProgress = totalTasks > 0 ? 
      (completedTasks.length / totalTasks) * 100 : 0;

    const actualAchievement = totalTasks > 0 ? 
      (successfulTasks.length / totalTasks) * 100 : 0;

    // Calculate throughput (tasks per minute)
    const sessionDuration = (Date.now() - sessionMetrics.startTime) / (1000 * 60); // minutes
    const throughput = sessionDuration > 0 ? completedTasks.length / sessionDuration : 0;

    // Estimate time remaining
    const estimatedTimeRemaining = activeTasks.length > 0 && throughput > 0 ? 
      (activeTasks.length / throughput) * 60 * 1000 : undefined; // milliseconds

    const currentTask = activeTasks.find(task => task.status === 'in_progress') || 
                       activeTasks[0] || 
                       null;

    return {
      currentTask,
      completedTasks,
      activeTasks,
      errorRate,
      targetAchievement: 100, // Could be configurable
      actualAchievement,
      modelPerformance: modelMetrics,
      sessionMetrics: {
        ...sessionMetrics,
        totalTasks,
        completedTasks: completedTasks.length,
        errorRate,
        overallProgress,
        averageTaskDuration: calculateAverageTaskDuration(completedTasks),
      },
      throughput,
      estimatedTimeRemaining,
      progressHistory,
      performanceHistory,
    };
  }, [tasks, sessionMetrics, modelMetrics, progressHistory, performanceHistory]);

  // Task management functions
  const startTask = useCallback((
    taskData: Omit<Task, 'id' | 'startTime' | 'status' | 'progress'>
  ): string => {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: Task = {
      ...taskData,
      id,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
    };

    setTasks(prev => new Map(prev).set(id, task));
    
    // Auto-start task after brief delay
    setTimeout(() => {
      updateTask(id, { status: 'in_progress' });
    }, 100);

    emitEvent({
      type: 'task_start',
      payload: { taskId: id, task },
      timestamp: Date.now(),
    });

    return id;
  }, []);

  const updateTask = useCallback((
    taskId: string, 
    updates: Partial<Task>
  ): void => {
    setTasks(prev => {
      const task = prev.get(taskId);
      if (!task) {
        setError(`Task ${taskId} not found`);
        return prev;
      }

      const updatedTask = { ...task, ...updates };
      const newTasks = new Map(prev);
      newTasks.set(taskId, updatedTask);

      emitEvent({
        type: 'task_update',
        payload: { taskId, task: updatedTask },
        timestamp: Date.now(),
      });

      return newTasks;
    });
  }, []);

  const completeTask = useCallback((
    taskId: string, 
    success: boolean = true, 
    result?: unknown
  ): void => {
    const task = tasks.get(taskId);
    if (!task) {
      setError(`Task ${taskId} not found`);
      return;
    }

    const endTime = Date.now();
    const updatedTask: Task = {
      ...task,
      status: success ? 'completed' : 'error',
      progress: 100,
      endTime,
      metadata: { ...task.metadata, result },
      ...(success ? {} : {
        error: {
          message: typeof result === 'string' ? result : 'Task failed',
          details: result,
        }
      }),
    };

    setTasks(prev => {
      const newTasks = new Map(prev);
      newTasks.set(taskId, updatedTask);
      return newTasks;
    });

    emitEvent({
      type: success ? 'task_complete' : 'task_error',
      payload: { taskId, task: updatedTask },
      timestamp: Date.now(),
    });
  }, [tasks]);

  const cancelTask = useCallback((taskId: string, reason?: string): void => {
    updateTask(taskId, {
      status: 'cancelled',
      endTime: Date.now(),
      error: reason ? { message: reason } : undefined,
    });
  }, [updateTask]);

  // Session management
  const startSession = useCallback((sessionId?: string): void => {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setSessionMetrics({
      sessionId: id,
      startTime: Date.now(),
      totalTasks: 0,
      completedTasks: 0,
      errorRate: 0,
      averageTaskDuration: 0,
      overallProgress: 0,
    });

    // Reset all data for new session
    setTasks(new Map());
    setProgressHistory([]);
    setPerformanceHistory([]);
    setError(null);

    emitEvent({
      type: 'session_update',
      payload: { session: { sessionId: id, startTime: Date.now() } },
      timestamp: Date.now(),
    });
  }, []);

  const endSession = useCallback((): void => {
    setSessionMetrics(prev => ({
      ...prev,
      endTime: Date.now(),
    }));

    emitEvent({
      type: 'session_update',
      payload: { session: { endTime: Date.now() } },
      timestamp: Date.now(),
    });
  }, []);

  const resetSession = useCallback((): void => {
    startSession();
  }, [startSession]);

  // Model management
  const switchModel = useCallback((model: ModelType): void => {
    setCurrentModel(model);
    
    emitEvent({
      type: 'model_switch',
      payload: { model },
      timestamp: Date.now(),
    });
  }, []);

  const recordModelRequest = useCallback((
    model: ModelType,
    responseTime: number,
    success: boolean,
    tokenUsage?: ModelPerformanceMetrics['tokenUsage']
  ): void => {
    setModelMetrics(prev => {
      const currentMetrics = prev[model];
      const newTotalRequests = currentMetrics.totalRequests + 1;
      const newErrorCount = success ? currentMetrics.errorCount : currentMetrics.errorCount + 1;
      const newSuccessRate = ((newTotalRequests - newErrorCount) / newTotalRequests) * 100;

      // Update latency buffer for percentile calculations
      const buffer = latencyBufferRef.current[model];
      buffer.push(responseTime);
      if (buffer.length > 1000) {
        buffer.shift(); // Keep only last 1000 measurements
      }

      const sortedLatencies = [...buffer].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);

      const updatedMetrics: ModelPerformanceMetrics = {
        ...currentMetrics,
        responseTime: (currentMetrics.responseTime * currentMetrics.totalRequests + responseTime) / newTotalRequests,
        accuracy: newSuccessRate,
        errorCount: newErrorCount,
        successRate: newSuccessRate,
        totalRequests: newTotalRequests,
        tokenUsage: tokenUsage ? {
          input: currentMetrics.tokenUsage!.input + tokenUsage.input,
          output: currentMetrics.tokenUsage!.output + tokenUsage.output,
          total: currentMetrics.tokenUsage!.total + tokenUsage.total,
        } : currentMetrics.tokenUsage,
        latency: {
          min: Math.min(currentMetrics.latency.min || responseTime, responseTime),
          max: Math.max(currentMetrics.latency.max, responseTime),
          avg: (currentMetrics.latency.avg * currentMetrics.totalRequests + responseTime) / newTotalRequests,
          p95: sortedLatencies[p95Index] || responseTime,
        },
      };

      return {
        ...prev,
        [model]: updatedMetrics,
      };
    });
  }, []);

  // Data management
  const clearHistory = useCallback((): void => {
    setProgressHistory([]);
    setPerformanceHistory([]);
  }, []);

  const exportData = useCallback((): string => {
    const exportData = {
      tasks: Array.from(tasks.entries()),
      sessionMetrics,
      modelMetrics,
      progressHistory,
      performanceHistory,
      timestamp: Date.now(),
    };
    return JSON.stringify(exportData, null, 2);
  }, [tasks, sessionMetrics, modelMetrics, progressHistory, performanceHistory]);

  const importData = useCallback((data: string): void => {
    try {
      const parsed = JSON.parse(data);
      
      setTasks(new Map(parsed.tasks || []));
      setSessionMetrics(parsed.sessionMetrics || sessionMetrics);
      setModelMetrics(parsed.modelMetrics || modelMetrics);
      setProgressHistory(parsed.progressHistory || []);
      setPerformanceHistory(parsed.performanceHistory || []);
      
      setError(null);
    } catch (err) {
      setError('Failed to import data: Invalid format');
    }
  }, [sessionMetrics, modelMetrics]);

  // Helper functions
  const updateHistoricalData = useCallback((): void => {
    const now = Date.now();
    const activeTasks = Array.from(tasks.values()).filter(task => 
      task.status === 'in_progress' || task.status === 'pending'
    );

    // Update progress history
    setProgressHistory(prev => {
      const newPoint = {
        timestamp: now,
        progress: progressData.actualAchievement,
        activeTasksCount: activeTasks.length,
        modelUsed: currentModel,
      };
      
      const updated = [...prev, newPoint].slice(-historyRetention);
      return updated;
    });

    // Update performance history
    setPerformanceHistory(prev => {
      const newPoint = {
        timestamp: now,
        claude: {
          responseTime: modelMetrics.claude.responseTime,
          successRate: modelMetrics.claude.successRate,
        },
        gemini: {
          responseTime: modelMetrics.gemini.responseTime,
          successRate: modelMetrics.gemini.successRate,
        },
      };
      
      const updated = [...prev, newPoint].slice(-historyRetention);
      return updated;
    });
  }, [tasks, progressData.actualAchievement, currentModel, modelMetrics, historyRetention]);

  const calculateMetrics = useCallback((): void => {
    // This could include more complex metric calculations
    // For now, metrics are calculated in the progressData useMemo
  }, []);

  const calculateAverageTaskDuration = useCallback((completedTasks: Task[]): number => {
    if (completedTasks.length === 0) return 0;
    
    const totalDuration = completedTasks.reduce((sum, task) => {
      return sum + ((task.endTime || Date.now()) - task.startTime);
    }, 0);
    
    return totalDuration / completedTasks.length;
  }, []);

  const emitEvent = useCallback((event: ProgressEvent): void => {
    // In a real implementation, this could emit to an event system
    // For now, we'll just log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('ProgressEvent:', event);
    }
  }, []);

  return {
    // Data
    progressData,
    isLoading,
    error,

    // Task management
    startTask,
    updateTask,
    completeTask,
    cancelTask,

    // Session management
    startSession,
    endSession,
    resetSession,

    // Model management
    switchModel,
    recordModelRequest,

    // Data management
    clearHistory,
    exportData,
    importData,
  };
};