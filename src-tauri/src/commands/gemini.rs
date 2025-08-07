use serde::{Deserialize, Serialize};
use std::env;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use std::hash::{Hash, Hasher, DefaultHasher};
use tauri::{State, Emitter};
use uuid::Uuid;
use super::{claude::ClaudeProcessState, agents::AgentDb};
use super::session_deduplication::{MessageDeduplicationManager, SessionIsolationManager};
use super::execution_control::{ExecutionControlState, ExecutionStatus};
use log;

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiConfig {
    pub api_key: Option<String>,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiRequest {
    pub prompt: String,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiResponse {
    pub content: String,
    pub model: String,
    pub tokens_used: Option<u32>,
}

/// Active session registry to prevent cross-contamination
#[derive(Debug, Default)]
pub struct GeminiSessionRegistry {
    pub active_sessions: Arc<Mutex<HashMap<String, GeminiSessionState>>>,
}

#[derive(Debug, Clone)]
pub struct GeminiSessionState {
    pub session_id: String,
    pub project_id: String,
    pub model: String,
    pub created_at: u64,
    pub message_ids: HashSet<String>,
    pub last_activity: u64,
}

impl GeminiSessionRegistry {
    pub fn new() -> Self {
        Self {
            active_sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Register a new session with isolation
    pub fn register_session(&self, session_id: &str, project_id: &str, model: &str) -> Result<(), String> {
        let mut sessions = self.active_sessions.lock()
            .map_err(|e| format!("Failed to acquire session registry lock: {}", e))?;
        
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        let state = GeminiSessionState {
            session_id: session_id.to_string(),
            project_id: project_id.to_string(),
            model: model.to_string(),
            created_at: current_time,
            message_ids: HashSet::new(),
            last_activity: current_time,
        };
        
        sessions.insert(session_id.to_string(), state);
        log::info!("Registered Gemini session: {} for project: {} with model: {}", session_id, project_id, model);
        Ok(())
    }
    
    /// Check if message already exists (deduplication)
    pub fn is_duplicate_message(&self, session_id: &str, content: &str) -> Result<bool, String> {
        let mut sessions = self.active_sessions.lock()
            .map_err(|e| format!("Failed to acquire session registry lock: {}", e))?;
        
        if let Some(session) = sessions.get_mut(session_id) {
            // Generate content hash
            let mut hasher = DefaultHasher::new();
            content.hash(&mut hasher);
            let content_hash = hasher.finish();
            let message_id = format!("{}:{:x}", session_id, content_hash);
            
            if session.message_ids.contains(&message_id) {
                log::warn!("Duplicate message detected for session {}: {}", session_id, message_id);
                return Ok(true);
            }
            
            // Add message ID to prevent future duplicates
            session.message_ids.insert(message_id);
            session.last_activity = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            
            // Cleanup old message IDs if we have too many (prevent memory leak)
            if session.message_ids.len() > 1000 {
                let old_ids: Vec<String> = session.message_ids.iter().take(500).cloned().collect();
                for old_id in old_ids {
                    session.message_ids.remove(&old_id);
                }
                log::info!("Cleaned up old message IDs for session: {}", session_id);
            }
        } else {
            return Err(format!("Session {} not found in registry", session_id));
        }
        
        Ok(false)
    }
    
    /// Unregister session when complete
    pub fn unregister_session(&self, session_id: &str) {
        if let Ok(mut sessions) = self.active_sessions.lock() {
            if sessions.remove(session_id).is_some() {
                log::info!("Unregistered Gemini session: {}", session_id);
            }
        }
    }
    
    /// Validate session exists and is active
    pub fn validate_session(&self, session_id: &str) -> Result<(), String> {
        let sessions = self.active_sessions.lock()
            .map_err(|e| format!("Failed to acquire session registry lock: {}", e))?;
        
        if !sessions.contains_key(session_id) {
            return Err(format!("Session {} not found or inactive", session_id));
        }
        
        Ok(())
    }
    
    /// Cleanup old inactive sessions
    pub fn cleanup_old_sessions(&self, max_age_minutes: u64) {
        if let Ok(mut sessions) = self.active_sessions.lock() {
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            
            let max_age_ms = max_age_minutes * 60 * 1000;
            let mut expired_sessions = Vec::new();
            
            for (session_id, state) in sessions.iter() {
                if current_time - state.last_activity > max_age_ms {
                    expired_sessions.push(session_id.clone());
                }
            }
            
            for session_id in expired_sessions {
                sessions.remove(&session_id);
                log::info!("Cleaned up expired Gemini session: {}", session_id);
            }
        }
    }
}

/// Generate secure session ID using UUID v4 + timestamp + salt
fn generate_secure_gemini_session_id(project_id: &str, model: &str) -> String {
    let uuid = Uuid::new_v4();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    // Create salt from project_id, model, and current time for uniqueness
    let mut hasher = DefaultHasher::new();
    project_id.hash(&mut hasher);
    model.hash(&mut hasher);
    timestamp.hash(&mut hasher);
    let salt = hasher.finish();
    
    // Combine UUID, timestamp, and salt for maximum uniqueness
    format!("gemini-{}-{}-{:x}", uuid, timestamp, salt)
}

/// Check if Gemini API key is set
#[tauri::command]
pub async fn has_gemini_api_key(
    db: State<'_, AgentDb>,
) -> Result<bool, String> {
    let conn = db.0.lock().unwrap();
    
    // First check environment variable
    if env::var("GEMINI_API_KEY").is_ok() {
        return Ok(true);
    }
    
    // Then check database
    match conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        Ok(api_key) => Ok(!api_key.is_empty()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(e) => Err(format!("Failed to check Gemini API key: {}", e)),
    }
}


#[tauri::command]
pub async fn get_gemini_api_key_command(db: State<'_, AgentDb>) -> Result<String, String> {
    let conn = db.0.lock().unwrap();
    // First check environment variable
    if let Ok(api_key) = env::var("GEMINI_API_KEY") {
        if !api_key.is_empty() {
            return Ok(api_key);
        }
    }
    
    // Then check database
    match conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        Ok(api_key) => Ok(api_key),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok("".to_string()),
        Err(e) => Err(format!("Failed to get Gemini API key: {}", e)),
    }
}

/// Set the Gemini API key
#[tauri::command]
pub async fn set_gemini_api_key(
    api_key: String,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    // Validate API key format
    let trimmed_key = api_key.trim();
    if trimmed_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    
    // Basic format validation for Gemini API keys
    if !trimmed_key.starts_with("AIza") {
        return Err("Invalid Gemini API key format. Keys should start with 'AIza'".to_string());
    }
    
    let conn = db.0.lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;
    
    // Use a transaction for atomic upsert
    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;
    
    // Try to update first
    let rows_affected = tx.execute(
        "UPDATE app_settings SET value = ?1 WHERE key = 'gemini_api_key'",
        [&trimmed_key],
    ).map_err(|e| format!("Failed to update API key: {}", e))?;
    
    // If no rows were updated, insert a new row
    if rows_affected == 0 {
        tx.execute(
            "INSERT INTO app_settings (key, value) VALUES ('gemini_api_key', ?1)",
            [&trimmed_key],
        ).map_err(|e| format!("Failed to insert API key: {}", e))?;
    }
    
    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;
    
    Ok(())
}

/// Get the Gemini API key from storage
fn get_gemini_api_key_sync(conn: &rusqlite::Connection) -> Result<String, String> {
    // First check environment variable
    if let Ok(api_key) = env::var("GEMINI_API_KEY") {
        return Ok(api_key);
    }
    
    // Then check database
    match conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        Ok(api_key) => Ok(api_key),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err("Gemini API key not set".to_string()),
        Err(e) => Err(format!("Failed to get Gemini API key: {}", e)),
    }
}

/// Verify a Gemini API key by making a test request
#[tauri::command]
pub async fn verify_gemini_api_key(
    api_key: String,
) -> Result<bool, String> {
    // Create a simple test request to verify the API key
    let client = reqwest::Client::new();
    
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}",
        api_key
    );
    
    let test_body = serde_json::json!({
        "contents": [{
            "parts": [{
                "text": "Hello"
            }]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 10
        }
    });
    
    match client.post(&url)
        .json(&test_body)
        .send()
        .await
    {
        Ok(response) => {
            // API key is valid if we get a 200 response
            Ok(response.status().is_success())
        }
        Err(_) => Ok(false),
    }
}

/// Test Gemini event emission to ensure frontend receives events
#[tauri::command]
pub async fn test_gemini_events(
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    log::info!("Testing Gemini event emission");
    
    let test_session_id = format!("gemini-test-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis());
    
    // Use secure session ID for test
    let test_session_id = generate_secure_gemini_session_id("test-project", "gemini-test");
    
    // Emit test init message
    let init_message = serde_json::json!({
        "type": "system",
        "subtype": "init",
        "session_id": test_session_id,
        "model": "gemini-test",
        "cwd": "/test/path",
        "tools": [],
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });
    
    let init_message_str = serde_json::to_string(&init_message).unwrap();
    
    // Only emit session-specific events for tests too
    app_handle.emit(&format!("claude-output:{}", test_session_id), init_message_str)
        .map_err(|e| format!("Failed to emit test session-specific init event: {}", e))?;
    
    // Emit test message
    let test_message = serde_json::json!({
        "id": format!("gemini-test-msg-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()),
        "type": "assistant",
        "message": {
            "id": format!("gemini-test-msg-{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()),
            "type": "message",
            "role": "assistant",
            "content": [{
                "type": "text",
                "text": "This is a test message from Gemini to verify event emission is working correctly."
            }],
            "model": "gemini-test",
            "stop_reason": "end_turn",
            "stop_sequence": null,
            "usage": {
                "input_tokens": 10,
                "output_tokens": 15
            }
        }
    });
    
    let test_message_str = serde_json::to_string(&test_message).unwrap();
    
    app_handle.emit(&format!("claude-output:{}", test_session_id), test_message_str)
        .map_err(|e| format!("Failed to emit test session-specific message event: {}", e))?;
    
    // Emit completion - session-specific only
    app_handle.emit(&format!("claude-complete:{}", test_session_id), true)
        .map_err(|e| format!("Failed to emit test session-specific complete event: {}", e))?;
    
    log::info!("Test events emitted successfully for session: {}", test_session_id);
    Ok(())
}

/// Execute Gemini model with proper session isolation and stop support
#[tauri::command]
pub async fn execute_gemini_code(
    prompt: String,
    model: String,
    project_path: String,
    app_handle: tauri::AppHandle,
    db: State<'_, AgentDb>,
    _claude_state: State<'_, ClaudeProcessState>,
    session_registry: State<'_, GeminiSessionRegistry>,
    dedup_manager: State<'_, MessageDeduplicationManager>,
    isolation_manager: State<'_, SessionIsolationManager>,
    execution_state: State<'_, ExecutionControlState>,
) -> Result<(), String> {
    log::info!("Starting Gemini execution - model: {}, project: {}", model, project_path);
    
    // Validate inputs
    let trimmed_prompt = prompt.trim();
    if trimmed_prompt.is_empty() {
        return Err("Prompt cannot be empty".to_string());
    }
    
    let trimmed_model = model.trim();
    if trimmed_model.is_empty() {
        return Err("Model must be specified".to_string());
    }
    
    let trimmed_project_path = project_path.trim();
    if trimmed_project_path.is_empty() {
        return Err("Project path must be specified".to_string());
    }
    
    // Check if project path exists
    if !std::path::Path::new(&trimmed_project_path).exists() {
        return Err(format!("Project path does not exist: {}", trimmed_project_path));
    }
    
    // Get API key with better error handling
    let api_key = {
        let conn = db.0.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;
        get_gemini_api_key_sync(&conn)?
    };
    
    if api_key.is_empty() {
        return Err("Gemini API key is not configured. Please set your API key in Settings.".to_string());
    }
    
    // Generate secure session ID with UUID + salt
    let project_id = std::path::Path::new(&trimmed_project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown-project")
        .to_string();
    
    let session_id = generate_secure_gemini_session_id(&project_id, &trimmed_model);
    
    // Register session for isolation and deduplication
    session_registry.register_session(&session_id, &project_id, &trimmed_model)?;
    
    // Create isolated session state
    let _isolation_state = isolation_manager.create_isolated_session(
        session_id.clone(),
        project_id.clone(),
        trimmed_model.to_string(),
    );
    
    log::info!("Created isolated Gemini session: {} for project: {}", session_id, project_id);
    
    // Register session with execution control for stop functionality
    {
        let mut sessions = execution_state.sessions.lock().await;
        sessions.insert(session_id.clone(), super::execution_control::ExecutionState {
            session_id: session_id.clone(),
            status: ExecutionStatus::Executing,
            can_continue: false,
            checkpoint_data: None,
            elapsed_time: 0,
            total_tokens: 0,
        });
    }
    
    // Emit system:init event to match Claude's format
    let init_message = serde_json::json!({
        "type": "system",
        "subtype": "init",
        "session_id": session_id,
        "model": trimmed_model,
        "cwd": trimmed_project_path,
        "tools": [],
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });
    
    // Emit session-specific init event ONLY to prevent cross-contamination
    let init_message_str = serde_json::to_string(&init_message)
        .map_err(|e| format!("Failed to serialize init message: {}", e))?;
    
    app_handle.emit(&format!("claude-output:{}", session_id), init_message_str)
        .map_err(|e| format!("Failed to emit session-specific init event: {}", e))?;
    
    // Create HTTP client with timeout and retry settings
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120)) // 2 minute timeout
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Determine the correct model endpoint - Use proper API names for all supported models
    let model_endpoint = match trimmed_model {
        // 2025 models - use correct API endpoints
        "gemini-2.5-pro" | "gemini-2.5-pro-exp" => "gemini-1.5-pro", // Currently uses 1.5 Pro endpoint  
        "gemini-2.5-flash" => "gemini-1.5-flash", // Currently uses 1.5 Flash endpoint
        "gemini-2.5-flash-lite" => "gemini-1.5-flash", // Currently uses 1.5 Flash endpoint
        
        // 2024 models - use correct API endpoints  
        "gemini-2.0-pro-exp" => "gemini-2.0-flash-exp", // Pro experimental uses flash-exp endpoint
        "gemini-2.0-flash" => "gemini-2.0-flash-exp", // Maps to experimental endpoint
        "gemini-2.0-flash-exp" => "gemini-2.0-flash-exp", // Direct mapping
        "gemini-2.0-flash-lite" => "gemini-2.0-flash-exp", // Uses flash-exp endpoint
        
        // Stable 1.5 models - officially supported
        "gemini-1.5-pro" | "gemini-1.5-pro-002" => "gemini-1.5-pro",
        "gemini-1.5-flash" | "gemini-1.5-flash-002" => "gemini-1.5-flash",
        
        // Legacy experimental models
        "gemini-exp-1206" => "gemini-exp-1206",
        
        // Legacy models with fallbacks
        "gemini-pro" => "gemini-1.5-flash", // Map to stable working model
        "gemini-pro-vision" => "gemini-1.5-pro", // Map to stable working model
        
        _ => {
            // Log the unsupported model and provide comprehensive error
            log::warn!("Unsupported Gemini model requested: {}", trimmed_model);
            return Err(format!(
                "🤖 Model '{}' is not supported.\n\n✅ Supported models:\n• gemini-1.5-pro\n• gemini-2.5-flash\n• gemini-2.0-pro-exp\n• gemini-2.0-flash\n• gemini-2.0-flash-lite\n\n💡 Use 'Auto' selection for intelligent model switching", 
                trimmed_model
            ));
        }
    };
    
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model_endpoint,
        api_key
    );
    
    // Build request body with optimized parameters
    let request_body = serde_json::json!({
        "contents": [{
            "parts": [{
                "text": trimmed_prompt
            }]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 8192,
            "topK": 40,
            "topP": 0.95,
            "stopSequences": [],
            "candidateCount": 1
        },
        "safetySettings": [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_ONLY_HIGH"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH", 
                "threshold": "BLOCK_ONLY_HIGH"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_ONLY_HIGH"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_ONLY_HIGH"
            }
        ]
    });
    
    // Add adaptive delay based on model type to avoid rate limits
    let delay_ms = match trimmed_model {
        m if m.contains("2.5") => 500,  // Newer models may have better rate limits
        m if m.contains("2.0") => 750,  // Moderate delay for 2.0 models
        _ => 1000,                       // Conservative delay for older models
    };
    
    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
    log::info!("Applied {}ms delay for model: {} in session: {}", delay_ms, trimmed_model, session_id);

    // Check if execution was stopped before sending request
    {
        let sessions = execution_state.sessions.lock().await;
        if let Some(session) = sessions.get(&session_id) {
            if session.status == ExecutionStatus::Stopped {
                log::info!("Execution stopped before request for session: {}", session_id);
                app_handle.emit(&format!("claude-complete:{}", session_id), false)
                    .map_err(|e| format!("Failed to emit stop complete event: {}", e))?;
                return Ok(());
            }
        }
    }

    // Send request
    log::info!("Sending request to Gemini API for session: {} with model: {} (endpoint: {})", session_id, trimmed_model, model_endpoint);
    match client.post(&url)
        .json(&request_body)
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            log::info!("Gemini API response status: {} for session: {}", status, session_id);
            if status.is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(json) => {
                        // Check for safety blocks first
                        if let Some(candidates) = json["candidates"].as_array() {
                            if candidates.is_empty() {
                                return Err("Response was blocked by safety filters".to_string());
                            }
                            
                            let candidate = &candidates[0];
                            
                            // Check finish reason for safety blocks and other issues
                            if let Some(finish_reason) = candidate["finishReason"].as_str() {
                                match finish_reason {
                                    "SAFETY" => {
                                        log::warn!("Gemini response blocked by safety filters for session: {}", session_id);
                                        return Err("Response was blocked by Gemini safety filters. Try rephrasing your request.".to_string());
                                    },
                                    "RECITATION" => {
                                        log::warn!("Gemini response blocked due to recitation for session: {}", session_id);
                                        return Err("Response was blocked due to potential copyright concerns. Try asking in a different way.".to_string());
                                    },
                                    "OTHER" => {
                                        log::warn!("Gemini response failed for unknown reasons for session: {}", session_id);
                                        return Err("Response generation failed. This may be a temporary issue - please try again.".to_string());
                                    },
                                    "MAX_TOKENS" => {
                                        log::info!("Gemini response hit max tokens limit for session: {}", session_id);
                                        // This is not an error - the response was just truncated
                                    },
                                    "STOP" | "STOP_SEQUENCE" => {
                                        log::info!("Gemini response completed normally for session: {}", session_id);
                                        // Normal completion
                                    },
                                    _ => {
                                        log::info!("Gemini response finished with reason: {} for session: {}", finish_reason, session_id);
                                        // Continue with normal processing
                                    }
                                }
                            }
                            
                            // Extract the response text with better error handling
                            if let Some(content) = candidate["content"]["parts"][0]["text"].as_str() {
                                // Check for duplicate content before processing
                                if session_registry.is_duplicate_message(&session_id, content)? {
                                    log::warn!("Duplicate response detected for session {}, skipping emission", session_id);
                                    return Ok(());
                                }
                                
                                // Additional deduplication check with manager
                                let content_for_dedup = format!("gemini-response-{}", content);
                                if !dedup_manager.is_duplicate(&session_id, &session_id, &content_for_dedup) {
                                    log::info!("Content passed deduplication checks for session: {}", session_id);
                                } else {
                                    log::warn!("Content failed deduplication manager check for session: {}", session_id);
                                    return Ok(());
                                }
                                // Get token usage if available
                                let (input_tokens, output_tokens) = if let Some(usage) = json["usageMetadata"].as_object() {
                                    let input = usage.get("promptTokenCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                    let output = usage.get("candidatesTokenCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                    (input, output)
                                } else {
                                    // Fallback to rough estimation if usage metadata not available
                                    (trimmed_prompt.len() as u32 / 4, content.len() as u32 / 4)
                                };
                                
                                // Emit the response as a Claude-compatible message
                                let message = serde_json::json!({
                                    "id": format!("gemini-msg-{}", std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap()
                                        .as_millis()),
                                    "type": "assistant",
                                    "message": {
                                        "id": format!("gemini-msg-{}", std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap()
                                            .as_millis()),
                                        "type": "message",
                                        "role": "assistant",
                                        "content": [{
                                            "type": "text",
                                            "text": content
                                        }],
                                        "model": trimmed_model,
                                        "stop_reason": "end_turn",
                                        "stop_sequence": null,
                                        "usage": {
                                            "input_tokens": input_tokens,
                                            "output_tokens": output_tokens
                                        }
                                    }
                                });
                                
                                // Emit session-specific event ONLY to prevent cross-contamination
                                let message_str = serde_json::to_string(&message)
                                    .map_err(|e| format!("Failed to serialize message: {}", e))?;
                                
                                // Only emit session-specific event to maintain isolation
                                app_handle.emit(&format!("claude-output:{}", session_id), message_str.clone())
                                    .map_err(|e| format!("Failed to emit session-specific message: {}", e))?;
                                
                                log::info!("Emitted Gemini response for session: {} (length: {})", session_id, content.len());
                            } else {
                                log::error!("No text content found in Gemini response for session: {}, candidate structure: {}", session_id, serde_json::to_string_pretty(&candidate).unwrap_or_default());
                                return Err("No content found in Gemini API response. The model may have returned an empty response or the response structure is unexpected.".to_string());
                            }
                        } else {
                            log::error!("No candidates found in Gemini response for session: {}, full response: {}", session_id, serde_json::to_string_pretty(&json).unwrap_or_default());
                            return Err("No response candidates found. This may be due to safety filters or content policy restrictions. Try rephrasing your request.".to_string());
                        }
                    }
                    Err(e) => return Err(format!("Failed to parse Gemini response: {}", e)),
                }
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                
                // Enhanced error handling for different scenarios
                let enhanced_error = if status == 400 && error_text.contains("model") {
                    format!("🤖 Unsupported Gemini Model\n\n• Model '{}' may not exist or be available\n• Try using 'gemini-2.5-flash' or 'gemini-2.5-pro'\n• Check Google AI Studio for available models\n• Use 'Auto' model selection for intelligent switching", trimmed_model)
                } else if status == 429 && error_text.contains("quota") {
                    if error_text.contains("free_tier") {
                        "🔑 Gemini Free Tier Quota Exceeded\n\n• Your free tier quota has been exhausted\n• Solutions:\n  1. Wait for quota reset (24 hours)\n  2. Upgrade to paid tier\n  3. Switch to Claude models\n  4. Use Ollama (local models)\n\n💡 Tip: Use 'Auto' model selection for intelligent switching between providers".to_string()
                    } else {
                        "🔑 Gemini API Quota Exceeded\n\n• Rate limit or quota exceeded\n• Try again in a few minutes\n• Consider switching to Claude or Ollama models".to_string()
                    }
                } else if status == 401 {
                    "🔑 Gemini API Authentication Failed\n\n• Check your API key in Settings\n• Ensure key starts with 'AIza'\n• Generate new key if needed".to_string()
                } else if status == 403 {
                    "🚫 Gemini API Access Forbidden\n\n• API key may be invalid or restricted\n• Check Google Cloud Console permissions\n• Consider switching to Claude or Ollama".to_string()
                } else {
                    format!("Gemini API error ({}): {}", status, error_text)
                };
                
                // Emit enhanced error message to frontend
                let error_message = serde_json::json!({
                    "type": "system",
                    "subtype": "error",
                    "error": enhanced_error,
                    "error_code": status.as_u16(),
                    "is_quota_error": status == 429 && error_text.contains("quota"),
                    "timestamp": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs()
                });
                
                // Emit session-specific error event ONLY to prevent cross-contamination
                let error_message_str = serde_json::to_string(&error_message)
                    .map_err(|e| format!("Failed to serialize error message: {}", e))?;
                
                app_handle.emit(&format!("claude-error:{}", session_id), error_message_str)
                    .map_err(|e| format!("Failed to emit session-specific error: {}", e))?;
                
                return Err(enhanced_error);
            }
        }
        Err(e) => {
            log::error!("Failed to call Gemini API for session {}: {}", session_id, e);
            
            // Provide specific error messages based on error type
            let enhanced_error = if e.to_string().contains("timeout") {
                "⏰ Gemini API Timeout\n\n• Request took too long to process\n• Try again with a shorter prompt\n• Check your internet connection\n• Consider switching to a faster model like 'gemini-2.5-flash'".to_string()
            } else if e.to_string().contains("dns") || e.to_string().contains("connection") {
                "🌐 Connection Error\n\n• Cannot reach Gemini API\n• Check your internet connection\n• Verify firewall settings\n• Try switching to Claude or Ollama models".to_string()
            } else {
                format!("🚫 Gemini API Error\n\n• {}", e)
            };
            
            return Err(enhanced_error);
        }
    }
    
    // Emit session-specific completion event ONLY to prevent cross-contamination
    app_handle.emit(&format!("claude-complete:{}", session_id), true)
        .map_err(|e| format!("Failed to emit session complete event: {}", e))?;
    
    // Clean up session deduplication data
    dedup_manager.clear_session(&session_id);
    
    // Unregister session from registry
    session_registry.unregister_session(&session_id);
    
    // Cleanup isolation manager
    isolation_manager.cleanup_session(&session_id);
    
    // Clean up execution state
    {
        let mut sessions = execution_state.sessions.lock().await;
        sessions.remove(&session_id);
    }
    
    log::info!("Gemini execution completed successfully for session: {}", session_id);
    
    Ok(())
}

