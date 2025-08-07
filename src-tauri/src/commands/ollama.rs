use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{command, AppHandle, Emitter};
use log;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub modified_at: String,
    pub size: i64,
    pub digest: String,
    pub details: Option<OllamaModelDetails>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelDetails {
    pub format: String,
    pub family: String,
    pub families: Option<Vec<String>>,
    pub parameter_size: String,
    pub quantization_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaListResponse {
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaGenerateRequest {
    pub model: String,
    pub prompt: String,
    pub stream: bool,
    pub system: Option<String>,
    pub context: Option<Vec<i32>>,
    pub options: Option<HashMap<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaGenerateResponse {
    pub model: String,
    pub created_at: String,
    pub response: String,
    pub done: bool,
    pub context: Option<Vec<i32>>,
    pub total_duration: Option<u64>,
    pub load_duration: Option<u64>,
    pub prompt_eval_count: Option<u32>,
    pub prompt_eval_duration: Option<u64>,
    pub eval_count: Option<u32>,
    pub eval_duration: Option<u64>,
}

/// Check if Ollama is running and accessible
#[command]
pub async fn check_ollama_status() -> Result<bool, String> {
    log::info!("Checking Ollama status");
    
    let client = reqwest::Client::new();
    let ollama_url = "http://localhost:11434/api/tags";
    
    match client.get(ollama_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                log::info!("Ollama is running and accessible");
                Ok(true)
            } else {
                log::warn!("Ollama responded with status: {}", response.status());
                Ok(false)
            }
        },
        Err(e) => {
            log::warn!("Failed to connect to Ollama: {}", e);
            Ok(false)
        }
    }
}

/// Get list of available Ollama models
#[command]
pub async fn get_ollama_models() -> Result<Vec<OllamaModel>, String> {
    log::info!("Fetching available Ollama models");
    
    let client = reqwest::Client::new();
    let ollama_url = "http://localhost:11434/api/tags";
    
    match client.get(ollama_url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                let list_response: OllamaListResponse = response.json().await
                    .map_err(|e| format!("Failed to parse Ollama models response: {}", e))?;
                
                log::info!("Found {} Ollama models", list_response.models.len());
                Ok(list_response.models)
            } else {
                Err(format!("Ollama API returned status: {}", response.status()))
            }
        },
        Err(e) => {
            Err(format!("Failed to connect to Ollama: {}", e))
        }
    }
}

/// Execute Ollama model with streaming support
#[command]
pub async fn execute_ollama_request(
    app_handle: AppHandle,
    model: String,
    prompt: String,
    project_path: String,
    system_instruction: Option<String>,
    options: Option<HashMap<String, Value>>,
) -> Result<(), String> {
    log::info!("Starting Ollama execution - model: {}, project: {}", model, project_path);

    // Generate unique session ID for this request
    let session_id = format!(
        "ollama-{}-{}",
        model.replace(':', "-"),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );

    // Emit init message
    let init_message = json!({
        "type": "system",
        "subtype": "init",
        "session_id": session_id,
        "model": model,
        "cwd": project_path,
        "tools": [],
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });
    
    // Emit session-specific events ONLY to prevent cross-contamination
    app_handle.emit(&format!("claude-output:{}", session_id), serde_json::to_string(&init_message).unwrap())
        .map_err(|e| format!("Failed to emit session-specific init event: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let request_payload = OllamaGenerateRequest {
        model: model.clone(),
        prompt: prompt.clone(),
        stream: true,
        system: system_instruction,
        context: None,
        options: Some(options.unwrap_or_default()),
    };

    log::info!("Sending request to Ollama API for model: {}", model);

    let response = client
        .post("http://localhost:11434/api/generate")
        .json(&request_payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send request to Ollama: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API returned error {}: {}", status, error_text));
    }

    log::info!("Ollama API response received, processing stream...");

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut total_tokens = 0;
    let mut message_id = 0;

    use futures_util::StreamExt;

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk_bytes) => {
                let chunk_str = String::from_utf8_lossy(&chunk_bytes);
                buffer.push_str(&chunk_str);

                // Process complete JSON lines
                while let Some(newline_pos) = buffer.find('\n') {
                    let line = buffer[..newline_pos].trim().to_string();
                    buffer.drain(..=newline_pos);

                    if line.is_empty() {
                        continue;
                    }

                    match serde_json::from_str::<OllamaGenerateResponse>(&line) {
                        Ok(ollama_response) => {
                            message_id += 1;
                            total_tokens += ollama_response.eval_count.unwrap_or(0);

                            // Convert to compatible ClaudeStreamMessage format
                            let message = json!({
                                "type": "assistant",
                                "subtype": if ollama_response.done { "complete" } else { "text" },
                                "session_id": session_id,
                                "model": ollama_response.model,
                                "timestamp": std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_secs(),
                                "message": {
                                    "id": format!("ollama-msg-{}", message_id),
                                    "type": "message",
                                    "role": "assistant",
                                    "model": ollama_response.model,
                                    "content": [{
                                        "type": "text",
                                        "text": ollama_response.response
                                    }],
                                    "stop_reason": if ollama_response.done { Value::String("end_turn".to_string()) } else { Value::Null },
                                    "usage": {
                                        "input_tokens": ollama_response.prompt_eval_count.unwrap_or(0),
                                        "output_tokens": ollama_response.eval_count.unwrap_or(0)
                                    }
                                },
                                "usage": {
                                    "input_tokens": ollama_response.prompt_eval_count.unwrap_or(0),
                                    "output_tokens": ollama_response.eval_count.unwrap_or(0),
                                    "total_tokens": total_tokens
                                },
                                "performance": {
                                    "total_duration_ms": ollama_response.total_duration.map(|d| d / 1_000_000),
                                    "load_duration_ms": ollama_response.load_duration.map(|d| d / 1_000_000),
                                    "eval_duration_ms": ollama_response.eval_duration.map(|d| d / 1_000_000)
                                }
                            });

                            // Emit session-specific events ONLY to prevent cross-contamination
                            app_handle.emit(&format!("claude-output:{}", session_id), serde_json::to_string(&message).unwrap())
                                .map_err(|e| format!("Failed to emit session-specific message: {}", e))?;

                            if ollama_response.done {
                                log::info!("Ollama execution completed successfully for session: {}", session_id);
                                
                                // Emit session-specific completion event
                                app_handle.emit(&format!("claude-complete:{}", session_id), true)
                                    .map_err(|e| format!("Failed to emit session-specific completion event: {}", e))?;
                                
                                return Ok(());
                            }
                        }
                        Err(e) => {
                            log::warn!("Failed to parse Ollama response line '{}': {}", line, e);
                            continue;
                        }
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("Stream error from Ollama: {}", e);
                log::error!("{}", error_msg);
                
                // Emit error message
                let error_message = json!({
                    "type": "error",
                    "session_id": session_id,
                    "error": error_msg,
                    "timestamp": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs()
                });
                
                app_handle.emit(&format!("claude-error:{}", session_id), serde_json::to_string(&error_message).unwrap())
                    .map_err(|e| format!("Failed to emit session-specific error: {}", e))?;
                
                return Err(error_msg);
            }
        }
    }

    // If we reach here, the stream ended without a "done" response
    log::warn!("Ollama stream ended unexpectedly for session: {}", session_id);
    
    app_handle.emit(&format!("claude-complete:{}", session_id), true)
        .map_err(|e| format!("Failed to emit session-specific completion event: {}", e))?;
    
    Ok(())
}

