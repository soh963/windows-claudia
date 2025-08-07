import { useEffect } from 'react';
import { useUIStore } from '@/lib/stores/uiStore';
import { useMonitoringStore } from '@/stores/monitoringStore';

/**
 * Hook to synchronize panel states between monitoring store and UI store
 * This ensures backward compatibility while preventing duplicates
 */
export function usePanelSync() {
  const uiStore = useUIStore();
  const monitoringStore = useMonitoringStore();
  
  useEffect(() => {
    // Subscribe to monitoring store changes and sync to UI store
    const unsubscribe = useMonitoringStore.subscribe(
      (state) => state.isProgressTrackerVisible,
      (isVisible) => {
        const uiVisible = useUIStore.getState().isProgressTrackerVisible;
        
        // Only sync if states differ
        if (isVisible !== uiVisible) {
          if (isVisible) {
            useUIStore.getState().showProgressTracker('monitoringStore-sync');
          } else {
            useUIStore.getState().hideProgressTracker();
          }
        }
      }
    );
    
    return unsubscribe;
  }, []);
  
  useEffect(() => {
    // Subscribe to UI store changes and sync to monitoring store  
    const unsubscribe = useUIStore.subscribe(
      (state) => state.isProgressTrackerVisible,
      (isVisible) => {
        const monitoringVisible = useMonitoringStore.getState().isProgressTrackerVisible;
        
        // Only sync if states differ
        if (isVisible !== monitoringVisible) {
          // Update monitoring store state directly without triggering toggle
          useMonitoringStore.setState({ isProgressTrackerVisible: isVisible });
        }
      }
    );
    
    return unsubscribe;
  }, []);
  
  return {
    isProgressTrackerVisible: uiStore.isProgressTrackerVisible,
    isTaskTimelineVisible: uiStore.isTaskTimelineVisible,
    toggleProgressTracker: () => uiStore.toggleProgressTracker('usePanelSync'),
    toggleTaskTimeline: () => uiStore.toggleTaskTimeline('usePanelSync'),
  };
}