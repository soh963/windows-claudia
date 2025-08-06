import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useErrorTrackingStore, useErrorCapture, setupGlobalErrorHandlers } from '@/stores/errorTrackingStore';

describe('ErrorTrackingStore', () => {
  beforeEach(() => {
    // Reset store state
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
    vi.clearAllTimers();
  });

  describe('Error Capture', () => {
    it('should capture a generic error', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      act(() => {
        const errorId = result.current.captureError({
          category: 'api',
          source: 'gemini-api',
          severity: 'high',
          message: 'API request failed',
          resolved: false,
          context: {
            endpoint: '/api/generate',
            operation: 'text-generation',
          },
          impact: {
            userImpact: 'major',
            functionalityImpact: ['text generation'],
          },
        });
        
        expect(errorId).toBeTruthy();
        const error = result.current.errors.get(errorId);
        expect(error).toBeDefined();
        expect(error?.message).toBe('API request failed');
        expect(error?.resolved).toBe(false);
      });
    });

    it('should capture React Error Boundary errors', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      const error = new Error('Component crashed');
      error.stack = 'Error stack trace';
      
      const errorInfo = {
        componentStack: 'Component stack trace',
      };
      
      act(() => {
        result.current.captureErrorBoundary(error, errorInfo as any, 'TestComponent');
      });
      
      const capturedError = Array.from(result.current.errors.values())[0];
      expect(capturedError.category).toBe('ui');
      expect(capturedError.source).toBe('react-component');
      expect(capturedError.severity).toBe('high');
      expect(capturedError.context.component).toBe('TestComponent');
    });

    it('should capture Tauri backend errors', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      const tauriError = {
        message: 'File not found',
        code: 'FILE_NOT_FOUND',
      };
      
      act(() => {
        result.current.captureTauriError(tauriError, 'readFile');
      });
      
      const capturedError = Array.from(result.current.errors.values())[0];
      expect(capturedError.category).toBe('runtime');
      expect(capturedError.source).toBe('tauri-backend');
      expect(capturedError.context.operation).toBe('readFile');
    });

    it('should capture API errors with proper categorization', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      const apiError = {
        message: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        status: 429,
        response: { retryAfter: 60 },
      };
      
      act(() => {
        result.current.captureApiError('gemini-api', apiError, '/api/generate');
      });
      
      const capturedError = Array.from(result.current.errors.values())[0];
      expect(capturedError.severity).toBe('medium');
      expect(capturedError.preventionSuggestion).toBe('Implement request throttling or increase rate limits');
    });

    it('should maintain max errors limit', () => {
      const { result } = renderHook(() => useErrorTrackingStore());
      
      // Set a lower limit for testing
      act(() => {
        useErrorTrackingStore.setState({
          settings: {
            ...result.current.settings,
            maxErrorsStored: 5,
          },
        });
      });
      
      act(() => {
        // Create 10 errors
        for (let i = 0; i < 10; i++) {
          result.current.captureError({
            category: 'runtime',
            source: 'react-component',
            severity: 'low',
            message: `Error ${i}`,
            resolved: i < 5, // First 5 are resolved
            context: {},
            impact: {
              userImpact: 'none',
              functionalityImpact: [],
            },
          });
        }
      });
      
      expect(result.current.errors.size).toBe(5);
    });

    it('should auto-resolve low severity errors', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useErrorTrackingStore());
      
      // Set auto-resolve timeout to 1 second for testing
      act(() => {
        useErrorTrackingStore.setState({
          settings: {
            ...result.current.settings,
            autoResolveTimeout: 1000,
          },
        });
      });
      
      let errorId: string;
      act(() => {
        errorId = result.current.captureError({
          category: 'ui',
          source: 'react-component',
          severity: 'low',
          message: 'Minor warning',
          resolved: false,
          context: {},
          impact: {
            userImpact: 'none',
            functionalityImpact: [],
          },
        });
      });
      
      expect(result.current.errors.get(errorId!)?.resolved).toBe(false);
      
      act(() => {
        vi.advanceTimersByTime(1001);
      });
      
      expect(result.current.errors.get(errorId!)?.resolved).toBe(true);
      expect(result.current.errors.get(errorId!)?.resolutionMethod).toBe('automatic');
      
      vi.useRealTimers();
    });
  });

  // Add more test suites here as needed for other functionality
});