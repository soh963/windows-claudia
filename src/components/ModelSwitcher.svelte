<script lang="ts">
    import { onMount } from 'svelte';
    import { fade, slide } from 'svelte/transition';
    import { 
        transferContext, 
        previewTransfer, 
        recommendModel,
        transferInProgress,
        memoryStats,
        type ContextTransferResult
    } from '$lib/stores/memoryStore';
    import { currentSession, currentModel } from '$lib/stores/sessionStore';
    import { toast } from '$lib/utils/toast';
    
    export let models: Array<{ id: string; name: string; available: boolean }> = [];
    export let onModelSwitch: (modelId: string) => void = () => {};
    
    let selectedModel = '';
    let showPreview = false;
    let transferPreview: Record<string, any> | null = null;
    let recommendedModel = '';
    let isTransferring = false;
    let lastTransferResult: ContextTransferResult | null = null;
    
    $: sessionId = $currentSession?.id || '';
    $: sourceModel = $currentModel || '';
    $: isTransferring = $transferInProgress;
    
    onMount(async () => {
        selectedModel = sourceModel;
        
        // Get model recommendation if we have a session
        if (sessionId) {
            try {
                recommendedModel = await recommendModel(sessionId);
            } catch (error) {
                console.error('Failed to get model recommendation:', error);
            }
        }
    });
    
    async function handleModelChange() {
        if (!selectedModel || selectedModel === sourceModel) {
            return;
        }
        
        if (!sessionId) {
            // No session, just switch
            onModelSwitch(selectedModel);
            return;
        }
        
        // Preview the transfer
        try {
            transferPreview = await previewTransfer(sessionId, sourceModel, selectedModel);
            showPreview = true;
        } catch (error) {
            console.error('Failed to preview transfer:', error);
            toast.error('Failed to preview context transfer');
        }
    }
    
    async function confirmTransfer() {
        if (!selectedModel || !sessionId) return;
        
        try {
            const result = await transferContext(sessionId, sourceModel, selectedModel);
            
            if (result.success) {
                lastTransferResult = result;
                toast.success(`Context transferred successfully in ${result.transfer_time_ms}ms`);
                onModelSwitch(selectedModel);
                showPreview = false;
            } else {
                toast.error(result.message || 'Failed to transfer context');
            }
        } catch (error) {
            console.error('Context transfer failed:', error);
            toast.error('Failed to transfer context to new model');
        }
    }
    
    function cancelTransfer() {
        showPreview = false;
        transferPreview = null;
        selectedModel = sourceModel;
    }
    
    function formatTokenCount(count: number): string {
        if (count > 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        } else if (count > 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }
</script>

<div class="model-switcher">
    <div class="switcher-header">
        <h3>AI Model</h3>
        {#if $memoryStats}
            <div class="memory-stats">
                <span class="stat-item">
                    <i class="icon-memory"></i>
                    {formatTokenCount($memoryStats.total_tokens)} tokens
                </span>
                <span class="stat-item">
                    <i class="icon-database"></i>
                    {$memoryStats.memory_usage_mb.toFixed(1)} MB
                </span>
            </div>
        {/if}
    </div>
    
    <div class="model-selector">
        <select 
            bind:value={selectedModel}
            on:change={handleModelChange}
            disabled={isTransferring}
            class:recommended={selectedModel === recommendedModel}
        >
            <option value="">Select a model...</option>
            {#each models as model}
                <option 
                    value={model.id} 
                    disabled={!model.available}
                >
                    {model.name}
                    {#if model.id === recommendedModel}
                        (Recommended)
                    {/if}
                    {#if !model.available}
                        (Unavailable)
                    {/if}
                </option>
            {/each}
        </select>
        
        {#if isTransferring}
            <div class="transfer-indicator" transition:fade>
                <div class="spinner"></div>
                <span>Transferring context...</span>
            </div>
        {/if}
    </div>
    
    {#if recommendedModel && recommendedModel !== selectedModel}
        <div class="recommendation" transition:slide>
            <i class="icon-info"></i>
            <span>Based on your current context, <strong>{recommendedModel}</strong> is recommended</span>
        </div>
    {/if}
    
    {#if showPreview && transferPreview}
        <div class="transfer-preview" transition:slide>
            <h4>Context Transfer Preview</h4>
            
            <div class="preview-stats">
                <div class="stat">
                    <label>Memories to Transfer:</label>
                    <span>{transferPreview.total_memories || 0}</span>
                </div>
                <div class="stat">
                    <label>Total Tokens:</label>
                    <span class:warning={transferPreview.will_compress}>
                        {formatTokenCount(transferPreview.total_tokens || 0)}
                        / {formatTokenCount(transferPreview.target_max_tokens || 0)}
                    </span>
                </div>
                {#if transferPreview.will_compress}
                    <div class="compression-warning">
                        <i class="icon-warning"></i>
                        Context will be compressed to fit token limit
                    </div>
                {/if}
            </div>
            
            {#if transferPreview.type_distribution}
                <div class="distribution">
                    <h5>Memory Types</h5>
                    <div class="distribution-bars">
                        {#each Object.entries(transferPreview.type_distribution) as [type, count]}
                            <div class="bar-item">
                                <label>{type}:</label>
                                <div class="bar">
                                    <div 
                                        class="bar-fill"
                                        style="width: {(count / transferPreview.total_memories) * 100}%"
                                    ></div>
                                    <span>{count}</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
            
            <div class="preview-actions">
                <button 
                    class="btn-primary"
                    on:click={confirmTransfer}
                    disabled={isTransferring}
                >
                    Confirm Transfer
                </button>
                <button 
                    class="btn-secondary"
                    on:click={cancelTransfer}
                    disabled={isTransferring}
                >
                    Cancel
                </button>
            </div>
        </div>
    {/if}
    
    {#if lastTransferResult}
        <div class="transfer-result" transition:slide>
            <div class="result-header">
                <i class="icon-check"></i>
                <span>Last Transfer: {lastTransferResult.source_model} → {lastTransferResult.target_model}</span>
            </div>
            <div class="result-stats">
                <span>{lastTransferResult.transferred_memories.length} memories</span>
                <span>{formatTokenCount(lastTransferResult.total_tokens)} tokens</span>
                <span>{lastTransferResult.transfer_time_ms}ms</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .model-switcher {
        background: var(--surface);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
    }
    
    .switcher-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }
    
    .switcher-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
    }
    
    .memory-stats {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .model-selector {
        position: relative;
    }
    
    select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--background);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    select:hover:not(:disabled) {
        border-color: var(--primary);
    }
    
    select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    select.recommended {
        border-color: var(--success);
    }
    
    .transfer-indicator {
        position: absolute;
        top: 50%;
        right: 12px;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--primary);
    }
    
    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid var(--primary);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .recommendation {
        margin-top: 8px;
        padding: 8px 12px;
        background: var(--info-bg);
        border: 1px solid var(--info-border);
        border-radius: 6px;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .transfer-preview {
        margin-top: 16px;
        padding: 16px;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 6px;
    }
    
    .transfer-preview h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
    }
    
    .preview-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
    }
    
    .stat {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .stat label {
        font-size: 12px;
        color: var(--text-secondary);
    }
    
    .stat span {
        font-size: 18px;
        font-weight: 600;
    }
    
    .stat span.warning {
        color: var(--warning);
    }
    
    .compression-warning {
        padding: 8px 12px;
        background: var(--warning-bg);
        border: 1px solid var(--warning-border);
        border-radius: 4px;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    }
    
    .distribution {
        margin-bottom: 16px;
    }
    
    .distribution h5 {
        margin: 0 0 8px 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
    }
    
    .distribution-bars {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    
    .bar-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
    }
    
    .bar-item label {
        min-width: 100px;
        color: var(--text-secondary);
    }
    
    .bar {
        flex: 1;
        height: 20px;
        background: var(--surface);
        border-radius: 4px;
        position: relative;
        overflow: hidden;
    }
    
    .bar-fill {
        height: 100%;
        background: var(--primary);
        transition: width 0.3s ease;
    }
    
    .bar span {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 11px;
        font-weight: 600;
    }
    
    .preview-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }
    
    .btn-primary,
    .btn-secondary {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }
    
    .btn-primary {
        background: var(--primary);
        color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
        background: var(--primary-hover);
    }
    
    .btn-secondary {
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--border);
    }
    
    .btn-secondary:hover:not(:disabled) {
        background: var(--background);
    }
    
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .transfer-result {
        margin-top: 12px;
        padding: 12px;
        background: var(--success-bg);
        border: 1px solid var(--success-border);
        border-radius: 6px;
        font-size: 13px;
    }
    
    .result-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 500;
    }
    
    .result-stats {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: var(--text-secondary);
    }
</style>