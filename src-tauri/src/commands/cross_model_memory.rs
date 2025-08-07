use anyhow::{Context as AnyhowContext, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;
use uuid::Uuid;

use super::agents::AgentDb;

/// Memory priority levels for context selection
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum MemoryPriority {
    Critical,  // Must be preserved
    High,      // Important context
    Medium,    // Useful context
    Low,       // Optional context
}

/// Memory type classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MemoryType {
    Conversation,    // Chat messages
    WorkContext,     // Project files, code
    ToolUsage,       // Tool invocations and results
    SystemPrompt,    // Model instructions
    ProjectMetadata, // Project configuration
}

/// A single memory entry in the cross-model store
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub session_id: String,
    pub model: String,
    pub memory_type: MemoryType,
    pub priority: MemoryPriority,
    pub content: String,
    pub metadata: HashMap<String, String>,
    pub token_count: i32,
    pub relevance_score: f32,
    pub created_at: DateTime<Utc>,
    pub accessed_at: DateTime<Utc>,
    pub access_count: i32,
}

/// Context summary for efficient transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSummary {
    pub session_id: String,
    pub original_model: String,
    pub summary: String,
    pub key_points: Vec<String>,
    pub token_count: i32,
    pub created_at: DateTime<Utc>,
}

/// Cross-model memory configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub max_memory_mb: usize,           // Maximum memory usage in MB
    pub max_tokens_per_session: i32,    // Token limit per session
    pub compression_threshold: i32,     // Compress when tokens exceed this
    pub relevance_threshold: f32,       // Minimum relevance score to keep
    pub gc_interval_minutes: i32,       // Garbage collection interval
    pub auto_summarize: bool,            // Auto-summarize long contexts
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 10,
            max_tokens_per_session: 100000,
            compression_threshold: 50000,
            relevance_threshold: 0.3,
            gc_interval_minutes: 30,
            auto_summarize: true,
        }
    }
}

/// Statistics for memory usage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    pub total_entries: i64,
    pub total_tokens: i64,
    pub memory_usage_mb: f64,
    pub sessions_count: i32,
    pub models_count: i32,
    pub last_gc_run: Option<DateTime<Utc>>,
}

/// Initialize cross-model memory tables
pub async fn init_memory_tables(db: &AgentDb) -> Result<()> {
    let conn = db.0.lock().map_err(|e| anyhow::anyhow!("Failed to lock database: {}", e))?;
    
    // Main memory store table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cross_model_memory (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            model TEXT NOT NULL,
            memory_type TEXT NOT NULL,
            priority TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT NOT NULL,
            token_count INTEGER NOT NULL,
            relevance_score REAL NOT NULL,
            created_at TEXT NOT NULL,
            accessed_at TEXT NOT NULL,
            access_count INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // Context summaries table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS context_summaries (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            original_model TEXT NOT NULL,
            summary TEXT NOT NULL,
            key_points TEXT NOT NULL,
            token_count INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )",
        [],
    )?;
    
    // Memory configuration table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS memory_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            max_memory_mb INTEGER NOT NULL,
            max_tokens_per_session INTEGER NOT NULL,
            compression_threshold INTEGER NOT NULL,
            relevance_threshold REAL NOT NULL,
            gc_interval_minutes INTEGER NOT NULL,
            auto_summarize BOOLEAN NOT NULL
        )",
        [],
    )?;
    
    // Insert default config if not exists
    conn.execute(
        "INSERT OR IGNORE INTO memory_config (
            id, max_memory_mb, max_tokens_per_session, compression_threshold,
            relevance_threshold, gc_interval_minutes, auto_summarize
        ) VALUES (1, ?, ?, ?, ?, ?, ?)",
        params![
            10, 100000, 50000, 0.3, 30, true
        ],
    )?;
    
    // Create indexes for performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_memory_session ON cross_model_memory(session_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_memory_model ON cross_model_memory(model)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_memory_relevance ON cross_model_memory(relevance_score)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_summary_session ON context_summaries(session_id)",
        [],
    )?;
    
    Ok(())
}