/// Pull/Download a new Ollama model
#[command]
pub async fn pull_ollama_model(model: String) -> Result<String, String> {
    log::info!("Pulling Ollama model: {}", model);
    
    let client = reqwest::Client::new();
    let request_payload = json!({
        "name": model,
        "stream": false
    });
    
    let response = client
        .post("http://localhost:11434/api/pull")
        .json(&request_payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send pull request: {}", e))?;
        
    if response.status().is_success() {
        Ok(format!("Successfully initiated pull for model: {}", model))
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Failed to pull model {}: {}", model, error_text))
    }
}

/// Delete an Ollama model
#[command]
pub async fn delete_ollama_model(model: String) -> Result<String, String> {
    log::info!("Deleting Ollama model: {}", model);
    
    let client = reqwest::Client::new();
    let request_payload = json!({
        "name": model
    });
    
    let response = client
        .delete("http://localhost:11434/api/delete")
        .json(&request_payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send delete request: {}", e))?;
        
    if response.status().is_success() {
        Ok(format!("Successfully deleted model: {}", model))
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Failed to delete model {}: {}", model, error_text))
    }
}

/// Get information about a specific Ollama model
#[command]
pub async fn get_ollama_model_info(model: String) -> Result<Value, String> {
    log::info!("Getting info for Ollama model: {}", model);
    
    let client = reqwest::Client::new();
    let request_payload = json!({
        "name": model
    });
    
    let response = client
        .post("http://localhost:11434/api/show")
        .json(&request_payload)
        .send()
        .await
        .map_err(|e| format!("Failed to get model info: {}", e))?;
        
    if response.status().is_success() {
        let model_info: Value = response.json().await
            .map_err(|e| format!("Failed to parse model info: {}", e))?;
        Ok(model_info)
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("Failed to get model info for {}: {}", model, error_text))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_ollama_status() {
        // This test requires Ollama to be running
        // In a real environment, you might want to mock this
        let result = check_ollama_status().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_ollama_request_serialization() {
        let request = OllamaGenerateRequest {
            model: "llama3.3:latest".to_string(),
            prompt: "Hello world".to_string(),
            stream: true,
            system: Some("You are a helpful assistant".to_string()),
            context: None,
            options: Some(HashMap::from([
                ("temperature".to_string(), json!(0.7)),
                ("top_p".to_string(), json!(0.9))
            ])),
        };
        
        let json_str = serde_json::to_string(&request).unwrap();
        assert!(json_str.contains("llama3.3:latest"));
        assert!(json_str.contains("Hello world"));
    }
}