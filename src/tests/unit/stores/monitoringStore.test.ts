import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMonitoringStore, useOperationTracker } from '@/stores/monitoringStore';

describe('MonitoringStore', () => {
  beforeEach(() => {
    // Reset store state
    useMonitoringStore.setState({
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
    });
  });

  describe('Operation Management', () => {
    it('should start an operation', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const operationId = result.current.startOperation({
          type: 'api_call',
          name: 'Test API Call',
          description: 'Testing API operation',
        });
        
        expect(operationId).toBeTruthy();
        expect(result.current.operations.has(operationId)).toBe(true);
        expect(result.current.activeOperations).toContain(operationId);
      });
    });

    it('should update operation progress', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const operationId = result.current.startOperation({
          type: 'file_operation',
          name: 'File Upload',
        });
        
        result.current.updateOperation(operationId, { progress: 50 });
        
        const operation = result.current.operations.get(operationId);
        expect(operation?.progress).toBe(50);
      });
    });

    it('should complete operation successfully', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const operationId = result.current.startOperation({
          type: 'build_process',
          name: 'Build Project',
        });
        
        result.current.completeOperation(operationId);
        
        const operation = result.current.operations.get(operationId);
        expect(operation?.status).toBe('completed');
        expect(operation?.progress).toBe(100);
        expect(operation?.endTime).toBeDefined();
        expect(result.current.activeOperations).not.toContain(operationId);
      });
    });

    it('should complete operation with error', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const operationId = result.current.startOperation({
          type: 'api_call',
          name: 'Failed API Call',
        });
        
        result.current.completeOperation(operationId, {
          message: 'Network error',
          severity: 'high',
          details: { code: 'NETWORK_ERROR' },
        });
        
        const operation = result.current.operations.get(operationId);
        expect(operation?.status).toBe('error');
        expect(operation?.error?.message).toBe('Network error');
        expect(result.current.errorCounts.high).toBe(1);
      });
    });

    it('should cancel an operation', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const operationId = result.current.startOperation({
          type: 'tool_execution',
          name: 'Long Running Tool',
        });
        
        result.current.cancelOperation(operationId);
        
        const operation = result.current.operations.get(operationId);
        expect(operation?.status).toBe('error');
        expect(operation?.error?.message).toBe('Operation cancelled by user');
        expect(operation?.error?.severity).toBe('low');
      });
    });

    it('should auto-start operation after delay', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useMonitoringStore());
      
      let operationId: string;
      act(() => {
        operationId = result.current.startOperation({
          type: 'api_call',
          name: 'Delayed Start',
        });
      });
      
      expect(result.current.operations.get(operationId!)?.status).toBe('pending');
      
      act(() => {
        vi.advanceTimersByTime(100);
      });
      
      expect(result.current.operations.get(operationId!)?.status).toBe('running');
      
      vi.useRealTimers();
    });
  });

  describe('Error Tracking', () => {
    it('should log an error', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        result.current.logError({
          message: 'Test error',
          severity: 'medium',
          category: 'validation',
          details: { field: 'email' },
        });
      });
      
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].message).toBe('Test error');
      expect(result.current.errorCounts.medium).toBe(1);
    });

    it('should acknowledge an error', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        result.current.logError({
          message: 'Unacknowledged error',
          severity: 'high',
          category: 'runtime',
        });
        
        const errorId = result.current.errors[0].id;
        result.current.acknowledgeError(errorId);
      });
      
      expect(result.current.errors[0].acknowledged).toBe(true);
    });

    it('should clear errors by category', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        result.current.logError({
          message: 'API Error',
          severity: 'high',
          category: 'api',
        });
        
        result.current.logError({
          message: 'UI Error',
          severity: 'low',
          category: 'ui',
        });
        
        result.current.clearErrors('api');
      });
      
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].category).toBe('ui');
      expect(result.current.errorCounts.high).toBe(0);
      expect(result.current.errorCounts.low).toBe(1);
    });

    it('should limit error history to 100 entries', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        for (let i = 0; i < 105; i++) {
          result.current.logError({
            message: `Error ${i}`,
            severity: 'low',
            category: 'test',
          });
        }
      });
      
      expect(result.current.errors).toHaveLength(100);
      expect(result.current.errors[0].message).toBe('Error 104');
    });
  });

  describe('UI State Management', () => {
    it('should toggle status bar', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      expect(result.current.isStatusBarExpanded).toBe(false);
      
      act(() => {
        result.current.toggleStatusBar();
      });
      
      expect(result.current.isStatusBarExpanded).toBe(true);
      
      act(() => {
        result.current.toggleStatusBar();
      });
      
      expect(result.current.isStatusBarExpanded).toBe(false);
    });

    it('should toggle progress tracker', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      expect(result.current.isProgressTrackerVisible).toBe(false);
      
      act(() => {
        result.current.toggleProgressTracker();
      });
      
      expect(result.current.isProgressTrackerVisible).toBe(true);
    });

    it('should select an operation', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const operationId = result.current.startOperation({
          type: 'api_call',
          name: 'Selected Operation',
        });
        
        result.current.selectOperation(operationId);
      });
      
      expect(result.current.selectedOperationId).toBeTruthy();
    });
  });

  describe('Utility Functions', () => {
    it('should clear completed operations', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const op1 = result.current.startOperation({
          type: 'api_call',
          name: 'Completed Op',
        });
        
        const op2 = result.current.startOperation({
          type: 'file_operation',
          name: 'Running Op',
        });
        
        result.current.completeOperation(op1);
        result.current.clearCompletedOperations();
      });
      
      expect(result.current.operations.size).toBe(1);
      expect(Array.from(result.current.operations.values())[0].name).toBe('Running Op');
    });

    it('should calculate operation duration', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const operationId = result.current.startOperation({
          type: 'build_process',
          name: 'Timed Operation',
        });
        
        // Simulate time passing
        const operation = result.current.operations.get(operationId)!;
        result.current.operations.set(operationId, {
          ...operation,
          endTime: operation.startTime + 5000,
        });
        
        const duration = result.current.getOperationDuration(operationId);
        expect(duration).toBe(5000);
      });
    });

    it('should calculate overall progress', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      act(() => {
        const op1 = result.current.startOperation({
          type: 'api_call',
          name: 'Op 1',
        });
        
        const op2 = result.current.startOperation({
          type: 'file_operation',
          name: 'Op 2',
        });
        
        result.current.updateOperation(op1, { progress: 50 });
        result.current.updateOperation(op2, { progress: 30 });
        
        const overallProgress = result.current.getOverallProgress();
        expect(overallProgress).toBe(40); // (50 + 30) / 2
      });
    });
  });

  describe('useOperationTracker Hook', () => {
    it('should track successful operation', async () => {
      const { result } = renderHook(() => ({
        tracker: useOperationTracker(),
        store: useMonitoringStore(),
      }));
      
      const mockFn = vi.fn().mockImplementation(async (updateProgress) => {
        updateProgress(25);
        updateProgress(50);
        updateProgress(75);
        return 'success';
      });
      
      const operationResult = await act(async () => {
        return await result.current.tracker.track(
          {
            type: 'api_call',
            name: 'Tracked Operation',
          },
          mockFn
        );
      });
      
      expect(operationResult).toBe('success');
      expect(mockFn).toHaveBeenCalled();
      
      const operations = Array.from(result.current.store.operations.values());
      expect(operations).toHaveLength(1);
      expect(operations[0].status).toBe('completed');
      expect(operations[0].error).toBeUndefined();
    });

    it('should track failed operation', async () => {
      const { result } = renderHook(() => ({
        tracker: useOperationTracker(),
        store: useMonitoringStore(),
      }));
      
      const error = new Error('Operation failed');
      const mockFn = vi.fn().mockRejectedValue(error);
      
      await expect(
        act(async () => {
          return await result.current.tracker.track(
            {
              type: 'tool_execution',
              name: 'Failed Operation',
            },
            mockFn
          );
        })
      ).rejects.toThrow('Operation failed');
      
      const operations = Array.from(result.current.store.operations.values());
      expect(operations).toHaveLength(1);
      expect(operations[0].status).toBe('error');
      expect(operations[0].error?.message).toBe('Operation failed');
      expect(operations[0].error?.severity).toBe('high');
    });
  });
});