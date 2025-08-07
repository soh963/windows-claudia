import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Session } from '@/lib/api';

export interface SessionState {
  currentSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  selectedProject: string | null;
}

export interface SessionStore extends SessionState {
  // Actions
  setCurrentSession: (session: Session | null) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  removeSession: (sessionId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedProject: (projectPath: string | null) => void;
  
  // Getters
  getSessionById: (sessionId: string) => Session | undefined;
  getSessionsByProject: (projectPath: string) => Session[];
  getCurrentProjectSessions: () => Session[];
}

export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentSession: null,
    sessions: [],
    isLoading: false,
    error: null,
    selectedProject: null,
    
    // Actions
    setCurrentSession: (session) => {
      set({ currentSession: session });
    },
    
    setSessions: (sessions) => {
      set({ sessions });
    },
    
    addSession: (session) => {
      set((state) => ({
        sessions: [...state.sessions, session]
      }));
    },
    
    updateSession: (sessionId, updates) => {
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, ...updates } : session
        ),
        currentSession: state.currentSession?.id === sessionId
          ? { ...state.currentSession, ...updates }
          : state.currentSession
      }));
    },
    
    removeSession: (sessionId) => {
      set((state) => ({
        sessions: state.sessions.filter((session) => session.id !== sessionId),
        currentSession: state.currentSession?.id === sessionId
          ? null
          : state.currentSession
      }));
    },
    
    setLoading: (loading) => {
      set({ isLoading: loading });
    },
    
    setError: (error) => {
      set({ error });
    },
    
    setSelectedProject: (projectPath) => {
      set({ selectedProject: projectPath });
    },
    
    // Getters
    getSessionById: (sessionId) => {
      return get().sessions.find((session) => session.id === sessionId);
    },
    
    getSessionsByProject: (projectPath) => {
      return get().sessions.filter((session) => session.project_path === projectPath);
    },
    
    getCurrentProjectSessions: () => {
      const { selectedProject, sessions } = get();
      if (!selectedProject) return [];
      return sessions.filter((session) => session.project_path === selectedProject);
    }
  }))
);

// Create store instance for direct access in non-React contexts
export const sessionStore = useSessionStore.getState();