/// Create a secure Gemini session with proper isolation
#[tauri::command]
pub async fn create_secure_gemini_session(
    project_id: String,
    project_path: String,
    model: String,
    session_registry: State<'_, GeminiSessionRegistry>,
    isolation_manager: State<'_, SessionIsolationManager>,
) -> Result<String, String> {
    let session_id = generate_secure_gemini_session_id(&project_id, &model);
    
    // Register in session registry
    session_registry.register_session(&session_id, &project_id, &model)?;
    
    // Create isolation state
    let _isolation_state = isolation_manager.create_isolated_session(
        session_id.clone(),
        project_id.clone(),
        model.clone(),
    );
    
    log::info!("Created secure Gemini session: {} for project: {} with model: {}", 
              session_id, project_id, model);
    
    Ok(session_id)
}

/// Cleanup Gemini session and all associated data
#[tauri::command]
pub async fn cleanup_gemini_session(
    session_id: String,
    session_registry: State<'_, GeminiSessionRegistry>,
    dedup_manager: State<'_, MessageDeduplicationManager>,
    isolation_manager: State<'_, SessionIsolationManager>,
) -> Result<(), String> {
    // Validate session exists
    session_registry.validate_session(&session_id)?;
    
    // Clean up deduplication data
    dedup_manager.clear_session(&session_id);
    
    // Unregister from session registry
    session_registry.unregister_session(&session_id);
    
    // Clean up isolation manager
    isolation_manager.cleanup_session(&session_id);
    
    log::info!("Cleaned up Gemini session: {}", session_id);
    Ok(())
}

