/**
 * API helper functions for enhanced error handling and request/response processing
 */

import type {
  GeminiRequest,
  GeminiResponse,
  GeminiError,
  GeminiErrorCode,
  AIRequest,
  AIResponse
} from './api-types';
import { isGeminiError } from './api-types';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: string[];
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: [
    'GEMINI_REQUEST_TIMEOUT',
    'GEMINI_NETWORK_ERROR',
    'GEMINI_QUOTA_EXCEEDED'
  ]
};

/**
 * Execute a function with exponential backoff retry
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryableErrors = []
  } = config;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = isGeminiError(error) && 
        retryableErrors.includes(error.code);

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private queue: (() => Promise<void>)[] = [];
  private running = 0;

  constructor(
    private maxConcurrent: number = 5,
    private minInterval: number = 100
  ) {}

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          this.running++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      };

      if (this.running < this.maxConcurrent) {
        task();
      } else {
        this.queue.push(task);
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0 || this.running >= this.maxConcurrent) {
      return;
    }

    const task = this.queue.shift();
    if (task) {
      // Add minimal delay between requests
      await new Promise(resolve => setTimeout(resolve, this.minInterval));
      task();
    }
  }
}

/**
 * Request interceptor for adding common headers or transformations
 */
export type RequestInterceptor<T = any> = (request: T) => T | Promise<T>;

/**
 * Response interceptor for transforming or validating responses
 */
export type ResponseInterceptor<T = any, R = any> = (response: T) => R | Promise<R>;

/**
 * API client with interceptors and middleware support
 */
export class EnhancedAPIClient<TRequest = any, TResponse = any> {
  private requestInterceptors: RequestInterceptor<TRequest>[] = [];
  private responseInterceptors: ResponseInterceptor<TResponse>[] = [];
  private rateLimiter?: RateLimiter;

  constructor(
    private baseExecutor: (request: TRequest) => Promise<TResponse>,
    rateLimiter?: RateLimiter
  ) {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor<TRequest>): this {
    this.requestInterceptors.push(interceptor);
    return this;
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor<TResponse>): this {
    this.responseInterceptors.push(interceptor);
    return this;
  }

  /**
   * Execute request with all interceptors and middleware
   */
  async execute(request: TRequest): Promise<TResponse> {
    // Apply request interceptors
    let processedRequest = request;
    for (const interceptor of this.requestInterceptors) {
      processedRequest = await interceptor(processedRequest);
    }

    // Execute with rate limiting if configured
    const executeRequest = () => this.baseExecutor(processedRequest);
    const response = this.rateLimiter
      ? await this.rateLimiter.execute(executeRequest)
      : await executeRequest();

    // Apply response interceptors
    let processedResponse = response;
    for (const interceptor of this.responseInterceptors) {
      processedResponse = await interceptor(processedResponse);
    }

    return processedResponse;
  }
}

/**
 * Create a timeout wrapper for async functions
 * @param fn - Function to wrap
 * @param timeout - Timeout in milliseconds
 * @returns Wrapped function that throws on timeout
 */
export function withTimeout<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  timeout: number
): T {
  return (async (...args: Parameters<T>) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
    });

    return Promise.race([fn(...args), timeoutPromise]);
  }) as T;
}

/**
 * Batch multiple requests together
 */
export class RequestBatcher<TRequest, TResponse> {
  private batch: {
    request: TRequest;
    resolve: (response: TResponse) => void;
    reject: (error: Error) => void;
  }[] = [];
  private timer?: NodeJS.Timeout;

  constructor(
    private batchExecutor: (requests: TRequest[]) => Promise<TResponse[]>,
    private maxBatchSize: number = 10,
    private batchDelay: number = 50
  ) {}

  /**
   * Add a request to the batch
   */
  async add(request: TRequest): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      this.batch.push({ request, resolve, reject });

      if (this.batch.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.batchDelay);
      }
    });
  }

  /**
   * Flush the current batch
   */
  private async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.batch.length === 0) {
      return;
    }

    const currentBatch = this.batch;
    this.batch = [];

    try {
      const requests = currentBatch.map(item => item.request);
      const responses = await this.batchExecutor(requests);

      if (responses.length !== currentBatch.length) {
        throw new Error('Batch response count mismatch');
      }

      currentBatch.forEach((item, index) => {
        item.resolve(responses[index]);
      });
    } catch (error) {
      currentBatch.forEach(item => {
        item.reject(error as Error);
      });
    }
  }
}

/**
 * Cache for API responses
 */
export class ResponseCache<TKey, TValue> {
  private cache = new Map<string, { value: TValue; expiry: number }>();

  constructor(
    private ttl: number = 300000, // 5 minutes default
    private keySerializer: (key: TKey) => string = JSON.stringify
  ) {}

  /**
   * Get a value from cache
   */
  get(key: TKey): TValue | undefined {
    const serializedKey = this.keySerializer(key);
    const entry = this.cache.get(serializedKey);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(serializedKey);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: TKey, value: TValue, ttl?: number): void {
    const serializedKey = this.keySerializer(key);
    this.cache.set(serializedKey, {
      value,
      expiry: Date.now() + (ttl || this.ttl)
    });
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Circuit breaker for fault tolerance
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private resetTimeout: number = 30000
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      setTimeout(() => {
        this.state = 'half-open';
      }, this.resetTimeout);
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}