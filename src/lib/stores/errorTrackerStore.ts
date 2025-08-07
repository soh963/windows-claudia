import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Types
export enum ErrorSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

export enum ErrorCategory {
  SessionManagement = 'SessionManagement',
  ModelIntegration = 'ModelIntegration',
  FileSystem = 'FileSystem',
  Network = 'Network',
  Authentication = 'Authentication',
  Database = 'Database',
  UI = 'UI',
  Performance = 'Performance',
  Configuration = 'Configuration',
  Unknown = 'Unknown'
}

export enum ErrorStatus {
  New = 'New',
  InProgress = 'InProgress',
  Resolved = 'Resolved',
  KnownIssue = 'KnownIssue',
  WontFix = 'WontFix',
  Recurring = 'Recurring',
  AutoResolved = 'AutoResolved'
}

export interface ErrorEntry {
  id: string;
  error_code: string;
  title: string;
  description: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  occurred_at: number;
  resolved_at?: number;
  status: ErrorStatus;
  root_cause?: string;
  resolution_steps: string[];
  prevention_strategies: string[];
  occurrences: number;
  last_occurrence: number;
  context: Record<string, string>;
  stack_trace?: string;
  session_id?: string;
  auto_resolved: boolean;
  pattern_id?: string;
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
  top_errors: ErrorSummary[];
}

export interface ErrorSummary {
  error_code: string;
  title: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  occurrences: number;
  last_occurrence: number;
  status: ErrorStatus;
}

export interface ErrorFilter {
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  status?: ErrorStatus;
  search_text?: string;
  session_id?: string;
  limit?: number;
}

// Store state
interface ErrorTrackerState {
  errors: ErrorEntry[];
  metrics: ErrorMetrics | null;
  selectedError: ErrorEntry | null;
  filters: ErrorFilter;
  isLoading: boolean;
  error: string | null;
  autoTrackingEnabled: boolean;
  realTimeUpdates: boolean;
}

