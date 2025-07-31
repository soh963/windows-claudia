import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { RefreshCw, Check, AlertCircle, Zap, Clock } from 'lucide-react';
// import { Toast } from './ui/toast'; // unused for now

interface ClaudeSyncResult {
  success: boolean;
  commands_found: number;
  new_commands: number;
  updated_commands: number;
  sync_time: number;
  error?: string;
  claude_version?: string;
}

interface ClaudeSyncState {
  last_sync?: number;
  claude_version?: string;
  commands_cache: Record<string, any>;
  sync_enabled: boolean;
}

interface SlashCommand {
  id: string;
  name: string;
  full_command: string;
  scope: string;
  namespace?: string;
  content: string;
  description?: string;
  allowed_tools: string[];
  has_bash_commands: boolean;
  has_file_references: boolean;
  accepts_arguments: boolean;
}

interface ClaudeCommandSyncProps {
  setToast?: (toast: { message: string; type: 'success' | 'error' }) => void;
}

export const ClaudeCommandSync: React.FC<ClaudeCommandSyncProps> = ({ setToast }) => {
  const [syncState, setSyncState] = useState<ClaudeSyncState | null>(null);
  const [syncResult, setSyncResult] = useState<ClaudeSyncResult | null>(null);
  const [syncedCommands, setSyncedCommands] = useState<SlashCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);

  // Load initial state
  useEffect(() => {
    loadSyncState();
    checkClaudeAvailability();
  }, []);

  const loadSyncState = async () => {
    try {
      const state = await invoke<ClaudeSyncState>('get_claude_sync_state');
      setSyncState(state);
    } catch (error) {
      console.error('Failed to load sync state:', error);
    }
  };

  const checkClaudeAvailability = async () => {
    try {
      const available = await invoke<boolean>('check_claude_availability');
      setClaudeAvailable(available);
    } catch (error) {
      console.error('Failed to check Claude availability:', error);
      setClaudeAvailable(false);
    }
  };

  const syncCommands = async () => {
    if (!claudeAvailable) {
      setToast?.({
        message: "Claude Code CLI is not installed or accessible. Please install Claude Code first.",
        type: "error"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await invoke<ClaudeSyncResult>('sync_claude_commands');
      setSyncResult(result);
      
      if (result.success) {
        setToast?.({
          message: `Found ${result.commands_found} commands, added ${result.new_commands} new commands`,
          type: "success"
        });
        
        // Load synced commands
        const commands = await invoke<SlashCommand[]>('get_synced_claude_commands');
        setSyncedCommands(commands);
        
        // Refresh sync state
        await loadSyncState();
      } else {
        setToast?.({
          message: result.error || "Unknown error occurred",
          type: "error"
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setToast?.({
        message: "Failed to sync Claude commands. Check console for details.",
        type: "error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSyncEnabled = async () => {
    if (!syncState) return;
    
    try {
      const newEnabled = !syncState.sync_enabled;
      await invoke<boolean>('set_claude_sync_enabled', { enabled: newEnabled });
      setSyncState({ ...syncState, sync_enabled: newEnabled });
      
      setToast?.({
        message: newEnabled 
          ? "Claude command sync is now enabled"
          : "Claude command sync is now disabled",
        type: "success"
      });
    } catch (error) {
      console.error('Failed to toggle sync:', error);
      setToast?.({
        message: "Failed to update sync settings",
        type: "error"
      });
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  };

  // const getStatusColor = () => {
  //   if (claudeAvailable === null) return 'gray';
  //   if (!claudeAvailable) return 'red';
  //   if (syncResult?.success) return 'green';
  //   if (syncResult?.error) return 'red';
  //   return 'blue';
  // };

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (claudeAvailable === false) return <AlertCircle className="w-4 h-4" />;
    if (syncResult?.success) return <Check className="w-4 h-4" />;
    return <Zap className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Claude Code CLI Integration
          </CardTitle>
          <CardDescription>
            Automatically sync slash commands from Claude Code CLI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={claudeAvailable ? "default" : "destructive"}>
                {claudeAvailable === null ? 'Checking...' :
                 claudeAvailable ? 'Claude Available' : 'Claude Not Found'}
              </Badge>
              {syncState?.claude_version && (
                <Badge variant="outline">
                  v{syncState.claude_version}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSyncEnabled}
                disabled={!claudeAvailable}
              >
                {syncState?.sync_enabled ? 'Disable Sync' : 'Enable Sync'}
              </Button>
              <Button 
                onClick={syncCommands}
                disabled={isLoading || !claudeAvailable || !syncState?.sync_enabled}
                size="sm"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>
          </div>

          {/* Last Sync Info */}
          {syncState?.last_sync && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Last sync: {formatTime(syncState.last_sync)}
            </div>
          )}

          {/* Sync Results */}
          {syncResult && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {syncResult.commands_found}
                </div>
                <div className="text-sm text-muted-foreground">Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {syncResult.new_commands}
                </div>
                <div className="text-sm text-muted-foreground">New</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {syncResult.updated_commands}
                </div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {syncResult?.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-sm text-red-800">
                <strong>Error:</strong> {syncResult.error}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Synced Commands Preview */}
      {syncedCommands.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Synced Commands ({syncedCommands.length})</CardTitle>
            <CardDescription>
              Commands automatically discovered from Claude Code CLI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {syncedCommands.map((command) => (
                <div 
                  key={command.id} 
                  className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {command.full_command}
                    </code>
                    <Badge variant="outline" className="text-xs">
                      {command.scope}
                    </Badge>
                  </div>
                  
                  {command.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {command.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-1">
                    {command.accepts_arguments && (
                      <Badge variant="secondary" className="text-xs">Args</Badge>
                    )}
                    {command.has_bash_commands && (
                      <Badge variant="secondary" className="text-xs">Bash</Badge>
                    )}
                    {command.has_file_references && (
                      <Badge variant="secondary" className="text-xs">Files</Badge>
                    )}
                    {command.allowed_tools.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {command.allowed_tools.length} tools
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Auto-sync:</strong> This feature automatically discovers slash commands 
              from your installed Claude Code CLI and makes them available in Claudia.
            </p>
            <p>
              <strong>Requirements:</strong> Claude Code CLI must be installed and accessible 
              in your system PATH.
            </p>
            <p>
              <strong>How it works:</strong> The sync process analyzes Claude's configuration 
              and help output to discover available commands and their metadata.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};