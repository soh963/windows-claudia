/**
 * Error Detection and Auto-Resolution Client
 * 
 * This module provides frontend integration with the error detection system,
 * enabling automatic error tracking, resolution monitoring, and user notifications.
 */

import { invoke } from '@tauri-apps/api';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface ErrorContext {
  model_type?: string;
  session_id?: string;
  tool_name?: string;
  user_action?: string;
  [key: string]: any;
}

export interface ErrorEntry {
  id: string;
  error_code: string;
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  occurred_at: number;
  resolved_at?: number;
  status: string;
  auto_resolved: boolean;
  occurrences: number;
}

export interface ErrorMetrics {
  total_errors: number;
  resolved_errors: number;
  auto_resolved_errors: number;
  recurring_errors: number;
  errors_by_category: Record<string, number>;
  errors_by_severity: Record<string, number>;
  resolution_rate: number;
  auto_resolution_rate: number;
  mean_time_to_resolution?: number;
  top_errors: Array<{
    error_code: string;
    title: string;
    occurrences: number;
  }>;
}

export interface ResolutionEvent {
  error_id: string;
  error_code: string;
  resolved: boolean;
  message: string;
  confidence: number;
  retry_needed: boolean;
  auto_resolved?: boolean;
}

/**
 * ErrorDetectionService - Main service for error tracking and resolution
 */
export class ErrorDetectionService {
  private listeners: Map<string, UnlistenFn> = new Map();
  private errorHandlers: Set<(error: ResolutionEvent) => void> = new Set();
  private resolutionHandlers: Set<(event: ResolutionEvent) => void> = new Set();

  constructor() {
    this.setupEventListeners();
    this.setupGlobalErrorHandler();
  }

  /**
   * Track an error with full context
   */
  async trackError(
    error: Error | string,
    component: string,
    context?: ErrorContext,
    severity?: 'Low' | 'Medium' | 'High' | 'Critical'
  ): Promise<string> {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const stackTrace = error instanceof Error ? error.stack : undefined;

      // Enhance context with browser/environment info
      const enhancedContext = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        ...context
      };

      const errorId = await invoke<string>('track_error', {
        errorMessage,
        component,
        category: this.detectCategory(errorMessage),
        severity: severity || this.assessSeverity(errorMessage),
        stackTrace,
        context: enhancedContext,
        sessionId: context?.session_id
      });

