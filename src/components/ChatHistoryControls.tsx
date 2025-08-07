/**
 * Chat History Controls - Undo/Redo functionality for chat
 */

import React, { useEffect } from 'react';
import { Button } from './ui/button';
import { Tooltip } from './ui/tooltip';
import { Undo2, Redo2, History, Trash2 } from 'lucide-react';
import { useChatUndo, useChatHistoryStore, setupUndoKeyboardShortcuts } from '@/lib/stores/chatHistoryStore';
import { cn } from '@/lib/utils';

interface ChatHistoryControlsProps {
  sessionId: string;
  className?: string;
  showClear?: boolean;
}

export const ChatHistoryControls: React.FC<ChatHistoryControlsProps> = ({
  sessionId,
  className,
  showClear = false,
}) => {
  const { undo, redo, canUndo, canRedo } = useChatUndo(sessionId);
  const clearSession = useChatHistoryStore((state) => state.clearSession);
  
  // Setup keyboard shortcuts
  useEffect(() => {
    const cleanup = setupUndoKeyboardShortcuts(sessionId);
    return cleanup;
  }, [sessionId]);
  
  const handleUndo = () => {
    const success = undo();
    if (success) {
      console.log('Undo successful');
    }
  };
  
  const handleRedo = () => {
    const success = redo();
    if (success) {
      console.log('Redo successful');
    }
  };
  
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the chat history? This action can be undone.')) {
      clearSession(sessionId);
    }
  };
  
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Tooltip content="Undo (Ctrl+Z)">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          disabled={!canUndo}
          className="p-1.5"
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      </Tooltip>
      
      <Tooltip content="Redo (Ctrl+Shift+Z)">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRedo}
          disabled={!canRedo}
          className="p-1.5"
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </Tooltip>
      
      <div className="w-px h-4 bg-border mx-1" />
      
      <Tooltip content="Chat History">
        <Button
          variant="ghost"
          size="sm"
          className="p-1.5"
          aria-label="History"
        >
          <History className="h-4 w-4" />
        </Button>
      </Tooltip>
      
      {showClear && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          <Tooltip content="Clear Chat">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="p-1.5 hover:text-destructive"
              aria-label="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </>
      )}
    </div>
  );
};

/**
 * Floating chat history controls for use in chat interface
 */
export const FloatingChatHistoryControls: React.FC<ChatHistoryControlsProps> = (props) => {
  return (
    <div className="fixed bottom-20 right-4 z-50 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-2">
      <ChatHistoryControls {...props} />
    </div>
  );
};

/**
 * Chat history indicator showing undo/redo status
 */
interface ChatHistoryIndicatorProps {
  sessionId: string;
  className?: string;
}

export const ChatHistoryIndicator: React.FC<ChatHistoryIndicatorProps> = ({
  sessionId,
  className,
}) => {
  const { canUndo, canRedo } = useChatUndo(sessionId);
  const historyIndex = useChatHistoryStore((state) => 
    state.historyIndex.get(sessionId) ?? -1
  );
  const historyLength = useChatHistoryStore((state) => 
    state.historyStack.get(sessionId)?.length ?? 0
  );
  
  if (historyLength === 0) return null;
  
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <History className="h-3 w-3" />
      <span>
        History: {historyIndex + 1}/{historyLength}
      </span>
      {canUndo && <span className="text-primary">(Can undo)</span>}
      {canRedo && <span className="text-primary">(Can redo)</span>}
    </div>
  );
};