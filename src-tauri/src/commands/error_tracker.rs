use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, State, Emitter};
use log::{info, warn, debug};
use rusqlite::{params, Connection};
use uuid::Uuid;
use regex::Regex;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::agents::AgentDb;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEntry {
    pub id: String,
    pub error_code: String,
    pub title: String,
    pub description: String,
    pub severity: ErrorSeverity,
    pub category: ErrorCategory,
    pub occurred_at: i64,
    pub resolved_at: Option<i64>,
    pub status: ErrorStatus,
    pub root_cause: Option<String>,
    pub resolution_steps: Vec<String>,
    pub prevention_strategies: Vec<String>,
    pub occurrences: u32,
    pub last_occurrence: i64,
    pub context: HashMap<String, String>,
    pub stack_trace: Option<String>,
    pub session_id: Option<String>,
    pub auto_resolved: bool,
    pub pattern_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorCategory {
    SessionManagement,
    ModelIntegration,
    FileSystem,
    Network,
    Authentication,
    Database,
    UI,
    Performance,
    Configuration,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorStatus {
    New,
    InProgress,
    Resolved,
    KnownIssue,
    WontFix,
    Recurring,
    AutoResolved,
}

/// Error pattern for automatic detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPattern {
    pub id: String,
    pub name: String,
    pub pattern_regex: String,
    pub category: ErrorCategory,
    pub severity: ErrorSeverity,
    pub auto_resolution: Option<ResolutionStrategy>,
    pub keywords: Vec<String>,
    pub enabled: bool,
}

/// Resolution strategy for auto-resolution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionStrategy {
    pub strategy_type: ResolutionType,
    pub action: String,
    pub parameters: HashMap<String, String>,
    pub success_rate: f32,
    pub attempt_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ResolutionType {
    SessionRecovery,
    ApiRetry,
    AuthRefresh,
    UiCleanup,
    NetworkRetry,
    CacheClear,
    ConfigReload,
    Custom,
}

/// Error metrics for dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorMetrics {
    pub total_errors: u32,
    pub resolved_errors: u32,
    pub auto_resolved_errors: u32,
    pub recurring_errors: u32,
    pub errors_by_category: HashMap<String, u32>,
    pub errors_by_severity: HashMap<String, u32>,
    pub resolution_rate: f32,
    pub auto_resolution_rate: f32,
    pub mean_time_to_resolution: Option<i64>,
    pub top_errors: Vec<ErrorSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorSummary {
    pub error_code: String,
    pub title: String,
    pub category: ErrorCategory,
    pub severity: ErrorSeverity,
    pub occurrences: u32,
    pub last_occurrence: i64,
    pub status: ErrorStatus,
}

/// Error tracker state for real-time monitoring
pub struct ErrorTrackerState {
    pub patterns: Arc<RwLock<Vec<ErrorPattern>>>,
    pub active_resolutions: Arc<RwLock<HashMap<String, ResolutionProgress>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionProgress {
    pub error_id: String,
    pub started_at: i64,
    pub strategy: ResolutionType,
    pub status: String,
    pub steps_completed: Vec<String>,
}

/// Initialize error tracking tables
pub async fn init_error_tables(db: &State<'_, AgentDb>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    // Create errors table with enhanced schema
    conn.execute(
        "CREATE TABLE IF NOT EXISTS error_knowledge (
            id TEXT PRIMARY KEY,
            error_code TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            severity TEXT NOT NULL,
            category TEXT NOT NULL,
            occurred_at INTEGER NOT NULL,
            resolved_at INTEGER,
            status TEXT NOT NULL,
            root_cause TEXT,
            resolution_steps TEXT, -- JSON array
            prevention_strategies TEXT, -- JSON array
            occurrences INTEGER DEFAULT 1,
            last_occurrence INTEGER NOT NULL,
            context TEXT, -- JSON object
            stack_trace TEXT,
            session_id TEXT,
            auto_resolved BOOLEAN DEFAULT 0,
            pattern_id TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )",
        [],
    ).map_err(|e| format!("Failed to create error_knowledge table: {}", e))?;

    // Create indexes for better performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_error_code ON error_knowledge(error_code)",
        [],
    ).map_err(|e| format!("Failed to create error_code index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_error_status ON error_knowledge(status)",
        [],
    ).map_err(|e| format!("Failed to create status index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_error_category ON error_knowledge(category)",
        [],
    ).map_err(|e| format!("Failed to create category index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_error_session ON error_knowledge(session_id)",
        [],
    ).map_err(|e| format!("Failed to create session index: {}", e))?;

    // Create error patterns table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS error_patterns (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            pattern_regex TEXT NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            auto_resolution TEXT, -- JSON object
            keywords TEXT, -- JSON array
            enabled BOOLEAN DEFAULT 1,
            success_count INTEGER DEFAULT 0,
            attempt_count INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )",
        [],
    ).map_err(|e| format!("Failed to create error_patterns table: {}", e))?;

    // Create resolution history table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS resolution_history (
            id TEXT PRIMARY KEY,
            error_id TEXT NOT NULL,
            strategy_type TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            completed_at INTEGER,
            success BOOLEAN,
            notes TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (error_id) REFERENCES error_knowledge(id)
        )",
        [],
    ).map_err(|e| format!("Failed to create resolution_history table: {}", e))?;

    // Insert default error patterns
    insert_default_patterns(&conn)?;

    Ok(())
}

