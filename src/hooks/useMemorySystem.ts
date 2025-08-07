import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '@/lib/utils/toast';

export enum MemoryPriority {
  Critical = 'Critical',
  High = 'High',
  Medium = 'Medium',
  Low = 'Low'
}

export enum MemoryType {
  Conversation = 'Conversation',
  WorkContext = 'WorkContext',
  ToolUsage = 'ToolUsage',
  SystemPrompt = 'SystemPrompt',
  ProjectMetadata = 'ProjectMetadata'
}

export interface MemoryEntry {
  id: string;
  session_id: string;
  model: string;
  memory_type: MemoryType;
  priority: MemoryPriority;
  content: string;
  metadata: Record<string, string>;
  token_count: number;
  relevance_score: number;
  created_at: string;
  accessed_at: string;
  access_count: number;
}

export interface MemoryStats {
  total_entries: number;
  total_tokens: number;
  memory_usage_mb: number;
  sessions_count: number;
  models_count: number;
  last_gc_run: string | null;
}

export interface MemoryConfig {
  max_memory_mb: number;
  max_tokens_per_session: number;
  compression_threshold: number;
  relevance_threshold: number;
  gc_interval_minutes: number;
  auto_summarize: boolean;
}

export interface ContextTransferResult {
  session_id: string;
  source_model: string;
  target_model: string;
  transferred_memories: MemoryEntry[];
  total_tokens: number;
  compression_applied: boolean;
  transfer_time_ms: number;
  success: boolean;
  message: string;
}

