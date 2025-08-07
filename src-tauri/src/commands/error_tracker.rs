use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, State};
use log::{info, warn, error};
use rusqlite::params;
use uuid::Uuid;

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
}

/// Initialize error tracking tables
pub async fn init_error_tables(db: &State<'_, AgentDb>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    // Create errors table
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
            context TEXT -- JSON object
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

    Ok(())
}

/// Record a new error or update existing one
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

/// Get error statistics
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