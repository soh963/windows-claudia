import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMonitoringStore, useOperationTracker } from '@/stores/monitoringStore';
import { useErrorTrackingStore } from '@/stores/errorTrackingStore';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Monitoring System Integration', () => {
  beforeEach(() => {
    // Reset both stores
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

    useErrorTrackingStore.setState({
      errors: new Map(),
      errorPatterns: new Map(),
      statistics: {
        totalErrors: 0,
        errorsByCategory: {},
        errorsBySeverity: {},
        errorsBySource: {},
        errorRate: 0,
        resolutionRate: 0,
        averageResolutionTime: 0,
        topErrors: [],
        errorTrends: [],
      },
      selectedErrorId: null,
      filters: {},
      isErrorDashboardOpen: false,
      isErrorDetailsModalOpen: false,
    });

    vi.clearAllMocks();
  });

  describe('Operation and Error Tracking Integration', () => {
    it('should track operations and capture errors in error store', async () => {
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());
      const { result: trackerResult } = renderHook(() => useOperationTracker());

      const error = new Error('API request failed');
      const mockOperation = vi.fn().mockRejectedValue(error);

      await expect(
        act(async () => {
          return await trackerResult.current.track(
            {
              type: 'api_call',
              name: 'Failed API Call',
              description: 'Testing error integration',
            },
            mockOperation
          );
        })
      ).rejects.toThrow('API request failed');

      // Check monitoring store
      const operations = Array.from(monitoringResult.current.operations.values());
      expect(operations).toHaveLength(1);
      expect(operations[0].status).toBe('error');
      expect(operations[0].error?.message).toBe('API request failed');

      // Error should also be logged in monitoring store
      expect(monitoringResult.current.errors).toHaveLength(1);
      expect(monitoringResult.current.errorCounts.high).toBe(1);
    });

    it('should coordinate between stores when operations fail', async () => {
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());

      act(() => {
        const opId = monitoringResult.current.startOperation({
          type: 'gemini_request',
          name: 'Gemini API Call',
          metadata: {
            model: 'gemini-pro',
            endpoint: '/api/generate',
          },
        });

        // Simulate API failure
        monitoringResult.current.completeOperation(opId, {
          message: 'Rate limit exceeded',
          severity: 'medium',
          details: { retryAfter: 60 },
        });

        // Capture the error in error tracking store
        errorResult.current.captureApiError('gemini-api', {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          status: 429,
          response: { retryAfter: 60 },
        }, '/api/generate');
      });

      // Both stores should have the error information
      expect(monitoringResult.current.errorCounts.medium).toBe(1);
      expect(errorResult.current.statistics.totalErrors).toBe(1);
      
      const error = Array.from(errorResult.current.errors.values())[0];
      expect(error.category).toBe('api');
      expect(error.source).toBe('gemini-api');
      expect(error.severity).toBe('medium');
    });
  });

  describe('Tauri Backend Integration', () => {
    it('should track Tauri command execution', async () => {
      const { result: trackerResult } = renderHook(() => useOperationTracker());
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());

      const mockResponse = { data: 'test data' };
      (invoke as any).mockResolvedValue(mockResponse);

      const result = await act(async () => {
        return await trackerResult.current.track(
          {
            type: 'tool_execution',
            name: 'Read File',
            description: 'Reading configuration file',
          },
          async (updateProgress) => {
            updateProgress(25);
            const response = await invoke('read_file', { path: '/config.json' });
            updateProgress(75);
            return response;
          }
        );
      });

      expect(result).toEqual(mockResponse);
      expect(invoke).toHaveBeenCalledWith('read_file', { path: '/config.json' });

      const operations = Array.from(monitoringResult.current.operations.values());
      expect(operations[0].status).toBe('completed');
      expect(operations[0].progress).toBe(100);
    });

    it('should handle Tauri command failures', async () => {
      const { result: trackerResult } = renderHook(() => useOperationTracker());
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());

      const tauriError = new Error('Permission denied');
      (invoke as any).mockRejectedValue(tauriError);

      await expect(
        act(async () => {
          return await trackerResult.current.track(
            {
              type: 'file_operation',
              name: 'Write File',
              description: 'Saving user data',
            },
            async () => {
              return await invoke('write_file', { 
                path: '/protected/file.txt',
                content: 'data' 
              });
            }
          );
        })
      ).rejects.toThrow('Permission denied');

      // Capture the Tauri error
      act(() => {
        errorResult.current.captureTauriError(tauriError, 'write_file');
      });

      const error = Array.from(errorResult.current.errors.values())[0];
      expect(error.category).toBe('runtime');
      expect(error.source).toBe('tauri-backend');
      expect(error.context.operation).toBe('write_file');
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should handle multi-step build process with monitoring', async () => {
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());

      // Simulate a build process
      const buildSteps = [
        { name: 'Clean', duration: 100 },
        { name: 'Compile', duration: 300 },
        { name: 'Test', duration: 200 },
        { name: 'Package', duration: 150 },
      ];

      const buildProcess = async () => {
        const mainOpId = monitoringResult.current.startOperation({
          type: 'build_process',
          name: 'Build Project',
          description: 'Complete build process',
        });

        let totalProgress = 0;
        const progressPerStep = 100 / buildSteps.length;

        for (const step of buildSteps) {
          const stepOpId = monitoringResult.current.startOperation({
            type: 'build_process',
            name: `Build Step: ${step.name}`,
            metadata: { parentOperationId: mainOpId },
          });

          await new Promise(resolve => setTimeout(resolve, step.duration));
          
          totalProgress += progressPerStep;
          monitoringResult.current.updateOperation(mainOpId, { 
            progress: Math.round(totalProgress) 
          });
          
          monitoringResult.current.completeOperation(stepOpId);
        }

        monitoringResult.current.completeOperation(mainOpId);
      };

      await act(async () => {
        await buildProcess();
      });

      const operations = Array.from(monitoringResult.current.operations.values());
      
      // Should have main operation + 4 step operations
      expect(operations).toHaveLength(5);
      
      // All operations should be completed
      expect(operations.every(op => op.status === 'completed')).toBe(true);
      
      // No errors should be recorded
      expect(monitoringResult.current.errors).toHaveLength(0);
      expect(errorResult.current.statistics.totalErrors).toBe(0);
    });

    it('should handle concurrent operations with different outcomes', async () => {
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());

      const operations = [
        {
          type: 'api_call' as const,
          name: 'API Call 1',
          shouldFail: false,
          duration: 100,
        },
        {
          type: 'gemini_request' as const,
          name: 'Gemini Request',
          shouldFail: true,
          duration: 150,
          error: { message: 'Token expired', severity: 'high' as const },
        },
        {
          type: 'file_operation' as const,
          name: 'File Upload',
          shouldFail: false,
          duration: 200,
        },
      ];

      await act(async () => {
        const promises = operations.map(async (op) => {
          const opId = monitoringResult.current.startOperation({
            type: op.type,
            name: op.name,
          });

          await new Promise(resolve => setTimeout(resolve, op.duration));

          if (op.shouldFail && op.error) {
            monitoringResult.current.completeOperation(opId, op.error);
            
            // Also track in error store
            errorResult.current.captureError({
              category: 'api',
              source: 'gemini-api',
              severity: op.error.severity,
              message: op.error.message,
              context: { operation: op.name },
              impact: {
                userImpact: 'major',
                functionalityImpact: ['gemini-features'],
              },
            });
          } else {
            monitoringResult.current.completeOperation(opId);
          }
        });

        await Promise.all(promises);
      });

      // Check results
      const allOperations = Array.from(monitoringResult.current.operations.values());
      expect(allOperations).toHaveLength(3);
      
      const failedOperations = allOperations.filter(op => op.status === 'error');
      expect(failedOperations).toHaveLength(1);
      expect(failedOperations[0].name).toBe('Gemini Request');
      
      const successfulOperations = allOperations.filter(op => op.status === 'completed' && !op.error);
      expect(successfulOperations).toHaveLength(2);
      
      // Check error tracking
      expect(errorResult.current.statistics.totalErrors).toBe(1);
      expect(errorResult.current.statistics.errorsBySeverity.high).toBe(1);
    });
  });

  describe('Real-time Updates and Subscriptions', () => {
    it('should handle real-time operation updates', async () => {
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());
      
      let operationId: string;
      const progressUpdates: number[] = [];
      
      // Subscribe to operation updates
      const unsubscribe = useMonitoringStore.subscribe(
        (state) => state.operations,
        (operations) => {
          if (operationId) {
            const op = operations.get(operationId);
            if (op) {
              progressUpdates.push(op.progress);
            }
          }
        }
      );

      act(() => {
        operationId = monitoringResult.current.startOperation({
          type: 'claude_request',
          name: 'Claude API Stream',
          description: 'Streaming response',
        });
      });

      // Simulate streaming updates
      await act(async () => {
        for (let progress = 10; progress <= 100; progress += 10) {
          monitoringResult.current.updateOperation(operationId, { progress });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        monitoringResult.current.completeOperation(operationId);
      });

      unsubscribe();

      // Should have captured all progress updates
      expect(progressUpdates.length).toBeGreaterThan(5);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('should coordinate error patterns across multiple similar failures', async () => {
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());
      
      // Simulate multiple similar API failures
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          errorResult.current.captureApiError(
            'gemini-api',
            {
              message: 'Connection timeout',
              code: 'TIMEOUT',
              status: 504,
            },
            '/api/generate'
          );
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        errorResult.current.detectPatterns();
      });

      const patterns = Array.from(errorResult.current.errorPatterns.values());
      expect(patterns.length).toBeGreaterThan(0);
      
      const timeoutPattern = patterns.find(p => p.pattern.includes('timeout'));
      expect(timeoutPattern).toBeDefined();
      expect(timeoutPattern?.occurrences).toBe(5);
      
      // Generate prevention report
      const preventionReport = errorResult.current.generatePreventionReport();
      expect(preventionReport.length).toBeGreaterThan(0);
      expect(preventionReport[0].suggestedPrevention).toBeTruthy();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high volume of operations efficiently', async () => {
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());
      
      const startTime = Date.now();
      const operationCount = 100;
      
      await act(async () => {
        const operations = [];
        
        // Create many operations
        for (let i = 0; i < operationCount; i++) {
          const opId = monitoringResult.current.startOperation({
            type: i % 2 === 0 ? 'api_call' : 'file_operation',
            name: `Operation ${i}`,
            metadata: { index: i },
          });
          operations.push(opId);
        }
        
        // Update them all
        operations.forEach((opId, index) => {
          monitoringResult.current.updateOperation(opId, { 
            progress: Math.round((index / operationCount) * 100) 
          });
        });
        
        // Complete half of them
        operations.slice(0, operationCount / 2).forEach(opId => {
          monitoringResult.current.completeOperation(opId);
        });
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second for 100 operations
      
      // Check state consistency
      expect(monitoringResult.current.operations.size).toBe(operationCount);
      expect(monitoringResult.current.activeOperations.length).toBe(operationCount / 2);
    });

    it('should maintain performance with large error history', async () => {
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());
      
      const startTime = Date.now();
      
      await act(async () => {
        // Generate many errors
        for (let i = 0; i < 500; i++) {
          errorResult.current.captureError({
            category: i % 2 === 0 ? 'api' : 'runtime',
            source: i % 3 === 0 ? 'gemini-api' : 'react-component',
            severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
            message: `Error message ${i}`,
            impact: {
              userImpact: 'minor',
              functionalityImpact: [`feature-${i % 10}`],
            },
          });
        }
        
        // Update statistics
        errorResult.current.updateStatistics();
        errorResult.current.detectPatterns();
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete analysis quickly
      expect(duration).toBeLessThan(2000); // 2 seconds for 500 errors
      
      // Statistics should be accurate
      expect(errorResult.current.statistics.totalErrors).toBeGreaterThan(0);
      expect(Object.keys(errorResult.current.statistics.errorsByCategory).length).toBe(2);
      expect(Object.keys(errorResult.current.statistics.errorsBySeverity).length).toBe(4);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from store corruption', async () => {
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());
      
      // Simulate corrupted state
      act(() => {
        // @ts-ignore - Intentionally setting invalid state
        useMonitoringStore.setState({
          operations: 'invalid',
          activeOperations: null,
        });
      });
      
      // Store should handle gracefully
      expect(() => {
        monitoringResult.current.startOperation({
          type: 'api_call',
          name: 'Recovery Test',
        });
      }).not.toThrow();
    });

    it('should handle circular references in error data', () => {
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());
      
      const circularObj: any = { a: 1 };
      circularObj.self = circularObj;
      
      expect(() => {
        act(() => {
          errorResult.current.captureError({
            category: 'runtime',
            source: 'react-component',
            severity: 'medium',
            message: 'Circular reference test',
            details: circularObj,
            impact: {
              userImpact: 'none',
              functionalityImpact: ['test'],
            },
          });
        });
      }).not.toThrow();
      
      const error = Array.from(errorResult.current.errors.values())[0];
      expect(error).toBeDefined();
      expect(error.message).toBe('Circular reference test');
    });
  });
});