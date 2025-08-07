import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  Settings2,
  Sparkles,
  Zap,
  Star,
  Brain,
  AlertCircle,
  Info,
  Lock,
  Unlock,
  Globe,
  Code,
  FileText,
  Image as ImageIcon,
  Clock,
  CheckCircle,
  X,
  DollarSign,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { 
  ALL_MODELS, 
  getModelById, 
  isGeminiModel,
  type Model,
  type ModelCapabilities,
  type ModelConfiguration 
} from "@/lib/models";
import { api } from "@/lib/api";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  compact?: boolean;
  allowConfiguration?: boolean;
  configuration?: ModelConfiguration;
  onConfigurationChange?: (config: ModelConfiguration) => void;
  onGeminiApiKeyNeeded?: () => void;
  className?: string;
}

// Enhanced interfaces
interface ModelUsageMetrics {
  averageResponseTime: number;
  successRate: number;
  lastUsed?: Date;
  totalTokensUsed: number;
  errorCount: number;
}

interface ModelPricing {
  inputTokenCost: number; // per 1M tokens
  outputTokenCost: number; // per 1M tokens
  estimatedCostPer1K: number;
}

// Model icons mapping
const MODEL_ICONS: Record<string, React.ReactNode> = {
  'auto': <Settings2 className="h-4 w-4" />,
  'sonnet': <Zap className="h-4 w-4" />,
  'opus': <Sparkles className="h-4 w-4" />,
  'gemini-2.0-flash-exp': <Star className="h-4 w-4" />,
  'gemini-exp-1206': <Brain className="h-4 w-4" />,
  'gemini-1.5-pro-002': <Sparkles className="h-4 w-4" />,
  'gemini-1.5-flash-002': <Zap className="h-4 w-4" />
};

// Provider colors
const PROVIDER_COLORS = {
  claude: "text-purple-500",
  gemini: "text-blue-500"
};

// Capability icons
const CAPABILITY_ICONS: Record<keyof ModelCapabilities, React.ReactNode> = {
  streaming: <Zap className="h-3 w-3" />,
  functionCalling: <Code className="h-3 w-3" />,
  systemInstructions: <FileText className="h-3 w-3" />,
  multimodal: <ImageIcon className="h-3 w-3" />,
  codeExecution: <Code className="h-3 w-3" />,
  webBrowsing: <Globe className="h-3 w-3" />,
};

// Mock pricing data (would come from API in real implementation)
const MODEL_PRICING: Record<string, ModelPricing> = {
  'auto': { inputTokenCost: 1.5, outputTokenCost: 7.5, estimatedCostPer1K: 0.009 }, // Average of selected models
  'sonnet': { inputTokenCost: 3, outputTokenCost: 15, estimatedCostPer1K: 0.018 },
  'opus': { inputTokenCost: 15, outputTokenCost: 75, estimatedCostPer1K: 0.09 },
  'gemini-2.0-flash-exp': { inputTokenCost: 0.075, outputTokenCost: 0.3, estimatedCostPer1K: 0.000375 },
  'gemini-exp-1206': { inputTokenCost: 0.0, outputTokenCost: 0.0, estimatedCostPer1K: 0.0 },
  'gemini-1.5-pro-002': { inputTokenCost: 1.25, outputTokenCost: 5.0, estimatedCostPer1K: 0.00625 },
  'gemini-1.5-flash-002': { inputTokenCost: 0.075, outputTokenCost: 0.3, estimatedCostPer1K: 0.000375 }
};

/**
 * PerformanceIndicator - Shows model performance metrics
 */
