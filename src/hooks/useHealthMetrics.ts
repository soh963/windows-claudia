import { useState, useEffect, useCallback, useRef } from 'react';
import { RealTimeMetricsCollector, type MetricsCollectionConfig, type CollectionStatus } from '@/lib/realTimeMetricsCollector';
import { HealthMetricsService, type EnhancedHealthMetrics } from '@/lib/healthMetricsService';

export interface UseHealthMetricsOptions {
  projectId: string;
  projectPath: string;
  autoUpdate?: boolean;
  updateInterval?: number; // in milliseconds
  enabledMetrics?: string[];
  preset?: 'development' | 'production' | 'quality-focused' | 'minimal';
}

export interface UseHealthMetricsReturn {
  metrics: EnhancedHealthMetrics | null;
  loading: boolean;
  error: string | null;
  status: CollectionStatus | null;
  refresh: () => Promise<void>;
  startAutoUpdate: () => void;
  stopAutoUpdate: () => void;
  isAutoUpdating: boolean;
}

export function useHealthMetrics(options: UseHealthMetricsOptions): UseHealthMetricsReturn {
  const {
    projectId,
    projectPath,
    autoUpdate = false,
    updateInterval = 5 * 60 * 1000, // 5 minutes default
    enabledMetrics = ['code_quality', 'test_coverage', 'performance', 'security', 'maintainability'],
    preset
  } = options;

  const [metrics, setMetrics] = useState<EnhancedHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CollectionStatus | null>(null);
  const [isAutoUpdating, setIsAutoUpdating] = useState(autoUpdate);

  const collector = useRef(RealTimeMetricsCollector.getInstance());
  const healthService = useRef(HealthMetricsService.getInstance());
  const callbackRef = useRef<((metrics: EnhancedHealthMetrics) => void) | null>(null);

  // Create metrics update callback
  const handleMetricsUpdate = useCallback((newMetrics: EnhancedHealthMetrics) => {
    setMetrics(newMetrics);
    setLoading(false);
    setError(null);
  }, []);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = handleMetricsUpdate;
  }, [handleMetricsUpdate]);

  // Create collection configuration
  const createConfig = useCallback((): MetricsCollectionConfig => {
    let config = RealTimeMetricsCollector.createDefaultConfig(projectId, projectPath);
    
    // Apply preset if specified
    if (preset) {
      const presets = RealTimeMetricsCollector.getPresets();
      config = { ...config, ...presets[preset] };
    }

    // Apply custom options
    return {
      ...config,
      intervalMs: updateInterval,
      enabledMetrics,
      autoUpdate: isAutoUpdating
    };
  }, [projectId, projectPath, updateInterval, enabledMetrics, isAutoUpdating, preset]);

  // Initialize metrics collection
  useEffect(() => {
    if (!projectId || !projectPath) return;

    const config = createConfig();
    
    // Setup callback wrapper that calls the current callback
    const callbackWrapper = (newMetrics: EnhancedHealthMetrics) => {
      callbackRef.current?.(newMetrics);
    };

    collector.current.startCollection(config, callbackWrapper);

    // Initial load
    loadInitialMetrics();

    return () => {
      collector.current.stopCollection(projectId);
    };
  }, [projectId, projectPath, createConfig]);

  // Load initial metrics
  const loadInitialMetrics = async () => {
    if (!projectId || !projectPath) return;

    setLoading(true);
    setError(null);

    try {
      const initialMetrics = await healthService.current.getEnhancedHealthMetrics(projectId, projectPath);
      setMetrics(initialMetrics);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load health metrics';
      setError(errorMessage);
      console.error('Failed to load initial health metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update status periodically
  useEffect(() => {
    if (!projectId) return;

    const updateStatus = () => {
      const currentStatus = collector.current.getStatus(projectId);
      setStatus(currentStatus);
    };

    updateStatus();
    const statusInterval = setInterval(updateStatus, 1000); // Update every second

    return () => clearInterval(statusInterval);
  }, [projectId]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (!projectId || !projectPath) return;

    setLoading(true);
    setError(null);

    try {
      // Clear cache and trigger collection
      healthService.current.clearCache(projectId);
      await collector.current.triggerCollection(projectId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh metrics';
      setError(errorMessage);
      console.error('Failed to refresh metrics:', err);
      setLoading(false);
    }
  }, [projectId, projectPath]);

  // Start auto-update
  const startAutoUpdate = useCallback(() => {
    setIsAutoUpdating(true);
    const config = createConfig();
    config.autoUpdate = true;
    collector.current.updateConfig(projectId, config);
  }, [projectId, createConfig]);

  // Stop auto-update
  const stopAutoUpdate = useCallback(() => {
    setIsAutoUpdating(false);
    const config = createConfig();
    config.autoUpdate = false;
    collector.current.updateConfig(projectId, config);
  }, [projectId, createConfig]);

  // Update auto-updating state when autoUpdate option changes
  useEffect(() => {
    if (autoUpdate !== isAutoUpdating) {
      if (autoUpdate) {
        startAutoUpdate();
      } else {
        stopAutoUpdate();
      }
    }
  }, [autoUpdate, isAutoUpdating, startAutoUpdate, stopAutoUpdate]);

  return {
    metrics,
    loading,
    error,
    status,
    refresh,
    startAutoUpdate,
    stopAutoUpdate,
    isAutoUpdating
  };
}

export default useHealthMetrics;