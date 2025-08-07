use anyhow::{Context as AnyhowContext, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tauri::State;
use uuid::Uuid;
use log::{debug, error, info, warn};

use super::agents::AgentDb;
use super::session_manager::{SessionMessage, SessionMetadata};

/// Universal context format that all models can understand
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalContext {
    /// Unique context ID
    pub id: String,
    /// Session ID this context belongs to
    pub session_id: String,
    /// Project ID
    pub project_id: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    /// Current work context
    pub current_work: WorkContext,
    /// References and knowledge
    pub references: ReferenceLibrary,
    /// Future plans and tasks
    pub future_plans: FuturePlans,
    /// Model-specific metadata
    pub model_metadata: HashMap<String, JsonValue>,
    /// Shared memory across sessions
    pub shared_memory: SharedMemory,
    /// Task continuity information
    pub task_continuity: TaskContinuity,
}

/// Current work context that needs to be preserved
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkContext {
    /// Current task description
    pub current_task: Option<String>,
    /// Active files being worked on
    pub active_files: Vec<FileContext>,
    /// Current code changes
    pub code_changes: Vec<CodeChange>,
    /// Decision context and rationale
    pub decisions: Vec<Decision>,
    /// Current model being used
    pub current_model: String,
    /// Work state (in_progress, completed, blocked, etc.)
    pub work_state: String,
    /// Progress percentage (0-100)
    pub progress: u8,
}

/// File context information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContext {
    pub path: String,
    pub content_hash: String,
    pub last_modified: DateTime<Utc>,
    pub relevant_sections: Vec<CodeSection>,
    pub pending_changes: Vec<String>,
}

/// Code section reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSection {
    pub start_line: u32,
    pub end_line: u32,
    pub purpose: String,
    pub dependencies: Vec<String>,
}

/// Code change tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChange {
    pub file_path: String,
    pub change_type: String, // add, modify, delete
    pub description: String,
    pub before: Option<String>,
    pub after: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub model_used: String,
}

/// Decision tracking for context preservation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Decision {
    pub id: String,
    pub decision: String,
    pub rationale: String,
    pub alternatives_considered: Vec<String>,
    pub timestamp: DateTime<Utc>,
    pub model_used: String,
    pub confidence: f32, // 0.0 to 1.0
}

/// Reference library for shared knowledge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceLibrary {
    /// Code patterns discovered
    pub code_patterns: Vec<CodePattern>,
    /// Documentation references
    pub documentation: Vec<Documentation>,
    /// External resources
    pub external_resources: Vec<ExternalResource>,
    /// Learned constraints and rules
    pub constraints: Vec<Constraint>,
    /// Error patterns and solutions
    pub error_solutions: HashMap<String, String>,
}

/// Code pattern reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodePattern {
    pub id: String,
    pub name: String,
    pub description: String,
    pub example: String,
    pub usage_count: u32,
    pub files_used_in: Vec<String>,
    pub discovered_by: String, // model that discovered it
    pub timestamp: DateTime<Utc>,
}

/// Documentation reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Documentation {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub relevance_score: f32,
    pub added_by: String, // model that added it
    pub timestamp: DateTime<Utc>,
}

/// External resource reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalResource {
    pub url: String,
    pub title: String,
    pub summary: String,
    pub resource_type: String, // api_doc, tutorial, stack_overflow, etc.
    pub relevance_score: f32,
    pub added_by: String,
    pub timestamp: DateTime<Utc>,
}

/// Constraint or rule learned
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Constraint {
    pub id: String,
    pub rule: String,
    pub context: String,
    pub priority: u8, // 1-10
    pub discovered_by: String,
    pub timestamp: DateTime<Utc>,
}

/// Future plans and tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuturePlans {
    /// Planned tasks
    pub tasks: Vec<PlannedTask>,
    /// Dependencies between tasks
    pub dependencies: HashMap<String, Vec<String>>,
    /// Milestones
    pub milestones: Vec<Milestone>,
    /// Risk assessments
    pub risks: Vec<Risk>,
}

/// Planned task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedTask {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: u8, // 1-10
    pub estimated_effort: String, // e.g., "2 hours", "1 day"
    pub assigned_to: Option<String>, // which model is best suited
    pub status: String, // planned, in_progress, completed, blocked
    pub created_by: String,
    pub timestamp: DateTime<Utc>,
}

/// Project milestone
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub id: String,
    pub name: String,
    pub description: String,
    pub target_date: Option<DateTime<Utc>>,
    pub tasks: Vec<String>, // task IDs
    pub status: String,
    pub created_by: String,
}

