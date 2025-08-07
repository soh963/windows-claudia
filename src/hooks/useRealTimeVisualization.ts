import { useEffect, useRef, useCallback } from 'react';
import { useVisualizationStore } from '@/lib/stores/visualizationStore';
import { useMonitoringStore } from '@/lib/stores/monitoringStore';

export interface RealTimeVisualizationConfig {
  enabled?: boolean;
  updateInterval?: number;
  onUpdate?: (data: any) => void;
  onError?: (error: Error) => void;
}

export const useRealTimeVisualization = (config: RealTimeVisualizationConfig = {}) => {
  const {
    enabled = true,
    updateInterval = 5000,
    onUpdate,
    onError,
  } = config;

  const {
    visualizationData,
    settings,
    updateVisualizationData,
    startRealTimeUpdates,
    stopRealTimeUpdates,
    lastUpdated,
    isLoading,
    error,
  } = useVisualizationStore();

  const monitoringStore = useMonitoringStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);
  const lastOperationCount = useRef(0);

  // Initialize real-time updates
  const initialize = useCallback(async () => {
    if (!enabled || isInitialized.current) return;

    try {
      await updateVisualizationData();
      if (settings.enableRealTimeUpdates) {
        startRealTimeUpdates();
      }
      isInitialized.current = true;
    } catch (err) {
      console.error('Failed to initialize visualization:', err);
      onError?.(err instanceof Error ? err : new Error('Initialization failed'));
    }
  }, [enabled, updateVisualizationData, startRealTimeUpdates, settings.enableRealTimeUpdates, onError]);

  // Manual refresh
  const refresh = useCallback(async () => {
    try {
      await updateVisualizationData();
      onUpdate?.(visualizationData);
    } catch (err) {
      console.error('Failed to refresh visualization:', err);
      onError?.(err instanceof Error ? err : new Error('Refresh failed'));
    }
  }, [updateVisualizationData, visualizationData, onUpdate, onError]);

  // Monitor for operation changes
  const checkForUpdates = useCallback(() => {
    const currentOperationCount = monitoringStore.operations.size;
    
    if (currentOperationCount !== lastOperationCount.current) {
      lastOperationCount.current = currentOperationCount;
      refresh();
    }
  }, [monitoringStore.operations.size, refresh]);

  // Set up monitoring for operation changes
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = useMonitoringStore.subscribe(
      (state) => state.operations,
      (operations) => {
        // Trigger update when operations change
        if (operations.size !== lastOperationCount.current) {
          lastOperationCount.current = operations.size;
          updateVisualizationData();
        }
      }
    );

    return unsubscribe;
  }, [enabled, updateVisualizationData]);

  // Set up periodic updates
  useEffect(() => {
    if (!enabled) return;

    // Initial setup
    initialize();

    // Set up periodic updates
    intervalRef.current = setInterval(checkForUpdates, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      stopRealTimeUpdates();
      isInitialized.current = false;
    };
  }, [enabled, updateInterval, initialize, checkForUpdates, stopRealTimeUpdates]);

  // Handle settings changes
  useEffect(() => {
    if (settings.enableRealTimeUpdates && enabled) {
      startRealTimeUpdates();
    } else {
      stopRealTimeUpdates();
    }
  }, [settings.enableRealTimeUpdates, enabled, startRealTimeUpdates, stopRealTimeUpdates]);

  return {
    data: visualizationData,
    isLoading,
    error,
    lastUpdated,
    refresh,
    initialize,
    isRealTimeEnabled: settings.enableRealTimeUpdates && enabled,
  };
};

export default useRealTimeVisualization;