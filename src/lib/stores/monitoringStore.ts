import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface OperationMetadata {
  model?: string;
  projectPath?: string;
  sessionId?: string;
  promptLength?: number;
  [key: string]: any;
}

export interface Operation {
  id: string;
  type: 'claude_request' | 'gemini_request' | 'ollama_request' | 'file_operation' | 'system_operation';
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  duration?: number;
  progress?: number; // 0-100
  metadata: OperationMetadata;
  error?: {
    message: string;
    severity: 'low' | 'medium' | 'high';
  };
}

export interface MonitoringStats {
  totalOperations: number;
  runningOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageDuration: number;
  totalTokens: number;
  totalTime: number;
}

interface MonitoringStore {
  operations: Operation[];
  
  // Actions
  startOperation: (operation: Omit<Operation, 'id' | 'status' | 'startTime'>) => string;
  updateOperation: (id: string, updates: Partial<Operation>) => void;
  completeOperation: (id: string, error?: { message: string; severity: 'low' | 'medium' | 'high' }) => void;
  cancelOperation: (id: string) => void;
  clearOperation: (id: string) => void;
  clearAllOperations: () => void;
  
  // Getters
  getOperation: (id: string) => Operation | undefined;
  getRunningOperations: () => Operation[];
  getStats: () => MonitoringStats;
}

export const useMonitoringStore = create<MonitoringStore>()(
  subscribeWithSelector((set, get) => ({
    operations: [],
    
    startOperation: (operation) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newOperation: Operation = {
        ...operation,
        id,
        status: 'running',
        startTime: Date.now(),
        progress: 0
      };
      
      set((state) => ({
        operations: [...state.operations, newOperation]
      }));
      
      return id;
    },
    
    updateOperation: (id, updates) => {
      set((state) => ({
        operations: state.operations.map((op) =>
          op.id === id ? { ...op, ...updates } : op
        )
      }));
    },
    
    completeOperation: (id, error) => {
      const operation = get().getOperation(id);
      if (!operation) return;
      
      const endTime = Date.now();
      const duration = endTime - operation.startTime;
      
      set((state) => ({
        operations: state.operations.map((op) =>
          op.id === id
            ? {
                ...op,
                status: error ? 'failed' : 'completed',
                endTime,
                duration,
                progress: error ? op.progress : 100,
                error
              }
            : op
        )
      }));
    },
    
    cancelOperation: (id) => {
      const operation = get().getOperation(id);
      if (!operation) return;
      
      const endTime = Date.now();
      const duration = endTime - operation.startTime;
      
      set((state) => ({
        operations: state.operations.map((op) =>
          op.id === id
            ? {
                ...op,
                status: 'cancelled',
                endTime,
                duration
              }
            : op
        )
      }));
    },
    
    clearOperation: (id) => {
      set((state) => ({
        operations: state.operations.filter((op) => op.id !== id)
      }));
    },
    
    clearAllOperations: () => {
      set({ operations: [] });
    },
    
    getOperation: (id) => {
      return get().operations.find((op) => op.id === id);
    },
    
    getRunningOperations: () => {
      return get().operations.filter((op) => op.status === 'running');
    },
    
    getStats: () => {
      const operations = get().operations;
      const totalOperations = operations.length;
      const runningOperations = operations.filter((op) => op.status === 'running').length;
      const completedOperations = operations.filter((op) => op.status === 'completed').length;
      const failedOperations = operations.filter((op) => op.status === 'failed').length;
      
      const completedOps = operations.filter((op) => op.status === 'completed' && op.duration);
      const averageDuration = completedOps.length > 0
        ? completedOps.reduce((sum, op) => sum + (op.duration || 0), 0) / completedOps.length
        : 0;
        
      const totalTokens = operations.reduce((sum, op) => {
        if (op.metadata.totalTokens) {
          return sum + op.metadata.totalTokens;
        }
        return sum;
      }, 0);
      
      const totalTime = operations.reduce((sum, op) => sum + (op.duration || 0), 0);
      
      return {
        totalOperations,
        runningOperations,
        completedOperations,
        failedOperations,
        averageDuration,
        totalTokens,
        totalTime
      };
    }
  }))
);

// Create store instance for direct access in non-React contexts
export const monitoringStore = useMonitoringStore.getState();

// Export types for use in components
export type { Operation, OperationMetadata, MonitoringStats };