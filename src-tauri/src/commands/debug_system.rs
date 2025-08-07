use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, State, AppHandle};
use log::{info, warn, error, debug, trace};
use rusqlite::params;
use uuid::Uuid;

use super::agents::AgentDb;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugEntry {
    pub id: String,
    pub timestamp: i64,
    pub level: LogLevel,
    pub category: String,
    pub message: String,
    pub context: HashMap<String, serde_json::Value>,
    pub call_stack: Vec<String>,
    pub session_id: Option<String>,
    pub operation_id: Option<String>,
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationTrace {
    pub id: String,
    pub name: String,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub status: OperationStatus,
    pub steps: Vec<TraceStep>,
    pub performance_metrics: HashMap<String, f64>,
    pub error_info: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceStep {
    pub step_name: String,
    pub timestamp: i64,
    pub duration_ms: Option<u64>,
    pub data: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceProfiler {
    pub operation_name: String,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub response_time: u64,
    pub throughput: f64,
    pub error_rate: f64,
    pub timestamp: i64,
}

/// Initialize debug and tracing tables
pub async fn init_debug_tables(db: &State<'_, AgentDb>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    // Create debug logs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS debug_logs (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            level TEXT NOT NULL,
            category TEXT NOT NULL,
            message TEXT NOT NULL,
            context TEXT, -- JSON
            call_stack TEXT, -- JSON array
            session_id TEXT,
            operation_id TEXT,
            user_agent TEXT
        )",
        [],
    ).map_err(|e| format!("Failed to create debug_logs table: {}", e))?;

    // Create operation traces table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS operation_traces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            completed_at INTEGER,
            status TEXT NOT NULL,
            steps TEXT, -- JSON array
            performance_metrics TEXT, -- JSON object
            error_info TEXT
        )",
        [],
    ).map_err(|e| format!("Failed to create operation_traces table: {}", e))?;

    // Create performance metrics table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS performance_metrics (
            id TEXT PRIMARY KEY,
            operation_name TEXT NOT NULL,
            cpu_usage REAL,
            memory_usage INTEGER,
            response_time INTEGER,
            throughput REAL,
            error_rate REAL,
            timestamp INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create performance_metrics table: {}", e))?;

    // Create indexes for better performance
    let indexes = vec![
        "CREATE INDEX IF NOT EXISTS idx_debug_timestamp ON debug_logs(timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_debug_level ON debug_logs(level)",
        "CREATE INDEX IF NOT EXISTS idx_debug_category ON debug_logs(category)",
        "CREATE INDEX IF NOT EXISTS idx_debug_session ON debug_logs(session_id)",
        "CREATE INDEX IF NOT EXISTS idx_trace_started ON operation_traces(started_at)",
        "CREATE INDEX IF NOT EXISTS idx_trace_status ON operation_traces(status)",
        "CREATE INDEX IF NOT EXISTS idx_perf_timestamp ON performance_metrics(timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_perf_operation ON performance_metrics(operation_name)",
    ];

    for index_sql in indexes {
        conn.execute(index_sql, [])
            .map_err(|e| format!("Failed to create index: {}", e))?;
    }

    Ok(())
}

