import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle,
  Loader2,
  Zap,
  Sparkles,
  Star,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  api, 
  type ClaudeSettings,
  type ClaudeInstallation,
  type VersionInfo
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { ClaudeVersionSelector } from "./ClaudeVersionSelector";
import { StorageTab } from "./StorageTab";
import { HooksEditor } from "./HooksEditor";
import { SlashCommandsManager } from "./SlashCommandsManager";
import { ProxySettings } from "./ProxySettings";
import ClaudeSyncStatus from "./ClaudeSyncStatus";
import { ModelSelector } from "./ModelSelector";
import { ModelConfiguration } from "./ModelConfiguration";
import { GeminiApiKeyModal } from "./GeminiApiKeyModal";
import { useTheme } from "@/hooks";
import { ALL_MODELS, refreshDynamicModels, getModelStatistics, type ModelConfiguration as ModelConfig } from "@/lib/models";

interface SettingsProps {
  /**
   * Callback to go back to the main view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

interface PermissionRule {
  id: string;
  value: string;
}

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

/**
 * Comprehensive Settings UI for managing Claude Code settings
 * Provides a no-code interface for editing the settings.json file
 */
export const Settings: React.FC<SettingsProps> = ({
  onBack,
  className,
}) => {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [currentBinaryPath, setCurrentBinaryPath] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);
  const [binaryPathChanged, setBinaryPathChanged] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [verifyingApiKey, setVerifyingApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("sonnet");
  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfig>>({});
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [showGeminiApiKeyModal, setShowGeminiApiKeyModal] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  
  // Permission rules state
  const [allowRules, setAllowRules] = useState<PermissionRule[]>([]);
  const [denyRules, setDenyRules] = useState<PermissionRule[]>([]);
  
  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  
  // Hooks state
  const [userHooksChanged, setUserHooksChanged] = useState(false);
  const getUserHooks = React.useRef<(() => any) | null>(null);

  // Models state  
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [modelStats, setModelStats] = useState<ReturnType<typeof getModelStatistics> | null>(null);
  
  // Theme hook
  const { theme, setTheme, customColors, setCustomColors } = useTheme();
  
  // Proxy state
  const [proxySettingsChanged, setProxySettingsChanged] = useState(false);
  const saveProxySettings = React.useRef<(() => Promise<void>) | null>(null);
  
  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadClaudeBinaryPath();
    loadGeminiApiKey();
    loadVersionInfo();
    loadModelStats();
  }, []);

  const loadModelStats = () => {
    const stats = getModelStatistics();
    setModelStats(stats);
  };

  const loadVersionInfo = async () => {
    try {
      const versionData = await api.getVersionInfo();
      setVersionInfo(versionData);
    } catch (err) {
      console.error("Failed to load version info:", err);
    }
  };

  const loadGeminiApiKey = async () => {
    try {
      const key = await api.getGeminiApiKey();
      setGeminiApiKey(key || "");
    } catch (err) {
      console.error("Failed to load Gemini API key:", err);
      setGeminiApiKey("");
      // Don't show error to user for missing key - it's expected initially
    }
  };

  /**
   * Loads the current Claude binary path
   */
  const loadClaudeBinaryPath = async () => {
    try {
      const path = await api.getClaudeBinaryPath();
      setCurrentBinaryPath(path);
    } catch (err) {
      console.error("Failed to load Claude binary path:", err);
    }
  };

  /**
   * Refresh dynamic Ollama models
   */
  const handleRefreshModels = async () => {
    try {
      setRefreshingModels(true);
      console.log('🔄 Refreshing dynamic Ollama models...');
      
      await refreshDynamicModels();
      loadModelStats();
      
      // Emit refresh event for other components
      window.dispatchEvent(new CustomEvent('refresh-models'));
      
      setToast({
        message: 'Models refreshed successfully!',
        type: 'success'
      });
      
      console.log('✅ Models refreshed successfully');
      
    } catch (error) {
      console.error('❌ Failed to refresh models:', error);
      setToast({
        message: 'Failed to refresh models. Check if Ollama is running.',
        type: 'error'
      });
    } finally {
      setRefreshingModels(false);
    }
  };

  /**
   * Loads the current Claude settings
   */
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await api.getClaudeSettings();
      
      // Ensure loadedSettings is an object
      if (!loadedSettings || typeof loadedSettings !== 'object') {
        console.warn("Loaded settings is not an object:", loadedSettings);
        setSettings({});
        return;
      }
      
      setSettings(loadedSettings);

      // Parse permissions
      if (loadedSettings.permissions && typeof loadedSettings.permissions === 'object') {
        if (Array.isArray(loadedSettings.permissions.allow)) {
          setAllowRules(
            loadedSettings.permissions.allow.map((rule: string, index: number) => ({
              id: `allow-${index}`,
              value: rule,
            }))
          );
        }
        if (Array.isArray(loadedSettings.permissions.deny)) {
          setDenyRules(
            loadedSettings.permissions.deny.map((rule: string, index: number) => ({
              id: `deny-${index}`,
              value: rule,
            }))
          );
        }
      }

      // Parse environment variables
      if (loadedSettings.env && typeof loadedSettings.env === 'object' && !Array.isArray(loadedSettings.env)) {
        setEnvVars(
          Object.entries(loadedSettings.env).map(([key, value], index) => ({
            id: `env-${index}`,
            key,
            value: value as string,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("Failed to load settings. Please ensure ~/.claude directory exists.");
      setSettings({});
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves the current settings
   */
  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);

      // Build the settings object
      const updatedSettings: ClaudeSettings = {
        ...settings,
        permissions: {
          allow: allowRules.map(rule => rule.value).filter(v => v && String(v).trim()),
          deny: denyRules.map(rule => rule.value).filter(v => v && String(v).trim()),
        },
        env: envVars.reduce((acc, { key, value }) => {
          if (key && String(key).trim() && value && String(value).trim()) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>),
      };

      await api.saveClaudeSettings(updatedSettings);
      setSettings(updatedSettings);

      // Save Claude binary path if changed
      if (binaryPathChanged && selectedInstallation) {
        await api.setClaudeBinaryPath(selectedInstallation.path);
        setCurrentBinaryPath(selectedInstallation.path);
        setBinaryPathChanged(false);
      }

      // Save user hooks if changed
      if (userHooksChanged && getUserHooks.current) {
        const hooks = getUserHooks.current();
        await api.updateHooksConfig('user', hooks);
        setUserHooksChanged(false);
      }

      // Save proxy settings if changed
      if (proxySettingsChanged && saveProxySettings.current) {
        await saveProxySettings.current();
        setProxySettingsChanged(false);
      }

      // Save Gemini API key with validation
      try {
        if (geminiApiKey?.trim()) {
          await api.setGeminiApiKey(geminiApiKey.trim());
        } else {
          // Clear the API key if empty
          await api.setGeminiApiKey("");
        }
      } catch (keyError) {
        console.error("Failed to save Gemini API key:", keyError);
        // Continue with other settings but show a specific error
        setToast({ 
          message: `Settings saved, but Gemini API key error: ${keyError instanceof Error ? keyError.message : 'Unknown error'}`, 
          type: "error" 
        });
        return;
      }

      setToast({ message: "Settings saved successfully!", type: "success" });
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Failed to save settings.");
      setToast({ message: "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Updates a simple setting value
   */
  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Adds a new permission rule
   */
  const addPermissionRule = (type: "allow" | "deny") => {
    const newRule: PermissionRule = {
      id: `${type}-${Date.now()}`,
      value: "",
    };
    
    if (type === "allow") {
      setAllowRules(prev => [...prev, newRule]);
    } else {
      setDenyRules(prev => [...prev, newRule]);
    }
  };

  /**
   * Updates a permission rule
   */
  const updatePermissionRule = (type: "allow" | "deny", id: string, value: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, value } : rule
      ));
    } else {
      setDenyRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, value } : rule
      ));
    }
  };

  /**
   * Removes a permission rule
   */
  const removePermissionRule = (type: "allow" | "deny", id: string) => {
    if (type === "allow") {
      setAllowRules(prev => prev.filter(rule => rule.id !== id));
    } else {
      setDenyRules(prev => prev.filter(rule => rule.id !== id));
    }
  };

  /**
   * Adds a new environment variable
   */
  const addEnvVar = () => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: "",
      value: "",
    };
    setEnvVars(prev => [...prev, newVar]);
  };

  /**
   * Updates an environment variable
   */
  const updateEnvVar = (id: string, field: "key" | "value", value: string) => {
    setEnvVars(prev => prev.map(envVar => 
      envVar.id === id ? { ...envVar, [field]: value } : envVar
    ));
  };

  /**
   * Removes an environment variable
   */
  const removeEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(envVar => envVar.id !== id));
  };

  /**
   * Handle Claude installation selection
   */
  const handleClaudeInstallationSelect = (installation: ClaudeInstallation) => {
    setSelectedInstallation(installation);
    setBinaryPathChanged(installation.path !== currentBinaryPath);
  };

  /**
   * Verify the Gemini API key
   */
  const verifyGeminiApiKey = async () => {
    if (!geminiApiKey?.trim()) {
      setToast({ message: "Please enter an API key first", type: "error" });
      return;
    }

    setVerifyingApiKey(true);
    try {
      const isValid = await api.verifyGeminiApiKey(geminiApiKey.trim());
      if (isValid) {
        setToast({ message: "API key is valid!", type: "success" });
      } else {
        setToast({ message: "API key is invalid or expired", type: "error" });
      }
    } catch (err) {
      console.error("Failed to verify API key:", err);
      setToast({ message: "Failed to verify API key", type: "error" });
    } finally {
      setVerifyingApiKey(false);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
        <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-xs text-muted-foreground">
              Configure Claude Code preferences
          </p>
          </div>
        </div>
        
        <Button
          onClick={saveSettings}
          disabled={saving || loading}
          size="sm"
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </motion.div>
      
      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-10 w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="models">Models</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="environment">Environment</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="sync">Claude Sync</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
              <TabsTrigger value="proxy">Proxy</TabsTrigger>
            </TabsList>
            
            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="text-base font-semibold mb-4">General Settings</h3>
                  
                  <div className="space-y-4">
                    {/* Theme Selector */}
                    <div className="space-y-2">
                      <Label htmlFor="theme">Theme</Label>
                      <Select
                        value={theme}
                        onValueChange={(value) => setTheme(value as any)}
                      >
                        <SelectTrigger id="theme" className="w-full">
                          <SelectValue placeholder="Select a theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="gray">Gray</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choose your preferred color theme for the interface
                      </p>
                    </div>
                    
                    {/* Custom Color Editor */}
                    {theme === 'custom' && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                        <h4 className="text-sm font-medium">Custom Theme Colors</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Background Color */}
                          <div className="space-y-2">
                            <Label htmlFor="color-background" className="text-xs">Background</Label>
                            <div className="flex gap-2">
                              <Input
                                id="color-background"
                                type="text"
                                value={customColors.background}
                                onChange={(e) => setCustomColors({ background: e.target.value })}
                                placeholder="oklch(0.12 0.01 240)"
                                className="font-mono text-xs"
                              />
                              <div 
                                className="w-10 h-10 rounded border"
                                style={{ backgroundColor: customColors.background }}
                              />
                            </div>
                          </div>
                          
                          {/* Foreground Color */}
                          <div className="space-y-2">
                            <Label htmlFor="color-foreground" className="text-xs">Foreground</Label>
                            <div className="flex gap-2">
                              <Input
                                id="color-foreground"
                                type="text"
                                value={customColors.foreground}
                                onChange={(e) => setCustomColors({ foreground: e.target.value })}
                                placeholder="oklch(0.98 0.01 240)"
                                className="font-mono text-xs"
                              />
                              <div 
                                className="w-10 h-10 rounded border"
                                style={{ backgroundColor: customColors.foreground }}
                              />
                            </div>
                          </div>
                          
                          {/* Primary Color */}
                          <div className="space-y-2">
                            <Label htmlFor="color-primary" className="text-xs">Primary</Label>
                            <div className="flex gap-2">
                              <Input
                                id="color-primary"
                                type="text"
                                value={customColors.primary}
                                onChange={(e) => setCustomColors({ primary: e.target.value })}
                                placeholder="oklch(0.98 0.01 240)"
                                className="font-mono text-xs"
                              />
                              <div 
                                className="w-10 h-10 rounded border"
                                style={{ backgroundColor: customColors.primary }}
                              />
                            </div>
                          </div>
                          
                          {/* Card Color */}
                          <div className="space-y-2">
                            <Label htmlFor="color-card" className="text-xs">Card</Label>
                            <div className="flex gap-2">
                              <Input
                                id="color-card"
                                type="text"
                                value={customColors.card}
                                onChange={(e) => setCustomColors({ card: e.target.value })}
                                placeholder="oklch(0.14 0.01 240)"
                                className="font-mono text-xs"
                              />
                              <div 
                                className="w-10 h-10 rounded border"
                                style={{ backgroundColor: customColors.card }}
                              />
                            </div>
                          </div>
                          
                          {/* Accent Color */}
                          <div className="space-y-2">
                            <Label htmlFor="color-accent" className="text-xs">Accent</Label>
                            <div className="flex gap-2">
                              <Input
                                id="color-accent"
                                type="text"
                                value={customColors.accent}
                                onChange={(e) => setCustomColors({ accent: e.target.value })}
                                placeholder="oklch(0.16 0.01 240)"
                                className="font-mono text-xs"
                              />
                              <div 
                                className="w-10 h-10 rounded border"
                                style={{ backgroundColor: customColors.accent }}
                              />
                            </div>
                          </div>
                          
                          {/* Destructive Color */}
                          <div className="space-y-2">
                            <Label htmlFor="color-destructive" className="text-xs">Destructive</Label>
                            <div className="flex gap-2">
                              <Input
                                id="color-destructive"
                                type="text"
                                value={customColors.destructive}
                                onChange={(e) => setCustomColors({ destructive: e.target.value })}
                                placeholder="oklch(0.6 0.2 25)"
                                className="font-mono text-xs"
                              />
                              <div 
                                className="w-10 h-10 rounded border"
                                style={{ backgroundColor: customColors.destructive }}
                              />
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Use CSS color values (hex, rgb, oklch, etc.). Changes apply immediately.
                        </p>
                      </div>
                    )}
                    
                    {/* Include Co-authored By */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="coauthored">Include "Co-authored by Claude"</Label>
                        <p className="text-xs text-muted-foreground">
                          Add Claude attribution to git commits and pull requests
                        </p>
                      </div>
                      <Switch
                        id="coauthored"
                        checked={settings?.includeCoAuthoredBy !== false}
                        onCheckedChange={(checked) => updateSetting("includeCoAuthoredBy", checked)}
                      />
                    </div>
                    
                    {/* Verbose Output */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="verbose">Verbose Output</Label>
                        <p className="text-xs text-muted-foreground">
                          Show full bash and command outputs
                        </p>
                      </div>
                      <Switch
                        id="verbose"
                        checked={settings?.verbose === true}
                        onCheckedChange={(checked) => updateSetting("verbose", checked)}
                      />
                    </div>
                    
                    {/* Cleanup Period */}
                    <div className="space-y-2">
                      <Label htmlFor="cleanup">Chat Transcript Retention (days)</Label>
                      <Input
                        id="cleanup"
                        type="number"
                        min="1"
                        placeholder="30"
                        value={settings?.cleanupPeriodDays || ""}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : undefined;
                          updateSetting("cleanupPeriodDays", value);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        How long to retain chat transcripts locally (default: 30 days)
                      </p>
                    </div>
                    
                    {/* Claude Binary Path Selector */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Claude Code Installation</Label>
                        <p className="text-xs text-muted-foreground mb-4">
                          Select which Claude Code installation to use.
                        </p>
                      </div>
                      <ClaudeVersionSelector
                        selectedPath={currentBinaryPath}
                        onSelect={handleClaudeInstallationSelect}
                      />
                      {binaryPathChanged && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ Claude binary path has been changed. Remember to save your settings.
                        </p>
                      )}
                    </div>

                    {/* Version Information */}
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Application Information</Label>
                        <div className="space-y-3">
                          {versionInfo ? (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Version:</span>
                                <span className="text-sm font-mono">{versionInfo.version}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Build Time:</span>
                                <span className="text-sm font-mono">{versionInfo.build_time}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Tauri Version:</span>
                                <span className="text-sm font-mono">{versionInfo.tauri_version}</span>
                              </div>
                              {versionInfo.git_commit && (
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">Git Commit:</span>
                                  <span className="text-sm font-mono">{versionInfo.git_commit}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Loading version information...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            {/* Models Settings */}
            <TabsContent value="models" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold mb-4">Model Selection & Configuration</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Choose your preferred AI model and customize its parameters for optimal performance
                    </p>
                  </div>

                  {/* Model Selector */}
                  <div className="space-y-4">
                    <Label>Default Model</Label>
                    <ModelSelector
                      value={selectedModel}
                      onChange={setSelectedModel}
                      allowConfiguration={true}
                      onGeminiApiKeyNeeded={() => setShowGeminiApiKeyModal(true)}
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be the default model for new chat sessions
                    </p>
                  </div>

                  {/* Model Configuration */}
                  {selectedModel && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <Label>Model Configuration</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowModelConfig(!showModelConfig)}
                        >
                          {showModelConfig ? "Hide" : "Show"} Configuration
                        </Button>
                      </div>
                      
                      <AnimatePresence>
                        {showModelConfig && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ModelConfiguration
                              modelId={selectedModel}
                              configuration={modelConfigs[selectedModel] || {}}
                              onChange={(config) => {
                                setModelConfigs((prev) => ({
                                  ...prev,
                                  [selectedModel]: config,
                                }));
                              }}
                              mode="inline"
                              className="mt-4"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Model Presets */}
                  <div className="space-y-4 pt-4 border-t">
                    <Label>Quick Presets</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedModel("sonnet");
                          setModelConfigs((prev) => ({
                            ...prev,
                            sonnet: { temperature: 0.7, maxOutputTokens: 4096 },
                          }));
                        }}
                        className="justify-start gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        Fast & Efficient
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedModel("opus");
                          setModelConfigs((prev) => ({
                            ...prev,
                            opus: { temperature: 0.8, maxOutputTokens: 8192 },
                          }));
                        }}
                        className="justify-start gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Complex Tasks
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedModel("gemini-2.0-flash-exp");
                          setModelConfigs((prev) => ({
                            ...prev,
                            "gemini-2.0-flash-exp": { temperature: 0.7, maxOutputTokens: 8192 },
                          }));
                        }}
                        className="justify-start gap-2"
                      >
                        <Star className="h-4 w-4" />
                        Gemini Flash
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedModel("gemini-exp-1206");
                          setModelConfigs((prev) => ({
                            ...prev,
                            "gemini-exp-1206": { temperature: 0.8, maxOutputTokens: 8192 },
                          }));
                        }}
                        className="justify-start gap-2"
                      >
                        <Brain className="h-4 w-4" />
                        Gemini Advanced
                      </Button>
                    </div>
                  </div>

                  {/* Model Management Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Model Management</Label>
                        <p className="text-xs text-muted-foreground">
                          Manage local Ollama models and refresh model list
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshModels}
                        disabled={refreshingModels}
                        className="gap-2"
                      >
                        {refreshingModels ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <div className="h-4 w-4">🔄</div>
                        )}
                        {refreshingModels ? 'Refreshing...' : 'Refresh Models'}
                      </Button>
                    </div>

                    {/* Model Statistics */}
                    {modelStats && (
                      <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {modelStats.claude}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Claude
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {modelStats.gemini}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Gemini
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {modelStats.ollama}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Ollama {modelStats.dynamic ? '(Dynamic)' : '(Static)'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {modelStats.total}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Model Status Info */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>Claude models are always available with API key</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Gemini models require API key setup</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${modelStats?.dynamic ? 'bg-orange-500' : 'bg-gray-400'}`}></div>
                        <span>
                          Ollama models are {modelStats?.dynamic ? 'dynamically detected from local installation' : 'using static fallback list'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            {/* Permissions Settings */}
            <TabsContent value="permissions" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold mb-2">Permission Rules</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Control which tools Claude Code can use without manual approval
                    </p>
                  </div>
                  
                  {/* Allow Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-green-500">Allow Rules</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addPermissionRule("allow")}
                        className="gap-2 hover:border-green-500/50 hover:text-green-500"
                      >
                        <Plus className="h-3 w-3" />
                        Add Rule
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {allowRules.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No allow rules configured. Claude will ask for approval for all tools.
                        </p>
                      ) : (
                        allowRules.map((rule) => (
                          <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Input
                              placeholder="e.g., Bash(npm run test:*)"
                              value={rule.value}
                              onChange={(e) => updatePermissionRule("allow", rule.id, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePermissionRule("allow", rule.id)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Deny Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-red-500">Deny Rules</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addPermissionRule("deny")}
                        className="gap-2 hover:border-red-500/50 hover:text-red-500"
                      >
                        <Plus className="h-3 w-3" />
                        Add Rule
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {denyRules.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No deny rules configured.
                        </p>
                      ) : (
                        denyRules.map((rule) => (
                          <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Input
                              placeholder="e.g., Bash(curl:*)"
                              value={rule.value}
                              onChange={(e) => updatePermissionRule("deny", rule.id, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePermissionRule("deny", rule.id)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      <strong>Examples:</strong>
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash</code> - Allow all bash commands</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run build)</code> - Allow exact command</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run test:*)</code> - Allow commands with prefix</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Read(~/.zshrc)</code> - Allow reading specific file</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Edit(docs/**)</code> - Allow editing files in docs directory</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            {/* Environment Variables */}
            <TabsContent value="environment" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">Environment Variables</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Environment variables applied to every Claude Code session
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addEnvVar}
                      className="gap-2"
                    >
                      <Plus className="h-3 w-3" />
                      Add Variable
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {envVars.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No environment variables configured.
                      </p>
                    ) : (
                      envVars.map((envVar) => (
                        <motion.div
                          key={envVar.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2"
                        >
                          <Input
                            placeholder="KEY"
                            value={envVar.key}
                            onChange={(e) => updateEnvVar(envVar.id, "key", e.target.value)}
                            className="flex-1 font-mono text-sm"
                          />
                          <span className="text-muted-foreground">=</span>
                          <Input
                            placeholder="value"
                            value={envVar.value}
                            onChange={(e) => updateEnvVar(envVar.id, "value", e.target.value)}
                            className="flex-1 font-mono text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEnvVar(envVar.id)}
                            className="h-8 w-8 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      ))
                    )}
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      <strong>Common variables:</strong>
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">CLAUDE_CODE_ENABLE_TELEMETRY</code> - Enable/disable telemetry (0 or 1)</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">ANTHROPIC_MODEL</code> - Custom model name</li>
                      <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">DISABLE_COST_WARNINGS</code> - Disable cost warnings (1)</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>
            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold mb-4">Advanced Settings</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Additional configuration options for advanced users
                    </p>
                  </div>
                  
                  {/* API Key Helper */}
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyHelper">API Key Helper Script</Label>
                    <Input
                      id="apiKeyHelper"
                      placeholder="/path/to/generate_api_key.sh"
                      value={settings?.apiKeyHelper || ""}
                      onChange={(e) => updateSetting("apiKeyHelper", e.target.value || undefined)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Custom script to generate auth values for API requests
                    </p>
                  </div>

                  {/* Gemini API Key */}
                  <div className="space-y-2">
                    <Label htmlFor="geminiApiKey">Gemini API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="geminiApiKey"
                        type="password"
                        placeholder="Enter your Gemini API key (starts with AIza...)"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={verifyGeminiApiKey}
                        disabled={verifyingApiKey || !geminiApiKey?.trim()}
                        className="shrink-0"
                      >
                        {verifyingApiKey ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Verifying...
                          </>
                        ) : (
                          'Verify'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your Gemini API key is stored locally and encrypted. Get your API key from{' '}
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Google AI Studio
                      </a>
                    </p>
                  </div>
                  
                  {/* Raw JSON Editor */}
                  <div className="space-y-2">
                    <Label>Raw Settings (JSON)</Label>
                    <div className="p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                      <pre>{JSON.stringify(settings, null, 2)}</pre>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This shows the raw JSON that will be saved to ~/.claude/settings.json
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            {/* Hooks Settings */}
            <TabsContent value="hooks" className="space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-2">User Hooks</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure hooks that apply to all Claude Code sessions for your user account.
                      These are stored in <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">~/.claude/settings.json</code>
                    </p>
                  </div>
                  
                  <HooksEditor
                    key={activeTab}
                    scope="user"
                    className="border-0"
                    hideActions={true}
                    onChange={(hasChanges, getHooks) => {
                      setUserHooksChanged(hasChanges);
                      getUserHooks.current = getHooks;
                    }}
                  />
                </div>
              </Card>
            </TabsContent>
            
            {/* Commands Tab */}
            <TabsContent value="commands">
              <Card className="p-6">
                <SlashCommandsManager className="p-0" />
              </Card>
            </TabsContent>
            
            {/* Claude Sync Tab */}
            <TabsContent value="sync">
              <ClaudeSyncStatus />
            </TabsContent>
            
            {/* Storage Tab */}
            <TabsContent value="storage">
              <StorageTab />
            </TabsContent>
            
            {/* Proxy Settings */}
            <TabsContent value="proxy">
              <Card className="p-6">
                <ProxySettings 
                  setToast={setToast}
                  onChange={(hasChanges, _getSettings, save) => {
                    setProxySettingsChanged(hasChanges);
                    saveProxySettings.current = save;
                  }}
                />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
      </div>
      
      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
      
      {/* Gemini API Key Modal */}
      {showGeminiApiKeyModal && (
        <GeminiApiKeyModal
          isOpen={showGeminiApiKeyModal}
          onClose={() => setShowGeminiApiKeyModal(false)}
          onApiKeySet={() => {
            setShowGeminiApiKeyModal(false);
            loadGeminiApiKey();
          }}
        />
      )}
    </div>
  );
}; 
