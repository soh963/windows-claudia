import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Save,
  Upload,
  Download,
  Copy,
  Check,
  AlertCircle,
  Settings2,
  Zap,
  Sparkles,
  Star,
  Brain,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ALL_MODELS,
  getModelById,
  type Model,
  type ModelConfiguration,
} from "@/lib/models";
import { api } from "@/lib/api";

export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  modelId: string;
  configuration: ModelConfiguration;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
  isBuiltIn?: boolean;
}

interface ModelPresetsManagerProps {
  /**
   * Currently selected preset ID
   */
  selectedPresetId?: string;
  /**
   * Callback when preset is selected
   */
  onPresetSelect?: (preset: ModelPreset) => void;
  /**
   * Optional className
   */
  className?: string;
}

// Built-in presets
const BUILT_IN_PRESETS: ModelPreset[] = [
  {
    id: "fast-coding",
    name: "Fast Coding",
    description: "Optimized for quick code generation and completion",
    modelId: "sonnet",
    configuration: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      topP: 0.7,
    },
    icon: "⚡",
    createdAt: new Date(),
    updatedAt: new Date(),
    isBuiltIn: true,
  },
  {
    id: "creative-writing",
    name: "Creative Writing",
    description: "High creativity for content generation",
    modelId: "opus",
    configuration: {
      temperature: 1.2,
      maxOutputTokens: 8192,
      topP: 0.95,
    },
    icon: "✨",
    createdAt: new Date(),
    updatedAt: new Date(),
    isBuiltIn: true,
  },
  {
    id: "precise-analysis",
    name: "Precise Analysis",
    description: "Low temperature for accurate analysis and reasoning",
    modelId: "gemini-exp-1206",
    configuration: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      topK: 5,
      topP: 0.5,
    },
    icon: "🎯",
    createdAt: new Date(),
    updatedAt: new Date(),
    isBuiltIn: true,
  },
  {
    id: "balanced-chat",
    name: "Balanced Chat",
    description: "General-purpose conversational settings",
    modelId: "gemini-2.0-flash-exp",
    configuration: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      topK: 20,
      topP: 0.9,
    },
    icon: "💬",
    createdAt: new Date(),
    updatedAt: new Date(),
    isBuiltIn: true,
  },
];

// Model icons mapping
const MODEL_ICONS: Record<string, React.ReactNode> = {
  'sonnet': <Zap className="h-4 w-4" />,
  'opus': <Sparkles className="h-4 w-4" />,
  'gemini-2.0-flash-exp': <Star className="h-4 w-4" />,
  'gemini-exp-1206': <Brain className="h-4 w-4" />
};

/**
 * PresetCard component - Displays a preset in card format
 */
