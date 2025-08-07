import { invoke } from "@tauri-apps/api/core";
import type { HooksConfiguration } from '@/types/hooks';
import {
  GeminiError,
  GeminiErrorCode,
  type GeminiRequest,
  type GeminiResponse,
  type GeminiStreamChunk,
  validateGeminiRequest,
  validateGeminiResponse,
  isGeminiError
} from './api-types';

/** Process type for tracking in ProcessRegistry */
export type ProcessType = 
  | { AgentRun: { agent_id: number; agent_name: string } }
  | { ClaudeSession: { session_id: string } };

/** Information about a running process */
export interface ProcessInfo {
  run_id: number;
  process_type: ProcessType;
  pid: number;
  started_at: string;
  project_path: string;
  task: string;
  model: string;
}

/**
 * Represents a project in the database
 */
export interface Project {
  /** The project ID (unique identifier) */
  id: string;
  /** The project path on the filesystem */
  path: string;
  /** The project name (optional, derived from path if not provided) */
  name?: string;
  /** Project description (optional) */
  description?: string;
  /** Creation timestamp */
  created_at: string;
  /** Last access timestamp (optional) */
  last_accessed?: string;
  /** Number of sessions associated with this project (optional) */
  sessions_count?: number;
  /** Project status */
  status?: string;
  /** Project type */
  project_type?: string;
  /** Git repository URL (optional) */
  git_repo?: string;
  /** Technology stack as JSON array string (optional) */
  tech_stack?: string;
  /** Team members as JSON array string (optional) */
  team_members?: string;
  /** Additional metadata as JSON object string (optional) */
  metadata?: string;
  /** List of session IDs for backward compatibility */
  sessions?: string[];
}

/**
 * Represents a session with its metadata
 */
export interface Session {
  /** The session ID (UUID) */
  id: string;
  /** The project ID this session belongs to */
  project_id: string;
  /** The project path */
  project_path: string;
  /** Optional todo data associated with this session */
  todo_data?: any;
  /** Unix timestamp when the session file was created */
  created_at: number;
  /** First user message content (if available) */
  first_message?: string;
  /** Timestamp of the first user message (if available) */
  message_timestamp?: string;
}

/**
 * Represents the settings from ~/.claude/settings.json
 */
export interface ClaudeSettings {
  [key: string]: any;
}

/**
 * Represents the Claude Code version status
 */
export interface ClaudeVersionStatus {
  /** Whether Claude Code is installed and working */
  is_installed: boolean;
  /** The version string if available */
  version?: string;
  /** The full output from the command */
  output: string;
}

/**
 * Represents a CLAUDE.md file found in the project
 */
export interface ClaudeMdFile {
  /** Relative path from the project root */
  relative_path: string;
  /** Absolute path to the file */
  absolute_path: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  modified: number;
}

/**
 * Represents a file or directory entry
 */
export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  extension?: string;
}

/**
 * Represents a Claude installation found on the system
 */
export interface ClaudeInstallation {
  /** Full path to the Claude binary */
  path: string;
  /** Version string if available */
  version?: string;
  /** Source of discovery (e.g., "nvm", "system", "homebrew", "which") */
  source: string;
  /** Type of installation */
  installation_type: "System" | "Custom";
}

// Agent API types
export interface Agent {
  id?: number;
  name: string;
  icon: string;
  system_prompt: string;
  default_task?: string;
  model: string;
  hooks?: string; // JSON string of HooksConfiguration
  created_at: string;
  updated_at: string;
}

export interface AgentExport {
  version: number;
  exported_at: string;
  agent: {
    name: string;
    icon: string;
    system_prompt: string;
    default_task?: string;
    model: string;
    hooks?: string;
  };
}

export interface GitHubAgentFile {
  name: string;
  path: string;
  download_url: string;
  size: number;
  sha: string;
}

export interface AgentRun {
  id?: number;
  agent_id: number;
  agent_name: string;
  agent_icon: string;
  task: string;
  model: string;
  project_path: string;
  session_id: string;
  status: string; // 'pending', 'running', 'completed', 'failed', 'cancelled'
  pid?: number;
  process_started_at?: string;
  created_at: string;
  completed_at?: string;
}

export interface AgentRunMetrics {
  duration_ms?: number;
  total_tokens?: number;
  cost_usd?: number;
  message_count?: number;
}

export interface AgentRunWithMetrics {
  id?: number;
  agent_id: number;
  agent_name: string;
  agent_icon: string;
  task: string;
  model: string;
  project_path: string;
  session_id: string;
  status: string; // 'pending', 'running', 'completed', 'failed', 'cancelled'
  pid?: number;
  process_started_at?: string;
  created_at: string;
  completed_at?: string;
  metrics?: AgentRunMetrics;
  output?: string; // Real-time JSONL content
}

// Usage Dashboard types
export interface UsageEntry {
  project: string;
  timestamp: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  cost: number;
}

export interface ModelUsage {
  model: string;
  total_cost: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  session_count: number;
}

export interface DailyUsage {
  date: string;
  total_cost: number;
  total_tokens: number;
  models_used: string[];
}

export interface ProjectUsage {
  project_path: string;
  project_name: string;
  total_cost: number;
  total_tokens: number;
  session_count: number;
  last_used: string;
}

export interface UsageStats {
  total_cost: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
  total_sessions: number;
  by_model: ModelUsage[];
  by_date: DailyUsage[];
  by_project: ProjectUsage[];
}

/**
 * Represents a checkpoint in the session timeline
 */
export interface Checkpoint {
  id: string;
  sessionId: string;
  projectId: string;
  messageIndex: number;
  timestamp: string;
  description?: string;
  parentCheckpointId?: string;
  metadata: CheckpointMetadata;
}

/**
 * Metadata associated with a checkpoint
 */
export interface CheckpointMetadata {
  totalTokens: number;
  modelUsed: string;
  userPrompt: string;
  fileChanges: number;
  snapshotSize: number;
}

/**
 * Represents a file snapshot at a checkpoint
 */
export interface FileSnapshot {
  checkpointId: string;
  filePath: string;
  content: string;
  hash: string;
  isDeleted: boolean;
  permissions?: number;
  size: number;
}

/**
 * Represents a node in the timeline tree
 */
export interface TimelineNode {
  checkpoint: Checkpoint;
  children: TimelineNode[];
  fileSnapshotIds: string[];
}

/**
 * The complete timeline for a session
 */
export interface SessionTimeline {
  sessionId: string;
  rootNode?: TimelineNode;
  currentCheckpointId?: string;
  autoCheckpointEnabled: boolean;
  checkpointStrategy: CheckpointStrategy;
  totalCheckpoints: number;
}

/**
 * Strategy for automatic checkpoint creation
 */
export type CheckpointStrategy = 'manual' | 'per_prompt' | 'per_tool_use' | 'smart';

/**
 * Result of a checkpoint operation
 */
export interface CheckpointResult {
  checkpoint: Checkpoint;
  filesProcessed: number;
  warnings: string[];
}

/**
 * Diff between two checkpoints
 */
export interface CheckpointDiff {
  fromCheckpointId: string;
  toCheckpointId: string;
  modifiedFiles: FileDiff[];
  addedFiles: string[];
  deletedFiles: string[];
  tokenDelta: number;
}

/**
 * Diff for a single file
 */
export interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  diffContent?: string;
}

/**
 * Represents an MCP server configuration
 */
export interface MCPServer {
  /** Server name/identifier */
  name: string;
  /** Transport type: "stdio" or "sse" */
  transport: string;
  /** Command to execute (for stdio) */
  command?: string;
  /** Command arguments (for stdio) */
  args: string[];
  /** Environment variables */
  env: Record<string, string>;
  /** URL endpoint (for SSE) */
  url?: string;
  /** Configuration scope: "local", "project", or "user" */
  scope: string;
  /** Whether the server is currently active */
  is_active: boolean;
  /** Server status */
  status: ServerStatus;
}

/**
 * Server status information
 */
export interface ServerStatus {
  /** Whether the server is running */
  running: boolean;
  /** Last error message if any */
  error?: string;
  /** Last checked timestamp */
  last_checked?: number;
}

/**
 * MCP configuration for project scope (.mcp.json)
 */
export interface MCPProjectConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * Individual server configuration in .mcp.json
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Represents a custom slash command
 */
export interface SlashCommand {
  /** Unique identifier for the command */
  id: string;
  /** Command name (without prefix) */
  name: string;
  /** Full command with prefix (e.g., "/project:optimize") */
  full_command: string;
  /** Command scope: "project" or "user" */
  scope: string;
  /** Optional namespace (e.g., "frontend" in "/project:frontend:component") */
  namespace?: string;
  /** Path to the markdown file */
  file_path: string;
  /** Command content (markdown body) */
  content: string;
  /** Optional description from frontmatter */
  description?: string;
  /** Allowed tools from frontmatter */
  allowed_tools: string[];
  /** Whether the command has bash commands (!) */
  has_bash_commands: boolean;
  /** Whether the command has file references (@) */
  has_file_references: boolean;
  /** Whether the command uses $ARGUMENTS placeholder */
  accepts_arguments: boolean;
}

