<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { modelHealthStore, ModelStatus, type ModelHealth } from '$lib/stores/modelHealthStore';
  import type { Model } from '$lib/models';
  
  export let model: Model;
  export let showDetails = false;
  export let onFallbackSelect: ((modelId: string) => void) | undefined = undefined;
  
  let health: ModelHealth | undefined;
  let isChecking = false;
  
  $: health = $modelHealthStore.healthData.get(model.id);
  $: statusClass = getStatusClass(health?.status);
  $: statusIcon = getStatusIcon(health?.status);
  $: statusText = getStatusText(health?.status);
  
  function getStatusClass(status?: ModelStatus) {
    switch (status) {
      case ModelStatus.Available:
        return 'text-green-500';
      case ModelStatus.Degraded:
        return 'text-yellow-500';
      case ModelStatus.Unavailable:
        return 'text-red-500';
      case ModelStatus.Deprecated:
        return 'text-orange-500';
      default:
        return 'text-gray-400';
    }
  }
  
  function getStatusIcon(status?: ModelStatus) {
    switch (status) {
      case ModelStatus.Available:
        return '✓';
      case ModelStatus.Degraded:
        return '⚠';
      case ModelStatus.Unavailable:
        return '✗';
      case ModelStatus.Deprecated:
        return '⚡';
      default:
        return '?';
    }
  }
  
  function getStatusText(status?: ModelStatus) {
    switch (status) {
      case ModelStatus.Available:
        return 'Available';
      case ModelStatus.Degraded:
        return 'Degraded - May have issues';
      case ModelStatus.Unavailable:
        return 'Unavailable - Not working';
      case ModelStatus.Deprecated:
        return 'Deprecated - Please upgrade';
      default:
        return 'Status unknown';
    }
  }
  
  async function checkModelHealth() {
    if (isChecking) return;
    
    isChecking = true;
    try {
      await modelHealthStore.validateModel(model.id, model.provider);
    } catch (error) {
      console.error('Failed to check model health:', error);
    } finally {
      isChecking = false;
    }
  }
  
  function selectFallback() {
    if (health?.fallback_model && onFallbackSelect) {
      onFallbackSelect(health.fallback_model);
    }
  }
  
  function formatResponseTime(ms?: number) {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
  
  function formatSuccessRate(rate: number) {
    return `${rate.toFixed(1)}%`;
  }
</script>

<div class="model-health-indicator">
  <div class="flex items-center gap-2">
    <!-- Status Icon -->
    <span class="status-icon {statusClass} text-lg font-bold" title={statusText}>
      {statusIcon}
    </span>
    
    <!-- Model Name -->
    <span class="model-name flex-1">
      {model.name}
      {#if health?.status === ModelStatus.Deprecated}
        <span class="text-xs text-orange-500 ml-1">(Legacy)</span>
      {/if}
    </span>
    
    <!-- Quick Stats -->
    {#if health && showDetails}
      <div class="flex items-center gap-3 text-xs text-gray-500">
        {#if health.average_response_time_ms}
          <span title="Average Response Time">
            ⚡ {formatResponseTime(health.average_response_time_ms)}
          </span>
        {/if}
        {#if health.success_rate > 0}
          <span title="Success Rate">
            📊 {formatSuccessRate(health.success_rate)}
          </span>
        {/if}
      </div>
    {/if}
    
    <!-- Actions -->
    <div class="flex items-center gap-1">
      {#if health?.status === ModelStatus.Unavailable && health.fallback_model}
        <button
          on:click={selectFallback}
          class="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          title="Use fallback model: {health.fallback_model}"
        >
          Use Fallback
        </button>
      {/if}
      
      <button
        on:click={checkModelHealth}
        disabled={isChecking}
        class="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
        title="Check model health"
      >
        {isChecking ? '...' : 'Check'}
      </button>
    </div>
  </div>
  
  <!-- Detailed Info (expandable) -->
  {#if showDetails && health}
    <div class="mt-2 pl-6 text-xs text-gray-400 space-y-1">
      {#if health.last_checked}
        <div>Last checked: {new Date(health.last_checked).toLocaleString()}</div>
      {/if}
      
      {#if health.error_messages.length > 0}
        <div class="text-red-400">
          Issues:
          <ul class="ml-2">
            {#each health.error_messages.slice(0, 3) as error}
              <li>• {error}</li>
            {/each}
          </ul>
        </div>
      {/if}
      
      {#if health.capabilities_verified}
        <div class="flex flex-wrap gap-2 mt-1">
          {#if health.capabilities_verified.basic_chat !== undefined}
            <span class="capability-badge" class:capable={health.capabilities_verified.basic_chat}>
              Chat {health.capabilities_verified.basic_chat ? '✓' : '✗'}
            </span>
          {/if}
          {#if health.capabilities_verified.tool_access !== undefined}
            <span class="capability-badge" class:capable={health.capabilities_verified.tool_access}>
              Tools {health.capabilities_verified.tool_access ? '✓' : '✗'}
            </span>
          {/if}
          {#if health.capabilities_verified.mcp_support !== undefined}
            <span class="capability-badge" class:capable={health.capabilities_verified.mcp_support}>
              MCP {health.capabilities_verified.mcp_support ? '✓' : '✗'}
            </span>
          {/if}
          {#if health.capabilities_verified.vision_support !== undefined}
            <span class="capability-badge" class:capable={health.capabilities_verified.vision_support}>
              Vision {health.capabilities_verified.vision_support ? '✓' : '✗'}
            </span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .model-health-indicator {
    padding: 0.5rem;
    border-radius: 0.375rem;
    background: rgba(31, 41, 55, 0.5);
    border: 1px solid rgba(75, 85, 99, 0.3);
  }
  
  .status-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
  }
  
  .capability-badge {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: rgba(55, 65, 81, 0.5);
    color: #9ca3af;
    font-size: 0.65rem;
  }
  
  .capability-badge.capable {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }
</style>