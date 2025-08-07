/**
 * Performance Optimization Module
 * Provides comprehensive performance enhancements for all components
 */

import { debounce, throttle } from 'lodash';

/**
 * Performance monitoring and optimization utilities
 */
export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private observers: Map<string, IntersectionObserver> = new Map();
  private performanceMetrics: Map<string, PerformanceMetric> = new Map();
  private resourceCache: Map<string, CachedResource> = new Map();
  
  private constructor() {
    this.initializePerformanceMonitoring();
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn(`Long task detected: ${entry.duration}ms`, entry);
              this.recordMetric('longTask', entry.duration);
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('Long task monitoring not supported');
      }
    }

    // Monitor memory usage
    this.monitorMemoryUsage();
  }

  /**
   * Monitor memory usage
   */
  private monitorMemoryUsage() {
    if (typeof window === 'undefined') return;
    
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMemory = memory.usedJSHeapSize / 1048576;
        const totalMemory = memory.totalJSHeapSize / 1048576;
        
        if (usedMemory > totalMemory * 0.9) {
          console.warn(`High memory usage: ${usedMemory.toFixed(2)}MB / ${totalMemory.toFixed(2)}MB`);
          this.triggerMemoryCleanup();
        }
        
        this.recordMetric('memoryUsage', usedMemory);
      }
    };

    // Check memory every 30 seconds
    setInterval(checkMemory, 30000);
  }

  /**
   * Trigger memory cleanup
   */
  private triggerMemoryCleanup() {
    // Clear old cache entries
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, resource] of this.resourceCache.entries()) {
      if (now - resource.timestamp > maxAge) {
        this.resourceCache.delete(key);
      }
    }

    // Clear old metrics
    for (const [key, metric] of this.performanceMetrics.entries()) {
      if (now - metric.timestamp > maxAge) {
        this.performanceMetrics.delete(key);
      }
    }

    // Suggest garbage collection if available
    if (typeof (global as any).gc === 'function') {
      (global as any).gc();
    }
  }

  /**
   * Create lazy loading observer for components
   */
  createLazyLoadingObserver(
    onIntersect: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
  ): IntersectionObserver {
    const defaultOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: '50px',
      threshold: 0.01,
      ...options
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          onIntersect(entry);
          observer.unobserve(entry.target);
        }
      });
    }, defaultOptions);

    const observerId = `observer-${Date.now()}`;
    this.observers.set(observerId, observer);

    return observer;
  }

  /**
   * Debounce function with performance tracking
   */
  createDebouncedFunction<T extends (...args: any[]) => any>(
    func: T,
    wait: number = 300,
    options?: { leading?: boolean; trailing?: boolean; maxWait?: number }
  ): T {
    const debouncedFunc = debounce(func, wait, options);
    
    return ((...args: Parameters<T>) => {
      const start = performance.now();
      const result = debouncedFunc(...args);
      const duration = performance.now() - start;
      
      if (duration > 16) {
        console.warn(`Debounced function took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    }) as T;
  }

  /**
   * Throttle function with performance tracking
   */
  createThrottledFunction<T extends (...args: any[]) => any>(
    func: T,
    wait: number = 100,
    options?: { leading?: boolean; trailing?: boolean }
  ): T {
    const throttledFunc = throttle(func, wait, options);
    
    return ((...args: Parameters<T>) => {
      const start = performance.now();
      const result = throttledFunc(...args);
      const duration = performance.now() - start;
      
      if (duration > 16) {
        console.warn(`Throttled function took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    }) as T;
  }

  /**
   * Memoize expensive computations
   */
  memoize<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        const cached = cache.get(key);
        this.recordMetric('cacheHit', 1);
        return cached;
      }
      
      const start = performance.now();
      const result = func(...args);
      const duration = performance.now() - start;
      
      cache.set(key, result);
      this.recordMetric('cacheMiss', 1);
      this.recordMetric('computationTime', duration);
      
      // Limit cache size
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return result;
    }) as T;
  }

  /**
   * Batch multiple operations
   */
  createBatchProcessor<T, R>(
    processor: (items: T[]) => Promise<R[]>,
    batchSize: number = 10,
    delay: number = 100
  ) {
    let batch: T[] = [];
    let timeoutId: NodeJS.Timeout | null = null;
    const callbacks: Map<T, (result: R) => void> = new Map();

    const processBatch = async () => {
      if (batch.length === 0) return;

      const currentBatch = [...batch];
      batch = [];
      
      try {
        const start = performance.now();
        const results = await processor(currentBatch);
        const duration = performance.now() - start;
        
        this.recordMetric('batchProcessingTime', duration);
        this.recordMetric('batchSize', currentBatch.length);
        
        currentBatch.forEach((item, index) => {
          const callback = callbacks.get(item);
          if (callback && results[index]) {
            callback(results[index]);
          }
          callbacks.delete(item);
        });
      } catch (error) {
        console.error('Batch processing failed:', error);
        currentBatch.forEach(item => callbacks.delete(item));
      }
    };

    return (item: T): Promise<R> => {
      return new Promise((resolve) => {
        batch.push(item);
        callbacks.set(item, resolve);

        if (batch.length >= batchSize) {
          processBatch();
        } else {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(processBatch, delay);
        }
      });
    };
  }

  /**
   * Virtual scrolling helper
   */
  createVirtualScroller<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    overscan: number = 3
  ) {
    const totalHeight = items.length * itemHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);

    return (scrollTop: number) => {
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.min(
        items.length,
        startIndex + visibleCount + overscan * 2
      );

      const visibleItems = items.slice(startIndex, endIndex);
      const offsetY = startIndex * itemHeight;

      return {
        visibleItems,
        offsetY,
        totalHeight,
        startIndex,
        endIndex
      };
    };
  }

  /**
   * Request idle callback wrapper
   */
  scheduleIdleTask(
    callback: () => void,
    options?: { timeout?: number }
  ): number {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, options);
    } else {
      // Fallback for browsers that don't support requestIdleCallback
      return window.setTimeout(callback, 0) as unknown as number;
    }
  }

  /**
   * Cancel idle task
   */
  cancelIdleTask(handle: number) {
    if ('cancelIdleCallback' in window) {
      window.cancelIdleCallback(handle);
    } else {
      window.clearTimeout(handle);
    }
  }

  /**
   * Optimize image loading
   */
  optimizeImage(src: string, options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  }): string {
    // If it's a local image or data URL, return as is
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return src;
    }

    // Build optimized URL (this would typically integrate with an image CDN)
    const params = new URLSearchParams();
    
    if (options?.width) params.append('w', options.width.toString());
    if (options?.height) params.append('h', options.height.toString());
    if (options?.quality) params.append('q', options.quality.toString());
    if (options?.format) params.append('f', options.format);

    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}${params.toString()}`;
  }

  /**
   * Record performance metric
   */
  private recordMetric(name: string, value: number) {
    const metric = this.performanceMetrics.get(name) || {
      name,
      values: [],
      timestamp: Date.now()
    };

    metric.values.push(value);
    
    // Keep only last 100 values
    if (metric.values.length > 100) {
      metric.values.shift();
    }

    metric.timestamp = Date.now();
    this.performanceMetrics.set(name, metric);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Map<string, PerformanceMetric> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Get average metric value
   */
  getAverageMetric(name: string): number {
    const metric = this.performanceMetrics.get(name);
    if (!metric || metric.values.length === 0) return 0;

    const sum = metric.values.reduce((a, b) => a + b, 0);
    return sum / metric.values.length;
  }

  /**
   * Clear all observers
   */
  clearObservers() {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.performanceMetrics.clear();
  }

  /**
   * Clear resource cache
   */
  clearCache() {
    this.resourceCache.clear();
  }
}

// Types
interface PerformanceMetric {
  name: string;
  values: number[];
  timestamp: number;
}

interface CachedResource {
  data: any;
  timestamp: number;
}

// Export singleton instance
export const performanceOptimizer = PerformanceOptimizer.getInstance();

// Export utility functions
export const optimizedDebounce = performanceOptimizer.createDebouncedFunction.bind(performanceOptimizer);
export const optimizedThrottle = performanceOptimizer.createThrottledFunction.bind(performanceOptimizer);
export const optimizedMemoize = performanceOptimizer.memoize.bind(performanceOptimizer);
export const createBatchProcessor = performanceOptimizer.createBatchProcessor.bind(performanceOptimizer);
export const createVirtualScroller = performanceOptimizer.createVirtualScroller.bind(performanceOptimizer);
export const scheduleIdleTask = performanceOptimizer.scheduleIdleTask.bind(performanceOptimizer);
export const createLazyLoadingObserver = performanceOptimizer.createLazyLoadingObserver.bind(performanceOptimizer);