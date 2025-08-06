import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { api } from '@/lib/api';
import type { Session } from '@/lib/api';
import type { ModelProvider } from '@/lib/models';
import type { GeminiRequest, GeminiResponse } from '@/lib/api-types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  provider?: ModelProvider;
  metadata?: {
    tokenCount?: number;
    processingTime?: number;
    error?: string;
  };
}

export interface UnifiedSession extends Session {
  messages: ChatMessage[];
  currentModel: string;
  provider: ModelProvider;
  isActive: boolean;
  lastActivity: Date;
  sharedBetweenModels: boolean;
  modelSwitchHistory: Array<{
    fromModel: string;
    toModel: string;
    timestamp: Date;
    messageIndex: number;
  }>;
}

interface UnifiedChatState {
  // Session management
  sessions: Record<string, UnifiedSession>;
  activeSessionId: string | null;
  
  // Message handling
  isProcessing: boolean;
  streamingMessage: string | null;
  
  // Model management
  currentModel: string;
  autoModelSelection: boolean;
  
  // UI state
  error: string | null;
  
  // Actions
  createSession: (projectId: string, initialModel: string) => Promise<UnifiedSession>;
  switchModel: (sessionId: string, newModel: string) => void;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  syncWithClaudeSession: (claudeSession: Session) => void;
  syncWithGeminiSession: (sessionId: string, messages: ChatMessage[]) => void;
  setActiveSession: (sessionId: string | null) => void;
  clearError: () => void;
  
  // Real-time updates
  handleStreamingUpdate: (chunk: string) => void;
  handleMessageComplete: (message: ChatMessage) => void;
}

const unifiedChatStore: StateCreator<
  UnifiedChatState,
  [],
  [['zustand/subscribeWithSelector', never]],
  UnifiedChatState
> = (set, get) => ({
  // Initial state
  sessions: {},
  activeSessionId: null,
  isProcessing: false,
  streamingMessage: null,
  currentModel: 'auto',
  autoModelSelection: true,
  error: null,
  
  // Create new unified session
  createSession: async (projectId: string, initialModel: string) => {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    
    const newSession: UnifiedSession = {
      id: sessionId,
      project_id: projectId,
      project_path: '', // Will be filled from project data
      created_at: now.getTime(),
      messages: [],
      currentModel: initialModel,
      provider: initialModel.startsWith('gemini') ? 'gemini' : 'claude',
      isActive: true,
      lastActivity: now,
      sharedBetweenModels: false,
      modelSwitchHistory: []
    };
    
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: newSession
      },
      activeSessionId: sessionId,
      currentModel: initialModel
    }));
    
    return newSession;
  },
  
  // Switch model within same session
  switchModel: (sessionId: string, newModel: string) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    
    if (!session) return;
    
    const newProvider: ModelProvider = newModel.startsWith('gemini') ? 'gemini' : 'claude';
    const messageIndex = session.messages.length;
    
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...session,
          currentModel: newModel,
          provider: newProvider,
          sharedBetweenModels: true,
          modelSwitchHistory: [
            ...session.modelSwitchHistory,
            {
              fromModel: session.currentModel,
              toModel: newModel,
              timestamp: new Date(),
              messageIndex
            }
          ]
        }
      },
      currentModel: newModel
    }));
  },
  
  // Send message handling both Claude and Gemini
  sendMessage: async (sessionId: string, content: string) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    set({ isProcessing: true, error: null, streamingMessage: '' });
    
    try {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
        model: session.currentModel,
        provider: session.provider
      };
      
      // Add user message
      set(state => ({
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            messages: [...session.messages, userMessage],
            lastActivity: new Date()
          }
        }
      }));
      
      if (session.provider === 'gemini') {
        // Handle Gemini API
        const request: GeminiRequest = {
          model: session.currentModel,
          prompt: content,
          systemInstruction: session.messages.find(m => m.role === 'system')?.content,
          temperature: 0.7,
          maxOutputTokens: 8192
        };
        
        const response = await api.sendGeminiMessage(request);
        
        if ('text' in response) {
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.text,
            timestamp: new Date(),
            model: session.currentModel,
            provider: 'gemini',
            metadata: {
              tokenCount: response.usageMetadata?.candidatesTokenCount,
              processingTime: Date.now() - userMessage.timestamp.getTime()
            }
          };
          
          get().handleMessageComplete(assistantMessage);
        }
      } else {
        // Handle Claude API through existing session
        // This would integrate with the existing Claude session handling
        // For now, we'll store the message and wait for Claude's response
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to send message',
        isProcessing: false,
        streamingMessage: null
      });
    }
  },
  
  // Sync with existing Claude session
  syncWithClaudeSession: (claudeSession: Session) => {
    const { sessions } = get();
    let unifiedSession = sessions[claudeSession.id];
    
    if (!unifiedSession) {
      // Create new unified session from Claude session
      unifiedSession = {
        ...claudeSession,
        messages: [],
        currentModel: 'sonnet', // Default Claude model
        provider: 'claude',
        isActive: true,
        lastActivity: new Date(),
        sharedBetweenModels: false,
        modelSwitchHistory: []
      };
    }
    
    set(state => ({
      sessions: {
        ...state.sessions,
        [claudeSession.id]: unifiedSession
      }
    }));
  },
  
  // Sync with Gemini messages
  syncWithGeminiSession: (sessionId: string, messages: ChatMessage[]) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    
    if (!session) return;
    
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...session,
          messages,
          lastActivity: new Date()
        }
      }
    }));
  },
  
  // Set active session
  setActiveSession: (sessionId: string | null) => {
    set({ activeSessionId: sessionId });
  },
  
  // Clear error
  clearError: () => set({ error: null }),
  
  // Handle streaming updates
  handleStreamingUpdate: (chunk: string) => {
    set(state => ({
      streamingMessage: (state.streamingMessage || '') + chunk
    }));
  },
  
  // Handle message completion
  handleMessageComplete: (message: ChatMessage) => {
    const { activeSessionId, sessions } = get();
    
    if (!activeSessionId) return;
    
    const session = sessions[activeSessionId];
    if (!session) return;
    
    set(state => ({
      sessions: {
        ...state.sessions,
        [activeSessionId]: {
          ...session,
          messages: [...session.messages, message],
          lastActivity: new Date()
        }
      },
      isProcessing: false,
      streamingMessage: null
    }));
  }
});

export const useUnifiedChatStore = create<UnifiedChatState>()(
  subscribeWithSelector(unifiedChatStore)
);