/// Log a debug entry with full context
#[command]
pub async fn log_debug_entry(
    level: String,
    category: String,
    message: String,
    context: HashMap<String, serde_json::Value>,
    call_stack: Vec<String>,
    session_id: Option<String>,
    operation_id: Option<String>,
    db: State<'_, AgentDb>,
) -> Result<String, String> {
    let entry_id = Uuid::new_v4().to_string();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute(
        "INSERT INTO debug_logs 
         (id, timestamp, level, category, message, context, call_stack, session_id, operation_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            entry_id,
            timestamp,
            level,
            category,
            message,
            serde_json::to_string(&context).unwrap_or_default(),
            serde_json::to_string(&call_stack).unwrap_or_default(),
            session_id,
            operation_id,
        ],
    ).map_err(|e| format!("Failed to insert debug entry: {}", e))?;

    // Also log to system logger based on level
    match level.as_str() {
        "Trace" => trace!("[{}] {}: {}", category, message, serde_json::to_string(&context).unwrap_or_default()),
        "Debug" => debug!("[{}] {}: {}", category, message, serde_json::to_string(&context).unwrap_or_default()),
        "Info" => info!("[{}] {}: {}", category, message, serde_json::to_string(&context).unwrap_or_default()),
        "Warn" => warn!("[{}] {}: {}", category, message, serde_json::to_string(&context).unwrap_or_default()),
        "Error" | "Critical" => error!("[{}] {}: {}", category, message, serde_json::to_string(&context).unwrap_or_default()),
        _ => info!("[{}] {}: {}", category, message, serde_json::to_string(&context).unwrap_or_default()),
    }

    Ok(entry_id)
}

/// Start tracing an operation
#[command]
pub async fn start_operation_trace(
    operation_name: String,
    db: State<'_, AgentDb>,
) -> Result<String, String> {
    let trace_id = Uuid::new_v4().to_string();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute(
        "INSERT INTO operation_traces 
         (id, name, started_at, status, steps, performance_metrics)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            trace_id,
            operation_name,
            timestamp,
            "Running",
            "[]", // Empty steps array
            "{}", // Empty metrics object
        ],
    ).map_err(|e| format!("Failed to start operation trace: {}", e))?;

    info!("Started tracing operation: {} ({})", operation_name, trace_id);
    Ok(trace_id)
}

/// Add a step to an operation trace
#[command]
pub async fn add_trace_step(
    trace_id: String,
    step_name: String,
    data: HashMap<String, serde_json::Value>,
    duration_ms: Option<u64>,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    // Get current steps
    let current_steps: String = conn.query_row(
        "SELECT steps FROM operation_traces WHERE id = ?",
        [&trace_id],
        |row| row.get(0)
    ).map_err(|e| format!("Failed to get current steps: {}", e))?;

    let mut steps: Vec<TraceStep> = serde_json::from_str(&current_steps).unwrap_or_default();

    // Add new step
    steps.push(TraceStep {
        step_name,
        timestamp,
        duration_ms,
        data,
    });

    // Update the trace
    conn.execute(
        "UPDATE operation_traces SET steps = ? WHERE id = ?",
        params![
            serde_json::to_string(&steps).unwrap_or_default(),
            trace_id
        ],
    ).map_err(|e| format!("Failed to update trace steps: {}", e))?;

    Ok(())
}

/// Complete an operation trace
#[command]
pub async fn complete_operation_trace(
    trace_id: String,
    status: String,
    performance_metrics: HashMap<String, f64>,
    error_info: Option<String>,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute(
        "UPDATE operation_traces SET 
         completed_at = ?,
         status = ?,
         performance_metrics = ?,
         error_info = ?
         WHERE id = ?",
        params![
            timestamp,
            status,
            serde_json::to_string(&performance_metrics).unwrap_or_default(),
            error_info,
            trace_id
        ],
    ).map_err(|e| format!("Failed to complete operation trace: {}", e))?;

    let trace_name: String = conn.query_row(
        "SELECT name FROM operation_traces WHERE id = ?",
        [&trace_id],
        |row| row.get(0)
    ).unwrap_or_default();

    info!("Completed operation trace: {} ({}) - Status: {}", trace_name, trace_id, status);
    Ok(())
}

/// Record performance metrics
#[command]
pub async fn record_performance_metrics(
    operation_name: String,
    cpu_usage: f64,
    memory_usage: u64,
    response_time: u64,
    throughput: f64,
    error_rate: f64,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    conn.execute(
        "INSERT INTO performance_metrics 
         (id, operation_name, cpu_usage, memory_usage, response_time, throughput, error_rate, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            operation_name,
            cpu_usage,
            memory_usage as i64,
            response_time as i64,
            throughput,
            error_rate,
            timestamp
        ],
    ).map_err(|e| format!("Failed to record performance metrics: {}", e))?;

    Ok(())
}

