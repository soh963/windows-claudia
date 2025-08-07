// ============================================================================
// Type Guards and Validators
// ============================================================================

/**
 * Type guard to check if an error is a known API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof (error as any).code === 'string' &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Type guard for Gemini-specific errors
 */
export function isGeminiError(error: unknown): error is GeminiError {
  return isApiError(error) && error.code.startsWith('GEMINI_');
}

// ============================================================================
// Error Types and Hierarchies
// ============================================================================

/**
 * Base error class for all API errors
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Gemini-specific error class
 */
export class GeminiError extends ApiError {
  constructor(
    code: GeminiErrorCode,
    message: string,
    public status?: number,
    details?: unknown
  ) {
    super(code, message, details);
    this.name = 'GeminiError';
  }
}

/**
 * Gemini error codes
 */
export enum GeminiErrorCode {
  API_KEY_MISSING = 'GEMINI_API_KEY_MISSING',
  API_KEY_INVALID = 'GEMINI_API_KEY_INVALID',
  MODEL_NOT_SUPPORTED = 'GEMINI_MODEL_NOT_SUPPORTED',
  SAFETY_FILTER_BLOCKED = 'GEMINI_SAFETY_FILTER_BLOCKED',
  QUOTA_EXCEEDED = 'GEMINI_QUOTA_EXCEEDED',
  REQUEST_TIMEOUT = 'GEMINI_REQUEST_TIMEOUT',
  NETWORK_ERROR = 'GEMINI_NETWORK_ERROR',
  RESPONSE_PARSE_ERROR = 'GEMINI_RESPONSE_PARSE_ERROR',
  UNKNOWN_ERROR = 'GEMINI_UNKNOWN_ERROR'
}

// ============================================================================
// Gemini-specific Types
// ============================================================================

/**
 * Gemini API configuration
 */
export interface GeminiConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Gemini request parameters
 */
export interface GeminiRequest {
  prompt: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  systemInstruction?: string;
  tools?: GeminiTool[];
}

/**
 * Gemini tool definition for function calling
 */
export interface GeminiTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * Gemini response structure
 */
export interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
}

/**
 * Gemini response candidate
 */
export interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: GeminiFinishReason;
  safetyRatings?: GeminiSafetyRating[];
  citationMetadata?: GeminiCitationMetadata;
}

/**
 * Gemini content structure
 */
export interface GeminiContent {
  parts: GeminiPart[];
  role?: 'user' | 'model';
}

/**
 * Gemini content part
 */
export type GeminiPart = 
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, any> } }
  | { functionResponse: { name: string; response: any } };

/**
 * Gemini finish reasons
 */
export type GeminiFinishReason = 
  | 'STOP'
  | 'MAX_TOKENS'
  | 'SAFETY'
  | 'RECITATION'
  | 'OTHER';

/**
 * Gemini safety rating
 */
export interface GeminiSafetyRating {
  category: GeminiSafetyCategory;
  probability: GeminiSafetyProbability;
}

/**
 * Gemini safety categories
 */
export type GeminiSafetyCategory =
  | 'HARM_CATEGORY_UNSPECIFIED'
  | 'HARM_CATEGORY_DEROGATORY'
  | 'HARM_CATEGORY_TOXICITY'
  | 'HARM_CATEGORY_VIOLENCE'
  | 'HARM_CATEGORY_SEXUAL'
  | 'HARM_CATEGORY_MEDICAL'
  | 'HARM_CATEGORY_DANGEROUS'
  | 'HARM_CATEGORY_HARASSMENT'
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT';

/**
 * Gemini safety probability levels
 */
export type GeminiSafetyProbability =
  | 'HARM_PROBABILITY_UNSPECIFIED'
  | 'NEGLIGIBLE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH';

/**
 * Gemini usage metadata
 */
export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
}

/**
 * Gemini citation metadata
 */
export interface GeminiCitationMetadata {
  citationSources: GeminiCitationSource[];
}

/**
 * Gemini citation source
 */
export interface GeminiCitationSource {
  startIndex?: number;
  endIndex?: number;
  uri?: string;
  license?: string;
}

/**
 * Gemini streaming response chunk
 */
export interface GeminiStreamChunk {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  error?: GeminiError;
}

// ============================================================================
// Provider Abstraction Types
// ============================================================================

/**
 * Unified AI provider interface
 */
export interface AIProvider {
  name: string;
  execute(request: AIRequest): Promise<AIResponse>;
  stream?(request: AIRequest): AsyncIterable<AIStreamChunk>;
  validateConfig(): Promise<boolean>;
}

/**
 * Unified AI request structure
 */
export interface AIRequest {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: AITool[];
  images?: AIImage[];
  context?: Record<string, any>;
}

/**
 * Unified AI tool definition
 */
export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * Unified AI image input
 */
export interface AIImage {
  data: string; // base64 or URL
  mimeType: string;
}

/**
 * Unified AI response structure
 */
export interface AIResponse {
  content: string;
  model: string;
  finishReason?: string;
  usage?: AIUsage;
  tools?: AIToolCall[];
  metadata?: Record<string, any>;
}

/**
 * Unified AI usage metrics
 */
export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  cost?: number;
}