/// Insert default error patterns for common issues
fn insert_default_patterns(conn: &Connection) -> Result<(), String> {
    let patterns = vec![
        (
            "session_not_found",
            "Session Not Found",
            r"(?i)session.*not.*found|no.*session|session.*missing",
            "SessionManagement",
            "High",
            Some(serde_json::json!({
                "strategy_type": "SessionRecovery",
                "action": "create_new_session",
                "parameters": {
                    "retry_count": "3",
                    "create_new": "true"
                }
            })),
            vec!["session", "not found", "missing", "expired"],
        ),
        (
            "api_quota_exceeded",
            "API Quota Exceeded",
            r"(?i)quota.*exceed|rate.*limit|429|too.*many.*request",
            "Network",
            "High",
            Some(serde_json::json!({
                "strategy_type": "ApiRetry",
                "action": "exponential_backoff",
                "parameters": {
                    "initial_delay": "1000",
                    "max_delay": "60000",
                    "max_retries": "5"
                }
            })),
            vec!["quota", "rate limit", "exceeded", "429"],
        ),
        (
            "auth_failure",
            "Authentication Failure",
            r"(?i)auth.*fail|invalid.*credential|unauthorized|401",
            "Authentication",
            "Critical",
            Some(serde_json::json!({
                "strategy_type": "AuthRefresh",
                "action": "refresh_token",
                "parameters": {
                    "refresh_endpoint": "/auth/refresh",
                    "fallback_reauth": "true"
                }
            })),
            vec!["authentication", "unauthorized", "401", "credentials"],
        ),
        (
            "ui_duplication",
            "UI Element Duplication",
            r"(?i)duplicate.*render|multiple.*instance|repeated.*element",
            "UI",
            "Medium",
            Some(serde_json::json!({
                "strategy_type": "UiCleanup",
                "action": "cleanup_duplicates",
                "parameters": {
                    "clear_cache": "true",
                    "reset_listeners": "true"
                }
            })),
            vec!["duplicate", "ui", "render", "multiple"],
        ),
        (
            "network_timeout",
            "Network Timeout",
            r"(?i)timeout|timed.*out|connection.*timeout",
            "Network",
            "Medium",
            Some(serde_json::json!({
                "strategy_type": "NetworkRetry",
                "action": "retry_with_backoff",
                "parameters": {
                    "timeout_multiplier": "2",
                    "max_timeout": "60000",
                    "max_retries": "3"
                }
            })),
            vec!["timeout", "network", "connection"],
        ),
    ];

    for pattern in patterns {
        let existing = conn.query_row(
            "SELECT id FROM error_patterns WHERE id = ?",
            [pattern.0],
            |_| Ok(()),
        );

        if existing.is_err() {
            conn.execute(
                "INSERT INTO error_patterns 
                 (id, name, pattern_regex, category, severity, auto_resolution, keywords)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    pattern.0,
                    pattern.1,
                    pattern.2,
                    pattern.3,
                    pattern.4,
                    pattern.5.as_ref().map(|v| v.to_string()),
                    serde_json::to_string(&pattern.6).unwrap_or_default()
                ],
            ).map_err(|e| format!("Failed to insert pattern {}: {}", pattern.0, e))?;
        }
    }

    Ok(())
}

/// Track and potentially auto-resolve an error
#[command]
pub async fn track_error(
    app_handle: AppHandle,
    error_message: String,
    component: String,
    category: Option<String>,
    severity: Option<String>,
    stack_trace: Option<String>,
    context: Option<HashMap<String, String>>,
    session_id: Option<String>,
    db: State<'_, AgentDb>,
) -> Result<String, String> {
    let (error_code, category, severity, pattern_match, error_id) = {
        let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
        
        // Generate error code based on message and component
        let error_code = generate_error_code(&error_message, &component);
        
        // Detect category and severity if not provided
        let category = category.unwrap_or_else(|| detect_category(&error_message));
        let severity = severity.unwrap_or_else(|| assess_severity(&error_message, &category));
        
        // Check for matching patterns and potential auto-resolution
        let pattern_match = check_error_patterns(&conn, &error_message, &category)?;
        
        // Track the error
        let error_id = track_error_internal(
            &conn,
            error_code.clone(),
            error_message.clone(),
            component,
            category.clone(),
            severity.clone(),
            stack_trace,
            context.unwrap_or_default(),
            session_id,
            pattern_match.as_ref().map(|p| p.0.clone()),
        )?;
        
        Ok::<_, String>((error_code, category, severity, pattern_match, error_id))
    }?;
    
    // Attempt auto-resolution if pattern matched (outside of lock)
    if let Some((_pattern_id, resolution)) = pattern_match {
        if let Some(res_strategy) = resolution {
            attempt_auto_resolution_async(
                &app_handle,
                &db,
                &error_id,
                &error_code,
                res_strategy,
            ).await?;
        }
    }
    
    // Emit error tracking event
    app_handle.emit("error-tracked", serde_json::json!({
        "error_id": error_id,
        "error_code": error_code,
        "category": category,
        "severity": severity,
    })).map_err(|e| format!("Failed to emit event: {}", e))?;
    
    Ok(error_id)
}

