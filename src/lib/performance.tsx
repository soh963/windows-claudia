/**
 * Performance monitoring and metrics utility
 */
import React from 'react';

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ComponentPerformance {
  component: string;
  renderTime: number;
  firstRenderTime?: number;
  updateCount: number;
  lastUpdate: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private componentMetrics: Map<string, ComponentPerformance> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Monitor paint metrics
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(`paint:${entry.name}`, {
            startTime: entry.startTime,
            duration: entry.duration || 0,
            metadata: { entryType: entry.entryType }
          });
        }
      });
      
      try {
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);
      } catch (e) {
        console.warn('Paint observer not supported');
      }

      // Monitor navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('navigation', {
            startTime: entry.startTime,
            duration: entry.duration,
            metadata: {
              domContentLoaded: (entry as PerformanceNavigationTiming).domContentLoadedEventEnd,
              loadComplete: (entry as PerformanceNavigationTiming).loadEventEnd
            }
          });
        }
      });

      try {
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (e) {
        console.warn('Navigation observer not supported');
      }
    }
  }

  /**
   * Start timing a performance metric
   */
  startTiming(name: string, metadata?: Record<string, any>): void {
    const startTime = performance.now();
    this.metrics.set(name, {
      name,
      startTime,
      metadata
    });
  }

  /**
   * End timing a performance metric
   */
  endTiming(name: string): PerformanceMetric | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`No timing started for metric: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    const completedMetric: PerformanceMetric = {
      ...metric,
      endTime,
      duration
    };

    this.metrics.set(name, completedMetric);
    return completedMetric;
  }

  /**
   * Record a one-time metric
   */
  recordMetric(name: string, data: Partial<PerformanceMetric>): void {
    const metric: PerformanceMetric = {
      name,
      startTime: data.startTime || performance.now(),
      endTime: data.endTime,
      duration: data.duration,
      metadata: data.metadata
    };

    this.metrics.set(name, metric);
  }

  /**
   * Record component performance
   */
  recordComponentPerformance(component: string, renderTime: number, isFirstRender = false): void {
    const existing = this.componentMetrics.get(component);
    const now = Date.now();

    if (existing) {
      this.componentMetrics.set(component, {
        ...existing,
        renderTime,
        updateCount: existing.updateCount + 1,
        lastUpdate: now
      });
    } else {
      this.componentMetrics.set(component, {
        component,
        renderTime,
        firstRenderTime: isFirstRender ? renderTime : undefined,
        updateCount: 1,
        lastUpdate: now
      });
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get component metrics
   */
  getComponentMetrics(): ComponentPerformance[] {
    return Array.from(this.componentMetrics.values());
  }

  /**
   * Get metrics by name pattern
   */
  getMetricsByPattern(pattern: RegExp): PerformanceMetric[] {
    return this.getMetrics().filter(metric => pattern.test(metric.name));
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.componentMetrics.clear();
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalMetrics: number;
    avgDuration: number;
    slowestMetric: PerformanceMetric | null;
    fastestMetric: PerformanceMetric | null;
    components: ComponentPerformance[];
  } {
    const metrics = this.getMetrics();
    const metricsWithDuration = metrics.filter(m => m.duration !== undefined);
    
    let avgDuration = 0;
    let slowestMetric: PerformanceMetric | null = null;
    let fastestMetric: PerformanceMetric | null = null;

    if (metricsWithDuration.length > 0) {
      avgDuration = metricsWithDuration.reduce((sum, m) => sum + (m.duration || 0), 0) / metricsWithDuration.length;
      
      slowestMetric = metricsWithDuration.reduce((prev, current) => 
        (current.duration || 0) > (prev.duration || 0) ? current : prev
      );
      
      fastestMetric = metricsWithDuration.reduce((prev, current) => 
        (current.duration || 0) < (prev.duration || 0) ? current : prev
      );
    }

    return {
      totalMetrics: metrics.length,
      avgDuration,
      slowestMetric,
      fastestMetric,
      components: this.getComponentMetrics()
    };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    const summary = this.getSummary();
    const metrics = this.getMetrics();
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary,
      metrics,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    }, null, 2);
  }

  /**
   * Cleanup observers
   */
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.clearMetrics();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for component performance monitoring
 */
export function useComponentPerformance(componentName: string) {
  const startTime = performance.now();

  return {
    recordRender: (isFirstRender = false) => {
      const renderTime = performance.now() - startTime;
      performanceMonitor.recordComponentPerformance(componentName, renderTime, isFirstRender);
      return renderTime;
    }
  };
}

/**
 * Higher-order component for automatic performance monitoring
 */
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const MonitoredComponent: React.FC<P> = (props) => {
    const [isFirstRender, setIsFirstRender] = React.useState(true);
    const { recordRender } = useComponentPerformance(displayName);
    
    React.useEffect(() => {
      recordRender(isFirstRender);
      if (isFirstRender) {
        setIsFirstRender(false);
      }
    });

    return <WrappedComponent {...props} />;
  };

  MonitoredComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  return MonitoredComponent;
}

/**
 * Utility function to measure async operations
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<{ result: T; duration: number }> {
  performanceMonitor.startTiming(name, metadata);
  
  try {
    const result = await operation();
    const metric = performanceMonitor.endTiming(name);
    return {
      result,
      duration: metric?.duration || 0
    };
  } catch (error) {
    performanceMonitor.endTiming(name);
    throw error;
  }
}

/**
 * Utility function to measure sync operations
 */
export function measureSync<T>(
  name: string,
  operation: () => T,
  metadata?: Record<string, any>
): { result: T; duration: number } {
  performanceMonitor.startTiming(name, metadata);
  
  try {
    const result = operation();
    const metric = performanceMonitor.endTiming(name);
    return {
      result,
      duration: metric?.duration || 0
    };
  } catch (error) {
    performanceMonitor.endTiming(name);
    throw error;
  }
}

/**
 * Web Vitals monitoring
 */
export function initWebVitals() {
  if (typeof window === 'undefined') return;

  // Core Web Vitals
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const metric = entry as any;
      
      performanceMonitor.recordMetric(`webvital:${metric.name}`, {
        startTime: metric.startTime,
        duration: metric.value,
        metadata: {
          rating: metric.rating,
          delta: metric.delta,
          id: metric.id
        }
      });
    }
  });

  try {
    observer.observe({
      entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift']
    });
  } catch (e) {
    console.warn('Web Vitals observer not supported');
  }
}

// Auto-initialize Web Vitals if in browser
if (typeof window !== 'undefined') {
  initWebVitals();
}