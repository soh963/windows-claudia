/**
 * Universal AI Integration Module
 * 
 * This module provides a unified interface for all AI models (Claude, Gemini, Ollama)
 * with shared sessions, tools, agents, and MCP integration
 */

import { invoke } from '@tauri-apps/api/core';
import { sessionStore } from './stores/sessionStore';
import { monitoringStore } from './stores/monitoringStore';

export interface UniversalAIRequest {
  prompt: string;
  model_id: string;
  project_path: string;
  context?: string;
  system_instruction?: string;
  options?: Record<string, any>;
  use_auto_selection?: boolean;
  enable_mcp?: boolean;
  enable_agents?: boolean;
  enable_tools?: boolean;
  session_id?: string;
}

export interface UniversalAIResponse {
  success: boolean;
  model_used: string;
  session_id: string;
  response: any;
  reasoning?: string;
  error?: string;
  auto_selected?: boolean;
  tools_used?: string[];
  mcp_servers_used?: string[];
  agent_used?: string;
  execution_time_ms?: number;
}

export interface SharedSession {
  id: string;
  project_id: string;
  model_provider: 'claude' | 'gemini' | 'ollama';
  model_id: string;
  messages: any[];
  context: Record<string, any>;
  tools_enabled: boolean;
  mcp_enabled: boolean;
  agents_enabled: boolean;
  created_at: number;
  updated_at: number;
  memory_state?: any;
}

export interface UniversalToolCapability {
  model_id: string;
  provider: string;
  supports_mcp: boolean;
  supports_agents: boolean;
  supports_slash_commands: boolean;
  supports_vision: boolean;
  supports_audio: boolean;
  supports_tools: boolean;
  supports_memory_sharing: boolean;
  supports_session_sharing: boolean;
}

/**
 * Universal AI execution with full feature support
 */