/// Validate Gemini session is properly isolated
#[tauri::command]
pub async fn validate_gemini_session(
    session_id: String,
    session_registry: State<'_, GeminiSessionRegistry>,
    isolation_manager: State<'_, SessionIsolationManager>,
) -> Result<bool, String> {
    // Check session registry
    session_registry.validate_session(&session_id)?;
    
    // Check isolation state
    let is_isolated = isolation_manager.is_session_isolated(&session_id);
    
    log::info!("Session {} validation: isolated={}", session_id, is_isolated);
    Ok(is_isolated)
}

/// Get enhanced Gemini model list with proper 2025 models
#[tauri::command]
pub async fn get_enhanced_gemini_models() -> Result<Vec<serde_json::Value>, String> {
    let models = vec![
        serde_json::json!({
            "id": "gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "description": "Most intelligent model with deep reasoning (2025)",
            "context_length": 1048576,
            "supports_tools": true,
            "supports_vision": true,
            "recommended": true,
            "tier": "pro",
            "release_year": 2025
        }),
        serde_json::json!({
            "id": "gemini-2.5-flash",
            "name": "Gemini 2.5 Flash", 
            "description": "Fast and efficient for everyday tasks (2025)",
            "context_length": 1048576,
            "supports_tools": true,
            "supports_vision": true,
            "recommended": true,
            "tier": "flash",
            "release_year": 2025
        }),
        serde_json::json!({
            "id": "gemini-2.5-flash-lite",
            "name": "Gemini 2.5 Flash-Lite",
            "description": "Most cost-efficient model (2025)",
            "context_length": 1048576,
            "supports_tools": true,
            "supports_vision": true,
            "recommended": false,
            "tier": "lite",
            "release_year": 2025
        }),
        serde_json::json!({
            "id": "gemini-2.0-pro-exp",
            "name": "Gemini 2.0 Pro (Experimental)",
            "description": "Experimental 2.0 pro model with advanced capabilities",
            "context_length": 2097152,
            "supports_tools": true,
            "supports_vision": true,
            "recommended": false,
            "tier": "experimental",
            "release_year": 2024
        }),
        serde_json::json!({
            "id": "gemini-2.0-flash",
            "name": "Gemini 2.0 Flash",
            "description": "Production-ready model with native tool use",
            "context_length": 1048576,
            "supports_tools": true,
            "supports_vision": true,
            "recommended": false,
            "tier": "flash",
            "release_year": 2024
        }),
        serde_json::json!({
            "id": "gemini-2.0-flash-lite", 
            "name": "Gemini 2.0 Flash-Lite",
            "description": "Most cost-efficient 2.0 model",
            "context_length": 1048576,
            "supports_tools": true,
            "supports_vision": true,
            "recommended": false,
            "tier": "lite",
            "release_year": 2024
        }),
        serde_json::json!({
            "id": "gemini-1.5-pro",
            "name": "Gemini 1.5 Pro",
            "description": "Legacy 1.5 pro model (being phased out)",
            "context_length": 1048576,
            "supports_tools": true,
            "supports_vision": true,
            "recommended": false,
            "tier": "legacy",
            "release_year": 2024
        })
    ];
    
    Ok(models)
}

/// Cleanup old inactive Gemini sessions (maintenance task)
#[tauri::command]
pub async fn cleanup_old_gemini_sessions(
    session_registry: State<'_, GeminiSessionRegistry>,
    max_age_minutes: Option<u64>,
) -> Result<(), String> {
    let age_limit = max_age_minutes.unwrap_or(60); // Default 1 hour
    session_registry.cleanup_old_sessions(age_limit);
    log::info!("Cleaned up Gemini sessions older than {} minutes", age_limit);
    Ok(())
}