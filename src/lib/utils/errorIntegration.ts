import { errorTrackerStore, trackApiError, trackSessionError, ErrorCategory, ErrorSeverity } from '$lib/stores/errorTrackerStore';

/**
 * Enhanced error handling wrapper for async functions
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  component: string,
  options?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    sessionId?: string;
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error: any) {
      // Track the error
      await errorTrackerStore.trackError(
        error.message || String(error),
        component,
        {
          category: options?.category || ErrorCategory.Unknown,
          severity: options?.severity || ErrorSeverity.High,
          stackTrace: error.stack,
          context: {
            function: fn.name || 'anonymous',
            args: JSON.stringify(args).slice(0, 1000), // Limit context size
          },
          sessionId: options?.sessionId
        }
      );
      
      // Re-throw the error
      throw error;
    }
  }) as T;
}

/**
 * Decorator for class methods to automatically track errors
 */
export function TrackErrors(category: ErrorCategory = ErrorCategory.Unknown) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error: any) {
        await errorTrackerStore.trackError(
          error.message || String(error),
          `${target.constructor.name}.${propertyName}`,
          {
            category,
            severity: ErrorSeverity.High,
            stackTrace: error.stack,
            context: {
              class: target.constructor.name,
              method: propertyName,
              args: JSON.stringify(args).slice(0, 1000),
            }
          }
        );
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Integration with existing error handlers
 */
export function integrateWithExecutionControl() {
  // Patch the existing executionControl error handling
  const originalModule = import('$lib/executionControl');
  
  originalModule.then(module => {
    const ExecutionControlAPI = module.ExecutionControlAPI;
    
    // Wrap each method with error tracking
    const methods = [
      'stopExecution',
      'continueExecution',
      'resetExecution',
      'getExecutionStatus',
      'updateExecutionMetrics'
    ];
    
    methods.forEach(method => {
      const original = ExecutionControlAPI[method];
      ExecutionControlAPI[method] = withErrorTracking(
        original,
        `ExecutionControlAPI.${method}`,
        {
          category: ErrorCategory.SessionManagement,
          severity: ErrorSeverity.High
        }
      );
    });
  });
}

/**
 * Integration with Gemini API calls
 */
export function integrateWithGeminiAPI() {
  // Intercept Tauri invoke calls for Gemini commands
  const originalInvoke = window.__TAURI__?.core?.invoke;
  
  if (originalInvoke) {
    window.__TAURI__.core.invoke = async function(cmd: string, args?: any) {
      const geminiCommands = [
        'execute_gemini_code',
        'test_gemini_api',
        'get_gemini_models',
        'gemini_chat'
      ];
      
      if (geminiCommands.includes(cmd)) {
        try {
          return await originalInvoke(cmd, args);
        } catch (error: any) {
          // Track Gemini-specific errors
          await trackApiError(
            error,
            cmd,
            'invoke',
            args?.sessionId
          );
          
          // Check for quota errors
          if (error.message?.includes('quota') || error.message?.includes('429')) {
            await errorTrackerStore.trackError(
              'Gemini API quota exceeded',
              'gemini.api',
              {
                category: ErrorCategory.Network,
                severity: ErrorSeverity.High,
                context: {
                  command: cmd,
                  error: error.message
                }
              }
            );
          }
          
          throw error;
        }
      }
      
      return originalInvoke(cmd, args);
    };
  }
}

/**
 * Integration with session management
 */
export function integrateWithSessionManagement() {
  // Monitor session-related errors
  const sessionErrorPatterns = [
    { pattern: /session.*not.*found/i, type: 'session_not_found' },
    { pattern: /session.*expired/i, type: 'session_expired' },
    { pattern: /invalid.*session/i, type: 'invalid_session' },
    { pattern: /session.*conflict/i, type: 'session_conflict' }
  ];
  
  // Override console.error to catch session errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.map(arg => String(arg)).join(' ');
    
    for (const { pattern, type } of sessionErrorPatterns) {
      if (pattern.test(message)) {
        // Extract session ID if possible
        const sessionIdMatch = message.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        const sessionId = sessionIdMatch ? sessionIdMatch[1] : undefined;
        
        trackSessionError(
          { message, stack: new Error().stack },
          sessionId || 'unknown',
          type
        );
        break;
      }
    }
    
    originalConsoleError.apply(console, args);
  };
}

/**
 * Integration with UI duplicate detection
 */
export function integrateWithUITracking() {
  // Monitor for duplicate rendering
  let renderCounts = new Map<string, number>();
  let resetTimer: number;
  
  function trackRender(componentName: string) {
    const count = (renderCounts.get(componentName) || 0) + 1;
    renderCounts.set(componentName, count);
    
    // Check for excessive renders
    if (count > 10) {
      errorTrackerStore.trackError(
        `Component "${componentName}" rendered ${count} times in short period`,
        'ui.render',
        {
          category: ErrorCategory.UI,
          severity: ErrorSeverity.Medium,
          context: {
            component: componentName,
            renderCount: String(count)
          }
        }
      );
    }
    
    // Reset counts periodically
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      renderCounts.clear();
    }, 5000) as any;
  }
  
  // Export for use in components
  return { trackRender };
}

/**
 * Initialize all integrations
 */
export function initializeErrorTracking() {
  // Setup global error tracking
  import('$lib/stores/errorTrackerStore').then(module => {
    module.setupGlobalErrorTracking();
  });
  
  // Integrate with existing systems
  integrateWithExecutionControl();
  integrateWithGeminiAPI();
  integrateWithSessionManagement();
  
  // Initialize the error tracker store
  errorTrackerStore.initialize();
  
  console.log('Error tracking system initialized');
}

/**
 * Cleanup function for when the app is closing
 */
export function cleanupErrorTracking() {
  errorTrackerStore.cleanup();
}