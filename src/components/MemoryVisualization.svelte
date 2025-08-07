<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { 
        memories,
        memoryStats,
        memoriesBySession,
        memoriesByModel,
        criticalMemories,
        searchMemories,
        updateMemoryRelevance,
        garbageCollect,
        refreshMemoryStats,
        type MemoryEntry,
        MemoryPriority,
        MemoryType
    } from '$lib/stores/memoryStore';
    
    let searchQuery = '';
    let searchResults: MemoryEntry[] = [];
    let selectedMemory: MemoryEntry | null = null;
    let viewMode: 'timeline' | 'priority' | 'model' | 'type' = 'timeline';
    let autoRefresh = true;
    let refreshInterval: number;
    
    $: totalMemories = $memories.length;
    $: sessionGroups = $memoriesBySession;
    $: modelGroups = $memoriesByModel;
    $: criticalCount = $criticalMemories.length;
    
    onMount(() => {
        refreshMemoryStats();
        
        if (autoRefresh) {
            refreshInterval = setInterval(() => {
                refreshMemoryStats();
            }, 30000); // Refresh every 30 seconds
        }
    });
    
    onDestroy(() => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
    
    async function handleSearch() {
        if (!searchQuery.trim()) {
            searchResults = [];
            return;
        }
        
        try {
            searchResults = await searchMemories(searchQuery);
        } catch (error) {
            console.error('Search failed:', error);
            searchResults = [];
        }
    }
    
    async function handleGarbageCollect() {
        try {
            const deleted = await garbageCollect();
            console.log(`Deleted ${deleted} old memories`);
            await refreshMemoryStats();
        } catch (error) {
            console.error('Garbage collection failed:', error);
        }
    }
    
    async function adjustRelevance(memory: MemoryEntry, delta: number) {
        const newScore = Math.max(0, Math.min(1, memory.relevance_score + delta));
        try {
            await updateMemoryRelevance(memory.id, newScore);
        } catch (error) {
            console.error('Failed to update relevance:', error);
        }
    }
    
    function getPriorityColor(priority: MemoryPriority): string {
        switch (priority) {
            case MemoryPriority.Critical: return '#ff4444';
            case MemoryPriority.High: return '#ff8800';
            case MemoryPriority.Medium: return '#44bb44';
            case MemoryPriority.Low: return '#888888';
            default: return '#666666';
        }
    }
    
    function getTypeIcon(type: MemoryType): string {
        switch (type) {
            case MemoryType.Conversation: return '💬';
            case MemoryType.WorkContext: return '📁';
            case MemoryType.ToolUsage: return '🔧';
            case MemoryType.SystemPrompt: return '⚙️';
            case MemoryType.ProjectMetadata: return '📋';
            default: return '📄';
        }
    }
    
    function formatBytes(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    
    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleString();
    }
</script>

<div class="memory-visualization">
    <div class="visualization-header">
        <h2>Memory System</h2>
        <div class="header-controls">
            <label class="auto-refresh">
                <input 
                    type="checkbox" 
                    bind:checked={autoRefresh}
                    on:change={() => {
                        if (autoRefresh && !refreshInterval) {
                            refreshInterval = setInterval(refreshMemoryStats, 30000);
                        } else if (!autoRefresh && refreshInterval) {
                            clearInterval(refreshInterval);
                            refreshInterval = 0;
                        }
                    }}
                />
                Auto-refresh
            </label>
            <button class="btn-icon" on:click={refreshMemoryStats} title="Refresh">
                🔄
            </button>
            <button class="btn-icon" on:click={handleGarbageCollect} title="Garbage Collect">
                🗑️
            </button>
        </div>
    </div>
    
    {#if $memoryStats}
        <div class="memory-stats-grid">
            <div class="stat-card">
                <div class="stat-value">{$memoryStats.total_entries}</div>
                <div class="stat-label">Total Memories</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{($memoryStats.total_tokens / 1000).toFixed(1)}K</div>
                <div class="stat-label">Total Tokens</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{$memoryStats.memory_usage_mb.toFixed(2)} MB</div>
                <div class="stat-label">Memory Usage</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{$memoryStats.sessions_count}</div>
                <div class="stat-label">Active Sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{$memoryStats.models_count}</div>
                <div class="stat-label">Models Used</div>
            </div>
            <div class="stat-card critical">
                <div class="stat-value">{criticalCount}</div>
                <div class="stat-label">Critical Memories</div>
            </div>
        </div>
    {/if}
    
    <div class="search-section">
        <input 
            type="text"
            placeholder="Search memories..."
            bind:value={searchQuery}
            on:keyup={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button on:click={handleSearch}>Search</button>
    </div>
    
    <div class="view-controls">
        <button 
            class:active={viewMode === 'timeline'}
            on:click={() => viewMode = 'timeline'}
        >
            Timeline
        </button>
        <button 
            class:active={viewMode === 'priority'}
            on:click={() => viewMode = 'priority'}
        >
            Priority
        </button>
        <button 
            class:active={viewMode === 'model'}
            on:click={() => viewMode = 'model'}
        >
            By Model
        </button>
        <button 
            class:active={viewMode === 'type'}
            on:click={() => viewMode = 'type'}
        >
            By Type
        </button>
    </div>
    
    <div class="memory-content">
        {#if searchResults.length > 0}
            <div class="search-results">
                <h3>Search Results ({searchResults.length})</h3>
                <div class="memory-list">
                    {#each searchResults as memory}
                        <div 
                            class="memory-item"
                            on:click={() => selectedMemory = memory}
                            transition:fade
                        >
                            <div class="memory-header">
                                <span class="memory-type">{getTypeIcon(memory.memory_type)}</span>
                                <span class="memory-model">{memory.model}</span>
                                <span 
                                    class="memory-priority"
                                    style="color: {getPriorityColor(memory.priority)}"
                                >
                                    {memory.priority}
                                </span>
                            </div>
                            <div class="memory-content-preview">
                                {memory.content.substring(0, 150)}...
                            </div>
                            <div class="memory-footer">
                                <span class="token-count">{memory.token_count} tokens</span>
                                <span class="relevance">⭐ {(memory.relevance_score * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {:else if viewMode === 'timeline'}
            <div class="timeline-view">
                {#each [...$memories].reverse() as memory, i}
                    <div 
                        class="timeline-item"
                        on:click={() => selectedMemory = memory}
                        transition:fly="{{ y: 20, duration: 200, delay: i * 20 }}"
                    >
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <div class="timeline-header">
                                <span class="type-icon">{getTypeIcon(memory.memory_type)}</span>
                                <span class="model-badge">{memory.model}</span>
                                <span class="time">{formatDate(memory.created_at)}</span>
                            </div>
                            <div class="content-preview">
                                {memory.content.substring(0, 100)}...
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else if viewMode === 'priority'}
            <div class="priority-view">
                {#each Object.values(MemoryPriority) as priority}
                    <div class="priority-section">
                        <h3 style="color: {getPriorityColor(priority)}">{priority}</h3>
                        <div class="memory-grid">
                            {#each $memories.filter(m => m.priority === priority) as memory}
                                <div 
                                    class="memory-card"
                                    on:click={() => selectedMemory = memory}
                                    transition:fade
                                >
                                    <div class="card-header">
                                        {getTypeIcon(memory.memory_type)} {memory.model}
                                    </div>
                                    <div class="card-content">
                                        {memory.content.substring(0, 80)}...
                                    </div>
                                    <div class="card-footer">
                                        <span>{memory.token_count} tokens</span>
                                        <div class="relevance-controls">
                                            <button on:click|stopPropagation={() => adjustRelevance(memory, -0.1)}>−</button>
                                            <span>{(memory.relevance_score * 100).toFixed(0)}%</span>
                                            <button on:click|stopPropagation={() => adjustRelevance(memory, 0.1)}>+</button>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {:else if viewMode === 'model'}
            <div class="model-view">
                {#each [...modelGroups.entries()] as [model, modelMemories]}
                    <div class="model-section">
                        <h3>{model} ({modelMemories.length})</h3>
                        <div class="memory-list">
                            {#each modelMemories as memory}
                                <div 
                                    class="memory-item"
                                    on:click={() => selectedMemory = memory}
                                >
                                    <span class="type-icon">{getTypeIcon(memory.memory_type)}</span>
                                    <span class="content">{memory.content.substring(0, 100)}...</span>
                                    <span class="tokens">{memory.token_count}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {:else if viewMode === 'type'}
            <div class="type-view">
                {#each Object.values(MemoryType) as type}
                    {@const typeMemories = $memories.filter(m => m.memory_type === type)}
                    {#if typeMemories.length > 0}
                        <div class="type-section">
                            <h3>{getTypeIcon(type)} {type} ({typeMemories.length})</h3>
                            <div class="memory-grid">
                                {#each typeMemories as memory}
                                    <div 
                                        class="memory-card"
                                        on:click={() => selectedMemory = memory}
                                    >
                                        <div class="card-model">{memory.model}</div>
                                        <div class="card-content">
                                            {memory.content.substring(0, 100)}...
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
    
    {#if selectedMemory}
        <div class="memory-detail-modal" on:click={() => selectedMemory = null} transition:fade>
            <div class="modal-content" on:click|stopPropagation>
                <div class="modal-header">
                    <h3>Memory Details</h3>
                    <button class="close-btn" on:click={() => selectedMemory = null}>×</button>
                </div>
                <div class="modal-body">
                    <div class="detail-row">
                        <label>ID:</label>
                        <span>{selectedMemory.id}</span>
                    </div>
                    <div class="detail-row">
                        <label>Type:</label>
                        <span>{getTypeIcon(selectedMemory.memory_type)} {selectedMemory.memory_type}</span>
                    </div>
                    <div class="detail-row">
                        <label>Priority:</label>
                        <span style="color: {getPriorityColor(selectedMemory.priority)}">
                            {selectedMemory.priority}
                        </span>
                    </div>
                    <div class="detail-row">
                        <label>Model:</label>
                        <span>{selectedMemory.model}</span>
                    </div>
                    <div class="detail-row">
                        <label>Tokens:</label>
                        <span>{selectedMemory.token_count}</span>
                    </div>
                    <div class="detail-row">
                        <label>Relevance:</label>
                        <span>{(selectedMemory.relevance_score * 100).toFixed(1)}%</span>
                    </div>
                    <div class="detail-row">
                        <label>Created:</label>
                        <span>{formatDate(selectedMemory.created_at)}</span>
                    </div>
                    <div class="detail-row">
                        <label>Last Accessed:</label>
                        <span>{formatDate(selectedMemory.accessed_at)}</span>
                    </div>
                    <div class="detail-row">
                        <label>Access Count:</label>
                        <span>{selectedMemory.access_count}</span>
                    </div>
                    <div class="detail-content">
                        <label>Content:</label>
                        <pre>{selectedMemory.content}</pre>
                    </div>
                    {#if Object.keys(selectedMemory.metadata).length > 0}
                        <div class="detail-metadata">
                            <label>Metadata:</label>
                            <pre>{JSON.stringify(selectedMemory.metadata, null, 2)}</pre>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .memory-visualization {
        padding: 20px;
        background: var(--background);
        min-height: 100vh;
    }
    
    .visualization-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
    }
    
    .visualization-header h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
    }
    
    .header-controls {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .auto-refresh {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
    }
    
    .btn-icon {
        width: 36px;
        height: 36px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--surface);
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    
    .btn-icon:hover {
        background: var(--background);
        border-color: var(--primary);
    }
    
    .memory-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }
    
    .stat-card {
        background: var(--surface);
        padding: 16px;
        border-radius: 8px;
        border: 1px solid var(--border);
        text-align: center;
    }
    
    .stat-card.critical {
        border-color: #ff4444;
        background: rgba(255, 68, 68, 0.05);
    }
    
    .stat-value {
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 4px;
    }
    
    .stat-label {
        font-size: 12px;
        color: var(--text-secondary);
        text-transform: uppercase;
    }
    
    .search-section {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
    }
    
    .search-section input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--surface);
        font-size: 14px;
    }
    
    .search-section button {
        padding: 10px 20px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .search-section button:hover {
        background: var(--primary-hover);
    }
    
    .view-controls {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border);
    }
    
    .view-controls button {
        padding: 8px 16px;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
    }
    
    .view-controls button:hover {
        color: var(--text);
    }
    
    .view-controls button.active {
        color: var(--primary);
        border-bottom-color: var(--primary);
    }
    
    .memory-content {
        min-height: 400px;
    }
    
    .timeline-view {
        position: relative;
        padding-left: 40px;
    }
    
    .timeline-view::before {
        content: '';
        position: absolute;
        left: 20px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border);
    }
    
    .timeline-item {
        position: relative;
        margin-bottom: 20px;
        cursor: pointer;
    }
    
    .timeline-marker {
        position: absolute;
        left: -26px;
        top: 8px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--primary);
        border: 2px solid var(--background);
    }
    
    .timeline-content {
        background: var(--surface);
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid var(--border);
        transition: all 0.2s;
    }
    
    .timeline-content:hover {
        border-color: var(--primary);
        transform: translateX(4px);
    }
    
    .timeline-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 13px;
    }
    
    .type-icon {
        font-size: 16px;
    }
    
    .model-badge {
        padding: 2px 8px;
        background: var(--primary);
        color: white;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
    }
    
    .time {
        margin-left: auto;
        color: var(--text-secondary);
        font-size: 12px;
    }
    
    .content-preview {
        font-size: 14px;
        color: var(--text-secondary);
    }
    
    .priority-section,
    .model-section,
    .type-section {
        margin-bottom: 32px;
    }
    
    .priority-section h3,
    .model-section h3,
    .type-section h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
    }
    
    .memory-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 12px;
    }
    
    .memory-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .memory-card:hover {
        border-color: var(--primary);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .card-header {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .card-content {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 8px;
        line-height: 1.4;
    }
    
    .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .relevance-controls {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .relevance-controls button {
        width: 20px;
        height: 20px;
        border: 1px solid var(--border);
        background: var(--background);
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .relevance-controls button:hover {
        background: var(--surface);
    }
    
    .memory-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .memory-item {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .memory-item:hover {
        border-color: var(--primary);
    }
    
    .memory-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 13px;
    }
    
    .memory-content-preview {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 8px;
        line-height: 1.4;
    }
    
    .memory-footer {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .memory-detail-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .modal-content {
        background: var(--surface);
        border-radius: 12px;
        width: 90%;
        max-width: 700px;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--border);
    }
    
    .modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
    }
    
    .close-btn {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: transparent;
        cursor: pointer;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    
    .close-btn:hover {
        background: var(--background);
    }
    
    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }
    
    .detail-row {
        display: flex;
        margin-bottom: 12px;
        font-size: 14px;
    }
    
    .detail-row label {
        min-width: 120px;
        font-weight: 500;
        color: var(--text-secondary);
    }
    
    .detail-content,
    .detail-metadata {
        margin-top: 20px;
    }
    
    .detail-content label,
    .detail-metadata label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: var(--text-secondary);
        font-size: 14px;
    }
    
    .detail-content pre,
    .detail-metadata pre {
        background: var(--background);
        padding: 12px;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        margin: 0;
    }
</style>