/// Get debug logs with filtering
#[command]
pub async fn get_debug_logs(
    level_filter: Option<String>,
    category_filter: Option<String>,
    session_id_filter: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    db: State<'_, AgentDb>,
) -> Result<Vec<DebugEntry>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let mut query = "SELECT id, timestamp, level, category, message, context, call_stack, session_id, operation_id
                     FROM debug_logs".to_string();
    let mut params: Vec<String> = Vec::new();
    let mut conditions = Vec::new();

    // Build WHERE clause
    if let Some(level) = level_filter {
        conditions.push("level = ?".to_string());
        params.push(level);
    }
    
    if let Some(category) = category_filter {
        conditions.push("category = ?".to_string());
        params.push(category);
    }
    
    if let Some(session_id) = session_id_filter {
        conditions.push("session_id = ?".to_string());
        params.push(session_id);
    }

    if !conditions.is_empty() {
        query = format!("{} WHERE {}", query, conditions.join(" AND "));
    }

    // Order by timestamp (most recent first)
    query = format!("{} ORDER BY timestamp DESC", query);

    if let Some(limit_val) = limit {
        query = format!("{} LIMIT {}", query, limit_val);
    }

    if let Some(offset_val) = offset {
        query = format!("{} OFFSET {}", query, offset_val);
    }

    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let log_iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        let context: HashMap<String, serde_json::Value> = serde_json::from_str(
            &row.get::<_, String>(5).unwrap_or_default()
        ).unwrap_or_default();

        let call_stack: Vec<String> = serde_json::from_str(
            &row.get::<_, String>(6).unwrap_or_default()
        ).unwrap_or_default();

        Ok(DebugEntry {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            level: match row.get::<_, String>(2)?.as_str() {
                "Trace" => LogLevel::Trace,
                "Debug" => LogLevel::Debug,
                "Info" => LogLevel::Info,
                "Warn" => LogLevel::Warn,
                "Error" => LogLevel::Error,
                "Critical" => LogLevel::Critical,
                _ => LogLevel::Info,
            },
            category: row.get(3)?,
            message: row.get(4)?,
            context,
            call_stack,
            session_id: row.get(7)?,
            operation_id: row.get(8)?,
            user_agent: None,
        })
    }).map_err(|e| format!("Failed to query debug logs: {}", e))?;

    let mut logs = Vec::new();
    for log_result in log_iter {
        match log_result {
            Ok(log_entry) => logs.push(log_entry),
            Err(e) => warn!("Failed to parse debug log entry: {}", e),
        }
    }

    Ok(logs)
}

/// Get operation traces
#[command]
pub async fn get_operation_traces(
    status_filter: Option<String>,
    limit: Option<u32>,
    db: State<'_, AgentDb>,
) -> Result<Vec<OperationTrace>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let mut query = "SELECT id, name, started_at, completed_at, status, steps, performance_metrics, error_info
                     FROM operation_traces".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(status) = status_filter {
        query = format!("{} WHERE status = ?", query);
        params.push(status);
    }

    query = format!("{} ORDER BY started_at DESC", query);

    if let Some(limit_val) = limit {
        query = format!("{} LIMIT {}", query, limit_val);
    }

    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let trace_iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        let steps: Vec<TraceStep> = serde_json::from_str(
            &row.get::<_, String>(5).unwrap_or_default()
        ).unwrap_or_default();

        let performance_metrics: HashMap<String, f64> = serde_json::from_str(
            &row.get::<_, String>(6).unwrap_or_default()
        ).unwrap_or_default();

        Ok(OperationTrace {
            id: row.get(0)?,
            name: row.get(1)?,
            started_at: row.get(2)?,
            completed_at: row.get(3)?,
            status: match row.get::<_, String>(4)?.as_str() {
                "Running" => OperationStatus::Running,
                "Completed" => OperationStatus::Completed,
                "Failed" => OperationStatus::Failed,
                "Cancelled" => OperationStatus::Cancelled,
                _ => OperationStatus::Running,
            },
            steps,
            performance_metrics,
            error_info: row.get(7)?,
        })
    }).map_err(|e| format!("Failed to query operation traces: {}", e))?;

    let mut traces = Vec::new();
    for trace_result in trace_iter {
        match trace_result {
            Ok(trace) => traces.push(trace),
            Err(e) => warn!("Failed to parse operation trace: {}", e),
        }
    }

    Ok(traces)
}