// Create store
function createErrorTrackerStore() {
  const initialState: ErrorTrackerState = {
    errors: [],
    metrics: null,
    selectedError: null,
    filters: {},
    isLoading: false,
    error: null,
    autoTrackingEnabled: true,
    realTimeUpdates: true
  };

  const { subscribe, set, update } = writable<ErrorTrackerState>(initialState);

  let eventListeners: UnlistenFn[] = [];

  // Setup event listeners
  async function setupEventListeners() {
    try {
      // Listen for error tracking events
      const unlistenTracked = await listen('error-tracked', (event: any) => {
        console.log('Error tracked:', event.payload);
        if (get(errorTrackerStore).realTimeUpdates) {
          loadErrors();
          loadMetrics();
        }
      });

      // Listen for auto-resolution events
      const unlistenResolved = await listen('error-auto-resolved', (event: any) => {
        console.log('Error auto-resolved:', event.payload);
        update(state => ({
          ...state,
          errors: state.errors.map(err => 
            err.error_code === event.payload.error_code
              ? { ...err, status: ErrorStatus.AutoResolved, auto_resolved: true }
              : err
          )
        }));
        if (get(errorTrackerStore).realTimeUpdates) {
          loadMetrics();
        }
      });

      // Listen for UI cleanup events
      const unlistenCleanup = await listen('ui-cleanup-required', (event: any) => {
        console.log('UI cleanup required:', event.payload);
        // Handle UI cleanup
        if (event.payload.clear_cache) {
          // Clear relevant caches
        }
        if (event.payload.reset_listeners) {
          // Reset event listeners
        }
      });

      eventListeners = [unlistenTracked, unlistenResolved, unlistenCleanup];
    } catch (err) {
      console.error('Failed to setup event listeners:', err);
    }
  }

  // Cleanup event listeners
  function cleanupEventListeners() {
    eventListeners.forEach(unlisten => unlisten());
    eventListeners = [];
  }

  // Track a new error
  async function trackError(
    errorMessage: string,
    component: string,
    options?: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      stackTrace?: string;
      context?: Record<string, string>;
      sessionId?: string;
    }
  ): Promise<string | null> {
    if (!get(errorTrackerStore).autoTrackingEnabled) {
      return null;
    }

    try {
      const errorId = await invoke<string>('track_error', {
        errorMessage,
        component,
        category: options?.category,
        severity: options?.severity,
        stackTrace: options?.stackTrace,
        context: options?.context,
        sessionId: options?.sessionId
      });

      // Reload errors if real-time updates are enabled
      if (get(errorTrackerStore).realTimeUpdates) {
        await loadErrors();
        await loadMetrics();
      }

      return errorId;
    } catch (err) {
      console.error('Failed to track error:', err);
      update(state => ({
        ...state,
        error: `Failed to track error: ${err}`
      }));
      return null;
    }
  }

  // Load errors with filters
  async function loadErrors(filters?: ErrorFilter) {
    update(state => ({ ...state, isLoading: true, error: null }));

    try {
      const errors = await invoke<ErrorEntry[]>('search_errors', {
        category: filters?.category,
        severity: filters?.severity,
        status: filters?.status,
        searchText: filters?.search_text,
        sessionId: filters?.session_id,
        limit: filters?.limit || 100
      });

      update(state => ({
        ...state,
        errors,
        filters: filters || state.filters,
        isLoading: false
      }));
    } catch (err) {
      console.error('Failed to load errors:', err);
      update(state => ({
        ...state,
        error: `Failed to load errors: ${err}`,
        isLoading: false
      }));
    }
  }

  // Load error metrics
  async function loadMetrics(timeRangeHours?: number) {
    try {
      const metrics = await invoke<ErrorMetrics>('get_error_metrics', {
        timeRangeHours: timeRangeHours || 24
      });

      update(state => ({
        ...state,
        metrics
      }));
    } catch (err) {
      console.error('Failed to load metrics:', err);
      update(state => ({
        ...state,
        error: `Failed to load metrics: ${err}`
      }));
    }
  }

  // Get specific error details
  async function getError(errorId: string) {
    update(state => ({ ...state, isLoading: true, error: null }));

    try {
      const error = await invoke<ErrorEntry | null>('get_error', {
        errorId
      });

      if (error) {
        update(state => ({
          ...state,
          selectedError: error,
          isLoading: false
        }));
      } else {
        update(state => ({
          ...state,
          error: 'Error not found',
          isLoading: false
        }));
      }
    } catch (err) {
      console.error('Failed to get error:', err);
      update(state => ({
        ...state,
        error: `Failed to get error: ${err}`,
        isLoading: false
      }));
    }
  }

  // Resolve an error
  async function resolveError(
    errorId: string,
    status: ErrorStatus,
    rootCause?: string,
    resolutionSteps?: string[],
    preventionStrategies?: string[]
  ) {
    try {
      await invoke('resolve_error', {
        errorId,
        status,
        rootCause,
        resolutionSteps: resolutionSteps || [],
        preventionStrategies: preventionStrategies || []
      });

      // Update local state
      update(state => ({
        ...state,
        errors: state.errors.map(err =>
          err.id === errorId
            ? {
                ...err,
                status,
                root_cause: rootCause,
                resolution_steps: resolutionSteps || err.resolution_steps,
                prevention_strategies: preventionStrategies || err.prevention_strategies,
                resolved_at: status === ErrorStatus.Resolved ? Date.now() / 1000 : undefined
              }
            : err
        )
      }));

      // Reload metrics
      await loadMetrics();
    } catch (err) {
      console.error('Failed to resolve error:', err);
      update(state => ({
        ...state,
        error: `Failed to resolve error: ${err}`
      }));
    }
  }

  // Toggle auto-tracking
  function toggleAutoTracking() {
    update(state => ({
      ...state,
      autoTrackingEnabled: !state.autoTrackingEnabled
    }));
  }

  // Toggle real-time updates
  function toggleRealTimeUpdates() {
    update(state => ({
      ...state,
      realTimeUpdates: !state.realTimeUpdates
    }));
  }

  // Initialize store
  async function initialize() {
    await setupEventListeners();
    await loadErrors();
    await loadMetrics();
  }

  // Cleanup
  function cleanup() {
    cleanupEventListeners();
  }

  return {
    subscribe,
    trackError,
    loadErrors,
    loadMetrics,
    getError,
    resolveError,
    toggleAutoTracking,
    toggleRealTimeUpdates,
    initialize,
    cleanup,
    set,
    update
  };
}

