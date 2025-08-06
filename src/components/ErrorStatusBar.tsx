import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  X,
  ChevronUp,
  ChevronDown,
  Bug,
  AlertTriangle,
  Info,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useErrorTrackingStore } from '@/stores/errorTrackingStore';
import { formatDistanceToNow } from 'date-fns';

interface ErrorStatusBarProps {
  className?: string;
}

export const ErrorStatusBar: React.FC<ErrorStatusBarProps> = ({ className }) => {
  const {
    errors,
    statistics,
    toggleErrorDashboard,
    isErrorDashboardOpen,
  } = useErrorTrackingStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [recentError, setRecentError] = useState<any>(null);

  // Get unresolved errors
  const unresolvedErrors = Array.from(errors.values()).filter(e => !e.resolved);
  const criticalErrors = unresolvedErrors.filter(e => e.severity === 'critical');
  const highErrors = unresolvedErrors.filter(e => e.severity === 'high');

  // Watch for new errors
  useEffect(() => {
    const unsubscribe = useErrorTrackingStore.subscribe(
      (state) => state.errors,
      (errors) => {
        // Find the most recent unresolved error
        const recent = Array.from(errors.values())
          .filter(e => !e.resolved)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        if (recent && recent.timestamp > Date.now() - 5000) {
          setRecentError(recent);
          // Auto-hide after 5 seconds
          setTimeout(() => setRecentError(null), 5000);
        }
      }
    );

    return unsubscribe;
  }, []);

  // Don't show if no errors
  if (unresolvedErrors.length === 0 && !recentError) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive text-destructive-foreground';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-white';
      case 'low':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4" />;
      case 'high':
        return <AlertCircle className="h-4 w-4" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4" />;
      case 'low':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Recent Error Notification */}
      <AnimatePresence>
        {recentError && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed top-4 right-4 z-50 max-w-md"
          >
            <div
              className={cn(
                'rounded-lg shadow-lg border p-4',
                getSeverityColor(recentError.severity)
              )}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(recentError.severity)}
                <div className="flex-1">
                  <p className="font-medium">New Error Detected</p>
                  <p className="text-sm opacity-90 line-clamp-2">{recentError.message}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mr-2 -mt-2"
                  onClick={() => setRecentError(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    toggleErrorDashboard();
                    setRecentError(null);
                  }}
                  className="gap-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Details
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Status Bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className={cn(
          'fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-40',
          className
        )}
      >
        <div className="container mx-auto">
          {/* Collapsed View */}
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-destructive" />
                <span className="font-medium">Error Tracking</span>
              </div>
              
              {/* Error Summary */}
              <div className="flex items-center gap-3">
                {criticalErrors.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {criticalErrors.length} Critical
                  </Badge>
                )}
                {highErrors.length > 0 && (
                  <Badge className="bg-orange-500 text-white gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {highErrors.length} High
                  </Badge>
                )}
                {unresolvedErrors.length > 0 && (
                  <Badge variant="secondary">
                    {unresolvedErrors.length} Total Unresolved
                  </Badge>
                )}
              </div>

              {/* Error Rate */}
              {statistics.errorRate > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  <span>{statistics.errorRate.toFixed(1)} errors/min</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleErrorDashboard();
                }}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Dashboard
              </Button>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Expanded View */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t"
              >
                <div className="p-4 space-y-3">
                  {/* Resolution Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Resolution Rate</span>
                      <span className="font-medium">{statistics.resolutionRate.toFixed(0)}%</span>
                    </div>
                    <Progress value={statistics.resolutionRate} className="h-2" />
                  </div>

                  {/* Recent Errors List */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recent Errors</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {unresolvedErrors.slice(0, 5).map((error) => (
                        <div
                          key={error.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                          onClick={() => {
                            useErrorTrackingStore.getState().selectError(error.id);
                            toggleErrorDashboard();
                          }}
                        >
                          {getSeverityIcon(error.severity)}
                          <span className="flex-1 line-clamp-1">{error.message}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(error.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 gap-4 pt-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{statistics.totalErrors}</div>
                      <div className="text-xs text-muted-foreground">Total Errors</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-destructive">
                        {statistics.errorsBySeverity.critical || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Critical</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">
                        {statistics.errorsBySeverity.high || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">High</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">
                        {Math.round(statistics.resolutionRate)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Resolved</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};

// Missing import
import { Activity } from 'lucide-react';