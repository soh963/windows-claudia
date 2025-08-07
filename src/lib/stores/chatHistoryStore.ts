/**
 * Chat History Store with Undo/Redo functionality
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface ChatHistoryState {
  // Current messages
  messages: Map<string, ChatMessage[]>;
  
  // History stack for undo
  historyStack: Map<string, ChatMessage[][]>;
  historyIndex: Map<string, number>;
  maxHistorySize: number;
  
  // Actions
  addMessage: (sessionId: string, message: ChatMessage) => void;
  removeMessage: (sessionId: string, messageId: string) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  clearSession: (sessionId: string) => void;
  
  // Undo/Redo actions
  undo: (sessionId: string) => boolean;
  redo: (sessionId: string) => boolean;
  canUndo: (sessionId: string) => boolean;
  canRedo: (sessionId: string) => boolean;
  
  // Utility
  getSessionMessages: (sessionId: string) => ChatMessage[];
  saveCheckpoint: (sessionId: string) => void;
}

export const useChatHistoryStore = create<ChatHistoryState>()(
  immer((set, get) => ({
    messages: new Map(),
    historyStack: new Map(),
    historyIndex: new Map(),
    maxHistorySize: 50, // Keep last 50 states
    
    addMessage: (sessionId: string, message: ChatMessage) => {
      set((state) => {
        // Get current messages
        const currentMessages = state.messages.get(sessionId) || [];
        const newMessages = [...currentMessages, message];
        
        // Save to history before modifying
        get().saveCheckpoint(sessionId);
        
        // Update messages
        state.messages.set(sessionId, newMessages);
      });
    },
    
    removeMessage: (sessionId: string, messageId: string) => {
      set((state) => {
        const messages = state.messages.get(sessionId);
        if (!messages) return;
        
        // Save to history before modifying
        get().saveCheckpoint(sessionId);
        
        // Remove message
        const filtered = messages.filter(m => m.id !== messageId);
        state.messages.set(sessionId, filtered);
      });
    },
    
    updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => {
      set((state) => {
        const messages = state.messages.get(sessionId);
        if (!messages) return;
        
        // Save to history before modifying
        get().saveCheckpoint(sessionId);
        
        // Update message
        const updated = messages.map(m => 
          m.id === messageId ? { ...m, ...updates } : m
        );
        state.messages.set(sessionId, updated);
      });
    },
    
    clearSession: (sessionId: string) => {
      set((state) => {
        // Save to history before clearing
        get().saveCheckpoint(sessionId);
        
        // Clear messages
        state.messages.set(sessionId, []);
      });
    },
    
    undo: (sessionId: string) => {
      const state = get();
      const history = state.historyStack.get(sessionId);
      const currentIndex = state.historyIndex.get(sessionId) ?? -1;
      
      if (!history || currentIndex <= 0) {
        return false; // Nothing to undo
      }
      
      set((draft) => {
        // Move back in history
        const newIndex = currentIndex - 1;
        draft.historyIndex.set(sessionId, newIndex);
        
        // Restore previous state
        const previousState = history[newIndex];
        draft.messages.set(sessionId, [...previousState]);
      });
      
      return true;
    },
    
    redo: (sessionId: string) => {
      const state = get();
      const history = state.historyStack.get(sessionId);
      const currentIndex = state.historyIndex.get(sessionId) ?? -1;
      
      if (!history || currentIndex >= history.length - 1) {
        return false; // Nothing to redo
      }
      
      set((draft) => {
        // Move forward in history
        const newIndex = currentIndex + 1;
        draft.historyIndex.set(sessionId, newIndex);
        
        // Restore next state
        const nextState = history[newIndex];
        draft.messages.set(sessionId, [...nextState]);
      });
      
      return true;
    },
    
    canUndo: (sessionId: string) => {
      const state = get();
      const history = state.historyStack.get(sessionId);
      const currentIndex = state.historyIndex.get(sessionId) ?? -1;
      
      return history !== undefined && currentIndex > 0;
    },
    
    canRedo: (sessionId: string) => {
      const state = get();
      const history = state.historyStack.get(sessionId);
      const currentIndex = state.historyIndex.get(sessionId) ?? -1;
      
      return history !== undefined && currentIndex < history.length - 1;
    },
    
    getSessionMessages: (sessionId: string) => {
      return get().messages.get(sessionId) || [];
    },
    
    saveCheckpoint: (sessionId: string) => {
      set((state) => {
        const currentMessages = state.messages.get(sessionId) || [];
        const history = state.historyStack.get(sessionId) || [];
        const currentIndex = state.historyIndex.get(sessionId) ?? -1;
        
        // Clone current messages
        const snapshot = currentMessages.map(m => ({ ...m }));
        
        // If we're not at the end of history, truncate forward history
        if (currentIndex < history.length - 1) {
          history.splice(currentIndex + 1);
        }
        
        // Add new snapshot
        history.push(snapshot);
        
        // Limit history size
        if (history.length > state.maxHistorySize) {
          history.shift();
        }
        
        // Update state
        state.historyStack.set(sessionId, history);
        state.historyIndex.set(sessionId, history.length - 1);
      });
    },
  }))
);

// Helper hooks
export const useSessionMessages = (sessionId: string) => {
  return useChatHistoryStore((state) => state.getSessionMessages(sessionId));
};

export const useChatUndo = (sessionId: string) => {
  const store = useChatHistoryStore();
  
  return {
    undo: () => store.undo(sessionId),
    redo: () => store.redo(sessionId),
    canUndo: store.canUndo(sessionId),
    canRedo: store.canRedo(sessionId),
  };
};

// Keyboard shortcut handler
export const setupUndoKeyboardShortcuts = (sessionId: string) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const store = useChatHistoryStore.getState();
    
    // Ctrl/Cmd + Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (store.canUndo(sessionId)) {
        store.undo(sessionId);
      }
    }
    
    // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
      e.preventDefault();
      if (store.canRedo(sessionId)) {
        store.redo(sessionId);
      }
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
};