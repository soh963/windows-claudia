/**
 * Dynamic Ollama model management
 */

import { invoke } from '@tauri-apps/api/core';
import type { Model, ModelCapabilities } from './models';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * Check if Ollama is running
 */
export async function checkOllamaStatus(): Promise<boolean> {
  try {
    return await invoke('check_ollama_status');
  } catch (error) {
    console.error('Failed to check Ollama status:', error);
    return false;
  }
}

/**
 * Get all available Ollama models
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
  try {
    const models = await invoke<OllamaModel[]>('get_ollama_models');
    return models || [];
  } catch (error) {
    console.error('Failed to get Ollama models:', error);
    return [];
  }
}

/**
 * Convert Ollama model to our Model interface
 */
export function ollamaModelToModel(ollamaModel: OllamaModel): Model {
  // Extract base model info from name
  const modelName = ollamaModel.name;
  const [baseName, tag] = modelName.split(':');
  
  // Determine capabilities based on model family
  const isCodeModel = baseName.toLowerCase().includes('code') || 
                       baseName.toLowerCase().includes('deepseek') ||
                       baseName.toLowerCase().includes('starcoder');
  
  const isVisionModel = baseName.toLowerCase().includes('vision') ||
                        baseName.toLowerCase().includes('llava') ||
                        baseName.toLowerCase().includes('bakllava');
  
  // Extract parameter size if available
  const paramSize = ollamaModel.details?.parameter_size || 'Unknown';
  
  const capabilities: ModelCapabilities = {
    streaming: true,
    functionCalling: false, // Most Ollama models don't support function calling natively
    systemInstructions: true,
    multimodal: isVisionModel,
    codeExecution: false,
    webBrowsing: false,
    maxOutputTokens: 4096, // Default for most models
    supportedImageTypes: isVisionModel ? ['image/png', 'image/jpeg', 'image/webp'] : [],
    supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
    // Local model characteristics - adjust based on model size
    intelligence: estimateIntelligence(baseName, paramSize),
    speed: 95, // Local models are fast
    codingExcellence: isCodeModel ? 90 : 70,
    analysisDepth: 75,
    creativeWriting: 70,
    technicalPrecision: isCodeModel ? 85 : 75,
    costPerToken: 0, // Free local processing
    averageResponseTime: 500, // Fast local response
    successRate: 95 // High local success rate
  };
  
  return {
    id: modelName,
    name: `${formatModelName(baseName)} (${tag || 'latest'}) 🏠`,
    provider: 'ollama',
    description: `Local ${baseName} model - ${paramSize} parameters`,
    contextWindow: estimateContextWindow(baseName),
    supportsVision: isVisionModel,
    requiresApiKey: false,
    capabilities,
    defaultConfig: {
      temperature: isCodeModel ? 0.1 : 0.7,
      maxOutputTokens: 4096
    }
  };
}

/**
 * Format model name for display
 */
function formatModelName(name: string): string {
  // Common model name formatting
  const formatted = name
    .replace(/llama/gi, 'Llama')
    .replace(/mistral/gi, 'Mistral')
    .replace(/codellama/gi, 'Code Llama')
    .replace(/deepseek/gi, 'DeepSeek')
    .replace(/phi/gi, 'Phi')
    .replace(/qwen/gi, 'Qwen')
    .replace(/gemma/gi, 'Gemma')
    .replace(/vicuna/gi, 'Vicuna')
    .replace(/wizardlm/gi, 'WizardLM')
    .replace(/starcoder/gi, 'StarCoder')
    .replace(/llava/gi, 'LLaVA')
    .replace(/bakllava/gi, 'BakLLaVA');
  
  return formatted;
}

/**
 * Estimate intelligence score based on model name and size
 */
function estimateIntelligence(baseName: string, paramSize: string): number {
  const name = baseName.toLowerCase();
  
  // Extract parameter count if possible
  const sizeMatch = paramSize.match(/(\d+(?:\.\d+)?)\s*[bB]/);
  const paramBillions = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
  
  // Base intelligence on model family and size
  if (name.includes('llama3.3') || name.includes('llama-3.3')) return 85;
  if (name.includes('llama3.2') || name.includes('llama-3.2')) return 80;
  if (name.includes('llama3.1') || name.includes('llama-3.1')) return 82;
  if (name.includes('llama3') || name.includes('llama-3')) return 78;
  if (name.includes('llama2') || name.includes('llama-2')) return 75;
  if (name.includes('mistral') && paramBillions >= 70) return 88;
  if (name.includes('mistral')) return 82;
  if (name.includes('mixtral')) return 86;
  if (name.includes('qwen2.5')) return 83;
  if (name.includes('qwen2')) return 80;
  if (name.includes('qwen')) return 78;
  if (name.includes('deepseek')) return 85;
  if (name.includes('phi')) return 70;
  if (name.includes('gemma2')) return 77;
  if (name.includes('gemma')) return 72;
  
  // Default based on size
  if (paramBillions >= 70) return 85;
  if (paramBillions >= 30) return 80;
  if (paramBillions >= 13) return 75;
  if (paramBillions >= 7) return 70;
  return 65;
}

/**
 * Estimate context window based on model
 */
function estimateContextWindow(baseName: string): number {
  const name = baseName.toLowerCase();
  
  // Known context windows
  if (name.includes('llama3.3')) return 131072; // 128K
  if (name.includes('llama3.2')) return 131072; // 128K
  if (name.includes('llama3.1')) return 131072; // 128K
  if (name.includes('llama3')) return 8192;
  if (name.includes('llama2')) return 4096;
  if (name.includes('mistral')) return 32768; // 32K
  if (name.includes('mixtral')) return 32768; // 32K
  if (name.includes('qwen2.5')) return 131072; // 128K
  if (name.includes('qwen2')) return 32768;
  if (name.includes('qwen')) return 8192;
  if (name.includes('deepseek')) return 32768;
  if (name.includes('phi')) return 4096;
  if (name.includes('gemma')) return 8192;
  if (name.includes('codellama')) return 16384;
  
  // Default
  return 4096;
}

/**
 * Load all available Ollama models dynamically
 */
export async function loadDynamicOllamaModels(): Promise<Model[]> {
  const isRunning = await checkOllamaStatus();
  if (!isRunning) {
    console.log('Ollama is not running, skipping model loading');
    return [];
  }
  
  const ollamaModels = await getOllamaModels();
  console.log(`Found ${ollamaModels.length} Ollama models`);
  
  return ollamaModels.map(ollamaModelToModel);
}