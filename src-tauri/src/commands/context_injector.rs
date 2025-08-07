use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use tauri::State;
use log::{debug, info, warn};

use super::intelligence_bridge::{
    IntelligenceBridge, UniversalContext, ContextUpdate, 
    CodeChange, Decision, HandoffNote, Checkpoint
};
use super::agents::AgentDb;

/// Context injection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectionConfig {
    /// Whether to auto-inject context on model switch
    pub auto_inject: bool,
    /// Compression level for context (0-10)
    pub compression_level: u8,
    /// Maximum context size in tokens
    pub max_context_tokens: u32,
    /// Context elements to include
    pub include_elements: ContextElements,
    /// Model-specific adaptations
    pub model_adaptations: HashMap<String, ModelAdaptation>,
}

impl Default for InjectionConfig {
    fn default() -> Self {
        Self {
            auto_inject: true,
            compression_level: 5,
            max_context_tokens: 8000,
            include_elements: ContextElements::default(),
            model_adaptations: Self::default_adaptations(),
        }
    }
}

impl InjectionConfig {
    fn default_adaptations() -> HashMap<String, ModelAdaptation> {
        let mut adaptations = HashMap::new();
        
        // Claude adaptations
        adaptations.insert("claude".to_string(), ModelAdaptation {
            format_style: "markdown".to_string(),
            emphasize_reasoning: true,
            include_code_blocks: true,
            max_tokens: 10000,
            temperature_adjustment: 0.0,
        });
        
        // Gemini adaptations
        adaptations.insert("gemini".to_string(), ModelAdaptation {
            format_style: "structured".to_string(),
            emphasize_reasoning: false,
            include_code_blocks: true,
            max_tokens: 8000,
            temperature_adjustment: 0.1,
        });
        
        // Ollama adaptations
        adaptations.insert("ollama".to_string(), ModelAdaptation {
            format_style: "concise".to_string(),
            emphasize_reasoning: false,
            include_code_blocks: true,
            max_tokens: 4000,
            temperature_adjustment: 0.2,
        });
        
        adaptations
    }
}

/// Context elements to include in injection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextElements {
    pub current_work: bool,
    pub code_changes: bool,
    pub decisions: bool,
    pub references: bool,
    pub future_plans: bool,
    pub shared_memory: bool,
    pub checkpoints: bool,
    pub handoff_notes: bool,
}

impl Default for ContextElements {
    fn default() -> Self {
        Self {
            current_work: true,
            code_changes: true,
            decisions: true,
            references: true,
            future_plans: true,
            shared_memory: true,
            checkpoints: true,
            handoff_notes: true,
        }
    }
}

/// Model-specific adaptation settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelAdaptation {
    /// Format style: markdown, structured, concise
    pub format_style: String,
    /// Whether to emphasize reasoning steps
    pub emphasize_reasoning: bool,
    /// Whether to include full code blocks
    pub include_code_blocks: bool,
    /// Maximum tokens for this model
    pub max_tokens: u32,
    /// Temperature adjustment for consistency
    pub temperature_adjustment: f32,
}

/// Context injection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectionResult {
    /// The formatted context ready for injection
    pub formatted_context: String,
    /// Metadata about the injection
    pub metadata: InjectionMetadata,
    /// Any warnings or issues
    pub warnings: Vec<String>,
}

/// Injection metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectionMetadata {
    pub source_session: String,
    pub target_session: String,
    pub source_model: String,
    pub target_model: String,
    pub context_size: usize,
    pub compression_ratio: f32,
    pub elements_included: Vec<String>,
    pub timestamp: DateTime<Utc>,
}

/// Context injector for seamless model switching
pub struct ContextInjector {
    config: InjectionConfig,
    bridge: IntelligenceBridge,
}

impl ContextInjector {
    pub fn new(config: Option<InjectionConfig>) -> Self {
        Self {
            config: config.unwrap_or_default(),
            bridge: IntelligenceBridge::new(),
        }
    }
    