/// Store memory entry
#[tauri::command]
pub async fn store_memory_entry(
    db: State<'_, AgentDb>,
    session_id: String,
    model: String,
    memory_type: String,
    content: String,
    metadata: HashMap<String, String>,
    priority: Option<String>,
) -> Result<MemoryEntry, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let memory_type = serde_json::from_str::<MemoryType>(&format!("\"{}\"", memory_type))
        .map_err(|e| format!("Invalid memory type: {}", e))?;
    
    let priority = priority
        .and_then(|p| serde_json::from_str::<MemoryPriority>(&format!("\"{}\"", p)).ok())
        .unwrap_or(MemoryPriority::Medium);
    
    let entry = MemoryEntry {
        id: Uuid::new_v4().to_string(),
        session_id: session_id.clone(),
        model: model.clone(),
        memory_type,
        priority: priority.clone(),
        content: content.clone(),
        metadata: metadata.clone(),
        token_count: estimate_token_count(&content),
        relevance_score: 1.0, // Initial relevance is maximum
        created_at: Utc::now(),
        accessed_at: Utc::now(),
        access_count: 0,
    };
    
    conn.execute(
        "INSERT INTO cross_model_memory (
            id, session_id, model, memory_type, priority, content, metadata,
            token_count, relevance_score, created_at, accessed_at, access_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            entry.id,
            entry.session_id,
            entry.model,
            serde_json::to_string(&entry.memory_type).unwrap(),
            serde_json::to_string(&entry.priority).unwrap(),
            entry.content,
            serde_json::to_string(&entry.metadata).unwrap(),
            entry.token_count,
            entry.relevance_score,
            entry.created_at.to_rfc3339(),
            entry.accessed_at.to_rfc3339(),
            entry.access_count,
        ],
    ).map_err(|e| format!("Failed to store memory entry: {}", e))?;
    
    Ok(entry)
}

/// Retrieve memory for a target model
#[tauri::command]
pub async fn retrieve_memory_for_model(
    db: State<'_, AgentDb>,
    session_id: String,
    _target_model: String,
    max_tokens: Option<i32>,
) -> Result<Vec<MemoryEntry>, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let max_tokens = max_tokens.unwrap_or(50000);
    
    // Get relevant memories ordered by priority and relevance
    let mut stmt = conn.prepare(
        "SELECT id, session_id, model, memory_type, priority, content, metadata,
         token_count, relevance_score, created_at, accessed_at, access_count
         FROM cross_model_memory
         WHERE session_id = ?
         ORDER BY 
            CASE priority 
                WHEN '\"Critical\"' THEN 0
                WHEN '\"High\"' THEN 1
                WHEN '\"Medium\"' THEN 2
                WHEN '\"Low\"' THEN 3
            END,
            relevance_score DESC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let entries = stmt.query_map(params![session_id], |row| {
        Ok(MemoryEntry {
            id: row.get(0)?,
            session_id: row.get(1)?,
            model: row.get(2)?,
            memory_type: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or(MemoryType::Conversation),
            priority: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or(MemoryPriority::Medium),
            content: row.get(5)?,
            metadata: serde_json::from_str(&row.get::<_, String>(6)?).unwrap_or_default(),
            token_count: row.get(7)?,
            relevance_score: row.get(8)?,
            created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                .unwrap_or_else(|_| Utc::now().into())
                .with_timezone(&Utc),
            accessed_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(10)?)
                .unwrap_or_else(|_| Utc::now().into())
                .with_timezone(&Utc),
            access_count: row.get(11)?,
        })
    }).map_err(|e| format!("Failed to query memories: {}", e))?;
    
    let mut selected_entries = Vec::new();
    let mut total_tokens = 0;
    
    for entry_result in entries {
        let mut entry = entry_result.map_err(|e| format!("Failed to parse entry: {}", e))?;
        
        if total_tokens + entry.token_count > max_tokens {
            break;
        }
        
        // Update access statistics
        conn.execute(
            "UPDATE cross_model_memory SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?",
            params![Utc::now().to_rfc3339(), entry.id],
        ).ok();
        
        total_tokens += entry.token_count;
        entry.access_count += 1;
        entry.accessed_at = Utc::now();
        selected_entries.push(entry);
    }
    
    Ok(selected_entries)
}

/// Create a context summary for efficient transfer
#[tauri::command]
pub async fn create_context_summary(
    db: State<'_, AgentDb>,
    session_id: String,
    original_model: String,
) -> Result<ContextSummary, String> {
    // Get all memories for the session
    let memories = retrieve_memory_for_model(
        db.clone(),
        session_id.clone(),
        original_model.clone(),
        None
    ).await?;
    
    // Generate summary (simplified version - in production, use AI for better summarization)
    let mut key_points = Vec::new();
    let mut summary_parts = Vec::new();
    
    for memory in &memories {
        match memory.memory_type {
            MemoryType::Conversation => {
                if memory.priority == MemoryPriority::Critical || memory.priority == MemoryPriority::High {
                    key_points.push(memory.content.chars().take(100).collect());
                }
            },
            MemoryType::WorkContext => {
                summary_parts.push(format!("Working on: {}", memory.content.chars().take(50).collect::<String>()));
            },
            MemoryType::ToolUsage => {
                if let Some(tool_name) = memory.metadata.get("tool_name") {
                    key_points.push(format!("Used tool: {}", tool_name));
                }
            },
            _ => {}
        }
    }
    
    let summary = ContextSummary {
        session_id: session_id.clone(),
        original_model: original_model.clone(),
        summary: summary_parts.join("\n"),
        key_points: key_points.into_iter().take(10).collect(),
        token_count: estimate_token_count(&summary_parts.join("\n")),
        created_at: Utc::now(),
    };
    
    // Store the summary
    {
        let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
        conn.execute(
        "INSERT INTO context_summaries (id, session_id, original_model, summary, key_points, token_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            Uuid::new_v4().to_string(),
            summary.session_id,
            summary.original_model,
            summary.summary,
            serde_json::to_string(&summary.key_points).unwrap(),
            summary.token_count,
            summary.created_at.to_rfc3339(),
        ],
    ).map_err(|e| format!("Failed to store summary: {}", e))?;
    }
    
    Ok(summary)
}

