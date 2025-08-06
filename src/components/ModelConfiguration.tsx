import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save,
  RotateCcw,
  Info,
  AlertCircle,
  Sliders,
  Copy,
  Download,
  Upload,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  getModelById,
  validateModelConfig,
  isGeminiModel,
  type Model,
  type ModelConfiguration,
} from "@/lib/models";
import { GeminiSafetySettings, DEFAULT_SAFETY_SETTINGS, type SafetySetting } from "./GeminiSafetySettings";

interface ModelConfigurationProps {
  /**
   * Model ID to configure
   */
  modelId: string;
  /**
   * Current configuration
   */
  configuration: ModelConfiguration;
  /**
   * Callback when configuration changes
   */
  onChange: (config: ModelConfiguration) => void;
  /**
   * Callback when save is clicked
   */
  onSave?: () => void;
  /**
   * Whether to show as modal or inline
   */
  mode?: "modal" | "inline";
  /**
   * Optional className
   */
  className?: string;
}

// Configuration presets
interface ConfigPreset {
  id: string;
  name: string;
  description: string;
  config: Partial<ModelConfiguration>;
  icon?: React.ReactNode;
}

const PRESETS: ConfigPreset[] = [
  {
    id: "creative",
    name: "Creative",
    description: "Higher temperature for creative tasks",
    config: {
      temperature: 1.2,
      topP: 0.95,
      topK: 40,
    },
    icon: "🎨",
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Default balanced settings",
    config: {
      temperature: 0.7,
      topP: 0.9,
      topK: 20,
    },
    icon: "⚖️",
  },
  {
    id: "precise",
    name: "Precise",
    description: "Lower temperature for accuracy",
    config: {
      temperature: 0.3,
      topP: 0.7,
      topK: 10,
    },
    icon: "🎯",
  },
  {
    id: "deterministic",
    name: "Deterministic",
    description: "Minimal randomness",
    config: {
      temperature: 0.1,
      topP: 0.5,
      topK: 5,
    },
    icon: "🔒",
  },
];

/**
 * ConfigurationField component - Reusable field with validation
 */