export async function executeUniversalAI(request: UniversalAIRequest): Promise<UniversalAIResponse> {
  try {
    // Update monitoring store with execution start
    monitoringStore.trackExecution({
      model: request.model_id,
      type: 'universal',
      status: 'started'
    });

    // Get or create session
    const sessionId = request.session_id || await createUniversalSession(
      request.model_id,
      request.project_path
    );

    // Execute with universal tools
    const response = await invoke<UniversalAIResponse>('execute_with_universal_tools', {
      request: {
        ...request,
        session_id: sessionId
      }
    });

    // Store in session
    if (response.success) {
      await storeUniversalMessage(sessionId, {
        type: 'assistant',
        content: response.response,
        model: response.model_used,
        tools_used: response.tools_used,
        mcp_servers_used: response.mcp_servers_used,
        agent_used: response.agent_used
      });
    }

    // Update monitoring store with execution complete
    monitoringStore.trackExecution({
      model: response.model_used,
      type: 'universal',
      status: 'completed',
      execution_time: response.execution_time_ms
    });

    return response;
  } catch (error) {
    console.error('Universal AI execution failed:', error);
    
    // Update monitoring store with error
    monitoringStore.trackExecution({
      model: request.model_id,
      type: 'universal',
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Create a universal session that works with all models
 */
export async function createUniversalSession(
  modelId: string,
  projectPath: string
): Promise<string> {
  try {
    const sessionId = await invoke<string>('create_universal_session', {
      model_id: modelId,
      project_path: projectPath
    });

    // Initialize session in store
    sessionStore.createSession({
      id: sessionId,
      projectId: projectPath,
      modelId: modelId,
      messages: [],
      createdAt: Date.now()
    });

    return sessionId;
  } catch (error) {
    console.error('Failed to create universal session:', error);
    throw error;
  }
}

/**
 * Store a message in the universal session
 */
export async function storeUniversalMessage(
  sessionId: string,
  message: any
): Promise<void> {
  try {
    await invoke('store_universal_message', {
      session_id: sessionId,
      message: message
    });

    // Update session store
    sessionStore.addMessage(sessionId, message);
  } catch (error) {
    console.error('Failed to store universal message:', error);
    throw error;
  }
}

/**
 * Get tool capabilities for a specific model
 */
export async function getModelCapabilities(modelId: string): Promise<UniversalToolCapability> {
  try {
    const capabilities = await invoke<UniversalToolCapability>('get_model_tool_capabilities', {
      model_id: modelId
    });
    return capabilities;
  } catch (error) {
    console.error('Failed to get model capabilities:', error);
    // Return default capabilities
    return {
      model_id: modelId,
      provider: determineProvider(modelId),
      supports_mcp: modelId.includes('claude'),
      supports_agents: modelId.includes('claude'),
      supports_slash_commands: modelId.includes('claude'),
      supports_vision: modelId.includes('gemini') || modelId.includes('claude'),
      supports_audio: modelId.includes('gemini'),
      supports_tools: true,
      supports_memory_sharing: true,
      supports_session_sharing: true
    };
  }
}

/**
 * Execute with MCP support across all models
 */
export async function executeWithUniversalMCP(
  modelId: string,
  prompt: string,
  mcpServers: string[],
  sessionId?: string
): Promise<UniversalAIResponse> {
  try {
    const response = await invoke<UniversalAIResponse>('execute_with_universal_mcp', {
      model_id: modelId,
      prompt: prompt,
      mcp_servers: mcpServers,
      session_id: sessionId
    });

    return response;
  } catch (error) {
    console.error('Universal MCP execution failed:', error);
    throw error;
  }
}

/**
 * Execute with agents across all models
 */
export async function executeWithUniversalAgent(
  modelId: string,
  agentId: string,
  prompt: string,
  sessionId?: string
): Promise<UniversalAIResponse> {
  try {
    const response = await invoke<UniversalAIResponse>('execute_with_universal_agent', {
      model_id: modelId,
      agent_id: agentId,
      prompt: prompt,
      session_id: sessionId
    });

    return response;
  } catch (error) {
    console.error('Universal agent execution failed:', error);
    throw error;
  }
}

/**
 * Share memory between sessions
 */
export async function shareSessionMemory(
  sourceSessionId: string,
  targetSessionId: string,
  memoryType: 'full' | 'context' | 'tools' | 'custom',
  customMemory?: any
): Promise<boolean> {
  try {
    const result = await invoke<boolean>('share_session_memory', {
      source_session_id: sourceSessionId,
      target_session_id: targetSessionId,
      memory_type: memoryType,
      custom_memory: customMemory
    });

    return result;
  } catch (error) {
    console.error('Failed to share session memory:', error);
    return false;
  }
}

/**
 * Get shared sessions for a project
 */
export async function getSharedSessions(projectId: string): Promise<SharedSession[]> {
  try {
    const sessions = await invoke<SharedSession[]>('get_shared_sessions', {
      project_id: projectId
    });

    return sessions;
  } catch (error) {
    console.error('Failed to get shared sessions:', error);
    return [];
  }
}

/**
 * Merge multiple sessions into one
 */
export async function mergeSessions(
  sessionIds: string[],
  targetSessionId?: string
): Promise<string> {
  try {
    const mergedSessionId = await invoke<string>('merge_sessions', {
      session_ids: sessionIds,
      target_session_id: targetSessionId
    });

    return mergedSessionId;
  } catch (error) {
    console.error('Failed to merge sessions:', error);
    throw error;
  }
}

/**
 * Helper function to determine provider from model ID
 */
function determineProvider(modelId: string): string {
  if (modelId.includes('claude') || modelId.includes('opus') || modelId.includes('sonnet')) {
    return 'claude';
  } else if (modelId.includes('gemini')) {
    return 'gemini';
  } else if (modelId.includes('llama') || modelId.includes('mixtral') || modelId.includes('codestral')) {
    return 'ollama';
  }
  return 'unknown';
}

/**
 * Export session to portable format
 */
export async function exportSession(sessionId: string): Promise<any> {
  try {
    const sessionData = await invoke('export_session', {
      session_id: sessionId
    });
    return sessionData;
  } catch (error) {
    console.error('Failed to export session:', error);
    throw error;
  }
}

/**
 * Import session from portable format
 */
export async function importSession(sessionData: any): Promise<string> {
  try {
    const sessionId = await invoke<string>('import_session', {
      session_data: sessionData
    });
    return sessionId;
  } catch (error) {
    console.error('Failed to import session:', error);
    throw error;
  }
}