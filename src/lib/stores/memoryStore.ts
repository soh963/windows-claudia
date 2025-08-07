import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

// Types matching the Rust backend
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

export interface ContextSummary {
    session_id: string;
    original_model: string;
    summary: string;
    key_points: string[];
    token_count: number;
    created_at: string;
}

export interface MemoryConfig {
    max_memory_mb: number;
    max_tokens_per_session: number;
    compression_threshold: number;
    relevance_threshold: number;
    gc_interval_minutes: number;
    auto_summarize: boolean;
}

export interface MemoryStats {
    total_entries: number;
    total_tokens: number;
    memory_usage_mb: number;
    sessions_count: number;
    models_count: number;
    last_gc_run: string | null;
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

export interface ContextSimilarity {
    session_id_1: string;
    session_id_2: string;
    similarity_score: number;
    shared_topics: string[];
    common_tools: string[];
}

// Stores
export const memories = writable<MemoryEntry[]>([]);
export const memoryStats = writable<MemoryStats | null>(null);
export const memoryConfig = writable<MemoryConfig | null>(null);
export const contextSummaries = writable<ContextSummary[]>([]);
export const transferInProgress = writable<boolean>(false);

// Derived stores
export const memoriesBySession = derived(memories, ($memories) => {
    const grouped = new Map<string, MemoryEntry[]>();
    for (const memory of $memories) {
        if (!grouped.has(memory.session_id)) {
            grouped.set(memory.session_id, []);
        }
        grouped.get(memory.session_id)!.push(memory);
    }
    return grouped;
});

export const memoriesByModel = derived(memories, ($memories) => {
    const grouped = new Map<string, MemoryEntry[]>();
    for (const memory of $memories) {
        if (!grouped.has(memory.model)) {
            grouped.set(memory.model, []);
        }
        grouped.get(memory.model)!.push(memory);
    }
    return grouped;
});

export const criticalMemories = derived(memories, ($memories) => 
    $memories.filter(m => m.priority === MemoryPriority.Critical)
);

// Memory management functions
export async function storeMemory(
    sessionId: string,
    model: string,
    memoryType: MemoryType,
    content: string,
    metadata: Record<string, string> = {},
    priority?: MemoryPriority
): Promise<MemoryEntry> {
    try {
        const entry = await invoke<MemoryEntry>('store_memory_entry', {
            sessionId,
            model,
            memoryType,
            content,
            metadata,
            priority
        });
        
        memories.update(m => [...m, entry]);
        await refreshMemoryStats();
        
        return entry;
    } catch (error) {
        console.error('Failed to store memory:', error);
        throw error;
    }
}

export async function retrieveMemoriesForModel(
    sessionId: string,
    targetModel: string,
    maxTokens?: number
): Promise<MemoryEntry[]> {
    try {
        const entries = await invoke<MemoryEntry[]>('retrieve_memory_for_model', {
            sessionId,
            targetModel,
            maxTokens
        });
        
        return entries;
    } catch (error) {
        console.error('Failed to retrieve memories:', error);
        throw error;
    }
}

export async function createContextSummary(
    sessionId: string,
    originalModel: string
): Promise<ContextSummary> {
    try {
        const summary = await invoke<ContextSummary>('create_context_summary', {
            sessionId,
            originalModel
        });
        
        contextSummaries.update(s => [...s, summary]);
        return summary;
    } catch (error) {
        console.error('Failed to create context summary:', error);
        throw error;
    }
}

export async function transferContext(
    sessionId: string,
    sourceModel: string,
    targetModel: string
): Promise<ContextTransferResult> {
    try {
        transferInProgress.set(true);
        
        const result = await invoke<ContextTransferResult>('transfer_context_to_model', {
            sessionId,
            sourceModel,
            targetModel
        });
        
        if (result.success) {
            // Update local memories with transferred ones
            memories.update(m => [...m, ...result.transferred_memories]);
        }
        
        return result;
    } catch (error) {
        console.error('Failed to transfer context:', error);
        throw error;
    } finally {
        transferInProgress.set(false);
    }
}

export async function calculateSimilarity(
    sessionId1: string,
    sessionId2: string
): Promise<ContextSimilarity> {
    try {
        const similarity = await invoke<ContextSimilarity>('calculate_context_similarity', {
            sessionId1,
            sessionId2
        });
        
        return similarity;
    } catch (error) {
        console.error('Failed to calculate similarity:', error);
        throw error;
    }
}

export async function recommendModel(sessionId: string): Promise<string> {
    try {
        const model = await invoke<string>('recommend_model_for_context', {
            sessionId
        });
        
        return model;
    } catch (error) {
        console.error('Failed to get model recommendation:', error);
        throw error;
    }
}

export async function previewTransfer(
    sessionId: string,
    sourceModel: string,
    targetModel: string
): Promise<Record<string, any>> {
    try {
        const preview = await invoke<Record<string, any>>('preview_context_transfer', {
            sessionId,
            sourceModel,
            targetModel
        });
        
        return preview;
    } catch (error) {
        console.error('Failed to preview transfer:', error);
        throw error;
    }
}

export async function refreshMemoryStats(): Promise<void> {
    try {
        const stats = await invoke<MemoryStats>('get_memory_stats');
        memoryStats.set(stats);
    } catch (error) {
        console.error('Failed to refresh memory stats:', error);
    }
}

export async function updateMemoryRelevance(
    memoryId: string,
    relevanceScore: number
): Promise<void> {
    try {
        await invoke('update_memory_relevance', {
            memoryId,
            relevanceScore
        });
        
        memories.update(mems => 
            mems.map(m => 
                m.id === memoryId 
                    ? { ...m, relevance_score: relevanceScore }
                    : m
            )
        );
    } catch (error) {
        console.error('Failed to update memory relevance:', error);
        throw error;
    }
}

export async function garbageCollect(): Promise<number> {
    try {
        const deleted = await invoke<number>('garbage_collect_memory');
        await refreshMemoryStats();
        return deleted;
    } catch (error) {
        console.error('Failed to garbage collect:', error);
        throw error;
    }
}

export async function getMemoryConfig(): Promise<MemoryConfig> {
    try {
        const config = await invoke<MemoryConfig>('get_memory_config');
        memoryConfig.set(config);
        return config;
    } catch (error) {
        console.error('Failed to get memory config:', error);
        throw error;
    }
}

export async function updateMemoryConfig(config: MemoryConfig): Promise<void> {
    try {
        await invoke('update_memory_config', { config });
        memoryConfig.set(config);
    } catch (error) {
        console.error('Failed to update memory config:', error);
        throw error;
    }
}

export async function clearSessionMemory(sessionId: string): Promise<void> {
    try {
        await invoke('clear_session_memory', { sessionId });
        
        memories.update(mems => 
            mems.filter(m => m.session_id !== sessionId)
        );
        
        contextSummaries.update(sums => 
            sums.filter(s => s.session_id !== sessionId)
        );
        
        await refreshMemoryStats();
    } catch (error) {
        console.error('Failed to clear session memory:', error);
        throw error;
    }
}

export async function searchMemories(
    query: string,
    sessionId?: string,
    limit?: number
): Promise<MemoryEntry[]> {
    try {
        const results = await invoke<MemoryEntry[]>('search_memories', {
            query,
            sessionId,
            limit
        });
        
        return results;
    } catch (error) {
        console.error('Failed to search memories:', error);
        throw error;
    }
}

export async function mergeSessionMemories(
    sessionIds: string[],
    targetSessionId: string
): Promise<number> {
    try {
        const merged = await invoke<number>('merge_session_memories', {
            sessionIds,
            targetSessionId
        });
        
        await refreshMemoryStats();
        return merged;
    } catch (error) {
        console.error('Failed to merge memories:', error);
        throw error;
    }
}

// Initialize on module load
getMemoryConfig().catch(console.error);
refreshMemoryStats().catch(console.error);