export function useMemorySystem(sessionId?: string) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [config, setConfig] = useState<MemoryConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadStats();
    loadConfig();
    if (sessionId) {
      loadMemories(sessionId);
    }
  }, [sessionId]);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionId) {
        loadStats();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [sessionId]);

  const loadMemories = useCallback(async (sid: string) => {
    try {
      setIsLoading(true);
      const entries = await invoke<MemoryEntry[]>('retrieve_memory_for_model', {
        sessionId: sid,
        targetModel: '',
        maxTokens: null
      });
      setMemories(entries);
      setError(null);
    } catch (err) {
      console.error('Failed to load memories:', err);
      setError('Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await invoke<MemoryStats>('get_memory_stats');
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const configData = await invoke<MemoryConfig>('get_memory_config');
      setConfig(configData);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }, []);

  const storeMemory = useCallback(async (
    sessionId: string,
    model: string,
    memoryType: MemoryType,
    content: string,
    metadata: Record<string, string> = {},
    priority?: MemoryPriority
  ): Promise<MemoryEntry | null> => {
    try {
      const entry = await invoke<MemoryEntry>('store_memory_entry', {
        sessionId,
        model,
        memoryType,
        content,
        metadata,
        priority
      });
      
      setMemories(prev => [...prev, entry]);
      await loadStats();
      
      return entry;
    } catch (err) {
      console.error('Failed to store memory:', err);
      toast.error('Failed to store memory');
      return null;
    }
  }, []);

  const transferContext = useCallback(async (
    sessionId: string,
    sourceModel: string,
    targetModel: string
  ): Promise<ContextTransferResult | null> => {
    try {
      setIsLoading(true);
      const result = await invoke<ContextTransferResult>('transfer_context_to_model', {
        sessionId,
        sourceModel,
        targetModel
      });
      
      if (result.success) {
        await loadMemories(sessionId);
        await loadStats();
      }
      
      return result;
    } catch (err) {
      console.error('Failed to transfer context:', err);
      toast.error('Failed to transfer context');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [loadMemories]);

  const updateRelevance = useCallback(async (memoryId: string, relevanceScore: number) => {
    try {
      await invoke('update_memory_relevance', {
        memoryId,
        relevanceScore
      });
      
      setMemories(prev => 
        prev.map(m => 
          m.id === memoryId 
            ? { ...m, relevance_score: relevanceScore }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to update relevance:', err);
      toast.error('Failed to update memory relevance');
    }
  }, []);

  const searchMemories = useCallback(async (
    query: string,
    sessionId?: string,
    limit?: number
  ): Promise<MemoryEntry[]> => {
    try {
      const results = await invoke<MemoryEntry[]>('search_memories', {
        query,
        sessionId,
        limit
      });
      return results;
    } catch (err) {
      console.error('Failed to search memories:', err);
      return [];
    }
  }, []);

  const clearSessionMemory = useCallback(async (sessionId: string) => {
    try {
      await invoke('clear_session_memory', { sessionId });
      setMemories([]);
      await loadStats();
      toast.success('Session memory cleared');
    } catch (err) {
      console.error('Failed to clear memory:', err);
      toast.error('Failed to clear session memory');
    }
  }, []);

  const garbageCollect = useCallback(async (): Promise<number> => {
    try {
      const deleted = await invoke<number>('garbage_collect_memory');
      await loadStats();
      if (sessionId) {
        await loadMemories(sessionId);
      }
      toast.success(`Cleaned up ${deleted} old memories`);
      return deleted;
    } catch (err) {
      console.error('Failed to garbage collect:', err);
      toast.error('Failed to clean up memories');
      return 0;
    }
  }, [sessionId, loadMemories]);

  const updateConfig = useCallback(async (newConfig: MemoryConfig) => {
    try {
      await invoke('update_memory_config', { config: newConfig });
      setConfig(newConfig);
      toast.success('Memory configuration updated');
    } catch (err) {
      console.error('Failed to update config:', err);
      toast.error('Failed to update configuration');
    }
  }, []);

  const recommendModel = useCallback(async (sessionId: string): Promise<string | null> => {
    try {
      const model = await invoke<string>('recommend_model_for_context', { sessionId });
      return model;
    } catch (err) {
      console.error('Failed to get recommendation:', err);
      return null;
    }
  }, []);

  const mergeSessionMemories = useCallback(async (
    sessionIds: string[],
    targetSessionId: string
  ): Promise<number> => {
    try {
      const merged = await invoke<number>('merge_session_memories', {
        sessionIds,
        targetSessionId
      });
      
      if (targetSessionId === sessionId) {
        await loadMemories(targetSessionId);
      }
      await loadStats();
      
      toast.success(`Merged ${merged} memories`);
      return merged;
    } catch (err) {
      console.error('Failed to merge memories:', err);
      toast.error('Failed to merge session memories');
      return 0;
    }
  }, [sessionId, loadMemories]);

  // Memory analytics
  const getMemoriesByType = useCallback(() => {
    const grouped = new Map<MemoryType, MemoryEntry[]>();
    memories.forEach(memory => {
      const type = memory.memory_type;
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(memory);
    });
    return grouped;
  }, [memories]);

  const getMemoriesByPriority = useCallback(() => {
    const grouped = new Map<MemoryPriority, MemoryEntry[]>();
    memories.forEach(memory => {
      const priority = memory.priority;
      if (!grouped.has(priority)) {
        grouped.set(priority, []);
      }
      grouped.get(priority)!.push(memory);
    });
    return grouped;
  }, [memories]);

  const getMemoriesByModel = useCallback(() => {
    const grouped = new Map<string, MemoryEntry[]>();
    memories.forEach(memory => {
      if (!grouped.has(memory.model)) {
        grouped.set(memory.model, []);
      }
      grouped.get(memory.model)!.push(memory);
    });
    return grouped;
  }, [memories]);

  const getCriticalMemories = useCallback(() => {
    return memories.filter(m => m.priority === MemoryPriority.Critical);
  }, [memories]);

  const getTotalTokens = useCallback(() => {
    return memories.reduce((sum, m) => sum + m.token_count, 0);
  }, [memories]);

  return {
    // Data
    memories,
    stats,
    config,
    isLoading,
    error,
    
    // Actions
    storeMemory,
    transferContext,
    updateRelevance,
    searchMemories,
    clearSessionMemory,
    garbageCollect,
    updateConfig,
    recommendModel,
    mergeSessionMemories,
    
    // Analytics
    getMemoriesByType,
    getMemoriesByPriority,
    getMemoriesByModel,
    getCriticalMemories,
    getTotalTokens,
    
    // Refresh
    refresh: () => {
      loadStats();
      if (sessionId) {
        loadMemories(sessionId);
      }
    }
  };
}