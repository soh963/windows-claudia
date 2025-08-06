import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, 
  ExternalLink, 
  Check, 
  X, 
  Loader2, 
  AlertCircle,
  Info,
  Shield,
  Zap,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { ALL_MODELS, isGeminiModel } from '@/lib/models';
import { cn } from '@/lib/utils';

interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onApiKeySet?: () => void;
  selectedModel?: string;
}

interface ApiKeyValidation {
  modelId: string;
  isValid: boolean;
  error?: string;
  latency?: number;
}

interface ApiKeyInfo {
  key: string;
  isVisible: boolean;
  isVerified: boolean;
  lastVerified?: Date;
}

export const EnhancedGeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onApiKeySet,
  selectedModel
}) => {
  const [apiKeyInfo, setApiKeyInfo] = useState<ApiKeyInfo>({
    key: '',
    isVisible: false,
    isVerified: false
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [isBatchVerifying, setIsBatchVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [validationResults, setValidationResults] = useState<ApiKeyValidation[]>([]);
  const [multipleKeys, setMultipleKeys] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Get all Gemini models
  const geminiModels = ALL_MODELS.filter(model => isGeminiModel(model.id));

  // Load existing API key on mount
  useEffect(() => {
    const loadExistingKey = async () => {
      try {
        const key = await api.getGeminiApiKey();
        if (key) {
          setApiKeyInfo({
            key,
            isVisible: false,
            isVerified: true,
            lastVerified: new Date()
          });
        }
      } catch (err) {
        console.error('Failed to load existing API key:', err);
      }
    };

    if (isOpen) {
      loadExistingKey();
    }
  }, [isOpen]);

  const handleSingleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKeyInfo.key.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Verify the API key
      const isValid = await api.verifyGeminiApiKey(apiKeyInfo.key);
      
      if (isValid) {
        // Save the API key
        await api.setGeminiApiKey(apiKeyInfo.key);
        setApiKeyInfo(prev => ({
          ...prev,
          isVerified: true,
          lastVerified: new Date()
        }));
        onSuccess();
        onApiKeySet?.();
      } else {
        setError('Invalid API key. Please check and try again.');
      }
    } catch (error) {
      console.error('Failed to verify Gemini API key:', error);
      setError('Failed to verify API key. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBatchVerification = async () => {
    setIsBatchVerifying(true);
    setValidationResults([]);
    setVerificationProgress(0);
    
    const keysToVerify = Object.entries(multipleKeys).filter(([_, key]) => key.trim());
    const total = keysToVerify.length;
    let completed = 0;
    
    const results: ApiKeyValidation[] = [];
    
    for (const [modelId, key] of keysToVerify) {
      const startTime = Date.now();
      try {
        const isValid = await api.verifyGeminiApiKey(key);
        results.push({
          modelId,
          isValid,
          latency: Date.now() - startTime
        });
      } catch (err) {
        results.push({
          modelId,
          isValid: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          latency: Date.now() - startTime
        });
      }
      
      completed++;
      setVerificationProgress((completed / total) * 100);
    }
    
    setValidationResults(results);
    setIsBatchVerifying(false);
    
    // If all keys are valid, save the first one as the primary key
    const validKey = results.find(r => r.isValid);
    if (validKey) {
      const key = multipleKeys[validKey.modelId];
      await api.setGeminiApiKey(key);
      onSuccess();
      onApiKeySet?.();
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKeyInfo.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleKeyVisibility = () => {
    setApiKeyInfo(prev => ({ ...prev, isVisible: !prev.isVisible }));
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    const visibleChars = 8;
    if (key.length <= visibleChars * 2) return key;
    return `${key.slice(0, visibleChars)}${'•'.repeat(key.length - visibleChars * 2)}${key.slice(-visibleChars)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gemini API Key Configuration
          </DialogTitle>
          <DialogDescription>
            Configure your Google AI Studio API key to use Gemini models.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'single' | 'batch')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single Key</TabsTrigger>
            <TabsTrigger value="batch">Batch Verification</TabsTrigger>
          </TabsList>

          {/* Single Key Tab */}
          <TabsContent value="single" className="space-y-4">
            <form onSubmit={handleSingleKeySubmit} className="space-y-4">
              {/* Existing key display */}
              {apiKeyInfo.isVerified && apiKeyInfo.lastVerified && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <Shield className="h-4 w-4 text-green-500" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      API key verified {new Date(apiKeyInfo.lastVerified).toLocaleDateString()}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="api-key" className="text-sm font-medium">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={apiKeyInfo.isVisible ? "text" : "password"}
                    value={apiKeyInfo.key}
                    onChange={(e) => setApiKeyInfo(prev => ({ ...prev, key: e.target.value }))}
                    placeholder="Enter your Gemini API key (AIza...)"
                    className="font-mono pr-20"
                    disabled={isVerifying}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={toggleKeyVisibility}
                          >
                            {apiKeyInfo.isVisible ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {apiKeyInfo.isVisible ? 'Hide' : 'Show'} API key
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCopyKey}
                            disabled={!apiKeyInfo.key}
                          >
                            {copied ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copied ? 'Copied!' : 'Copy API key'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                  </p>
                )}
              </div>

              {/* API Key info */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium">To get your API key:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Visit Google AI Studio</li>
                      <li>Sign in with your Google account</li>
                      <li>Navigate to the API keys section</li>
                      <li>Create a new API key or copy an existing one</li>
                    </ol>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    Get API Key <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    Free tier: 15 RPM, 1M TPM
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isVerifying}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!apiKeyInfo.key.trim() || isVerifying}
                  className="gap-2"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Save & Verify
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Batch Verification Tab */}
          <TabsContent value="batch" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Test multiple API keys across different Gemini models to find the best performing one.
                </AlertDescription>
              </Alert>

              {/* Model key inputs */}
              <div className="space-y-3">
                {geminiModels.map(model => (
                  <div key={model.id} className="space-y-2">
                    <Label htmlFor={`key-${model.id}`} className="text-sm">
                      {model.name}
                    </Label>
                    <Input
                      id={`key-${model.id}`}
                      type="password"
                      value={multipleKeys[model.id] || ''}
                      onChange={(e) => setMultipleKeys(prev => ({
                        ...prev,
                        [model.id]: e.target.value
                      }))}
                      placeholder="Enter API key for this model"
                      className="font-mono text-sm"
                      disabled={isBatchVerifying}
                    />
                  </div>
                ))}
              </div>

              {/* Verification progress */}
              {isBatchVerifying && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Verifying keys...</span>
                    <span className="font-mono">{verificationProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={verificationProgress} className="h-2" />
                </div>
              )}

              {/* Validation results */}
              {validationResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Verification Results</h4>
                  <div className="space-y-2">
                    {validationResults.map(result => (
                      <div
                        key={result.modelId}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          result.isValid 
                            ? "border-green-500/50 bg-green-500/10" 
                            : "border-red-500/50 bg-red-500/10"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {result.isValid ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm font-medium">
                            {geminiModels.find(m => m.id === result.modelId)?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.latency && (
                            <span className="text-xs text-muted-foreground">
                              {result.latency}ms
                            </span>
                          )}
                          {result.error && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{result.error}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isBatchVerifying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchVerification}
                  disabled={isBatchVerifying || Object.values(multipleKeys).every(k => !k.trim())}
                  className="gap-2"
                >
                  {isBatchVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Verify All Keys
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};