import { useState, useEffect, useCallback } from 'react';
import { 
  IntelligenceBridgeAPI, 
  UniversalContext, 
  InjectionConfig,
  InjectionResult,
  WorkContext,
  CodeChange,
  Decision,
  PlannedTask,
  HandoffNote,
  Checkpoint
} from '@/lib/intelligenceBridge';
import { useSessionStore } from '@/lib/stores/sessionStore';

/**
 * Hook for managing cross-model intelligence sharing
 */
export function useIntelligenceBridge() {
  const [context, setContext] = useState<UniversalContext | null>(null);
  const [config, setConfig] = useState<InjectionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collaborationHistory, setCollaborationHistory] = useState<any[]>([]);
  
  const { currentSession } = useSessionStore();

  // Initialize intelligence tables on mount
  useEffect(() => {
    IntelligenceBridgeAPI.initTables().catch(err => {
      console.error('Failed to initialize intelligence tables:', err);
    });
  }, []);

  // Load context when session changes
  useEffect(() => {
    if (currentSession?.id) {
      loadContext(currentSession.id);
    }
  }, [currentSession?.id]);

  /**
   * Load context for a session
   */
  const loadContext = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedContext = await IntelligenceBridgeAPI.loadContext(sessionId);
      setContext(loadedContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load context');
      console.error('Failed to load context:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save current context
   */
  const saveContext = useCallback(async () => {
    if (!context) return;
    
    setIsLoading(true);
    setError(null);
    try {
      await IntelligenceBridgeAPI.storeContext(context);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save context');
      console.error('Failed to save context:', err);
    } finally {
      setIsLoading(false);
    }
  }, [context]);

  /**
   * Transfer context to another model
   */
  const transferToModel = useCallback(async (
    toSession: string,
    toModel: string
  ): Promise<UniversalContext | null> => {
    if (!currentSession?.id) return null;
    
    setIsLoading(true);
    setError(null);
    try {
      const transferredContext = await IntelligenceBridgeAPI.transferContext(
        currentSession.id,
        toSession,
        toModel
      );
      return transferredContext;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer context');
      console.error('Failed to transfer context:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentSession?.id]);

  /**
   * Update work progress
   */
  const updateWorkProgress = useCallback((
    task?: string,
    state?: string,
    progress?: number
  ) => {
    if (!context) return;
    
    setContext(prev => {
      if (!prev) return null;
      return {
        ...prev,
        current_work: {
          ...prev.current_work,
          current_task: task ?? prev.current_work.current_task,
          work_state: state ?? prev.current_work.work_state,
          progress: progress ?? prev.current_work.progress
        },
        updated_at: new Date().toISOString()
      };
    });
  }, [context]);

  /**
   * Add a code change
   */
  const addCodeChange = useCallback((change: CodeChange) => {
    if (!context) return;
    
    setContext(prev => {
      if (!prev) return null;
      return {
        ...prev,
        current_work: {
          ...prev.current_work,
          code_changes: [...prev.current_work.code_changes, change]
        },
        updated_at: new Date().toISOString()
      };
    });
  }, [context]);

  /**
   * Add a decision
   */
  const addDecision = useCallback((decision: Decision) => {
    if (!context) return;
    
    setContext(prev => {
      if (!prev) return null;
      return {
        ...prev,
        current_work: {
          ...prev.current_work,
          decisions: [...prev.current_work.decisions, decision]
        },
        updated_at: new Date().toISOString()
      };
    });
  }, [context]);

  /**
   * Add a planned task
   */
  const addPlannedTask = useCallback((task: PlannedTask) => {
    if (!context) return;
    
    setContext(prev => {
      if (!prev) return null;
      return {
        ...prev,
        future_plans: {
          ...prev.future_plans,
          tasks: [...prev.future_plans.tasks, task]
        },
        updated_at: new Date().toISOString()
      };
    });
  }, [context]);

  /**
   * Add a handoff note
   */
  const addHandoffNote = useCallback((note: HandoffNote) => {
    if (!context) return;
    
    setContext(prev => {
      if (!prev) return null;
      return {
        ...prev,
        task_continuity: {
          ...prev.task_continuity,
          handoff_notes: [...prev.task_continuity.handoff_notes, note]
        },
        updated_at: new Date().toISOString()
      };
    });
  }, [context]);

  /**
   * Add a checkpoint
   */
  const addCheckpoint = useCallback((checkpoint: Checkpoint) => {
    if (!context) return;
    
    setContext(prev => {
      if (!prev) return null;
      return {
        ...prev,
        task_continuity: {
          ...prev.task_continuity,
          checkpoints: [...prev.task_continuity.checkpoints, checkpoint]
        },
        updated_at: new Date().toISOString()
      };
    });
  }, [context]);

  /**
   * Store shared knowledge
   */
  const storeKnowledge = useCallback(async (
    knowledgeType: string,
    key: string,
    value: string,
    model: string
  ) => {
    if (!currentSession?.project_id) return;
    
    try {
      await IntelligenceBridgeAPI.storeSharedKnowledge(
        currentSession.project_id,
        knowledgeType,
        key,
        value,
        model
      );
    } catch (err) {
      console.error('Failed to store knowledge:', err);
    }
  }, [currentSession?.project_id]);

  /**
   * Get shared knowledge
   */
  const getKnowledge = useCallback(async (
    knowledgeType?: string
  ): Promise<Record<string, string>> => {
    if (!currentSession?.project_id) return {};
    
    try {
      return await IntelligenceBridgeAPI.getSharedKnowledge(
        currentSession.project_id,
        knowledgeType
      );
    } catch (err) {
      console.error('Failed to get knowledge:', err);
      return {};
    }
  }, [currentSession?.project_id]);

  /**
   * Record a model collaboration
   */
  const recordCollaboration = useCallback(async (
    sessionIds: string[],
    models: string[],
    collaborationType: string,
    result?: string
  ) => {
    if (!currentSession?.project_id) return;
    
    try {
      await IntelligenceBridgeAPI.recordCollaboration(
        currentSession.project_id,
        sessionIds,
        models,
        collaborationType,
        result
      );
      // Refresh collaboration history
      await loadCollaborationHistory();
    } catch (err) {
      console.error('Failed to record collaboration:', err);
    }
  }, [currentSession?.project_id]);

  /**
   * Load collaboration history
   */
  const loadCollaborationHistory = useCallback(async () => {
    if (!currentSession?.project_id) return;
    
    try {
      const history = await IntelligenceBridgeAPI.getCollaborationHistory(
        currentSession.project_id
      );
      setCollaborationHistory(history);
    } catch (err) {
      console.error('Failed to load collaboration history:', err);
    }
  }, [currentSession?.project_id]);

  /**
   * Create a contextual prompt
   */
  const createContextualPrompt = useCallback(async (
    basePrompt: string,
    targetModel: string
  ): Promise<string> => {
    if (!currentSession?.id) return basePrompt;
    
    try {
      return await IntelligenceBridgeAPI.createContextualPrompt(
        basePrompt,
        currentSession.id,
        targetModel
      );
    } catch (err) {
      console.error('Failed to create contextual prompt:', err);
      return basePrompt;
    }
  }, [currentSession?.id]);

  /**
   * Load injection configuration
   */
  const loadConfig = useCallback(async () => {
    try {
      const loadedConfig = await IntelligenceBridgeAPI.getInjectionConfig();
      setConfig(loadedConfig);
    } catch (err) {
      console.error('Failed to load injection config:', err);
    }
  }, []);

  /**
   * Update injection configuration
   */
  const updateConfig = useCallback(async (newConfig: InjectionConfig) => {
    try {
      await IntelligenceBridgeAPI.updateInjectionConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      console.error('Failed to update injection config:', err);
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Load collaboration history when project changes
  useEffect(() => {
    if (currentSession?.project_id) {
      loadCollaborationHistory();
    }
  }, [currentSession?.project_id, loadCollaborationHistory]);

  return {
    // State
    context,
    config,
    isLoading,
    error,
    collaborationHistory,
    
    // Context management
    loadContext,
    saveContext,
    transferToModel,
    
    // Context updates
    updateWorkProgress,
    addCodeChange,
    addDecision,
    addPlannedTask,
    addHandoffNote,
    addCheckpoint,
    
    // Knowledge management
    storeKnowledge,
    getKnowledge,
    
    // Collaboration
    recordCollaboration,
    loadCollaborationHistory,
    
    // Prompt creation
    createContextualPrompt,
    
    // Config management
    loadConfig,
    updateConfig
  };
}

/**
 * Hook for automatic context injection on model switch
 */
export function useAutoContextInjection() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [lastInjection, setLastInjection] = useState<InjectionResult | null>(null);
  const { currentSession } = useSessionStore();
  
  /**
   * Handle model switch with automatic context injection
   */
  const handleModelSwitch = useCallback(async (
    fromModel: string,
    toModel: string,
    toSessionId: string
  ): Promise<string | null> => {
    if (!isEnabled || !currentSession?.id) return null;
    
    try {
      // Create contextual prompt for the new model
      const contextualPrompt = await IntelligenceBridgeAPI.createContextualPrompt(
        '', // Empty base prompt for pure context transfer
        currentSession.id,
        toModel
      );
      
      // Record the model switch as a collaboration
      await IntelligenceBridgeAPI.recordCollaboration(
        currentSession.project_id,
        [currentSession.id, toSessionId],
        [fromModel, toModel],
        'model_switch',
        'Context transferred successfully'
      );
      
      return contextualPrompt;
    } catch (err) {
      console.error('Failed to inject context on model switch:', err);
      return null;
    }
  }, [isEnabled, currentSession]);
  
  return {
    isEnabled,
    setIsEnabled,
    lastInjection,
    handleModelSwitch
  };
}

/**
 * Hook for managing model collaboration
 */
export function useModelCollaboration() {
  const [activeCollaborations, setActiveCollaborations] = useState<Map<string, string[]>>(new Map());
  const { currentSession } = useSessionStore();
  
  /**
   * Start a collaboration between models
   */
  const startCollaboration = useCallback((
    collaborationId: string,
    models: string[]
  ) => {
    setActiveCollaborations(prev => {
      const next = new Map(prev);
      next.set(collaborationId, models);
      return next;
    });
  }, []);
  
  /**
   * End a collaboration
   */
  const endCollaboration = useCallback(async (
    collaborationId: string,
    result?: string
  ) => {
    const models = activeCollaborations.get(collaborationId);
    if (!models || !currentSession?.project_id) return;
    
    try {
      await IntelligenceBridgeAPI.recordCollaboration(
        currentSession.project_id,
        [currentSession.id],
        models,
        'collaborative_task',
        result
      );
      
      setActiveCollaborations(prev => {
        const next = new Map(prev);
        next.delete(collaborationId);
        return next;
      });
    } catch (err) {
      console.error('Failed to record collaboration:', err);
    }
  }, [activeCollaborations, currentSession]);
  
  /**
   * Check if a collaboration is active
   */
  const isCollaborationActive = useCallback((
    collaborationId: string
  ): boolean => {
    return activeCollaborations.has(collaborationId);
  }, [activeCollaborations]);
  
  /**
   * Get models in a collaboration
   */
  const getCollaborationModels = useCallback((
    collaborationId: string
  ): string[] => {
    return activeCollaborations.get(collaborationId) || [];
  }, [activeCollaborations]);
  
  return {
    activeCollaborations,
    startCollaboration,
    endCollaboration,
    isCollaborationActive,
    getCollaborationModels
  };
}

export default useIntelligenceBridge;