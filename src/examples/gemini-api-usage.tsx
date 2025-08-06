/**
 * Example usage of the enhanced Gemini API interfaces
 */

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { 
  GeminiError, 
  GeminiErrorCode, 
  isGeminiError,
  type GeminiRequest 
} from '@/lib/api-types';
import { 
  withRetry, 
  RateLimiter, 
  EnhancedAPIClient,
  ResponseCache 
} from '@/lib/api-helpers';
import { 
  getModelConfig, 
  validateModelConfig,
  modelSupports,
  toGeminiRequestParams 
} from '@/lib/models';

/**
 * Example component demonstrating enhanced Gemini API usage
 */
export function GeminiApiExample() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  /**
   * Example 1: Basic API call with enhanced error handling
   */
  const basicApiCall = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate configuration first
      const configResult = await api.validateGeminiConfig();
      if (!configResult.isValid) {
        throw new GeminiError(
          GeminiErrorCode.API_KEY_INVALID,
          configResult.error || 'Invalid configuration'
        );
      }

      // Execute with enhanced options
      await api.executeGeminiCode(
        'Explain quantum computing in simple terms',
        'gemini-2.0-flash-exp',
        '/path/to/project',
        {
          temperature: 0.7,
          maxOutputTokens: 1000,
          topK: 40,
          topP: 0.95,
          systemInstruction: 'You are a helpful assistant that explains complex topics simply.'
        }
      );

      setResponse('Request sent successfully!');
    } catch (err) {
      if (isGeminiError(err)) {
        // Handle specific Gemini errors
        switch (err.code) {
          case GeminiErrorCode.API_KEY_MISSING:
            setError('Please configure your Gemini API key in settings');
            break;
          case GeminiErrorCode.SAFETY_FILTER_BLOCKED:
            setError('Response was blocked by safety filters');
            break;
          case GeminiErrorCode.QUOTA_EXCEEDED:
            setError('API quota exceeded. Please try again later.');
            break;
          default:
            setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Example 2: Using retry logic for resilient API calls
   */
  const apiCallWithRetry = async () => {
    try {
      setLoading(true);
      setError(null);

      // Execute with automatic retry on transient failures
      await withRetry(
        async () => {
          await api.executeGeminiCode(
            'Generate a Python function to sort a list',
            'gemini-exp-1206',
            '/path/to/project'
          );
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          backoffFactor: 2,
          retryableErrors: [
            GeminiErrorCode.REQUEST_TIMEOUT,
            GeminiErrorCode.NETWORK_ERROR
          ]
        }
      );

      setResponse('Request completed with retry support!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Example 3: Using model configuration helpers
   */
  const apiCallWithModelConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const modelId = 'gemini-2.0-flash-exp';

      // Check model capabilities
      if (!modelSupports(modelId, 'systemInstructions')) {
        throw new Error('Model does not support system instructions');
      }

      // Get model configuration with defaults
      const config = getModelConfig(modelId, {
        temperature: 0.9,
        maxOutputTokens: 2000
      });

      // Validate configuration
      const validation = validateModelConfig(modelId, config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Convert to Gemini request parameters
      const geminiParams = toGeminiRequestParams(config);

      await api.executeGeminiCode(
        'Write a creative story about AI',
        modelId,
        '/path/to/project',
        geminiParams
      );

      setResponse('Request sent with validated model configuration!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Example 4: Using rate limiting for multiple requests
   */
  const apiCallWithRateLimiting = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create rate limiter (5 concurrent, 100ms interval)
      const rateLimiter = new RateLimiter(5, 100);

      // Execute multiple requests with rate limiting
      const prompts = [
        'What is machine learning?',
        'Explain neural networks',
        'What is deep learning?',
        'Describe transformers',
        'What is reinforcement learning?'
      ];

      const requests = prompts.map(prompt => 
        rateLimiter.execute(async () => {
          await api.executeGeminiCode(
            prompt,
            'gemini-2.0-flash-exp',
            '/path/to/project'
          );
        })
      );

      await Promise.all(requests);
      setResponse(`Completed ${requests.length} requests with rate limiting!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Example 5: Using response caching
   */
  const apiCallWithCaching = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create cache with 5 minute TTL
      const cache = new ResponseCache<string, any>(300000);

      const prompt = 'Explain the theory of relativity';
      const cacheKey = prompt;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        setResponse('Retrieved from cache!');
        return;
      }

      // Execute API call
      await api.executeGeminiCode(
        prompt,
        'gemini-exp-1206',
        '/path/to/project'
      );

      // Cache the response (in real app, you'd cache the actual response)
      cache.set(cacheKey, { timestamp: Date.now() });

      setResponse('Request completed and cached!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Example 6: Using enhanced API client with interceptors
   */
  const apiCallWithInterceptors = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create enhanced client with interceptors
      const enhancedClient = new EnhancedAPIClient(
        async (request: GeminiRequest) => {
          await api.executeGeminiCode(
            request.prompt,
            request.model,
            '/path/to/project',
            request
          );
          return { success: true };
        }
      );

      // Add request interceptor for logging
      enhancedClient.addRequestInterceptor(request => {
        console.log('Request:', request);
        return request;
      });

      // Add response interceptor for metrics
      enhancedClient.addResponseInterceptor(response => {
        console.log('Response:', response);
        return response;
      });

      // Execute with interceptors
      await enhancedClient.execute({
        prompt: 'Explain blockchain technology',
        model: 'gemini-2.0-flash-exp',
        temperature: 0.7
      });

      setResponse('Request completed with interceptors!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Enhanced Gemini API Examples</h2>
      
      <div className="space-y-2">
        <button 
          onClick={basicApiCall}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Basic API Call
        </button>
        
        <button 
          onClick={apiCallWithRetry}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          API Call with Retry
        </button>
        
        <button 
          onClick={apiCallWithModelConfig}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          API Call with Model Config
        </button>
        
        <button 
          onClick={apiCallWithRateLimiting}
          disabled={loading}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
        >
          API Call with Rate Limiting
        </button>
        
        <button 
          onClick={apiCallWithCaching}
          disabled={loading}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
        >
          API Call with Caching
        </button>
        
        <button 
          onClick={apiCallWithInterceptors}
          disabled={loading}
          className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-50"
        >
          API Call with Interceptors
        </button>
      </div>
      
      {loading && <p className="text-gray-600">Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {response && <p className="text-green-500">{response}</p>}
    </div>
  );
}