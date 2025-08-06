import React, { useEffect } from 'react';
import { ErrorDashboard } from './ErrorDashboard';
import { ErrorStatusBar } from './ErrorStatusBar';
import { AppErrorBoundary } from './ErrorBoundaryWrapper';
import { useErrorIntegration } from '@/hooks/useErrorIntegration';
import { useErrorTrackingStore } from '@/stores/errorTrackingStore';
import { AnimatePresence } from 'framer-motion';

interface ErrorTrackingSetupProps {
  children: React.ReactNode;
}

/**
 * Main component to set up error tracking for the entire application
 */
export const ErrorTrackingSetup: React.FC<ErrorTrackingSetupProps> = ({ children }) => {
  const { isErrorDashboardOpen } = useErrorTrackingStore();
  
  // Initialize error integration with monitoring store
  useErrorIntegration();

  // Set up periodic statistics update
  useEffect(() => {
    const { updateStatistics } = useErrorTrackingStore.getState();
    
    // Update statistics every 30 seconds
    const interval = setInterval(() => {
      updateStatistics();
    }, 30000);

    // Initial update
    updateStatistics();

    return () => clearInterval(interval);
  }, []);

  return (
    <AppErrorBoundary>
      {children}
      
      {/* Error Status Bar - Always visible when there are errors */}
      <ErrorStatusBar />
      
      {/* Error Dashboard - Modal view */}
      <AnimatePresence>
        {isErrorDashboardOpen && <ErrorDashboard />}
      </AnimatePresence>
    </AppErrorBoundary>
  );
};

/**
 * Hook to access error tracking functionality throughout the app
 */
export function useErrorTracking() {
  const {
    toggleErrorDashboard,
    captureError,
    statistics,
    errors,
  } = useErrorTrackingStore();

  return {
    openDashboard: toggleErrorDashboard,
    captureError,
    errorCount: statistics.totalErrors,
    unresolvedCount: Array.from(errors.values()).filter(e => !e.resolved).length,
    criticalCount: statistics.errorsBySeverity.critical || 0,
    errorRate: statistics.errorRate,
  };
}

/**
 * Example integration in App.tsx:
 * 
 * import { ErrorTrackingSetup } from '@/components/ErrorTrackingSetup';
 * 
 * function App() {
 *   return (
 *     <ErrorTrackingSetup>
 *       <YourAppContent />
 *     </ErrorTrackingSetup>
 *   );
 * }
 * 
 * 
 * Example usage in components:
 * 
 * import { useErrorTracking } from '@/components/ErrorTrackingSetup';
 * import { useErrorCapture } from '@/stores/errorTrackingStore';
 * 
 * function MyComponent() {
 *   const { openDashboard, errorCount } = useErrorTracking();
 *   const { captureWithContext } = useErrorCapture();
 *   
 *   const handleOperation = async () => {
 *     try {
 *       // Your operation
 *     } catch (error) {
 *       captureWithContext(error, {
 *         component: 'MyComponent',
 *         operation: 'handleOperation'
 *       });
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       {errorCount > 0 && (
 *         <button onClick={openDashboard}>
 *           View {errorCount} errors
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 */