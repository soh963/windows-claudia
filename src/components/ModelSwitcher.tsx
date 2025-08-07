import React, { useState, useEffect } from 'react';
import { ChevronRight, Loader2, AlertCircle, CheckCircle, Database, Brain } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '@/lib/utils/toast';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Model {
  id: string;
  name: string;
  available: boolean;
  provider: string;
}

interface MemoryStats {
  total_entries: number;
  total_tokens: number;
  memory_usage_mb: number;
  sessions_count: number;
  models_count: number;
}

interface TransferPreview {
  total_memories: number;
  total_tokens: number;
  target_max_tokens: number;
  will_compress: boolean;
  type_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  supports_tools: boolean;
  supports_images: boolean;
}

interface TransferResult {
  session_id: string;
  source_model: string;
  target_model: string;
  total_tokens: number;
  transfer_time_ms: number;
  success: boolean;
  message: string;
}

interface ModelSwitcherProps {
  currentModel: string;
  sessionId: string;
  models: Model[];
  onModelChange: (modelId: string) => void;
}

export function ModelSwitcher({ 
  currentModel, 
  sessionId, 
  models, 
  onModelChange 
}: ModelSwitcherProps) {
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [recommendedModel, setRecommendedModel] = useState<string>('');
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [transferPreview, setTransferPreview] = useState<TransferPreview | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [lastTransferResult, setLastTransferResult] = useState<TransferResult | null>(null);

  useEffect(() => {
    loadMemoryStats();
    if (sessionId) {
      getRecommendation();
    }
  }, [sessionId]);

  const loadMemoryStats = async () => {
    try {
      const stats = await invoke<MemoryStats>('get_memory_stats');
      setMemoryStats(stats);
    } catch (error) {
      console.error('Failed to load memory stats:', error);
    }
  };

  const getRecommendation = async () => {
    try {
      const model = await invoke<string>('recommend_model_for_context', { sessionId });
      setRecommendedModel(model);
    } catch (error) {
      console.error('Failed to get recommendation:', error);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    if (modelId === currentModel) return;
    
    setSelectedModel(modelId);
    
    if (!sessionId) {
      // No session context to transfer
      onModelChange(modelId);
      return;
    }

    // Preview the transfer
    try {
      const preview = await invoke<TransferPreview>('preview_context_transfer', {
        sessionId,
        sourceModel: currentModel,
        targetModel: modelId
      });
      setTransferPreview(preview);
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to preview transfer:', error);
      toast.error('Failed to preview context transfer');
    }
  };

  const confirmTransfer = async () => {
    if (!selectedModel || !sessionId) return;

    setIsTransferring(true);
    try {
      const result = await invoke<TransferResult>('transfer_context_to_model', {
        sessionId,
        sourceModel: currentModel,
        targetModel: selectedModel
      });

      if (result.success) {
        setLastTransferResult(result);
        toast.success(`Context transferred in ${result.transfer_time_ms}ms`);
        onModelChange(selectedModel);
        setShowPreview(false);
        await loadMemoryStats();
      } else {
        toast.error(result.message || 'Transfer failed');
      }
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error('Failed to transfer context');
    } finally {
      setIsTransferring(false);
    }
  };

  const formatTokens = (count: number): string => {
    if (count > 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count > 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="model-switcher space-y-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Model
        </h3>
        {memoryStats && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Database className="h-4 w-4" />
              {formatTokens(memoryStats.total_tokens)} tokens
            </span>
            <span>{memoryStats.memory_usage_mb.toFixed(1)}MB</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {models.map((model) => {
          const isRecommended = model.id === recommendedModel;
          const isCurrent = model.id === currentModel;
          const isSelected = model.id === selectedModel;

          return (
            <Button
              key={model.id}
              variant={isCurrent ? 'default' : isSelected ? 'secondary' : 'outline'}
              size="sm"
              disabled={!model.available || isTransferring}
              onClick={() => handleModelSelect(model.id)}
              className={`relative ${isRecommended ? 'ring-2 ring-green-500' : ''}`}
            >
              <span className="truncate">{model.name}</span>
              {isRecommended && (
                <span className="absolute -top-2 -right-2 px-1 py-0.5 text-xs bg-green-500 text-white rounded">
                  Recommended
                </span>
              )}
              {!model.available && (
                <span className="absolute inset-0 bg-background/80 flex items-center justify-center text-xs">
                  Unavailable
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {lastTransferResult && (
        <Alert className="bg-green-500/10 border-green-500/30">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription>
            Last transfer: {lastTransferResult.source_model} → {lastTransferResult.target_model} 
            ({formatTokens(lastTransferResult.total_tokens)} tokens in {lastTransferResult.transfer_time_ms}ms)
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Context Transfer Preview</DialogTitle>
            <DialogDescription>
              Transfer conversation context from {currentModel} to {selectedModel}
            </DialogDescription>
          </DialogHeader>

          {transferPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Memories to Transfer</label>
                  <div className="text-2xl font-bold">{transferPreview.total_memories}</div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total Tokens</label>
                  <div className="text-2xl font-bold">
                    <span className={transferPreview.will_compress ? 'text-orange-500' : ''}>
                      {formatTokens(transferPreview.total_tokens)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {' / '}{formatTokens(transferPreview.target_max_tokens)}
                    </span>
                  </div>
                </div>
              </div>

              {transferPreview.will_compress && (
                <Alert className="bg-orange-500/10 border-orange-500/30">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <AlertDescription>
                    Context will be intelligently compressed to fit the target model's token limit
                  </AlertDescription>
                </Alert>
              )}

              {transferPreview.type_distribution && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Memory Type Distribution</label>
                  <div className="space-y-2">
                    {Object.entries(transferPreview.type_distribution).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-2">
                        <span className="text-sm w-24">{type}:</span>
                        <div className="flex-1 bg-secondary rounded-full h-6 relative">
                          <div 
                            className="absolute inset-y-0 left-0 bg-primary rounded-full"
                            style={{ width: `${(count / transferPreview.total_memories) * 100}%` }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={transferPreview.supports_tools} readOnly />
                  <label>Tool Support</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={transferPreview.supports_images} readOnly />
                  <label>Image Support</label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isTransferring}>
              Cancel
            </Button>
            <Button onClick={confirmTransfer} disabled={isTransferring}>
              {isTransferring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Transfer Context
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}