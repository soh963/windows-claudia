import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StopCircle, Clock, Hash, RefreshCw, PlayCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  className 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);

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

          {/* Status text */}
          <span className={cn("text-sm font-medium", statusConfig.color)}>
            {statusConfig.text}
          </span>

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
            </TooltipProvider>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Add rotating animation CSS
const styles = `
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotating-symbol::before {
  content: "⚡";
  display: inline-block;
  animation: rotate 2s linear infinite;
  font-size: 16px;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}