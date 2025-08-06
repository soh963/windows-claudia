use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use log;

/// Message deduplication manager
pub struct MessageDeduplicationManager {
    /// Track message IDs by session to prevent duplicates
    session_messages: Mutex<HashMap<String, HashSet<String>>>,
    /// Track message hashes to detect duplicate content
    message_hashes: Mutex<HashMap<String, u64>>,
    /// Track last message timestamp by session
    last_message_time: Mutex<HashMap<String, u64>>,
}

impl MessageDeduplicationManager {
    pub fn new() -> Self {
        Self {
            session_messages: Mutex::new(HashMap::new()),
            message_hashes: Mutex::new(HashMap::new()),
            last_message_time: Mutex::new(HashMap::new()),
        }
    }

    /// Check if a message is a duplicate
    pub fn is_duplicate(&self, session_id: &str, message_id: &str, content: &str) -> bool {
        let mut session_messages = self.session_messages.lock().unwrap();
        let mut message_hashes = self.message_hashes.lock().unwrap();
        let mut last_time = self.last_message_time.lock().unwrap();
        
        // Get current timestamp
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        // Check if this exact message ID was already seen
        let session_set = session_messages.entry(session_id.to_string()).or_insert_with(HashSet::new);
        if session_set.contains(message_id) {
            log::warn!("Duplicate message ID detected: {} for session: {}", message_id, session_id);
            return true;
        }
        
        // Calculate content hash
        let content_hash = calculate_hash(content);
        
        // Check if we've seen this exact content recently (within 100ms)
        if let Some(&last_timestamp) = last_time.get(session_id) {
            if current_time - last_timestamp < 100 {
                // Check content hash
                let hash_key = format!("{}:{}", session_id, content_hash);
                if message_hashes.contains_key(&hash_key) {
                    log::warn!("Duplicate content detected within 100ms for session: {}", session_id);
                    return true;
                }
            }
        }
        
        // Not a duplicate, record it
        session_set.insert(message_id.to_string());
        let hash_key = format!("{}:{}", session_id, content_hash);
        message_hashes.insert(hash_key, current_time);
        last_time.insert(session_id.to_string(), current_time);
        
        // Clean up old entries if the session has too many messages (prevent memory leak)
        if session_set.len() > 1000 {
            log::info!("Cleaning up old message IDs for session: {}", session_id);
            session_set.clear();
            session_set.insert(message_id.to_string());
        }
        
        false
    }
    
    /// Clear deduplication data for a session
    pub fn clear_session(&self, session_id: &str) {
        let mut session_messages = self.session_messages.lock().unwrap();
        let mut message_hashes = self.message_hashes.lock().unwrap();
        let mut last_time = self.last_message_time.lock().unwrap();
        
        session_messages.remove(session_id);
        last_time.remove(session_id);
        
        // Remove hashes for this session
        let prefix = format!("{}:", session_id);
        message_hashes.retain(|k, _| !k.starts_with(&prefix));
        
        log::info!("Cleared deduplication data for session: {}", session_id);
    }
    
    /// Clean up old sessions (older than 1 hour)
    pub fn cleanup_old_sessions(&self) {
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        let mut last_time = self.last_message_time.lock().unwrap();
        let mut session_messages = self.session_messages.lock().unwrap();
        let mut message_hashes = self.message_hashes.lock().unwrap();
        
        let one_hour_ms = 3600000u64; // 1 hour in milliseconds
        let mut sessions_to_remove = Vec::new();
        
        for (session_id, &timestamp) in last_time.iter() {
            if current_time - timestamp > one_hour_ms {
                sessions_to_remove.push(session_id.clone());
            }
        }
        
        for session_id in sessions_to_remove {
            last_time.remove(&session_id);
            session_messages.remove(&session_id);
            
            // Remove hashes for this session
            let prefix = format!("{}:", session_id);
            message_hashes.retain(|k, _| !k.starts_with(&prefix));
            
            log::info!("Cleaned up old session: {}", session_id);
        }
    }
}

/// Calculate a simple hash of the content
fn calculate_hash(content: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;
    
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    hasher.finish()
}