/// Risk assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Risk {
    pub id: String,
    pub description: String,
    pub impact: String, // low, medium, high, critical
    pub likelihood: String, // unlikely, possible, likely, certain
    pub mitigation: String,
    pub identified_by: String,
    pub timestamp: DateTime<Utc>,
}

/// Shared memory across sessions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedMemory {
    /// Project-wide facts
    pub facts: HashMap<String, String>,
    /// User preferences
    pub preferences: HashMap<String, JsonValue>,
    /// Glossary of terms
    pub glossary: HashMap<String, String>,
    /// Project conventions
    pub conventions: Vec<Convention>,
    /// Team information
    pub team_info: TeamInfo,
}

/// Project convention
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Convention {
    pub category: String, // naming, formatting, architecture, etc.
    pub rule: String,
    pub examples: Vec<String>,
    pub established_by: String,
    pub timestamp: DateTime<Utc>,
}

/// Team information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamInfo {
    pub members: Vec<TeamMember>,
    pub communication_style: String,
    pub working_hours: Option<String>,
    pub preferred_tools: Vec<String>,
}

/// Team member information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMember {
    pub name: String,
    pub role: String,
    pub expertise: Vec<String>,
    pub contact: Option<String>,
}

/// Task continuity for seamless handoff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskContinuity {
    /// Current execution context
    pub execution_context: ExecutionContext,
    /// Checkpoints for resumption
    pub checkpoints: Vec<Checkpoint>,
    /// Pending operations
    pub pending_operations: Vec<PendingOperation>,
    /// Model handoff notes
    pub handoff_notes: Vec<HandoffNote>,
}

/// Execution context for task continuation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub current_step: u32,
    pub total_steps: u32,
    pub variables: HashMap<String, JsonValue>,
    pub loop_counters: HashMap<String, u32>,
    pub error_recovery_state: Option<String>,
}

/// Checkpoint for task resumption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub name: String,
    pub state: JsonValue,
    pub can_resume_from: bool,
    pub timestamp: DateTime<Utc>,
    pub created_by: String,
}

/// Pending operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOperation {
    pub id: String,
    pub operation_type: String,
    pub parameters: JsonValue,
    pub prerequisites: Vec<String>,
    pub can_be_delegated: bool,
    pub preferred_model: Option<String>,
}

/// Handoff note between models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandoffNote {
    pub from_model: String,
    pub to_model: Option<String>, // None means any model
    pub note: String,
    pub priority: u8,
    pub timestamp: DateTime<Utc>,
}

/// Intelligence Bridge for cross-model context sharing
pub struct IntelligenceBridge {
    contexts: Arc<Mutex<HashMap<String, UniversalContext>>>,
}