/// Get performance metrics
#[command]
pub async fn get_performance_metrics(
    operation_filter: Option<String>,
    time_range_hours: Option<u32>,
    db: State<'_, AgentDb>,
) -> Result<Vec<PerformanceProfiler>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

    let mut query = "SELECT id, operation_name, cpu_usage, memory_usage, response_time, throughput, error_rate, timestamp
                     FROM performance_metrics".to_string();
    let mut params: Vec<String> = Vec::new();
    let mut conditions = Vec::new();

    if let Some(operation) = operation_filter {
        conditions.push("operation_name = ?".to_string());
        params.push(operation);
    }

    if let Some(hours) = time_range_hours {
        let timestamp_threshold = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64 - (hours as i64 * 3600);
        conditions.push("timestamp > ?".to_string());
        params.push(timestamp_threshold.to_string());
    }

    if !conditions.is_empty() {
        query = format!("{} WHERE {}", query, conditions.join(" AND "));
    }

    query = format!("{} ORDER BY timestamp DESC", query);

    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let metrics_iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        Ok(PerformanceProfiler {
            operation_name: row.get(1)?,
            cpu_usage: row.get(2)?,
            memory_usage: row.get::<_, i64>(3)? as u64,
            response_time: row.get::<_, i64>(4)? as u64,
            throughput: row.get(5)?,
            error_rate: row.get(6)?,
            timestamp: row.get(7)?,
        })
    }).map_err(|e| format!("Failed to query performance metrics: {}", e))?;

    let mut metrics = Vec::new();
    for metric_result in metrics_iter {
        match metric_result {
            Ok(metric) => metrics.push(metric),
            Err(e) => warn!("Failed to parse performance metric: {}", e),
        }
    }

    Ok(metrics)
}

/// Set debug level for runtime logging
#[command]
pub async fn set_debug_level(level: String) -> Result<(), String> {
    match level.as_str() {
        "Trace" => log::set_max_level(log::LevelFilter::Trace),
        "Debug" => log::set_max_level(log::LevelFilter::Debug),
        "Info" => log::set_max_level(log::LevelFilter::Info),
        "Warn" => log::set_max_level(log::LevelFilter::Warn),
        "Error" => log::set_max_level(log::LevelFilter::Error),
        _ => return Err("Invalid log level".to_string()),
    }

    info!("Debug level set to: {}", level);
    Ok(())
}

/// Clear old debug entries to manage database size
#[command]
pub async fn cleanup_old_debug_entries(
    days_to_keep: u32,
    db: State<'_, AgentDb>,
) -> Result<u64, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let timestamp_threshold = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64 - (days_to_keep as i64 * 24 * 3600);

    let deleted_count = conn.execute(
        "DELETE FROM debug_logs WHERE timestamp < ?",
        [timestamp_threshold],
    ).map_err(|e| format!("Failed to cleanup debug entries: {}", e))?;

    // Also cleanup old performance metrics
    let perf_deleted = conn.execute(
        "DELETE FROM performance_metrics WHERE timestamp < ?",
        [timestamp_threshold],
    ).map_err(|e| format!("Failed to cleanup performance metrics: {}", e))?;

    let total_deleted = deleted_count + perf_deleted;
    info!("Cleaned up {} old debug/performance entries", total_deleted);
    
    Ok(total_deleted as u64)
}