/**
 * Model provider types and configurations
 */

import type { GeminiRequest, DetectedOllamaModel } from './api-types';
import { invoke } from "@tauri-apps/api/core";

export type ModelProvider = 'claude' | 'gemini' | 'ollama';

export interface Model {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  icon?: React.ReactNode;
  contextWindow: number;
  supportsVision?: boolean;
  requiresApiKey?: boolean;
  // Model-specific capabilities
  capabilities?: ModelCapabilities;
  // Default configuration for this model
  defaultConfig?: Partial<ModelConfiguration>;
  // Validation rules for this model
  validation?: ModelValidation;
}

export interface ModelCapabilities {
  streaming?: boolean;
  functionCalling?: boolean;
  systemInstructions?: boolean;
  multimodal?: boolean;
  codeExecution?: boolean;
  webBrowsing?: boolean;
  audioInput?: boolean;
  audioOutput?: boolean;
  maxOutputTokens?: number;
  supportedImageTypes?: string[];
  supportedFileTypes?: string[];
  supportedAudioTypes?: string[];
  // Enhanced characteristics for auto-selection
  intelligence?: number;        // 0-100 reasoning capability
  speed?: number;              // 0-100 response speed  
  codingExcellence?: number;   // 0-100 coding ability
  analysisDepth?: number;      // 0-100 analytical skills
  creativeWriting?: number;    // 0-100 creative capability
  technicalPrecision?: number; // 0-100 technical accuracy
  costPerToken?: number;       // Cost per 1K tokens in USD
  averageResponseTime?: number; // Average response time in ms
  successRate?: number;        // 0-100% success rate
}

export interface ModelConfiguration {
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  systemInstruction?: string;
  responseFormat?: 'text' | 'json' | 'markdown';
}

export interface ModelValidation {
  maxPromptLength?: number;
  maxTemperature?: number;
  minTemperature?: number;
  maxTopK?: number;
  maxTopP?: number;
  minTopP?: number;
}

// Claude models
export const CLAUDE_MODELS: Model[] = [
  {
    id: 'auto',
    name: 'Auto (Smart Selection)',
    provider: 'claude',
    description: 'Claude 4.1 Opus 기반 지능형 모델 선택 - 기본 질문은 Claude 4.1 Opus, 프로젝트 진행시 최적 모델 분배',
    contextWindow: 2097152, // Max available across all models
    supportsVision: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: true,      // Enhanced capabilities
      webBrowsing: true,        // Enhanced capabilities
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      // Supreme auto-selection characteristics with Claude 4.1 Opus as default
      intelligence: 100,         // Maximum intelligence (Claude 4.1 Opus default)
      speed: 90,                // Optimized speed through intelligent routing
      codingExcellence: 100,    // Maximum coding (Claude 4.1 Opus default)
      analysisDepth: 100,       // Maximum analysis depth
      creativeWriting: 98,      // Near-maximum creativity
      technicalPrecision: 100,  // Maximum precision
      costPerToken: 0.050,      // Premium for intelligence (default to best)
      averageResponseTime: 2000, // Slight delay for superior thinking
      successRate: 99.9         // Maximum success rate through Claude 4.1 Opus default
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 10,
      topP: 0.95
    }
  },
  {
    id: 'opus-4.1',
    name: 'Claude 4.1 Opus',
    provider: 'claude',
    description: 'Most intelligent model with best coding performance (August 2025)',
    contextWindow: 200000,
    supportsVision: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: true,
      webBrowsing: true,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      // Supreme supervisor characteristics
      intelligence: 100,         // Highest intelligence - supreme supervisor
      speed: 80,                // Balanced speed for deep thinking
      codingExcellence: 100,    // Best coding performance
      analysisDepth: 100,       // Deepest analysis capability
      creativeWriting: 95,      // Excellent creativity
      technicalPrecision: 100,  // Perfect technical precision
      costPerToken: 0.075,      // Premium pricing for premium intelligence
      averageResponseTime: 2500, // Takes time for deep thinking
      successRate: 99.9         // Highest success rate
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  },
  {
    id: 'sonnet-4',
    name: 'Claude 4 Sonnet',
    provider: 'claude',
    description: 'Balanced performance with superior coding and reasoning (May 2025)',
    contextWindow: 200000,
    supportsVision: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: true,
      webBrowsing: true,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  },
  {
    id: 'sonnet-3.7',
    name: 'Claude 3.7 Sonnet',
    provider: 'claude',
    description: 'Hybrid reasoning model with rapid and thoughtful responses (February 2025)',
    contextWindow: 200000,
    supportsVision: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  },
  {
    id: 'sonnet',
    name: 'Claude 3.5 Sonnet (Legacy)',
    provider: 'claude',
    description: 'Previous generation - will be retired soon',
    contextWindow: 200000,
    supportsVision: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  },
  {
    id: 'opus',
    name: 'Claude 3 Opus (Legacy)',
    provider: 'claude',
    description: 'Legacy model - scheduled for retirement January 2026',
    contextWindow: 200000,
    supportsVision: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  }
];

