use anyhow::Result;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use super::agents::AgentDb;
use super::ai_usage_tracker::AIUsageEvent;

/// Integration layer between Claude Code sessions and AI usage tracking
/// Automatically tracks AI usage based on Claude Code interactions

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTrackingConfig {
    pub auto_track_enabled: bool,
    pub track_token_usage: bool,
    pub track_response_times: bool,
    pub track_costs: bool,
    pub session_timeout_minutes: i64,
}

impl Default for SessionTrackingConfig {
    fn default() -> Self {
        Self {
            auto_track_enabled: true,
            track_token_usage: true,
            track_response_times: true,
            track_costs: true,
            session_timeout_minutes: 60,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSessionMetrics {
    pub session_id: String,
    pub project_id: String,
    pub start_time: i64,
    pub last_activity: i64,
    pub total_messages: i64,
    pub total_tokens: i64,
    pub estimated_cost: f64,
    pub model_name: String,
    pub agent_type: Option<String>,
    pub mcp_servers_used: Vec<String>,
    pub success_rate: f64,
}

/// Global session tracker for managing active AI sessions
pub struct SessionTracker {
    active_sessions: Arc<Mutex<std::collections::HashMap<String, ClaudeSessionMetrics>>>,
    config: SessionTrackingConfig,
}

impl SessionTracker {
    pub fn new() -> Self {
        Self {
            active_sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
            config: SessionTrackingConfig::default(),
        }
    }

    pub async fn start_session(
        &self,
        session_id: String,
        project_id: String,
        model_name: String,
        agent_type: Option<String>,
    ) -> Result<(), String> {
        let mut sessions = self.active_sessions.lock().await;
        let now = Utc::now().timestamp();
        
        sessions.insert(session_id.clone(), ClaudeSessionMetrics {
            session_id,
            project_id,
            start_time: now,
            last_activity: now,
            total_messages: 0,
            total_tokens: 0,
            estimated_cost: 0.0,
            model_name,
            agent_type,
            mcp_servers_used: Vec::new(),
            success_rate: 100.0,
        });

        Ok(())
    }

    pub async fn track_message(
        &self,
        db: &AgentDb,
        session_id: &str,
        model_name: &str,
        agent_type: Option<String>,
        mcp_server: Option<String>,
        token_count: i64,
        response_time_ms: Option<i64>,
        success: bool,
        request_type: &str,
        user_prompt_tokens: Option<i64>,
        assistant_response_tokens: Option<i64>,
    ) -> Result<(), String> {
        if !self.config.auto_track_enabled {
            return Ok(());
        }

        let mut sessions = self.active_sessions.lock().await;
        let now = Utc::now().timestamp();

        // Update session metrics
        if let Some(session) = sessions.get_mut(session_id) {
            session.last_activity = now;
            session.total_messages += 1;
            session.total_tokens += token_count;
            
            // Update success rate
            let previous_success_rate = session.success_rate;
            let previous_messages = session.total_messages - 1;
            if previous_messages > 0 {
                session.success_rate = ((previous_success_rate * previous_messages as f64) + 
                    if success { 100.0 } else { 0.0 }) / session.total_messages as f64;
            } else {
                session.success_rate = if success { 100.0 } else { 0.0 };
            }

            // Track MCP server usage
            if let Some(ref mcp) = mcp_server {
                if !session.mcp_servers_used.contains(mcp) {
                    session.mcp_servers_used.push(mcp.clone());
                }
            }

            // Calculate estimated cost increase
            let cost_increase = estimate_message_cost(model_name, token_count);
            session.estimated_cost += cost_increase;
        }

        // Track individual AI usage event
        let event = AIUsageEvent {
            project_id: sessions.get(session_id)
                .map(|s| s.project_id.clone())
                .unwrap_or_else(|| "unknown".to_string()),
            model_name: model_name.to_string(),
            agent_type,
            mcp_server,
            token_count,
            request_type: request_type.to_string(),
            response_time_ms,
            success,
            error_message: if success { None } else { Some("Request failed".to_string()) },
            session_id: Some(session_id.to_string()),
            user_prompt_tokens,
            assistant_response_tokens,
            timestamp: now,
        };

        // Track the event asynchronously
        let event_for_tracking = event.clone();
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        
        // Insert individual event for detailed tracking
        conn.execute(
            "INSERT INTO ai_usage_events 
             (project_id, model_name, agent_type, mcp_server, token_count, request_type,
              response_time_ms, success, error_message, session_id, user_prompt_tokens,
              assistant_response_tokens, cost, session_date, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                &event_for_tracking.project_id,
                &event_for_tracking.model_name,
                &event_for_tracking.agent_type,
                &event_for_tracking.mcp_server,
                event_for_tracking.token_count,
                &event_for_tracking.request_type,
                event_for_tracking.response_time_ms,
                event_for_tracking.success,
                &event_for_tracking.error_message,
                &event_for_tracking.session_id,
                event_for_tracking.user_prompt_tokens,
                event_for_tracking.assistant_response_tokens,
                estimate_message_cost(&event_for_tracking.model_name, event_for_tracking.token_count),
                &chrono::DateTime::from_timestamp(event_for_tracking.timestamp, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .format("%Y-%m-%d")
                    .to_string(),
                event_for_tracking.timestamp
            ],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn end_session(&self, session_id: &str) -> Result<ClaudeSessionMetrics, String> {
        let mut sessions = self.active_sessions.lock().await;
        sessions.remove(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))
    }

    pub async fn get_active_sessions(&self) -> Result<Vec<ClaudeSessionMetrics>, String> {
        let sessions = self.active_sessions.lock().await;
        Ok(sessions.values().cloned().collect())
    }

    pub async fn cleanup_expired_sessions(&self) -> Result<Vec<String>, String> {
        let mut sessions = self.active_sessions.lock().await;
        let now = Utc::now().timestamp();
        let timeout_seconds = self.config.session_timeout_minutes * 60;
        
        let expired_sessions: Vec<String> = sessions
            .iter()
            .filter(|(_, session)| now - session.last_activity > timeout_seconds)
            .map(|(id, _)| id.clone())
            .collect();

        for session_id in &expired_sessions {
            sessions.remove(session_id);
        }

        Ok(expired_sessions)
    }
}

// Global session tracker instance
lazy_static::lazy_static! {
    pub static ref GLOBAL_SESSION_TRACKER: SessionTracker = SessionTracker::new();
}

/// Helper function to estimate cost based on model and token count
fn estimate_message_cost(model_name: &str, token_count: i64) -> f64 {
    let avg_cost_per_1k_tokens = match model_name {
        "claude-3-opus" => 0.045,
        "claude-3-sonnet" => 0.009,
        "claude-3-haiku" => 0.000625,
        "claude-sonnet-4" => 0.012,
        "gpt-4" => 0.045,
        "gpt-4-turbo" => 0.02,
        "gpt-3.5-turbo" => 0.001,
        "gpt-4o" => 0.01,
        "gpt-4o-mini" => 0.000375,
        _ => 0.009, // Default to Claude Sonnet
    };
    
    (token_count as f64 / 1000.0) * avg_cost_per_1k_tokens
}

/// Tauri command to start tracking a new AI session
#[tauri::command]
pub async fn ai_session_start(
    session_id: String,
    project_id: String,
    model_name: String,
    agent_type: Option<String>,
) -> Result<String, String> {
    GLOBAL_SESSION_TRACKER
        .start_session(session_id, project_id, model_name, agent_type)
        .await?;
    Ok("AI session tracking started".to_string())
}

/// Tauri command to track an AI message within a session
#[tauri::command]
pub async fn ai_session_track_message(
    db: State<'_, AgentDb>,
    session_id: String,
    model_name: String,
    agent_type: Option<String>,
    mcp_server: Option<String>,
    token_count: i64,
    response_time_ms: Option<i64>,
    success: bool,
    request_type: String,
    user_prompt_tokens: Option<i64>,
    assistant_response_tokens: Option<i64>,
) -> Result<String, String> {
    GLOBAL_SESSION_TRACKER
        .track_message(
            &db,
            &session_id,
            &model_name,
            agent_type,
            mcp_server,
            token_count,
            response_time_ms,
            success,
            &request_type,
            user_prompt_tokens,
            assistant_response_tokens,
        )
        .await?;
    Ok("Message tracked successfully".to_string())
}

/// Tauri command to end an AI session and get final metrics
#[tauri::command]
pub async fn ai_session_end(session_id: String) -> Result<ClaudeSessionMetrics, String> {
    GLOBAL_SESSION_TRACKER.end_session(&session_id).await
}

/// Tauri command to get all active AI sessions
#[tauri::command]
pub async fn ai_session_get_active() -> Result<Vec<ClaudeSessionMetrics>, String> {
    GLOBAL_SESSION_TRACKER.get_active_sessions().await
}

/// Tauri command to cleanup expired AI sessions
#[tauri::command]
pub async fn ai_session_cleanup_expired() -> Result<Vec<String>, String> {
    GLOBAL_SESSION_TRACKER.cleanup_expired_sessions().await
}

/// Auto-tracking integration for Claude Code commands
pub struct ClaudeIntegration;

impl ClaudeIntegration {
    /// Track Claude Code execution with AI usage
    pub async fn track_claude_execution(
        db: &AgentDb,
        session_id: &str,
        _project_id: &str,
        command: &str,
        token_estimate: i64,
        response_time_ms: i64,
        success: bool,
        model_name: Option<&str>,
    ) -> Result<(), String> {
        let model = model_name.unwrap_or("claude-3-sonnet");
        let agent_type = infer_agent_type_from_command(command);
        let mcp_server = infer_mcp_server_from_command(command);
        
        GLOBAL_SESSION_TRACKER
            .track_message(
                db,
                session_id,
                model,
                agent_type,
                mcp_server,
                token_estimate,
                Some(response_time_ms),
                success,
                "claude_execution",
                None,
                None,
            )
            .await
    }

    /// Track MCP server usage within Claude session
    pub async fn track_mcp_usage(
        db: &AgentDb,
        session_id: &str,
        mcp_server: &str,
        operation: &str,
        success: bool,
        response_time_ms: i64,
    ) -> Result<(), String> {
        // Estimate token usage for MCP operations
        let token_estimate = match operation {
            "search" | "query" => 500,
            "analyze" | "process" => 1500,
            "generate" | "create" => 2000,
            _ => 300,
        };
        
        GLOBAL_SESSION_TRACKER
            .track_message(
                db,
                session_id,
                "mcp_operation", // Special model name for MCP operations
                None,
                Some(mcp_server.to_string()),
                token_estimate,
                Some(response_time_ms),
                success,
                operation,
                None,
                None,
            )
            .await
    }
}

/// Infer agent type from Claude command
fn infer_agent_type_from_command(command: &str) -> Option<String> {
    let command_lower = command.to_lowercase();
    
    if command_lower.contains("analyze") || command_lower.contains("debug") {
        Some("analyzer".to_string())
    } else if command_lower.contains("architect") || command_lower.contains("design") {
        Some("architect".to_string())
    } else if command_lower.contains("frontend") || command_lower.contains("ui") {
        Some("frontend".to_string())
    } else if command_lower.contains("backend") || command_lower.contains("api") {
        Some("backend".to_string())
    } else if command_lower.contains("security") || command_lower.contains("audit") {
        Some("security".to_string())
    } else if command_lower.contains("performance") || command_lower.contains("optimize") {
        Some("performance".to_string())
    } else if command_lower.contains("test") || command_lower.contains("qa") {
        Some("qa".to_string())
    } else if command_lower.contains("refactor") || command_lower.contains("clean") {
        Some("refactorer".to_string())
    } else if command_lower.contains("document") || command_lower.contains("write") {
        Some("scribe".to_string())
    } else if command_lower.contains("mentor") || command_lower.contains("explain") {
        Some("mentor".to_string())
    } else {
        None
    }
}

/// Infer MCP server from Claude command
fn infer_mcp_server_from_command(command: &str) -> Option<String> {
    let command_lower = command.to_lowercase();
    
    if command_lower.contains("context7") || command_lower.contains("library") || command_lower.contains("docs") {
        Some("Context7".to_string())
    } else if command_lower.contains("sequential") || command_lower.contains("analyze") || command_lower.contains("complex") {
        Some("Sequential".to_string())
    } else if command_lower.contains("magic") || command_lower.contains("component") || command_lower.contains("ui") {
        Some("Magic".to_string())
    } else if command_lower.contains("playwright") || command_lower.contains("test") || command_lower.contains("browser") {
        Some("Playwright".to_string())
    } else {
        None
    }
}