/// Session isolation manager
#[derive(Default)]
pub struct SessionIsolationManager {
    /// Active sessions with their isolation status
    active_sessions: Mutex<HashMap<String, SessionIsolationState>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionIsolationState {
    pub session_id: String,
    pub project_id: String,
    pub model: String,
    pub created_at: u64,
    pub is_isolated: bool,
    pub memory_space: String, // Unique memory space identifier
}

impl SessionIsolationManager {
    pub fn new() -> Self {
        Self {
            active_sessions: Mutex::new(HashMap::new()),
        }
    }
    
    /// Create a new isolated session
    pub fn create_isolated_session(
        &self,
        session_id: String,
        project_id: String,
        model: String,
    ) -> SessionIsolationState {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        // Create unique memory space using UUID v4 + timestamp + salt
        let salt = format!("{:x}", rand::random::<u32>());
        let memory_space = format!("{}-{}-{}", session_id, timestamp, salt);
        
        let state = SessionIsolationState {
            session_id: session_id.clone(),
            project_id,
            model,
            created_at: timestamp,
            is_isolated: true,
            memory_space,
        };
        
        let mut sessions = self.active_sessions.lock().unwrap();
        sessions.insert(session_id, state.clone());
        
        log::info!("Created isolated session: {} with memory space: {}", 
                  state.session_id, state.memory_space);
        
        state
    }
    
    /// Check if a session is properly isolated
    pub fn is_session_isolated(&self, session_id: &str) -> bool {
        let sessions = self.active_sessions.lock().unwrap();
        sessions.get(session_id)
            .map(|s| s.is_isolated)
            .unwrap_or(false)
    }
    
    /// Get session isolation state
    pub fn get_session_state(&self, session_id: &str) -> Option<SessionIsolationState> {
        let sessions = self.active_sessions.lock().unwrap();
        sessions.get(session_id).cloned()
    }
    
    /// Validate that operations don't cross session boundaries
    pub fn validate_session_boundary(
        &self,
        session_id: &str,
        operation_session_id: &str,
    ) -> Result<(), String> {
        if session_id != operation_session_id {
            log::error!("Session boundary violation: {} != {}", session_id, operation_session_id);
            return Err(format!("Session boundary violation detected"));
        }
        
        if !self.is_session_isolated(session_id) {
            log::warn!("Session {} is not properly isolated", session_id);
            return Err(format!("Session is not properly isolated"));
        }
        
        Ok(())
    }
    
    /// Clean up session
    pub fn cleanup_session(&self, session_id: &str) {
        let mut sessions = self.active_sessions.lock().unwrap();
        if sessions.remove(session_id).is_some() {
            log::info!("Cleaned up session: {}", session_id);
        }
    }
}

/// Check if a message should be processed (not a duplicate)
#[tauri::command]
pub async fn check_message_duplicate(
    session_id: String,
    message_id: String,
    content: String,
    dedup_manager: State<'_, MessageDeduplicationManager>,
) -> Result<bool, String> {
    Ok(!dedup_manager.is_duplicate(&session_id, &message_id, &content))
}

/// Clear deduplication data for a session
#[tauri::command]
pub async fn clear_session_deduplication(
    session_id: String,
    dedup_manager: State<'_, MessageDeduplicationManager>,
) -> Result<(), String> {
    dedup_manager.clear_session(&session_id);
    Ok(())
}

/// Create an isolated session
#[tauri::command]
pub async fn create_isolated_session(
    session_id: String,
    project_id: String,
    model: String,
    isolation_manager: State<'_, SessionIsolationManager>,
) -> Result<SessionIsolationState, String> {
    Ok(isolation_manager.create_isolated_session(session_id, project_id, model))
}

/// Validate session boundary
#[tauri::command]
pub async fn validate_session_boundary(
    session_id: String,
    operation_session_id: String,
    isolation_manager: State<'_, SessionIsolationManager>,
) -> Result<(), String> {
    isolation_manager.validate_session_boundary(&session_id, &operation_session_id)
}

/// Get session isolation state
#[tauri::command]
pub async fn get_session_isolation_state(
    session_id: String,
    isolation_manager: State<'_, SessionIsolationManager>,
) -> Result<Option<SessionIsolationState>, String> {
    Ok(isolation_manager.get_session_state(&session_id))
}

/// Cleanup old sessions (maintenance task)
#[tauri::command]
pub async fn cleanup_old_sessions(
    dedup_manager: State<'_, MessageDeduplicationManager>,
) -> Result<(), String> {
    dedup_manager.cleanup_old_sessions();
    Ok(())
}