// Gemini models - only working models with proper status indicators
export const GEMINI_MODELS: Model[] = [
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro ✅',
    provider: 'gemini',
    description: 'Most capable model with deep reasoning and multimodal support (Verified Working)',
    contextWindow: 2097152,
    supportsVision: true,
    requiresApiKey: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 95,
      speed: 80,
      codingExcellence: 92,
      analysisDepth: 95,
      creativeWriting: 90,
      technicalPrecision: 94,
      costPerToken: 0.00125,
      averageResponseTime: 2000,
      successRate: 98.5
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 10,
      topP: 0.95
    },
    validation: {
      maxPromptLength: 2097152,
      maxTemperature: 2.0,
      minTemperature: 0.0,
      maxTopK: 40,
      maxTopP: 1.0,
      minTopP: 0.0
    }
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash ✅',
    provider: 'gemini',
    description: 'Fast and efficient for everyday tasks with excellent performance (Verified Working)',
    contextWindow: 1048576,
    supportsVision: true,
    requiresApiKey: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 85,
      speed: 95,
      codingExcellence: 88,
      analysisDepth: 85,
      creativeWriting: 88,
      technicalPrecision: 90,
      costPerToken: 0.000375,
      averageResponseTime: 1200,
      successRate: 97.8
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 10,
      topP: 0.95
    },
    validation: {
      maxPromptLength: 1048576,
      maxTemperature: 2.0,
      minTemperature: 0.0,
      maxTopK: 40,
      maxTopP: 1.0,
      minTopP: 0.0
    }
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental) ⚗️',
    provider: 'gemini',
    description: 'Experimental 2.0 model with advanced capabilities (Working)',
    contextWindow: 1048576,
    supportsVision: true,
    requiresApiKey: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      audioInput: true,
      audioOutput: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      supportedAudioTypes: ['audio/wav', 'audio/mp3', 'audio/ogg', 'audio/flac'],
      intelligence: 88,
      speed: 90,
      codingExcellence: 90,
      analysisDepth: 87,
      creativeWriting: 85,
      technicalPrecision: 89,
      costPerToken: 0.000375,
      averageResponseTime: 1500,
      successRate: 96.2
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 10,
      topP: 0.95
    },
    validation: {
      maxPromptLength: 1048576,
      maxTemperature: 2.0,
      minTemperature: 0.0,
      maxTopK: 40,
      maxTopP: 1.0,
      minTopP: 0.0
    }
  },
  {
    id: 'gemini-exp-1206',
    name: 'Gemini Experimental 1206 ⚗️',
    provider: 'gemini',
    description: 'Legacy experimental model with extended capabilities (Working)',
    contextWindow: 2097152,
    supportsVision: true,
    requiresApiKey: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 90,
      speed: 75,
      codingExcellence: 85,
      analysisDepth: 88,
      creativeWriting: 87,
      technicalPrecision: 86,
      costPerToken: 0.00125,
      averageResponseTime: 2200,
      successRate: 95.8
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 10,
      topP: 0.95
    },
    validation: {
      maxPromptLength: 2097152,
      maxTemperature: 2.0,
      minTemperature: 0.0,
      maxTopK: 40,
      maxTopP: 1.0,
      minTopP: 0.0
    }
  },
  // Future models with working endpoint mapping
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro 🔄',
    provider: 'gemini',
    description: 'Latest thinking model (maps to 1.5 Pro endpoint until available)',
    contextWindow: 2097152,
    supportsVision: true,
    requiresApiKey: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 100,
      speed: 78,
      codingExcellence: 98,
      analysisDepth: 100,
      creativeWriting: 92,
      technicalPrecision: 96,
      costPerToken: 0.00125, // Uses 1.5-pro pricing
      averageResponseTime: 2000, // Uses 1.5-pro performance
      successRate: 98.5 // Uses 1.5-pro reliability
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 10,
      topP: 0.95
    },
    validation: {
      maxPromptLength: 2097152,
      maxTemperature: 2.0,
      minTemperature: 0.0,
      maxTopK: 40,
      maxTopP: 1.0,
      minTopP: 0.0
    }
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash 🔄',
    provider: 'gemini',
    description: 'Latest fast model (maps to 1.5 Flash endpoint until available)',
    contextWindow: 1048576,
    supportsVision: true,
    requiresApiKey: true,
    capabilities: {
      streaming: true,
      functionCalling: true,
      systemInstructions: true,
      multimodal: true,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 8192,
      supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 90,
      speed: 98,
      codingExcellence: 92,
      analysisDepth: 87,
      creativeWriting: 90,
      technicalPrecision: 92,
      costPerToken: 0.000375, // Uses 1.5-flash pricing
      averageResponseTime: 1200, // Uses 1.5-flash performance  
      successRate: 97.8 // Uses 1.5-flash reliability
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 10,
      topP: 0.95
    },
    validation: {
      maxPromptLength: 1048576,
      maxTemperature: 2.0,
      minTemperature: 0.0,
      maxTopK: 40,
      maxTopP: 1.0,
      minTopP: 0.0
    }
  }
];