    /// Prepare context for injection into a new model
    pub fn prepare_injection(
        &self,
        context: &UniversalContext,
        target_model: &str,
    ) -> Result<InjectionResult> {
        let mut warnings = Vec::new();
        let mut elements_included = Vec::new();
        
        // Get model-specific adaptation
        let adaptation = self.config.model_adaptations
            .get(target_model)
            .cloned()
            .unwrap_or_else(|| {
                warnings.push(format!("No specific adaptation for model '{}', using defaults", target_model));
                ModelAdaptation {
                    format_style: "markdown".to_string(),
                    emphasize_reasoning: false,
                    include_code_blocks: true,
                    max_tokens: 6000,
                    temperature_adjustment: 0.0,
                }
            });
        
        // Format context based on model preferences
        let formatted_context = match adaptation.format_style.as_str() {
            "markdown" => self.format_markdown(context, &adaptation, &mut elements_included),
            "structured" => self.format_structured(context, &adaptation, &mut elements_included),
            "concise" => self.format_concise(context, &adaptation, &mut elements_included),
            _ => self.format_markdown(context, &adaptation, &mut elements_included),
        };
        
        // Calculate compression ratio
        let original_size = serde_json::to_string(context).unwrap_or_default().len();
        let compressed_size = formatted_context.len();
        let compression_ratio = if original_size > 0 {
            (original_size - compressed_size) as f32 / original_size as f32
        } else {
            0.0
        };
        
        // Check token limit
        let estimated_tokens = formatted_context.len() / 4; // Rough estimate
        if estimated_tokens > adaptation.max_tokens as usize {
            warnings.push(format!(
                "Context size ({} tokens) exceeds model limit ({} tokens)",
                estimated_tokens, adaptation.max_tokens
            ));
        }
        
        Ok(InjectionResult {
            formatted_context,
            metadata: InjectionMetadata {
                source_session: context.session_id.clone(),
                target_session: context.session_id.clone(), // Will be updated on actual transfer
                source_model: context.current_work.current_model.clone(),
                target_model: target_model.to_string(),
                context_size: compressed_size,
                compression_ratio,
                elements_included,
                timestamp: Utc::now(),
            },
            warnings,
        })
    }
    
    /// Format context as markdown (preferred for Claude)
    fn format_markdown(
        &self,
        context: &UniversalContext,
        adaptation: &ModelAdaptation,
        elements_included: &mut Vec<String>,
    ) -> String {
        let mut output = String::new();
        
        // Header
        output.push_str("# Context Transfer Summary\n\n");
        output.push_str(&format!("**From Model**: {}\n", context.current_work.current_model));
        output.push_str(&format!("**Project**: {}\n", context.project_id));
        output.push_str(&format!("**Session**: {}\n\n", context.session_id));
        
        // Current Work
        if self.config.include_elements.current_work {
            output.push_str("## Current Work\n\n");
            if let Some(task) = &context.current_work.current_task {
                output.push_str(&format!("**Task**: {}\n", task));
            }
            output.push_str(&format!("**State**: {}\n", context.current_work.work_state));
            output.push_str(&format!("**Progress**: {}%\n\n", context.current_work.progress));
            elements_included.push("current_work".to_string());
            
            // Active files
            if !context.current_work.active_files.is_empty() {
                output.push_str("### Active Files\n");
                for file in &context.current_work.active_files {
                    output.push_str(&format!("- `{}`\n", file.path));
                }
                output.push_str("\n");
            }
        }
        
        // Recent Code Changes
        if self.config.include_elements.code_changes && !context.current_work.code_changes.is_empty() {
            output.push_str("## Recent Code Changes\n\n");
            for change in context.current_work.code_changes.iter().take(5) {
                output.push_str(&format!("### {} - {}\n", change.file_path, change.change_type));
                output.push_str(&format!("{}\n", change.description));
                if adaptation.include_code_blocks {
                    if let Some(after) = &change.after {
                        output.push_str("```\n");
                        output.push_str(&after[..after.len().min(500)]); // Limit code length
                        output.push_str("\n```\n");
                    }
                }
                output.push_str("\n");
            }
            elements_included.push("code_changes".to_string());
        }
        
        // Key Decisions
        if self.config.include_elements.decisions && !context.current_work.decisions.is_empty() {
            output.push_str("## Key Decisions\n\n");
            for decision in context.current_work.decisions.iter().take(3) {
                output.push_str(&format!("### {}\n", decision.decision));
                if adaptation.emphasize_reasoning {
                    output.push_str(&format!("**Rationale**: {}\n", decision.rationale));
                }
                output.push_str(&format!("**Confidence**: {:.0}%\n\n", decision.confidence * 100.0));
            }
            elements_included.push("decisions".to_string());
        }
        
        // Handoff Notes
        if self.config.include_elements.handoff_notes && !context.task_continuity.handoff_notes.is_empty() {
            output.push_str("## Handoff Notes\n\n");
            for note in &context.task_continuity.handoff_notes {
                if note.priority >= 7 { // Only high priority notes
                    output.push_str(&format!("⚠️ **Priority {}**: {}\n", note.priority, note.note));
                    output.push_str(&format!("*From: {}*\n\n", note.from_model));
                }
            }
            elements_included.push("handoff_notes".to_string());
        }
        
        // Checkpoints
        if self.config.include_elements.checkpoints && !context.task_continuity.checkpoints.is_empty() {
            output.push_str("## Available Checkpoints\n\n");
            for checkpoint in &context.task_continuity.checkpoints {
                if checkpoint.can_resume_from {
                    output.push_str(&format!("- **{}**: Ready to resume\n", checkpoint.name));
                }
            }
            output.push_str("\n");
            elements_included.push("checkpoints".to_string());
        }
        
        // Future Plans
        if self.config.include_elements.future_plans && !context.future_plans.tasks.is_empty() {
            output.push_str("## Next Steps\n\n");
            let high_priority_tasks: Vec<_> = context.future_plans.tasks.iter()
                .filter(|t| t.priority >= 7 && t.status != "completed")
                .take(5)
                .collect();
            
            for task in high_priority_tasks {
                output.push_str(&format!("- [ ] {}: {}\n", task.title, task.description));
            }
            output.push_str("\n");
            elements_included.push("future_plans".to_string());
        }
        
        output
    }
    