impl IntelligenceBridge {
    pub fn new() -> Self {
        Self {
            contexts: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Create a new universal context
    pub fn create_context(
        &self,
        session_id: &str,
        project_id: &str,
        model: &str,
    ) -> Result<UniversalContext> {
        let context = UniversalContext {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            project_id: project_id.to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            current_work: WorkContext {
                current_task: None,
                active_files: Vec::new(),
                code_changes: Vec::new(),
                decisions: Vec::new(),
                current_model: model.to_string(),
                work_state: "initialized".to_string(),
                progress: 0,
            },
            references: ReferenceLibrary {
                code_patterns: Vec::new(),
                documentation: Vec::new(),
                external_resources: Vec::new(),
                constraints: Vec::new(),
                error_solutions: HashMap::new(),
            },
            future_plans: FuturePlans {
                tasks: Vec::new(),
                dependencies: HashMap::new(),
                milestones: Vec::new(),
                risks: Vec::new(),
            },
            model_metadata: HashMap::new(),
            shared_memory: SharedMemory {
                facts: HashMap::new(),
                preferences: HashMap::new(),
                glossary: HashMap::new(),
                conventions: Vec::new(),
                team_info: TeamInfo {
                    members: Vec::new(),
                    communication_style: "professional".to_string(),
                    working_hours: None,
                    preferred_tools: Vec::new(),
                },
            },
            task_continuity: TaskContinuity {
                execution_context: ExecutionContext {
                    current_step: 0,
                    total_steps: 0,
                    variables: HashMap::new(),
                    loop_counters: HashMap::new(),
                    error_recovery_state: None,
                },
                checkpoints: Vec::new(),
                pending_operations: Vec::new(),
                handoff_notes: Vec::new(),
            },
        };
        
        let mut contexts = self.contexts.lock().unwrap();
        contexts.insert(session_id.to_string(), context.clone());
        
        Ok(context)
    }
    
    /// Update context with new information
    pub fn update_context(
        &self,
        session_id: &str,
        updates: ContextUpdate,
    ) -> Result<()> {
        let mut contexts = self.contexts.lock().unwrap();
        
        if let Some(context) = contexts.get_mut(session_id) {
            // Apply updates based on update type
            match updates {
                ContextUpdate::WorkProgress { task, state, progress } => {
                    if let Some(task) = task {
                        context.current_work.current_task = Some(task);
                    }
                    if let Some(state) = state {
                        context.current_work.work_state = state;
                    }
                    if let Some(progress) = progress {
                        context.current_work.progress = progress;
                    }
                }
                ContextUpdate::AddCodeChange { change } => {
                    context.current_work.code_changes.push(change);
                }
                ContextUpdate::AddDecision { decision } => {
                    context.current_work.decisions.push(decision);
                }
                ContextUpdate::AddPattern { pattern } => {
                    context.references.code_patterns.push(pattern);
                }
                ContextUpdate::AddTask { task } => {
                    context.future_plans.tasks.push(task);
                }
                ContextUpdate::AddCheckpoint { checkpoint } => {
                    context.task_continuity.checkpoints.push(checkpoint);
                }
                ContextUpdate::AddHandoffNote { note } => {
                    context.task_continuity.handoff_notes.push(note);
                }
                ContextUpdate::UpdateExecutionContext { execution_context } => {
                    context.task_continuity.execution_context = execution_context;
                }
                ContextUpdate::AddConstraint { constraint } => {
                    context.references.constraints.push(constraint);
                }
                ContextUpdate::AddFact { key, value } => {
                    context.shared_memory.facts.insert(key, value);
                }
            }
            
            context.updated_at = Utc::now();
        } else {
            return Err(anyhow::anyhow!("Context not found for session: {}", session_id));
        }
        
        Ok(())
    }
    
    /// Get context for a session
    pub fn get_context(&self, session_id: &str) -> Option<UniversalContext> {
        let contexts = self.contexts.lock().unwrap();
        contexts.get(session_id).cloned()
    }
    
    /// Transfer context between models
    pub fn transfer_context(
        &self,
        from_session: &str,
        to_session: &str,
        to_model: &str,
    ) -> Result<UniversalContext> {
        let mut contexts = self.contexts.lock().unwrap();
        
        // Get the source context
        let source_context = contexts
            .get(from_session)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Source context not found"))?;
        
        // Create new context for target session
        let mut target_context = source_context.clone();
        target_context.id = Uuid::new_v4().to_string();
        target_context.session_id = to_session.to_string();
        target_context.updated_at = Utc::now();
        target_context.current_work.current_model = to_model.to_string();
        
        // Add handoff note
        let handoff_note = HandoffNote {
            from_model: source_context.current_work.current_model.clone(),
            to_model: Some(to_model.to_string()),
            note: format!("Context transferred from session {} to {}", from_session, to_session),
            priority: 10,
            timestamp: Utc::now(),
        };
        target_context.task_continuity.handoff_notes.push(handoff_note);
        
        // Store the new context
        contexts.insert(to_session.to_string(), target_context.clone());
        
        Ok(target_context)
    }
    
    /// Merge contexts from multiple sessions
    pub fn merge_contexts(&self, session_ids: Vec<String>) -> Result<UniversalContext> {
        let contexts = self.contexts.lock().unwrap();
        
        if session_ids.is_empty() {
            return Err(anyhow::anyhow!("No sessions to merge"));
        }
        
        // Start with the first context as base
        let mut merged = contexts
            .get(&session_ids[0])
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("First session context not found"))?;
        
        merged.id = Uuid::new_v4().to_string();
        merged.updated_at = Utc::now();
        
        // Merge other contexts
        for session_id in session_ids.iter().skip(1) {
            if let Some(context) = contexts.get(session_id) {
                // Merge code changes
                merged.current_work.code_changes.extend(context.current_work.code_changes.clone());
                
                // Merge decisions
                merged.current_work.decisions.extend(context.current_work.decisions.clone());
                
                // Merge patterns (deduplicate by ID)
                for pattern in &context.references.code_patterns {
                    if !merged.references.code_patterns.iter().any(|p| p.id == pattern.id) {
                        merged.references.code_patterns.push(pattern.clone());
                    }
                }
                
                // Merge tasks
                merged.future_plans.tasks.extend(context.future_plans.tasks.clone());
                
                // Merge checkpoints
                merged.task_continuity.checkpoints.extend(context.task_continuity.checkpoints.clone());
                
                // Merge facts
                for (key, value) in &context.shared_memory.facts {
                    merged.shared_memory.facts.insert(key.clone(), value.clone());
                }
            }
        }
        
        Ok(merged)
    }
}

/// Context update types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextUpdate {
    WorkProgress {
        task: Option<String>,
        state: Option<String>,
        progress: Option<u8>,
    },
    AddCodeChange {
        change: CodeChange,
    },
    AddDecision {
        decision: Decision,
    },
    AddPattern {
        pattern: CodePattern,
    },
    AddTask {
        task: PlannedTask,
    },
    AddCheckpoint {
        checkpoint: Checkpoint,
    },
    AddHandoffNote {
        note: HandoffNote,
    },
    UpdateExecutionContext {
        execution_context: ExecutionContext,
    },
    AddConstraint {
        constraint: Constraint,
    },
    AddFact {
        key: String,
        value: String,
    },
}

