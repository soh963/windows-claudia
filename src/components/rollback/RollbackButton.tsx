import React, { useState } from 'react';
import { RotateCcw, GitBranch, Save, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { invoke } from '@tauri-apps/api/tauri';
import { toast } from '@/components/ui/use-toast';

interface RollbackStrategy {
  strategy_type: 'Git' | 'Checkpoint' | 'Hybrid';
  confidence: number;
  warnings: string[];
  recommendations: string[];
  estimated_changes: number;
  can_proceed: boolean;
}

interface RollbackButtonProps {
  messageIndex: number;
  sessionId: string;
  timestamp: string;
  hasCheckpoint: boolean;
  projectPath: string;
  onRollback: (result: any) => void;
  className?: string;
}

export const RollbackButton: React.FC<RollbackButtonProps> = ({
  messageIndex,
  sessionId,
  timestamp,
  hasCheckpoint,
  projectPath,
  onRollback,
  className
}) => {
  const [strategy, setStrategy] = useState<RollbackStrategy | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPerforming, setIsPerforming] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');

  const analyzeRollback = async () => {
    if (strategy) return; // Already analyzed
    
    setIsAnalyzing(true);
    try {
      const result = await invoke<RollbackStrategy>('analyze_rollback_strategy', {
        projectPath,
        sessionId,
        targetMessageIndex: messageIndex
      });
      setStrategy(result);
    } catch (error) {
      console.error('Failed to analyze rollback strategy:', error);
      toast({
        title: "Analysis Failed",
        description: "Could not analyze rollback options. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRollbackClick = (strategyType: string) => {
    setSelectedStrategy(strategyType);
    
    if (strategy?.warnings && strategy.warnings.length > 0) {
      setShowConfirmation(true);
    } else {
      performRollback(strategyType);
    }
  };

  const performRollback = async (strategyType: string, createBackup: boolean = true) => {
    setIsPerforming(true);
    try {
      // Create safety backup first
      if (createBackup) {
        toast({
          title: "Creating Backup",
          description: "Creating safety backup before rollback...",
        });
        
        await invoke('create_safety_backup', { projectPath });
      }

      // Perform the rollback
      const result = await invoke('perform_rollback', {
        projectPath,
        sessionId,
        targetMessageIndex: messageIndex,
        strategy: strategyType.toLowerCase(),
        createBackup
      });

      toast({
        title: "Rollback Successful",
        description: `Successfully rolled back to ${timestamp}`,
      });

      onRollback(result);
    } catch (error) {
      console.error('Rollback failed:', error);
      toast({
        title: "Rollback Failed",
        description: `Failed to rollback: ${error}`,
        variant: "destructive"
      });
    } finally {
      setIsPerforming(false);
      setShowConfirmation(false);
    }
  };

  const getStrategyColor = (strategyType: string) => {
    switch (strategyType) {
      case 'Git': return 'bg-green-100 text-green-800';
      case 'Checkpoint': return 'bg-blue-100 text-blue-800';
      case 'Hybrid': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStrategyIcon = (strategyType: string) => {
    switch (strategyType) {
      case 'Git': return <GitBranch className="h-4 w-4" />;
      case 'Checkpoint': return <Save className="h-4 w-4" />;
      case 'Hybrid': return <RotateCcw className="h-4 w-4" />;
      default: return <RotateCcw className="h-4 w-4" />;
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm"
            className={`opacity-0 group-hover:opacity-100 transition-opacity ${className}`}
            onClick={analyzeRollback}
            disabled={isAnalyzing || isPerforming}
          >
            {isAnalyzing || isPerforming ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Rollback to {new Date(timestamp).toLocaleString()}
          </DropdownMenuLabel>
          
          {strategy && (
            <div className="p-3 space-y-3">
              {/* Strategy Info */}
              <div className="flex items-center gap-2">
                <Badge className={getStrategyColor(strategy.strategy_type)}>
                  {getStrategyIcon(strategy.strategy_type)}
                  {strategy.strategy_type}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {Math.round(strategy.confidence * 100)}% confidence
                </span>
              </div>

              {/* Estimated Changes */}
              {strategy.estimated_changes > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span>{strategy.estimated_changes} files will be affected</span>
                </div>
              )}

              {/* Warnings */}
              {strategy.warnings.map((warning, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-yellow-600">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <span>{warning}</span>
                </div>
              ))}

              {/* Recommendations */}
              {strategy.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
          
          <DropdownMenuSeparator />
          
          {/* Rollback Options */}
          {strategy?.can_proceed && hasCheckpoint && (
            <DropdownMenuItem 
              onClick={() => handleRollbackClick('checkpoint')}
              disabled={isPerforming}
            >
              <Save className="mr-2 h-4 w-4" />
              Restore from Checkpoint
            </DropdownMenuItem>
          )}
          
          {strategy?.can_proceed && strategy.strategy_type === 'Git' && (
            <DropdownMenuItem 
              onClick={() => handleRollbackClick('git')}
              disabled={isPerforming}
            >
              <GitBranch className="mr-2 h-4 w-4" />
              Git Rollback
            </DropdownMenuItem>
          )}
          
          {strategy?.can_proceed && (
            <DropdownMenuItem 
              onClick={() => handleRollbackClick('hybrid')}
              disabled={isPerforming}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Smart Rollback
            </DropdownMenuItem>
          )}
          
          {!strategy?.can_proceed && strategy && (
            <div className="p-2 text-sm text-muted-foreground text-center">
              Rollback not available for this state
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Rollback
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to rollback to <strong>{timestamp}</strong>.</p>
              
              {strategy?.warnings && strategy.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="font-medium text-yellow-800 mb-2">Warnings:</p>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    {strategy.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                A safety backup will be created before proceeding. This action cannot be undone without the backup.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPerforming}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => performRollback(selectedStrategy)}
              disabled={isPerforming}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isPerforming ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Rolling back...
                </div>
              ) : (
                'Confirm Rollback'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};