import { useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface MessageDeduplicationOptions {
  sessionId: string;
  enableDeduplication?: boolean;
}

interface DedupResult {
  isDuplicate: boolean;
  shouldProcess: boolean;
}

/**
 * Hook for message deduplication to prevent duplicate responses
 */
export function useMessageDeduplication(options: MessageDeduplicationOptions) {
  const { sessionId, enableDeduplication = true } = options;
  
  // Local cache for quick checks
  const messageCache = useRef<Set<string>>(new Set());
  const lastMessageTime = useRef<number>(0);
  const lastMessageContent = useRef<string>('');
  
  /**
   * Check if a message is a duplicate
   */
  const checkDuplicate = useCallback(async (
    messageId: string,
    content: string
  ): Promise<DedupResult> => {
    if (!enableDeduplication) {
      return { isDuplicate: false, shouldProcess: true };
    }
    
    // Quick local check first
    const currentTime = Date.now();
    
    // Check if we've seen this exact message ID locally
    if (messageCache.current.has(messageId)) {
      console.warn(`[Dedup] Duplicate message ID detected locally: ${messageId}`);
      return { isDuplicate: true, shouldProcess: false };
    }
    
    // Check if same content within 100ms (likely duplicate)
    if (
      content === lastMessageContent.current &&
      currentTime - lastMessageTime.current < 100
    ) {
      console.warn(`[Dedup] Duplicate content detected within 100ms`);
      return { isDuplicate: true, shouldProcess: false };
    }
    
    try {
      // Check with backend deduplication service
      const shouldProcess = await invoke<boolean>('check_message_duplicate', {
        sessionId,
        messageId,
        content
      });
      
      if (shouldProcess) {
        // Not a duplicate, add to local cache
        messageCache.current.add(messageId);
        lastMessageTime.current = currentTime;
        lastMessageContent.current = content;
        
        // Limit cache size to prevent memory issues
        if (messageCache.current.size > 1000) {
          const entries = Array.from(messageCache.current);
          messageCache.current = new Set(entries.slice(-500));
        }
      }
      
      return { 
        isDuplicate: !shouldProcess, 
        shouldProcess 
      };
    } catch (error) {
      console.error('[Dedup] Failed to check duplicate with backend:', error);
      // On error, do local check only
      const isDuplicate = messageCache.current.has(messageId);
      if (!isDuplicate) {
        messageCache.current.add(messageId);
        lastMessageTime.current = currentTime;
        lastMessageContent.current = content;
      }
      return { isDuplicate, shouldProcess: !isDuplicate };
    }
  }, [sessionId, enableDeduplication]);
  
  /**
   * Clear deduplication cache for the session
   */
  const clearCache = useCallback(async () => {
    messageCache.current.clear();
    lastMessageTime.current = 0;
    lastMessageContent.current = '';
    
    try {
      await invoke('clear_session_deduplication', { sessionId });
    } catch (error) {
      console.error('[Dedup] Failed to clear backend deduplication:', error);
    }
  }, [sessionId]);
  
  /**
   * Generate a unique message ID
   */
  const generateMessageId = useCallback((prefix: string = 'msg'): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}-${timestamp}-${random}`;
  }, []);
  
  return {
    checkDuplicate,
    clearCache,
    generateMessageId,
    cacheSize: messageCache.current.size
  };
}

/**
 * Hook for session isolation to prevent cross-session contamination
 */
export function useSessionIsolation(sessionId: string, projectId: string, model: string) {
  const isolationState = useRef<any>(null);
  
  /**
   * Create an isolated session
   */
  const createIsolatedSession = useCallback(async () => {
    try {
      const state = await invoke('create_isolated_session', {
        sessionId,
        projectId,
        model
      });
      isolationState.current = state;
      console.log('[Isolation] Created isolated session:', state);
      return state;
    } catch (error) {
      console.error('[Isolation] Failed to create isolated session:', error);
      throw error;
    }
  }, [sessionId, projectId, model]);
  
  /**
   * Validate that an operation doesn't cross session boundaries
   */
  const validateBoundary = useCallback(async (operationSessionId: string): Promise<boolean> => {
    try {
      await invoke('validate_session_boundary', {
        sessionId,
        operationSessionId
      });
      return true;
    } catch (error) {
      console.error('[Isolation] Session boundary violation:', error);
      return false;
    }
  }, [sessionId]);
  
  /**
   * Get current isolation state
   */
  const getIsolationState = useCallback(async () => {
    try {
      const state = await invoke('get_session_isolation_state', { sessionId });
      isolationState.current = state;
      return state;
    } catch (error) {
      console.error('[Isolation] Failed to get isolation state:', error);
      return null;
    }
  }, [sessionId]);
  
  return {
    createIsolatedSession,
    validateBoundary,
    getIsolationState,
    isolationState: isolationState.current
  };
}