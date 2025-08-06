use serde::{Deserialize, Serialize};
use std::env;
use tauri::{State, Emitter};
use super::{claude::ClaudeProcessState, agents::AgentDb};
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
    
    app_handle.emit("claude-output", serde_json::to_string(&init_message).unwrap())
        .map_err(|e| format!("Failed to emit test init event: {}", e))?;
    app_handle.emit(&format!("claude-output:{}", test_session_id), serde_json::to_string(&init_message).unwrap())
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
    
    app_handle.emit("claude-output", serde_json::to_string(&test_message).unwrap())
        .map_err(|e| format!("Failed to emit test message event: {}", e))?;
    app_handle.emit(&format!("claude-output:{}", test_session_id), serde_json::to_string(&test_message).unwrap())
        .map_err(|e| format!("Failed to emit test session-specific message event: {}", e))?;
    
    // Emit completion
    app_handle.emit("claude-complete", true)
        .map_err(|e| format!("Failed to emit test complete event: {}", e))?;
    app_handle.emit(&format!("claude-complete:{}", test_session_id), true)
        .map_err(|e| format!("Failed to emit test session-specific complete event: {}", e))?;
    
    log::info!("Test events emitted successfully for session: {}", test_session_id);
    Ok(())
}

/// Execute Gemini model
#[tauri::command]
pub async fn execute_gemini_code(
    prompt: String,
    model: String,
    project_path: String,
    app_handle: tauri::AppHandle,
    db: State<'_, AgentDb>,
    _claude_state: State<'_, ClaudeProcessState>,
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
    
    // Generate a unique session ID for this Gemini execution
    let session_id = format!("gemini-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis());
    
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
    
    // Emit both generic and session-specific events
    app_handle.emit("claude-output", serde_json::to_string(&init_message).unwrap())
        .map_err(|e| format!("Failed to emit init event: {}", e))?;
    app_handle.emit(&format!("claude-output:{}", session_id), serde_json::to_string(&init_message).unwrap())
        .map_err(|e| format!("Failed to emit session-specific init event: {}", e))?;
    
    // Create HTTP client with timeout and retry settings
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120)) // 2 minute timeout
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Determine the correct model endpoint - Updated for August 2025 API
    let model_endpoint = match trimmed_model {
        // Latest 2025 models
        "gemini-1.5-pro" => "gemini-1.5-pro",
        "gemini-2.5-flash" => "gemini-2.5-flash",
        "gemini-2.0-pro-exp" => "gemini-2.0-pro-exp",
        "gemini-2.0-flash" => "gemini-2.0-flash",
        "gemini-2.0-flash-lite" => "gemini-2.0-flash-lite",
        // Legacy 2024 models for backward compatibility
        "gemini-2.0-flash-exp" => "gemini-2.0-flash-exp",
        "gemini-exp-1206" => "gemini-exp-1206",
        "gemini-1.5-pro-002" => "gemini-1.5-pro-002",
        "gemini-1.5-flash-002" => "gemini-1.5-flash-002",
        // Deprecated mappings
        "gemini-pro" => "gemini-2.5-flash",
        "gemini-pro-vision" => "gemini-1.5-pro",
        
        "gemini-1.5-flash" => "gemini-1.5-flash-002",
        _ => {
            return Err(format!("Unsupported Gemini model: {}. Supported latest models: gemini-1.5-pro, gemini-2.5-flash, gemini-2.0-pro-exp, gemini-2.0-flash, gemini-2.0-flash-lite", trimmed_model));
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
            "topK": 10,
            "topP": 0.95,
            "stopSequences": []
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
    
    // Add a small delay to avoid hitting rate limits too quickly
    tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

    // Send request
    log::info!("Sending request to Gemini API for session: {}", session_id);
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
                            
                            // Check finish reason for safety blocks
                            if let Some(finish_reason) = candidate["finishReason"].as_str() {
                                match finish_reason {
                                    "SAFETY" => return Err("Response was blocked by safety filters".to_string()),
                                    "RECITATION" => return Err("Response was blocked due to recitation concerns".to_string()),
                                    "OTHER" => return Err("Response generation failed for unknown reasons".to_string()),
                                    _ => {} // Continue with normal processing
                                }
                            }
                            
                            // Extract the response text with better error handling
                            if let Some(content) = candidate["content"]["parts"][0]["text"].as_str() {
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
                                
                                // Emit both generic and session-specific events
                                app_handle.emit("claude-output", serde_json::to_string(&message).unwrap())
                                    .map_err(|e| format!("Failed to emit message: {}", e))?;
                                app_handle.emit(&format!("claude-output:{}", session_id), serde_json::to_string(&message).unwrap())
                                    .map_err(|e| format!("Failed to emit session-specific message: {}", e))?;
                            } else {
                                return Err("No content found in Gemini API response".to_string());
                            }
                        } else {
                            return Err("No candidates found in Gemini API response".to_string());
                        }
                    }
                    Err(e) => return Err(format!("Failed to parse Gemini response: {}", e)),
                }
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                
                // Emit error message to frontend
                let error_message = serde_json::json!({
                    "type": "system",
                    "subtype": "error",
                    "error": format!("Gemini API error ({}): {}", status, error_text),
                    "timestamp": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs()
                });
                
                // Emit both generic and session-specific error events
                app_handle.emit("claude-error", serde_json::to_string(&error_message).unwrap())
                    .map_err(|e| format!("Failed to emit error: {}", e))?;
                app_handle.emit(&format!("claude-error:{}", session_id), serde_json::to_string(&error_message).unwrap())
                    .map_err(|e| format!("Failed to emit session-specific error: {}", e))?;
                
                return Err(format!("Gemini API error ({}): {}", status, error_text));
            }
        }
        Err(e) => return Err(format!("Failed to call Gemini API: {}", e)),
    }
    
    // Emit completion events (both generic and session-specific)
    app_handle.emit("claude-complete", true)
        .map_err(|e| format!("Failed to emit complete event: {}", e))?;
    
    // Also emit session-specific complete event to match Claude's pattern
    app_handle.emit(&format!("claude-complete:{}", session_id), true)
        .map_err(|e| format!("Failed to emit session complete event: {}", e))?;
    
    log::info!("Gemini execution completed successfully for session: {}", session_id);
    
    Ok(())
}