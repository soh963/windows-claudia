import { invoke } from '@tauri-apps/api/core';
import { useErrorTrackingStore } from '@/stores/errorTrackingStore';

/**
 * Wrapper for Tauri invoke commands with automatic error tracking
 */
export async function invokeWithErrorTracking<T>(
  command: string,
  args?: Record<string, any>,
  options?: {
    retryable?: boolean;
    maxRetries?: number;
    context?: Record<string, any>;
  }
): Promise<T> {
  const { captureError } = useErrorTrackingStore.getState();
  const maxRetries = options?.maxRetries || 3;
  let retryCount = 0;

  async function attempt(): Promise<T> {
    try {
      const result = await invoke<T>(command, args);
      return result;
    } catch (error: any) {
      const errorId = captureError({
        category: 'api',
        source: 'tauri-backend',
        severity: determineSeverityFromError(error),
        message: error.message || `Command '${command}' failed`,
        code: error.code || command,
        context: {
          operation: command,
          ...options?.context,
        },
        details: {
          args,
          error: error.toString(),
          attempt: retryCount + 1,
        },
        resolved: false,
        retryCount,
        maxRetries: options?.retryable ? maxRetries : 0,
        impact: {
          userImpact: 'minor',
          functionalityImpact: [command],
        },
        tags: ['tauri-command', command],
      });

      // Retry if enabled and haven't exceeded max retries
      if (options?.retryable && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return attempt();
      }

      throw error;
    }
  }

  return attempt();
}

/**
 * Wrapper for fetch API calls with automatic error tracking
 */
export async function fetchWithErrorTracking(
  url: string,
  options?: RequestInit & {
    errorContext?: Record<string, any>;
    retryable?: boolean;
    maxRetries?: number;
  }
): Promise<Response> {
  const { captureApiError } = useErrorTrackingStore.getState();
  const maxRetries = options?.maxRetries || 3;
  let retryCount = 0;

  async function attempt(): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error: any) {
      const source = url.includes('gemini') ? 'gemini-api' : 
                    url.includes('claude') ? 'claude-api' : 
                    'tauri-backend';
      
      captureApiError(source, {
        message: error.message,
        code: error.code || 'FETCH_ERROR',
        status: error.status,
        statusText: error.statusText,
        ...error,
      }, url);

      // Retry if enabled and haven't exceeded max retries
      if (options?.retryable && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return attempt();
      }

      throw error;
    }
  }

  return attempt();
}

/**
 * Create an error-tracked version of any async function
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    name: string;
    category?: ErrorCategory;
    source?: ErrorSource;
    retryable?: boolean;
    maxRetries?: number;
    context?: Record<string, any>;
  }
): T {
  const { captureError } = useErrorTrackingStore.getState();

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let retryCount = 0;
    const maxRetries = options.retryable ? (options.maxRetries || 3) : 0;

    async function attempt(): Promise<ReturnType<T>> {
      try {
        return await fn(...args);
      } catch (error: any) {
        const errorId = captureError({
          category: options.category || 'runtime',
          source: options.source || 'react-component',
          severity: determineSeverityFromError(error),
          message: error.message || `${options.name} failed`,
          stack: error.stack,
          context: {
            operation: options.name,
            ...options.context,
          },
          details: {
            args,
            error: error.toString(),
            attempt: retryCount + 1,
          },
          resolved: false,
          retryCount,
          maxRetries,
          impact: {
            userImpact: 'minor',
            functionalityImpact: [options.name],
          },
          tags: ['wrapped-function', options.name],
        });

        if (retryCount < maxRetries) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attempt();
        }

        throw error;
      }
    }

    return attempt();
  }) as T;
}

// Helper function to determine severity from error
function determineSeverityFromError(error: any): ErrorSeverity {
  // Check for specific error codes or patterns
  if (error.code === 'EACCES' || error.code === 'EPERM') return 'high';
  if (error.code === 'ENOENT') return 'medium';
  if (error.message?.includes('rate limit')) return 'medium';
  if (error.message?.includes('timeout')) return 'medium';
  if (error.message?.includes('network')) return 'high';
  if (error.status >= 500) return 'high';
  if (error.status >= 400) return 'medium';
  
  return 'medium';
}

// Import types
import type { ErrorCategory, ErrorSource, ErrorSeverity } from '@/stores/errorTrackingStore';

// Example usage:
/*
// Wrap Tauri commands
const result = await invokeWithErrorTracking('get_user_data', { userId: 123 }, {
  retryable: true,
  maxRetries: 3,
  context: { component: 'UserProfile' }
});

// Wrap fetch calls
const response = await fetchWithErrorTracking('https://api.example.com/data', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' },
  retryable: true,
  errorContext: { component: 'DataFetcher' }
});

// Wrap any async function
const processData = withErrorTracking(
  async (data: any) => {
    // Your async logic here
    return processedData;
  },
  {
    name: 'processData',
    category: 'runtime',
    source: 'react-component',
    retryable: true,
    context: { component: 'DataProcessor' }
  }
);
*/