import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  ChevronUp,
  ChevronDown,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMonitoringStore } from '@/stores/monitoringStore';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StatusBarProps {
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ className }) => {
  const {
    operations,
    activeOperations,
    errors,
    errorCounts,
    isStatusBarExpanded,
    toggleStatusBar,
    acknowledgeError,
    clearErrors,
    getOverallProgress,
  } = useMonitoringStore();

  const activeOps = useMemo(() => {
    return activeOperations
      .map(id => operations.get(id))
      .filter(Boolean)
      .sort((a, b) => (b?.startTime || 0) - (a?.startTime || 0));
  }, [activeOperations, operations]);

  const unacknowledgedErrors = useMemo(() => {
    return errors.filter(err => !err.acknowledged).slice(0, 5);
  }, [errors]);

  const overallProgress = getOverallProgress();
  const hasErrors = Object.values(errorCounts).some(count => count > 0);
  const totalErrors = Object.values(errorCounts).reduce((sum, count) => sum + count, 0);

  return (
    <TooltipProvider>
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t z-50",
          "transition-all duration-300 ease-in-out",
          isStatusBarExpanded ? "h-auto max-h-64" : "h-6",
          className
        )}
      >
        {/* Collapsed View */}
        <div 
          className="h-6 px-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={toggleStatusBar}
        >
          <div className="flex items-center gap-3 text-xs">
            {/* Active Operations */}
            {activeOps.length > 0 && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-muted-foreground">
                  {activeOps.length} operation{activeOps.length > 1 ? 's' : ''} running
                </span>
                <div className="w-24 h-1.5">
                  <Progress value={overallProgress} className="h-full" />
                </div>
              </div>
            )}
            
            {/* Error Count */}
            {hasErrors && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {errorCounts.critical > 0 && (
                    <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                      {errorCounts.critical}
                    </Badge>
                  )}
                  {errorCounts.high > 0 && (
                    <Badge variant="destructive" className="h-4 px-1 text-[10px] bg-orange-500">
                      {errorCounts.high}
                    </Badge>
                  )}
                  {errorCounts.medium > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {errorCounts.medium}
                    </Badge>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {totalErrors} error{totalErrors > 1 ? 's' : ''}
                </span>
              </div>
            )}
            
            {/* Status Indicator */}
            {!activeOps.length && !hasErrors && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>All operations completed</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleStatusBar();
              }}
            >
              {isStatusBarExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        {/* Expanded View */}
        <AnimatePresence>
          {isStatusBarExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 space-y-3 max-h-60 overflow-y-auto">
                {/* Active Operations Section */}
                {activeOps.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Active Operations
                    </div>
                    {activeOps.map((op) => op && (
                      <OperationItem key={op.id} operation={op} />
                    ))}
                  </div>
                )}
                
                {/* Errors Section */}
                {unacknowledgedErrors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Recent Errors
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-xs"
                        onClick={() => clearErrors()}
                      >
                        Clear All
                      </Button>
                    </div>
                    {unacknowledgedErrors.map((error) => (
                      <ErrorItem 
                        key={error.id} 
                        error={error} 
                        onAcknowledge={() => acknowledgeError(error.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
};

interface OperationItemProps {
  operation: NonNullable<ReturnType<typeof useMonitoringStore>['operations']['get']>;
}

const OperationItem: React.FC<OperationItemProps> = ({ operation }) => {
  const { cancelOperation } = useMonitoringStore();
  
  const getOperationIcon = () => {
    switch (operation.status) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-destructive" />;
      default:
        return <Activity className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getDuration = () => {
    const endTime = operation.endTime || Date.now();
    const duration = endTime - operation.startTime;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  const handleStopOperation = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelOperation(operation.id);
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
      {getOperationIcon()}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{operation.name}</div>
        {operation.description && (
          <div className="text-xs text-muted-foreground truncate">{operation.description}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{getDuration()}</span>
        <div className="w-20">
          <Progress 
            value={operation.progress} 
            className="h-1"
            indicatorClassName={operation.status === 'error' ? 'bg-destructive' : ''}
          />
        </div>
        {/* Stop button for running operations */}
        {operation.status === 'running' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleStopOperation}
              >
                <X className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop Operation</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

interface ErrorItemProps {
  error: ReturnType<typeof useMonitoringStore>['errors'][0];
  onAcknowledge: () => void;
}

const ErrorItem: React.FC<ErrorItemProps> = ({ error, onAcknowledge }) => {
  const getSeverityColor = () => {
    switch (error.severity) {
      case 'critical':
        return 'text-destructive';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
      <AlertTriangle className={cn('h-3 w-3 mt-0.5', getSeverityColor())} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium">{error.category}</div>
        <div className="text-xs text-muted-foreground">{error.message}</div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0"
            onClick={onAcknowledge}
          >
            <X className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Dismiss</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default StatusBar;