// Create and export the store
export const errorTrackerStore = createErrorTrackerStore();

// Derived stores
export const criticalErrors = derived(
  errorTrackerStore,
  $store => $store.errors.filter(err => err.severity === ErrorSeverity.Critical)
);

export const unresolvedErrors = derived(
  errorTrackerStore,
  $store => $store.errors.filter(err => 
    err.status !== ErrorStatus.Resolved && 
    err.status !== ErrorStatus.AutoResolved &&
    err.status !== ErrorStatus.WontFix
  )
);

export const recurringErrors = derived(
  errorTrackerStore,
  $store => $store.errors.filter(err => err.status === ErrorStatus.Recurring)
);

export const errorsByCategory = derived(
  errorTrackerStore,
  $store => {
    const grouped: Record<ErrorCategory, ErrorEntry[]> = {} as any;
    $store.errors.forEach(err => {
      if (!grouped[err.category]) {
        grouped[err.category] = [];
      }
      grouped[err.category].push(err);
    });
    return grouped;
  }
);

// Global error handler integration
export function setupGlobalErrorTracking() {
  // Track unhandled errors
  window.addEventListener('error', (event) => {
    errorTrackerStore.trackError(
      event.error?.message || event.message,
      'window.error',
      {
        category: ErrorCategory.UI,
        severity: ErrorSeverity.High,
        stackTrace: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: String(event.lineno),
          colno: String(event.colno)
        }
      }
    );
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorTrackerStore.trackError(
      event.reason?.message || String(event.reason),
      'unhandledrejection',
      {
        category: ErrorCategory.Unknown,
        severity: ErrorSeverity.High,
        stackTrace: event.reason?.stack,
        context: {
          promise: String(event.promise)
        }
      }
    );
  });

  // Track console errors
  const originalError = console.error;
  console.error = (...args) => {
    errorTrackerStore.trackError(
      args.map(arg => String(arg)).join(' '),
      'console.error',
      {
        category: ErrorCategory.Unknown,
        severity: ErrorSeverity.Medium,
        context: {
          timestamp: new Date().toISOString()
        }
      }
    );
    originalError.apply(console, args);
  };
}

// Helper function to track API errors
export async function trackApiError(
  error: any,
  endpoint: string,
  method: string,
  sessionId?: string
) {
  return errorTrackerStore.trackError(
    error.message || String(error),
    `api.${method}.${endpoint}`,
    {
      category: ErrorCategory.Network,
      severity: error.status >= 500 ? ErrorSeverity.Critical : ErrorSeverity.High,
      stackTrace: error.stack,
      context: {
        endpoint,
        method,
        status: String(error.status || 'unknown'),
        response: error.response ? JSON.stringify(error.response) : undefined
      },
      sessionId
    }
  );
}

// Helper function to track session errors
export async function trackSessionError(
  error: any,
  sessionId: string,
  operation: string
) {
  return errorTrackerStore.trackError(
    error.message || String(error),
    `session.${operation}`,
    {
      category: ErrorCategory.SessionManagement,
      severity: ErrorSeverity.High,
      stackTrace: error.stack,
      context: {
        operation,
        sessionId
      },
      sessionId
    }
  );
}