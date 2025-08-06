import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Info,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Gemini safety categories
export enum HarmCategory {
  HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH",
  HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT",
  HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT",
  HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
}

// Safety threshold levels
export enum HarmBlockThreshold {
  BLOCK_NONE = "BLOCK_NONE",
  BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH",
  BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE",
  BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE",
}

// Safety setting interface
export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

// Default safety settings
export const DEFAULT_SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

interface GeminiSafetySettingsProps {
  /**
   * Current safety settings
   */
  settings: SafetySetting[];
  /**
   * Callback when settings change
   */
  onChange: (settings: SafetySetting[]) => void;
  /**
   * Whether to show in compact mode
   */
  compact?: boolean;
  /**
   * Optional className
   */
  className?: string;
}

// Category metadata
const CATEGORY_INFO: Record<
  HarmCategory,
  {
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }
> = {
  [HarmCategory.HARM_CATEGORY_HATE_SPEECH]: {
    label: "Hate Speech",
    description: "Content that promotes hatred or discrimination",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-red-500",
  },
  [HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT]: {
    label: "Dangerous Content",
    description: "Content that could cause physical harm",
    icon: <AlertCircle className="h-4 w-4" />,
    color: "text-orange-500",
  },
  [HarmCategory.HARM_CATEGORY_HARASSMENT]: {
    label: "Harassment",
    description: "Content that targets individuals or groups",
    icon: <Shield className="h-4 w-4" />,
    color: "text-yellow-500",
  },
  [HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT]: {
    label: "Sexually Explicit",
    description: "Adult or inappropriate sexual content",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-purple-500",
  },
};

// Threshold metadata
const THRESHOLD_INFO: Record<
  HarmBlockThreshold,
  {
    label: string;
    description: string;
    level: number;
    color: string;
  }
> = {
  [HarmBlockThreshold.BLOCK_NONE]: {
    label: "No Blocking",
    description: "Allow all content (not recommended)",
    level: 0,
    color: "text-gray-500",
  },
  [HarmBlockThreshold.BLOCK_ONLY_HIGH]: {
    label: "Block High Risk",
    description: "Only block content with high probability of harm",
    level: 1,
    color: "text-yellow-500",
  },
  [HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE]: {
    label: "Block Medium & High",
    description: "Block content with medium or high probability of harm (recommended)",
    level: 2,
    color: "text-orange-500",
  },
  [HarmBlockThreshold.BLOCK_LOW_AND_ABOVE]: {
    label: "Block All Risks",
    description: "Block any content with potential harm",
    level: 3,
    color: "text-red-500",
  },
};

/**
 * SafetyLevelIndicator component - Visual indicator for safety level
 */
const SafetyLevelIndicator: React.FC<{ level: number }> = ({ level }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 h-3 rounded-full transition-colors",
            i <= level
              ? level === 0
                ? "bg-gray-400"
                : level === 1
                ? "bg-yellow-500"
                : level === 2
                ? "bg-orange-500"
                : "bg-red-500"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );
};

/**
 * CategorySetting component - Individual category safety setting
 */
