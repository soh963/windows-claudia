import { invoke } from '@tauri-apps/api/core';

/**
 * Universal context format that all models can understand
 */
export interface UniversalContext {
  id: string;
  session_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  current_work: WorkContext;
  references: ReferenceLibrary;
  future_plans: FuturePlans;
  model_metadata: Record<string, any>;
  shared_memory: SharedMemory;
  task_continuity: TaskContinuity;
}

/**
 * Current work context
 */
export interface WorkContext {
  current_task?: string;
  active_files: FileContext[];
  code_changes: CodeChange[];
  decisions: Decision[];
  current_model: string;
  work_state: string;
  progress: number;
}

/**
 * File context information
 */
export interface FileContext {
  path: string;
  content_hash: string;
  last_modified: string;
  relevant_sections: CodeSection[];
  pending_changes: string[];
}

/**
 * Code section reference
 */
export interface CodeSection {
  start_line: number;
  end_line: number;
  purpose: string;
  dependencies: string[];
}

/**
 * Code change tracking
 */
export interface CodeChange {
  file_path: string;
  change_type: string;
  description: string;
  before?: string;
  after?: string;
  timestamp: string;
  model_used: string;
}

/**
 * Decision tracking
 */
export interface Decision {
  id: string;
  decision: string;
  rationale: string;
  alternatives_considered: string[];
  timestamp: string;
  model_used: string;
  confidence: number;
}

/**
 * Reference library
 */
export interface ReferenceLibrary {
  code_patterns: CodePattern[];
  documentation: Documentation[];
  external_resources: ExternalResource[];
  constraints: Constraint[];
  error_solutions: Record<string, string>;
}

/**
 * Code pattern
 */
export interface CodePattern {
  id: string;
  name: string;
  description: string;
  example: string;
  usage_count: number;
  files_used_in: string[];
  discovered_by: string;
  timestamp: string;
}

/**
 * Documentation entry
 */
export interface Documentation {
  id: string;
  title: string;
  content: string;
  source: string;
  relevance_score: number;
  added_by: string;
  timestamp: string;
}

/**
 * External resource
 */
export interface ExternalResource {
  url: string;
  title: string;
  summary: string;
  resource_type: string;
  relevance_score: number;
  added_by: string;
  timestamp: string;
}

/**
 * Constraint or rule
 */
export interface Constraint {
  id: string;
  rule: string;
  context: string;
  priority: number;
  discovered_by: string;
  timestamp: string;
}

/**
 * Future plans
 */
export interface FuturePlans {
  tasks: PlannedTask[];
  dependencies: Record<string, string[]>;
  milestones: Milestone[];
  risks: Risk[];
}

/**
 * Planned task
 */
export interface PlannedTask {
  id: string;
  title: string;
  description: string;
  priority: number;
  estimated_effort: string;
  assigned_to?: string;
  status: string;
  created_by: string;
  timestamp: string;
}

/**
 * Project milestone
 */
export interface Milestone {
  id: string;
  name: string;
  description: string;
  target_date?: string;
  tasks: string[];
  status: string;
  created_by: string;
}

/**
 * Risk assessment
 */
export interface Risk {
  id: string;
  description: string;
  impact: string;
  likelihood: string;
  mitigation: string;
  identified_by: string;
  timestamp: string;
}

/**
 * Shared memory
 */
export interface SharedMemory {
  facts: Record<string, string>;
  preferences: Record<string, any>;
  glossary: Record<string, string>;
  conventions: Convention[];
  team_info: TeamInfo;
}

/**
 * Project convention
 */
export interface Convention {
  category: string;
  rule: string;
  examples: string[];
  established_by: string;
  timestamp: string;
}

/**
 * Team information
 */
export interface TeamInfo {
  members: TeamMember[];
  communication_style: string;
  working_hours?: string;
  preferred_tools: string[];
}

/**
 * Team member
 */
export interface TeamMember {
  name: string;
  role: string;
  expertise: string[];
  contact?: string;
}

/**
 * Task continuity
 */
export interface TaskContinuity {
  execution_context: ExecutionContext;
  checkpoints: Checkpoint[];
  pending_operations: PendingOperation[];
  handoff_notes: HandoffNote[];
}

/**
 * Execution context
 */
export interface ExecutionContext {
  current_step: number;
  total_steps: number;
  variables: Record<string, any>;
  loop_counters: Record<string, number>;
  error_recovery_state?: string;
}

/**
 * Checkpoint
 */
export interface Checkpoint {
  id: string;
  name: string;
  state: any;
  can_resume_from: boolean;
  timestamp: string;
  created_by: string;
}

/**
 * Pending operation
 */
export interface PendingOperation {
  id: string;
  operation_type: string;
  parameters: any;
  prerequisites: string[];
  can_be_delegated: boolean;
  preferred_model?: string;
}

/**
 * Handoff note
 */
export interface HandoffNote {
  from_model: string;
  to_model?: string;
  note: string;
  priority: number;
  timestamp: string;
}

/**
 * Injection configuration
 */
export interface InjectionConfig {
  auto_inject: boolean;
  compression_level: number;
  max_context_tokens: number;
  include_elements: ContextElements;
  model_adaptations: Record<string, ModelAdaptation>;
}

/**
 * Context elements to include
 */
export interface ContextElements {
  current_work: boolean;
  code_changes: boolean;
  decisions: boolean;
  references: boolean;
  future_plans: boolean;
  shared_memory: boolean;
  checkpoints: boolean;
  handoff_notes: boolean;
}