/**
 * Result of adding a server
 */
export interface AddServerResult {
  success: boolean;
  message: string;
  server_name?: string;
}

/**
 * Import result for multiple servers
 */
export interface ImportResult {
  imported_count: number;
  failed_count: number;
  servers: ImportServerResult[];
}

/**
 * Result for individual server import
 */
export interface ImportServerResult {
  name: string;
  success: boolean;
  error?: string;
}

/**
 * Tool type that can be invoked
 */
export type ToolType = 
  | { agent: string }
  | { slash_command: string }
  | { super_claude: true }
  | { mcp_server: string };

/**
 * Tool invocation decision
 */
export interface ToolInvocation {
  tool_type: ToolType;
  confidence: number;
  reason: string;
  priority: number;
}

/**
 * Routing result containing all tools to invoke
 */
export interface RoutingResult {
  invocations: ToolInvocation[];
  detected_intent: string;
  complexity_score: number;
  domain: string;
}

/**
 * MCP installation request
 */
export interface McpInstallRequest {
  query: string;
  detected_packages: string[];
  confidence: number;
}

/**
 * MCP Server metadata
 */
export interface McpServerInfo {
  name: string;
  display_name: string;
  description: string;
  npm_package?: string;
  github_repo?: string;
  install_command: string;
  config_template: any;
  categories: string[];
  popularity: number;
}

/**
 * MCP installation status
 */
export interface McpInstallStatus {
  server_name: string;
  status: 'searching' | 'found' | 'installing' | 'configuring' | 'testing' | 'completed' | 'failed';
  message: string;
  progress: number;
}

/**
 * MCP search result
 */
export interface McpSearchResult {
  servers: McpServerInfo[];
  total_found: number;
  source: string;
}

// Claude Sync Types
export interface ClaudeSyncState {
  last_sync: number | null;
  claude_version: string | null;
  commands_cache: Record<string, any>;
  sync_enabled: boolean;
  auto_sync_interval_hours: number;
}

export interface ClaudeSyncResult {
  success: boolean;
  commands_found: number;
  new_commands: number;
  updated_commands: number;
  sync_time: number;
  error: string | null;
  claude_version: string | null;
}

// Dashboard Types (matching Rust backend)
export interface ProjectHealthMetric {
  id?: number;
  project_id: string;
  metric_type: string;
  value: number;
  timestamp: number;
  details?: string;
  trend?: string;
}

export interface FeatureItem {
  id?: number;
  project_id: string;
  name: string;
  description?: string;
  status: string;
  independence_score?: number;
  dependencies?: string;
  file_paths?: string;
  complexity_score?: number;
  created_at: number;
  updated_at: number;
}

export interface RiskItem {
  id?: number;
  project_id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  mitigation?: string;
  status: string;
  impact_score?: number;
  probability?: number;
  detected_at: number;
  resolved_at?: number;
  file_paths?: string;
}

export interface DocumentationStatus {
  id?: number;
  project_id: string;
  doc_type: string;
  completion_percentage?: number;
  total_sections?: number;
  completed_sections?: number;
  missing_sections?: string;
  file_paths?: string;
  last_updated: number;
  quality_score?: number;
}

export interface AIUsageMetric {
  id?: number;
  project_id: string;
  model_name: string;
  agent_type?: string;
  mcp_server?: string;
  token_count: number;
  request_count: number;
  success_count: number;
  failure_count: number;
  success_rate?: number;
  avg_response_time?: number;
  total_cost?: number;
  session_date: string;
  timestamp: number;
}

export interface WorkflowStage {
  id?: number;
  project_id: string;
  stage_name: string;
  stage_order: number;
  status: string;
  start_date?: number;
  end_date?: number;
  duration_days?: number;
  efficiency_score?: number;
  bottlenecks?: string;
  updated_at: number;
}

export interface ProjectGoals {
  id?: number;
  project_id: string;
  primary_goal?: string;
  secondary_goals?: string;
  overall_completion?: number;
  features_completion?: number;
  documentation_completion?: number;
  tests_completion?: number;
  deployment_readiness?: number;
  created_at: number;
  updated_at: number;
}

export interface DashboardConfig {
  id?: number;
  project_id: string;
  config_version?: string;
  refresh_interval?: number;
  cache_duration?: number;
  enabled_widgets?: string;
  custom_metrics?: string;
  created_at: number;
  updated_at: number;
}

export interface DashboardSummary {
  project_id: string;
  health_metrics: ProjectHealthMetric[];
  feature_status: FeatureItem[];
  risk_items: RiskItem[];
  documentation_status: DocumentationStatus[];
  ai_usage: AIUsageMetric[];
  workflow_stages: WorkflowStage[];
  project_goals?: ProjectGoals;
  config?: DashboardConfig;
}

/**
 * API client for interacting with the Rust backend
 */
