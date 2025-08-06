import { useEffect } from 'react';
import { useMonitoringStore } from '@/stores/monitoringStore';
import { useErrorTrackingStore } from '@/stores/errorTrackingStore';
import { setupGlobalErrorHandlers } from '@/stores/errorTrackingStore';

/**
 * Hook to integrate error tracking with the monitoring system
 */
export function useErrorIntegration() {
  const { operations } = useMonitoringStore();
  const { captureError } = useErrorTrackingStore();

  useEffect(() => {
    // Set up global error handlers
    setupGlobalErrorHandlers();

    // Subscribe to monitoring store to capture operation errors
    const unsubscribe = useMonitoringStore.subscribe(
      (state) => state.operations,
      (operations) => {
        // Check for new errors in operations
        operations.forEach((operation) => {
          if (operation.status === 'error' && operation.error) {
            // Check if this error was already captured
            const errorKey = `${operation.id}_error`;
            const capturedErrors = new Set(
              sessionStorage.getItem('captured_operation_errors')?.split(',') || []
            );

            if (!capturedErrors.has(errorKey)) {
              // Capture the error
              captureError({
                category: mapOperationTypeToCategory(operation.type),
                source: mapOperationTypeToSource(operation.type),
                severity: operation.error.severity,
                message: operation.error.message,
                context: {
                  operation: operation.name,
                  component: operation.metadata?.component,
                  operationId: operation.id,
                },
                details: operation.error.details,
                impact: {
                  userImpact: operation.error.severity === 'critical' ? 'blocking' : 
                             operation.error.severity === 'high' ? 'major' : 'minor',
                  functionalityImpact: [operation.name],
                },
                tags: ['operation-error', operation.type],
              });

              // Mark as captured
              capturedErrors.add(errorKey);
              sessionStorage.setItem('captured_operation_errors', Array.from(capturedErrors).join(','));
            }
          }
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [captureError]);
}

// Helper function to map operation types to error categories
function mapOperationTypeToCategory(operationType: string): ErrorCategory {
  const mapping: Record<string, ErrorCategory> = {
    'api_call': 'api',
    'file_operation': 'filesystem',
    'tool_execution': 'tool',
    'build_process': 'build',
    'gemini_request': 'api',
    'claude_request': 'api',
  };
  return mapping[operationType] || 'runtime';
}

// Helper function to map operation types to error sources
function mapOperationTypeToSource(operationType: string): ErrorSource {
  const mapping: Record<string, ErrorSource> = {
    'api_call': 'tauri-backend',
    'file_operation': 'file-system',
    'tool_execution': 'tool-execution',
    'build_process': 'build-process',
    'gemini_request': 'gemini-api',
    'claude_request': 'claude-api',
  };
  return mapping[operationType] || 'tauri-backend';
}

// Import types
import type { ErrorCategory, ErrorSource } from '@/stores/errorTrackingStore';

/**
 * Hook to capture API errors with enhanced context
 */
export function useApiErrorCapture() {
  const { captureApiError } = useErrorTrackingStore();

  return {
    captureGeminiError: (error: any, endpoint?: string) => {
      captureApiError('gemini-api', error, endpoint);
    },
    
    captureClaudeError: (error: any, endpoint?: string) => {
      captureApiError('claude-api', error, endpoint);
    },
    
    captureTauriError: (error: any, command?: string) => {
      captureApiError('tauri-backend', error, command);
    },
  };
}

/**
 * Hook to track component errors with error boundary
 */
export function useComponentErrorTracking(componentName: string) {
  const { captureErrorBoundary } = useErrorTrackingStore();

  return {
    onError: (error: Error, errorInfo: React.ErrorInfo) => {
      captureErrorBoundary(error, errorInfo, componentName);
    },
  };
}