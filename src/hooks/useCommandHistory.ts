import { useState, useEffect, useCallback } from 'react';

interface UseCommandHistoryProps {
  maxHistory?: number;
  sessionKey?: string;
  persistHistory?: boolean;
}

interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: Date;
  model?: string;
  success?: boolean;
}

export const useCommandHistory = ({
  maxHistory = 100,
  sessionKey = 'default',
  persistHistory = true
}: UseCommandHistoryProps = {}) => {
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentInput, setCurrentInput] = useState('');
  const [tempInput, setTempInput] = useState('');

  const storageKey = `claudia-command-history-${sessionKey}`;

  // Load history from localStorage on mount
  useEffect(() => {
    if (!persistHistory) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const entries = parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }));
        setHistory(entries);
      }
    } catch (error) {
      console.warn('Failed to load command history:', error);
    }
  }, [storageKey, persistHistory]);

  // Save history to localStorage when it changes
  useEffect(() => {
    if (!persistHistory || history.length === 0) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save command history:', error);
    }
  }, [history, storageKey, persistHistory]);

  // Add a command to history
  const addCommand = useCallback((command: string, metadata?: { model?: string; success?: boolean }) => {
    if (!command.trim()) return;

    const entry: CommandHistoryEntry = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      command: command.trim(),
      timestamp: new Date(),
      ...metadata
    };

    setHistory(prev => {
      // Remove duplicates - if the same command exists, remove it
      const filtered = prev.filter(h => h.command !== command.trim());
      
      // Add new command at the beginning
      const newHistory = [entry, ...filtered];
      
      // Limit history size
      return newHistory.slice(0, maxHistory);
    });

    // Reset navigation index
    setCurrentIndex(-1);
    setCurrentInput('');
    setTempInput('');
  }, [maxHistory]);

  // Navigate through history
  const navigateHistory = useCallback((direction: 'up' | 'down', currentValue?: string) => {
    if (history.length === 0) return null;

    // Store current input when starting to navigate
    if (currentIndex === -1 && direction === 'up' && currentValue !== undefined) {
      setTempInput(currentValue);
    }

    let newIndex: number;
    
    if (direction === 'up') {
      newIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, history.length - 1);
    } else {
      newIndex = Math.max(currentIndex - 1, -1);
    }

    setCurrentIndex(newIndex);

    if (newIndex === -1) {
      // Return to original input
      const original = tempInput;
      setCurrentInput('');
      setTempInput('');
      return original;
    } else {
      const command = history[newIndex].command;
      setCurrentInput(command);
      return command;
    }
  }, [history, currentIndex, tempInput]);

  // Navigate to previous command (up arrow)
  const navigateUp = useCallback((currentValue?: string) => {
    return navigateHistory('up', currentValue);
  }, [navigateHistory]);

  // Navigate to next command (down arrow)
  const navigateDown = useCallback(() => {
    return navigateHistory('down');
  }, [navigateHistory]);

  // Search through history
  const searchHistory = useCallback((query: string, limit?: number) => {
    if (!query.trim()) return [];

    const filtered = history.filter(entry =>
      entry.command.toLowerCase().includes(query.toLowerCase())
    );

    return limit ? filtered.slice(0, limit) : filtered;
  }, [history]);

  // Get recent commands
  const getRecentCommands = useCallback((limit: number = 10) => {
    return history.slice(0, limit);
  }, [history]);

  // Get commands by model
  const getCommandsByModel = useCallback((model: string) => {
    return history.filter(entry => entry.model === model);
  }, [history]);

  // Get successful commands only
  const getSuccessfulCommands = useCallback(() => {
    return history.filter(entry => entry.success !== false);
  }, [history]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    setCurrentInput('');
    setTempInput('');
    
    if (persistHistory) {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('Failed to clear command history:', error);
      }
    }
  }, [storageKey, persistHistory]);

  // Get history statistics
  const getHistoryStats = useCallback(() => {
    const totalCommands = history.length;
    const successfulCommands = history.filter(h => h.success === true).length;
    const failedCommands = history.filter(h => h.success === false).length;
    const unknownCommands = totalCommands - successfulCommands - failedCommands;

    const modelUsage: Record<string, number> = {};
    history.forEach(h => {
      if (h.model) {
        modelUsage[h.model] = (modelUsage[h.model] || 0) + 1;
      }
    });

    const mostUsedModel = Object.entries(modelUsage).reduce((max, [model, count]) => 
      count > max.count ? { model, count } : max, 
      { model: '', count: 0 }
    );

    return {
      totalCommands,
      successfulCommands,
      failedCommands,
      unknownCommands,
      successRate: totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0,
      modelUsage,
      mostUsedModel: mostUsedModel.model || 'none',
      averageCommandLength: totalCommands > 0 ? history.reduce((sum, h) => sum + h.command.length, 0) / totalCommands : 0,
      oldestCommand: history[history.length - 1]?.timestamp || null,
      newestCommand: history[0]?.timestamp || null,
    };
  }, [history]);

  // Export history
  const exportHistory = useCallback((format: 'json' | 'csv' | 'txt' = 'json') => {
    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    }
    
    if (format === 'csv') {
      const headers = 'timestamp,command,model,success\n';
      const rows = history.map(h => 
        `"${h.timestamp.toISOString()}","${h.command.replace(/"/g, '""')}","${h.model || ''}","${h.success || ''}"`
      ).join('\n');
      return headers + rows;
    }
    
    if (format === 'txt') {
      return history.map(h => 
        `[${h.timestamp.toLocaleString()}] ${h.model ? `(${h.model}) ` : ''}${h.command}`
      ).join('\n');
    }

    return '';
  }, [history]);

  // Import history
  const importHistory = useCallback((data: string, format: 'json' = 'json') => {
    try {
      if (format === 'json') {
        const parsed = JSON.parse(data);
        const entries = parsed.map((entry: any) => ({
          id: entry.id || `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          command: entry.command,
          timestamp: new Date(entry.timestamp),
          model: entry.model,
          success: entry.success
        }));
        
        setHistory(prev => {
          const combined = [...entries, ...prev];
          // Remove duplicates based on command and timestamp
          const unique = combined.filter((entry, index, arr) => 
            arr.findIndex(e => e.command === entry.command && 
              Math.abs(e.timestamp.getTime() - entry.timestamp.getTime()) < 1000) === index
          );
          
          return unique.slice(0, maxHistory);
        });
        
        return true;
      }
    } catch (error) {
      console.error('Failed to import command history:', error);
      return false;
    }
    
    return false;
  }, [maxHistory]);

  return {
    // State
    history,
    currentIndex,
    currentInput,
    
    // Navigation
    navigateUp,
    navigateDown,
    
    // Management
    addCommand,
    clearHistory,
    
    // Search & Filter
    searchHistory,
    getRecentCommands,
    getCommandsByModel,
    getSuccessfulCommands,
    
    // Analytics
    getHistoryStats,
    
    // Import/Export
    exportHistory,
    importHistory,
    
    // Utilities
    isNavigating: currentIndex !== -1,
    hasHistory: history.length > 0,
    canNavigateUp: currentIndex < history.length - 1,
    canNavigateDown: currentIndex > -1,
  };
};

export default useCommandHistory;