    /// Format context as structured data (preferred for Gemini)
    fn format_structured(
        &self,
        context: &UniversalContext,
        adaptation: &ModelAdaptation,
        elements_included: &mut Vec<String>,
    ) -> String {
        let mut data = json!({
            "context_transfer": {
                "source_model": context.current_work.current_model,
                "project_id": context.project_id,
                "session_id": context.session_id,
                "timestamp": Utc::now().to_rfc3339()
            }
        });
        
        let obj = data.as_object_mut().unwrap();
        
        // Current work
        if self.config.include_elements.current_work {
            obj.insert("current_work".to_string(), json!({
                "task": context.current_work.current_task,
                "state": context.current_work.work_state,
                "progress": context.current_work.progress,
                "active_files": context.current_work.active_files.iter()
                    .map(|f| f.path.clone())
                    .collect::<Vec<_>>()
            }));
            elements_included.push("current_work".to_string());
        }
        
        // Code changes
        if self.config.include_elements.code_changes {
            let changes: Vec<_> = context.current_work.code_changes.iter()
                .take(5)
                .map(|c| json!({
                    "file": c.file_path,
                    "type": c.change_type,
                    "description": c.description
                }))
                .collect();
            obj.insert("recent_changes".to_string(), json!(changes));
            elements_included.push("code_changes".to_string());
        }
        
        // Decisions
        if self.config.include_elements.decisions {
            let decisions: Vec<_> = context.current_work.decisions.iter()
                .take(3)
                .map(|d| json!({
                    "decision": d.decision,
                    "rationale": d.rationale,
                    "confidence": d.confidence
                }))
                .collect();
            obj.insert("key_decisions".to_string(), json!(decisions));
            elements_included.push("decisions".to_string());
        }
        
        // Handoff notes
        if self.config.include_elements.handoff_notes {
            let notes: Vec<_> = context.task_continuity.handoff_notes.iter()
                .filter(|n| n.priority >= 7)
                .map(|n| json!({
                    "note": n.note,
                    "priority": n.priority,
                    "from": n.from_model
                }))
                .collect();
            obj.insert("handoff_notes".to_string(), json!(notes));
            elements_included.push("handoff_notes".to_string());
        }
        
        // Next tasks
        if self.config.include_elements.future_plans {
            let tasks: Vec<_> = context.future_plans.tasks.iter()
                .filter(|t| t.priority >= 7 && t.status != "completed")
                .take(5)
                .map(|t| json!({
                    "title": t.title,
                    "description": t.description,
                    "priority": t.priority
                }))
                .collect();
            obj.insert("next_tasks".to_string(), json!(tasks));
            elements_included.push("future_plans".to_string());
        }
        
        serde_json::to_string_pretty(&data).unwrap_or_default()
    }
    
