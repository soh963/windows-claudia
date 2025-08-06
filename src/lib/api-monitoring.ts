import { invoke } from "@tauri-apps/api/core";
import { useMonitoringStore } from '@/stores/monitoringStore';

// Wrapper for invoke to add monitoring
export async function monitoredInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options?: {
    operationName?: string;
    operationDescription?: string;
  }
): Promise<T> {
  const { startOperation, updateOperation, completeOperation } = useMonitoringStore.getState();
  
  const operationId = startOperation({
    type: 'api_call',
    name: options?.operationName || `API: ${cmd}`,
    description: options?.operationDescription || `Invoking ${cmd}`,
    metadata: { command: cmd, args },
  });

  try {
    // Update to running state
    updateOperation(operationId, { status: 'running', progress: 50 });
    
    // Make the actual API call
    const result = await invoke<T>(cmd, args);
    
    // Complete successfully
    completeOperation(operationId);
    
    return result;
  } catch (error) {
    // Complete with error
    completeOperation(operationId, {
      message: error instanceof Error ? error.message : 'API call failed',
      severity: 'medium',
      details: error,
    });
    
    throw error;
  }
}

// Helper to create monitored API functions
export function createMonitoredApi<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationType: 'api_call' | 'file_operation' | 'tool_execution',
  getName: (...args: Parameters<T>) => string,
  getDescription?: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const { startOperation, completeOperation } = useMonitoringStore.getState();
    
    const operationId = startOperation({
      type: operationType,
      name: getName(...args),
      description: getDescription?.(...args),
    });

    try {
      const result = await fn(...args);
      completeOperation(operationId);
      return result;
    } catch (error) {
      completeOperation(operationId, {
        message: error instanceof Error ? error.message : 'Operation failed',
        severity: 'medium',
        details: error,
      });
      throw error;
    }
  }) as T;
}