/**
 * Unified AI tool call
 */
export interface AIToolCall {
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

/**
 * Unified AI streaming chunk
 */
export interface AIStreamChunk {
  delta?: string;
  finishReason?: string;
  usage?: AIUsage;
  tools?: AIToolCall[];
  error?: Error;
}

// ============================================================================
// Request/Response Validators
// ============================================================================

/**
 * Validates a Gemini request
 */
export function validateGeminiRequest(request: GeminiRequest): void {
  if (!request.prompt?.trim()) {
    throw new GeminiError(
      GeminiErrorCode.UNKNOWN_ERROR,
      'Prompt cannot be empty'
    );
  }
  
  if (!request.model?.trim()) {
    throw new GeminiError(
      GeminiErrorCode.UNKNOWN_ERROR,
      'Model must be specified'
    );
  }
  
  // Validate model is supported - Updated for August 2025
  const supportedModels = [
    // Latest 2025 models
    'gemini-1.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-pro-exp',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    // Legacy 2024 models for backward compatibility
    'gemini-2.0-flash-exp',
    'gemini-exp-1206',
    'gemini-1.5-pro-002',
    'gemini-1.5-flash-002'
  ];
  if (!supportedModels.includes(request.model)) {
    throw new GeminiError(
      GeminiErrorCode.MODEL_NOT_SUPPORTED,
      `Model ${request.model} is not supported. Supported latest models: gemini-1.5-pro, gemini-2.5-flash, gemini-2.0-pro-exp, gemini-2.0-flash, gemini-2.0-flash-lite`
    );
  }
  
  // Validate temperature
  if (request.temperature !== undefined) {
    if (request.temperature < 0 || request.temperature > 2) {
      throw new GeminiError(
        GeminiErrorCode.UNKNOWN_ERROR,
        'Temperature must be between 0 and 2'
      );
    }
  }
  
  // Validate max tokens
  if (request.maxOutputTokens !== undefined) {
    if (request.maxOutputTokens < 1 || request.maxOutputTokens > 8192) {
      throw new GeminiError(
        GeminiErrorCode.UNKNOWN_ERROR,
        'Max output tokens must be between 1 and 8192'
      );
    }
  }
}

/**
 * Validates a Gemini response
 */
export function validateGeminiResponse(response: unknown): GeminiResponse {
  if (!response || typeof response !== 'object') {
    throw new GeminiError(
      GeminiErrorCode.RESPONSE_PARSE_ERROR,
      'Invalid response format'
    );
  }
  
  const resp = response as any;
  
  if (!Array.isArray(resp.candidates)) {
    throw new GeminiError(
      GeminiErrorCode.RESPONSE_PARSE_ERROR,
      'Response missing candidates array'
    );
  }
  
  if (resp.candidates.length === 0) {
    throw new GeminiError(
      GeminiErrorCode.SAFETY_FILTER_BLOCKED,
      'No response candidates available (possibly blocked by safety filters)'
    );
  }
  
  // Validate first candidate
  const candidate = resp.candidates[0];
  if (!candidate.content || !Array.isArray(candidate.content.parts)) {
    throw new GeminiError(
      GeminiErrorCode.RESPONSE_PARSE_ERROR,
      'Invalid candidate content structure'
    );
  }
  
  return resp as GeminiResponse;
}

// ============================================================================
// Version Information Types
// ============================================================================

/**
 * Version information structure
 */
export interface VersionInfo {
  version: string;
  build_time: string;
  git_commit?: string;
  tauri_version: string;
}

// ============================================================================
// Ollama Types
// ============================================================================

/**
 * Detected Ollama model with enhanced capability analysis
 */
export interface DetectedOllamaModel {
  /** Model ID (e.g., "llama3.1:8b") */
  id: string;
  /** Formatted display name with emojis and size info */
  name: string;
  /** Model file size in bytes */
  size: number;
  /** Last modification timestamp */
  modified_at: string;
  /** Parameter size (e.g., "8.0B") */
  parameter_size: string;
  /** Quantization level (e.g., "Q4_K_M") */
  quantization_level: string;
  /** Model family (e.g., "llama", "gemma") */
  family: string;
  /** Analyzed model capabilities */
  capabilities: OllamaModelCapabilities;
}

/**
 * Ollama model capabilities with detailed scoring
 */
export interface OllamaModelCapabilities {
  /** Intelligence score (0-100) */
  intelligence: number;
  /** Response speed score (0-100) */
  speed: number;
  /** Coding ability score (0-100) */
  coding_excellence: number;
  /** Analysis depth score (0-100) */
  analysis_depth: number;
  /** Creative writing score (0-100) */
  creative_writing: number;
  /** Technical precision score (0-100) */
  technical_precision: number;
  /** Whether model supports vision/multimodal */
  supports_vision: boolean;
  /** Context window size in tokens */
  context_window: number;
}

/**
 * Ollama model use cases for recommendations
 */
export type OllamaUseCase = 
  | 'coding'      // Best for programming tasks
  | 'analysis'    // Best for analysis and reasoning
  | 'creative'    // Best for creative writing
  | 'fast'        // Fastest response times
  | 'vision'      // Image/multimodal capabilities
  | 'balanced';   // Good all-around performance