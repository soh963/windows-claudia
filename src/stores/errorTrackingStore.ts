import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist } from 'zustand/middleware';
import type { StateCreator } from 'zustand';

// Error Categories
export type ErrorCategory = 
  | 'api' 
  | 'tool' 
  | 'runtime' 
  | 'ui' 
  | 'build'
  | 'database'
  | 'filesystem'
  | 'network'
  | 'permission'
  | 'validation'
  | 'authentication'
  | 'configuration';

// Error Sources
export type ErrorSource = 
  | 'gemini-api'
  | 'claude-api'
  | 'tauri-backend'
  | 'react-component'
  | 'tool-execution'
  | 'mcp-server'
  | 'database'
  | 'file-system'
  | 'build-process'
  | 'user-input';

// Error Severity
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

// Error Pattern Types
export type ErrorPattern = {
  id: string;
  pattern: string;
  category: ErrorCategory;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  affectedComponents: string[];
  suggestedFix?: string;
  autoResolvable: boolean;
};

// Enhanced Error Entry
export interface ErrorEntry {
  id: string;
  timestamp: number;
  category: ErrorCategory;
  source: ErrorSource;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  stack?: string;
  context: {
    component?: string;
    operation?: string;
    userId?: string;
    sessionId?: string;
    environment?: string;
    browser?: string;
    os?: string;
  };
  details?: Record<string, any>;
  correlationId?: string; // Link related errors
  parentErrorId?: string; // For error chains
  childErrorIds?: string[];
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionMethod?: string;
  retryCount?: number;
  maxRetries?: number;
  impact: {
    userImpact: 'none' | 'minor' | 'major' | 'blocking';
    functionalityImpact: string[];
    affectedUsers?: number;
  };
  tags?: string[];
  preventionSuggestion?: string;
  learningNote?: string;
}

// Error Statistics
export interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsBySource: Record<ErrorSource, number>;
  errorRate: number; // Errors per minute
  resolutionRate: number; // Percentage of resolved errors
  averageResolutionTime: number; // In milliseconds
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurrence: number;
  }>;
  errorTrends: Array<{
    timestamp: number;
    count: number;
    severity: ErrorSeverity;
  }>;
}

// Error Filter Options
export interface ErrorFilterOptions {
  categories?: ErrorCategory[];
  sources?: ErrorSource[];
  severities?: ErrorSeverity[];
  resolved?: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
  searchTerm?: string;
  tags?: string[];
}

// Error Resolution Action
export interface ErrorResolution {
  errorId: string;
  method: 'manual' | 'automatic' | 'retry' | 'ignore';
  notes?: string;
  preventionSteps?: string[];
  success: boolean;
}

// Store State
interface ErrorTrackingState {
  // Error Data
  errors: Map<string, ErrorEntry>;
  errorPatterns: Map<string, ErrorPattern>;
  
  // Statistics
  statistics: ErrorStatistics;
  
  // UI State
  selectedErrorId: string | null;
  filters: ErrorFilterOptions;
  isErrorDashboardOpen: boolean;
  isErrorDetailsModalOpen: boolean;
  
  // Settings
  settings: {
    autoResolveTimeout: number; // Auto-resolve low severity errors after X ms
    maxErrorsStored: number;
    enableAutoRetry: boolean;
    retryDelays: number[]; // Exponential backoff delays
    enableErrorGrouping: boolean;
    enablePreventionSuggestions: boolean;
  };
  
  // Actions
  captureError: (error: Omit<ErrorEntry, 'id' | 'timestamp'>) => string;
  captureErrorBoundary: (error: Error, errorInfo: React.ErrorInfo, component: string) => void;
  captureTauriError: (error: any, operation: string) => void;
  captureApiError: (source: ErrorSource, error: any, endpoint?: string) => void;
  
  // Error Management
  resolveError: (errorId: string, resolution: Omit<ErrorResolution, 'errorId'>) => void;
  retryError: (errorId: string) => void;
  correlateErrors: (errorIds: string[]) => void;
  tagError: (errorId: string, tags: string[]) => void;
  addLearningNote: (errorId: string, note: string) => void;
  
