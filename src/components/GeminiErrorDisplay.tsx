import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Copy,
  Bug,
  Info,
  Loader2,
  ExternalLink,
  Clock,
  XCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface GeminiError {
  code: string;
  message: string;
  timestamp?: number;
  details?: {
    reason?: string;
    domain?: string;
    metadata?: Record<string, any>;
  };
  retryAfter?: number;
  retryCount?: number;
  maxRetries?: number;
}

interface GeminiErrorDisplayProps {
  error: GeminiError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

interface RetryState {
  isRetrying: boolean;
  nextRetryIn: number;
  attempt: number;
}

// Error code mappings for user-friendly messages
const ERROR_MAPPINGS: Record<string, {
  title: string;
  description: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
  recoverable: boolean;
}> = {
  'INVALID_API_KEY': {
    title: 'Invalid API Key',
    description: 'The provided API key is invalid or has been revoked.',
    suggestion: 'Please check your API key in Settings > Models > Advanced and ensure it\'s correctly entered.',
    severity: 'error',
    recoverable: false
  },
  'QUOTA_EXCEEDED': {
    title: 'API Quota Exceeded',
    description: 'You have exceeded your API quota for this billing period.',
    suggestion: 'Consider upgrading your Google AI Studio plan or wait for the quota to reset.',
    severity: 'warning',
    recoverable: true
  },
  'RATE_LIMITED': {
    title: 'Rate Limit Exceeded',
    description: 'Too many requests have been made in a short period.',
    suggestion: 'Please wait a moment before trying again. Consider implementing request throttling.',
    severity: 'warning',
    recoverable: true
  },
  'INVALID_REQUEST': {
    title: 'Invalid Request Format',
    description: 'The request format is invalid or contains unsupported parameters.',
    suggestion: 'This might be a bug. Please report it with the error details.',
    severity: 'error',
    recoverable: false
  },
  'RESOURCE_EXHAUSTED': {
    title: 'Model Overloaded',
    description: 'The model is currently experiencing high load.',
    suggestion: 'Try again in a few moments or consider using a different model.',
    severity: 'warning',
    recoverable: true
  },
  'PERMISSION_DENIED': {
    title: 'Permission Denied',
    description: 'Your API key doesn\'t have permission to access this resource.',
    suggestion: 'Check that your API key has the necessary permissions in Google AI Studio.',
    severity: 'error',
    recoverable: false
  },
  'NOT_FOUND': {
    title: 'Resource Not Found',
    description: 'The requested model or resource could not be found.',
    suggestion: 'The model might have been deprecated. Try using a different model.',
    severity: 'error',
    recoverable: false
  },
  'INTERNAL': {
    title: 'Internal Server Error',
    description: 'An internal error occurred on Google\'s servers.',
    suggestion: 'This is a temporary issue. Please try again later.',
    severity: 'error',
    recoverable: true
  },
  'UNAVAILABLE': {
    title: 'Service Unavailable',
    description: 'The Gemini API service is temporarily unavailable.',
    suggestion: 'Check Google AI Studio status page for any ongoing incidents.',
    severity: 'warning',
    recoverable: true
  }
};

/**
 * RetryCountdown component - Shows countdown timer for retry
 */
const RetryCountdown: React.FC<{
  retryAfter: number;
  onComplete: () => void;
}> = ({ retryAfter, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(retryAfter);

  React.useEffect(() => {
    if (timeLeft <= 0) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="h-3.5 w-3.5 animate-pulse" />
      <span>Retrying in {timeLeft}s...</span>
    </div>
  );
};

/**
 * GeminiErrorDisplay component - Enhanced error display for Gemini API errors
 */
export const GeminiErrorDisplay: React.FC<GeminiErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    nextRetryIn: 0,
    attempt: error.retryCount || 0
  });

  const errorInfo = ERROR_MAPPINGS[error.code] || {
    title: error.code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    description: error.message,
    suggestion: 'An unexpected error occurred. Please try again.',
    severity: 'error' as const,
    recoverable: true
  };

  const handleCopyError = () => {
    const errorText = JSON.stringify({
      code: error.code,
      message: error.message,
      timestamp: error.timestamp || Date.now(),
      details: error.details
    }, null, 2);
    
    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    if (error.retryAfter && error.retryAfter > 0) {
      setRetryState({
        isRetrying: true,
        nextRetryIn: error.retryAfter,
        attempt: (error.retryCount || 0) + 1
      });
    } else {
      onRetry?.();
    }
  };

  const handleRetryComplete = () => {
    setRetryState(prev => ({ ...prev, isRetrying: false, nextRetryIn: 0 }));
    onRetry?.();
  };

  const getSeverityIcon = () => {
    switch (errorInfo.severity) {
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getSeverityStyles = () => {
    switch (errorInfo.severity) {
      case 'warning':
        return 'border-amber-500/50 bg-amber-500/10';
      case 'info':
        return 'border-blue-500/50 bg-blue-500/10';
      default:
        return 'border-destructive/50 bg-destructive/10';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "rounded-lg border p-4",
        getSeverityStyles(),
        className
      )}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {getSeverityIcon()}
            <div className="flex-1 space-y-1">
              <h4 className="font-medium">{errorInfo.title}</h4>
              <p className="text-sm text-muted-foreground">
                {errorInfo.description}
              </p>
            </div>
          </div>
          
          {/* Error badges */}
          <div className="flex items-center gap-2">
            {error.retryCount && error.retryCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                Retry {error.retryCount}/{error.maxRetries || 3}
              </Badge>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onDismiss}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Suggestion */}
        <Alert className="border-0 bg-background/50 p-3">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {errorInfo.suggestion}
          </AlertDescription>
        </Alert>

        {/* Retry countdown */}
        {retryState.isRetrying && retryState.nextRetryIn > 0 && (
          <div className="flex items-center justify-between p-3 bg-background/50 rounded-md">
            <RetryCountdown
              retryAfter={retryState.nextRetryIn}
              onComplete={handleRetryComplete}
            />
            <Badge variant="outline" className="text-xs">
              Attempt {retryState.attempt}
            </Badge>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onRetry && errorInfo.recoverable && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={retryState.isRetrying}
              className="gap-2"
            >
              {retryState.isRetrying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Waiting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry
                </>
              )}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="gap-2"
          >
            {showDetails ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show Details
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyError}
            className="gap-2"
          >
            {copied ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Details section */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Separator className="my-3" />
              
              <div className="space-y-3">
                {/* Error metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Error Code:</span>
                    <p className="font-mono mt-1">{error.code}</p>
                  </div>
                  {error.timestamp && (
                    <div>
                      <span className="text-muted-foreground">Timestamp:</span>
                      <p className="font-mono mt-1">
                        {new Date(error.timestamp).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Technical details */}
                {error.details && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Technical Details:</span>
                    <pre className="p-3 bg-background rounded-md border text-xs font-mono overflow-x-auto">
                      {JSON.stringify(error.details, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Help resources */}
                <div className="flex items-center gap-4 pt-2">
                  <a
                    href="https://ai.google.dev/gemini-api/docs/troubleshooting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Troubleshooting Guide
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://github.com/google/generative-ai-docs/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Report Issue
                    <Bug className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};