// Static fallback Ollama models - will be replaced by dynamic detection
export const STATIC_OLLAMA_MODELS: Model[] = [
  {
    id: 'llama3.3:latest',
    name: 'Llama 3.3 (Latest) 🏠',
    provider: 'ollama',
    description: 'Latest Llama 3.3 model - excellent for coding and reasoning (Local)',
    contextWindow: 131072, // 128K context
    supportsVision: false,
    capabilities: {
      streaming: true,
      functionCalling: false,
      systemInstructions: true,
      multimodal: false,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 4096,
      supportedImageTypes: [],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      // Local model characteristics
      intelligence: 85,          // High intelligence for local model
      speed: 95,                // Very fast local processing
      codingExcellence: 90,     // Excellent coding capabilities
      analysisDepth: 80,        // Good analysis
      creativeWriting: 85,      // Good creativity
      technicalPrecision: 85,   // Good precision
      costPerToken: 0,          // Free local processing
      averageResponseTime: 800, // Fast local response
      successRate: 95           // High local success rate
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  },
  {
    id: 'llama3.2:latest',
    name: 'Llama 3.2 (Latest) 🏠',
    provider: 'ollama',
    description: 'Fast and efficient Llama 3.2 model (Local)',
    contextWindow: 131072,
    supportsVision: false,
    capabilities: {
      streaming: true,
      functionCalling: false,
      systemInstructions: true,
      multimodal: false,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 4096,
      supportedImageTypes: [],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 80,
      speed: 98,
      codingExcellence: 85,
      analysisDepth: 75,
      creativeWriting: 80,
      technicalPrecision: 80,
      costPerToken: 0,
      averageResponseTime: 600,
      successRate: 93
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  },
  {
    id: 'codellama:latest',
    name: 'Code Llama (Latest) 🏠💻',
    provider: 'ollama',
    description: 'Specialized coding model based on Llama',
    contextWindow: 16384,
    supportsVision: false,
    capabilities: {
      streaming: true,
      functionCalling: false,
      systemInstructions: true,
      multimodal: false,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 4096,
      supportedImageTypes: [],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 75,
      speed: 95,
      codingExcellence: 95,    // Specialized for coding
      analysisDepth: 70,
      creativeWriting: 60,
      technicalPrecision: 90,  // High technical precision
      costPerToken: 0,
      averageResponseTime: 700,
      successRate: 90
    },
    defaultConfig: {
      temperature: 0.1, // Lower temperature for coding
      maxOutputTokens: 4096
    }
  },
  {
    id: 'qwen2.5:latest',
    name: 'Qwen 2.5 (Latest) 🏠🌍',
    provider: 'ollama',
    description: 'Advanced Chinese-English bilingual model',
    contextWindow: 32768,
    supportsVision: false,
    capabilities: {
      streaming: true,
      functionCalling: false,
      systemInstructions: true,
      multimodal: false,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 4096,
      supportedImageTypes: [],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 82,
      speed: 90,
      codingExcellence: 85,
      analysisDepth: 85,
      creativeWriting: 90,     // Excellent for creative writing
      technicalPrecision: 80,
      costPerToken: 0,
      averageResponseTime: 900,
      successRate: 92
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  },
  {
    id: 'mistral:latest',
    name: 'Mistral (Latest) 🏠🇪🇺',
    provider: 'ollama',
    description: 'Fast and efficient European model',
    contextWindow: 32768,
    supportsVision: false,
    capabilities: {
      streaming: true,
      functionCalling: false,
      systemInstructions: true,
      multimodal: false,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 4096,
      supportedImageTypes: [],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 78,
      speed: 92,
      codingExcellence: 80,
      analysisDepth: 80,
      creativeWriting: 85,
      technicalPrecision: 85,
      costPerToken: 0,
      averageResponseTime: 750,
      successRate: 91
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  },
  {
    id: 'phi3:latest',
    name: 'Phi-3 (Latest) 🏠🔬',
    provider: 'ollama',
    description: 'Microsoft compact high-performance model',
    contextWindow: 131072,
    supportsVision: false,
    capabilities: {
      streaming: true,
      functionCalling: false,
      systemInstructions: true,
      multimodal: false,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 4096,
      supportedImageTypes: [],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: 83,
      speed: 96,
      codingExcellence: 88,
      analysisDepth: 82,
      creativeWriting: 78,
      technicalPrecision: 88,
      costPerToken: 0,
      averageResponseTime: 650,
      successRate: 94
    },
    defaultConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  }
];

// Dynamic Ollama models - populated at runtime
let DYNAMIC_OLLAMA_MODELS: Model[] = [];

// All available models - dynamically updated
let ALL_MODELS_CACHE: Model[] = [...CLAUDE_MODELS, ...GEMINI_MODELS, ...STATIC_OLLAMA_MODELS];

// Export getter functions for dynamic model access
export const OLLAMA_MODELS = () => DYNAMIC_OLLAMA_MODELS.length > 0 ? DYNAMIC_OLLAMA_MODELS : STATIC_OLLAMA_MODELS;
export const ALL_MODELS = () => ALL_MODELS_CACHE;

// Helper functions
export function getModelById(id: string): Model | undefined {
  return ALL_MODELS().find(model => model.id === id);
}

export function getModelsByProvider(provider: ModelProvider): Model[] {
  return ALL_MODELS().filter(model => model.provider === provider);
}

export function isGeminiModel(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.provider === 'gemini';
}

export function isClaudeModel(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.provider === 'claude';
}

export function isOllamaModel(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.provider === 'ollama';
}

// For backward compatibility with existing code
export function getClaudeModelId(modelId: string): 'sonnet' | 'opus' {
  // Map model IDs to Claude API compatible IDs
  if (modelId === 'sonnet' || modelId === 'opus') return modelId;
  // Default to sonnet for any other model
  return 'sonnet';
}

/**
 * Get model-specific configuration with defaults
 * @param modelId - The model ID
 * @param overrides - Configuration overrides
 * @returns Model configuration with defaults applied
 */
export function getModelConfig(
  modelId: string,
  overrides?: Partial<ModelConfiguration>
): ModelConfiguration {
  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  return {
    ...model.defaultConfig,
    ...overrides
  };
}

/**
 * Convert DetectedOllamaModel to Model interface
 */
function convertDetectedModelToModel(detected: DetectedOllamaModel): Model {
  const sizeGB = Math.round(detected.size / (1024 * 1024 * 1024));
  const description = `${detected.parameter_size} parameters, ${sizeGB}GB - ${getModelDescription(detected)}`;
  
  return {
    id: detected.id,
    name: detected.name,
    provider: 'ollama',
    description,
    contextWindow: detected.capabilities.context_window,
    supportsVision: detected.capabilities.supports_vision,
    capabilities: {
      streaming: true,
      functionCalling: false,
      systemInstructions: true,
      multimodal: detected.capabilities.supports_vision,
      codeExecution: false,
      webBrowsing: false,
      maxOutputTokens: 4096,
      supportedImageTypes: detected.capabilities.supports_vision ? 
        ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] : [],
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown'],
      intelligence: detected.capabilities.intelligence,
      speed: detected.capabilities.speed,
      codingExcellence: detected.capabilities.coding_excellence,
      analysisDepth: detected.capabilities.analysis_depth,
      creativeWriting: detected.capabilities.creative_writing,
      technicalPrecision: detected.capabilities.technical_precision,
      costPerToken: 0, // Local models are free
      averageResponseTime: getEstimatedResponseTime(detected),
      successRate: getEstimatedSuccessRate(detected)
    },
    defaultConfig: {
      temperature: detected.id.toLowerCase().includes('code') ? 0.1 : 0.7,
      maxOutputTokens: 4096
    }
  };
}

/**
 * Get model description based on detected model info
 */
function getModelDescription(detected: DetectedOllamaModel): string {
  const descriptions = [];
  
  if (detected.capabilities.supports_vision) {
    descriptions.push('Vision-enabled');
  }
  
  if (detected.id.toLowerCase().includes('code')) {
    descriptions.push('Specialized for coding');
  }
  
  if (detected.capabilities.intelligence >= 90) {
    descriptions.push('High intelligence');
  } else if (detected.capabilities.intelligence >= 80) {
    descriptions.push('Good intelligence');
  }
  
  if (detected.capabilities.speed >= 95) {
    descriptions.push('Very fast');
  } else if (detected.capabilities.speed >= 85) {
    descriptions.push('Fast');
  }
  
  if (detected.family) {
    descriptions.push(`${detected.family} family`);
  }
  
  return descriptions.length > 0 ? descriptions.join(', ') : 'Local model';
}

/**
 * Estimate response time based on model characteristics
 */
function getEstimatedResponseTime(detected: DetectedOllamaModel): number {
  const sizeGB = detected.size / (1024 * 1024 * 1024);
  let baseTime = 800; // Base time in ms
  
  // Larger models are slower
  if (sizeGB > 50) baseTime += 1200;
  else if (sizeGB > 20) baseTime += 600;
  else if (sizeGB > 10) baseTime += 200;
  
  // Vision models are slower
  if (detected.capabilities.supports_vision) baseTime += 300;
  
  // Adjust for speed capability
  const speedFactor = (100 - detected.capabilities.speed) / 100;
  baseTime += baseTime * speedFactor;
  
  return Math.round(baseTime);
}

/**
 * Estimate success rate based on model characteristics
 */
function getEstimatedSuccessRate(detected: DetectedOllamaModel): number {
  let baseRate = 90; // Base success rate
  
  // Higher intelligence models are more reliable
  if (detected.capabilities.intelligence >= 90) baseRate += 5;
  else if (detected.capabilities.intelligence >= 80) baseRate += 3;
  else if (detected.capabilities.intelligence < 70) baseRate -= 3;
  
  // Known stable families
  if (['llama', 'phi2', 'phi3', 'qwen'].includes(detected.family.toLowerCase())) {
    baseRate += 2;
  }
  
  // Ensure within bounds
  return Math.min(99, Math.max(85, baseRate));
}

/**
 * Detect and load available Ollama models dynamically
 */
export async function loadDynamicOllamaModels(): Promise<Model[]> {
  try {
    console.log('🔍 Detecting available Ollama models...');
    
    const detectedModels: DetectedOllamaModel[] = await invoke('detect_available_ollama_models');
    
    if (!detectedModels || detectedModels.length === 0) {
      console.warn('⚠️ No Ollama models detected. Using static fallback models.');
      return STATIC_OLLAMA_MODELS;
    }
    
    // Convert detected models to Model interface
    const dynamicModels = detectedModels.map(convertDetectedModelToModel);
    
    // Update dynamic models cache
    DYNAMIC_OLLAMA_MODELS = dynamicModels;
    
    // Update all models cache
    ALL_MODELS_CACHE = [...CLAUDE_MODELS, ...GEMINI_MODELS, ...dynamicModels];
    
    console.log(`✅ Successfully loaded ${dynamicModels.length} Ollama models:`, 
      dynamicModels.map(m => `${m.name} (${m.id})`));
    
    return dynamicModels;
    
  } catch (error) {
    console.error('❌ Failed to load dynamic Ollama models:', error);
    console.log('📦 Using static fallback Ollama models');
    
    // Fallback to static models
    DYNAMIC_OLLAMA_MODELS = [];
    ALL_MODELS_CACHE = [...CLAUDE_MODELS, ...GEMINI_MODELS, ...STATIC_OLLAMA_MODELS];
    
    return STATIC_OLLAMA_MODELS;
  }
}

/**
 * Check if a specific Ollama model is available
 */
export async function checkOllamaModelAvailability(modelId: string): Promise<boolean> {
  try {
    const available: boolean = await invoke('check_ollama_model_exists', { modelId });
    return available;
  } catch (error) {
    console.error(`Failed to check Ollama model availability for ${modelId}:`, error);
    return false;
  }
}

/**
 * Get recommended Ollama models for a specific use case
 */
export async function getRecommendedOllamaModels(useCase: 'coding' | 'analysis' | 'creative' | 'fast' | 'vision' | 'balanced'): Promise<Model[]> {
  try {
    const recommended: DetectedOllamaModel[] = await invoke('get_recommended_ollama_models', { useCase });
    return recommended.map(convertDetectedModelToModel);
  } catch (error) {
    console.error(`Failed to get recommended models for ${useCase}:`, error);
    return [];
  }
}

/**
 * Refresh all dynamic models (should be called on app startup or when models change)
 */
export async function refreshDynamicModels(): Promise<void> {
  await loadDynamicOllamaModels();
}

/**
 * Get current model statistics
 */
export function getModelStatistics(): { 
  claude: number; 
  gemini: number; 
  ollama: number; 
  total: number;
  dynamic: boolean;
} {
  const allModels = ALL_MODELS();
  
  return {
    claude: CLAUDE_MODELS.length,
    gemini: GEMINI_MODELS.length,
    ollama: OLLAMA_MODELS().length,
    total: allModels.length,
    dynamic: DYNAMIC_OLLAMA_MODELS.length > 0
  };
}

/**
 * Validate model configuration against model-specific rules
 * @param modelId - The model ID
 * @param config - Configuration to validate
 * @returns Validation result with any errors
 */
export function validateModelConfig(
  modelId: string,
  config: Partial<ModelConfiguration>
): { valid: boolean; errors: string[] } {
  const model = getModelById(modelId);
  if (!model) {
    return { valid: false, errors: [`Unknown model: ${modelId}`] };
  }

  const errors: string[] = [];
  const validation = model.validation;

  if (!validation) {
    return { valid: true, errors: [] };
  }

  // Validate temperature
  if (config.temperature !== undefined) {
    if (validation.minTemperature !== undefined && config.temperature < validation.minTemperature) {
      errors.push(`Temperature must be at least ${validation.minTemperature}`);
    }
    if (validation.maxTemperature !== undefined && config.temperature > validation.maxTemperature) {
      errors.push(`Temperature must be at most ${validation.maxTemperature}`);
    }
  }

  // Validate topK
  if (config.topK !== undefined && validation.maxTopK !== undefined) {
    if (config.topK < 1 || config.topK > validation.maxTopK) {
      errors.push(`Top-K must be between 1 and ${validation.maxTopK}`);
    }
  }

  // Validate topP
  if (config.topP !== undefined) {
    if (validation.minTopP !== undefined && config.topP < validation.minTopP) {
      errors.push(`Top-P must be at least ${validation.minTopP}`);
    }
    if (validation.maxTopP !== undefined && config.topP > validation.maxTopP) {
      errors.push(`Top-P must be at most ${validation.maxTopP}`);
    }
  }

  // Validate max output tokens
  if (config.maxOutputTokens !== undefined) {
    const maxAllowed = model.capabilities?.maxOutputTokens || 8192;
    if (config.maxOutputTokens < 1 || config.maxOutputTokens > maxAllowed) {
      errors.push(`Max output tokens must be between 1 and ${maxAllowed}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a model supports a specific capability
 * @param modelId - The model ID
 * @param capability - The capability to check
 * @returns Whether the model supports the capability
 */
export function modelSupports(
  modelId: string,
  capability: keyof ModelCapabilities
): boolean {
  const model = getModelById(modelId);
  if (!model || !model.capabilities) {
    return false;
  }

  return model.capabilities[capability] === true;
}

/**
 * Get supported file types for a model
 * @param modelId - The model ID
 * @returns Array of supported MIME types
 */
export function getSupportedFileTypes(modelId: string): string[] {
  const model = getModelById(modelId);
  if (!model || !model.capabilities) {
    return [];
  }

  const types: string[] = [];
  
  if (model.capabilities.supportedImageTypes) {
    types.push(...model.capabilities.supportedImageTypes);
  }
  
  if (model.capabilities.supportedFileTypes) {
    types.push(...model.capabilities.supportedFileTypes);
  }

  return types;
}

/**
 * Convert a generic model config to Gemini-specific request parameters
 * @param config - Generic model configuration
 * @returns Gemini request parameters
 */
export function toGeminiRequestParams(
  config: ModelConfiguration
): Partial<GeminiRequest> {
  return {
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    topK: config.topK,
    topP: config.topP,
    stopSequences: config.stopSequences,
    systemInstruction: config.systemInstruction
  };
}