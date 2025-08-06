use anyhow::Result;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use log::{info, warn, error};

use super::agents::AgentDb;

/// Represents a session message for storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub id: String,
    pub session_id: String,
    pub project_id: String,
    pub sequence_number: i64,
    pub message_type: String, // "user", "assistant", "system", "result"
    pub content: JsonValue,
    pub timestamp: i64,
    pub model_used: Option<String>,
    pub tokens_used: Option<i32>,
    pub is_gemini: bool,
}

/// Enhanced session metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub session_id: String,
    pub project_id: String,
    pub project_path: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: i64,
    pub total_tokens: i64,
    pub first_message: Option<String>,
    pub last_model_used: Option<String>,
    pub is_gemini_session: bool,
    pub status: String, // "active", "completed", "error"
}

/// Initialize session management tables
pub async fn init_session_tables(db: &State<'_, AgentDb>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // Create sessions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            session_id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            project_path TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            message_count INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            first_message TEXT,
            last_model_used TEXT,
            is_gemini_session BOOLEAN DEFAULT 0,
            status TEXT DEFAULT 'active'
        )",
        [],
    ).map_err(|e| format!("Failed to create sessions table: {}", e))?;

    // Create session messages table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS session_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            sequence_number INTEGER NOT NULL,
            message_type TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            model_used TEXT,
            tokens_used INTEGER,
            is_gemini BOOLEAN DEFAULT 0,
            FOREIGN KEY(session_id) REFERENCES chat_sessions(session_id),
            UNIQUE(session_id, sequence_number)
        )",
        [],
    ).map_err(|e| format!("Failed to create session_messages table: {}", e))?;

    // Create indexes for better performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON session_messages(session_id)",
        [],
    ).map_err(|e| format!("Failed to create session index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_session_messages_timestamp ON session_messages(timestamp)",
        [],
    ).map_err(|e| format!("Failed to create timestamp index: {}", e))?;

    info!("Session management tables initialized successfully");
    Ok(())
}

/// Store a message in the session
pub async fn store_session_message(
    session_id: &str,
    project_id: &str,
    project_path: &str,
    message_type: &str,
    content: JsonValue,
    model_used: Option<String>,
    tokens_used: Option<i32>,
    is_gemini: bool,
    db: &State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    
    // Get next sequence number
    let sequence_number: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM session_messages WHERE session_id = ?",
        [session_id],
        |row| row.get(0),
    ).unwrap_or(1);

    let message_id = format!("{}-{}", session_id, sequence_number);
    let content_str = serde_json::to_string(&content)
        .map_err(|e| format!("Failed to serialize content: {}", e))?;

    // Insert the message
    conn.execute(
        "INSERT OR REPLACE INTO session_messages 
         (id, session_id, project_id, sequence_number, message_type, content, timestamp, model_used, tokens_used, is_gemini)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            message_id,
            session_id,
            project_id,
            sequence_number,
            message_type,
            content_str,
            timestamp,
            model_used,
            tokens_used,
            is_gemini
        ],
    ).map_err(|e| format!("Failed to insert message: {}", e))?;

    // Update or create session metadata
    upsert_session_metadata(session_id, project_id, project_path, model_used.as_deref(), tokens_used.unwrap_or(0), is_gemini, &conn)?;

    info!("Stored message {} for session {}", message_id, session_id);
    Ok(())
}

/// Update session metadata
fn upsert_session_metadata(
    session_id: &str,
    project_id: &str,
    project_path: &str,
    model_used: Option<&str>,
    tokens_used: i32,
    is_gemini: bool,
    conn: &rusqlite::Connection,
) -> Result<(), String> {
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

    // Check if session exists
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM chat_sessions WHERE session_id = ?",
        [session_id],
        |row| row.get(0),
    ).unwrap_or(false);

    if exists {
        // Update existing session
        conn.execute(
            "UPDATE chat_sessions 
             SET updated_at = ?, 
                 message_count = message_count + 1,
                 total_tokens = total_tokens + ?,
                 last_model_used = COALESCE(?, last_model_used)
             WHERE session_id = ?",
            params![timestamp, tokens_used, model_used, session_id],
        ).map_err(|e| format!("Failed to update session metadata: {}", e))?;
    } else {
        // Create new session
        conn.execute(
            "INSERT INTO chat_sessions 
             (session_id, project_id, project_path, created_at, updated_at, message_count, total_tokens, last_model_used, is_gemini_session)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)",
            params![session_id, project_id, project_path, timestamp, timestamp, tokens_used, model_used, is_gemini],
        ).map_err(|e| format!("Failed to create session metadata: {}", e))?;
    }

    Ok(())
}

