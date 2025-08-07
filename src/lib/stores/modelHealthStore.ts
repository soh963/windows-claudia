import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/tauri';

export enum ModelStatus {
  Available = 'Available',
  Degraded = 'Degraded',
  Unavailable = 'Unavailable',
  Deprecated = 'Deprecated',
  Unknown = 'Unknown',
}

export interface ModelHealth {
  model_id: string;
  provider: string;
  status: ModelStatus;
  last_checked: string;
  last_success?: string;
  consecutive_failures: number;
  average_response_time_ms?: number;
  success_rate: number;
  error_messages: string[];
  capabilities_verified: ModelCapabilityStatus;
  fallback_model?: string;
}

export interface ModelCapabilityStatus {
  basic_chat?: boolean;
  tool_access?: boolean;
  mcp_support?: boolean;
  agent_support?: boolean;
  slash_commands?: boolean;
  vision_support?: boolean;
  audio_support?: boolean;
  session_management?: boolean;
}

export interface ValidationSummary {
  timestamp: string;
  total_models_tested: number;
  working_models: ModelSummary[];
  degraded_models: ModelSummary[];
  broken_models: ModelSummary[];
  deprecated_models: ModelSummary[];
  overall_health_score: number;
  recommendations: string[];
}

export interface ModelSummary {
  model_id: string;
  provider: string;
  status: ModelStatus;
  issues: string[];
  fallback_available: boolean;
  fallback_model?: string;
}

interface ModelHealthState {
  healthData: Map<string, ModelHealth>;
  lastValidation?: ValidationSummary;
  isValidating: boolean;
  error?: string;
}

