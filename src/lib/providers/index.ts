/**
 * AI Provider abstraction layer
 * 
 * This module provides a unified interface for interacting with different AI providers
 * like Claude and Gemini, ensuring consistent behavior and error handling.
 */

import type {
  AIProvider,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  GeminiRequest,
  GeminiResponse,
  GeminiError,
  GeminiErrorCode
} from '../api-types';
import { api } from '../api';
import { isGeminiError } from '../api-types';

/**
 * Base class for AI providers
 */
export abstract class BaseAIProvider implements AIProvider {
  constructor(public name: string) {}

  abstract execute(request: AIRequest): Promise<AIResponse>;
  abstract validateConfig(): Promise<boolean>;
  
  // Optional streaming support
  async *stream?(request: AIRequest): AsyncIterable<AIStreamChunk> {
    throw new Error(`Streaming not supported by ${this.name} provider`);
  }
}

/**
 * Claude AI provider implementation
 */
export class ClaudeProvider extends BaseAIProvider {
  constructor() {
    super('Claude');
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    // For now, Claude execution goes through the existing API
    // This is a placeholder for future unified implementation
    throw new Error('Claude provider direct execution not yet implemented');
  }

  async validateConfig(): Promise<boolean> {
    // Claude doesn't require API key configuration in the app
    return true;
  }
}

/**
 * Gemini AI provider implementation
 */
export class GeminiProvider extends BaseAIProvider {
  constructor() {
    super('Gemini');
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    // Transform unified request to Gemini-specific format
    const geminiRequest: Partial<GeminiRequest> = {
      prompt: request.prompt,
      model: request.model,
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      systemInstruction: request.systemPrompt
    };

    // For now, we use the existing API method
    // In the future, this could make direct API calls
    throw new Error('Gemini provider direct execution not yet implemented');
  }

  async validateConfig(): Promise<boolean> {
    const result = await api.validateGeminiConfig();
    return result.isValid;
  }

  /**
   * Transform Gemini response to unified format
   */
  private transformResponse(response: GeminiResponse, model: string): AIResponse {
    const candidate = response.candidates[0];
    const textPart = candidate.content.parts.find(part => 'text' in part);
    
    return {
      content: textPart ? (textPart as any).text : '',
      model,
      finishReason: candidate.finishReason,
      usage: response.usageMetadata ? {
        inputTokens: response.usageMetadata.promptTokenCount || 0,
        outputTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0,
        cachedTokens: response.usageMetadata.cachedContentTokenCount
      } : undefined,
      metadata: {
        safetyRatings: candidate.safetyRatings,
        citationMetadata: candidate.citationMetadata
      }
    };
  }
}

/**
 * Provider factory and registry
 */
export class ProviderRegistry {
  private static providers = new Map<string, AIProvider>();

  static {
    // Register default providers
    this.register('claude', new ClaudeProvider());
    this.register('gemini', new GeminiProvider());
  }

  /**
   * Register a new AI provider
   */
  static register(name: string, provider: AIProvider): void {
    this.providers.set(name.toLowerCase(), provider);
  }

  /**
   * Get a provider by name
   */
  static getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  /**
   * Get all registered providers
   */
  static getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check if a provider is registered
   */
  static hasProvider(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }
}

/**
 * Unified AI client that delegates to specific providers
 */
export class UnifiedAIClient {
  /**
   * Execute a request using the appropriate provider
   */
  static async execute(
    provider: string,
    request: AIRequest
  ): Promise<AIResponse> {
    const aiProvider = ProviderRegistry.getProvider(provider);
    if (!aiProvider) {
      throw new Error(`Unknown AI provider: ${provider}`);
    }

    // Validate configuration before executing
    const isValid = await aiProvider.validateConfig();
    if (!isValid) {
      throw new Error(`${provider} provider configuration is invalid`);
    }

    return aiProvider.execute(request);
  }

  /**
   * Stream a response using the appropriate provider
   */
  static async *stream(
    provider: string,
    request: AIRequest
  ): AsyncIterable<AIStreamChunk> {
    const aiProvider = ProviderRegistry.getProvider(provider);
    if (!aiProvider) {
      throw new Error(`Unknown AI provider: ${provider}`);
    }

    if (!aiProvider.stream) {
      throw new Error(`${provider} provider does not support streaming`);
    }

    // Validate configuration before streaming
    const isValid = await aiProvider.validateConfig();
    if (!isValid) {
      throw new Error(`${provider} provider configuration is invalid`);
    }

    yield* aiProvider.stream(request);
  }

  /**
   * Validate provider configuration
   */
  static async validateProvider(provider: string): Promise<boolean> {
    const aiProvider = ProviderRegistry.getProvider(provider);
    if (!aiProvider) {
      return false;
    }

    return aiProvider.validateConfig();
  }
}