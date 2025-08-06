import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Key,
  Zap,
  Sparkles,
  Star,
  Brain,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getModelById,
  isGeminiModel,
  type Model,
} from "@/lib/models";
import { api } from "@/lib/api";

interface ModelStatusIndicatorProps {
  /**
   * Current model ID
   */
  modelId: string;
  /**
   * Whether a request is in progress
   */
  isLoading?: boolean;
  /**
   * Current error state
   */
  error?: string | null;
  /**
   * Response time in milliseconds
   */
  responseTime?: number;
  /**
   * Token usage information
   */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /**
   * Show expanded view
   */
  expanded?: boolean;
  /**
   * Callback when retry is clicked
   */
  onRetry?: () => void;
  /**
   * Optional className
   */
  className?: string;
}

// Model icons mapping
const MODEL_ICONS: Record<string, React.ReactNode> = {
  'sonnet': <Zap className="h-4 w-4" />,
  'opus': <Sparkles className="h-4 w-4" />,
  'gemini-2.0-flash-exp': <Star className="h-4 w-4" />,
  'gemini-exp-1206': <Brain className="h-4 w-4" />
};

// Status states
type StatusState = "ready" | "loading" | "error" | "offline" | "api-key-missing";

/**
 * ModelStatusIndicator component - Shows model status and performance metrics
 */
export const ModelStatusIndicator: React.FC<ModelStatusIndicatorProps> = ({
  modelId,
  isLoading = false,
  error = null,
  responseTime,
  tokenUsage,
  expanded = false,
  onRetry,
  className,
}) => {
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(true);
  const [checkingApiKey, setCheckingApiKey] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const model = getModelById(modelId);
  const isGemini = isGeminiModel(modelId);

  // Check for Gemini API key
  useEffect(() => {
    const checkApiKey = async () => {
      if (isGemini) {
        setCheckingApiKey(true);
        try {
          const key = await api.getGeminiApiKey();
          setHasGeminiApiKey(!!key);
        } catch (err) {
          console.error("Failed to check Gemini API key:", err);
          setHasGeminiApiKey(false);
        } finally {
          setCheckingApiKey(false);
        }
      }
    };

    checkApiKey();
  }, [modelId, isGemini]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Determine current status
  const getStatus = (): StatusState => {
    if (!isOnline) return "offline";
    if (isGemini && !hasGeminiApiKey && !checkingApiKey) return "api-key-missing";
    if (error) return "error";
    if (isLoading) return "loading";
    return "ready";
  };

  const status = getStatus();

  // Status configurations
  const statusConfig = {
    ready: {
      icon: <CheckCircle className="h-4 w-4" />,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      label: "Ready",
      description: "Model is ready to use",
    },
    loading: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      label: "Processing",
      description: "Generating response...",
    },
    error: {
      icon: <AlertCircle className="h-4 w-4" />,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      label: "Error",
      description: error || "An error occurred",
    },
    offline: {
      icon: <WifiOff className="h-4 w-4" />,
      color: "text-gray-500",
      bgColor: "bg-gray-500/10",
      label: "Offline",
      description: "No internet connection",
    },
    "api-key-missing": {
      icon: <Key className="h-4 w-4" />,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      label: "API Key Required",
      description: "Gemini API key not configured",
    },
  };

  const config = statusConfig[status];

  // Compact indicator
  if (!expanded) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                config.bgColor,
                className
              )}
            >
              <div className={config.color}>{config.icon}</div>
              {model && (
                <div className="flex items-center gap-1">
                  {MODEL_ICONS[modelId] || <Sparkles className="h-3 w-3" />}
                  <span className="text-xs font-medium">{model.name}</span>
                </div>
              )}
              {status === "loading" && responseTime && (
                <span className="text-xs text-muted-foreground">
                  {(responseTime / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{config.label}</p>
              <p className="text-xs">{config.description}</p>
              {tokenUsage && (
                <p className="text-xs text-muted-foreground">
                  Tokens: {tokenUsage.total.toLocaleString()}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Expanded view
  return (
    <Card className={cn("p-4", className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg", config.bgColor, config.color)}>
              {config.icon}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{config.label}</h4>
                {model && (
                  <Badge variant="secondary" className="text-xs">
                    {model.name}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
          {status === "error" && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          )}
        </div>

        {/* Loading progress */}
        {status === "loading" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Generating response</span>
              {responseTime && (
                <span className="font-mono">
                  {(responseTime / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <Progress value={responseTime ? Math.min((responseTime / 30000) * 100, 95) : 20} />
          </div>
        )}

        {/* Token usage */}
        {tokenUsage && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Prompt</p>
              <p className="text-sm font-mono">
                {tokenUsage.prompt.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Response</p>
              <p className="text-sm font-mono">
                {tokenUsage.completion.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-mono font-medium">
                {tokenUsage.total.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Performance metrics */}
        {responseTime && status !== "loading" && (
          <div className="flex items-center gap-4 pt-2 border-t text-xs">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Response time:</span>
              <span className="font-mono font-medium">
                {(responseTime / 1000).toFixed(2)}s
              </span>
            </div>
            {tokenUsage && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Speed:</span>
                <span className="font-mono font-medium">
                  {Math.round(tokenUsage.completion / (responseTime / 1000))} tok/s
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error details */}
        {status === "error" && error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-destructive">
                  Error Details
                </p>
                <p className="text-xs text-destructive/80 break-words">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* API key missing warning */}
        {status === "api-key-missing" && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/50">
            <div className="flex items-start gap-2">
              <Key className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  API Key Required
                </p>
                <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
                  Configure your Gemini API key in settings to use this model
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};