function createModelHealthStore() {
  const { subscribe, set, update } = writable<ModelHealthState>({
    healthData: new Map(),
    isValidating: false,
  });

  let healthCheckInterval: NodeJS.Timeout | null = null;

  return {
    subscribe,

    // Initialize store and start periodic health checks
    async init() {
      // Load initial health data
      await this.quickHealthCheck();
      
      // Set up periodic health checks (every 5 minutes for quick check)
      healthCheckInterval = setInterval(() => {
        this.quickHealthCheck();
      }, 5 * 60 * 1000);

      // Do a comprehensive check on startup if needed
      const needsFullCheck = await this.needsComprehensiveCheck();
      if (needsFullCheck) {
        setTimeout(() => {
          this.runComprehensiveValidation();
        }, 5000); // Delay initial comprehensive check
      }
    },

    // Quick health check for UI updates
    async quickHealthCheck() {
      try {
        const statusMap = await invoke<Record<string, ModelStatus>>('quick_model_health_check');
        
        update(state => {
          const newHealthData = new Map<string, ModelHealth>();
          
          for (const [modelId, status] of Object.entries(statusMap)) {
            const existing = state.healthData.get(modelId);
            newHealthData.set(modelId, {
              model_id: modelId,
              provider: this.getProviderForModel(modelId),
              status,
              last_checked: existing?.last_checked || new Date().toISOString(),
              last_success: existing?.last_success,
              consecutive_failures: existing?.consecutive_failures || 0,
              average_response_time_ms: existing?.average_response_time_ms,
              success_rate: existing?.success_rate || 0,
              error_messages: existing?.error_messages || [],
              capabilities_verified: existing?.capabilities_verified || {},
              fallback_model: existing?.fallback_model,
            });
          }
          
          return {
            ...state,
            healthData: newHealthData,
            error: undefined,
          };
        });
      } catch (error) {
        console.error('Failed to perform quick health check:', error);
        update(state => ({
          ...state,
          error: `Health check failed: ${error}`,
        }));
      }
    },

    // Run comprehensive validation of all models
    async runComprehensiveValidation() {
      update(state => ({ ...state, isValidating: true, error: undefined }));
      
      try {
        const summary = await invoke<ValidationSummary>('validate_all_models_comprehensive');
        
        // Update health data from validation results
        const newHealthData = new Map<string, ModelHealth>();
        
        // Process all model summaries
        const allModels = [
          ...summary.working_models,
          ...summary.degraded_models,
          ...summary.broken_models,
          ...summary.deprecated_models,
        ];
        
        for (const model of allModels) {
          // Get detailed health data for each model
          try {
            const health = await invoke<ModelHealth | null>('get_model_health_status', {
              modelId: model.model_id,
            });
            
            if (health) {
              newHealthData.set(model.model_id, health);
            }
          } catch (err) {
            console.warn(`Failed to get health for ${model.model_id}:`, err);
          }
        }
        
        update(state => ({
          ...state,
          healthData: newHealthData,
          lastValidation: summary,
          isValidating: false,
          error: undefined,
        }));
        
        // Show notifications for critical issues
        if (summary.broken_models.length > 0) {
          this.notifyBrokenModels(summary.broken_models);
        }
        
        return summary;
      } catch (error) {
        console.error('Comprehensive validation failed:', error);
        update(state => ({
          ...state,
          isValidating: false,
          error: `Validation failed: ${error}`,
        }));
        throw error;
      }
    },

    // Validate a specific model on demand
    async validateModel(modelId: string, provider: string) {
      try {
        const report = await invoke('validate_model_on_demand', {
          modelId,
          provider,
        });
        
        // Update health data for this model
        await this.quickHealthCheck();
        
        return report;
      } catch (error) {
        console.error(`Failed to validate ${modelId}:`, error);
        throw error;
      }
    },

    // Check if a model is available
    async isModelAvailable(modelId: string): Promise<boolean> {
      try {
        return await invoke<boolean>('is_model_available', { modelId });
      } catch (error) {
        console.error(`Failed to check availability for ${modelId}:`, error);
        return false;
      }
    },

    // Get fallback model for a failed model
    async getFallbackModel(modelId: string, provider: string): Promise<string | null> {
      try {
        return await invoke<string | null>('get_fallback_model', {
          modelId,
          provider,
        });
      } catch (error) {
        console.error(`Failed to get fallback for ${modelId}:`, error);
        return null;
      }
    },

    // Get list of healthy models
    async getHealthyModels(): Promise<string[]> {
      try {
        return await invoke<string[]>('get_healthy_models');
      } catch (error) {
        console.error('Failed to get healthy models:', error);
        return [];
      }
    },

    // Check if comprehensive validation is needed
    async needsComprehensiveCheck(): Promise<boolean> {
      const state = await new Promise<ModelHealthState>(resolve => {
        const unsubscribe = subscribe(resolve);
        unsubscribe();
      });
      
      // Need check if no validation data or it's been more than 30 minutes
      if (!state.lastValidation) return true;
      
      const lastCheck = new Date(state.lastValidation.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastCheck.getTime()) / (1000 * 60);
      
      return diffMinutes > 30;
    },

    // Helper to determine provider from model ID
    getProviderForModel(modelId: string): string {
      if (modelId.includes('opus') || modelId.includes('sonnet')) {
        return 'claude';
      } else if (modelId.includes('gemini')) {
        return 'gemini';
      } else {
        return 'ollama';
      }
    },

    // Notify user about broken models
    notifyBrokenModels(brokenModels: ModelSummary[]) {
      // This would integrate with your notification system
      console.warn('The following models are broken:', brokenModels.map(m => m.model_id));
      
      // You could emit an event or update a notification store here
      for (const model of brokenModels) {
        console.warn(`${model.model_id}: ${model.issues.join(', ')}`);
        if (model.fallback_available && model.fallback_model) {
          console.info(`  → Fallback available: ${model.fallback_model}`);
        }
      }
    },

    // Clean up intervals on destroy
    destroy() {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
    },
  };
}

export const modelHealthStore = createModelHealthStore();

// Derived store for easy access to model statuses
export const modelStatuses = derived(
  modelHealthStore,
  $store => {
    const statuses: Record<string, ModelStatus> = {};
    $store.healthData.forEach((health, modelId) => {
      statuses[modelId] = health.status;
    });
    return statuses;
  }
);

// Derived store for healthy models only
export const healthyModels = derived(
  modelHealthStore,
  $store => {
    const healthy: string[] = [];
    $store.healthData.forEach((health, modelId) => {
      if (health.status === ModelStatus.Available) {
        healthy.push(modelId);
      }
    });
    return healthy;
  }
);

// Derived store for validation summary
export const validationSummary = derived(
  modelHealthStore,
  $store => $store.lastValidation
);