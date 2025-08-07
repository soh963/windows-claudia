import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Sparkles,
  Zap,
  Star,
  Brain,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  ALL_MODELS, 
  getModelById, 
  isGeminiModel,
  type Model,
} from "@/lib/models";
import { api } from "@/lib/api";

interface ModelSelectorCompactProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  onGeminiApiKeyNeeded?: () => void;
  className?: string;
}

// Simplified model icons
const MODEL_ICONS: Record<string, React.ReactNode> = {
  'auto': <Zap className="h-3.5 w-3.5" />,
  'sonnet': <Zap className="h-3.5 w-3.5" />,
  'opus': <Sparkles className="h-3.5 w-3.5" />,
  'gemini-2.0-flash-exp': <Star className="h-3.5 w-3.5" />,
  'gemini-exp-1206': <Brain className="h-3.5 w-3.5" />,
  'gemini-1.5-pro-002': <Sparkles className="h-3.5 w-3.5" />,
  'gemini-1.5-flash-002': <Zap className="h-3.5 w-3.5" />
};

// Get short model name
const getShortModelName = (model: Model) => {
  const name = model.name;
  // Remove provider prefix and version info
  return name
    .replace(/Claude |Gemini /gi, '')
    .replace(/\s*\(.*\)$/, '') // Remove parenthetical descriptions
    .replace(/2\.0|1\.5/gi, '') // Remove version numbers
    .replace(/Experimental|exp/gi, 'Exp')
    .replace(/Flash/gi, 'F')
    .replace(/Pro/gi, 'P')
    .trim();
};

const ModelItem: React.FC<{
  model: Model;
  isSelected: boolean;
  hasApiKey?: boolean;
  onClick: () => void;
}> = ({ model, isSelected, hasApiKey, onClick }) => {
  const needsApiKey = model.requiresApiKey && !hasApiKey;
  const shortName = getShortModelName(model);

  return (
    <motion.div
      whileHover={{ backgroundColor: 'var(--accent)' }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center justify-between px-3 py-2 cursor-pointer rounded-md transition-colors",
        isSelected && "bg-primary/10"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 flex-1">
        <div className={cn(
          "flex-shrink-0",
          model.provider === 'claude' ? 'text-purple-500' : 'text-blue-500'
        )}>
          {MODEL_ICONS[model.id] || <Sparkles className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{shortName}</div>
          <div className="text-xs text-muted-foreground">{model.provider}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {needsApiKey && <Lock className="h-3 w-3 text-muted-foreground" />}
        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
      </div>
    </motion.div>
  );
};

export const ModelSelectorCompact: React.FC<ModelSelectorCompactProps> = ({
  value,
  onChange,
  disabled = false,
  onGeminiApiKeyNeeded,
  className
}) => {
  const [open, setOpen] = useState(false);
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(false);
  
  const selectedModel = getModelById(value);

  // Check for Gemini API key
  useEffect(() => {
    const checkApiKey = async () => {
      if (isGeminiModel(value)) {
        try {
          const key = await api.getGeminiApiKey();
          setHasGeminiApiKey(!!key);
        } catch (err) {
          setHasGeminiApiKey(false);
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

  const shortName = selectedModel ? getShortModelName(selectedModel) : 'Select';

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 px-2 gap-1 min-w-[80px] max-w-[120px] justify-between",
            className
          )}
        >
          <div className="flex items-center gap-1 flex-1 overflow-hidden">
            <div className={cn(
              "flex-shrink-0",
              selectedModel && (selectedModel.provider === 'claude' ? 'text-purple-500' : 'text-blue-500')
            )}>
              {selectedModel && MODEL_ICONS[value] || <Sparkles className="h-3.5 w-3.5" />}
            </div>
            <span className="text-xs font-medium truncate flex-1">{shortName}</span>
          </div>
          <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
        </Button>
      }
      content={
        <div className="w-[240px] p-2">
          <div className="text-sm font-medium px-3 py-2">Select Model</div>
          <Separator className="my-1" />
          
          {/* Claude Models */}
          <div className="mb-2">
            <div className="text-xs text-muted-foreground px-3 py-1">Claude</div>
            {ALL_MODELS().filter(m => m.provider === 'claude').map(model => (
              <ModelItem
                key={model.id}
                model={model}
                isSelected={value === model.id}
                hasApiKey={true}
                onClick={() => handleModelSelect(model.id)}
              />
            ))}
          </div>
          
          {/* Gemini Models */}
          <div>
            <div className="text-xs text-muted-foreground px-3 py-1">Gemini</div>
            {ALL_MODELS().filter(m => m.provider === 'gemini').map(model => (
              <ModelItem
                key={model.id}
                model={model}
                isSelected={value === model.id}
                hasApiKey={hasGeminiApiKey}
                onClick={() => handleModelSelect(model.id)}
              />
            ))}
          </div>
        </div>
      }
      align="start"
      side="bottom"
      sideOffset={4}
    />
  );
};