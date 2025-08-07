import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Global UI Store
 * Centralized management for UI panel states to prevent duplicates
 */

interface PanelInstance {
  id: string;
  type: 'progress-tracker' | 'task-timeline' | 'other';
  location: string; // Component that created it
  timestamp: number;
}

interface UIState {
  // Panel visibility states - single source of truth
  isProgressTrackerVisible: boolean;
  isTaskTimelineVisible: boolean;
  
  // Panel instance tracking for duplicate prevention
  activePanels: Map<string, PanelInstance>;
  
  // Actions
  showProgressTracker: (location?: string) => boolean;
  hideProgressTracker: () => void;
  toggleProgressTracker: (location?: string) => boolean;
  
  showTaskTimeline: (location?: string) => boolean;
  hideTaskTimeline: () => void;
  toggleTaskTimeline: (location?: string) => boolean;
  
  // Utility
  isAnyPanelOpen: () => boolean;
  getPanelInfo: (type: 'progress-tracker' | 'task-timeline') => PanelInstance | undefined;
  clearAllPanels: () => void;
}

export const useUIStore = create<UIState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isProgressTrackerVisible: false,
    isTaskTimelineVisible: false,
    activePanels: new Map(),
    
    // Progress Tracker actions
    showProgressTracker: (location = 'unknown') => {
      const state = get();
      
      // Prevent duplicate
      if (state.isProgressTrackerVisible) {
        console.warn('[UIStore] Progress Tracker already visible, preventing duplicate');
        return false;
      }
      
      const panelId = `progress-tracker-${Date.now()}`;
      const panel: PanelInstance = {
        id: panelId,
        type: 'progress-tracker',
        location,
        timestamp: Date.now(),
      };
      
      set((state) => {
        const newPanels = new Map(state.activePanels);
        newPanels.set(panelId, panel);
        
        return {
          isProgressTrackerVisible: true,
          activePanels: newPanels,
        };
      });
      
      console.log(`[UIStore] Progress Tracker shown from ${location}`);
      return true;
    },
    
    hideProgressTracker: () => {
      set((state) => {
        const newPanels = new Map(state.activePanels);
        
        // Remove progress tracker panels
        for (const [id, panel] of newPanels.entries()) {
          if (panel.type === 'progress-tracker') {
            newPanels.delete(id);
          }
        }
        
        return {
          isProgressTrackerVisible: false,
          activePanels: newPanels,
        };
      });
      
      console.log('[UIStore] Progress Tracker hidden');
    },
    
    toggleProgressTracker: (location = 'unknown') => {
      const state = get();
      
      if (state.isProgressTrackerVisible) {
        get().hideProgressTracker();
        return false;
      } else {
        return get().showProgressTracker(location);
      }
    },
    
    // Task Timeline actions
    showTaskTimeline: (location = 'unknown') => {
      const state = get();
      
      // Prevent duplicate
      if (state.isTaskTimelineVisible) {
        console.warn('[UIStore] Task Timeline already visible, preventing duplicate');
        return false;
      }
      
      const panelId = `task-timeline-${Date.now()}`;
      const panel: PanelInstance = {
        id: panelId,
        type: 'task-timeline',
        location,
        timestamp: Date.now(),
      };
      
      set((state) => {
        const newPanels = new Map(state.activePanels);
        newPanels.set(panelId, panel);
        
        return {
          isTaskTimelineVisible: true,
          activePanels: newPanels,
        };
      });
      
      console.log(`[UIStore] Task Timeline shown from ${location}`);
      return true;
    },
    
    hideTaskTimeline: () => {
      set((state) => {
        const newPanels = new Map(state.activePanels);
        
        // Remove task timeline panels
        for (const [id, panel] of newPanels.entries()) {
          if (panel.type === 'task-timeline') {
            newPanels.delete(id);
          }
        }
        
        return {
          isTaskTimelineVisible: false,
          activePanels: newPanels,
        };
      });
      
      console.log('[UIStore] Task Timeline hidden');
    },
    
    toggleTaskTimeline: (location = 'unknown') => {
      const state = get();
      
      if (state.isTaskTimelineVisible) {
        get().hideTaskTimeline();
        return false;
      } else {
        return get().showTaskTimeline(location);
      }
    },
    
    // Utility functions
    isAnyPanelOpen: () => {
      const state = get();
      return state.isProgressTrackerVisible || state.isTaskTimelineVisible;
    },
    
    getPanelInfo: (type) => {
      const state = get();
      
      for (const panel of state.activePanels.values()) {
        if (panel.type === type) {
          return panel;
        }
      }
      
      return undefined;
    },
    
    clearAllPanels: () => {
      set({
        isProgressTrackerVisible: false,
        isTaskTimelineVisible: false,
        activePanels: new Map(),
      });
      
      console.log('[UIStore] All panels cleared');
    },
  }))
);

// Hook for monitoring panel state changes
export function usePanelStateMonitor() {
  const store = useUIStore();
  
  // Subscribe to changes
  useUIStore.subscribe(
    (state) => ({
      progressTracker: state.isProgressTrackerVisible,
      taskTimeline: state.isTaskTimelineVisible,
      panelCount: state.activePanels.size,
    }),
    (current, previous) => {
      if (current.panelCount > previous.panelCount) {
        console.log('[UIStore Monitor] Panel opened, total:', current.panelCount);
      } else if (current.panelCount < previous.panelCount) {
        console.log('[UIStore Monitor] Panel closed, total:', current.panelCount);
      }
    }
  );
  
  return store;
}