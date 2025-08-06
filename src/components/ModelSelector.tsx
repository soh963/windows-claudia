import React, { useState, useEffect } from "react";
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
  Mic,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  /**
   * Currently selected model ID
   */
  value: string;
  /**
   * Callback when model is selected
   */
  onChange: (modelId: string) => void;
  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;
  /**
   * Show compact version
   */
  compact?: boolean;
  /**
   * Allow configuration editing
   */
  allowConfiguration?: boolean;
  /**
   * Current model configuration
   */
  configuration?: ModelConfiguration;
  /**
   * Callback when configuration changes
   */
  onConfigurationChange?: (config: ModelConfiguration) => void;
  /**
   * Callback when Gemini API key is needed
   */
  onGeminiApiKeyNeeded?: () => void;
  /**
   * Optional className
   */
  className?: string;
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
  audioInput: <Mic className="h-3 w-3" />,
  audioOutput: <Volume2 className="h-3 w-3" />,
};

/**
 * ModelCard component - Displays model information in a card format
 */
const ModelCard: React.FC<{
  model: Model;
  isSelected: boolean;
  hasApiKey?: boolean;
  onClick: () => void;
}> = ({ model, isSelected, hasApiKey, onClick }) => {
  const needsApiKey = model.requiresApiKey && !hasApiKey;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative p-4 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-accent/50",
        needsApiKey && "opacity-75"
      )}
      onClick={onClick}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="h-4 w-4 text-primary" />
        </div>
      )}

      {/* Model info */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md bg-background", PROVIDER_COLORS[model.provider])}>
              {MODEL_ICONS[model.id] || <Sparkles className="h-4 w-4" />}
            </div>
            <div>
              <h4 className="text-sm font-medium">{model.name}</h4>
              <p className="text-xs text-muted-foreground capitalize">{model.provider}</p>
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

        {/* Context window */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Context: {(model.contextWindow / 1000).toFixed(0)}K</span>
          {model.capabilities?.maxOutputTokens && (
            <span>Output: {(model.capabilities.maxOutputTokens / 1000).toFixed(0)}K</span>
          )}
        </div>

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
 * ModelSelector component - Advanced model selection with configuration
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
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

  const selectedModel = getModelById(value);

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
      // Check if we have API key
      const key = await api.getGeminiApiKey();
      if (!key && onGeminiApiKeyNeeded) {
        onGeminiApiKeyNeeded();
        return;
      }
    }

    onChange(modelId);
    setOpen(false);
  };

  // Compact trigger button - show only essential info
  const CompactTrigger = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn("h-8 px-2 gap-1", className)}
        >
          {MODEL_ICONS[value] || <Sparkles className="h-3.5 w-3.5" />}
          <span className="text-xs truncate max-w-[60px]">
            {getCompactModelName(selectedModel?.name)}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="font-medium">{selectedModel?.name || 'No model selected'}</p>
      </TooltipContent>
    </Tooltip>
  );

  // Utility function to get compact model name
  const getCompactModelName = (fullName: string): string => {
    if (!fullName) return 'Select';
    
    // Extract just the core model name
    return fullName
      .replace(/Claude\s*/gi, '')
      .replace(/Gemini\s*/gi, '')
      .replace(/3\.5\s*/gi, '')
      .replace(/2\.0\s*/gi, '')
      .replace(/1\.5\s*/gi, '')
      .replace(/\(New\)/gi, '')
      .replace(/\(Latest\)/gi, '')
      .replace(/-exp/gi, '')
      .replace(/-002/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Full trigger button - optimized for narrow width
  const FullTrigger = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("min-w-[80px] max-w-[120px] justify-between text-xs", className)}
        >
          <div className="flex items-center gap-1 flex-1 overflow-hidden">
            <div className={cn("p-0.5 rounded flex-shrink-0", selectedModel && PROVIDER_COLORS[selectedModel.provider])}>
              {MODEL_ICONS[value] || <Sparkles className="h-3 w-3" />}
            </div>
            <div className="text-xs font-medium truncate flex-1">
              {getCompactModelName(selectedModel?.name) || 'Select'}
            </div>
          </div>
          <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0 ml-0.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="space-y-1">
          <p className="font-medium">{selectedModel?.name || 'No model selected'}</p>
          {selectedModel && (
            <>
              <p className="text-xs text-muted-foreground capitalize">Provider: {selectedModel.provider}</p>
              <p className="text-xs text-muted-foreground">Context: {(selectedModel.contextWindow / 1000).toFixed(0)}K tokens</p>
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );

  // Group models by provider
  const modelsByProvider = ALL_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, Model[]>);

  return (
    <TooltipProvider>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={compact ? <CompactTrigger /> : <FullTrigger />}
        content={
        <div className="w-[420px] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Model</h3>
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

          <Separator />

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
                    <ModelCard
                      key={model.id}
                      model={model}
                      isSelected={value === model.id}
                      hasApiKey={provider === 'gemini' ? hasGeminiApiKey : true}
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
              </div>
            </div>
          </div>
        </div>
      }
      align="start"
      side="auto"
      sideOffset={5}
      maxHeight="600px"
    />
    </TooltipProvider>
  );
};