/// Load all messages for a session
pub async fn load_session_messages(
    session_id: &str,
    project_id: &str,
    db: &State<'_, AgentDb>,
) -> Result<Vec<JsonValue>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT content FROM session_messages 
         WHERE session_id = ? AND project_id = ?
         ORDER BY sequence_number ASC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let message_iter = stmt.query_map(
        params![session_id, project_id],
        |row| {
            let content_str: String = row.get(0)?;
            Ok(content_str)
        },
    ).map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut messages = Vec::new();
    for message_result in message_iter {
        if let Ok(content_str) = message_result {
            if let Ok(content) = serde_json::from_str::<JsonValue>(&content_str) {
                messages.push(content);
            } else {
                warn!("Failed to parse message content: {}", content_str);
            }
        }
    }

    info!("Loaded {} messages for session {}", messages.len(), session_id);
    Ok(messages)
}

/// Create an empty session
pub async fn create_empty_session(
    session_id: &str,
    project_id: &str,
    project_path: &str,
    is_gemini: bool,
    db: &State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;

    conn.execute(
        "INSERT OR IGNORE INTO chat_sessions 
         (session_id, project_id, project_path, created_at, updated_at, message_count, total_tokens, is_gemini_session)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?)",
        params![session_id, project_id, project_path, timestamp, timestamp, is_gemini],
    ).map_err(|e| format!("Failed to create empty session: {}", e))?;

    info!("Created empty session {} for project {}", session_id, project_id);
    Ok(())
}

/// Get session metadata
pub async fn get_session_metadata(
    session_id: &str,
    db: &State<'_, AgentDb>,
) -> Result<Option<SessionMetadata>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let result = conn.query_row(
        "SELECT session_id, project_id, project_path, created_at, updated_at, 
                message_count, total_tokens, first_message, last_model_used, 
                is_gemini_session, status
         FROM chat_sessions WHERE session_id = ?",
        [session_id],
        |row| {
            Ok(SessionMetadata {
                session_id: row.get(0)?,
                project_id: row.get(1)?,
                project_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                message_count: row.get(5)?,
                total_tokens: row.get(6)?,
                first_message: row.get(7)?,
                last_model_used: row.get(8)?,
                is_gemini_session: row.get(9)?,
                status: row.get(10)?,
            })
        },
    );

    match result {
        Ok(metadata) => Ok(Some(metadata)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get session metadata: {}", e)),
    }
}

/// List all sessions for a project
pub async fn list_project_sessions(
    project_id: &str,
    db: &State<'_, AgentDb>,
) -> Result<Vec<SessionMetadata>, String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT session_id, project_id, project_path, created_at, updated_at, 
                message_count, total_tokens, first_message, last_model_used, 
                is_gemini_session, status
         FROM chat_sessions 
         WHERE project_id = ?
         ORDER BY updated_at DESC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let session_iter = stmt.query_map(
        [project_id],
        |row| {
            Ok(SessionMetadata {
                session_id: row.get(0)?,
                project_id: row.get(1)?,
                project_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                message_count: row.get(5)?,
                total_tokens: row.get(6)?,
                first_message: row.get(7)?,
                last_model_used: row.get(8)?,
                is_gemini_session: row.get(9)?,
                status: row.get(10)?,
            })
        },
    ).map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut sessions = Vec::new();
    for session_result in session_iter {
        if let Ok(session) = session_result {
            sessions.push(session);
        }
    }

    Ok(sessions)
}