const ConfigurationField: React.FC<{
  label: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, description, error, children }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    {children}
    {description && !error && (
      <p className="text-xs text-muted-foreground">{description}</p>
    )}
    {error && (
      <p className="text-xs text-destructive flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
);

/**
 * ModelConfiguration component - Advanced configuration UI for models
 */
export const ModelConfiguration: React.FC<ModelConfigurationProps> = ({
  modelId,
  configuration,
  onChange,
  onSave,
  mode = "inline",
  className,
}) => {
  const [localConfig, setLocalConfig] = useState<ModelConfiguration>(configuration);
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("parameters");
  const [safetySettings, setSafetySettings] = useState<SafetySetting[]>(DEFAULT_SAFETY_SETTINGS);

  const model = getModelById(modelId);
  const isGemini = isGeminiModel(modelId);

  // Update local config when prop changes
  useEffect(() => {
    setLocalConfig(configuration);
  }, [configuration]);

  // Validate configuration on change
  useEffect(() => {
    if (model) {
      const validation = validateModelConfig(modelId, localConfig);
      setErrors(validation.errors);
    }
  }, [localConfig, modelId, model]);

  if (!model) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <p>Unknown model: {modelId}</p>
        </div>
      </Card>
    );
  }

  const handleFieldChange = (field: keyof ModelConfiguration, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handlePresetApply = (preset: ConfigPreset) => {
    const newConfig = { ...localConfig, ...preset.config };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handleReset = () => {
    const defaultConfig = model.defaultConfig || {};
    setLocalConfig(defaultConfig);
    onChange(defaultConfig);
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(localConfig, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.id}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          setLocalConfig(config);
          onChange(config);
        } catch (err) {
          console.error("Failed to import config:", err);
        }
      };
      reader.readAsText(file);
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sliders className="h-5 w-5" />
          Configure {model.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          Customize model parameters for optimal performance
        </p>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn("grid w-full", isGemini ? "grid-cols-4" : "grid-cols-3")}>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          {isGemini && <TabsTrigger value="safety">Safety</TabsTrigger>}
        </TabsList>

        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-6 mt-6">
          {/* Temperature */}
          <ConfigurationField
            label="Temperature"
            description="Controls randomness in responses (0 = deterministic, 2 = very creative)"
            error={errors.find((e) => e.includes("Temperature"))}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Slider
                  value={[localConfig.temperature || 0.7]}
                  onValueChange={([value]) => handleFieldChange("temperature", value)}
                  min={model.validation?.minTemperature || 0}
                  max={model.validation?.maxTemperature || 2}
                  step={0.1}
                  className="flex-1 mr-4"
                />
                <Input
                  type="number"
                  value={localConfig.temperature || 0.7}
                  onChange={(e) =>
                    handleFieldChange("temperature", parseFloat(e.target.value))
                  }
                  className="w-20"
                  min={model.validation?.minTemperature || 0}
                  max={model.validation?.maxTemperature || 2}
                  step={0.1}
                />
              </div>
            </div>
          </ConfigurationField>

          {/* Max Output Tokens */}
          <ConfigurationField
            label="Max Output Tokens"
            description={`Maximum tokens in response (max: ${model.capabilities?.maxOutputTokens || 8192})`}
            error={errors.find((e) => e.includes("output tokens"))}
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={localConfig.maxOutputTokens || model.capabilities?.maxOutputTokens || 8192}
                onChange={(e) =>
                  handleFieldChange("maxOutputTokens", parseInt(e.target.value))
                }
                min={1}
                max={model.capabilities?.maxOutputTokens || 8192}
              />
              <Badge variant="secondary">
                ~{Math.round((localConfig.maxOutputTokens || 8192) / 4)} words
              </Badge>
            </div>
          </ConfigurationField>

          {/* Top-K */}
          {model.validation?.maxTopK && (
            <ConfigurationField
              label="Top-K"
              description="Number of top tokens to consider (1-40)"
              error={errors.find((e) => e.includes("Top-K"))}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Slider
                    value={[localConfig.topK || 10]}
                    onValueChange={([value]) => handleFieldChange("topK", value)}
                    min={1}
                    max={model.validation.maxTopK}
                    step={1}
                    className="flex-1 mr-4"
                  />
                  <Input
                    type="number"
                    value={localConfig.topK || 10}
                    onChange={(e) =>
                      handleFieldChange("topK", parseInt(e.target.value))
                    }
                    className="w-20"
                    min={1}
                    max={model.validation.maxTopK}
                  />
                </div>
              </div>
            </ConfigurationField>
          )}

          {/* Top-P */}
          <ConfigurationField
            label="Top-P"
            description="Cumulative probability threshold (0-1)"
            error={errors.find((e) => e.includes("Top-P"))}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Slider
                  value={[localConfig.topP || 0.9]}
                  onValueChange={([value]) => handleFieldChange("topP", value)}
                  min={model.validation?.minTopP || 0}
                  max={model.validation?.maxTopP || 1}
                  step={0.05}
                  className="flex-1 mr-4"
                />
                <Input
                  type="number"
                  value={localConfig.topP || 0.9}
                  onChange={(e) =>
                    handleFieldChange("topP", parseFloat(e.target.value))
                  }
                  className="w-20"
                  min={model.validation?.minTopP || 0}
                  max={model.validation?.maxTopP || 1}
                  step={0.05}
                />
              </div>
            </div>
          </ConfigurationField>
        </TabsContent>

        {/* Presets Tab */}
        <TabsContent value="presets" className="mt-6">
          <div className="grid grid-cols-2 gap-4">
            {PRESETS.map((preset) => (
              <Card
                key={preset.id}
                className="p-4 cursor-pointer hover:border-primary transition-colors"
                onClick={() => handlePresetApply(preset)}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{preset.icon}</span>
                    <h4 className="font-medium">{preset.name}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {preset.description}
                  </p>
                  <div className="text-xs space-y-1 mt-3">
                    {Object.entries(preset.config).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}:
                        </span>
                        <span className="font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6 mt-6">
          {/* System Instruction */}
          {model.capabilities?.systemInstructions && (
            <ConfigurationField
              label="System Instruction"
              description="Optional system-level instructions for the model"
            >
              <Textarea
                value={localConfig.systemInstruction || ""}
                onChange={(e) =>
                  handleFieldChange("systemInstruction", e.target.value)
                }
                placeholder="Enter system instructions..."
                rows={4}
              />
            </ConfigurationField>
          )}

          {/* Stop Sequences */}
          <ConfigurationField
            label="Stop Sequences"
            description="Comma-separated sequences that will stop generation"
          >
            <Input
              value={localConfig.stopSequences?.join(", ") || ""}
              onChange={(e) =>
                handleFieldChange(
                  "stopSequences",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="Enter stop sequences..."
            />
          </ConfigurationField>

          {/* Response Format */}
          <ConfigurationField
            label="Response Format"
            description="Preferred output format"
          >
            <div className="flex gap-2">
              {["text", "markdown", "json"].map((format) => (
                <Button
                  key={format}
                  variant={
                    localConfig.responseFormat === format
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    handleFieldChange(
                      "responseFormat",
                      format as ModelConfiguration["responseFormat"]
                    )
                  }
                  className="capitalize"
                >
                  {format}
                </Button>
              ))}
            </div>
          </ConfigurationField>

          {/* Import/Export */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">Configuration Management</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyConfig}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy JSON
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportConfig}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  asChild
                >
                  <span>
                    <Upload className="h-4 w-4" />
                    Import
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportConfig}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </TabsContent>

        {/* Safety Tab (Gemini only) */}
        {isGemini && (
          <TabsContent value="safety" className="mt-6">
            <GeminiSafetySettings
              settings={safetySettings}
              onChange={setSafetySettings}
              compact={false}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Error Summary */}
      {errors.length > 0 && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                Configuration has errors:
              </p>
              <ul className="text-xs text-destructive space-y-0.5">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>
        {onSave && (
          <Button
            onClick={onSave}
            disabled={errors.length > 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        )}
      </div>
    </div>
  );

  if (mode === "modal") {
    return (
      <Card className={cn("p-6", className)}>
        {content}
      </Card>
    );
  }

  return <div className={className}>{content}</div>;
};