/// Initialize intelligence bridge tables
pub async fn init_intelligence_tables(db: &State<'_, AgentDb>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // Create universal contexts table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS universal_contexts (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            context_data TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES chat_sessions(session_id)
        )",
        [],
    ).map_err(|e| format!("Failed to create universal_contexts table: {}", e))?;
    
    // Create context sharing history table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS context_transfers (
            id TEXT PRIMARY KEY,
            from_session TEXT NOT NULL,
            to_session TEXT NOT NULL,
            from_model TEXT NOT NULL,
            to_model TEXT NOT NULL,
            context_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(context_id) REFERENCES universal_contexts(id)
        )",
        [],
    ).map_err(|e| format!("Failed to create context_transfers table: {}", e))?;
    
    // Create shared knowledge table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS shared_knowledge (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            knowledge_type TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(project_id, knowledge_type, key)
        )",
        [],
    ).map_err(|e| format!("Failed to create shared_knowledge table: {}", e))?;
    
    // Create model collaboration table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_collaborations (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            session_ids TEXT NOT NULL, -- JSON array of session IDs
            models_involved TEXT NOT NULL, -- JSON array of models
            collaboration_type TEXT NOT NULL,
            result TEXT,
            timestamp TEXT NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create model_collaborations table: {}", e))?;
    
    // Create indexes for better performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_contexts_session ON universal_contexts(session_id)",
        [],
    ).map_err(|e| format!("Failed to create session index: {}", e))?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_contexts_project ON universal_contexts(project_id)",
        [],
    ).map_err(|e| format!("Failed to create project index: {}", e))?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_project ON shared_knowledge(project_id)",
        [],
    ).map_err(|e| format!("Failed to create knowledge index: {}", e))?;
    
    info!("Intelligence bridge tables initialized successfully");
    Ok(())
}

/// Store universal context in database
#[tauri::command]
pub async fn store_universal_context(
    context: UniversalContext,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let context_json = serde_json::to_string(&context)
        .map_err(|e| format!("Failed to serialize context: {}", e))?;
    
    conn.execute(
        "INSERT OR REPLACE INTO universal_contexts 
         (id, session_id, project_id, created_at, updated_at, context_data)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![
            context.id,
            context.session_id,
            context.project_id,
            context.created_at.to_rfc3339(),
            context.updated_at.to_rfc3339(),
            context_json
        ],
    ).map_err(|e| format!("Failed to store context: {}", e))?;
    
    Ok(())
}

/// Load universal context from database
#[tauri::command]
pub async fn load_universal_context(
    session_id: String,
    db: State<'_, AgentDb>,
) -> Result<Option<UniversalContext>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let result = conn.query_row(
        "SELECT context_data FROM universal_contexts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1",
        params![session_id],
        |row| {
            let context_json: String = row.get(0)?;
            Ok(context_json)
        },
    ).optional().map_err(|e| format!("Failed to query context: {}", e))?;
    
    if let Some(context_json) = result {
        let context: UniversalContext = serde_json::from_str(&context_json)
            .map_err(|e| format!("Failed to deserialize context: {}", e))?;
        Ok(Some(context))
    } else {
        Ok(None)
    }
}