/// Store a streaming message from Claude or Gemini
#[tauri::command]
pub async fn store_streaming_message(
    session_id: String,
    project_id: String,
    project_path: String,
    message: JsonValue,
    is_gemini: bool,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    // Ensure session tables are initialized
    let _ = init_session_tables(&db).await;
    
    let message_type = message.get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");
    
    let model_used = message.get("model")
        .and_then(|m| m.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            // For system messages, try to extract model from content
            if message_type == "system" {
                message.get("model").and_then(|m| m.as_str()).map(|s| s.to_string())
            } else {
                None
            }
        });

    let tokens_used = message.get("usage")
        .and_then(|u| u.get("total_tokens"))
        .and_then(|t| t.as_i64())
        .map(|t| t as i32)
        .or_else(|| {
            // Try input_tokens + output_tokens
            if let (Some(input), Some(output)) = (
                message.get("usage").and_then(|u| u.get("input_tokens")).and_then(|t| t.as_i64()),
                message.get("usage").and_then(|u| u.get("output_tokens")).and_then(|t| t.as_i64())
            ) {
                Some((input + output) as i32)
            } else {
                None
            }
        });

    store_session_message(
        &session_id,
        &project_id,
        &project_path,
        message_type,
        message.clone(),
        model_used,
        tokens_used,
        is_gemini,
        &db,
    ).await?;

    Ok(())
}

/// Delete a session and all its messages
#[tauri::command]
pub async fn delete_session(
    session_id: String,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // Delete messages first (foreign key constraint)
    conn.execute(
        "DELETE FROM session_messages WHERE session_id = ?",
        [&session_id],
    ).map_err(|e| format!("Failed to delete session messages: {}", e))?;

    // Delete session metadata
    conn.execute(
        "DELETE FROM chat_sessions WHERE session_id = ?",
        [&session_id],
    ).map_err(|e| format!("Failed to delete session: {}", e))?;

    info!("Deleted session {} and all its messages", session_id);
    Ok(())
}

/// Enhanced load session history command that works with both Claude and Gemini
#[tauri::command]
pub async fn load_session_history_enhanced(
    session_id: String,
    project_id: String,
    db: State<'_, AgentDb>,
) -> Result<Vec<JsonValue>, String> {
    info!("Loading session history for session: {} in project: {}", session_id, project_id);

    // Ensure session tables are initialized
    let _ = init_session_tables(&db).await;

    // First check if we have this session in our database
    match load_session_messages(&session_id, &project_id, &db).await {
        Ok(messages) if !messages.is_empty() => {
            info!("Loaded {} messages from internal database", messages.len());
            return Ok(messages);
        }
        Ok(_) => {
            info!("No messages found in internal database, checking file system");
        }
        Err(e) => {
            warn!("Failed to load from database: {}, falling back to file system", e);
        }
    }

    // Fallback to original file system approach for Claude sessions
    match super::claude::load_session_history(session_id.clone(), project_id.clone()).await {
        Ok(messages) if !messages.is_empty() => {
            info!("Loaded {} messages from file system", messages.len());
            
            // Store these messages in our database for future use
            for (index, message) in messages.iter().enumerate() {
                let message_type = message.get("type")
                    .and_then(|t| t.as_str())
                    .unwrap_or("unknown");
                
                let model_used = message.get("model")
                    .and_then(|m| m.as_str())
                    .map(|s| s.to_string());

                let tokens_used = message.get("usage")
                    .and_then(|u| u.get("total_tokens"))
                    .and_then(|t| t.as_i64())
                    .map(|t| t as i32);

                if let Err(e) = store_session_message(
                    &session_id,
                    &project_id,
                    "", // project_path not available here
                    message_type,
                    message.clone(),
                    model_used,
                    tokens_used,
                    false, // Not a Gemini session
                    &db,
                ).await {
                    warn!("Failed to store message {} in database: {}", index, e);
                }
            }
            
            Ok(messages)
        }
        Ok(_) => {
            // No messages found anywhere, create empty session
            info!("No messages found, creating empty session");
            create_empty_session(&session_id, &project_id, "", false, &db).await?;
            Ok(Vec::new())
        }
        Err(_) => {
            // File system approach failed too, create empty session
            info!("File system approach failed, creating empty session");
            create_empty_session(&session_id, &project_id, "", false, &db).await?;
            Ok(Vec::new())
        }
    }
}