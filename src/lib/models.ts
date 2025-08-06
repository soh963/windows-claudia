/**
 * Model provider types and configurations
 */

import type { GeminiRequest } from './api-types';

export type ModelProvider = 'claude' | 'gemini';

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
    description: 'Automatically selects the best model: Claude for intelligence, Gemini for large context',
    contextWindow: 2097152, // Max available (Gemini's context)
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
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
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

// Gemini models - using supported models according to API
export const GEMINI_MODELS: Model[] = [
  {
          id: 'gemini-1.5-pro',
    name: 'Gemini 2.5 Pro (Experimental)',
    provider: 'gemini',
    description: 'State-of-the-art thinking model with enhanced reasoning capabilities (2025)',
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
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
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
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Fast thinking model ideal for everyday tasks with improved performance (2025)',
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
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
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
    id: 'gemini-2.0-pro-exp',
    name: 'Gemini 2.0 Pro (Experimental)',
    provider: 'gemini',
    description: 'Best coding performance and complex prompts with enhanced capabilities',
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
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
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
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash (Stable)',
    provider: 'gemini',
    description: 'Production-ready with next-gen features, native tool use, and 1M context',
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
      supportedAudioTypes: ['audio/wav', 'audio/mp3', 'audio/ogg', 'audio/flac']
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
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    provider: 'gemini',
    description: 'Most cost-efficient model for high-volume tasks (Public Preview)',
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
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
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
    name: 'Gemini 2.0 Flash (Experimental - Legacy)',
    provider: 'gemini',
    description: 'Legacy experimental version - use stable Gemini 2.0 Flash instead',
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
      supportedAudioTypes: ['audio/wav', 'audio/mp3', 'audio/ogg', 'audio/flac']
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
    name: 'Gemini Experimental 1206 (Legacy)',
    provider: 'gemini',
    description: 'Legacy experimental model - consider using newer 2.5 models',
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
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
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
    id: 'gemini-1.5-pro-002',
    name: 'Gemini 1.5 Pro (Legacy)',
    provider: 'gemini',
    description: 'Legacy stable model - consider upgrading to 2.5 Pro',
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
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
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
    id: 'gemini-1.5-flash-002',
    name: 'Gemini 1.5 Flash (Legacy)',
    provider: 'gemini',
    description: 'Legacy fast model - consider upgrading to 2.5 Flash',
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
      supportedFileTypes: ['text/plain', 'application/json', 'text/markdown']
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

// All available models
export const ALL_MODELS: Model[] = [...CLAUDE_MODELS, ...GEMINI_MODELS];

// Helper functions
export function getModelById(id: string): Model | undefined {
  return ALL_MODELS.find(model => model.id === id);
}

export function getModelsByProvider(provider: ModelProvider): Model[] {
  return ALL_MODELS.filter(model => model.provider === provider);
}

export function isGeminiModel(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.provider === 'gemini';
}

export function isClaudeModel(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.provider === 'claude';
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