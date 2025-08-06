import { useEffect, useCallback, useRef } from 'react';
import { useMonitoringStore, useOperationTracker } from '@/stores/monitoringStore';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { OperationType } from '@/stores/monitoringStore';

// Event types from Tauri backend
interface ToolExecutionEvent {
  tool: string;
  status: 'start' | 'progress' | 'complete' | 'error';
  progress?: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface ApiCallEvent {
  endpoint: string;
  method: string;
  status: 'start' | 'complete' | 'error';
  error?: string;
  duration?: number;
}

interface FileOperationEvent {
  operation: 'read' | 'write' | 'edit' | 'delete';
  path: string;
  status: 'start' | 'complete' | 'error';
  error?: string;
}

interface BuildProcessEvent {
  process: string;
  status: 'start' | 'progress' | 'complete' | 'error';
  progress?: number;
  error?: string;
  output?: string;
}

export function useMonitoringIntegration() {
  const { startOperation, updateOperation, completeOperation, logError } = useMonitoringStore();
  const operationMap = useRef<Map<string, string>>(new Map());

  // Helper to generate unique operation key
  const getOperationKey = (type: string, identifier: string) => `${type}_${identifier}`;

  // Tool execution monitoring
  const handleToolExecution = useCallback((event: ToolExecutionEvent) => {
    const key = getOperationKey('tool', event.tool);
    
    switch (event.status) {
      case 'start':
        const opId = startOperation({
          type: 'tool_execution',
          name: `Tool: ${event.tool}`,
          description: event.metadata?.description || `Executing ${event.tool}`,
          metadata: event.metadata,
        });
        operationMap.current.set(key, opId);
        break;
        
      case 'progress':
        const progressOpId = operationMap.current.get(key);
        if (progressOpId && event.progress !== undefined) {
          updateOperation(progressOpId, { progress: event.progress });
        }
        break;
        
      case 'complete':
        const completeOpId = operationMap.current.get(key);
        if (completeOpId) {
          completeOperation(completeOpId);
          operationMap.current.delete(key);
        }
        break;
        
      case 'error':
        const errorOpId = operationMap.current.get(key);
        if (errorOpId) {
          completeOperation(errorOpId, {
            message: event.error || 'Tool execution failed',
            severity: 'high',
          });
          operationMap.current.delete(key);
        }
        break;
    }
  }, [startOperation, updateOperation, completeOperation]);

  // API call monitoring
  const handleApiCall = useCallback((event: ApiCallEvent) => {
    const key = getOperationKey('api', `${event.method}_${event.endpoint}`);
    
    switch (event.status) {
      case 'start':
        const opId = startOperation({
          type: 'api_call',
          name: `API: ${event.method} ${event.endpoint}`,
          description: `Calling ${event.endpoint}`,
          metadata: { method: event.method, endpoint: event.endpoint },
        });
        operationMap.current.set(key, opId);
        break;
        
      case 'complete':
        const completeOpId = operationMap.current.get(key);
        if (completeOpId) {
          completeOperation(completeOpId);
          operationMap.current.delete(key);
        }
        break;
        
      case 'error':
        const errorOpId = operationMap.current.get(key);
        if (errorOpId) {
          completeOperation(errorOpId, {
            message: event.error || 'API call failed',
            severity: 'medium',
          });
          operationMap.current.delete(key);
        }
        
        // Also log as error
        logError({
          category: 'API Error',
          message: event.error || 'API call failed',
          severity: 'medium',
          details: { method: event.method, endpoint: event.endpoint },
        });
        break;
    }
  }, [startOperation, completeOperation, logError]);

  // File operation monitoring
  const handleFileOperation = useCallback((event: FileOperationEvent) => {
    const key = getOperationKey('file', `${event.operation}_${event.path}`);
    
    switch (event.status) {
      case 'start':
        const opId = startOperation({
          type: 'file_operation',
          name: `File: ${event.operation}`,
          description: event.path,
          metadata: { operation: event.operation, path: event.path },
        });
        operationMap.current.set(key, opId);
        break;
        
      case 'complete':
        const completeOpId = operationMap.current.get(key);
        if (completeOpId) {
          completeOperation(completeOpId);
          operationMap.current.delete(key);
        }
        break;
        
      case 'error':
        const errorOpId = operationMap.current.get(key);
        if (errorOpId) {
          completeOperation(errorOpId, {
            message: event.error || 'File operation failed',
            severity: 'medium',
          });
          operationMap.current.delete(key);
        }
        break;
    }
  }, [startOperation, completeOperation]);

  // Build process monitoring
  const handleBuildProcess = useCallback((event: BuildProcessEvent) => {
    const key = getOperationKey('build', event.process);
    
    switch (event.status) {
      case 'start':
        const opId = startOperation({
          type: 'build_process',
          name: `Build: ${event.process}`,
          description: `Running ${event.process}`,
          metadata: { process: event.process },
        });
        operationMap.current.set(key, opId);
        break;
        
      case 'progress':
        const progressOpId = operationMap.current.get(key);
        if (progressOpId && event.progress !== undefined) {
          updateOperation(progressOpId, { progress: event.progress });
        }
        break;
        
      case 'complete':
        const completeOpId = operationMap.current.get(key);
        if (completeOpId) {
          completeOperation(completeOpId);
          operationMap.current.delete(key);
        }
        break;
        
      case 'error':
        const errorOpId = operationMap.current.get(key);
        if (errorOpId) {
          completeOperation(errorOpId, {
            message: event.error || 'Build process failed',
            severity: 'high',
          });
          operationMap.current.delete(key);
        }
        
        // Log build error
        logError({
          category: 'Build Error',
          message: event.error || 'Build process failed',
          severity: 'high',
          details: { process: event.process, output: event.output },
        });
        break;
    }
  }, [startOperation, updateOperation, completeOperation, logError]);

  // Set up event listeners
  useEffect(() => {
    const unsubscribers: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Tool execution events
      unsubscribers.push(
        await listen<ToolExecutionEvent>('tool-execution', (event) => {
          handleToolExecution(event.payload);
        })
      );

      // API call events
      unsubscribers.push(
        await listen<ApiCallEvent>('api-call', (event) => {
          handleApiCall(event.payload);
        })
      );

      // File operation events
      unsubscribers.push(
        await listen<FileOperationEvent>('file-operation', (event) => {
          handleFileOperation(event.payload);
        })
      );

      // Build process events
      unsubscribers.push(
        await listen<BuildProcessEvent>('build-process', (event) => {
          handleBuildProcess(event.payload);
        })
      );

      // Generic error events
      unsubscribers.push(
        await listen<{ category: string; message: string; severity?: string }>('error', (event) => {
          logError({
            category: event.payload.category,
            message: event.payload.message,
            severity: (event.payload.severity as any) || 'medium',
          });
        })
      );
    };

    setupListeners();

    // Cleanup
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      operationMap.current.clear();
    };
  }, [handleToolExecution, handleApiCall, handleFileOperation, handleBuildProcess, logError]);
}

