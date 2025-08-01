import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Cloud } from 'lucide-react';
import { format } from 'date-fns';
import { api, type ClaudeSyncState, type ClaudeSyncResult } from '@/lib/api';

export default function ClaudeSyncStatus() {
  const [syncState, setSyncState] = useState<ClaudeSyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [nextSyncTime, setNextSyncTime] = useState<number | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<ClaudeSyncResult | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);

  // Load initial state
  useEffect(() => {
    loadSyncState();
    checkClaudeAvailability();
    
    // Set up event listener for sync updates
    const unlisten = listen('claude-commands-synced', () => {
      loadSyncState();
    });

    // Refresh state every minute
    const interval = setInterval(() => {
      loadSyncState();
      updateNextSyncTime();
    }, 60000);

    return () => {
      unlisten.then(fn => fn());
      clearInterval(interval);
    };
  }, []);

  const loadSyncState = async () => {
    try {
      const state = await api.getClaudeSyncState();
      setSyncState(state);
      updateNextSyncTime();
    } catch (error) {
      console.error('Failed to load sync state:', error);
    }
  };

  const checkClaudeAvailability = async () => {
    try {
      const available = await api.checkClaudeAvailability();
      setClaudeAvailable(available);
    } catch (error) {
      console.error('Failed to check Claude availability:', error);
      setClaudeAvailable(false);
    }
  };

  const updateNextSyncTime = async () => {
    try {
      const next = await api.getNextSyncTime();
      setNextSyncTime(next);
    } catch (error) {
      console.error('Failed to get next sync time:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await api.syncClaudeCommands();
      setLastSyncResult(result);
      await loadSyncState();
    } catch (error) {
      console.error('Failed to sync:', error);
      setLastSyncResult({
        success: false,
        commands_found: 0,
        new_commands: 0,
        updated_commands: 0,
        sync_time: Date.now() / 1000,
        error: error instanceof Error ? error.message : String(error),
        claude_version: null,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleForceRefresh = async () => {
    setSyncing(true);
    try {
      const result = await api.forceRefreshClaudeCommands();
      setLastSyncResult(result);
      await loadSyncState();
    } catch (error) {
      console.error('Failed to force refresh:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleSync = async (enabled: boolean) => {
    try {
      await api.setClaudeSyncEnabled(enabled);
      await loadSyncState();
    } catch (error) {
      console.error('Failed to toggle sync:', error);
    }
  };

  const handleIntervalChange = async (hours: string) => {
    try {
      await api.setClaudeSyncInterval(parseInt(hours));
      await loadSyncState();
    } catch (error) {
      console.error('Failed to set sync interval:', error);
    }
  };

  if (!syncState) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const commandCount = Object.keys(syncState.commands_cache).length;
  const timeUntilNextSync = nextSyncTime ? nextSyncTime * 1000 - Date.now() : null;
  const nextSyncFormatted = timeUntilNextSync && timeUntilNextSync > 0
    ? `in ${Math.floor(timeUntilNextSync / 1000 / 60)} minutes`
    : 'Soon';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Claude Command Sync
            </CardTitle>
            <CardDescription>
              Automatically sync slash commands from Claude Code CLI
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {claudeAvailable === true && (
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Claude Available
              </Badge>
            )}
            {claudeAvailable === false && (
              <Badge variant="outline" className="text-red-600">
                <XCircle className="h-3 w-3 mr-1" />
                Claude Not Found
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sync Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Auto Sync</Label>
            <Switch
              checked={syncState.sync_enabled}
              onCheckedChange={handleToggleSync}
              disabled={!claudeAvailable}
            />
          </div>
          
          {syncState.sync_enabled && (
            <div className="flex items-center justify-between">
              <Label>Sync Interval</Label>
              <Select 
                value={syncState.auto_sync_interval_hours.toString()}
                onValueChange={handleIntervalChange}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Sync Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Commands Cached:</span>
            <span className="font-medium">{commandCount}</span>
          </div>
          
          {syncState.claude_version && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Claude Version:</span>
              <span className="font-medium">{syncState.claude_version}</span>
            </div>
          )}
          
          {syncState.last_sync && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last Sync:</span>
                <span className="font-medium">
                  {format(new Date(syncState.last_sync * 1000), 'MMM d, h:mm a')}
                </span>
              </div>
              
              {syncState.sync_enabled && nextSyncTime && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Next Sync:</span>
                  <span className="font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {nextSyncFormatted}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            {lastSyncResult.success ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Sync Successful</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Found {lastSyncResult.commands_found} commands
                  {lastSyncResult.new_commands > 0 && ` (${lastSyncResult.new_commands} new)`}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Sync Failed</span>
                </div>
                {lastSyncResult.error && (
                  <div className="text-xs text-muted-foreground">{lastSyncResult.error}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSync}
            disabled={syncing || !claudeAvailable}
            size="sm"
            className="flex-1"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
          
          <Button
            onClick={handleForceRefresh}
            disabled={syncing || !claudeAvailable}
            size="sm"
            variant="outline"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Force Refresh
          </Button>
        </div>

        {!claudeAvailable && (
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Claude Code CLI not found
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                Install Claude Code CLI to enable command synchronization.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}