  // Pattern Detection
  detectPatterns: () => void;
  getRelatedErrors: (errorId: string) => ErrorEntry[];
  getSimilarErrors: (error: ErrorEntry) => ErrorEntry[];
  
  // Statistics & Analysis
  updateStatistics: () => void;
  getErrorTrends: (timeRange: number) => ErrorStatistics['errorTrends'];
  getTopErrors: (limit: number) => ErrorStatistics['topErrors'];
  getResolutionMetrics: () => {
    averageTime: number;
    successRate: number;
    byMethod: Record<string, number>;
  };
  
  // UI Actions
  selectError: (errorId: string | null) => void;
  setFilters: (filters: ErrorFilterOptions) => void;
  toggleErrorDashboard: () => void;
  toggleErrorDetailsModal: () => void;
  
  // Utility Actions
  clearResolvedErrors: () => void;
  exportErrors: (format: 'json' | 'csv') => string;
  importErrors: (data: string, format: 'json' | 'csv') => void;
  
  // Prevention & Learning
  generatePreventionReport: () => Array<{
    pattern: string;
    occurrences: number;
    suggestedPrevention: string;
    estimatedImpactReduction: number;
  }>;
  applyLearnings: (errorId: string) => void;
}

// Helper function to generate error ID
const generateErrorId = () => `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper function to determine severity from error
const determineSeverity = (error: any): ErrorSeverity => {
  if (error.code === 'CRITICAL' || error.severity === 'critical') return 'critical';
  if (error.code === 'HIGH' || error.severity === 'high') return 'high';
  if (error.code === 'MEDIUM' || error.severity === 'medium') return 'medium';
  return 'low';
};

// Create the store
const errorTrackingStore: StateCreator<
  ErrorTrackingState,
  [],
  [['zustand/subscribeWithSelector', never], ['zustand/persist', ErrorTrackingState]],
  ErrorTrackingState
> = (set, get) => ({
  // Initial state
  errors: new Map(),
  errorPatterns: new Map(),
  statistics: {
    totalErrors: 0,
    errorsByCategory: {} as Record<ErrorCategory, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    errorsBySource: {} as Record<ErrorSource, number>,
    errorRate: 0,
    resolutionRate: 0,
    averageResolutionTime: 0,
    topErrors: [],
    errorTrends: [],
  },
  selectedErrorId: null,
  filters: {},
  isErrorDashboardOpen: false,
  isErrorDetailsModalOpen: false,
  settings: {
    autoResolveTimeout: 300000, // 5 minutes
    maxErrorsStored: 1000,
    enableAutoRetry: true,
    retryDelays: [1000, 2000, 5000, 10000], // Exponential backoff
    enableErrorGrouping: true,
    enablePreventionSuggestions: true,
  },
  
  // Capture generic error
  captureError: (errorData) => {
    const id = generateErrorId();
    const error: ErrorEntry = {
      ...errorData,
      id,
      timestamp: Date.now(),
      resolved: false,
      retryCount: 0,
    };
    
    set((state) => {
      const newErrors = new Map(state.errors);
      newErrors.set(id, error);
      
      // Maintain max errors limit
      if (newErrors.size > state.settings.maxErrorsStored) {
        const sortedErrors = Array.from(newErrors.entries())
          .sort(([, a], [, b]) => a.timestamp - b.timestamp);
        
        // Remove oldest resolved errors first
        const toRemove = sortedErrors
          .filter(([, err]) => err.resolved)
          .slice(0, newErrors.size - state.settings.maxErrorsStored);
        
        toRemove.forEach(([id]) => newErrors.delete(id));
      }
      
      return { errors: newErrors };
    });
    
    // Update statistics and detect patterns
    get().updateStatistics();
    get().detectPatterns();
    
    // Auto-resolve low severity errors if enabled
    if (error.severity === 'low' && get().settings.autoResolveTimeout > 0) {
      setTimeout(() => {
        const currentError = get().errors.get(id);
        if (currentError && !currentError.resolved) {
          get().resolveError(id, {
            method: 'automatic',
            notes: 'Auto-resolved due to low severity',
            success: true,
          });
        }
      }, get().settings.autoResolveTimeout);
    }
    
    return id;
  },
  
  // Capture React Error Boundary errors
  captureErrorBoundary: (error, errorInfo, component) => {
    get().captureError({
      category: 'ui',
      source: 'react-component',
      severity: 'high',
      message: error.message,
      stack: error.stack,
      context: {
        component,
        componentStack: errorInfo.componentStack,
      },
      impact: {
        userImpact: 'major',
        functionalityImpact: [`${component} component rendering`],
      },
      tags: ['error-boundary', 'react'],
    });
  },
  
  // Capture Tauri backend errors
  captureTauriError: (error, operation) => {
    get().captureError({
      category: 'runtime',
      source: 'tauri-backend',
      severity: determineSeverity(error),
      message: error.message || String(error),
      code: error.code,
      context: {
        operation,
      },
      details: error,
      impact: {
        userImpact: 'minor',
        functionalityImpact: [operation],
      },
      tags: ['tauri', 'backend'],
    });
  },
  
  // Capture API errors
  captureApiError: (source, error, endpoint) => {
    const severity = error.code === 'RATE_LIMITED' ? 'medium' : determineSeverity(error);
    
    get().captureError({
      category: 'api',
      source,
      severity,
      message: error.message || 'API request failed',
      code: error.code || error.status,
      context: {
        endpoint,
        operation: 'api-request',
      },
      details: {
        status: error.status,
        statusText: error.statusText,
        response: error.response,
      },
      impact: {
        userImpact: severity === 'critical' ? 'blocking' : 'minor',
        functionalityImpact: [`${source} functionality`],
      },
      tags: ['api', source],
      preventionSuggestion: error.code === 'RATE_LIMITED' 
        ? 'Implement request throttling or increase rate limits'
        : undefined,
    });
  },
  
  // Resolve error
  resolveError: (errorId, resolution) => {
    set((state) => {
      const error = state.errors.get(errorId);
      if (!error) return state;
      
      const newErrors = new Map(state.errors);
      newErrors.set(errorId, {
        ...error,
        resolved: true,
        resolvedAt: Date.now(),
        resolutionMethod: resolution.method,
      });
      
      return { errors: newErrors };
    });
    
    // Update statistics after resolution
    get().updateStatistics();
    
    // Apply learnings if prevention steps provided
    if (resolution.preventionSteps && resolution.preventionSteps.length > 0) {
      get().applyLearnings(errorId);
    }
  },
  
  // Retry error
  retryError: (errorId) => {
    const error = get().errors.get(errorId);
    if (!error || !get().settings.enableAutoRetry) return;
    
    const retryCount = error.retryCount || 0;
    const maxRetries = error.maxRetries || get().settings.retryDelays.length;
    
    if (retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) reached for error ${errorId}`);
      return;
    }
    
    const delay = get().settings.retryDelays[retryCount] || 5000;
    
    set((state) => {
      const newErrors = new Map(state.errors);
      const error = newErrors.get(errorId);
      if (error) {
        newErrors.set(errorId, {
          ...error,
          retryCount: retryCount + 1,
        });
      }
      return { errors: newErrors };
    });
    
    // Implement retry logic based on error type
    setTimeout(() => {
      // This would trigger the original operation retry
      console.log(`Retrying error ${errorId} after ${delay}ms`);
    }, delay);
  },
  
  // Correlate related errors
  correlateErrors: (errorIds) => {
    if (errorIds.length < 2) return;
    
    const correlationId = `corr_${Date.now()}`;
    
    set((state) => {
      const newErrors = new Map(state.errors);
      
      errorIds.forEach((id) => {
        const error = newErrors.get(id);
        if (error) {
          newErrors.set(id, {
            ...error,
            correlationId,
          });
        }
      });
      
      return { errors: newErrors };
    });
  },
  
  // Tag error
  tagError: (errorId, tags) => {
    set((state) => {
      const error = state.errors.get(errorId);
      if (!error) return state;
      
      const newErrors = new Map(state.errors);
      newErrors.set(errorId, {
        ...error,
        tags: [...(error.tags || []), ...tags],
      });
      
      return { errors: newErrors };
    });
  },
  
  // Add learning note
  addLearningNote: (errorId, note) => {
    set((state) => {
      const error = state.errors.get(errorId);
      if (!error) return state;
      
      const newErrors = new Map(state.errors);
      newErrors.set(errorId, {
        ...error,
        learningNote: note,
      });
      
      return { errors: newErrors };
    });
  },
  
  // Detect patterns
  detectPatterns: () => {
    const { errors, settings } = get();
    if (!settings.enableErrorGrouping) return;
    
    const patterns = new Map<string, ErrorPattern>();
    
    // Group errors by similar messages and categories
    errors.forEach((error) => {
      const patternKey = `${error.category}_${error.message.substring(0, 50)}`;
      
      const existing = patterns.get(patternKey);
      if (existing) {
        patterns.set(patternKey, {
          ...existing,
          occurrences: existing.occurrences + 1,
          lastSeen: error.timestamp,
          affectedComponents: [
            ...new Set([...existing.affectedComponents, error.context.component || '']),
          ].filter(Boolean),
        });
      } else {
        patterns.set(patternKey, {
          id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pattern: error.message,
          category: error.category,
          occurrences: 1,
          firstSeen: error.timestamp,
          lastSeen: error.timestamp,
          affectedComponents: error.context.component ? [error.context.component] : [],
          autoResolvable: error.severity === 'low',
        });
      }
    });
    
    set({ errorPatterns: patterns });
  },
  
  // Get related errors
  getRelatedErrors: (errorId) => {
    const error = get().errors.get(errorId);
    if (!error) return [];
    
    const related: ErrorEntry[] = [];
    
    // Find errors with same correlation ID
    if (error.correlationId) {
      get().errors.forEach((e) => {
        if (e.id !== errorId && e.correlationId === error.correlationId) {
          related.push(e);
        }
      });
    }
    
    // Find parent/child errors
    if (error.parentErrorId) {
      const parent = get().errors.get(error.parentErrorId);
      if (parent) related.push(parent);
    }
    
    if (error.childErrorIds) {
      error.childErrorIds.forEach((childId) => {
        const child = get().errors.get(childId);
        if (child) related.push(child);
      });
    }
    
    return related;
  },
  
  // Get similar errors
  getSimilarErrors: (error) => {
    const similar: ErrorEntry[] = [];
    const threshold = 0.7; // Similarity threshold
    
    get().errors.forEach((e) => {
      if (e.id === error.id) return;
      
      // Simple similarity check based on category, source, and message
      let similarity = 0;
      if (e.category === error.category) similarity += 0.3;
      if (e.source === error.source) similarity += 0.3;
      if (e.message.includes(error.message.substring(0, 20))) similarity += 0.4;
      
      if (similarity >= threshold) {
        similar.push(e);
      }
    });
    
    return similar.slice(0, 10); // Return top 10 similar errors
  },
  
  // Update statistics
  updateStatistics: () => {
    const errors = Array.from(get().errors.values());
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    // Calculate basic counts
    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;
    const errorsBySource: Record<ErrorSource, number> = {} as any;
    
    let resolvedCount = 0;
    let totalResolutionTime = 0;
    let resolvedWithTime = 0;
    
    errors.forEach((error) => {
      // Category counts
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      
      // Severity counts
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      
      // Source counts
      errorsBySource[error.source] = (errorsBySource[error.source] || 0) + 1;
      
      // Resolution metrics
      if (error.resolved) {
        resolvedCount++;
        if (error.resolvedAt) {
          totalResolutionTime += error.resolvedAt - error.timestamp;
          resolvedWithTime++;
        }
      }
    });
    
    // Calculate error rate (errors per minute in last 5 minutes)
    const recentErrors = errors.filter((e) => e.timestamp >= fiveMinutesAgo);
    const errorRate = recentErrors.length / 5;
    
    // Calculate top errors
    const errorCounts = new Map<string, { count: number; lastOccurrence: number }>();
    errors.forEach((error) => {
      const key = error.message;
      const existing = errorCounts.get(key);
      if (existing) {
        existing.count++;
        existing.lastOccurrence = Math.max(existing.lastOccurrence, error.timestamp);
      } else {
        errorCounts.set(key, { count: 1, lastOccurrence: error.timestamp });
      }
    });
    
    const topErrors = Array.from(errorCounts.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Calculate error trends (last 24 hours, hourly buckets)
    const errorTrends: ErrorStatistics['errorTrends'] = [];
    const hourInMs = 60 * 60 * 1000;
    const dayAgo = now - 24 * hourInMs;
    
    for (let time = dayAgo; time <= now; time += hourInMs) {
      const hourErrors = errors.filter(
        (e) => e.timestamp >= time && e.timestamp < time + hourInMs
      );
      
      if (hourErrors.length > 0) {
        const severityCounts = hourErrors.reduce((acc, e) => {
          if (e.severity === 'critical' || e.severity === 'high') {
            return e.severity;
          }
          return acc;
        }, 'low' as ErrorSeverity);
        
        errorTrends.push({
          timestamp: time,
          count: hourErrors.length,
          severity: severityCounts,
        });
      }
    }
    
    set({
      statistics: {
        totalErrors: errors.length,
        errorsByCategory,
        errorsBySeverity,
        errorsBySource,
        errorRate,
        resolutionRate: errors.length > 0 ? (resolvedCount / errors.length) * 100 : 0,
        averageResolutionTime: resolvedWithTime > 0 ? totalResolutionTime / resolvedWithTime : 0,
        topErrors,
        errorTrends,
      },
    });
  },
  
  // Get error trends
  getErrorTrends: (timeRange) => {
    const now = Date.now();
    const startTime = now - timeRange;
    
    return get().statistics.errorTrends.filter((trend) => trend.timestamp >= startTime);
  },
  
  // Get top errors
  getTopErrors: (limit) => {
    return get().statistics.topErrors.slice(0, limit);
  },
  
  // Get resolution metrics
  getResolutionMetrics: () => {
    const errors = Array.from(get().errors.values());
    const resolved = errors.filter((e) => e.resolved);
    
    const byMethod: Record<string, number> = {};
    let totalTime = 0;
    let count = 0;
    
    resolved.forEach((error) => {
      if (error.resolutionMethod) {
        byMethod[error.resolutionMethod] = (byMethod[error.resolutionMethod] || 0) + 1;
      }
      
      if (error.resolvedAt) {
        totalTime += error.resolvedAt - error.timestamp;
        count++;
      }
    });
    
    return {
      averageTime: count > 0 ? totalTime / count : 0,
      successRate: errors.length > 0 ? (resolved.length / errors.length) * 100 : 0,
      byMethod,
    };
  },
  
  // UI Actions
  selectError: (errorId) => set({ selectedErrorId: errorId }),
  setFilters: (filters) => set({ filters }),
  toggleErrorDashboard: () => set((state) => ({ isErrorDashboardOpen: !state.isErrorDashboardOpen })),
  toggleErrorDetailsModal: () => set((state) => ({ isErrorDetailsModalOpen: !state.isErrorDetailsModalOpen })),
  
  // Clear resolved errors
  clearResolvedErrors: () => {
    set((state) => {
      const newErrors = new Map();
      state.errors.forEach((error, id) => {
        if (!error.resolved) {
          newErrors.set(id, error);
        }
      });
      return { errors: newErrors };
    });
    
    get().updateStatistics();
  },
  
  // Export errors
  exportErrors: (format) => {
    const errors = Array.from(get().errors.values());
    
    if (format === 'json') {
      return JSON.stringify(errors, null, 2);
    } else {
      // CSV format
      const headers = [
        'ID',
        'Timestamp',
        'Category',
        'Source',
        'Severity',
        'Message',
        'Component',
        'Resolved',
        'Resolution Time',
      ];
      
      const rows = errors.map((error) => [
        error.id,
        new Date(error.timestamp).toISOString(),
        error.category,
        error.source,
        error.severity,
        `"${error.message.replace(/"/g, '""')}"`,
        error.context.component || '',
        error.resolved ? 'Yes' : 'No',
        error.resolvedAt ? `${(error.resolvedAt - error.timestamp) / 1000}s` : '',
      ]);
      
      return [headers, ...rows].map((row) => row.join(',')).join('\n');
    }
  },
  
  // Import errors
  importErrors: (data, format) => {
    try {
      let errors: ErrorEntry[] = [];
      
      if (format === 'json') {
        errors = JSON.parse(data);
      } else {
        // CSV parsing would go here
        console.warn('CSV import not implemented yet');
        return;
      }
      
      set((state) => {
        const newErrors = new Map(state.errors);
        errors.forEach((error) => {
          newErrors.set(error.id, error);
        });
        return { errors: newErrors };
      });
      
      get().updateStatistics();
    } catch (error) {
      console.error('Failed to import errors:', error);
    }
  },
  
  // Generate prevention report
  generatePreventionReport: () => {
    const patterns = Array.from(get().errorPatterns.values());
    
    return patterns
      .filter((pattern) => pattern.occurrences > 2)
      .map((pattern) => ({
        pattern: pattern.pattern,
        occurrences: pattern.occurrences,
        suggestedPrevention: pattern.suggestedFix || 'Implement input validation and error handling',
        estimatedImpactReduction: Math.min(pattern.occurrences * 20, 80), // Rough estimate
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);
  },
  
  // Apply learnings
  applyLearnings: (errorId) => {
    const error = get().errors.get(errorId);
    if (!error || !error.learningNote) return;
    
    // In a real application, this would:
    // 1. Update documentation
    // 2. Create automated tests
    // 3. Update error handling code
    // 4. Notify relevant team members
    
    console.log(`Applying learnings from error ${errorId}:`, error.learningNote);
  },
});

// Create the store with persistence
export const useErrorTrackingStore = create<ErrorTrackingState>()(
  subscribeWithSelector(
    persist(
      errorTrackingStore,
      {
        name: 'error-tracking-store',
        partialize: (state) => ({
          // Only persist settings and patterns
          settings: state.settings,
          errorPatterns: Array.from(state.errorPatterns.entries()),
        }),
        merge: (persistedState: any, currentState) => ({
          ...currentState,
          settings: persistedState?.settings || currentState.settings,
          errorPatterns: new Map(persistedState?.errorPatterns || []),
        }),
      }
    )
  )
);

// Helper hooks
export function useErrorCapture() {
  const { captureError, captureErrorBoundary, captureTauriError, captureApiError } = useErrorTrackingStore();
  
  return {
    captureError,
    captureErrorBoundary,
    captureTauriError,
    captureApiError,
    
    // Convenience method for capturing errors with context
    captureWithContext: (error: Error, context: Partial<ErrorEntry['context']>) => {
      return captureError({
        category: 'runtime',
        source: 'react-component',
        severity: 'medium',
        message: error.message,
        stack: error.stack,
        context,
        impact: {
          userImpact: 'minor',
          functionalityImpact: [context.operation || 'unknown'],
        },
      });
    },
  };
}

// Global error handler
export function setupGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const { captureError } = useErrorTrackingStore.getState();
    
    captureError({
      category: 'runtime',
      source: 'react-component',
      severity: 'high',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      context: {
        operation: 'promise-rejection',
      },
      impact: {
        userImpact: 'minor',
        functionalityImpact: ['async-operation'],
      },
      tags: ['unhandled-rejection'],
    });
  });
  
  // Handle global errors
  window.addEventListener('error', (event) => {
    const { captureError } = useErrorTrackingStore.getState();
    
    captureError({
      category: 'runtime',
      source: 'react-component',
      severity: 'high',
      message: event.message,
      stack: event.error?.stack,
      context: {
        operation: 'global-error',
        component: event.filename,
      },
      details: {
        lineno: event.lineno,
        colno: event.colno,
      },
      impact: {
        userImpact: 'major',
        functionalityImpact: ['application'],
      },
      tags: ['global-error'],
    });
  });
}