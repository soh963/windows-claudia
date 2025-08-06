import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthMetricsService } from '@/lib/healthMetricsService';
import { api } from '@/lib/api';

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    dashboardGetSummary: vi.fn(),
    listDirectoryContents: vi.fn()
  }
}));

describe('HealthMetricsService', () => {
  let service: HealthMetricsService;
  const mockProjectId = 'test-project-123';
  const mockProjectPath = '/path/to/project';

  beforeEach(() => {
    service = HealthMetricsService.getInstance();
    service.clearAllCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = HealthMetricsService.getInstance();
      const instance2 = HealthMetricsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getEnhancedHealthMetrics', () => {
    it('should return enhanced metrics with all required fields', async () => {
      // Mock API responses
      (api.dashboardGetSummary as any).mockResolvedValue({
        health_metrics: [
          {
            project_id: mockProjectId,
            metric_type: 'security',
            value: 85,
            timestamp: Date.now(),
            details: 'Security analysis complete',
            trend: 'improving'
          }
        ]
      });

      (api.listDirectoryContents as any).mockResolvedValue([
        { name: 'file1.ts', is_directory: false },
        { name: 'file2.ts', is_directory: false },
        { name: 'src', is_directory: true }
      ]);

      const result = await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);

      expect(result).toHaveProperty('overall_health_score');
      expect(result).toHaveProperty('code_quality_score');
      expect(result).toHaveProperty('test_coverage_score');
      expect(result).toHaveProperty('performance_score');
      expect(result).toHaveProperty('security_score');
      expect(result).toHaveProperty('maintainability_score');
      expect(result).toHaveProperty('trend_direction');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('recommendations');

      expect(typeof result.overall_health_score).toBe('number');
      expect(result.overall_health_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_health_score).toBeLessThanOrEqual(100);
      
      expect(Array.isArray(result.metrics)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(['improving', 'stable', 'declining']).toContain(result.trend_direction);
    });

    it('should cache results for same project', async () => {
      (api.dashboardGetSummary as any).mockResolvedValue({ health_metrics: [] });
      (api.listDirectoryContents as any).mockResolvedValue([]);

      // First call
      await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);
      expect(api.dashboardGetSummary).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);
      expect(api.dashboardGetSummary).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      (api.dashboardGetSummary as any).mockRejectedValue(new Error('API Error'));

      const result = await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);
      
      // Should return default metrics when API fails
      expect(result).toBeDefined();
      expect(result.overall_health_score).toBe(75);
      expect(result.recommendations).toContain('Run project analysis to get detailed health metrics');
    });

    it('should calculate correct overall health score', async () => {
      (api.dashboardGetSummary as any).mockResolvedValue({ health_metrics: [] });
      (api.listDirectoryContents as any).mockResolvedValue([
        { name: 'file1.ts', is_directory: false }
      ]);

      const result = await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);
      
      // Overall score should be weighted average of component scores
      const expectedScore = Math.round(
        result.code_quality_score * 0.25 +
        result.test_coverage_score * 0.20 +
        result.performance_score * 0.20 +
        result.security_score * 0.20 +
        result.maintainability_score * 0.15
      );
      
      expect(result.overall_health_score).toBe(expectedScore);
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific project', async () => {
      (api.dashboardGetSummary as any).mockResolvedValue({ health_metrics: [] });
      (api.listDirectoryContents as any).mockResolvedValue([]);

      // First call
      await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);
      expect(api.dashboardGetSummary).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache(mockProjectId);

      // Next call should fetch fresh data
      await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);
      expect(api.dashboardGetSummary).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      (api.dashboardGetSummary as any).mockResolvedValue({ health_metrics: [] });
      (api.listDirectoryContents as any).mockResolvedValue([]);

      // Make calls for multiple projects
      await service.getEnhancedHealthMetrics('project1', '/path1');
      await service.getEnhancedHealthMetrics('project2', '/path2');
      expect(api.dashboardGetSummary).toHaveBeenCalledTimes(2);

      // Clear all cache
      service.clearAllCache();

      // Next calls should fetch fresh data
      await service.getEnhancedHealthMetrics('project1', '/path1');
      await service.getEnhancedHealthMetrics('project2', '/path2');
      expect(api.dashboardGetSummary).toHaveBeenCalledTimes(4);
    });
  });

  describe('recommendations generation', () => {
    it('should generate recommendations based on analysis', async () => {
      (api.dashboardGetSummary as any).mockResolvedValue({ health_metrics: [] });
      (api.listDirectoryContents as any).mockResolvedValue([
        { name: 'file1.ts', is_directory: false }
      ]);

      const result = await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);
      
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should contain actionable recommendations
      const hasActionableRecommendation = result.recommendations.some(rec => 
        rec.includes('test coverage') || 
        rec.includes('security') || 
        rec.includes('complexity') ||
        rec.includes('good')
      );
      expect(hasActionableRecommendation).toBe(true);
    });
  });

  describe('metric calculation', () => {
    it('should calculate metrics within valid ranges', async () => {
      (api.dashboardGetSummary as any).mockResolvedValue({ health_metrics: [] });
      (api.listDirectoryContents as any).mockResolvedValue([]);

      const result = await service.getEnhancedHealthMetrics(mockProjectId, mockProjectPath);
      
      // All scores should be between 0 and 100
      expect(result.overall_health_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_health_score).toBeLessThanOrEqual(100);
      expect(result.code_quality_score).toBeGreaterThanOrEqual(0);
      expect(result.code_quality_score).toBeLessThanOrEqual(100);
      expect(result.test_coverage_score).toBeGreaterThanOrEqual(0);
      expect(result.test_coverage_score).toBeLessThanOrEqual(100);
      expect(result.performance_score).toBeGreaterThanOrEqual(0);
      expect(result.performance_score).toBeLessThanOrEqual(100);
      expect(result.security_score).toBeGreaterThanOrEqual(0);
      expect(result.security_score).toBeLessThanOrEqual(100);
      expect(result.maintainability_score).toBeGreaterThanOrEqual(0);
      expect(result.maintainability_score).toBeLessThanOrEqual(100);
    });
  });
});