// Hook to track Gemini/Claude requests
export function useAIRequestTracking() {
  const tracker = useOperationTracker();

  const trackGeminiRequest = useCallback(
    async <T>(
      model: string,
      prompt: string,
      fn: () => Promise<T>
    ): Promise<T> => {
      return tracker.track(
        {
          type: 'gemini_request',
          name: `Gemini: ${model}`,
          description: prompt.slice(0, 100) + (prompt.length > 100 ? '...' : ''),
          metadata: { model, promptLength: prompt.length },
        },
        async (updateProgress) => {
          // Simulate progress for AI requests
          updateProgress(20);
          const result = await fn();
          updateProgress(100);
          return result;
        }
      );
    },
    [tracker]
  );

  const trackClaudeRequest = useCallback(
    async <T>(
      sessionId: string,
      prompt: string,
      fn: () => Promise<T>
    ): Promise<T> => {
      return tracker.track(
        {
          type: 'claude_request',
          name: 'Claude Request',
          description: prompt.slice(0, 100) + (prompt.length > 100 ? '...' : ''),
          metadata: { sessionId, promptLength: prompt.length },
        },
        async (updateProgress) => {
          // Simulate progress for AI requests
          updateProgress(20);
          const result = await fn();
          updateProgress(100);
          return result;
        }
      );
    },
    [tracker]
  );

  return { trackGeminiRequest, trackClaudeRequest };
}

// Hook for manual operation tracking
export function useManualTracking() {
  const { startOperation, updateOperation, completeOperation } = useMonitoringStore();
  const activeOperations = useRef<Map<string, string>>(new Map());

  const startTracking = useCallback(
    (
      key: string,
      type: OperationType,
      name: string,
      description?: string
    ): void => {
      const opId = startOperation({
        type,
        name,
        description,
      });
      activeOperations.current.set(key, opId);
    },
    [startOperation]
  );

  const updateProgress = useCallback(
    (key: string, progress: number): void => {
      const opId = activeOperations.current.get(key);
      if (opId) {
        updateOperation(opId, { progress });
      }
    },
    [updateOperation]
  );

  const completeTracking = useCallback(
    (key: string, error?: { message: string; severity?: 'low' | 'medium' | 'high' | 'critical' }): void => {
      const opId = activeOperations.current.get(key);
      if (opId) {
        completeOperation(opId, error);
        activeOperations.current.delete(key);
      }
    },
    [completeOperation]
  );

  return { startTracking, updateProgress, completeTracking };
}