/**
 * Model adaptation settings
 */
export interface ModelAdaptation {
  format_style: string;
  emphasize_reasoning: boolean;
  include_code_blocks: boolean;
  max_tokens: number;
  temperature_adjustment: number;
}

/**
 * Injection result
 */
export interface InjectionResult {
  formatted_context: string;
  metadata: InjectionMetadata;
  warnings: string[];
}

/**
 * Injection metadata
 */
export interface InjectionMetadata {
  source_session: string;
  target_session: string;
  source_model: string;
  target_model: string;
  context_size: number;
  compression_ratio: number;
  elements_included: string[];
  timestamp: string;
}

/**
 * Intelligence Bridge API
 */
export class IntelligenceBridgeAPI {
  /**
   * Initialize intelligence bridge tables
   */
  static async initTables(): Promise<void> {
    await invoke('init_intelligence_tables');
  }

  /**
   * Store universal context
   */
  static async storeContext(context: UniversalContext): Promise<void> {
    await invoke('store_universal_context', { context });
  }

  /**
   * Load universal context for a session
   */
  static async loadContext(sessionId: string): Promise<UniversalContext | null> {
    return await invoke('load_universal_context', { sessionId });
  }

  /**
   * Transfer context between sessions
   */
  static async transferContext(
    fromSession: string,
    toSession: string,
    toModel: string
  ): Promise<UniversalContext> {
    return await invoke('transfer_context_between_sessions', {
      fromSession,
      toSession,
      toModel
    });
  }

  /**
   * Store shared knowledge
   */
  static async storeSharedKnowledge(
    projectId: string,
    knowledgeType: string,
    key: string,
    value: string,
    createdBy: string
  ): Promise<void> {
    await invoke('store_shared_knowledge', {
      projectId,
      knowledgeType,
      key,
      value,
      createdBy
    });
  }

  /**
   * Get shared knowledge for a project
   */
  static async getSharedKnowledge(
    projectId: string,
    knowledgeType?: string
  ): Promise<Record<string, string>> {
    return await invoke('get_shared_knowledge', {
      projectId,
      knowledgeType
    });
  }

  /**
   * Record model collaboration
   */
  static async recordCollaboration(
    projectId: string,
    sessionIds: string[],
    models: string[],
    collaborationType: string,
    result?: string
  ): Promise<void> {
    await invoke('record_model_collaboration', {
      projectId,
      sessionIds,
      models,
      collaborationType,
      result
    });
  }

  /**
   * Get collaboration history
   */
  static async getCollaborationHistory(projectId: string): Promise<any[]> {
    return await invoke('get_collaboration_history', { projectId });
  }

  /**
   * Create contextual prompt with injected context
   */
  static async createContextualPrompt(
    basePrompt: string,
    sessionId: string,
    targetModel: string
  ): Promise<string> {
    return await invoke('create_contextual_prompt', {
      basePrompt,
      sessionId,
      targetModel
    });
  }

  /**
   * Update injection configuration
   */
  static async updateInjectionConfig(config: InjectionConfig): Promise<void> {
    await invoke('update_injection_config', { config });
  }

  /**
   * Get injection configuration
   */
  static async getInjectionConfig(): Promise<InjectionConfig> {
    return await invoke('get_injection_config');
  }
}

/**
 * Context update helper functions
 */
export class ContextUpdateBuilder {
  static workProgress(task?: string, state?: string, progress?: number): any {
    return {
      WorkProgress: { task, state, progress }
    };
  }

  static addCodeChange(change: CodeChange): any {
    return {
      AddCodeChange: { change }
    };
  }

  static addDecision(decision: Decision): any {
    return {
      AddDecision: { decision }
    };
  }

  static addPattern(pattern: CodePattern): any {
    return {
      AddPattern: { pattern }
    };
  }

  static addTask(task: PlannedTask): any {
    return {
      AddTask: { task }
    };
  }

  static addCheckpoint(checkpoint: Checkpoint): any {
    return {
      AddCheckpoint: { checkpoint }
    };
  }

  static addHandoffNote(note: HandoffNote): any {
    return {
      AddHandoffNote: { note }
    };
  }

  static updateExecutionContext(executionContext: ExecutionContext): any {
    return {
      UpdateExecutionContext: { executionContext }
    };
  }

  static addConstraint(constraint: Constraint): any {
    return {
      AddConstraint: { constraint }
    };
  }

  static addFact(key: string, value: string): any {
    return {
      AddFact: { key, value }
    };
  }
}

/**
 * Helper function to create a default injection config
 */
export function createDefaultInjectionConfig(): InjectionConfig {
  return {
    auto_inject: true,
    compression_level: 5,
    max_context_tokens: 8000,
    include_elements: {
      current_work: true,
      code_changes: true,
      decisions: true,
      references: true,
      future_plans: true,
      shared_memory: true,
      checkpoints: true,
      handoff_notes: true
    },
    model_adaptations: {
      claude: {
        format_style: 'markdown',
        emphasize_reasoning: true,
        include_code_blocks: true,
        max_tokens: 10000,
        temperature_adjustment: 0.0
      },
      gemini: {
        format_style: 'structured',
        emphasize_reasoning: false,
        include_code_blocks: true,
        max_tokens: 8000,
        temperature_adjustment: 0.1
      },
      ollama: {
        format_style: 'concise',
        emphasize_reasoning: false,
        include_code_blocks: true,
        max_tokens: 4000,
        temperature_adjustment: 0.2
      }
    }
  };
}

export default IntelligenceBridgeAPI;