      console.log(`Error tracked: ${errorId}`, { errorMessage, component });
      return errorId;
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
      throw trackingError;
    }
  }

  /**
   * Get error by ID
   */
  async getError(errorId: string): Promise<ErrorEntry | null> {
    try {
      return await invoke<ErrorEntry | null>('get_error', { errorId });
    } catch (error) {
      console.error('Failed to get error:', error);
      throw error;
    }
  }

  /**
   * List errors with optional filters
   */
  async listErrors(
    statusFilter?: string,
    categoryFilter?: string,
    limit?: number
  ): Promise<ErrorEntry[]> {
    try {
      return await invoke<ErrorEntry[]>('list_errors', {
        statusFilter,
        categoryFilter,
        limit
      });
    } catch (error) {
      console.error('Failed to list errors:', error);
      throw error;
    }
  }

  /**
   * Search errors with advanced filters
   */
  async searchErrors(params: {
    category?: string;
    severity?: string;
    status?: string;
    searchText?: string;
    sessionId?: string;
    limit?: number;
  }): Promise<ErrorEntry[]> {
    try {
      return await invoke<ErrorEntry[]>('search_errors', params);
    } catch (error) {
      console.error('Failed to search errors:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive error metrics
   */
  async getErrorMetrics(timeRangeHours?: number): Promise<ErrorMetrics> {
    try {
      return await invoke<ErrorMetrics>('get_error_metrics', { timeRangeHours });
    } catch (error) {
      console.error('Failed to get error metrics:', error);
      throw error;
    }
  }

  /**
   * Manually resolve an error
   */
  async resolveError(
    errorId: string,
    status: string,
    rootCause?: string,
    resolutionSteps?: string[],
    preventionStrategies?: string[]
  ): Promise<void> {
    try {
      await invoke('resolve_error', {
        errorId,
        status,
        rootCause,
        resolutionSteps: resolutionSteps || [],
        preventionStrategies: preventionStrategies || []
      });
    } catch (error) {
      console.error('Failed to resolve error:', error);
      throw error;
    }
  }

  /**
   * Subscribe to error events
   */
  onError(handler: (error: ResolutionEvent) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Subscribe to resolution events
   */
  onResolution(handler: (event: ResolutionEvent) => void): () => void {
    this.resolutionHandlers.add(handler);
    return () => this.resolutionHandlers.delete(handler);
  }

  /**
   * Setup event listeners for error tracking and resolution
   */
  private async setupEventListeners() {
    // Listen for error tracking events
    const unlistenTracked = await listen<ResolutionEvent>('error-tracked', (event) => {
      console.log('Error tracked:', event.payload);
      this.errorHandlers.forEach(handler => handler(event.payload));
    });
    this.listeners.set('error-tracked', unlistenTracked);

    // Listen for error resolution events
    const unlistenResolved = await listen<ResolutionEvent>('error-resolved', (event) => {
      console.log('Error resolved:', event.payload);
      this.resolutionHandlers.forEach(handler => handler(event.payload));
      
      // Show success notification
      if (event.payload.auto_resolved) {
        this.showNotification(
          'Error Auto-Resolved',
          `${event.payload.error_code} was automatically resolved`,
          'success'
        );
      }
    });
    this.listeners.set('error-resolved', unlistenResolved);

    // Listen for resolution attempt events
    const unlistenAttempt = await listen<ResolutionEvent>('error-resolution-attempt', (event) => {
      console.log('Resolution attempt:', event.payload);
      
      if (!event.payload.resolved && event.payload.retry_needed) {
        this.showNotification(
          'Resolution In Progress',
          `Attempting to resolve ${event.payload.error_code}...`,
          'info'
        );
      }
    });
    this.listeners.set('error-resolution-attempt', unlistenAttempt);

    // Listen for UI cleanup events
    const unlistenCleanup = await listen<any>('ui-cleanup-required', (event) => {
      console.log('UI cleanup required:', event.payload);
      this.performUICleanup(event.payload);
    });
    this.listeners.set('ui-cleanup-required', unlistenCleanup);

    // Listen for module reinitialization events
    const unlistenReinit = await listen<any>('reinitialize-tauri-api', async (event) => {
      console.log('Reinitializing Tauri API:', event.payload);
      await this.reinitializeTauriAPI();
    });
    this.listeners.set('reinitialize-tauri-api', unlistenReinit);
  }

  /**
   * Setup global error handler
   */
  private setupGlobalErrorHandler() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.trackError(
        new Error(event.message),
        'window',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      );
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(
        new Error(event.reason?.message || 'Unhandled Promise Rejection'),
        'promise',
        {
          reason: event.reason
        }
      );
    });
  }

  /**
   * Perform UI cleanup when duplicates are detected
   */
  private performUICleanup(params: any) {
    if (params.clear_cache) {
      // Clear any UI caches
      localStorage.removeItem('ui_cache');
      sessionStorage.clear();
    }

    if (params.reset_listeners) {
      // Re-setup event listeners
      this.cleanup();
      this.setupEventListeners();
    }

    // Force re-render if using a framework
    window.dispatchEvent(new Event('force-rerender'));
  }

  /**
   * Reinitialize Tauri API after import error
   */
  private async reinitializeTauriAPI() {
    try {
      // Dynamically re-import Tauri API modules
      const { invoke: newInvoke } = await import('@tauri-apps/api');
      // Update global references if needed
      console.log('Tauri API reinitialized successfully');
    } catch (error) {
      console.error('Failed to reinitialize Tauri API:', error);
    }
  }

  /**
   * Detect error category from message
   */
  private detectCategory(message: string): string {
    const lower = message.toLowerCase();
    
    if (lower.includes('session')) return 'SessionManagement';
    if (lower.includes('model') || lower.includes('api')) return 'ModelIntegration';
    if (lower.includes('file') || lower.includes('path')) return 'FileSystem';
    if (lower.includes('network') || lower.includes('timeout')) return 'Network';
    if (lower.includes('auth') || lower.includes('401')) return 'Authentication';
    if (lower.includes('database') || lower.includes('sql')) return 'Database';
    if (lower.includes('ui') || lower.includes('render')) return 'UI';
    if (lower.includes('memory') || lower.includes('performance')) return 'Performance';
    if (lower.includes('config')) return 'Configuration';
    
    return 'Unknown';
  }

  /**
   * Assess error severity from message
   */
  private assessSeverity(message: string): 'Low' | 'Medium' | 'High' | 'Critical' {
    const lower = message.toLowerCase();
    
    if (lower.includes('critical') || lower.includes('fatal') || lower.includes('crash')) {
      return 'Critical';
    }
    if (lower.includes('error') || lower.includes('fail')) {
      return 'High';
    }
    if (lower.includes('warning') || lower.includes('retry')) {
      return 'Medium';
    }
    
    return 'Low';
  }

  /**
   * Show notification to user
   */
  private showNotification(title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') {
    // Emit custom event for notification system
    window.dispatchEvent(new CustomEvent('show-notification', {
      detail: { title, message, type }
    }));
    
    // Also log to console
    const logMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
    console[logMethod](`[${title}] ${message}`);
  }

  /**
   * Cleanup listeners
   */
  cleanup() {
    this.listeners.forEach(unlisten => unlisten());
    this.listeners.clear();
    this.errorHandlers.clear();
    this.resolutionHandlers.clear();
  }
}

// Export singleton instance
export const errorDetection = new ErrorDetectionService();

// Helper function for quick error tracking
export async function trackError(
  error: Error | string,
  component: string,
  context?: ErrorContext
): Promise<string> {
  return errorDetection.trackError(error, component, context);
}

// Export types for external use
export type { ResolutionEvent as ErrorResolutionEvent };