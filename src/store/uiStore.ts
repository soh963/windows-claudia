import { create } from 'zustand';

interface UIState {
  darkMode: boolean;
  showLeftPanel: boolean;
  showRightPanel: boolean;
  showSettingsModal: boolean;
  toggleDarkMode: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleSettingsModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  darkMode: false,
  showLeftPanel: true,
  showRightPanel: true,
  showSettingsModal: false,
  
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  toggleLeftPanel: () => set((state) => ({ showLeftPanel: !state.showLeftPanel })),
  toggleRightPanel: () => set((state) => ({ showRightPanel: !state.showRightPanel })),
  toggleSettingsModal: () => set((state) => ({ showSettingsModal: !state.showSettingsModal })),
}));