const CategorySetting: React.FC<{
  setting: SafetySetting;
  onChange: (threshold: HarmBlockThreshold) => void;
  expanded?: boolean;
}> = ({ setting, onChange, expanded = false }) => {
  const categoryInfo = CATEGORY_INFO[setting.category];
  const thresholdInfo = THRESHOLD_INFO[setting.threshold];

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn("mt-0.5", categoryInfo.color)}>
              {categoryInfo.icon}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium">{categoryInfo.label}</h4>
              <p className="text-xs text-muted-foreground">
                {categoryInfo.description}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {thresholdInfo.label}
          </Badge>
        </div>

        {/* Threshold selector */}
        {expanded && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Safety Level</Label>
              <SafetyLevelIndicator level={thresholdInfo.level} />
            </div>
            
            <RadioGroup
              value={setting.threshold}
              onValueChange={(value) => onChange(value as HarmBlockThreshold)}
            >
              {Object.entries(THRESHOLD_INFO).map(([threshold, info]) => (
                <div
                  key={threshold}
                  className="flex items-start space-x-2 py-2"
                >
                  <RadioGroupItem
                    value={threshold}
                    id={`${setting.category}-${threshold}`}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`${setting.category}-${threshold}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium text-sm">{info.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {info.description}
                    </div>
                  </label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* Compact mode - slider */}
        {!expanded && (
          <div className="pt-2">
            <Slider
              value={[thresholdInfo.level]}
              onValueChange={([level]) => {
                const thresholds = Object.entries(THRESHOLD_INFO).find(
                  ([_, info]) => info.level === level
                );
                if (thresholds) {
                  onChange(thresholds[0] as HarmBlockThreshold);
                }
              }}
              min={0}
              max={3}
              step={1}
              className="w-full"
            />
          </div>
        )}
      </div>
    </Card>
  );
};

/**
 * GeminiSafetySettings component - Configure Gemini safety filters
 */
export const GeminiSafetySettings: React.FC<GeminiSafetySettingsProps> = ({
  settings,
  onChange,
  compact = false,
  className,
}) => {
  const [useDefaults, setUseDefaults] = useState(
    JSON.stringify(settings) === JSON.stringify(DEFAULT_SAFETY_SETTINGS)
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<HarmCategory>>(
    new Set()
  );

  const handleCategoryChange = (
    category: HarmCategory,
    threshold: HarmBlockThreshold
  ) => {
    const newSettings = settings.map((s) =>
      s.category === category ? { ...s, threshold } : s
    );
    onChange(newSettings);
    setUseDefaults(false);
  };

  const handleUseDefaultsChange = (checked: boolean) => {
    setUseDefaults(checked);
    if (checked) {
      onChange(DEFAULT_SAFETY_SETTINGS);
    }
  };

  const handleResetToDefaults = () => {
    onChange(DEFAULT_SAFETY_SETTINGS);
    setUseDefaults(true);
  };

  const toggleCategoryExpansion = (category: HarmCategory) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Safety Settings</h3>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Safety settings control what types of content Gemini will
                  generate. Higher safety levels may limit some responses but
                  ensure appropriate content.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure content filtering thresholds for different harm categories
        </p>
      </div>

      {/* Use defaults toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="use-defaults" className="text-sm font-medium">
              Use Recommended Defaults
            </Label>
            <p className="text-xs text-muted-foreground">
              Google's recommended safety settings for most use cases
            </p>
          </div>
          <Switch
            id="use-defaults"
            checked={useDefaults}
            onCheckedChange={handleUseDefaultsChange}
          />
        </div>
      </Card>

      {/* Category settings */}
      <div className="space-y-4">
        {settings.map((setting) => (
          <motion.div
            key={setting.category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {compact ? (
              <CategorySetting
                setting={setting}
                onChange={(threshold) =>
                  handleCategoryChange(setting.category, threshold)
                }
                expanded={false}
              />
            ) : (
              <Collapsible
                open={expandedCategories.has(setting.category)}
                onOpenChange={() => toggleCategoryExpansion(setting.category)}
              >
                <CollapsibleTrigger className="w-full">
                  <CategorySetting
                    setting={setting}
                    onChange={(threshold) =>
                      handleCategoryChange(setting.category, threshold)
                    }
                    expanded={false}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2">
                    <CategorySetting
                      setting={setting}
                      onChange={(threshold) =>
                        handleCategoryChange(setting.category, threshold)
                      }
                      expanded={true}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </motion.div>
        ))}
      </div>

      {/* Summary and actions */}
      <Card className="p-4 bg-muted/50">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Current configuration:{" "}
                {useDefaults ? (
                  <span className="font-medium text-foreground">
                    Using recommended defaults
                  </span>
                ) : (
                  <span className="font-medium text-foreground">
                    Custom settings
                  </span>
                )}
              </p>
              <p>
                Safety filters help ensure appropriate content generation but may
                occasionally block legitimate queries. Adjust settings based on
                your needs.
              </p>
            </div>
          </div>
          
          {!useDefaults && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
              className="w-full"
            >
              Reset to Defaults
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};