export const api = {
  /**
   * Lists all projects in the ~/.claude/projects directory
   * @returns Promise resolving to an array of projects
   */
  async listProjects(): Promise<Project[]> {
    try {
      return await invoke<Project[]>("list_projects");
    } catch (error) {
      console.error("Failed to list projects:", error);
      throw error;
    }
  },

  /**
   * Retrieves sessions for a specific project
   * @param projectId - The ID of the project to retrieve sessions for
   * @returns Promise resolving to an array of sessions
   */
  async getProjectSessions(projectId: string): Promise<Session[]> {
    try {
      return await invoke<Session[]>('get_project_sessions', { projectId });
    } catch (error) {
      console.error("Failed to get project sessions:", error);
      throw error;
    }
  },

  /**
   * Fetch list of agents from GitHub repository
   * @returns Promise resolving to list of available agents on GitHub
   */
  async fetchGitHubAgents(): Promise<GitHubAgentFile[]> {
    try {
      return await invoke<GitHubAgentFile[]>('fetch_github_agents');
    } catch (error) {
      console.error("Failed to fetch GitHub agents:", error);
      throw error;
    }
  },

  /**
   * Fetch and preview a specific agent from GitHub
   * @param downloadUrl - The download URL for the agent file
   * @returns Promise resolving to the agent export data
   */
  async fetchGitHubAgentContent(downloadUrl: string): Promise<AgentExport> {
    try {
      return await invoke<AgentExport>('fetch_github_agent_content', { downloadUrl });
    } catch (error) {
      console.error("Failed to fetch GitHub agent content:", error);
      throw error;
    }
  },

  /**
   * Import an agent directly from GitHub
   * @param downloadUrl - The download URL for the agent file
   * @returns Promise resolving to the imported agent
   */
  async importAgentFromGitHub(downloadUrl: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent_from_github', { downloadUrl });
    } catch (error) {
      console.error("Failed to import agent from GitHub:", error);
      throw error;
    }
  },

  /**
   * Reads the Claude settings file
   * @returns Promise resolving to the settings object
   */
  async getClaudeSettings(): Promise<ClaudeSettings> {
    try {
      const result = await invoke<{ data: ClaudeSettings }>("get_claude_settings");
      console.log("Raw result from get_claude_settings:", result);
      
      // The Rust backend returns ClaudeSettings { data: ... }
      // We need to extract the data field
      if (result && typeof result === 'object' && 'data' in result) {
        return result.data;
      }
      
      // If the result is already the settings object, return it
      return result as ClaudeSettings;
    } catch (error) {
      console.error("Failed to get Claude settings:", error);
      throw error;
    }
  },

  /**
   * Opens a new Claude Code session
   * @param path - Optional path to open the session in
   * @returns Promise resolving when the session is opened
   */
  async openNewSession(path?: string): Promise<string> {
    try {
      return await invoke<string>("open_new_session", { path });
    } catch (error) {
      console.error("Failed to open new session:", error);
      throw error;
    }
  },

  /**
   * Reads the CLAUDE.md system prompt file
   * @returns Promise resolving to the system prompt content
   */
  async getSystemPrompt(): Promise<string> {
    try {
      return await invoke<string>("get_system_prompt");
    } catch (error) {
      console.error("Failed to get system prompt:", error);
      throw error;
    }
  },

  /**
   * Checks if Claude Code is installed and gets its version
   * @returns Promise resolving to the version status
   */
  async checkClaudeVersion(): Promise<ClaudeVersionStatus> {
    try {
      return await invoke<ClaudeVersionStatus>("check_claude_version");
    } catch (error) {
      console.error("Failed to check Claude version:", error);
      throw error;
    }
  },

  /**
   * Saves the CLAUDE.md system prompt file
   * @param content - The new content for the system prompt
   * @returns Promise resolving when the file is saved
   */
  async saveSystemPrompt(content: string): Promise<string> {
    try {
      return await invoke<string>("save_system_prompt", { content });
    } catch (error) {
      console.error("Failed to save system prompt:", error);
      throw error;
    }
  },

  /**
   * Saves the Claude settings file
   * @param settings - The settings object to save
   * @returns Promise resolving when the settings are saved
   */
  async saveClaudeSettings(settings: ClaudeSettings): Promise<string> {
    try {
      return await invoke<string>("save_claude_settings", { settings });
    } catch (error) {
      console.error("Failed to save Claude settings:", error);
      throw error;
    }
  },

  /**
   * Finds all CLAUDE.md files in a project directory
   * @param projectPath - The absolute path to the project
   * @returns Promise resolving to an array of CLAUDE.md files
   */
  async findClaudeMdFiles(projectPath: string): Promise<ClaudeMdFile[]> {
    try {
      return await invoke<ClaudeMdFile[]>("find_claude_md_files", { projectPath });
    } catch (error) {
      console.error("Failed to find CLAUDE.md files:", error);
      throw error;
    }
  },

  /**
   * Reads a specific CLAUDE.md file
   * @param filePath - The absolute path to the file
   * @returns Promise resolving to the file content
   */
  async readClaudeMdFile(filePath: string): Promise<string> {
    try {
      return await invoke<string>("read_claude_md_file", { filePath });
    } catch (error) {
      console.error("Failed to read CLAUDE.md file:", error);
      throw error;
    }
  },

  /**
   * Saves a specific CLAUDE.md file
   * @param filePath - The absolute path to the file
   * @param content - The new content for the file
   * @returns Promise resolving when the file is saved
   */
  async saveClaudeMdFile(filePath: string, content: string): Promise<string> {
    try {
      return await invoke<string>("save_claude_md_file", { filePath, content });
    } catch (error) {
      console.error("Failed to save CLAUDE.md file:", error);
      throw error;
    }
  },

  // Agent API methods
  
  /**
   * Lists all CC agents
   * @returns Promise resolving to an array of agents
   */
  async listAgents(): Promise<Agent[]> {
    try {
      return await invoke<Agent[]>('list_agents');
    } catch (error) {
      console.error("Failed to list agents:", error);
      throw error;
    }
  },

  /**
   * Creates a new agent
   * @param name - The agent name
   * @param icon - The icon identifier
   * @param system_prompt - The system prompt for the agent
   * @param default_task - Optional default task
   * @param model - Optional model (defaults to 'sonnet')
   * @param hooks - Optional hooks configuration as JSON string
   * @returns Promise resolving to the created agent
   */
  async createAgent(
    name: string, 
    icon: string, 
    system_prompt: string, 
    default_task?: string, 
    model?: string,
    hooks?: string
  ): Promise<Agent> {
    try {
      return await invoke<Agent>('create_agent', { 
        name, 
        icon, 
        systemPrompt: system_prompt,
        defaultTask: default_task,
        model,
        hooks
      });
    } catch (error) {
      console.error("Failed to create agent:", error);
      throw error;
    }
  },

  /**
   * Updates an existing agent
   * @param id - The agent ID
   * @param name - The updated name
   * @param icon - The updated icon
   * @param system_prompt - The updated system prompt
   * @param default_task - Optional default task
   * @param model - Optional model
   * @param hooks - Optional hooks configuration as JSON string
   * @returns Promise resolving to the updated agent
   */
  async updateAgent(
    id: number, 
    name: string, 
    icon: string, 
    system_prompt: string, 
    default_task?: string, 
    model?: string,
    hooks?: string
  ): Promise<Agent> {
    try {
      return await invoke<Agent>('update_agent', { 
        id, 
        name, 
        icon, 
        systemPrompt: system_prompt,
        defaultTask: default_task,
        model,
        hooks
      });
    } catch (error) {
      console.error("Failed to update agent:", error);
      throw error;
    }
  },

  /**
   * Deletes an agent
   * @param id - The agent ID to delete
   * @returns Promise resolving when the agent is deleted
   */
  async deleteAgent(id: number): Promise<void> {
    try {
      return await invoke('delete_agent', { id });
    } catch (error) {
      console.error("Failed to delete agent:", error);
      throw error;
    }
  },

  /**
   * Gets a single agent by ID
   * @param id - The agent ID
   * @returns Promise resolving to the agent
   */
  async getAgent(id: number): Promise<Agent> {
    try {
      return await invoke<Agent>('get_agent', { id });
    } catch (error) {
      console.error("Failed to get agent:", error);
      throw error;
    }
  },

  /**
   * Exports a single agent to JSON format
   * @param id - The agent ID to export
   * @returns Promise resolving to the JSON string
   */
  async exportAgent(id: number): Promise<string> {
    try {
      return await invoke<string>('export_agent', { id });
    } catch (error) {
      console.error("Failed to export agent:", error);
      throw error;
    }
  },

  /**
   * Imports an agent from JSON data
   * @param jsonData - The JSON string containing the agent export
   * @returns Promise resolving to the imported agent
   */
  async importAgent(jsonData: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent', { jsonData });
    } catch (error) {
      console.error("Failed to import agent:", error);
      throw error;
    }
  },

  /**
   * Imports an agent from a file
   * @param filePath - The path to the JSON file
   * @returns Promise resolving to the imported agent
   */
  async importAgentFromFile(filePath: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent_from_file', { filePath });
    } catch (error) {
      console.error("Failed to import agent from file:", error);
      throw error;
    }
  },

  /**
   * Executes an agent
   * @param agentId - The agent ID to execute
   * @param projectPath - The project path to run the agent in
   * @param task - The task description
   * @param model - Optional model override
   * @returns Promise resolving to the run ID when execution starts
   */
  async executeAgent(agentId: number, projectPath: string, task: string, model?: string): Promise<number> {
    try {
      return await invoke<number>('execute_agent', { agentId, projectPath, task, model });
    } catch (error) {
      console.error("Failed to execute agent:", error);
      // Return a sentinel value to indicate error
      throw new Error(`Failed to execute agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Lists agent runs with metrics
   * @param agentId - Optional agent ID to filter runs
   * @returns Promise resolving to an array of agent runs with metrics
   */
  async listAgentRuns(agentId?: number): Promise<AgentRunWithMetrics[]> {
    try {
      return await invoke<AgentRunWithMetrics[]>('list_agent_runs', { agentId });
    } catch (error) {
      console.error("Failed to list agent runs:", error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  /**
   * Gets a single agent run by ID with metrics
   * @param id - The run ID
   * @returns Promise resolving to the agent run with metrics
   */
  async getAgentRun(id: number): Promise<AgentRunWithMetrics> {
    try {
      return await invoke<AgentRunWithMetrics>('get_agent_run', { id });
    } catch (error) {
      console.error("Failed to get agent run:", error);
      throw new Error(`Failed to get agent run: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Gets a single agent run by ID with real-time metrics from JSONL
   * @param id - The run ID
   * @returns Promise resolving to the agent run with metrics
   */
  async getAgentRunWithRealTimeMetrics(id: number): Promise<AgentRunWithMetrics> {
    try {
      return await invoke<AgentRunWithMetrics>('get_agent_run_with_real_time_metrics', { id });
    } catch (error) {
      console.error("Failed to get agent run with real-time metrics:", error);
      throw new Error(`Failed to get agent run with real-time metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Lists all currently running agent sessions
   * @returns Promise resolving to list of running agent sessions
   */
  async listRunningAgentSessions(): Promise<AgentRun[]> {
    try {
      return await invoke<AgentRun[]>('list_running_sessions');
    } catch (error) {
      console.error("Failed to list running agent sessions:", error);
      throw new Error(`Failed to list running agent sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Kills a running agent session
   * @param runId - The run ID to kill
   * @returns Promise resolving to whether the session was successfully killed
   */
  async killAgentSession(runId: number): Promise<boolean> {
    try {
      return await invoke<boolean>('kill_agent_session', { runId });
    } catch (error) {
      console.error("Failed to kill agent session:", error);
      throw new Error(`Failed to kill agent session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Gets the status of a specific agent session
   * @param runId - The run ID to check
   * @returns Promise resolving to the session status or null if not found
   */
  async getSessionStatus(runId: number): Promise<string | null> {
    try {
      return await invoke<string | null>('get_session_status', { runId });
    } catch (error) {
      console.error("Failed to get session status:", error);
      throw new Error(`Failed to get session status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Cleanup finished processes and update their status
   * @returns Promise resolving to list of run IDs that were cleaned up
   */
  async cleanupFinishedProcesses(): Promise<number[]> {
    try {
      return await invoke<number[]>('cleanup_finished_processes');
    } catch (error) {
      console.error("Failed to cleanup finished processes:", error);
      throw new Error(`Failed to cleanup finished processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get real-time output for a running session (with live output fallback)
   * @param runId - The run ID to get output for
   * @returns Promise resolving to the current session output (JSONL format)
   */
  async getSessionOutput(runId: number): Promise<string> {
    try {
      return await invoke<string>('get_session_output', { runId });
    } catch (error) {
      console.error("Failed to get session output:", error);
      throw new Error(`Failed to get session output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get live output directly from process stdout buffer
   * @param runId - The run ID to get live output for
   * @returns Promise resolving to the current live output
   */
  async getLiveSessionOutput(runId: number): Promise<string> {
    try {
      return await invoke<string>('get_live_session_output', { runId });
    } catch (error) {
      console.error("Failed to get live session output:", error);
      throw new Error(`Failed to get live session output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Start streaming real-time output for a running session
   * @param runId - The run ID to stream output for
   * @returns Promise that resolves when streaming starts
   */
  async streamSessionOutput(runId: number): Promise<void> {
    try {
      return await invoke<void>('stream_session_output', { runId });
    } catch (error) {
      console.error("Failed to start streaming session output:", error);
      throw new Error(`Failed to start streaming session output: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Loads the JSONL history for a specific session with retry logic
   */
  async loadSessionHistory(sessionId: string, projectId: string, maxRetries = 3): Promise<any[]> {
    let lastError: Error | null = null;
    
    // First try the enhanced session loader that handles both Claude and Gemini
    try {
      return await invoke<any[]>("load_session_history_enhanced", { sessionId, projectId });
    } catch (error) {
      console.warn("Enhanced session loader failed, falling back to legacy approach:", error);
      lastError = error as Error;
    }
    
    // Fallback to legacy session loading
    try {
      const exists = await invoke<boolean>("validate_session_exists", { sessionId, projectId });
      if (!exists) {
        console.warn(`Session ${sessionId} not found, attempting recovery...`);
        // Try recovery directly
        return await invoke<any[]>("recover_session", { sessionId });
      }
    } catch (error) {
      console.warn("Failed to validate session existence:", error);
    }
    
    // Try loading with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await invoke<any[]>("load_session_history", { sessionId, projectId });
      } catch (error) {
        lastError = error as Error;
        console.warn(`Session load attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 500ms, 1s, 2s
          const delay = Math.pow(2, attempt) * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If all retries failed, try recovery
    console.error("All session load attempts failed, attempting recovery...");
    try {
      return await invoke<any[]>("recover_session", { sessionId });
    } catch (recoveryError) {
      console.error("Session recovery also failed:", recoveryError);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  /**
   * Loads the JSONL history for a specific agent session
   * Similar to loadSessionHistory but searches across all project directories
   * @param sessionId - The session ID (UUID)
   * @returns Promise resolving to array of session messages
   */
  async loadAgentSessionHistory(sessionId: string): Promise<any[]> {
    try {
      return await invoke<any[]>('load_agent_session_history', { sessionId });
    } catch (error) {
      console.error("Failed to load agent session history:", error);
      throw error;
    }
  },

  /**
   * Executes a new interactive Claude Code session with streaming output
   */
  async executeClaudeCode(projectPath: string, prompt: string, model: string): Promise<void> {
    return invoke("execute_claude_code", { projectPath, prompt, model });
  },

  /**
   * Continues an existing Claude Code conversation with streaming output
   */
  async continueClaudeCode(projectPath: string, prompt: string, model: string): Promise<void> {
    return invoke("continue_claude_code", { projectPath, prompt, model });
  },

  /**
   * Resumes an existing Claude Code session by ID with streaming output
   */
  async resumeClaudeCode(projectPath: string, sessionId: string, prompt: string, model: string): Promise<void> {
    return invoke("resume_claude_code", { projectPath, sessionId, prompt, model });
  },

  /**
   * Cancels the currently running Claude Code execution
   * @param sessionId - Optional session ID to cancel a specific session
   */
  async cancelClaudeExecution(sessionId?: string): Promise<void> {
    return invoke("cancel_claude_execution", { sessionId });
  },

  /**
   * Lists all currently running Claude sessions
   * @returns Promise resolving to list of running Claude sessions
   */
  async listRunningClaudeSessions(): Promise<any[]> {
    return invoke("list_running_claude_sessions");
  },

  /**
   * Gets live output from a Claude session
   * @param sessionId - The session ID to get output for
   * @returns Promise resolving to the current live output
   */
  async getClaudeSessionOutput(sessionId: string): Promise<string> {
    return invoke("get_claude_session_output", { sessionId });
  },

  /**
   * Lists files and directories in a given path
   */
  async listDirectoryContents(directoryPath: string): Promise<FileEntry[]> {
    return invoke("list_directory_contents", { directoryPath });
  },

  /**
   * Searches for files and directories matching a pattern
   */
  async searchFiles(basePath: string, query: string): Promise<FileEntry[]> {
    return invoke("search_files", { basePath, query });
  },

  /**
   * Gets overall usage statistics
   * @returns Promise resolving to usage statistics
   */
  async getUsageStats(): Promise<UsageStats> {
    try {
      return await invoke<UsageStats>("get_usage_stats");
    } catch (error) {
      console.error("Failed to get usage stats:", error);
      throw error;
    }
  },

  /**
   * Gets usage statistics filtered by date range
   * @param startDate - Start date (ISO format)
   * @param endDate - End date (ISO format)
   * @returns Promise resolving to usage statistics
   */
  async getUsageByDateRange(startDate: string, endDate: string): Promise<UsageStats> {
    try {
      return await invoke<UsageStats>("get_usage_by_date_range", { startDate, endDate });
    } catch (error) {
      console.error("Failed to get usage by date range:", error);
      throw error;
    }
  },

  /**
   * Gets usage statistics grouped by session
   * @param since - Optional start date (YYYYMMDD)
   * @param until - Optional end date (YYYYMMDD)
   * @param order - Optional sort order ('asc' or 'desc')
   * @returns Promise resolving to an array of session usage data
   */
  async getSessionStats(
    since?: string,
    until?: string,
    order?: "asc" | "desc"
  ): Promise<ProjectUsage[]> {
    try {
      return await invoke<ProjectUsage[]>("get_session_stats", {
        since,
        until,
        order,
      });
    } catch (error) {
      console.error("Failed to get session stats:", error);
      throw error;
    }
  },

  /**
   * Gets detailed usage entries with optional filtering
   * @param limit - Optional limit for number of entries
   * @returns Promise resolving to array of usage entries
   */
  async getUsageDetails(limit?: number): Promise<UsageEntry[]> {
    try {
      return await invoke<UsageEntry[]>("get_usage_details", { limit });
    } catch (error) {
      console.error("Failed to get usage details:", error);
      throw error;
    }
  },

  /**
   * Creates a checkpoint for the current session state
   */
  async createCheckpoint(
    sessionId: string,
    projectId: string,
    projectPath: string,
    messageIndex?: number,
    description?: string
  ): Promise<CheckpointResult> {
    return invoke("create_checkpoint", {
      sessionId,
      projectId,
      projectPath,
      messageIndex,
      description
    });
  },

  /**
   * Restores a session to a specific checkpoint
   */
  async restoreCheckpoint(
    checkpointId: string,
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<CheckpointResult> {
    return invoke("restore_checkpoint", {
      checkpointId,
      sessionId,
      projectId,
      projectPath
    });
  },

  /**
   * Lists all checkpoints for a session
   */
  async listCheckpoints(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<Checkpoint[]> {
    return invoke("list_checkpoints", {
      sessionId,
      projectId,
      projectPath
    });
  },

  /**
   * Forks a new timeline branch from a checkpoint
   */
  async forkFromCheckpoint(
    checkpointId: string,
    sessionId: string,
    projectId: string,
    projectPath: string,
    newSessionId: string,
    description?: string
  ): Promise<CheckpointResult> {
    return invoke("fork_from_checkpoint", {
      checkpointId,
      sessionId,
      projectId,
      projectPath,
      newSessionId,
      description
    });
  },

  /**
   * Gets the timeline for a session
   */
  async getSessionTimeline(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<SessionTimeline> {
    return invoke("get_session_timeline", {
      sessionId,
      projectId,
      projectPath
    });
  },

  /**
   * Updates checkpoint settings for a session
   */
  async updateCheckpointSettings(
    sessionId: string,
    projectId: string,
    projectPath: string,
    autoCheckpointEnabled: boolean,
    checkpointStrategy: CheckpointStrategy
  ): Promise<void> {
    return invoke("update_checkpoint_settings", {
      sessionId,
      projectId,
      projectPath,
      autoCheckpointEnabled,
      checkpointStrategy
    });
  },

  /**
   * Gets diff between two checkpoints
   */
  async getCheckpointDiff(
    fromCheckpointId: string,
    toCheckpointId: string,
    sessionId: string,
    projectId: string
  ): Promise<CheckpointDiff> {
    try {
      return await invoke<CheckpointDiff>("get_checkpoint_diff", {
        fromCheckpointId,
        toCheckpointId,
        sessionId,
        projectId
      });
    } catch (error) {
      console.error("Failed to get checkpoint diff:", error);
      throw error;
    }
  },

  /**
   * Tracks a message for checkpointing
   */
  async trackCheckpointMessage(
    sessionId: string,
    projectId: string,
    projectPath: string,
    message: string
  ): Promise<void> {
    try {
      await invoke("track_checkpoint_message", {
        sessionId,
        projectId,
        projectPath,
        message
      });
    } catch (error) {
      console.error("Failed to track checkpoint message:", error);
      throw error;
    }
  },

  /**
   * Checks if auto-checkpoint should be triggered
   */
  async checkAutoCheckpoint(
    sessionId: string,
    projectId: string,
    projectPath: string,
    message: string
  ): Promise<boolean> {
    try {
      return await invoke<boolean>("check_auto_checkpoint", {
        sessionId,
        projectId,
        projectPath,
        message
      });
    } catch (error) {
      console.error("Failed to check auto checkpoint:", error);
      throw error;
    }
  },

  /**
   * Triggers cleanup of old checkpoints
   */
  async cleanupOldCheckpoints(
    sessionId: string,
    projectId: string,
    projectPath: string,
    keepCount: number
  ): Promise<number> {
    try {
      return await invoke<number>("cleanup_old_checkpoints", {
        sessionId,
        projectId,
        projectPath,
        keepCount
      });
    } catch (error) {
      console.error("Failed to cleanup old checkpoints:", error);
      throw error;
    }
  },

  /**
   * Gets checkpoint settings for a session
   */
  async getCheckpointSettings(
    sessionId: string,
    projectId: string,
    projectPath: string
  ): Promise<{
    auto_checkpoint_enabled: boolean;
    checkpoint_strategy: CheckpointStrategy;
    total_checkpoints: number;
    current_checkpoint_id?: string;
  }> {
    try {
      return await invoke("get_checkpoint_settings", {
        sessionId,
        projectId,
        projectPath
      });
    } catch (error) {
      console.error("Failed to get checkpoint settings:", error);
      throw error;
    }
  },

  /**
   * Clears checkpoint manager for a session (cleanup on session end)
   */
  async clearCheckpointManager(sessionId: string): Promise<void> {
    try {
      await invoke("clear_checkpoint_manager", { sessionId });
    } catch (error) {
      console.error("Failed to clear checkpoint manager:", error);
      throw error;
    }
  },

  /**
   * Tracks a batch of messages for a session for checkpointing
   */
  trackSessionMessages: (
    sessionId: string, 
    projectId: string, 
    projectPath: string, 
    messages: string[]
  ): Promise<void> =>
    invoke("track_session_messages", { sessionId, projectId, projectPath, messages }),

  /**
   * Adds a new MCP server
   */
  async mcpAdd(
    name: string,
    transport: string,
    command?: string,
    args: string[] = [],
    env: Record<string, string> = {},
    url?: string,
    scope: string = "local"
  ): Promise<AddServerResult> {
    try {
      return await invoke<AddServerResult>("mcp_add", {
        name,
        transport,
        command,
        args,
        env,
        url,
        scope
      });
    } catch (error) {
      console.error("Failed to add MCP server:", error);
      throw error;
    }
  },

  /**
   * Lists all configured MCP servers
   */
  async mcpList(): Promise<MCPServer[]> {
    try {
      console.log("API: Calling mcp_list...");
      const result = await invoke<MCPServer[]>("mcp_list");
      console.log("API: mcp_list returned:", result);
      return result;
    } catch (error) {
      console.error("API: Failed to list MCP servers:", error);
      throw error;
    }
  },

  /**
   * Gets details for a specific MCP server
   */
  async mcpGet(name: string): Promise<MCPServer> {
    try {
      return await invoke<MCPServer>("mcp_get", { name });
    } catch (error) {
      console.error("Failed to get MCP server:", error);
      throw error;
    }
  },

  /**
   * Removes an MCP server
   */
  async mcpRemove(name: string): Promise<string> {
    try {
      return await invoke<string>("mcp_remove", { name });
    } catch (error) {
      console.error("Failed to remove MCP server:", error);
      throw error;
    }
  },

  /**
   * Adds an MCP server from JSON configuration
   */
  async mcpAddJson(name: string, jsonConfig: string, scope: string = "local"): Promise<AddServerResult> {
    try {
      return await invoke<AddServerResult>("mcp_add_json", { name, jsonConfig, scope });
    } catch (error) {
      console.error("Failed to add MCP server from JSON:", error);
      throw error;
    }
  },

  /**
   * Imports MCP servers from Claude Desktop
   */
  async mcpAddFromClaudeDesktop(scope: string = "local"): Promise<ImportResult> {
    try {
      return await invoke<ImportResult>("mcp_add_from_claude_desktop", { scope });
    } catch (error) {
      console.error("Failed to import from Claude Desktop:", error);
      throw error;
    }
  },

  /**
   * Starts Claude Code as an MCP server
   */
  async mcpServe(): Promise<string> {
    try {
      return await invoke<string>("mcp_serve");
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      throw error;
    }
  },

  /**
   * Tests connection to an MCP server
   */
  async mcpTestConnection(name: string): Promise<string> {
    try {
      return await invoke<string>("mcp_test_connection", { name });
    } catch (error) {
      console.error("Failed to test MCP connection:", error);
      throw error;
    }
  },

  /**
   * Updates an existing MCP server
   */
  async mcpUpdate(
    name: string,
    transport: string,
    command?: string,
    args: string[] = [],
    env: Record<string, string> = {},
    url?: string,
    scope: string = "local"
  ): Promise<AddServerResult> {
    try {
      return await invoke<AddServerResult>("mcp_update", {
        name,
        transport,
        command,
        args,
        env,
        url,
        scope,
      });
    } catch (error) {
      console.error("Failed to update MCP server:", error);
      throw error;
    }
  },

  /**
   * Exports an MCP server configuration as JSON
   */
  async mcpExportJson(name: string): Promise<string> {
    try {
      return await invoke<string>("mcp_export_json", { name });
    } catch (error) {
      console.error("Failed to export MCP server as JSON:", error);
      throw error;
    }
  },

  /**
   * Exports all MCP servers as JSON
   */
  async mcpExportAllJson(): Promise<string> {
    try {
      return await invoke<string>("mcp_export_all_json");
    } catch (error) {
      console.error("Failed to export all MCP servers as JSON:", error);
      throw error;
    }
  },

  /**
   * Resets project-scoped server approval choices
   */
  async mcpResetProjectChoices(): Promise<string> {
    try {
      return await invoke<string>("mcp_reset_project_choices");
    } catch (error) {
      console.error("Failed to reset project choices:", error);
      throw error;
    }
  },

  /**
   * Gets the status of MCP servers
   */
  async mcpGetServerStatus(): Promise<Record<string, ServerStatus>> {
    try {
      return await invoke<Record<string, ServerStatus>>("mcp_get_server_status");
    } catch (error) {
      console.error("Failed to get server status:", error);
      throw error;
    }
  },

  /**
   * Reads .mcp.json from the current project
   */
  async mcpReadProjectConfig(projectPath: string): Promise<MCPProjectConfig> {
    try {
      return await invoke<MCPProjectConfig>("mcp_read_project_config", { projectPath });
    } catch (error) {
      console.error("Failed to read project MCP config:", error);
      throw error;
    }
  },

  /**
   * Saves .mcp.json to the current project
   */
  async mcpSaveProjectConfig(projectPath: string, config: MCPProjectConfig): Promise<string> {
    try {
      return await invoke<string>("mcp_save_project_config", { projectPath, config });
    } catch (error) {
      console.error("Failed to save project MCP config:", error);
      throw error;
    }
  },

  /**
   * Get the stored Claude binary path from settings
   * @returns Promise resolving to the path if set, null otherwise
   */
  async getClaudeBinaryPath(): Promise<string | null> {
    try {
      return await invoke<string | null>("get_claude_binary_path");
    } catch (error) {
      console.error("Failed to get Claude binary path:", error);
      throw error;
    }
  },

  /**
   * Set the Claude binary path in settings
   * @param path - The absolute path to the Claude binary
   * @returns Promise resolving when the path is saved
   */
  async setClaudeBinaryPath(path: string): Promise<void> {
    try {
      return await invoke<void>("set_claude_binary_path", { path });
    } catch (error) {
      console.error("Failed to set Claude binary path:", error);
      throw error;
    }
  },

  /**
   * List all available Claude installations on the system
   * @returns Promise resolving to an array of Claude installations
   */
  async listClaudeInstallations(): Promise<ClaudeInstallation[]> {
    try {
      return await invoke<ClaudeInstallation[]>("list_claude_installations");
    } catch (error) {
      console.error("Failed to list Claude installations:", error);
      throw error;
    }
  },

  // Storage API methods

  /**
   * Lists all tables in the SQLite database
   * @returns Promise resolving to an array of table information
   */
  async storageListTables(): Promise<any[]> {
    try {
      return await invoke<any[]>("storage_list_tables");
    } catch (error) {
      console.error("Failed to list tables:", error);
      throw error;
    }
  },

  /**
   * Reads table data with pagination
   * @param tableName - Name of the table to read
   * @param page - Page number (1-indexed)
   * @param pageSize - Number of rows per page
   * @param searchQuery - Optional search query
   * @returns Promise resolving to table data with pagination info
   */
  async storageReadTable(
    tableName: string,
    page: number,
    pageSize: number,
    searchQuery?: string
  ): Promise<any> {
    try {
      return await invoke<any>("storage_read_table", {
        tableName,
        page,
        pageSize,
        searchQuery,
      });
    } catch (error) {
      console.error("Failed to read table:", error);
      throw error;
    }
  },

  /**
   * Updates a row in a table
   * @param tableName - Name of the table
   * @param primaryKeyValues - Map of primary key column names to values
   * @param updates - Map of column names to new values
   * @returns Promise resolving when the row is updated
   */
  async storageUpdateRow(
    tableName: string,
    primaryKeyValues: Record<string, any>,
    updates: Record<string, any>
  ): Promise<void> {
    try {
      return await invoke<void>("storage_update_row", {
        tableName,
        primaryKeyValues,
        updates,
      });
    } catch (error) {
      console.error("Failed to update row:", error);
      throw error;
    }
  },

  /**
   * Deletes a row from a table
   * @param tableName - Name of the table
   * @param primaryKeyValues - Map of primary key column names to values
   * @returns Promise resolving when the row is deleted
   */
  async storageDeleteRow(
    tableName: string,
    primaryKeyValues: Record<string, any>
  ): Promise<void> {
    try {
      return await invoke<void>("storage_delete_row", {
        tableName,
        primaryKeyValues,
      });
    } catch (error) {
      console.error("Failed to delete row:", error);
      throw error;
    }
  },

  /**
   * Inserts a new row into a table
   * @param tableName - Name of the table
   * @param values - Map of column names to values
   * @returns Promise resolving to the last insert row ID
   */
  async storageInsertRow(
    tableName: string,
    values: Record<string, any>
  ): Promise<number> {
    try {
      return await invoke<number>("storage_insert_row", {
        tableName,
        values,
      });
    } catch (error) {
      console.error("Failed to insert row:", error);
      throw error;
    }
  },

  /**
   * Executes a raw SQL query
   * @param query - SQL query string
   * @returns Promise resolving to query result
   */
  async storageExecuteSql(query: string): Promise<any> {
    try {
      return await invoke<any>("storage_execute_sql", { query });
    } catch (error) {
      console.error("Failed to execute SQL:", error);
      throw error;
    }
  },

  /**
   * Resets the entire database
   * @returns Promise resolving when the database is reset
   */
  async storageResetDatabase(): Promise<void> {
    try {
      return await invoke<void>("storage_reset_database");
    } catch (error) {
      console.error("Failed to reset database:", error);
      throw error;
    }
  },

  // Theme settings helpers

  /**
   * Gets a setting from the app_settings table
   * @param key - The setting key to retrieve
   * @returns Promise resolving to the setting value or null if not found
   */
  async getSetting(key: string): Promise<string | null> {
    try {
      // Use storageReadTable to safely query the app_settings table
      const result = await this.storageReadTable('app_settings', 1, 1000);
      const setting = result?.data?.find((row: any) => row.key === key);
      return setting?.value || null;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return null;
    }
  },

  /**
   * Saves a setting to the app_settings table (insert or update)
   * @param key - The setting key
   * @param value - The setting value
   * @returns Promise resolving when the setting is saved
   */
  async saveSetting(key: string, value: string): Promise<void> {
    try {
      // Try to update first
      try {
        await this.storageUpdateRow(
          'app_settings',
          { key },
          { value }
        );
      } catch (updateError) {
        // If update fails (row doesn't exist), insert new row
        await this.storageInsertRow('app_settings', { key, value });
      }
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      throw error;
    }
  },

  /**
   * Get hooks configuration for a specific scope
   * @param scope - The configuration scope: 'user', 'project', or 'local'
   * @param projectPath - Project path (required for project and local scopes)
   * @returns Promise resolving to the hooks configuration
   */
  async getHooksConfig(scope: 'user' | 'project' | 'local', projectPath?: string): Promise<HooksConfiguration> {
    try {
      return await invoke<HooksConfiguration>("get_hooks_config", { scope, projectPath });
    } catch (error) {
      console.error("Failed to get hooks config:", error);
      throw error;
    }
  },

  /**
   * Update hooks configuration for a specific scope
   * @param scope - The configuration scope: 'user', 'project', or 'local'
   * @param hooks - The hooks configuration to save
   * @param projectPath - Project path (required for project and local scopes)
   * @returns Promise resolving to success message
   */
  async updateHooksConfig(
    scope: 'user' | 'project' | 'local',
    hooks: HooksConfiguration,
    projectPath?: string
  ): Promise<string> {
    try {
      return await invoke<string>("update_hooks_config", { scope, projectPath, hooks });
    } catch (error) {
      console.error("Failed to update hooks config:", error);
      throw error;
    }
  },

  /**
   * Validate a hook command syntax
   * @param command - The shell command to validate
   * @returns Promise resolving to validation result
   */
  async validateHookCommand(command: string): Promise<{ valid: boolean; message: string }> {
    try {
      return await invoke<{ valid: boolean; message: string }>("validate_hook_command", { command });
    } catch (error) {
      console.error("Failed to validate hook command:", error);
      throw error;
    }
  },

  /**
   * Get merged hooks configuration (respecting priority)
   * @param projectPath - The project path
   * @returns Promise resolving to merged hooks configuration
   */
  async getMergedHooksConfig(projectPath: string): Promise<HooksConfiguration> {
    try {
      const [userHooks, projectHooks, localHooks] = await Promise.all([
        this.getHooksConfig('user'),
        this.getHooksConfig('project', projectPath),
        this.getHooksConfig('local', projectPath)
      ]);

      // Import HooksManager for merging
      const { HooksManager } = await import('@/lib/hooksManager');
      return HooksManager.mergeConfigs(userHooks, projectHooks, localHooks);
    } catch (error) {
      console.error("Failed to get merged hooks config:", error);
      throw error;
    }
  },

  // Slash Commands API methods

  /**
   * Lists all available slash commands
   * @param projectPath - Optional project path to include project-specific commands
   * @returns Promise resolving to array of slash commands
   */
  async slashCommandsList(projectPath?: string): Promise<SlashCommand[]> {
    try {
      return await invoke<SlashCommand[]>("slash_commands_list", { projectPath });
    } catch (error) {
      console.error("Failed to list slash commands:", error);
      throw error;
    }
  },

  /**
   * Gets a single slash command by ID
   * @param commandId - Unique identifier of the command
   * @returns Promise resolving to the slash command
   */
  async slashCommandGet(commandId: string): Promise<SlashCommand> {
    try {
      return await invoke<SlashCommand>("slash_command_get", { commandId });
    } catch (error) {
      console.error("Failed to get slash command:", error);
      throw error;
    }
  },

  /**
   * Creates or updates a slash command
   * @param scope - Command scope: "project" or "user"
   * @param name - Command name (without prefix)
   * @param namespace - Optional namespace for organization
   * @param content - Markdown content of the command
   * @param description - Optional description
   * @param allowedTools - List of allowed tools for this command
   * @param projectPath - Required for project scope commands
   * @returns Promise resolving to the saved command
   */
  async slashCommandSave(
    scope: string,
    name: string,
    namespace: string | undefined,
    content: string,
    description: string | undefined,
    allowedTools: string[],
    projectPath?: string
  ): Promise<SlashCommand> {
    try {
      return await invoke<SlashCommand>("slash_command_save", {
        scope,
        name,
        namespace,
        content,
        description,
        allowedTools,
        projectPath
      });
    } catch (error) {
      console.error("Failed to save slash command:", error);
      throw error;
    }
  },

  /**
   * Deletes a slash command
   * @param commandId - Unique identifier of the command to delete
   * @param projectPath - Optional project path for deleting project commands
   * @returns Promise resolving to deletion message
   */
  async slashCommandDelete(commandId: string, projectPath?: string): Promise<string> {
    try {
      return await invoke<string>("slash_command_delete", { commandId, projectPath });
    } catch (error) {
      console.error("Failed to delete slash command:", error);
      throw error;
    }
  },

  /**
   * Executes a slash command by routing it to Claude Code CLI
   * @param command - The slash command to execute
   * @param args - Arguments to substitute in the command
   * @param projectPath - Working directory for the command
   * @param model - Optional model to use for execution
   * @returns Promise resolving when execution starts (not when complete)
   */
  async executeClaudeSlashCommand(
    command: SlashCommand,
    args: string,
    projectPath: string,
    model?: string
  ): Promise<void> {
    try {
      return await invoke<void>("execute_claude_slash_command", {
        command,
        arguments: args,
        projectPath,
        model: model || null
      });
    } catch (error) {
      console.error("Failed to execute slash command:", error);
      throw error;
    }
  },

  // Image handling API methods

  /**
   * Saves a base64 image to a temporary file
   * @param base64Data - The base64 encoded image data (with or without data: prefix)
   * @param mimeType - Optional mime type if not included in data URL
   * @returns Promise resolving to the saved image info
   */
  async saveBase64Image(
    base64Data: string,
    mimeType?: string
  ): Promise<{ path: string; filename: string }> {
    try {
      return await invoke<{ path: string; filename: string }>("save_base64_image", {
        base64Data,
        mimeType
      });
    } catch (error) {
      console.error("Failed to save base64 image:", error);
      throw error;
    }
  },

  /**
   * Cleans up old temporary images (older than 24 hours)
   * @returns Promise resolving to the number of files cleaned up
   */
  async cleanupTempImages(): Promise<number> {
    try {
      return await invoke<number>("cleanup_temp_images");
    } catch (error) {
      console.error("Failed to cleanup temp images:", error);
      throw error;
    }
  },

  // Dashboard API methods

  /**
   * Gets dashboard summary for a project
   * @param projectId - The project ID to get dashboard data for
   * @returns Promise resolving to dashboard summary
   */
  async dashboardGetSummary(projectId: string): Promise<DashboardSummary> {
    try {
      return await invoke<DashboardSummary>("dashboard_get_summary", { projectId });
    } catch (error) {
      console.error("Failed to get dashboard summary:", error);
      
      // In production, try to recover from project not found errors
      if (error instanceof Error && (
        error.message.includes("Project not found") || 
        error.message.includes("Invalid project path") ||
        error.message.includes("Path does not exist")
      )) {
        console.warn("Project not found, attempting to recover...");
        
        try {
          // Try to get current working project
          const workingProject = await this.getCurrentWorkingProject();
          if (workingProject && workingProject.id === projectId) {
            console.log("Found working project, re-creating if needed...");
            await this.createProjectIfNotExists(workingProject.path, workingProject.name);
            
            // Retry the dashboard summary after re-creating project
            return await invoke<DashboardSummary>("dashboard_get_summary", { projectId });
          }
        } catch (recoveryError) {
          console.error("Failed to recover from project not found error:", recoveryError);
        }
      }
      
      throw error;
    }
  },

  /**
   * Analyzes a project and updates dashboard metrics
   * @param projectId - The project ID to analyze
   * @param projectPath - The absolute path to the project
   * @returns Promise resolving to analysis result message
   */
  async dashboardAnalyzeProject(projectId: string, projectPath: string): Promise<string> {
    try {
      return await invoke<string>("dashboard_analyze_project", { projectId, projectPath });
    } catch (error) {
      console.error("Failed to analyze project:", error);
      throw error;
    }
  },

  /**
   * Seeds the dashboard with sample data for demonstration
   * @param projectId - The project ID to seed data for
   * @returns Promise resolving to success message
   */
  async dashboardSeedData(projectId: string): Promise<string> {
    try {
      return await invoke<string>("dashboard_seed_data", { projectId });
    } catch (error) {
      console.error("Failed to seed dashboard data:", error);
      throw error;
    }
  },

  /**
   * Updates a project health metric
   * @param metric - The health metric to update
   * @returns Promise resolving to the metric ID
   */
  async dashboardUpdateHealthMetric(metric: ProjectHealthMetric): Promise<number> {
    try {
      return await invoke<number>("dashboard_update_health_metric", { metric });
    } catch (error) {
      console.error("Failed to update health metric:", error);
      throw error;
    }
  },

  /**
   * Updates or creates a feature
   * @param feature - The feature to update or create
   * @returns Promise resolving to the feature ID
   */
  async dashboardUpdateFeature(feature: FeatureItem): Promise<number> {
    try {
      return await invoke<number>("dashboard_update_feature", { feature });
    } catch (error) {
      console.error("Failed to update feature:", error);
      throw error;
    }
  },

  // Claude Sync API methods

  /**
   * Sync Claude commands from CLI
   * @returns Promise resolving to sync result
   */
  async syncClaudeCommands(): Promise<ClaudeSyncResult> {
    try {
      return await invoke<ClaudeSyncResult>("sync_claude_commands");
    } catch (error) {
      console.error("Failed to sync Claude commands:", error);
      throw error;
    }
  },

  /**
   * Get current Claude sync state
   * @returns Promise resolving to sync state
   */
  async getClaudeSyncState(): Promise<ClaudeSyncState> {
    try {
      return await invoke<ClaudeSyncState>("get_claude_sync_state");
    } catch (error) {
      console.error("Failed to get Claude sync state:", error);
      throw error;
    }
  },

  /**
   * Enable or disable Claude sync
   * @param enabled - Whether to enable sync
   * @returns Promise resolving to enabled state
   */
  async setClaudeSyncEnabled(enabled: boolean): Promise<boolean> {
    try {
      return await invoke<boolean>("set_claude_sync_enabled", { enabled });
    } catch (error) {
      console.error("Failed to set Claude sync enabled:", error);
      throw error;
    }
  },

  /**
   * Get synced Claude commands
   * @returns Promise resolving to array of slash commands
   */
  async getSyncedClaudeCommands(): Promise<SlashCommand[]> {
    try {
      return await invoke<SlashCommand[]>("get_synced_claude_commands");
    } catch (error) {
      console.error("Failed to get synced Claude commands:", error);
      throw error;
    }
  },

  /**
   * Check if Claude CLI is available
   * @returns Promise resolving to availability status
   */
  async checkClaudeAvailability(): Promise<boolean> {
    try {
      return await invoke<boolean>("check_claude_availability");
    } catch (error) {
      console.error("Failed to check Claude availability:", error);
      throw error;
    }
  },

  /**
   * Set automatic sync interval
   * @param hours - Sync interval in hours
   * @returns Promise resolving to the set interval
   */
  async setClaudeSyncInterval(hours: number): Promise<number> {
    try {
      return await invoke<number>("set_claude_sync_interval", { hours });
    } catch (error) {
      console.error("Failed to set Claude sync interval:", error);
      throw error;
    }
  },

  /**
   * Force refresh Claude commands (clears cache)
   * @returns Promise resolving to sync result
   */
  async forceRefreshClaudeCommands(): Promise<ClaudeSyncResult> {
    try {
      return await invoke<ClaudeSyncResult>("force_refresh_claude_commands");
    } catch (error) {
      console.error("Failed to force refresh Claude commands:", error);
      throw error;
    }
  },

  /**
   * Get next scheduled sync time
   * @returns Promise resolving to next sync timestamp or null
   */
  async getNextSyncTime(): Promise<number | null> {
    try {
      return await invoke<number | null>("get_next_sync_time");
    } catch (error) {
      console.error("Failed to get next sync time:", error);
      throw error;
    }
  },

  // Dashboard Utils
  /**
   * Get the current working directory project if it exists
   * @returns Promise resolving to the current project or null
   */
  async getCurrentWorkingProject(): Promise<Project | null> {
    try {
      return await invoke<Project | null>('get_current_working_project');
    } catch (error) {
      console.error("Failed to get current working project:", error);
      throw error;
    }
  },

  /**
   * Get recent projects sorted by last access time
   * @param limit - Maximum number of projects to return
   * @returns Promise resolving to an array of recent projects
   */
  async getRecentProjects(limit: number = 10): Promise<Project[]> {
    try {
      return await invoke<Project[]>('get_recent_projects', { limit });
    } catch (error) {
      console.error("Failed to get recent projects:", error);
      throw error;
    }
  },

  /**
   * Create a project if it doesn't exist
   * @param path - The project path
   * @param name - Optional project name
   * @returns Promise resolving to the project
   */
  async createProjectIfNotExists(path: string, name?: string): Promise<Project> {
    try {
      return await invoke<Project>('create_project_if_not_exists', { path, name });
    } catch (error) {
      console.error("Failed to create project:", error);
      throw error;
    }
  },

  // Gemini API methods

  /**
   * Check if Gemini API key is set
   * @returns Promise resolving to whether the API key is set
   */
  async hasGeminiApiKey(): Promise<boolean> {
    try {
      return await invoke<boolean>('has_gemini_api_key');
    } catch (error) {
      console.error("Failed to check Gemini API key:", error);
      throw error;
    }
  },

  /**
   * Get the Gemini API key from storage
   * @returns Promise resolving to the API key or empty string if not set
   */
  async getGeminiApiKey(): Promise<string> {
    try {
      return await invoke<string>('get_gemini_api_key_command');
    } catch (error) {
      console.error("Failed to get Gemini API key:", error);
      return "";
    }
  },

  /**
   * Set the Gemini API key
   * @param apiKey - The API key to set
   * @returns Promise resolving when the key is saved
   */
  async setGeminiApiKey(apiKey: string): Promise<void> {
    try {
      // Validate API key format
      if (!apiKey?.trim()) {
        throw new Error('API key cannot be empty');
      }
      if (!apiKey.startsWith('AIza')) {
        throw new Error('Invalid Gemini API key format. Keys should start with "AIza"');
      }
      
      return await invoke<void>('set_gemini_api_key', { apiKey: apiKey.trim() });
    } catch (error) {
      console.error("Failed to set Gemini API key:", error);
      throw error;
    }
  },

  /**
   * Verify a Gemini API key by making a test request
   * @param apiKey - The API key to verify
   * @returns Promise resolving to whether the key is valid
   */
  async verifyGeminiApiKey(apiKey: string): Promise<boolean> {
    try {
      return await invoke<boolean>('verify_gemini_api_key', { apiKey });
    } catch (error) {
      console.error("Failed to verify Gemini API key:", error);
      throw error;
    }
  },

  /**
   * Execute Gemini model with enhanced error handling and validation
   * @param prompt - The prompt to send
   * @param model - The Gemini model ID
   * @param projectPath - The project path
   * @param options - Optional execution options
   * @returns Promise resolving when execution starts
   */
  async executeGeminiCode(
    prompt: string,
    model: string,
    projectPath: string,
    options?: Partial<GeminiRequest>
  ): Promise<void> {
    try {
      // Build and validate request
      const request: GeminiRequest = {
        prompt: prompt.trim(),
        model: model.trim(),
        ...options
      };
      
      validateGeminiRequest(request);
      
      // Validate project path
      if (!projectPath?.trim()) {
        throw new GeminiError(
          GeminiErrorCode.UNKNOWN_ERROR,
          'Project path must be specified'
        );
      }
      
      return await invoke<void>('execute_gemini_code', { 
        prompt: request.prompt,
        model: request.model,
        projectPath: projectPath.trim(),
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        topK: request.topK,
        topP: request.topP,
        stopSequences: request.stopSequences,
        systemInstruction: request.systemInstruction
      });
    } catch (error) {
      console.error("Failed to execute Gemini code:", error);
      
      // Transform error to typed error if needed
      if (error instanceof Error && !isGeminiError(error)) {
        throw new GeminiError(
          GeminiErrorCode.UNKNOWN_ERROR,
          error.message,
          undefined,
          error
        );
      }
      
      throw error;
    }
  },

  /**
   * Execute Gemini model with streaming support (future enhancement)
   * @param prompt - The prompt to send
   * @param model - The Gemini model ID  
   * @param projectPath - The project path
   * @param options - Optional execution options
   * @returns AsyncIterable for streaming responses
   */
  async *streamGeminiCode(
    prompt: string,
    model: string,
    projectPath: string,
    options?: Partial<GeminiRequest>
  ): AsyncIterable<GeminiStreamChunk> {
    // This is a placeholder for future streaming implementation
    // Currently, the Rust backend doesn't support streaming for Gemini
    throw new Error('Streaming is not yet implemented for Gemini models');
  },

  /**
   * Get Gemini model capabilities and metadata
   * @param modelId - The model ID to query
   * @returns Promise resolving to model capabilities
   */
  async getGeminiModelCapabilities(modelId: string): Promise<{
    supportsStreaming: boolean;
    supportsTools: boolean;
    supportsSystemInstructions: boolean;
    maxInputTokens: number;
    maxOutputTokens: number;
    supportedImageTypes: string[];
  }> {
    // Model capability mapping
    const capabilities = {
      'gemini-2.0-flash-exp': {
        supportsStreaming: true,
        supportsTools: true,
        supportsSystemInstructions: true,
        maxInputTokens: 1048576,
        maxOutputTokens: 8192,
        supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
      },
      'gemini-exp-1206': {
        supportsStreaming: true,
        supportsTools: true,
        supportsSystemInstructions: true,
        maxInputTokens: 2097152,
        maxOutputTokens: 8192,
        supportedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
      }
    };

    const capability = capabilities[modelId as keyof typeof capabilities];
    if (!capability) {
      throw new GeminiError(
        GeminiErrorCode.MODEL_NOT_SUPPORTED,
        `Unknown model: ${modelId}`
      );
    }

    return capability;
  },

  /**
   * Validate Gemini configuration including API key
   * @returns Promise resolving to validation result
   */
  async validateGeminiConfig(): Promise<{
    isValid: boolean;
    hasApiKey: boolean;
    isKeyValid?: boolean;
    error?: string;
  }> {
    try {
      const hasApiKey = await this.hasGeminiApiKey();
      if (!hasApiKey) {
        return {
          isValid: false,
          hasApiKey: false,
          error: 'Gemini API key is not configured'
        };
      }

      // Try to verify the key
      const apiKey = await this.getGeminiApiKey();
      if (!apiKey) {
        return {
          isValid: false,
          hasApiKey: false,
          error: 'Failed to retrieve API key'
        };
      }

      const isKeyValid = await this.verifyGeminiApiKey(apiKey);
      return {
        isValid: isKeyValid,
        hasApiKey: true,
        isKeyValid,
        error: isKeyValid ? undefined : 'API key verification failed'
      };
    } catch (error) {
      return {
        isValid: false,
        hasApiKey: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Send a message using Gemini API
   * @param request - The Gemini request containing prompt, model, etc.
   * @returns Promise resolving to the Gemini response
   */
  async sendGeminiMessage(request: GeminiRequest): Promise<GeminiResponse> {
    try {
      // Validate request
      validateGeminiRequest(request);
      
      // Check if API key is configured
      const hasApiKey = await this.hasGeminiApiKey();
      if (!hasApiKey) {
        throw new GeminiError(
          GeminiErrorCode.API_KEY_MISSING,
          'Gemini API key is not configured'
        );
      }
      
      // Send chat message through our new backend function
      const response = await invoke<any>('send_gemini_chat_message', {
        request: {
          prompt: request.prompt,
          model: request.model,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          systemInstruction: request.systemInstruction
        }
      });
      
      // Convert backend response to our GeminiResponse format
      const geminiResponse: GeminiResponse = {
        text: response.text,
        finishReason: response.finish_reason || 'STOP',
        safetyRatings: response.safety_ratings || [],
        usageMetadata: response.usage_metadata || {}
      };
      
      // Validate response
      validateGeminiResponse(geminiResponse);
      
      return geminiResponse;
    } catch (error) {
      console.error("Failed to send Gemini message:", error);
      
      // Transform error to typed error if needed
      if (error instanceof Error && !isGeminiError(error)) {
        throw new GeminiError(
          GeminiErrorCode.UNKNOWN_ERROR,
          error.message,
          undefined,
          error
        );
      }
      
      throw error;
    }
  },

  /**
   * Get auto model recommendation based on task analysis
   * @param prompt - The user prompt to analyze
   * @returns Promise resolving to model recommendation
   */
  async getAutoModelRecommendation(prompt: string): Promise<{
    recommended_model: string;
    confidence: number;
    reasoning: string;
    alternative_models: string[];
    selection_criteria: {
      context_weight: number;
      intelligence_weight: number;
      speed_weight: number;
      cost_weight: number;
    };
  }> {
    try {
      return await invoke('get_auto_model_recommendation', { prompt });
    } catch (error) {
      console.error('Failed to get auto model recommendation:', error);
      throw error;
    }
  },

  /**
   * Analyze task requirements without recommending a model
   * @param prompt - The user prompt to analyze
   * @returns Promise resolving to task analysis
   */
  async analyzeTaskRequirements(prompt: string): Promise<{
    text_length: number;
    complexity_score: number;
    task_type: string;
    context_requirements: {
      needs_large_context: boolean;
      estimated_tokens: number;
      has_multiple_files: boolean;
      context_score: number;
    };
    intelligence_requirements: {
      needs_reasoning: boolean;
      needs_creativity: boolean;
      needs_precision: boolean;
      intelligence_score: number;
    };
  }> {
    try {
      return await invoke('analyze_task_requirements', { prompt });
    } catch (error) {
      console.error('Failed to analyze task requirements:', error);
      throw error;
    }
  }
};