/// Transfer context between sessions
#[tauri::command]
pub async fn transfer_context_between_sessions(
    from_session: String,
    to_session: String,
    to_model: String,
    bridge: State<'_, IntelligenceBridge>,
    db: State<'_, AgentDb>,
) -> Result<UniversalContext, String> {
    // Transfer in memory
    let context = bridge.transfer_context(&from_session, &to_session, &to_model)
        .map_err(|e| format!("Failed to transfer context: {}", e))?;
    
    // Store context first (using clone to avoid borrow issues)
    {
        let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
        let context_json = serde_json::to_string(&context)
            .map_err(|e| format!("Failed to serialize context: {}", e))?;
        
        conn.execute(
            "INSERT OR REPLACE INTO universal_contexts 
             (id, session_id, project_id, created_at, updated_at, context_data)
             VALUES (?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                context.id,
                context.session_id,
                context.project_id,
                context.created_at.to_rfc3339(),
                context.updated_at.to_rfc3339(),
                context_json
            ],
        ).map_err(|e| format!("Failed to store context: {}", e))?;
    }
    
    // Record transfer history
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    let transfer_id = Uuid::new_v4().to_string();
    
    conn.execute(
        "INSERT INTO context_transfers 
         (id, from_session, to_session, from_model, to_model, context_id, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            transfer_id,
            from_session,
            to_session,
            context.current_work.current_model,
            to_model,
            context.id,
            Utc::now().to_rfc3339()
        ],
    ).map_err(|e| format!("Failed to record transfer: {}", e))?;
    
    Ok(context)
}

/// Store shared knowledge
#[tauri::command]
pub async fn store_shared_knowledge(
    project_id: String,
    knowledge_type: String,
    key: String,
    value: String,
    created_by: String,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT OR REPLACE INTO shared_knowledge 
         (id, project_id, knowledge_type, key, value, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            Uuid::new_v4().to_string(),
            project_id,
            knowledge_type,
            key,
            value,
            created_by,
            now.clone(),
            now
        ],
    ).map_err(|e| format!("Failed to store shared knowledge: {}", e))?;
    
    Ok(())
}

/// Get shared knowledge for a project
#[tauri::command]
pub async fn get_shared_knowledge(
    project_id: String,
    knowledge_type: Option<String>,
    db: State<'_, AgentDb>,
) -> Result<HashMap<String, String>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let (query, params): (String, Vec<&dyn rusqlite::ToSql>) = if let Some(ref kt) = knowledge_type {
        (
            "SELECT key, value FROM shared_knowledge WHERE project_id = ? AND knowledge_type = ?".to_string(),
            vec![&project_id, kt]
        )
    } else {
        (
            "SELECT key, value FROM shared_knowledge WHERE project_id = ?".to_string(),
            vec![&project_id]
        )
    };
    
    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let knowledge_iter = stmt.query_map(params.as_slice(), |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| format!("Failed to query knowledge: {}", e))?;
    
    let mut knowledge = HashMap::new();
    for item in knowledge_iter {
        if let Ok((key, value)) = item {
            knowledge.insert(key, value);
        }
    }
    
    Ok(knowledge)
}

/// Record model collaboration
#[tauri::command]
pub async fn record_model_collaboration(
    project_id: String,
    session_ids: Vec<String>,
    models: Vec<String>,
    collaboration_type: String,
    result: Option<String>,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let session_ids_json = serde_json::to_string(&session_ids)
        .map_err(|e| format!("Failed to serialize session IDs: {}", e))?;
    let models_json = serde_json::to_string(&models)
        .map_err(|e| format!("Failed to serialize models: {}", e))?;
    
    conn.execute(
        "INSERT INTO model_collaborations 
         (id, project_id, session_ids, models_involved, collaboration_type, result, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            Uuid::new_v4().to_string(),
            project_id,
            session_ids_json,
            models_json,
            collaboration_type,
            result,
            Utc::now().to_rfc3339()
        ],
    ).map_err(|e| format!("Failed to record collaboration: {}", e))?;
    
    Ok(())
}

/// Get collaboration history for a project
#[tauri::command]
pub async fn get_collaboration_history(
    project_id: String,
    db: State<'_, AgentDb>,
) -> Result<Vec<JsonValue>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT * FROM model_collaborations WHERE project_id = ? ORDER BY timestamp DESC"
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let collaboration_iter = stmt.query_map(params![project_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "project_id": row.get::<_, String>(1)?,
            "session_ids": serde_json::from_str::<Vec<String>>(&row.get::<_, String>(2)?).unwrap_or_default(),
            "models_involved": serde_json::from_str::<Vec<String>>(&row.get::<_, String>(3)?).unwrap_or_default(),
            "collaboration_type": row.get::<_, String>(4)?,
            "result": row.get::<_, Option<String>>(5)?,
            "timestamp": row.get::<_, String>(6)?
        }))
    }).map_err(|e| format!("Failed to query collaborations: {}", e))?;
    
    let mut collaborations = Vec::new();
    for item in collaboration_iter {
        if let Ok(collaboration) = item {
            collaborations.push(collaboration);
        }
    }
    
    Ok(collaborations)
}