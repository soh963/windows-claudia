import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonitoringStore } from '@/stores/monitoringStore';
import { useErrorTrackingStore } from '@/stores/errorTrackingStore';

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    // Reset stores
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
  });

  describe('Monitoring Store Performance', () => {
    it('should handle 1000 operations efficiently', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      const startTime = performance.now();
      
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.startOperation({
            type: 'api_call',
            name: `Operation ${i}`,
            description: `Description for operation ${i}`,
          });
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Creating 1000 operations took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
      expect(result.current.operations.size).toBe(1000);
    });

    it('should update operations efficiently', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      // First create operations
      const operationIds: string[] = [];
      act(() => {
        for (let i = 0; i < 100; i++) {
          const id = result.current.startOperation({
            type: 'file_operation',
            name: `File Op ${i}`,
          });
          operationIds.push(id);
        }
      });
      
      const startTime = performance.now();
      
      // Update all operations 10 times (simulating progress updates)
      act(() => {
        for (let progress = 10; progress <= 100; progress += 10) {
          operationIds.forEach(id => {
            result.current.updateOperation(id, { progress });
          });
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`1000 operation updates took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should calculate overall progress efficiently with many operations', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      // Create many operations with various progress
      act(() => {
        for (let i = 0; i < 500; i++) {
          const id = result.current.startOperation({
            type: 'build_process',
            name: `Build ${i}`,
          });
          result.current.updateOperation(id, { 
            progress: Math.floor(Math.random() * 100) 
          });
        }
      });
      
      const startTime = performance.now();
      let overallProgress: number;
      
      act(() => {
        for (let i = 0; i < 100; i++) {
          overallProgress = result.current.getOverallProgress();
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`100 overall progress calculations took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should clear completed operations efficiently', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      // Create mix of completed and active operations
      act(() => {
        for (let i = 0; i < 1000; i++) {
          const id = result.current.startOperation({
            type: 'api_call',
            name: `Op ${i}`,
          });
          
          if (i % 2 === 0) {
            result.current.completeOperation(id);
          }
        }
      });
      
      const startTime = performance.now();
      
      act(() => {
        result.current.clearCompletedOperations();
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Clearing 500 completed operations took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
      expect(result.current.operations.size).toBe(500); // Only active operations remain
    });
  });

  describe('Error Tracking Store Performance', () => {
    it('should capture 1000 errors efficiently', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      const startTime = performance.now();
      
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.captureError({
            category: ['api', 'runtime', 'ui', 'validation'][i % 4] as any,
            source: ['gemini-api', 'claude-api', 'react-component'][i % 3] as any,
            severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
            message: `Error message ${i}`,
            context: {
              component: `Component${i % 10}`,
              operation: `operation-${i}`,
            },
            impact: {
              userImpact: 'minor',
              functionalityImpact: [`feature-${i % 5}`],
            },
          });
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Capturing 1000 errors took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
      expect(result.current.errors.size).toBe(1000);
    });

    it('should update statistics efficiently with large dataset', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      // First create many errors
      act(() => {
        for (let i = 0; i < 500; i++) {
          result.current.captureError({
            category: 'api',
            source: 'gemini-api',
            severity: ['low', 'medium', 'high'][i % 3] as any,
            message: `API Error ${i}`,
            impact: {
              userImpact: 'minor',
              functionalityImpact: ['api'],
            },
          });
        }
      });
      
      const startTime = performance.now();
      
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.updateStatistics();
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`10 statistics updates with 500 errors took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500);
    });

    it('should detect patterns efficiently', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      // Create errors with patterns
      act(() => {
        const errorMessages = [
          'Connection timeout',
          'Rate limit exceeded',
          'Invalid authentication',
          'Network error',
          'Database connection failed'
        ];
        
        for (let i = 0; i < 1000; i++) {
          const message = errorMessages[i % errorMessages.length];
          result.current.captureError({
            category: 'api',
            source: 'gemini-api',
            severity: 'medium',
            message: `${message} - instance ${i}`,
            impact: {
              userImpact: 'minor',
              functionalityImpact: ['api'],
            },
          });
        }
      });
      
      const startTime = performance.now();
      
      act(() => {
        result.current.detectPatterns();
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Pattern detection on 1000 errors took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
      expect(result.current.errorPatterns.size).toBeGreaterThan(0);
    });

    it('should find similar errors efficiently', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      // Create many errors
      act(() => {
        for (let i = 0; i < 500; i++) {
          result.current.captureError({
            category: i % 2 === 0 ? 'api' : 'runtime',
            source: i % 3 === 0 ? 'gemini-api' : 'claude-api',
            severity: 'high',
            message: `Error type ${i % 10}: specific instance ${i}`,
            impact: {
              userImpact: 'major',
              functionalityImpact: ['feature'],
            },
          });
        }
      });
      
      const testError = Array.from(result.current.errors.values())[0];
      
      const startTime = performance.now();
      let similarErrors: any[];
      
      act(() => {
        for (let i = 0; i < 100; i++) {
          similarErrors = result.current.getSimilarErrors(testError);
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`100 similar error searches took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500);
    });

    it('should export large datasets efficiently', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      // Create many errors
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.captureError({
            category: 'api',
            source: 'gemini-api',
            severity: 'medium',
            message: `Export test error ${i}`,
            context: {
              endpoint: `/api/endpoint-${i}`,
              userId: `user-${i % 100}`,
            },
            impact: {
              userImpact: 'minor',
              functionalityImpact: ['export-test'],
            },
          });
        }
      });
      
      const startTime = performance.now();
      let jsonExport: string;
      let csvExport: string;
      
      act(() => {
        jsonExport = result.current.exportErrors('json');
        csvExport = result.current.exportErrors('csv');
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Exporting 1000 errors to JSON and CSV took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
      expect(jsonExport!.length).toBeGreaterThan(1000);
      expect(csvExport!.split('\n').length).toBeGreaterThan(1000);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory when operations are completed and cleared', () => {
      const { result } = renderHook(() => useMonitoringStore());
      
      // Measure initial memory (if available)
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Create and complete many operations
      act(() => {
        for (let cycle = 0; cycle < 10; cycle++) {
          const ids: string[] = [];
          
          // Create 100 operations
          for (let i = 0; i < 100; i++) {
            const id = result.current.startOperation({
              type: 'api_call',
              name: `Memory test op ${cycle}-${i}`,
              metadata: {
                largeData: Array(1000).fill(`Data ${i}`), // Some data to use memory
              },
            });
            ids.push(id);
          }
          
          // Complete all operations
          ids.forEach(id => {
            result.current.completeOperation(id);
          });
          
          // Clear completed operations
          result.current.clearCompletedOperations();
        }
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
        
        console.log(`Memory increase after operation cycles: ${memoryIncreaseMB.toFixed(2)} MB`);
        
        // Memory increase should be minimal after clearing
        expect(memoryIncreaseMB).toBeLessThan(10); // Less than 10MB increase
      }
      
      // Operations map should be empty
      expect(result.current.operations.size).toBe(0);
    });
  });

  describe('Real-world Scenario Performance', () => {
    it('should handle typical monitoring session efficiently', async () => {
      const { result: monitoringResult } = renderHook(() => useMonitoringStore());
      const { result: errorResult } = renderHook(() => useErrorTrackingStore());
      
      const startTime = performance.now();
      
      // Simulate a 1-hour monitoring session
      await act(async () => {
        // Simulate operations over time
        for (let minute = 0; minute < 60; minute++) {
          // 5-10 operations per minute
          const opsPerMinute = Math.floor(Math.random() * 5) + 5;
          
          for (let op = 0; op < opsPerMinute; op++) {
            const opId = monitoringResult.current.startOperation({
              type: ['api_call', 'file_operation', 'build_process'][op % 3] as any,
              name: `Operation ${minute}-${op}`,
            });
            
            // Simulate progress updates
            for (let progress = 20; progress <= 100; progress += 20) {
              monitoringResult.current.updateOperation(opId, { progress });
            }
            
            // 10% chance of error
            if (Math.random() < 0.1) {
              monitoringResult.current.completeOperation(opId, {
                message: 'Operation failed',
                severity: 'medium',
              });
              
              errorResult.current.captureError({
                category: 'runtime',
                source: 'tauri-backend',
                severity: 'medium',
                message: `Operation ${minute}-${op} failed`,
                impact: {
                  userImpact: 'minor',
                  functionalityImpact: ['operation'],
                },
              });
            } else {
              monitoringResult.current.completeOperation(opId);
            }
          }
          
          // Periodically clear old operations (every 10 minutes)
          if (minute % 10 === 0 && minute > 0) {
            monitoringResult.current.clearCompletedOperations();
          }
          
          // Update statistics every 5 minutes
          if (minute % 5 === 0) {
            errorResult.current.updateStatistics();
            errorResult.current.detectPatterns();
          }
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Simulated 1-hour session took: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // System should still be responsive
      const statsStartTime = performance.now();
      errorResult.current.updateStatistics();
      const statsEndTime = performance.now();
      
      console.log(`Final statistics update took: ${(statsEndTime - statsStartTime).toFixed(2)}ms`);
      expect(statsEndTime - statsStartTime).toBeLessThan(100);
    });
  });
});