/// Get memory statistics
#[tauri::command]
pub async fn get_memory_stats(db: State<'_, AgentDb>) -> Result<MemoryStats, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let total_entries: i64 = conn.query_row(
        "SELECT COUNT(*) FROM cross_model_memory",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    
    let total_tokens: i64 = conn.query_row(
        "SELECT COALESCE(SUM(token_count), 0) FROM cross_model_memory",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    
    let sessions_count: i32 = conn.query_row(
        "SELECT COUNT(DISTINCT session_id) FROM cross_model_memory",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    
    let models_count: i32 = conn.query_row(
        "SELECT COUNT(DISTINCT model) FROM cross_model_memory",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    
    // Estimate memory usage (rough approximation)
    let memory_usage_mb = (total_entries as f64 * 0.001) + (total_tokens as f64 * 0.0001);
    
    Ok(MemoryStats {
        total_entries,
        total_tokens,
        memory_usage_mb,
        sessions_count,
        models_count,
        last_gc_run: None,
    })
}

/// Update memory relevance score
#[tauri::command]
pub async fn update_memory_relevance(
    db: State<'_, AgentDb>,
    memory_id: String,
    relevance_score: f32,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    conn.execute(
        "UPDATE cross_model_memory SET relevance_score = ? WHERE id = ?",
        params![relevance_score, memory_id],
    ).map_err(|e| format!("Failed to update relevance: {}", e))?;
    
    Ok(())
}

/// Garbage collect old/irrelevant memories
#[tauri::command]
pub async fn garbage_collect_memory(db: State<'_, AgentDb>) -> Result<i32, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    // Get configuration
    let config: MemoryConfig = conn.query_row(
        "SELECT max_memory_mb, max_tokens_per_session, compression_threshold,
         relevance_threshold, gc_interval_minutes, auto_summarize
         FROM memory_config WHERE id = 1",
        [],
        |row| {
            Ok(MemoryConfig {
                max_memory_mb: row.get(0)?,
                max_tokens_per_session: row.get(1)?,
                compression_threshold: row.get(2)?,
                relevance_threshold: row.get(3)?,
                gc_interval_minutes: row.get(4)?,
                auto_summarize: row.get(5)?,
            })
        },
    ).unwrap_or_default();
    
    // Delete low relevance memories that haven't been accessed recently
    let cutoff_date = Utc::now() - chrono::Duration::days(7);
    let deleted = conn.execute(
        "DELETE FROM cross_model_memory 
         WHERE relevance_score < ? 
         AND accessed_at < ? 
         AND priority NOT IN ('\"Critical\"', '\"High\"')",
        params![config.relevance_threshold, cutoff_date.to_rfc3339()],
    ).map_err(|e| format!("Failed to garbage collect: {}", e))?;
    
    Ok(deleted as i32)
}

/// Get memory configuration
#[tauri::command]
pub async fn get_memory_config(db: State<'_, AgentDb>) -> Result<MemoryConfig, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let config = conn.query_row(
        "SELECT max_memory_mb, max_tokens_per_session, compression_threshold,
         relevance_threshold, gc_interval_minutes, auto_summarize
         FROM memory_config WHERE id = 1",
        [],
        |row| {
            Ok(MemoryConfig {
                max_memory_mb: row.get(0)?,
                max_tokens_per_session: row.get(1)?,
                compression_threshold: row.get(2)?,
                relevance_threshold: row.get(3)?,
                gc_interval_minutes: row.get(4)?,
                auto_summarize: row.get(5)?,
            })
        },
    ).unwrap_or_default();
    
    Ok(config)
}

/// Update memory configuration
#[tauri::command]
pub async fn update_memory_config(
    db: State<'_, AgentDb>,
    config: MemoryConfig,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    conn.execute(
        "UPDATE memory_config SET 
         max_memory_mb = ?, max_tokens_per_session = ?, compression_threshold = ?,
         relevance_threshold = ?, gc_interval_minutes = ?, auto_summarize = ?
         WHERE id = 1",
        params![
            config.max_memory_mb,
            config.max_tokens_per_session,
            config.compression_threshold,
            config.relevance_threshold,
            config.gc_interval_minutes,
            config.auto_summarize,
        ],
    ).map_err(|e| format!("Failed to update config: {}", e))?;
    
    Ok(())
}

/// Clear memory for a specific session
#[tauri::command]
pub async fn clear_session_memory(
    db: State<'_, AgentDb>,
    session_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    conn.execute(
        "DELETE FROM cross_model_memory WHERE session_id = ?",
        params![session_id],
    ).map_err(|e| format!("Failed to clear session memory: {}", e))?;
    
    conn.execute(
        "DELETE FROM context_summaries WHERE session_id = ?",
        params![session_id],
    ).map_err(|e| format!("Failed to clear session summaries: {}", e))?;
    
    Ok(())
}

/// Search memories by content
#[tauri::command]
pub async fn search_memories(
    db: State<'_, AgentDb>,
    query: String,
    session_id: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<MemoryEntry>, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let limit = limit.unwrap_or(50);
    
    let search_pattern = format!("%{}%", query);
    
    let (sql, params): (String, Vec<&dyn rusqlite::ToSql>) = if let Some(ref sid) = session_id {
        (format!(
            "SELECT id, session_id, model, memory_type, priority, content, metadata,
             token_count, relevance_score, created_at, accessed_at, access_count
             FROM cross_model_memory
             WHERE session_id = ? AND content LIKE ?
             ORDER BY relevance_score DESC
             LIMIT {}",
            limit
        ), vec![sid as &dyn rusqlite::ToSql, &search_pattern as &dyn rusqlite::ToSql])
    } else {
        (format!(
            "SELECT id, session_id, model, memory_type, priority, content, metadata,
             token_count, relevance_score, created_at, accessed_at, access_count
             FROM cross_model_memory
             WHERE content LIKE ?
             ORDER BY relevance_score DESC
             LIMIT {}",
            limit
        ), vec![&search_pattern as &dyn rusqlite::ToSql])
    };
    
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let entries = stmt.query_map(params.as_slice(), |row| {
        Ok(MemoryEntry {
            id: row.get(0)?,
            session_id: row.get(1)?,
            model: row.get(2)?,
            memory_type: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or(MemoryType::Conversation),
            priority: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or(MemoryPriority::Medium),
            content: row.get(5)?,
            metadata: serde_json::from_str(&row.get::<_, String>(6)?).unwrap_or_default(),
            token_count: row.get(7)?,
            relevance_score: row.get(8)?,
            created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                .unwrap_or_else(|_| Utc::now().into())
                .with_timezone(&Utc),
            accessed_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(10)?)
                .unwrap_or_else(|_| Utc::now().into())
                .with_timezone(&Utc),
            access_count: row.get(11)?,
        })
    }).map_err(|e| format!("Failed to query memories: {}", e))?;
    
    let results: Result<Vec<_>, _> = entries.collect();
    results.map_err(|e| format!("Failed to collect results: {}", e))
}

/// Merge memories from multiple sessions
#[tauri::command]
pub async fn merge_session_memories(
    db: State<'_, AgentDb>,
    session_ids: Vec<String>,
    target_session_id: String,
) -> Result<i32, String> {
    let conn = db.0.lock().map_err(|e| format!("Failed to lock database: {}", e))?;
    
    let mut merged_count = 0;
    
    for source_id in session_ids {
        if source_id == target_session_id {
            continue;
        }
        
        // Copy memories from source to target
        let count = conn.execute(
            "INSERT INTO cross_model_memory (
                id, session_id, model, memory_type, priority, content, metadata,
                token_count, relevance_score, created_at, accessed_at, access_count
            )
            SELECT 
                lower(hex(randomblob(16))), ?, model, memory_type, priority, content, metadata,
                token_count, relevance_score * 0.9, created_at, accessed_at, access_count
            FROM cross_model_memory
            WHERE session_id = ?",
            params![target_session_id, source_id],
        ).map_err(|e| format!("Failed to merge memories: {}", e))?;
        
        merged_count += count;
    }
    
    Ok(merged_count as i32)
}

/// Helper function to estimate token count (simplified)
pub fn estimate_token_count(text: &str) -> i32 {
    // Rough estimation: ~4 characters per token
    (text.len() / 4) as i32
}