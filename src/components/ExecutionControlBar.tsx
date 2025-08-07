import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  StopCircle, 
  Clock, 
  Hash, 
  RefreshCw, 
  PlayCircle, 
  AlertCircle,
  Activity,
  ChevronUp,
  ChevronDown,
  Pause,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export interface Operation {
  id: string;
  name: string;
  type: 'model_execution' | 'file_operation' | 'network_request' | 'background_task';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  progress?: number;
  model?: string;
  description?: string;
  canStop: boolean;
  canPause: boolean;
  error?: string;
  tokens?: number;
}

interface ExecutionControlBarProps {
  isExecuting: boolean;
  onStop: () => void;
  onContinue?: () => void;
  onReset?: () => void;
  totalTokens?: number;
  elapsedTime?: number; // in seconds
  status?: 'executing' | 'stopped' | 'error' | 'completed';
  canContinue?: boolean;
  className?: string;
  // New props for enhanced operations
  operations?: Operation[];
  activeOperations?: Operation[];
  completedOperations?: Operation[];
  onStopOperation?: (id: string) => void;
  onPauseOperation?: (id: string) => void;
  onResumeOperation?: (id: string) => void;
  onClearCompleted?: () => void;
  showOperationsList?: boolean;
}

/**
 * Enhanced execution control bar with stop, continue, and reset functionality
 * Provides real-time statistics and execution control
 */
export const ExecutionControlBar: React.FC<ExecutionControlBarProps> = ({ 
  isExecuting, 
  onStop, 
  onContinue,
  onReset,
  totalTokens = 0,
  elapsedTime = 0,
  status = 'executing',
  canContinue = false,
  className,
  operations = [],
  activeOperations = [],
  completedOperations = [],
  onStopOperation,
  onPauseOperation,
  onResumeOperation,
  onClearCompleted,
  showOperationsList = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [showOperations, setShowOperations] = useState(showOperationsList);
  
  // Calculate active and completed from operations if not provided
  const activeOps = activeOperations.length > 0 ? activeOperations : 
    operations.filter(op => op.status === 'running' || op.status === 'paused' || op.status === 'pending');
  const completedOps = completedOperations.length > 0 ? completedOperations :
    operations.filter(op => op.status === 'completed' || op.status === 'failed' || op.status === 'cancelled');

  useEffect(() => {
    if (isExecuting || status === 'stopped' || status === 'error') {
      setIsVisible(true);
      setAnimatingOut(false);
    } else if (status === 'completed') {
      // Keep visible for 2 seconds after completion
      setTimeout(() => {
        setAnimatingOut(true);
        setTimeout(() => setIsVisible(false), 300);
      }, 2000);
    }
  }, [isExecuting, status]);

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toFixed(0)}s`;
    }
    return `${secs.toFixed(1)}s`;
  };

  // Format token count
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  // Get status color and icon
  const getStatusConfig = () => {
    switch (status) {
      case 'executing':
        return {
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          text: 'Executing...',
          showSpinner: true
        };
      case 'stopped':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-600/10 dark:bg-yellow-400/10',
          text: 'Stopped',
          showSpinner: false
        };
      case 'error':
        return {
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          text: 'Error',
          showSpinner: false
        };
      case 'completed':
        return {
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-600/10 dark:bg-green-400/10',
          text: 'Completed',
          showSpinner: false
        };
      default:
        return {
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          text: 'Ready',
          showSpinner: false
        };
    }
  };

  const statusConfig = getStatusConfig();
  
  // Get status icon for operations
  const getOperationIcon = (opStatus: Operation['status']) => {
    switch (opStatus) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case 'paused':
        return <Pause className="h-3 w-3 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-3 w-3 text-gray-500" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-gray-400" />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && !animatingOut && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
            "bg-background/95 backdrop-blur-md border rounded-full shadow-lg",
            "px-6 py-3 flex items-center gap-4",
            "min-w-[400px]",
            className
          )}
        >
          {/* Status indicator */}
          <div className="relative flex items-center justify-center">
            {statusConfig.showSpinner ? (
              <div className="rotating-symbol text-primary"></div>
            ) : status === 'error' ? (
              <AlertCircle className={cn("h-4 w-4", statusConfig.color)} />
            ) : null}
          </div>

          {/* Status text with operations count */}
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium", statusConfig.color)}>
              {statusConfig.text}
            </span>
            {activeOps.length > 0 && (
              <Badge variant="default" className="text-xs">
                {activeOps.length} active
              </Badge>
            )}
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-border" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {/* Time */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatTime(elapsedTime)}</span>
            </div>

            {/* Tokens */}
            <div className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" />
              <span>{formatTokens(totalTokens)} tokens</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-border" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <TooltipProvider>
              {/* Stop/Continue button */}
              {isExecuting ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={onStop}
                      className="gap-2"
                    >
                      <StopCircle className="h-3.5 w-3.5" />
                      Stop
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop current execution</p>
                  </TooltipContent>
                </Tooltip>
              ) : status === 'stopped' && canContinue && onContinue ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={onContinue}
                      className="gap-2"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Continue
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Continue from where you stopped</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}

              {/* Reset button */}
              {(status === 'stopped' || status === 'error') && onReset && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onReset}
                      className="gap-2"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear session and start fresh</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Operations toggle button */}
              {(activeOps.length > 0 || completedOps.length > 0) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowOperations(!showOperations)}
                      className="gap-1.5"
                    >
                      <Activity className="h-3.5 w-3.5" />
                      {showOperations ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showOperations ? 'Hide' : 'Show'} operations</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Clear completed button */}
              {completedOps.length > 0 && onClearCompleted && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onClearCompleted}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear completed operations</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </motion.div>
      )}
      
      {/* Operations List Panel */}
      {showOperations && (activeOps.length > 0 || completedOps.length > 0) && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[500px]"
        >
          <Card className="bg-background/95 backdrop-blur-md border shadow-lg p-3 max-h-64 overflow-y-auto">
            {/* Active Operations */}
            {activeOps.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Active Operations</h4>
                <div className="space-y-1">
                  {activeOps.slice(0, 5).map(op => (
                    <div key={op.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <div className="flex items-center gap-2">
                        {getOperationIcon(op.status)}
                        <span className="text-xs">{op.name}</span>
                        {op.model && <Badge variant="outline" className="text-xs h-4">{op.model}</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        {op.canPause && op.status === 'running' && onPauseOperation && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onPauseOperation(op.id)}
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                        )}
                        {op.status === 'paused' && onResumeOperation && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onResumeOperation(op.id)}
                          >
                            <PlayCircle className="h-3 w-3" />
                          </Button>
                        )}
                        {op.canStop && onStopOperation && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 hover:bg-destructive/20"
                            onClick={() => onStopOperation(op.id)}
                          >
                            <StopCircle className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Completed Operations */}
            {completedOps.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Completed Activities</h4>
                <div className="space-y-1">
                  {completedOps.slice(0, 3).map(op => (
                    <div key={op.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        {getOperationIcon(op.status)}
                        <span className="text-xs text-muted-foreground">{op.name}</span>
                        {op.tokens && (
                          <span className="text-xs text-muted-foreground">
                            ({op.tokens} tokens)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 