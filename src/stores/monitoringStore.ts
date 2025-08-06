import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { StateCreator } from 'zustand';

export type OperationType = 
  | 'api_call'
  | 'file_operation'
  | 'tool_execution'
  | 'build_process'
  | 'gemini_request'
  | 'claude_request';

export type OperationStatus = 'pending' | 'running' | 'completed' | 'error';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Operation {
  id: string;
  type: OperationType;
  status: OperationStatus;
  name: string;
  description?: string;
  progress: number; // 0-100
  startTime: number;
  endTime?: number;
  error?: {
    message: string;
    severity: ErrorSeverity;
    details?: unknown;
  };
  metadata?: Record<string, any>;
}

export interface ErrorLog {
  id: string;
  timestamp: number;
  operationId?: string;
  message: string;
  severity: ErrorSeverity;
  category: string;
  details?: unknown;
  acknowledged: boolean;
}

interface MonitoringState {
  // Operations tracking
  operations: Map<string, Operation>;
  activeOperations: string[]; // IDs of currently active operations
  
  // Error tracking
  errors: ErrorLog[];
  errorCounts: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  
  // UI state
  isStatusBarExpanded: boolean;
  isProgressTrackerVisible: boolean;
  selectedOperationId: string | null;
  
  // Actions
  startOperation: (operation: Omit<Operation, 'id' | 'status' | 'progress' | 'startTime'>) => string;
  updateOperation: (id: string, update: Partial<Operation>) => void;
  completeOperation: (id: string, error?: Operation['error']) => void;
  cancelOperation: (id: string) => void;
  
  // Error actions
  logError: (error: Omit<ErrorLog, 'id' | 'timestamp' | 'acknowledged'>) => void;
  acknowledgeError: (errorId: string) => void;
  clearErrors: (category?: string) => void;
  
  // UI actions
  toggleStatusBar: () => void;
  toggleProgressTracker: () => void;
  selectOperation: (operationId: string | null) => void;
  
  // Utility actions
  clearCompletedOperations: () => void;
  getOperationDuration: (operationId: string) => number | null;
  getOverallProgress: () => number;
}

const monitoringStore: StateCreator<
  MonitoringState,
  [],
  [['zustand/subscribeWithSelector', never]],
  MonitoringState
> = (set, get) => ({
  // Initial state
  operations: new Map(),
  activeOperations: [],
  errors: [],
  errorCounts: {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  },
  isStatusBarExpanded: false,
  isProgressTrackerVisible: false,
  selectedOperationId: null,
  
  // Start a new operation
  startOperation: (operationData) => {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation: Operation = {
      ...operationData,
      id,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
    };
    
    set((state) => {
      const newOperations = new Map(state.operations);
      newOperations.set(id, operation);
      
      return {
        operations: newOperations,
        activeOperations: [...state.activeOperations, id],
      };
    });
    
    // Auto-start the operation after a brief delay
    setTimeout(() => {
      get().updateOperation(id, { status: 'running' });
    }, 100);
    
    return id;
  },
  
  // Update an operation
  updateOperation: (id, update) => {
    set((state) => {
      const operation = state.operations.get(id);
      if (!operation) return state;
      
      const newOperations = new Map(state.operations);
      newOperations.set(id, { ...operation, ...update });
      
      return { operations: newOperations };
    });
  },
  
  // Complete an operation
  completeOperation: (id, error) => {
    set((state) => {
      const operation = state.operations.get(id);
      if (!operation) return state;
      
      const newOperations = new Map(state.operations);
      newOperations.set(id, {
        ...operation,
        status: error ? 'error' : 'completed',
        progress: 100,
        endTime: Date.now(),
        error,
      });
      
      const newActiveOperations = state.activeOperations.filter((opId) => opId !== id);
      
      // Update error counts if there's an error
      let newErrorCounts = state.errorCounts;
      if (error) {
        newErrorCounts = {
          ...state.errorCounts,
          [error.severity]: state.errorCounts[error.severity] + 1,
        };
      }
      
      return {
        operations: newOperations,
        activeOperations: newActiveOperations,
        errorCounts: newErrorCounts,
      };
    });
  },
  
  // Cancel an operation
  cancelOperation: (id) => {
    get().completeOperation(id, {
      message: 'Operation cancelled by user',
      severity: 'low',
    });
  },
  
  // Log an error
  logError: (errorData) => {
    const error: ErrorLog = {
      ...errorData,
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      acknowledged: false,
    };
    
    set((state) => ({
      errors: [error, ...state.errors].slice(0, 100), // Keep last 100 errors
      errorCounts: {
        ...state.errorCounts,
        [error.severity]: state.errorCounts[error.severity] + 1,
      },
    }));
  },
  
  // Acknowledge an error
  acknowledgeError: (errorId) => {
    set((state) => ({
      errors: state.errors.map((err) =>
        err.id === errorId ? { ...err, acknowledged: true } : err
      ),
    }));
  },
  
  // Clear errors
  clearErrors: (category) => {
    set((state) => {
      const newErrors = category
        ? state.errors.filter((err) => err.category !== category)
        : [];
      
      // Recalculate error counts
      const newErrorCounts = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };
      
      newErrors.forEach((err) => {
        if (!err.acknowledged) {
          newErrorCounts[err.severity]++;
        }
      });
      
      return {
        errors: newErrors,
        errorCounts: newErrorCounts,
      };
    });
  },
  
  // UI actions
  toggleStatusBar: () => set((state) => ({ isStatusBarExpanded: !state.isStatusBarExpanded })),
  toggleProgressTracker: () => set((state) => ({ isProgressTrackerVisible: !state.isProgressTrackerVisible })),
  selectOperation: (operationId) => set({ selectedOperationId: operationId }),
  
  // Clear completed operations
  clearCompletedOperations: () => {
    set((state) => {
      const newOperations = new Map();
      state.operations.forEach((op, id) => {
        if (op.status === 'pending' || op.status === 'running') {
          newOperations.set(id, op);
        }
      });
      
      return { operations: newOperations };
    });
  },
  
  // Get operation duration
  getOperationDuration: (operationId) => {
    const operation = get().operations.get(operationId);
    if (!operation) return null;
    
    const endTime = operation.endTime || Date.now();
    return endTime - operation.startTime;
  },
  
  // Get overall progress
  getOverallProgress: () => {
    const { operations } = get();
    if (operations.size === 0) return 0;
    
    let totalProgress = 0;
    operations.forEach((op) => {
      totalProgress += op.progress;
    });
    
    return Math.round(totalProgress / operations.size);
  },
});

export const useMonitoringStore = create<MonitoringState>()(
  subscribeWithSelector(monitoringStore)
);

// Helper hook for tracking operations
export function useOperationTracker() {
  const { startOperation, updateOperation, completeOperation } = useMonitoringStore();
  
  return {
    track: async <T>(
      operationData: Omit<Operation, 'id' | 'status' | 'progress' | 'startTime'>,
      fn: (updateProgress: (progress: number) => void) => Promise<T>
    ): Promise<T> => {
      const operationId = startOperation(operationData);
      
      try {
        const result = await fn((progress) => {
          updateOperation(operationId, { progress });
        });
        
        completeOperation(operationId);
        return result;
      } catch (error) {
        completeOperation(operationId, {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          severity: 'high',
          details: error,
        });
        throw error;
      }
    },
  };
}