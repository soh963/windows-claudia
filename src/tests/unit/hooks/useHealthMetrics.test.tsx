import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useHealthMetrics } from '@/hooks/useHealthMetrics';
import { RealTimeMetricsCollector } from '@/lib/realTimeMetricsCollector';
import { HealthMetricsService } from '@/lib/healthMetricsService';

// Mock dependencies
vi.mock('@/lib/realTimeMetricsCollector');
vi.mock('@/lib/healthMetricsService');

const mockCollector = {
  startCollection: vi.fn(),
  stopCollection: vi.fn(),
  addCallback: vi.fn(),
  removeCallback: vi.fn(),
  updateConfig: vi.fn(),
  getStatus: vi.fn(),
  triggerCollection: vi.fn()
};

const mockHealthService = {
  getEnhancedHealthMetrics: vi.fn(),
  clearCache: vi.fn()
};

const mockMetrics = {
  overall_health_score: 85,
  code_quality_score: 80,
  test_coverage_score: 75,
  performance_score: 90,
  security_score: 95,
  maintainability_score: 80,
  trend_direction: 'improving' as const,
  metrics: [],
  recommendations: ['Keep up the good work!']
};

describe('useHealthMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (RealTimeMetricsCollector.getInstance as any).mockReturnValue(mockCollector);
    (HealthMetricsService.getInstance as any).mockReturnValue(mockHealthService);
    
    mockHealthService.getEnhancedHealthMetrics.mockResolvedValue(mockMetrics);
    mockCollector.getStatus.mockReturnValue({
      isRunning: false,
      lastCollection: null,
      nextCollection: null,
      errorCount: 0,
      lastError: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.metrics).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should start collection on mount', () => {
      renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      expect(mockCollector.startCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          projectPath: '/test/path'
        }),
        expect.any(Function)
      );
    });

    it('should load initial metrics', async () => {
      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.metrics).toEqual(mockMetrics);
      expect(mockHealthService.getEnhancedHealthMetrics).toHaveBeenCalledWith(
        'test-project',
        '/test/path'
      );
    });
  });

  describe('auto-update functionality', () => {
    it('should enable auto-update when specified', () => {
      renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path',
          autoUpdate: true
        })
      );

      expect(mockCollector.startCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          autoUpdate: true
        }),
        expect.any(Function)
      );
    });

    it('should start auto-update programmatically', () => {
      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      result.current.startAutoUpdate();

      expect(mockCollector.updateConfig).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          autoUpdate: true
        })
      );
    });

    it('should stop auto-update programmatically', () => {
      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path',
          autoUpdate: true
        })
      );

      result.current.stopAutoUpdate();

      expect(mockCollector.updateConfig).toHaveBeenCalledWith(
        'test-project',
        expect.objectContaining({
          autoUpdate: false
        })
      );
    });
  });

  describe('refresh functionality', () => {
    it('should refresh metrics manually', async () => {
      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      await result.current.refresh();

      expect(mockHealthService.clearCache).toHaveBeenCalledWith('test-project');
      expect(mockCollector.triggerCollection).toHaveBeenCalledWith('test-project');
    });

    it('should handle refresh errors', async () => {
      mockCollector.triggerCollection.mockRejectedValue(new Error('Refresh failed'));

      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      await result.current.refresh();

      expect(result.current.error).toBe('Refresh failed');
    });
  });

  describe('configuration options', () => {
    it('should apply custom update interval', () => {
      const customInterval = 10000; // 10 seconds

      renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path',
          updateInterval: customInterval
        })
      );

      expect(mockCollector.startCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          intervalMs: customInterval
        }),
        expect.any(Function)
      );
    });

    it('should apply custom enabled metrics', () => {
      const enabledMetrics = ['security', 'performance'];

      renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path',
          enabledMetrics
        })
      );

      expect(mockCollector.startCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          enabledMetrics
        }),
        expect.any(Function)
      );
    });

    it('should apply preset configuration', () => {
      renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path',
          preset: 'development'
        })
      );

      // Should merge preset configuration
      expect(mockCollector.startCollection).toHaveBeenCalled();
    });
  });

  describe('status tracking', () => {
    it('should track collection status', async () => {
      const mockStatus = {
        isRunning: true,
        lastCollection: Date.now(),
        nextCollection: Date.now() + 5000,
        errorCount: 0,
        lastError: null
      };

      mockCollector.getStatus.mockReturnValue(mockStatus);

      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      await waitFor(() => {
        expect(result.current.status).toEqual(mockStatus);
      });
    });
  });

  describe('error handling', () => {
    it('should handle initial load errors', async () => {
      mockHealthService.getEnhancedHealthMetrics.mockRejectedValue(
        new Error('Failed to load metrics')
      );

      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load metrics');
      expect(result.current.metrics).toBe(null);
    });

    it('should clear errors on successful refresh', async () => {
      // First, simulate an error
      mockHealthService.getEnhancedHealthMetrics
        .mockRejectedValueOnce(new Error('Initial error'))
        .mockResolvedValue(mockMetrics);

      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      // Now refresh successfully
      await result.current.refresh();

      expect(result.current.error).toBe(null);
      expect(result.current.metrics).toEqual(mockMetrics);
    });
  });

  describe('cleanup', () => {
    it('should stop collection on unmount', () => {
      const { unmount } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      unmount();

      expect(mockCollector.stopCollection).toHaveBeenCalledWith('test-project');
    });
  });

  describe('edge cases', () => {
    it('should handle empty project ID', () => {
      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: '',
          projectPath: '/test/path'
        })
      );

      expect(mockCollector.startCollection).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(true);
    });

    it('should handle empty project path', () => {
      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: ''
        })
      );

      expect(mockCollector.startCollection).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(true);
    });

    it('should handle callback updates from collector', async () => {
      let capturedCallback: Function | null = null;

      mockCollector.startCollection.mockImplementation((config, callback) => {
        capturedCallback = callback;
      });

      const { result } = renderHook(() =>
        useHealthMetrics({
          projectId: 'test-project',
          projectPath: '/test/path'
        })
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate callback from collector
      const updatedMetrics = { ...mockMetrics, overall_health_score: 95 };
      if (capturedCallback) {
        capturedCallback(updatedMetrics);
      }

      expect(result.current.metrics?.overall_health_score).toBe(95);
    });
  });
});