/// Async version of attempt_auto_resolution that doesn't hold connections across await points
async fn attempt_auto_resolution_async(
    app_handle: &AppHandle,
    db: &State<'_, AgentDb>,
    error_id: &str,
    error_code: &str,
    strategy: ResolutionStrategy,
) -> Result<(), String> {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    
    // Record resolution attempt
    let history_id = {
        let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
        let history_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO resolution_history (id, error_id, strategy_type, started_at)
             VALUES (?, ?, ?, ?)",
            params![history_id.clone(), error_id, format!("{:?}", strategy.strategy_type), timestamp],
        ).map_err(|e| format!("Failed to record resolution attempt: {}", e))?;
        history_id
    };
    
    // Execute resolution strategy (without holding connection)
    let success = match strategy.strategy_type {
        ResolutionType::SessionRecovery => {
            recover_session(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::ApiRetry => {
            retry_api_call(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::AuthRefresh => {
            refresh_authentication(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::UiCleanup => {
            cleanup_ui_elements(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::NetworkRetry => {
            retry_network_request(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::CacheClear => {
            clear_cache(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::ConfigReload => {
            reload_configuration(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::Custom => {
            execute_custom_resolution(app_handle, error_code, &strategy.parameters).await
        }
    };
    
    // Update resolution history and error status (acquire lock again)
    {
        let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
        
        conn.execute(
            "UPDATE resolution_history SET completed_at = ?, success = ? WHERE id = ?",
            params![timestamp, success, history_id],
        ).map_err(|e| format!("Failed to update resolution history: {}", e))?;
        
        if success {
            // Mark error as auto-resolved
            conn.execute(
                "UPDATE error_knowledge SET 
                 status = 'AutoResolved',
                 resolved_at = ?,
                 auto_resolved = 1,
                 updated_at = ?
                 WHERE id = ?",
                params![timestamp, timestamp, error_id],
            ).map_err(|e| format!("Failed to mark error as resolved: {}", e))?;
            
            info!("Successfully auto-resolved error: {}", error_code);
        }
    }
    
    // Emit resolution event
    if success {
        app_handle.emit("error-resolved", serde_json::json!({
            "error_id": error_id,
            "error_code": error_code,
            "auto_resolved": true,
        })).map_err(|e| format!("Failed to emit resolution event: {}", e))?;
    }
    
    Ok(())
}

/// Internal function to track error in database
fn track_error_internal(
    conn: &Connection,
    error_code: String,
    error_message: String,
    component: String,
    category: String,
    severity: String,
    stack_trace: Option<String>,
    context: HashMap<String, String>,
    session_id: Option<String>,
    pattern_id: Option<String>,
) -> Result<String, String> {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    
    // Check if error already exists
    let existing_error = conn.query_row(
        "SELECT id, occurrences, status FROM error_knowledge WHERE error_code = ?",
        [&error_code],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, u32>(1)?,
                row.get::<_, String>(2)?,
            ))
        }
    );
    
    match existing_error {
        Ok((id, occurrences, status)) => {
            // Update existing error
            let new_status = if status == "Resolved" || status == "AutoResolved" {
                "Recurring"
            } else {
                status.as_str()
            };
            
            conn.execute(
                "UPDATE error_knowledge SET 
                 occurrences = occurrences + 1,
                 last_occurrence = ?,
                 status = ?,
                 context = ?,
                 stack_trace = COALESCE(?, stack_trace),
                 pattern_id = COALESCE(?, pattern_id),
                 updated_at = ?
                 WHERE id = ?",
                params![
                    timestamp,
                    new_status,
                    serde_json::to_string(&context).unwrap_or_default(),
                    stack_trace,
                    pattern_id,
                    timestamp,
                    id
                ],
            ).map_err(|e| format!("Failed to update error: {}", e))?;
            
            info!("Updated existing error {} (occurrences: {})", error_code, occurrences + 1);
            Ok(id)
        }
        Err(_) => {
            // Create new error entry
            let id = Uuid::new_v4().to_string();
            
            conn.execute(
                "INSERT INTO error_knowledge 
                 (id, error_code, title, description, severity, category, occurred_at, status, 
                  occurrences, last_occurrence, context, stack_trace, session_id, pattern_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    id,
                    error_code,
                    component.clone(),
                    error_message,
                    severity,
                    category,
                    timestamp,
                    "New",
                    1,
                    timestamp,
                    serde_json::to_string(&context).unwrap_or_default(),
                    stack_trace,
                    session_id,
                    pattern_id
                ],
            ).map_err(|e| format!("Failed to insert error: {}", e))?;
            
            info!("Recorded new error: {}", error_code);
            Ok(id)
        }
    }
}

/// Check error patterns for automatic detection
fn check_error_patterns(
    conn: &Connection,
    error_message: &str,
    category: &str,
) -> Result<Option<(String, Option<ResolutionStrategy>)>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, pattern_regex, auto_resolution FROM error_patterns 
         WHERE category = ? AND enabled = 1"
    ).map_err(|e| format!("Failed to prepare pattern query: {}", e))?;
    
    let pattern_iter = stmt.query_map([category], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
        ))
    }).map_err(|e| format!("Failed to query patterns: {}", e))?;
    
    for pattern_result in pattern_iter {
        if let Ok((id, regex_str, resolution_json)) = pattern_result {
            if let Ok(regex) = Regex::new(&regex_str) {
                if regex.is_match(error_message) {
                    let resolution = resolution_json.and_then(|json| {
                        serde_json::from_str::<ResolutionStrategy>(&json).ok()
                    });
                    return Ok(Some((id, resolution)));
                }
            }
        }
    }
    
    Ok(None)
}

/// Attempt automatic resolution of an error
async fn attempt_auto_resolution(
    app_handle: &AppHandle,
    conn: &Connection,
    error_id: &str,
    error_code: &str,
    strategy: ResolutionStrategy,
) -> Result<(), String> {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    
    // Record resolution attempt
    let history_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO resolution_history (id, error_id, strategy_type, started_at)
         VALUES (?, ?, ?, ?)",
        params![history_id, error_id, format!("{:?}", strategy.strategy_type), timestamp],
    ).map_err(|e| format!("Failed to record resolution attempt: {}", e))?;
    
    // Execute resolution strategy
    let success = match strategy.strategy_type {
        ResolutionType::SessionRecovery => {
            recover_session(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::ApiRetry => {
            retry_api_call(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::AuthRefresh => {
            refresh_authentication(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::UiCleanup => {
            cleanup_ui_elements(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::NetworkRetry => {
            retry_network_request(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::CacheClear => {
            clear_cache(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::ConfigReload => {
            reload_configuration(app_handle, error_code, &strategy.parameters).await
        }
        ResolutionType::Custom => {
            execute_custom_resolution(app_handle, error_code, &strategy.parameters).await
        }
    };
    
    // Update resolution history
    conn.execute(
        "UPDATE resolution_history SET completed_at = ?, success = ? WHERE id = ?",
        params![timestamp, success, history_id],
    ).map_err(|e| format!("Failed to update resolution history: {}", e))?;
    
    if success {
        // Mark error as auto-resolved
        conn.execute(
            "UPDATE error_knowledge SET 
             status = 'AutoResolved',
             resolved_at = ?,
             auto_resolved = 1,
             updated_at = ?
             WHERE id = ?",
            params![timestamp, timestamp, error_id],
        ).map_err(|e| format!("Failed to mark error as resolved: {}", e))?;
        
        info!("Successfully auto-resolved error: {}", error_code);
        
        // Emit resolution event
        app_handle.emit("error-auto-resolved", serde_json::json!({
            "error_id": error_id,
            "error_code": error_code,
            "strategy": format!("{:?}", strategy.strategy_type),
        })).map_err(|e| format!("Failed to emit resolution event: {}", e))?;
    }
    
    Ok(())
}

/// Resolution strategy implementations
async fn recover_session(app: &AppHandle, error_code: &str, params: &HashMap<String, String>) -> bool {
    debug!("Attempting session recovery for error: {}", error_code);
    // Implement session recovery logic here
    // This would integrate with your session management system
    true
}

async fn retry_api_call(app: &AppHandle, error_code: &str, params: &HashMap<String, String>) -> bool {
    debug!("Retrying API call for error: {}", error_code);
    // Implement API retry logic with exponential backoff
    true
}

async fn refresh_authentication(app: &AppHandle, error_code: &str, params: &HashMap<String, String>) -> bool {
    debug!("Refreshing authentication for error: {}", error_code);
    // Implement auth refresh logic
    true
}

async fn cleanup_ui_elements(app: &AppHandle, error_code: &str, params: &HashMap<String, String>) -> bool {
    debug!("Cleaning up UI elements for error: {}", error_code);
    // Emit event to frontend to cleanup duplicates
    app.emit("ui-cleanup-required", serde_json::json!({
        "error_code": error_code,
        "clear_cache": params.get("clear_cache") == Some(&"true".to_string()),
        "reset_listeners": params.get("reset_listeners") == Some(&"true".to_string()),
    })).is_ok()
}

async fn retry_network_request(app: &AppHandle, error_code: &str, params: &HashMap<String, String>) -> bool {
    debug!("Retrying network request for error: {}", error_code);
    // Implement network retry logic
    true
}

async fn clear_cache(app: &AppHandle, error_code: &str, params: &HashMap<String, String>) -> bool {
    debug!("Clearing cache for error: {}", error_code);
    // Implement cache clearing logic
    true
}

async fn reload_configuration(app: &AppHandle, error_code: &str, params: &HashMap<String, String>) -> bool {
    debug!("Reloading configuration for error: {}", error_code);
    // Implement config reload logic
    true
}

async fn execute_custom_resolution(app: &AppHandle, error_code: &str, params: &HashMap<String, String>) -> bool {
    debug!("Executing custom resolution for error: {}", error_code);
    // Implement custom resolution logic based on parameters
    true
}

/// Helper functions
fn generate_error_code(message: &str, component: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    message.hash(&mut hasher);
    component.hash(&mut hasher);
    
    format!("ERR-{:016X}", hasher.finish())
}

fn detect_category(message: &str) -> String {
    let message_lower = message.to_lowercase();
    
    if message_lower.contains("session") {
        "SessionManagement"
    } else if message_lower.contains("api") || message_lower.contains("quota") {
        "Network"
    } else if message_lower.contains("auth") || message_lower.contains("unauthorized") {
        "Authentication"
    } else if message_lower.contains("database") || message_lower.contains("sql") {
        "Database"
    } else if message_lower.contains("file") || message_lower.contains("path") {
        "FileSystem"
    } else if message_lower.contains("ui") || message_lower.contains("render") {
        "UI"
    } else if message_lower.contains("config") || message_lower.contains("setting") {
        "Configuration"
    } else {
        "Unknown"
    }.to_string()
}

fn assess_severity(message: &str, category: &str) -> String {
    let message_lower = message.to_lowercase();
    
    if message_lower.contains("critical") || 
       message_lower.contains("fatal") || 
       message_lower.contains("crash") ||
       category == "Authentication" {
        "Critical"
    } else if message_lower.contains("error") || 
              message_lower.contains("fail") ||
              category == "Database" {
        "High"
    } else if message_lower.contains("warning") || 
              message_lower.contains("retry") {
        "Medium"
    } else {
        "Low"
    }.to_string()
}

/// Record a new error or update existing one (backward compatibility)
#[command]
pub async fn record_error(
    error_code: String,
    title: String,
    description: String,
    severity: String,
    category: String,
    context: HashMap<String, String>,
    db: State<'_, AgentDb>,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

    // Check if error already exists
    let existing_error = conn.query_row(
        "SELECT id, occurrences FROM error_knowledge WHERE error_code = ?",
        [&error_code],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, u32>(1)?
            ))
        }
    );

    match existing_error {
        Ok((id, occurrences)) => {
            // Update existing error
            conn.execute(
                "UPDATE error_knowledge SET 
                 occurrences = occurrences + 1,
                 last_occurrence = ?,
                 context = ?
                 WHERE id = ?",
                params![timestamp, serde_json::to_string(&context).unwrap_or_default(), id],
            ).map_err(|e| format!("Failed to update error: {}", e))?;

            info!("Updated existing error {} (occurrences: {})", error_code, occurrences + 1);
            Ok(id)
        }
        Err(_) => {
            // Create new error entry
            let id = Uuid::new_v4().to_string();
            
            conn.execute(
                "INSERT INTO error_knowledge 
                 (id, error_code, title, description, severity, category, occurred_at, status, 
                  occurrences, last_occurrence, context)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    id,
                    error_code,
                    title,
                    description,
                    severity,
                    category,
                    timestamp,
                    "New",
                    1,
                    timestamp,
                    serde_json::to_string(&context).unwrap_or_default()
                ],
            ).map_err(|e| format!("Failed to insert error: {}", e))?;

            info!("Recorded new error: {}", error_code);
            Ok(id)
        }
    }
}

/// Get error by ID
#[command]
pub async fn get_error(
    error_id: String,
    db: State<'_, AgentDb>,
) -> Result<Option<ErrorEntry>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let result = conn.query_row(
        "SELECT id, error_code, title, description, severity, category, occurred_at, 
                resolved_at, status, root_cause, resolution_steps, prevention_strategies,
                occurrences, last_occurrence, context
         FROM error_knowledge WHERE id = ?",
        [error_id],
        |row| {
            let resolution_steps: Vec<String> = serde_json::from_str(
                &row.get::<_, String>(10).unwrap_or_default()
            ).unwrap_or_default();

            let prevention_strategies: Vec<String> = serde_json::from_str(
                &row.get::<_, String>(11).unwrap_or_default()
            ).unwrap_or_default();

            let context: HashMap<String, String> = serde_json::from_str(
                &row.get::<_, String>(14).unwrap_or_default()
            ).unwrap_or_default();

            Ok(ErrorEntry {
                id: row.get(0)?,
                error_code: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                severity: match row.get::<_, String>(4)?.as_str() {
                    "Low" => ErrorSeverity::Low,
                    "Medium" => ErrorSeverity::Medium,
                    "High" => ErrorSeverity::High,
                    "Critical" => ErrorSeverity::Critical,
                    _ => ErrorSeverity::Medium,
                },
                category: match row.get::<_, String>(5)?.as_str() {
                    "SessionManagement" => ErrorCategory::SessionManagement,
                    "ModelIntegration" => ErrorCategory::ModelIntegration,
                    "FileSystem" => ErrorCategory::FileSystem,
                    "Network" => ErrorCategory::Network,
                    "Authentication" => ErrorCategory::Authentication,
                    "Database" => ErrorCategory::Database,
                    "UI" => ErrorCategory::UI,
                    "Performance" => ErrorCategory::Performance,
                    "Configuration" => ErrorCategory::Configuration,
                    _ => ErrorCategory::Unknown,
                },
                occurred_at: row.get(6)?,
                resolved_at: row.get(7)?,
                status: match row.get::<_, String>(8)?.as_str() {
                    "New" => ErrorStatus::New,
                    "InProgress" => ErrorStatus::InProgress,
                    "Resolved" => ErrorStatus::Resolved,
                    "KnownIssue" => ErrorStatus::KnownIssue,
                    "WontFix" => ErrorStatus::WontFix,
                    _ => ErrorStatus::New,
                },
                root_cause: row.get(9)?,
                resolution_steps,
                prevention_strategies,
                occurrences: row.get(12)?,
                last_occurrence: row.get(13)?,
                context,
                stack_trace: None,  // Default to None since not available in this query
                session_id: None,   // Default to None since not available in this query
                auto_resolved: false,  // Default to false since not available in this query
                pattern_id: None,   // Default to None since not available in this query
            })
        },
    );

    match result {
        Ok(error_entry) => Ok(Some(error_entry)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get error: {}", e)),
    }
}

/// List all errors with optional filtering
#[command]
pub async fn list_errors(
    status_filter: Option<String>,
    category_filter: Option<String>,
    limit: Option<u32>,
    db: State<'_, AgentDb>,
) -> Result<Vec<ErrorEntry>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let mut query = "SELECT id, error_code, title, description, severity, category, occurred_at, 
                           resolved_at, status, root_cause, resolution_steps, prevention_strategies,
                           occurrences, last_occurrence, context
                    FROM error_knowledge".to_string();
    let mut params: Vec<String> = Vec::new();

    // Build WHERE clause
    let mut conditions = Vec::new();
    
    if let Some(status) = status_filter {
        conditions.push("status = ?".to_string());
        params.push(status);
    }
    
    if let Some(category) = category_filter {
        conditions.push("category = ?".to_string());
        params.push(category);
    }

    if !conditions.is_empty() {
        query = format!("{} WHERE {}", query, conditions.join(" AND "));
    }

    // Order by last occurrence (most recent first)
    query = format!("{} ORDER BY last_occurrence DESC", query);

    if let Some(limit_val) = limit {
        query = format!("{} LIMIT {}", query, limit_val);
    }

    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let error_iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        let resolution_steps: Vec<String> = serde_json::from_str(
            &row.get::<_, String>(10).unwrap_or_default()
        ).unwrap_or_default();

        let prevention_strategies: Vec<String> = serde_json::from_str(
            &row.get::<_, String>(11).unwrap_or_default()
        ).unwrap_or_default();

        let context: HashMap<String, String> = serde_json::from_str(
            &row.get::<_, String>(14).unwrap_or_default()
        ).unwrap_or_default();

        Ok(ErrorEntry {
            id: row.get(0)?,
            error_code: row.get(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            severity: match row.get::<_, String>(4)?.as_str() {
                "Low" => ErrorSeverity::Low,
                "Medium" => ErrorSeverity::Medium,
                "High" => ErrorSeverity::High,
                "Critical" => ErrorSeverity::Critical,
                _ => ErrorSeverity::Medium,
            },
            category: match row.get::<_, String>(5)?.as_str() {
                "SessionManagement" => ErrorCategory::SessionManagement,
                "ModelIntegration" => ErrorCategory::ModelIntegration,
                "FileSystem" => ErrorCategory::FileSystem,
                "Network" => ErrorCategory::Network,
                "Authentication" => ErrorCategory::Authentication,
                "Database" => ErrorCategory::Database,
                "UI" => ErrorCategory::UI,
                "Performance" => ErrorCategory::Performance,
                "Configuration" => ErrorCategory::Configuration,
                _ => ErrorCategory::Unknown,
            },
            occurred_at: row.get(6)?,
            resolved_at: row.get(7)?,
            status: match row.get::<_, String>(8)?
                .as_str() {
                "New" => ErrorStatus::New,
                "InProgress" => ErrorStatus::InProgress,
                "Resolved" => ErrorStatus::Resolved,
                "KnownIssue" => ErrorStatus::KnownIssue,
                "WontFix" => ErrorStatus::WontFix,
                _ => ErrorStatus::New,
            },
            root_cause: row.get(9)?,
            resolution_steps,
            prevention_strategies,
            occurrences: row.get(12)?,
            last_occurrence: row.get(13)?,
            context,
            stack_trace: None,  // Default to None since not available in this query
            session_id: None,   // Default to None since not available in this query
            auto_resolved: false,  // Default to false since not available in this query
            pattern_id: None,   // Default to None since not available in this query
        })
    }).map_err(|e| format!("Failed to query errors: {}", e))?;

    let mut errors = Vec::new();
    for error_result in error_iter {
        match error_result {
            Ok(error) => errors.push(error),
            Err(e) => warn!("Failed to parse error entry: {}", e),
        }
    }

    Ok(errors)
}

/// Update error resolution
#[command]
pub async fn resolve_error(
    error_id: String,
    status: String,
    root_cause: Option<String>,
    resolution_steps: Vec<String>,
    prevention_strategies: Vec<String>,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

    let resolved_at = if status == "Resolved" { Some(timestamp) } else { None };

    conn.execute(
        "UPDATE error_knowledge SET 
         status = ?,
         resolved_at = ?,
         root_cause = ?,
         resolution_steps = ?,
         prevention_strategies = ?
         WHERE id = ?",
        params![
            status,
            resolved_at,
            root_cause,
            serde_json::to_string(&resolution_steps).unwrap_or_default(),
            serde_json::to_string(&prevention_strategies).unwrap_or_default(),
            error_id
        ],
    ).map_err(|e| format!("Failed to update error: {}", e))?;

    info!("Updated error {} with status: {}", error_id, status);
    Ok(())
}

/// Get comprehensive error metrics for dashboard
#[command]
pub async fn get_error_metrics(
    time_range_hours: Option<i32>,
    db: State<'_, AgentDb>,
) -> Result<ErrorMetrics, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    let hours = time_range_hours.unwrap_or(24);
    let time_cutoff = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64 - (hours as i64 * 3600);
    
    // Get total errors
    let total_errors: u32 = conn.query_row(
        "SELECT COUNT(*) FROM error_knowledge WHERE last_occurrence > ?",
        [time_cutoff],
        |row| row.get(0),
    ).unwrap_or(0);
    
    // Get resolved errors
    let resolved_errors: u32 = conn.query_row(
        "SELECT COUNT(*) FROM error_knowledge WHERE status IN ('Resolved', 'AutoResolved') AND last_occurrence > ?",
        [time_cutoff],
        |row| row.get(0),
    ).unwrap_or(0);
    
    // Get auto-resolved errors
    let auto_resolved_errors: u32 = conn.query_row(
        "SELECT COUNT(*) FROM error_knowledge WHERE auto_resolved = 1 AND last_occurrence > ?",
        [time_cutoff],
        |row| row.get(0),
    ).unwrap_or(0);
    
    // Get recurring errors
    let recurring_errors: u32 = conn.query_row(
        "SELECT COUNT(*) FROM error_knowledge WHERE status = 'Recurring' AND last_occurrence > ?",
        [time_cutoff],
        |row| row.get(0),
    ).unwrap_or(0);
    
    // Get errors by category
    let mut errors_by_category = HashMap::new();
    let mut cat_stmt = conn.prepare(
        "SELECT category, COUNT(*) FROM error_knowledge WHERE last_occurrence > ? GROUP BY category"
    ).map_err(|e| format!("Failed to prepare category query: {}", e))?;
    
    let cat_iter = cat_stmt.query_map([time_cutoff], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
    }).map_err(|e| format!("Failed to query category stats: {}", e))?;
    
    for result in cat_iter {
        if let Ok((category, count)) = result {
            errors_by_category.insert(category, count);
        }
    }
    
    // Get errors by severity
    let mut errors_by_severity = HashMap::new();
    let mut sev_stmt = conn.prepare(
        "SELECT severity, COUNT(*) FROM error_knowledge WHERE last_occurrence > ? GROUP BY severity"
    ).map_err(|e| format!("Failed to prepare severity query: {}", e))?;
    
    let sev_iter = sev_stmt.query_map([time_cutoff], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
    }).map_err(|e| format!("Failed to query severity stats: {}", e))?;
    
    for result in sev_iter {
        if let Ok((severity, count)) = result {
            errors_by_severity.insert(severity, count);
        }
    }
    
    // Calculate rates
    let resolution_rate = if total_errors > 0 {
        (resolved_errors as f32 / total_errors as f32) * 100.0
    } else {
        0.0
    };
    
    let auto_resolution_rate = if resolved_errors > 0 {
        (auto_resolved_errors as f32 / resolved_errors as f32) * 100.0
    } else {
        0.0
    };
    
    // Calculate mean time to resolution
    let mean_time_to_resolution: Option<i64> = conn.query_row(
        "SELECT AVG(resolved_at - occurred_at) FROM error_knowledge 
         WHERE resolved_at IS NOT NULL AND last_occurrence > ?",
        [time_cutoff],
        |row| row.get(0),
    ).ok();
    
    // Get top errors
    let mut top_errors = Vec::new();
    let mut top_stmt = conn.prepare(
        "SELECT error_code, title, category, severity, occurrences, last_occurrence, status 
         FROM error_knowledge 
         WHERE last_occurrence > ?
         ORDER BY occurrences DESC 
         LIMIT 10"
    ).map_err(|e| format!("Failed to prepare top errors query: {}", e))?;
    
    let top_iter = top_stmt.query_map([time_cutoff], |row| {
        Ok(ErrorSummary {
            error_code: row.get(0)?,
            title: row.get(1)?,
            category: match row.get::<_, String>(2)?.as_str() {
                "SessionManagement" => ErrorCategory::SessionManagement,
                "ModelIntegration" => ErrorCategory::ModelIntegration,
                "FileSystem" => ErrorCategory::FileSystem,
                "Network" => ErrorCategory::Network,
                "Authentication" => ErrorCategory::Authentication,
                "Database" => ErrorCategory::Database,
                "UI" => ErrorCategory::UI,
                "Performance" => ErrorCategory::Performance,
                "Configuration" => ErrorCategory::Configuration,
                _ => ErrorCategory::Unknown,
            },
            severity: match row.get::<_, String>(3)?.as_str() {
                "Low" => ErrorSeverity::Low,
                "Medium" => ErrorSeverity::Medium,
                "High" => ErrorSeverity::High,
                "Critical" => ErrorSeverity::Critical,
                _ => ErrorSeverity::Medium,
            },
            occurrences: row.get(4)?,
            last_occurrence: row.get(5)?,
            status: match row.get::<_, String>(6)?.as_str() {
                "New" => ErrorStatus::New,
                "InProgress" => ErrorStatus::InProgress,
                "Resolved" => ErrorStatus::Resolved,
                "KnownIssue" => ErrorStatus::KnownIssue,
                "WontFix" => ErrorStatus::WontFix,
                "Recurring" => ErrorStatus::Recurring,
                "AutoResolved" => ErrorStatus::AutoResolved,
                _ => ErrorStatus::New,
            },
        })
    }).map_err(|e| format!("Failed to query top errors: {}", e))?;
    
    for result in top_iter {
        if let Ok(error_summary) = result {
            top_errors.push(error_summary);
        }
    }
    
    Ok(ErrorMetrics {
        total_errors,
        resolved_errors,
        auto_resolved_errors,
        recurring_errors,
        errors_by_category,
        errors_by_severity,
        resolution_rate,
        auto_resolution_rate,
        mean_time_to_resolution,
        top_errors,
    })
}

/// Search errors with advanced filters
#[command]
pub async fn search_errors(
    category: Option<String>,
    severity: Option<String>,
    status: Option<String>,
    search_text: Option<String>,
    session_id: Option<String>,
    limit: Option<u32>,
    db: State<'_, AgentDb>,
) -> Result<Vec<ErrorEntry>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut query = "SELECT id, error_code, title, description, severity, category, occurred_at, 
                           resolved_at, status, root_cause, resolution_steps, prevention_strategies,
                           occurrences, last_occurrence, context, stack_trace, session_id, 
                           auto_resolved, pattern_id
                    FROM error_knowledge WHERE 1=1".to_string();
    
    let mut params: Vec<String> = Vec::new();
    
    if let Some(cat) = category {
        query.push_str(" AND category = ?");
        params.push(cat);
    }
    
    if let Some(sev) = severity {
        query.push_str(" AND severity = ?");
        params.push(sev);
    }
    
    if let Some(stat) = status {
        query.push_str(" AND status = ?");
        params.push(stat);
    }
    
    if let Some(sess_id) = session_id {
        query.push_str(" AND session_id = ?");
        params.push(sess_id);
    }
    
    if let Some(text) = search_text {
        query.push_str(" AND (title LIKE ? OR description LIKE ? OR error_code LIKE ?)");
        let search_pattern = format!("%{}%", text);
        params.push(search_pattern.clone());
        params.push(search_pattern.clone());
        params.push(search_pattern);
    }
    
    query.push_str(" ORDER BY last_occurrence DESC");
    
    if let Some(lim) = limit {
        query.push_str(&format!(" LIMIT {}", lim));
    }
    
    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare search query: {}", e))?;
    
    let error_iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        let resolution_steps: Vec<String> = serde_json::from_str(
            &row.get::<_, String>(10).unwrap_or_default()
        ).unwrap_or_default();
        
        let prevention_strategies: Vec<String> = serde_json::from_str(
            &row.get::<_, String>(11).unwrap_or_default()
        ).unwrap_or_default();
        
        let context: HashMap<String, String> = serde_json::from_str(
            &row.get::<_, String>(14).unwrap_or_default()
        ).unwrap_or_default();
        
        Ok(ErrorEntry {
            id: row.get(0)?,
            error_code: row.get(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            severity: match row.get::<_, String>(4)?.as_str() {
                "Low" => ErrorSeverity::Low,
                "Medium" => ErrorSeverity::Medium,
                "High" => ErrorSeverity::High,
                "Critical" => ErrorSeverity::Critical,
                _ => ErrorSeverity::Medium,
            },
            category: match row.get::<_, String>(5)?.as_str() {
                "SessionManagement" => ErrorCategory::SessionManagement,
                "ModelIntegration" => ErrorCategory::ModelIntegration,
                "FileSystem" => ErrorCategory::FileSystem,
                "Network" => ErrorCategory::Network,
                "Authentication" => ErrorCategory::Authentication,
                "Database" => ErrorCategory::Database,
                "UI" => ErrorCategory::UI,
                "Performance" => ErrorCategory::Performance,
                "Configuration" => ErrorCategory::Configuration,
                _ => ErrorCategory::Unknown,
            },
            occurred_at: row.get(6)?,
            resolved_at: row.get(7)?,
            status: match row.get::<_, String>(8)?.as_str() {
                "New" => ErrorStatus::New,
                "InProgress" => ErrorStatus::InProgress,
                "Resolved" => ErrorStatus::Resolved,
                "KnownIssue" => ErrorStatus::KnownIssue,
                "WontFix" => ErrorStatus::WontFix,
                "Recurring" => ErrorStatus::Recurring,
                "AutoResolved" => ErrorStatus::AutoResolved,
                _ => ErrorStatus::New,
            },
            root_cause: row.get(9)?,
            resolution_steps,
            prevention_strategies,
            occurrences: row.get(12)?,
            last_occurrence: row.get(13)?,
            context,
            stack_trace: row.get(15)?,
            session_id: row.get(16)?,
            auto_resolved: row.get(17)?,
            pattern_id: row.get(18)?,
        })
    }).map_err(|e| format!("Failed to query errors: {}", e))?;
    
    let mut errors = Vec::new();
    for error_result in error_iter {
        match error_result {
            Ok(error) => errors.push(error),
            Err(e) => warn!("Failed to parse error entry: {}", e),
        }
    }
    
    Ok(errors)
}

/// Get error statistics (legacy function for backward compatibility)
#[command]
pub async fn get_error_stats(
    db: State<'_, AgentDb>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let mut stats = HashMap::new();

    // Total errors
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM error_knowledge", [], |row| row.get(0))
        .unwrap_or(0);
    stats.insert("total_errors".to_string(), serde_json::Value::Number(total.into()));

    // Errors by status
    let mut status_stmt = conn.prepare("SELECT status, COUNT(*) FROM error_knowledge GROUP BY status")
        .map_err(|e| format!("Failed to prepare status query: {}", e))?;
    let status_iter = status_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| format!("Failed to query status stats: {}", e))?;

    let mut status_counts = HashMap::new();
    for result in status_iter {
        if let Ok((status, count)) = result {
            status_counts.insert(status, serde_json::Value::Number(count.into()));
        }
    }
    stats.insert("by_status".to_string(), serde_json::Value::Object(
        status_counts.into_iter().collect()
    ));

    // Errors by category
    let mut category_stmt = conn.prepare("SELECT category, COUNT(*) FROM error_knowledge GROUP BY category")
        .map_err(|e| format!("Failed to prepare category query: {}", e))?;
    let category_iter = category_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| format!("Failed to query category stats: {}", e))?;

    let mut category_counts = HashMap::new();
    for result in category_iter {
        if let Ok((category, count)) = result {
            category_counts.insert(category, serde_json::Value::Number(count.into()));
        }
    }
    stats.insert("by_category".to_string(), serde_json::Value::Object(
        category_counts.into_iter().collect()
    ));

    // Most frequent errors
    let mut frequent_stmt = conn.prepare(
        "SELECT error_code, title, occurrences FROM error_knowledge 
         ORDER BY occurrences DESC LIMIT 10"
    ).map_err(|e| format!("Failed to prepare frequent query: {}", e))?;
    
    let frequent_iter = frequent_stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "code": row.get::<_, String>(0)?,
            "title": row.get::<_, String>(1)?,
            "occurrences": row.get::<_, u32>(2)?
        }))
    }).map_err(|e| format!("Failed to query frequent errors: {}", e))?;

    let mut frequent_errors = Vec::new();
    for result in frequent_iter {
        if let Ok(error_info) = result {
            frequent_errors.push(error_info);
        }
    }
    stats.insert("most_frequent".to_string(), serde_json::Value::Array(frequent_errors));

    Ok(stats)
}