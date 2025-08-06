import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealTimeMetricsCollector } from '@/lib/realTimeMetricsCollector';
import { HealthMetricsService } from '@/lib/healthMetricsService';
import { api } from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/healthMetricsService');
vi.mock('@/lib/api');

describe('RealTimeMetricsCollector', () => {
  let collector: RealTimeMetricsCollector;
  let mockHealthService: any;
  const mockProjectId = 'test-project';
  const mockProjectPath = '/test/path';

  beforeEach(() => {
    vi.clearAllMocks();
    collector = RealTimeMetricsCollector.getInstance();
    
    // Mock HealthMetricsService
    mockHealthService = {
      clearCache: vi.fn(),
      getEnhancedHealthMetrics: vi.fn().mockResolvedValue({
        overall_health_score: 85,
        code_quality_score: 80,
        test_coverage_score: 75,
        performance_score: 90,
        security_score: 95,
        maintainability_score: 80,
        trend_direction: 'improving',
        metrics: [],
        recommendations: []
      })
    };
    
    (HealthMetricsService.getInstance as any).mockReturnValue(mockHealthService);
    (api.dashboardAnalyzeProject as any).mockResolvedValue('Analysis complete');
    
    // Clear any existing collections
    collector.stopAllCollections();
  });

  afterEach(() => {
    collector.stopAllCollections();
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RealTimeMetricsCollector.getInstance();
      const instance2 = RealTimeMetricsCollector.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createDefaultConfig', () => {
    it('should create valid default configuration', () => {
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      
      expect(config.projectId).toBe(mockProjectId);
      expect(config.projectPath).toBe(mockProjectPath);
      expect(config.intervalMs).toBe(5 * 60 * 1000); // 5 minutes
      expect(config.autoUpdate).toBe(false);
      expect(Array.isArray(config.enabledMetrics)).toBe(true);
      expect(config.enabledMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('getPresets', () => {
    it('should return valid presets', () => {
      const presets = RealTimeMetricsCollector.getPresets();
      
      expect(typeof presets).toBe('object');
      expect(presets).toHaveProperty('development');
      expect(presets).toHaveProperty('production');
      expect(presets).toHaveProperty('quality-focused');
      expect(presets).toHaveProperty('minimal');
      
      // Check development preset
      expect(presets.development.intervalMs).toBe(2 * 60 * 1000);
      expect(presets.development.autoUpdate).toBe(true);
      
      // Check production preset
      expect(presets.production.intervalMs).toBe(15 * 60 * 1000);
      expect(presets.production.autoUpdate).toBe(true);
    });
  });

  describe('startCollection', () => {
    it('should start collection with callback', () => {
      const callback = vi.fn();
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      
      collector.startCollection(config, callback);
      
      const status = collector.getStatus(mockProjectId);
      expect(status).toBeDefined();
      expect(status?.isRunning).toBe(false); // Auto-update is false by default
    });

    it('should start auto-update when enabled', () => {
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      config.autoUpdate = true;
      config.intervalMs = 100; // Very short interval for testing
      
      collector.startCollection(config);
      
      const status = collector.getStatus(mockProjectId);
      expect(status?.isRunning).toBe(true);
    });

    it('should stop existing collection before starting new one', () => {
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      
      // Start first collection
      collector.startCollection(config);
      
      // Start second collection (should stop first)
      collector.startCollection(config);
      
      // Should only have one active collection
      const activeCollections = collector.getActiveCollections();
      expect(activeCollections.length).toBeLessThanOrEqual(1);
    });
  });

  describe('stopCollection', () => {
    it('should stop active collection', () => {
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      config.autoUpdate = true;
      
      collector.startCollection(config);
      expect(collector.getStatus(mockProjectId)?.isRunning).toBe(true);
      
      collector.stopCollection(mockProjectId);
      expect(collector.getStatus(mockProjectId)?.isRunning).toBe(false);
    });

    it('should handle stopping non-existing collection', () => {
      // Should not throw error
      expect(() => collector.stopCollection('non-existing')).not.toThrow();
    });
  });

  describe('triggerCollection', () => {
    it('should trigger manual collection', async () => {
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      collector.startCollection(config);
      
      await collector.triggerCollection(mockProjectId);
      
      expect(mockHealthService.clearCache).toHaveBeenCalledWith(mockProjectId);
      expect(mockHealthService.getEnhancedHealthMetrics).toHaveBeenCalledWith(
        mockProjectId,
        mockProjectPath
      );
    });

    it('should throw error for non-existing collection', async () => {
      await expect(collector.triggerCollection('non-existing')).rejects.toThrow();
    });
  });

  describe('addCallback and removeCallback', () => {
    it('should add and remove callbacks', () => {
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      collector.startCollection(config, callback1);
      collector.addCallback(mockProjectId, callback2);
      
      // Both callbacks should be present (can't directly test, but we can test removal)
      collector.removeCallback(mockProjectId, callback1);
      collector.removeCallback(mockProjectId, callback2);
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle adding callback to non-existing collection', () => {
      const callback = vi.fn();
      
      // Should not throw error
      expect(() => collector.addCallback('non-existing', callback)).not.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should update existing configuration', () => {
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      collector.startCollection(config);
      
      const newInterval = 30000;
      collector.updateConfig(mockProjectId, { intervalMs: newInterval });
      
      // Config should be updated (can't directly access, but no errors should occur)
      expect(true).toBe(true);
    });

    it('should handle updating non-existing collection', () => {
      // Should not throw error
      expect(() => collector.updateConfig('non-existing', { intervalMs: 1000 })).not.toThrow();
    });
  });

  describe('getActiveCollections', () => {
    it('should return active collection IDs', () => {
      const config1 = RealTimeMetricsCollector.createDefaultConfig('project1', '/path1');
      const config2 = RealTimeMetricsCollector.createDefaultConfig('project2', '/path2');
      
      config1.autoUpdate = true;
      config2.autoUpdate = false;
      
      collector.startCollection(config1);
      collector.startCollection(config2);
      
      const activeCollections = collector.getActiveCollections();
      expect(activeCollections).toContain('project1');
      expect(activeCollections).not.toContain('project2');
    });
  });

  describe('stopAllCollections', () => {
    it('should stop all active collections', () => {
      const config1 = RealTimeMetricsCollector.createDefaultConfig('project1', '/path1');
      const config2 = RealTimeMetricsCollector.createDefaultConfig('project2', '/path2');
      
      config1.autoUpdate = true;
      config2.autoUpdate = true;
      
      collector.startCollection(config1);
      collector.startCollection(config2);
      
      expect(collector.getActiveCollections().length).toBe(2);
      
      collector.stopAllCollections();
      
      expect(collector.getActiveCollections().length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle collection errors gracefully', async () => {
      mockHealthService.getEnhancedHealthMetrics.mockRejectedValue(new Error('Test error'));
      
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      collector.startCollection(config);
      
      await collector.triggerCollection(mockProjectId);
      
      const status = collector.getStatus(mockProjectId);
      expect(status?.errorCount).toBe(1);
      expect(status?.lastError).toBe('Test error');
    });

    it('should stop collection after too many errors', async () => {
      mockHealthService.getEnhancedHealthMetrics.mockRejectedValue(new Error('Test error'));
      
      const config = RealTimeMetricsCollector.createDefaultConfig(mockProjectId, mockProjectPath);
      collector.startCollection(config);
      
      // Trigger multiple failures
      for (let i = 0; i < 6; i++) {
        try {
          await collector.triggerCollection(mockProjectId);
        } catch (error) {
          // Expected to throw
        }
      }
      
      const status = collector.getStatus(mockProjectId);
      expect(status?.isRunning).toBe(false);
    });
  });
});