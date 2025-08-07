use serde::{Deserialize, Serialize};
use std::env;
use std::time::Duration;
use tauri::{State, Emitter};
use super::{claude::ClaudeProcessState, agents::AgentDb};
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiConfig {
    pub api_key: Option<String>,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub top_k: Option<u32>,
    pub top_p: Option<f32>,
    pub stop_sequences: Option<Vec<String>>,
    pub system_instruction: Option<String>,
    pub timeout_secs: Option<u64>,
    pub max_retries: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiRequest {
    pub prompt: String,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_output_tokens: Option<u32>,
    pub top_k: Option<u32>,
    pub top_p: Option<f32>,
    pub stop_sequences: Option<Vec<String>>,
    pub system_instruction: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiResponse {
    pub candidates: Vec<GeminiCandidate>,
    #[serde(rename = "usageMetadata")]
    pub usage_metadata: Option<GeminiUsageMetadata>,
    #[serde(rename = "modelVersion")]
    pub model_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiCandidate {
    pub content: GeminiContent,
    #[serde(rename = "finishReason")]
    pub finish_reason: Option<String>,
    #[serde(rename = "safetyRatings")]
    pub safety_ratings: Option<Vec<GeminiSafetyRating>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiContent {
    pub parts: Vec<GeminiPart>,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum GeminiPart {
    Text { text: String },
    InlineData { inline_data: GeminiInlineData },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiInlineData {
    pub mime_type: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiSafetyRating {
    pub category: String,
    pub probability: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiUsageMetadata {
    #[serde(rename = "promptTokenCount")]
    pub prompt_token_count: Option<u32>,
    #[serde(rename = "candidatesTokenCount")]
    pub candidates_token_count: Option<u32>,
    #[serde(rename = "totalTokenCount")]
    pub total_token_count: Option<u32>,
    #[serde(rename = "cachedContentTokenCount")]
    pub cached_content_token_count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiError {
    pub code: String,
    pub message: String,
    pub status: Option<u16>,
    pub details: Option<serde_json::Value>,
}

/// Execute Gemini model with enhanced parameters
#[tauri::command]
pub async fn execute_gemini_code_enhanced(
    prompt: String,
    model: String,
    project_path: String,
    temperature: Option<f32>,
    max_output_tokens: Option<u32>,
    top_k: Option<u32>,
    top_p: Option<f32>,
    stop_sequences: Option<Vec<String>>,
    system_instruction: Option<String>,
    app_handle: tauri::AppHandle,
    db: State<'_, AgentDb>,
    _claude_state: State<'_, ClaudeProcessState>,
) -> Result<(), String> {
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
    
    app_handle.emit("claude-output", serde_json::to_string(&init_message).unwrap())
        .map_err(|e| format!("Failed to emit init event: {}", e))?;
    
    // Create HTTP client with configurable timeout and retry settings
    let timeout_duration = Duration::from_secs(120); // 2 minute default timeout
    let client = reqwest::Client::builder()
        .timeout(timeout_duration)
        .connect_timeout(Duration::from_secs(30))
        .user_agent("Claudia/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Determine the correct model endpoint - Updated for August 2025 API
    let model_endpoint = match trimmed_model {
        // Latest 2025 models
        "gemini-2.5-pro" | "gemini-2.5-pro-exp" => "gemini-2.5-pro",
        "gemini-2.5-flash" => "gemini-2.5-flash", 
        "gemini-2.5-flash-lite" => "gemini-2.5-flash-lite",
        "gemini-1.5-pro" => "gemini-1.5-pro",
        "gemini-2.0-pro-exp" => "gemini-2.0-pro-exp",
        "gemini-2.0-flash" => "gemini-2.0-flash",
        "gemini-2.0-flash-lite" => "gemini-2.0-flash-lite",
        // Legacy 2024 models for backward compatibility
        "gemini-2.0-flash-exp" => "gemini-2.0-flash-exp",
        "gemini-exp-1206" => "gemini-exp-1206",
        "gemini-1.5-pro-002" => "gemini-1.5-pro-002",
        "gemini-1.5-flash-002" => "gemini-1.5-flash-002",
        "gemini-1.5-flash" => "gemini-1.5-flash-002",
        // Deprecated mappings
        "gemini-pro" => "gemini-2.5-flash",
        "gemini-pro-vision" => "gemini-1.5-pro",
        _ => {
            return Err(format!("Unsupported Gemini model: {}. Supported latest models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-1.5-pro, gemini-2.0-pro-exp, gemini-2.0-flash, gemini-2.0-flash-lite", trimmed_model));
        }
    };
    
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model_endpoint,
        api_key
    );
    
    // Build request body with configurable parameters
    let mut contents = vec![serde_json::json!({
        "parts": [{
            "text": trimmed_prompt
        }]
    })];
    
    // Add system instruction if provided
    if let Some(sys_instruction) = system_instruction {
        contents.insert(0, serde_json::json!({
            "role": "system",
            "parts": [{
                "text": sys_instruction
            }]
        }));
    }
    
    let mut generation_config = serde_json::json!({
        "temperature": temperature.unwrap_or(0.7),
        "maxOutputTokens": max_output_tokens.unwrap_or(8192),
        "topK": top_k.unwrap_or(10),
        "topP": top_p.unwrap_or(0.95),
    });
    
    // Add stop sequences if provided
    if let Some(sequences) = stop_sequences {
        generation_config["stopSequences"] = serde_json::json!(sequences);
    }
    
    let request_body = serde_json::json!({
        "contents": contents,
        "generationConfig": generation_config,
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
    
    // Send request with timeout
    let request_future = client.post(&url)
        .json(&request_body)
        .send();
    
    match timeout(timeout_duration, request_future).await {
        Ok(Ok(response)) => {
            // Process successful response
            handle_gemini_response(response, &app_handle, &session_id, &trimmed_model).await
        }
        Ok(Err(e)) => {
            emit_gemini_error(&app_handle, &format!("Failed to call Gemini API: {}", e))?;
            Err(format!("Failed to call Gemini API: {}", e))
        }
        Err(_) => {
            emit_gemini_error(&app_handle, "Request timed out")?;
            Err("Request timed out".to_string())
        }
    }
}

/// Handle Gemini API response
async fn handle_gemini_response(
    response: reqwest::Response,
    app_handle: &tauri::AppHandle,
    session_id: &str,
    model: &str,
) -> Result<(), String> {
    let status = response.status();
    
    if status.is_success() {
        match response.json::<GeminiResponse>().await {
            Ok(gemini_response) => {
                // Check for empty candidates
                if gemini_response.candidates.is_empty() {
                    return Err("Response was blocked by safety filters".to_string());
                }
                
                let candidate = &gemini_response.candidates[0];
                
                // Check finish reason for safety blocks
                if let Some(finish_reason) = &candidate.finish_reason {
                    match finish_reason.as_str() {
                        "SAFETY" => return Err("Response was blocked by safety filters".to_string()),
                        "RECITATION" => return Err("Response was blocked due to recitation concerns".to_string()),
                        "OTHER" => return Err("Response generation failed for unknown reasons".to_string()),
                        _ => {} // Continue with normal processing
                    }
                }
                
                // Extract text content
                let content_text = candidate.content.parts.iter()
                    .find_map(|part| match part {
                        GeminiPart::Text { text } => Some(text.clone()),
                        _ => None,
                    })
                    .ok_or_else(|| "No text content found in response".to_string())?;
                
                // Get token usage
                let (input_tokens, output_tokens) = if let Some(usage) = &gemini_response.usage_metadata {
                    (
                        usage.prompt_token_count.unwrap_or(0),
                        usage.candidates_token_count.unwrap_or(0)
                    )
                } else {
                    (0, 0)
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
                            "text": content_text
                        }],
                        "model": model,
                        "stop_reason": candidate.finish_reason.as_ref()
                            .map(|r| if r == "STOP" { "end_turn" } else { r })
                            .unwrap_or("end_turn"),
                        "stop_sequence": null,
                        "usage": {
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens
                        }
                    }
                });
                
                app_handle.emit("claude-output", serde_json::to_string(&message).unwrap())
                    .map_err(|e| format!("Failed to emit message: {}", e))?;
                
                // Emit completion events
                app_handle.emit("claude-complete", true)
                    .map_err(|e| format!("Failed to emit complete event: {}", e))?;
                
                app_handle.emit(&format!("claude-complete:{}", session_id), true)
                    .map_err(|e| format!("Failed to emit session complete event: {}", e))?;
                
                Ok(())
            }
            Err(e) => {
                emit_gemini_error(app_handle, &format!("Failed to parse response: {}", e))?;
                Err(format!("Failed to parse Gemini response: {}", e))
            }
        }
    } else {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        let error_msg = format!("Gemini API error ({}): {}", status, error_text);
        emit_gemini_error(app_handle, &error_msg)?;
        Err(error_msg)
    }
}

/// Emit Gemini error to frontend
fn emit_gemini_error(app_handle: &tauri::AppHandle, error: &str) -> Result<(), String> {
    let error_message = serde_json::json!({
        "type": "system",
        "subtype": "error",
        "error": error,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });
    
    app_handle.emit("claude-error", serde_json::to_string(&error_message).unwrap())
        .map_err(|e| format!("Failed to emit error: {}", e))
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