const PerformanceIndicator: React.FC<{ metrics?: ModelUsageMetrics }> = ({ metrics }) => {
  if (!metrics) return null;
  
  return (
    <div className="flex items-center gap-3 text-xs">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{metrics.averageResponseTime.toFixed(1)}s</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Average response time</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>{metrics.successRate.toFixed(0)}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Success rate</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {metrics.lastUsed && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className="text-muted-foreground">
                Last used {new Date(metrics.lastUsed).toLocaleDateString()}
              </span>
            </TooltipTrigger>
            <TooltipContent>Last usage date</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

/**
 * PricingIndicator - Shows model pricing information
 */
const PricingIndicator: React.FC<{ pricing?: ModelPricing }> = ({ pricing }) => {
  if (!pricing) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="flex items-center gap-1 text-xs">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span>${pricing.estimatedCostPer1K.toFixed(4)}/1K tokens</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p>Input: ${pricing.inputTokenCost}/1M tokens</p>
            <p>Output: ${pricing.outputTokenCost}/1M tokens</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * ContextWindowVisualizer - Visual comparison of context windows
 */
const ContextWindowVisualizer: React.FC<{ models: Model[] }> = ({ models }) => {
  const maxContext = Math.max(...models.map(m => m.contextWindow));
  
  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
      <h5 className="text-xs font-medium mb-2">Context Window Comparison</h5>
      {models.map(model => (
        <div key={model.id} className="flex items-center gap-2">
          <span className="text-xs w-32 truncate">{model.name}</span>
          <div className="flex-1 bg-background rounded-full h-2 relative overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(model.contextWindow / maxContext) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {model.contextWindow >= 1000000 
              ? `${(model.contextWindow / 1000000).toFixed(1)}M` 
              : `${(model.contextWindow / 1000).toFixed(0)}K`}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * CapabilityMatrix - Shows capability comparison between models
 */
const CapabilityMatrix: React.FC<{ models: Model[] }> = ({ models }) => {
  const capabilities: (keyof ModelCapabilities)[] = [
    'streaming', 'functionCalling', 'systemInstructions', 
    'multimodal', 'codeExecution', 'webBrowsing'
  ];
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2 sticky left-0 bg-background">Model</th>
            {capabilities.map(cap => (
              <th key={cap} className="p-2 text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex justify-center">
                      {CAPABILITY_ICONS[cap]}
                    </TooltipTrigger>
                    <TooltipContent>
                      {cap.replace(/([A-Z])/g, ' $1').trim()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {models.map(model => (
            <tr key={model.id} className="border-b hover:bg-muted/30">
              <td className="p-2 sticky left-0 bg-background font-medium">{model.name}</td>
              {capabilities.map(cap => (
                <td key={cap} className="p-2 text-center">
                  {model.capabilities?.[cap] ? (
                    <Check className="h-3 w-3 text-green-500 mx-auto" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground/50 mx-auto" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Enhanced ModelCard component - Displays rich model information
 */
const EnhancedModelCard: React.FC<{
  model: Model;
  isSelected: boolean;
  hasApiKey?: boolean;
  metrics?: ModelUsageMetrics;
  pricing?: ModelPricing;
  onClick: () => void;
}> = ({ model, isSelected, hasApiKey, metrics, pricing, onClick }) => {
  const needsApiKey = model.requiresApiKey && !hasApiKey;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative p-4 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/50 hover:bg-accent/50",
        needsApiKey && "opacity-75"
      )}
      onClick={onClick}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div 
          className="absolute top-2 right-2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="p-1 rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        </motion.div>
      )}

      {/* Model info */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md bg-background", PROVIDER_COLORS[model.provider])}>
              {MODEL_ICONS[model.id] || <Sparkles className="h-4 w-4" />}
            </div>
            <div>
              <h4 className="text-sm font-medium">{model.name}</h4>
              <p className="text-xs text-muted-foreground capitalize flex items-center gap-2">
                {model.provider}
                {model.provider === 'gemini' && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    Experimental
                  </Badge>
                )}
              </p>
            </div>
          </div>
          {needsApiKey && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>API key required</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">{model.description}</p>

        {/* Context window and output tokens */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            <span>Context: {(model.contextWindow / 1000).toFixed(0)}K</span>
          </div>
          {model.capabilities?.maxOutputTokens && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>Output: {(model.capabilities.maxOutputTokens / 1000).toFixed(0)}K</span>
            </div>
          )}
        </div>

        {/* Performance metrics */}
        {metrics && <PerformanceIndicator metrics={metrics} />}
        
        {/* Pricing information */}
        {pricing && <PricingIndicator pricing={pricing} />}

        {/* Capabilities badges */}
        {model.capabilities && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(model.capabilities).map(([key, value]) => {
              if (typeof value === 'boolean' && value && CAPABILITY_ICONS[key as keyof ModelCapabilities]) {
                return (
                  <TooltipProvider key={key}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="p-1 rounded bg-muted">
                          {CAPABILITY_ICONS[key as keyof ModelCapabilities]}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Enhanced ModelSelector component - Advanced model selection with rich features
 */
export const EnhancedModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false,
  allowConfiguration = false,
  configuration,
  onConfigurationChange,
  onGeminiApiKeyNeeded,
  className
}) => {
  const [open, setOpen] = useState(false);
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(false);
  const [checkingApiKey, setCheckingApiKey] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, ModelUsageMetrics>>({});

  const selectedModel = getModelById(value);

  // Load usage metrics (mock data for demo)
  useEffect(() => {
    // In real implementation, this would fetch from API
    setMetrics({
      'auto': {
        averageResponseTime: 2.2, // Average of intelligent selections
        successRate: 99.5, // Higher success rate due to optimal selection
        lastUsed: new Date(Date.now() - 1000 * 60 * 5),
        totalTokensUsed: 200000,
        errorCount: 1
      },
      'sonnet': {
        averageResponseTime: 2.3,
        successRate: 98.5,
        lastUsed: new Date(Date.now() - 1000 * 60 * 30),
        totalTokensUsed: 125000,
        errorCount: 3
      },
      'opus': {
        averageResponseTime: 4.1,
        successRate: 99.2,
        lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24),
        totalTokensUsed: 45000,
        errorCount: 1
      },
      'gemini-2.0-flash-exp': {
        averageResponseTime: 1.8,
        successRate: 97.8,
        totalTokensUsed: 80000,
        errorCount: 2
      },
      'gemini-exp-1206': {
        averageResponseTime: 3.5,
        successRate: 98.9,
        totalTokensUsed: 15000,
        errorCount: 0
      },
      'gemini-1.5-pro-002': {
        averageResponseTime: 2.1,
        successRate: 99.1,
        lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2),
        totalTokensUsed: 95000,
        errorCount: 1
      },
      'gemini-1.5-flash-002': {
        averageResponseTime: 1.4,
        successRate: 98.7,
        lastUsed: new Date(Date.now() - 1000 * 60 * 15),
        totalTokensUsed: 110000,
        errorCount: 2
      }
    });
  }, []);

  // Check for Gemini API key
  useEffect(() => {
    const checkApiKey = async () => {
      if (isGeminiModel(value)) {
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
  }, [value]);

  const handleModelSelect = async (modelId: string) => {
    const model = getModelById(modelId);
    
    if (model?.requiresApiKey && isGeminiModel(modelId)) {
      const key = await api.getGeminiApiKey();
      if (!key && onGeminiApiKeyNeeded) {
        onGeminiApiKeyNeeded();
        return;
      }
    }

    onChange(modelId);
    setOpen(false);
  };

  // Compact trigger button
  const CompactTrigger = () => (
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      className={cn("h-8 px-2 gap-1.5", className)}
    >
      {MODEL_ICONS[value] || <Sparkles className="h-4 w-4" />}
      <span className="text-xs">{selectedModel?.name || 'Select Model'}</span>
      <ChevronDown className="h-3 w-3 opacity-50" />
    </Button>
  );

  // Full trigger button
  const FullTrigger = () => (
    <Button
      variant="outline"
      disabled={disabled}
      className={cn("w-full justify-between", className)}
    >
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded", selectedModel && PROVIDER_COLORS[selectedModel.provider])}>
          {MODEL_ICONS[value] || <Sparkles className="h-4 w-4" />}
        </div>
        <div className="text-left">
          <div className="text-sm font-medium">{selectedModel?.name || 'Select Model'}</div>
          {selectedModel && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{selectedModel.description}</span>
              {MODEL_PRICING[selectedModel.id] && (
                <PricingIndicator pricing={MODEL_PRICING[selectedModel.id]} />
              )}
            </div>
          )}
        </div>
      </div>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </Button>
  );

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    return ALL_MODELS().reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<string, Model[]>);
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={compact ? <CompactTrigger /> : <FullTrigger />}
      content={
        <div className="w-[480px] p-4 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-lg font-semibold">Select Model</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComparison(!showComparison)}
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                {showComparison ? 'Hide' : 'Show'} Comparison
              </Button>
              {allowConfiguration && selectedModel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // TODO: Open configuration modal
                  }}
                >
                  <Settings2 className="h-4 w-4 mr-1" />
                  Configure
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Comparison views */}
          <AnimatePresence>
            {showComparison && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <ContextWindowVisualizer models={ALL_MODELS} />
                <CapabilityMatrix models={ALL_MODELS} />
                <Separator />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Models grouped by provider */}
          <div className="space-y-6">
            {Object.entries(modelsByProvider).map(([provider, models]) => (
              <div key={provider} className="space-y-3">
                <h4 className="text-sm font-medium capitalize flex items-center gap-2">
                  <span className={PROVIDER_COLORS[provider as keyof typeof PROVIDER_COLORS]}>
                    {provider}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {models.length} models
                  </Badge>
                </h4>
                <div className="grid gap-3">
                  {models.map((model) => (
                    <EnhancedModelCard
                      key={model.id}
                      model={model}
                      isSelected={value === model.id}
                      hasApiKey={provider === 'gemini' ? hasGeminiApiKey : true}
                      metrics={metrics[model.id]}
                      pricing={MODEL_PRICING[model.id]}
                      onClick={() => handleModelSelect(model.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Info section */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Claude models are accessed through Claude Code.</p>
                <p>Gemini models require an API key from Google AI Studio.</p>
                <p className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Usage metrics update in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      }
      align="start"
      sideOffset={5}
    />
  );
};