    /// Format context concisely (preferred for Ollama)
    fn format_concise(
        &self,
        context: &UniversalContext,
        _adaptation: &ModelAdaptation,
        elements_included: &mut Vec<String>,
    ) -> String {
        let mut output = String::new();
        
        // Essential context only
        output.push_str(&format!("CONTEXT FROM: {}\n", context.current_work.current_model));
        
        if let Some(task) = &context.current_work.current_task {
            output.push_str(&format!("TASK: {}\n", task));
        }
        output.push_str(&format!("STATE: {} ({}%)\n\n", context.current_work.work_state, context.current_work.progress));
        elements_included.push("current_work".to_string());
        
        // Active files
        if !context.current_work.active_files.is_empty() {
            output.push_str("FILES:\n");
            for file in context.current_work.active_files.iter().take(3) {
                output.push_str(&format!("- {}\n", file.path));
            }
            output.push_str("\n");
        }
        
        // Critical handoff notes only
        let critical_notes: Vec<_> = context.task_continuity.handoff_notes.iter()
            .filter(|n| n.priority >= 9)
            .collect();
        
        if !critical_notes.is_empty() {
            output.push_str("CRITICAL NOTES:\n");
            for note in critical_notes {
                output.push_str(&format!("! {}\n", note.note));
            }
            output.push_str("\n");
            elements_included.push("handoff_notes".to_string());
        }
        
        // Next immediate task
        if let Some(next_task) = context.future_plans.tasks.iter()
            .filter(|t| t.status != "completed")
            .max_by_key(|t| t.priority) {
            output.push_str(&format!("NEXT: {} - {}\n", next_task.title, next_task.description));
            elements_included.push("future_plans".to_string());
        }
        
        output
    }
    
    /// Automatically inject context when switching models
    pub async fn auto_inject_on_switch(
        &self,
        from_session: &str,
        to_session: &str,
        to_model: &str,
        db: &State<'_, AgentDb>,
    ) -> Result<InjectionResult> {
        // Load context from source session
        let context = super::intelligence_bridge::load_universal_context(
            from_session.to_string(), 
            db.clone()
        ).await
            .map_err(|e| anyhow::anyhow!("Failed to load context: {}", e))?
            .ok_or_else(|| anyhow::anyhow!("No context found for session"))?;
        
        // Prepare injection for target model
        let injection_result = self.prepare_injection(&context, to_model)?;
        
        // Transfer context to new session
        let _transferred_context = self.bridge.transfer_context(
            from_session,
            to_session,
            to_model
        )?;
        
        // Store the transferred context
        super::intelligence_bridge::store_universal_context(
            _transferred_context,
            db.clone()
        ).await
            .map_err(|e| anyhow::anyhow!("Failed to store transferred context: {}", e))?;
        
        info!(
            "Auto-injected context from {} to {} for model {}",
            from_session, to_session, to_model
        );
        
        Ok(injection_result)
    }
}

/// Create system prompt with injected context
#[tauri::command]
pub async fn create_contextual_prompt(
    base_prompt: String,
    session_id: String,
    target_model: String,
    db: State<'_, AgentDb>,
) -> Result<String, String> {
    // Load context for session
    let context = super::intelligence_bridge::load_universal_context(
        session_id.clone(),
        db
    ).await?;
    
    if let Some(context) = context {
        let injector = ContextInjector::new(None);
        let injection = injector.prepare_injection(&context, &target_model)
            .map_err(|e| format!("Failed to prepare injection: {}", e))?;
        
        // Combine base prompt with context
        let contextual_prompt = format!(
            "{}\n\n---\n\n# Previous Context\n\n{}\n\n---\n\n# Your Task\n\n{}",
            injection.formatted_context,
            if !injection.warnings.is_empty() {
                format!("⚠️ Warnings: {}\n", injection.warnings.join(", "))
            } else {
                String::new()
            },
            base_prompt
        );
        
        Ok(contextual_prompt)
    } else {
        // No context available, return base prompt
        Ok(base_prompt)
    }
}

/// Update injection configuration
#[tauri::command]
pub async fn update_injection_config(
    config: InjectionConfig,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let config_json = serde_json::to_string(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    conn.execute(
        "INSERT OR REPLACE INTO system_config (key, value, updated_at)
         VALUES ('injection_config', ?, ?)",
        [&config_json, &Utc::now().to_rfc3339()],
    ).map_err(|e| format!("Failed to store config: {}", e))?;
    
    Ok(())
}

/// Get current injection configuration
#[tauri::command]
pub async fn get_injection_config(
    db: State<'_, AgentDb>,
) -> Result<InjectionConfig, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let result = conn.query_row(
        "SELECT value FROM system_config WHERE key = 'injection_config'",
        [],
        |row| {
            let config_json: String = row.get(0)?;
            Ok(config_json)
        },
    );
    
    match result {
        Ok(config_json) => {
            let config: InjectionConfig = serde_json::from_str(&config_json)
                .map_err(|e| format!("Failed to deserialize config: {}", e))?;
            Ok(config)
        }
        Err(_) => {
            // Return default config if not found
            Ok(InjectionConfig::default())
        }
    }
}