const PresetCard: React.FC<{
  preset: ModelPreset;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}> = ({ preset, isSelected, onSelect, onEdit, onDelete, onDuplicate }) => {
  const model = getModelById(preset.modelId);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative p-4 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-accent/50"
      )}
      onClick={onSelect}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{preset.icon || "📋"}</span>
            <div>
              <h4 className="text-sm font-medium">{preset.name}</h4>
              {preset.isBuiltIn && (
                <Badge variant="secondary" className="text-xs mt-1">
                  Built-in
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {preset.description}
        </p>

        {/* Model info */}
        <div className="flex items-center gap-2">
          {MODEL_ICONS[preset.modelId] || <Sparkles className="h-3 w-3" />}
          <span className="text-xs font-medium">{model?.name || preset.modelId}</span>
        </div>

        {/* Configuration summary */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Temp:</span>
            <span className="font-mono">{preset.configuration.temperature}</span>
          </div>
          {preset.configuration.maxOutputTokens && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tokens:</span>
              <span className="font-mono">
                {(preset.configuration.maxOutputTokens / 1000).toFixed(0)}K
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {!preset.isBuiltIn && (
          <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.();
                    }}
                  >
                    <Settings2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit preset</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate?.();
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate preset</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete preset</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * ModelPresetsManager component - Manage model configuration presets
 */
export const ModelPresetsManager: React.FC<ModelPresetsManagerProps> = ({
  selectedPresetId,
  onPresetSelect,
  className,
}) => {
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ModelPreset | null>(null);
  const [deleteConfirmPreset, setDeleteConfirmPreset] = useState<ModelPreset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setLoading(true);
      // TODO: Load custom presets from API
      // For now, just use built-in presets
      setPresets([...BUILT_IN_PRESETS]);
    } catch (err) {
      console.error("Failed to load presets:", err);
      setError("Failed to load presets");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePreset = async (preset: Omit<ModelPreset, "id" | "createdAt" | "updatedAt">) => {
    try {
      const newPreset: ModelPreset = {
        ...preset,
        id: `custom-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // TODO: Save to API
      setPresets((prev) => [...prev, newPreset]);
      setShowCreateDialog(false);
    } catch (err) {
      console.error("Failed to create preset:", err);
    }
  };

  const handleUpdatePreset = async (preset: ModelPreset) => {
    try {
      // TODO: Update via API
      setPresets((prev) =>
        prev.map((p) => (p.id === preset.id ? { ...preset, updatedAt: new Date() } : p))
      );
      setEditingPreset(null);
    } catch (err) {
      console.error("Failed to update preset:", err);
    }
  };

  const handleDeletePreset = async (preset: ModelPreset) => {
    try {
      // TODO: Delete via API
      setPresets((prev) => prev.filter((p) => p.id !== preset.id));
      setDeleteConfirmPreset(null);
    } catch (err) {
      console.error("Failed to delete preset:", err);
    }
  };

  const handleDuplicatePreset = (preset: ModelPreset) => {
    const duplicate: ModelPreset = {
      ...preset,
      id: `custom-${Date.now()}`,
      name: `${preset.name} (Copy)`,
      isBuiltIn: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setPresets((prev) => [...prev, duplicate]);
  };

  const handleExportPresets = () => {
    const customPresets = presets.filter((p) => !p.isBuiltIn);
    const blob = new Blob([JSON.stringify(customPresets, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "model-presets.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string) as ModelPreset[];
          const newPresets = imported.map((p) => ({
            ...p,
            id: `custom-${Date.now()}-${Math.random()}`,
            isBuiltIn: false,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          }));
          setPresets((prev) => [...prev, ...newPresets]);
        } catch (err) {
          console.error("Failed to import presets:", err);
          setError("Failed to import presets");
        }
      };
      reader.readAsText(file);
    }
  };

  if (loading) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Model Presets</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Save and manage your favorite model configurations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Preset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPresets}
            disabled={presets.filter((p) => !p.isBuiltIn).length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <label>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <span>
                <Upload className="h-4 w-4" />
                Import
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={handleImportPresets}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Presets grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.map((preset) => (
          <div key={preset.id} className="group">
            <PresetCard
              preset={preset}
              isSelected={selectedPresetId === preset.id}
              onSelect={() => onPresetSelect?.(preset)}
              onEdit={() => setEditingPreset(preset)}
              onDelete={() => setDeleteConfirmPreset(preset)}
              onDuplicate={() => handleDuplicatePreset(preset)}
            />
          </div>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      {(showCreateDialog || editingPreset) && (
        <PresetDialog
          preset={editingPreset}
          onSave={(preset) => {
            if (editingPreset) {
              handleUpdatePreset({ ...editingPreset, ...preset });
            } else {
              handleCreatePreset(preset);
            }
          }}
          onCancel={() => {
            setShowCreateDialog(false);
            setEditingPreset(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirmPreset && (
        <AlertDialog
          open={!!deleteConfirmPreset}
          onOpenChange={() => setDeleteConfirmPreset(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Preset</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirmPreset.name}"? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeletePreset(deleteConfirmPreset)}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

/**
 * PresetDialog component - Create/Edit preset dialog
 */
const PresetDialog: React.FC<{
  preset?: ModelPreset | null;
  onSave: (preset: Omit<ModelPreset, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}> = ({ preset, onSave, onCancel }) => {
  const [name, setName] = useState(preset?.name || "");
  const [description, setDescription] = useState(preset?.description || "");
  const [modelId, setModelId] = useState(preset?.modelId || "sonnet");
  const [icon, setIcon] = useState(preset?.icon || "📋");
  const [configuration, setConfiguration] = useState<ModelConfiguration>(
    preset?.configuration || {
      temperature: 0.7,
      maxOutputTokens: 4096,
    }
  );

  const handleSave = () => {
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      modelId,
      icon,
      configuration,
    });
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{preset ? "Edit Preset" : "Create Preset"}</DialogTitle>
          <DialogDescription>
            Save your model configuration as a reusable preset
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Preset"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this preset is for..."
              rows={3}
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label htmlFor="icon">Icon (Emoji)</Label>
            <Input
              id="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📋"
              maxLength={2}
            />
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <select
              id="model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
            >
              {ALL_MODELS().map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Configuration preview */}
          <div className="space-y-2">
            <Label>Configuration</Label>
            <Card className="p-3">
              <pre className="text-xs font-mono">
                {JSON.stringify(configuration, null, 2)}
              </pre>
            </Card>
            <p className="text-xs text-muted-foreground">
              Edit configuration after creating the preset
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {preset ? "Update" : "Create"} Preset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};