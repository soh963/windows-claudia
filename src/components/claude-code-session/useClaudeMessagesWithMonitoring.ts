import { useCallback } from 'react';
import { useClaudeMessages } from './useClaudeMessages';
import { useAIRequestTracking } from '@/hooks/useMonitoringIntegration';
import { useMonitoringStore } from '@/stores/monitoringStore';

/**
 * Enhanced version of useClaudeMessages hook with monitoring integration
 */
export function useClaudeMessagesWithMonitoring() {
  const claudeMessages = useClaudeMessages();
  // TODO: Implement tracking when sendMessage and resumeStream are available
  // const { trackClaudeRequest } = useAIRequestTracking();
  // const { logError } = useMonitoringStore();

  // TODO: Implement sendMessage and resumeStream wrappers when these methods are added to useClaudeMessages
  // For now, we'll just return the base hook functionality

  // Return enhanced version with same interface
  return {
    ...claudeMessages,
  };
}

/**
 * Hook to track file operations in Claude Code Session
 */
export function useFileOperationTracking() {
  const { startOperation, updateOperation, completeOperation } = useMonitoringStore();

  const trackFileOperation = useCallback(
    async (
      operationType: 'read' | 'write' | 'edit',
      filePath: string,
      operation: () => Promise<any>
    ) => {
      const operationId = startOperation({
        type: 'file_operation',
        name: `File: ${operationType}`,
        description: filePath
      });

      try {
        updateOperation(operationId, { progress: 50 });
        const result = await operation();
        updateOperation(operationId, { progress: 100 });
        completeOperation(operationId);
        return result;
      } catch (error) {
        completeOperation(operationId, {
          message: `Failed to ${operationType} file: ${filePath}`,
          severity: 'medium'
        });
        throw error;
      }
    },
    [startOperation, updateOperation, completeOperation]
  );

  return { trackFileOperation };
}