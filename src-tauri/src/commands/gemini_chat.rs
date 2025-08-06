use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;
use super::agents::AgentDb;

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiChatRequest {
    pub prompt: String,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_output_tokens: Option<i32>,
    pub system_instruction: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiChatResponse {
    pub text: String,
    pub finish_reason: String,
    pub safety_ratings: Vec<serde_json::Value>,
    pub usage_metadata: serde_json::Value,
}

/// Process a Gemini chat message and return the response directly
#[tauri::command]
pub async fn send_gemini_chat_message(
    request: GeminiChatRequest,
    db: State<'_, AgentDb>,
) -> Result<GeminiChatResponse, String> {
    // Get API key from database
    let api_key = {
        let conn = db.0.lock().unwrap();
        match conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
            [],
            |row| row.get::<_, String>(0),
        ) {
            Ok(key) => key,
            Err(_) => {
                // Try environment variable
                std::env::var("GEMINI_API_KEY")
                    .map_err(|_| "Gemini API key not configured")?
            }
        }
    };

    // Build request body
    let request_body = json!({
        "contents": [{
            "parts": [{
                "text": request.prompt
            }]
        }],
        "generationConfig": {
            "temperature": request.temperature.unwrap_or(0.7),
            "maxOutputTokens": request.max_output_tokens.unwrap_or(8192),
            "topK": 10,
            "topP": 0.95,
        },
        "systemInstruction": request.system_instruction.map(|instruction| {
            json!({
                "parts": [{
                    "text": instruction
                }]
            })
        })
    });

    // Build URL
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        request.model,
        api_key
    );

    // Make request
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Gemini API error ({}): {}", status, error_text));
    }

    // Parse response
    let gemini_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Extract content from response
    let candidates = gemini_response["candidates"]
        .as_array()
        .ok_or("No candidates in response")?;
    
    if candidates.is_empty() {
        return Err("Response was blocked by safety filters".to_string());
    }

    let first_candidate = &candidates[0];
    let content = first_candidate["content"]["parts"][0]["text"]
        .as_str()
        .ok_or("No text content in response")?
        .to_string();

    let finish_reason = first_candidate["finishReason"]
        .as_str()
        .unwrap_or("STOP")
        .to_string();

    let safety_ratings = first_candidate["safetyRatings"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let usage_metadata = gemini_response["usageMetadata"]
        .clone();

    Ok(GeminiChatResponse {
        text: content,
        finish_reason,
        safety_ratings,
        usage_metadata,
    })
}