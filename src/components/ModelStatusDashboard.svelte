<script lang="ts">
  import { onMount } from 'svelte';
  import { modelHealthStore, validationSummary, ModelStatus } from '$lib/stores/modelHealthStore';
  import { ALL_MODELS } from '$lib/models';
  import ModelHealthIndicator from './ModelHealthIndicator.svelte';
  
  let isValidating = false;
  let showDashboard = false;
  let selectedProvider: 'all' | 'claude' | 'gemini' | 'ollama' = 'all';
  
  $: filteredModels = selectedProvider === 'all' 
    ? ALL_MODELS 
    : ALL_MODELS.filter(m => m.provider === selectedProvider);
  
  $: healthScore = $validationSummary?.overall_health_score ?? 0;
  $: healthScoreClass = getHealthScoreClass(healthScore);
  
  function getHealthScoreClass(score: number) {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  }
  
  async function runValidation() {
    if (isValidating) return;
    
    isValidating = true;
    try {
      await modelHealthStore.runComprehensiveValidation();
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      isValidating = false;
    }
  }
  
  function toggleDashboard() {
    showDashboard = !showDashboard;
  }
  
  onMount(() => {
    // Initialize health monitoring
    modelHealthStore.init();
  });
</script>

<div class="model-status-dashboard">
  <!-- Dashboard Header -->
  <div class="dashboard-header">
    <div class="flex items-center justify-between">
      <button
        on:click={toggleDashboard}
        class="flex items-center gap-2 text-sm font-medium hover:text-blue-400 transition-colors"
      >
        <span class="text-lg">{showDashboard ? '▼' : '▶'}</span>
        Model Health Dashboard
        {#if healthScore > 0}
          <span class="health-score {healthScoreClass}">
            {healthScore.toFixed(0)}%
          </span>
        {/if}
      </button>
      
      <button
        on:click={runValidation}
        disabled={isValidating || $modelHealthStore.isValidating}
        class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isValidating || $modelHealthStore.isValidating ? 'Validating...' : 'Run Full Validation'}
      </button>
    </div>
  </div>
  
  {#if showDashboard}
    <div class="dashboard-content mt-4">
      <!-- Provider Filter -->
      <div class="flex gap-2 mb-4">
        <button
          on:click={() => selectedProvider = 'all'}
          class="px-3 py-1 text-sm rounded transition-colors"
          class:active-filter={selectedProvider === 'all'}
        >
          All Providers
        </button>
        <button
          on:click={() => selectedProvider = 'claude'}
          class="px-3 py-1 text-sm rounded transition-colors"
          class:active-filter={selectedProvider === 'claude'}
        >
          Claude
        </button>
        <button
          on:click={() => selectedProvider = 'gemini'}
          class="px-3 py-1 text-sm rounded transition-colors"
          class:active-filter={selectedProvider === 'gemini'}
        >
          Gemini
        </button>
        <button
          on:click={() => selectedProvider = 'ollama'}
          class="px-3 py-1 text-sm rounded transition-colors"
          class:active-filter={selectedProvider === 'ollama'}
        >
          Ollama
        </button>
      </div>
      
      <!-- Summary Stats -->
      {#if $validationSummary}
        <div class="summary-stats grid grid-cols-4 gap-3 mb-4">
          <div class="stat-card">
            <div class="stat-value text-green-500">
              {$validationSummary.working_models.length}
            </div>
            <div class="stat-label">Working</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-yellow-500">
              {$validationSummary.degraded_models.length}
            </div>
            <div class="stat-label">Degraded</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-red-500">
              {$validationSummary.broken_models.length}
            </div>
            <div class="stat-label">Broken</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-orange-500">
              {$validationSummary.deprecated_models.length}
            </div>
            <div class="stat-label">Deprecated</div>
          </div>
        </div>
        
        <!-- Recommendations -->
        {#if $validationSummary.recommendations.length > 0}
          <div class="recommendations mb-4">
            <h4 class="text-sm font-medium mb-2">Recommendations:</h4>
            <ul class="text-xs text-gray-400 space-y-1">
              {#each $validationSummary.recommendations as recommendation}
                <li>• {recommendation}</li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}
      
      <!-- Model List -->
      <div class="model-list space-y-2">
        <h4 class="text-sm font-medium mb-2">Model Status:</h4>
        {#each filteredModels as model}
          <ModelHealthIndicator 
            {model} 
            showDetails={true}
            onFallbackSelect={(modelId) => {
              // Handle fallback selection
              console.log('Selected fallback:', modelId);
            }}
          />
        {/each}
      </div>
      
      <!-- Error Display -->
      {#if $modelHealthStore.error}
        <div class="error-message mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-sm text-red-400">
          {$modelHealthStore.error}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .model-status-dashboard {
    background: rgba(17, 24, 39, 0.95);
    border: 1px solid rgba(55, 65, 81, 0.5);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .dashboard-header {
    border-bottom: 1px solid rgba(55, 65, 81, 0.5);
    padding-bottom: 0.75rem;
  }
  
  .health-score {
    font-weight: bold;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: rgba(0, 0, 0, 0.3);
  }
  
  .active-filter {
    background: rgba(59, 130, 246, 0.5);
    color: white;
  }
  
  .active-filter:hover {
    background: rgba(59, 130, 246, 0.6);
  }
  
  button:not(.active-filter) {
    background: rgba(55, 65, 81, 0.5);
    color: #9ca3af;
  }
  
  button:not(.active-filter):hover {
    background: rgba(75, 85, 99, 0.5);
    color: #d1d5db;
  }
  
  .stat-card {
    background: rgba(31, 41, 55, 0.5);
    border: 1px solid rgba(55, 65, 81, 0.5);
    border-radius: 0.375rem;
    padding: 0.75rem;
    text-align: center;
  }
  
  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 0.25rem;
  }
  
  .recommendations {
    background: rgba(31, 41, 55, 0.5);
    border: 1px solid rgba(55, 65, 81, 0.5);
    border-radius: 0.375rem;
    padding: 0.75rem;
  }
</style>