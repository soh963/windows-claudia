import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Execution status types
 */
export type ExecutionStatus = 'idle' | 'executing' | 'stopped' | 'completed' | 'error';

/**
 * Execution state for a session
 */
export interface ExecutionState {
  session_id: string;
  status: ExecutionStatus;
  can_continue: boolean;
  checkpoint_data?: any;
  elapsed_time: number;
  total_tokens: number;
}

/**
 * Execution control API
 */
export class ExecutionControlAPI {
  /**
   * Stop execution for a session
   */
  static async stopExecution(sessionId: string): Promise<ExecutionState> {
    return await invoke('stop_execution', { sessionId });
  }

  /**
   * Continue execution from where it was stopped
   */
  static async continueExecution(sessionId: string): Promise<ExecutionState> {
    return await invoke('continue_execution', { sessionId });
  }

  /**
   * Reset execution session
   */
  static async resetExecution(sessionId: string): Promise<void> {
    return await invoke('reset_execution', { sessionId });
  }

  /**
   * Get execution status for a session
   */
  static async getExecutionStatus(sessionId: string): Promise<ExecutionState> {
    return await invoke('get_execution_status', { sessionId });
  }

  /**
   * Update execution metrics
   */
  static async updateExecutionMetrics(
    sessionId: string,
    elapsedTime?: number,
    totalTokens?: number
  ): Promise<void> {
    return await invoke('update_execution_metrics', {
      sessionId,
      elapsedTime,
      totalTokens
    });
  }

  /**
   * Listen for execution stop events
   */
  static onExecutionStopped(
    sessionId: string,
    callback: (state: ExecutionState) => void
  ): Promise<UnlistenFn> {
    return listen(`execution-stopped:${sessionId}`, (event) => {
      callback(event.payload as ExecutionState);
    });
  }

  /**
   * Listen for execution continue events
   */
  static onExecutionContinued(
    sessionId: string,
    callback: (state: ExecutionState) => void
  ): Promise<UnlistenFn> {
    return listen(`execution-continued:${sessionId}`, (event) => {
      callback(event.payload as ExecutionState);
    });
  }

  /**
   * Listen for execution completed events
   */
  static onExecutionCompleted(
    sessionId: string,
    callback: (state: ExecutionState) => void
  ): Promise<UnlistenFn> {
    return listen(`execution-completed:${sessionId}`, (event) => {
      callback(event.payload as ExecutionState);
    });
  }

  /**
   * Listen for execution reset events
   */
  static onExecutionReset(
    sessionId: string,
    callback: (data: { session_id: string }) => void
  ): Promise<UnlistenFn> {
    return listen(`execution-reset:${sessionId}`, (event) => {
      callback(event.payload as { session_id: string });
    });
  }
}

/**
 * Hook for managing execution control state
 */
export function useExecutionControl(sessionId: string | null) {
  const [executionState, setExecutionState] = React.useState<ExecutionState | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const unlistenersRef = React.useRef<UnlistenFn[]>([]);

  // Cleanup listeners on unmount or session change
  React.useEffect(() => {
    return () => {
      unlistenersRef.current.forEach(fn => fn());
      unlistenersRef.current = [];
    };
  }, [sessionId]);

  // Setup event listeners
  React.useEffect(() => {
    if (!sessionId) return;

    const setupListeners = async () => {
      try {
        // Get initial status
        const state = await ExecutionControlAPI.getExecutionStatus(sessionId);
        setExecutionState(state);

        // Setup event listeners
        const listeners = await Promise.all([
          ExecutionControlAPI.onExecutionStopped(sessionId, setExecutionState),
          ExecutionControlAPI.onExecutionContinued(sessionId, setExecutionState),
          ExecutionControlAPI.onExecutionCompleted(sessionId, setExecutionState),
          ExecutionControlAPI.onExecutionReset(sessionId, () => {
            setExecutionState(null);
          })
        ]);

        unlistenersRef.current = listeners;
      } catch (err) {
        console.error('Failed to setup execution listeners:', err);
        // Session might not exist yet, which is okay
      }
    };

    setupListeners();
  }, [sessionId]);

  const stopExecution = React.useCallback(async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const state = await ExecutionControlAPI.stopExecution(sessionId);
      setExecutionState(state);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to stop execution';
      setError(errorMsg);
      console.error('Stop execution error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const continueExecution = React.useCallback(async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const state = await ExecutionControlAPI.continueExecution(sessionId);
      setExecutionState(state);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to continue execution';
      setError(errorMsg);
      console.error('Continue execution error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const resetExecution = React.useCallback(async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await ExecutionControlAPI.resetExecution(sessionId);
      setExecutionState(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to reset execution';
      setError(errorMsg);
      console.error('Reset execution error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const updateMetrics = React.useCallback(async (elapsedTime?: number, totalTokens?: number) => {
    if (!sessionId) return;
    
    try {
      await ExecutionControlAPI.updateExecutionMetrics(sessionId, elapsedTime, totalTokens);
    } catch (err) {
      console.error('Failed to update metrics:', err);
    }
  }, [sessionId]);

  return {
    executionState,
    isLoading,
    error,
    stopExecution,
    continueExecution,
    resetExecution,
    updateMetrics,
    isExecuting: executionState?.status === 'executing',
    isStopped: executionState?.status === 'stopped',
    canContinue: executionState?.can_continue ?? false
  };
}

// Add React import for the hook
import React from 'react';