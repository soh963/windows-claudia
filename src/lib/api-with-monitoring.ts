import { api } from './api';
import { createMonitoredApi } from './api-monitoring';
import { useMonitoringStore } from '@/stores/monitoringStore';
import type { Project, Session, ClaudeMdFile } from './api';

/**
 * Enhanced API with progress monitoring
 * Wraps existing API methods to add automatic progress tracking
 */
export const monitoredApi = {
  // Project operations
  listProjects: createMonitoredApi(
    api.listProjects,
    'api_call',
    () => 'List Projects',
    () => 'Fetching all projects from database'
  ),

  getProject: createMonitoredApi(
    api.getProject,
    'api_call',
    (projectId: string) => `Get Project: ${projectId}`,
    () => 'Fetching project details'
  ),

  createProject: createMonitoredApi(
    api.createProject,
    'api_call',
    (path: string) => 'Create Project',
    (path: string) => `Creating project at ${path}`
  ),

  updateProject: createMonitoredApi(
    api.updateProject,
    'api_call',
    (projectId: string) => `Update Project: ${projectId}`,
    () => 'Updating project metadata'
  ),

  // Session operations
  getProjectSessions: createMonitoredApi(
    api.getProjectSessions,
    'api_call',
    (projectId: string) => 'Get Sessions',
    (projectId: string) => `Fetching sessions for project ${projectId}`
  ),

  // File operations
  findClaudeMdFiles: createMonitoredApi(
    api.findClaudeMdFiles,
    'file_operation',
    (projectPath: string) => 'Find CLAUDE.md',
    (projectPath: string) => `Searching for CLAUDE.md files in ${projectPath}`
  ),

  readFile: createMonitoredApi(
    api.readFile,
    'file_operation',
    (path: string) => 'Read File',
    (path: string) => `Reading ${path}`
  ),

  writeFile: createMonitoredApi(
    api.writeFile,
    'file_operation',
    (path: string) => 'Write File',
    (path: string) => `Writing to ${path}`
  ),

  // Claude operations with custom tracking
  runClaudeCode: async (
    projectPath: string,
    prompt: string,
    model: string,
    onProgress?: (data: any) => void
  ) => {
    const { startOperation, updateOperation, completeOperation } = useMonitoringStore.getState();
    
    const operationId = startOperation({
      type: 'claude_request',
      name: 'Claude Code Session',
      description: `Running Claude with ${model}`,
      metadata: { projectPath, model, promptLength: prompt.length }
    });

    try {
      // Start with 10% progress
      updateOperation(operationId, { progress: 10 });
      
      const result = await api.runClaudeCode(
        projectPath,
        prompt,
        model,
        (data) => {
          // Update progress based on streaming data
          if (data.type === 'progress') {
            updateOperation(operationId, { progress: Math.min(90, data.progress || 50) });
          }
          
          // Call original progress handler
          onProgress?.(data);
        }
      );
      
      // Complete the operation
      completeOperation(operationId);
      return result;
    } catch (error) {
      completeOperation(operationId, {
        message: error instanceof Error ? error.message : 'Claude request failed',
        severity: 'high',
        details: error
      });
      throw error;
    }
  },

  // Batch operations with progress tracking
  batchOperation: async <T>(
    operations: Array<{ name: string; fn: () => Promise<T> }>,
    operationName: string = 'Batch Operation'
  ): Promise<T[]> => {
    const { startOperation, updateOperation, completeOperation } = useMonitoringStore.getState();
    
    const operationId = startOperation({
      type: 'api_call',
      name: operationName,
      description: `Processing ${operations.length} operations`,
    });

    try {
      const results: T[] = [];
      
      for (let i = 0; i < operations.length; i++) {
        const progress = ((i + 1) / operations.length) * 100;
        updateOperation(operationId, { 
          progress,
          description: `Processing: ${operations[i].name}`
        });
        
        results.push(await operations[i].fn());
      }
      
      completeOperation(operationId);
      return results;
    } catch (error) {
      completeOperation(operationId, {
        message: error instanceof Error ? error.message : 'Batch operation failed',
        severity: 'high',
        details: error
      });
      throw error;
    }
  }
};

// Hook for using monitored API in components
export function useMonitoredApi() {
  return monitoredApi;
}