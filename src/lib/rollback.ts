import { invoke } from '@tauri-apps/api/tauri';

export interface RollbackStrategy {
  strategy_type: 'Git' | 'Checkpoint' | 'Hybrid';
  confidence: number;
  warnings: string[];
  recommendations: string[];
  estimated_changes: number;
  can_proceed: boolean;
}

export interface SafetyReport {
  can_proceed: boolean;
  requires_confirmation: boolean;
  warnings: string[];
  errors: string[];
  estimated_changes: number;
  uncommitted_files: string[];
  locked_files: string[];
  backup_recommended: boolean;
}

export interface RollbackResult {
  success: boolean;
  strategy_used: 'Git' | 'Checkpoint' | 'Hybrid';
  files_restored: string[];
  backup_created?: string;
  commit_sha?: string;
  errors: string[];
  warnings: string[];
}

export interface GitStatus {
  is_repository: boolean;
  has_uncommitted: boolean;
  current_branch?: string;
  ahead_commits: number;
  behind_commits: number;
  modified_files: string[];
  untracked_files: string[];
}

export interface FileVersion {
  path: string;
  content_hash: string;
  commit_sha: string;
  timestamp: string;
  author: string;
  message: string;
}

export interface RollbackCheckpoint {
  id: string;
  session_id: string;
  message_index: number;
  timestamp: string;
  git_commit_sha?: string;
  stash_id?: string;
  affected_files: string[];
  operation_type: string;
  auto_created: boolean;
  description: string;
}

export class RollbackAPI {
  /**
   * Check if Git is available for the project
   */
  static async checkGitAvailable(projectPath: string): Promise<boolean> {
    try {
      return await invoke<boolean>('check_git_available', { projectPath });
    } catch (error) {
      console.error('Failed to check git availability:', error);
      return false;
    }
  }

  /**
   * Get Git status for the project
   */
  static async getGitStatus(projectPath: string): Promise<GitStatus> {
    return await invoke<GitStatus>('get_git_status', { projectPath });
  }

  /**
   * Analyze rollback strategy for a specific message
   */
  static async analyzeRollbackStrategy(
    projectPath: string,
    sessionId: string,
    targetMessageIndex: number
  ): Promise<RollbackStrategy> {
    return await invoke<RollbackStrategy>('analyze_rollback_strategy', {
      projectPath,
      sessionId,
      targetMessageIndex
    });
  }

  /**
   * Validate rollback safety
   */
  static async validateRollbackSafety(
    projectPath: string,
    targetState: string
  ): Promise<SafetyReport> {
    return await invoke<SafetyReport>('validate_rollback_safety', {
      projectPath,
      targetState
    });
  }

  /**
   * Create a safety backup before rollback
   */
  static async createSafetyBackup(projectPath: string): Promise<string> {
    return await invoke<string>('create_safety_backup', { projectPath });
  }

  /**
   * Create a rollback checkpoint
   */
  static async createRollbackCheckpoint(
    projectPath: string,
    sessionId: string,
    messageIndex: number,
    operationType: string,
    affectedFiles: string[]
  ): Promise<RollbackCheckpoint> {
    return await invoke<RollbackCheckpoint>('create_rollback_checkpoint', {
      projectPath,
      sessionId,
      messageIndex,
      operationType,
      affectedFiles
    });
  }

  /**
   * Perform rollback operation
   */
  static async performRollback(
    projectPath: string,
    sessionId: string,
    targetMessageIndex: number,
    strategy: string,
    createBackup: boolean = true
  ): Promise<RollbackResult> {
    return await invoke<RollbackResult>('perform_rollback', {
      projectPath,
      sessionId,
      targetMessageIndex,
      strategy,
      createBackup
    });
  }

  /**
   * Get file history from Git
   */
  static async getFileHistory(
    projectPath: string,
    filePath: string,
    limit?: number
  ): Promise<FileVersion[]> {
    return await invoke<FileVersion[]>('get_file_history', {
      projectPath,
      filePath,
      limit
    });
  }

  /**
   * Auto-create checkpoint before file modifications
   */
  static async autoCreateCheckpoint(
    projectPath: string,
    sessionId: string,
    messageIndex: number,
    operationType: string,
    affectedFiles: string[]
  ): Promise<RollbackCheckpoint | null> {
    try {
      return await this.createRollbackCheckpoint(
        projectPath,
        sessionId,
        messageIndex,
        operationType,
        affectedFiles
      );
    } catch (error) {
      console.warn('Failed to auto-create checkpoint:', error);
      return null;
    }
  }
}

/**
 * Hook for using rollback functionality
 */
export const useRollback = (projectPath: string, sessionId: string) => {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isPerforming, setIsPerforming] = React.useState(false);

  const analyzeRollback = React.useCallback(async (messageIndex: number) => {
    setIsAnalyzing(true);
    try {
      const [strategy, gitStatus] = await Promise.all([
        RollbackAPI.analyzeRollbackStrategy(projectPath, sessionId, messageIndex),
        RollbackAPI.getGitStatus(projectPath)
      ]);
      return { strategy, gitStatus };
    } catch (error) {
      console.error('Failed to analyze rollback:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectPath, sessionId]);

  const performRollback = React.useCallback(async (
    messageIndex: number,
    strategy: string,
    createBackup: boolean = true
  ) => {
    setIsPerforming(true);
    try {
      return await RollbackAPI.performRollback(
        projectPath,
        sessionId,
        messageIndex,
        strategy,
        createBackup
      );
    } catch (error) {
      console.error('Failed to perform rollback:', error);
      throw error;
    } finally {
      setIsPerforming(false);
    }
  }, [projectPath, sessionId]);

  return {
    analyzeRollback,
    performRollback,
    isAnalyzing,
    isPerforming
  };
};

// React import for useRollback hook
import React from 'react';