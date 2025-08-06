use base64::{Engine as _, engine::general_purpose};
use anyhow::{anyhow, Result};
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{Mutex, Semaphore};
use tokio::time::{sleep, Duration};

use super::gemini_models::{MODEL_REGISTRY, ModelMetadata};

/// Request preprocessing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreprocessConfig {
    pub sanitize_input: bool,
    pub validate_json_schema: bool,
    pub enforce_token_limits: bool,
    pub auto_truncate: bool,
    pub strip_sensitive_data: bool,
}

impl Default for PreprocessConfig {
    fn default() -> Self {
        Self {
            sanitize_input: true,
            validate_json_schema: false,
            enforce_token_limits: true,
            auto_truncate: false,
            strip_sensitive_data: true,
        }
    }
}

/// Multi-turn conversation context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationContext {
    pub session_id: String,
    pub messages: Vec<ConversationMessage>,
    pub system_instruction: Option<String>,
    pub total_tokens: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: String,
    pub content: Vec<MessageContent>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum MessageContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { 
        mime_type: String,
        data: String,  // base64 encoded
    },
    #[serde(rename = "file")]
    File {
        mime_type: String,
        data: String,  // base64 encoded
        name: String,
    },
}

/// Streaming response chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingChunk {
    pub delta: String,
    pub finish_reason: Option<String>,
    pub safety_ratings: Option<Vec<serde_json::Value>>,
    pub usage: Option<StreamingUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Request processor with advanced features
pub struct GeminiRequestProcessor {
    client: reqwest::Client,
    preprocess_config: PreprocessConfig,
    conversations: Arc<Mutex<HashMap<String, ConversationContext>>>,
    rate_limiter: Arc<Semaphore>,
    request_queue: Arc<Mutex<Vec<QueuedRequest>>>,
}

#[derive(Debug)]
struct QueuedRequest {
    id: String,
    request: ProcessRequest,
    priority: RequestPriority,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum RequestPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

#[derive(Debug, Clone)]
pub struct ProcessRequest {
    pub prompt: String,
    pub model: String,
    pub session_id: Option<String>,
    pub images: Vec<(String, Vec<u8>)>, // (mime_type, data)
    pub files: Vec<(String, String, Vec<u8>)>, // (name, mime_type, data)
    pub stream: bool,
    pub priority: RequestPriority,
    pub preprocess_config: Option<PreprocessConfig>,
    pub generation_config: GenerationConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationConfig {
    pub temperature: Option<f32>,
    pub max_output_tokens: Option<u32>,
    pub top_k: Option<u32>,
    pub top_p: Option<f32>,
    pub stop_sequences: Option<Vec<String>>,
    pub response_mime_type: Option<String>,
    pub response_schema: Option<serde_json::Value>,
}

impl GeminiRequestProcessor {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .connect_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(90))
            .user_agent("Claudia/1.0")
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            client,
            preprocess_config: PreprocessConfig::default(),
            conversations: Arc::new(Mutex::new(HashMap::new())),
            rate_limiter: Arc::new(Semaphore::new(10)), // 10 concurrent requests
            request_queue: Arc::new(Mutex::new(Vec::new())),
        }
    }
    
    /// Preprocess request before sending
    async fn preprocess_request(&self, request: &mut ProcessRequest) -> Result<()> {
        let config = request.preprocess_config.as_ref()
            .unwrap_or(&self.preprocess_config);
        
        if config.sanitize_input {
            request.prompt = self.sanitize_input(&request.prompt);
        }
        
        if config.strip_sensitive_data {
            request.prompt = self.strip_sensitive_data(&request.prompt);
        }
        
        if config.enforce_token_limits {
            let model = MODEL_REGISTRY.get_model(&request.model)
                .ok_or_else(|| anyhow!("Model not found"))?;
            
            // Rough token estimation (4 chars per token)
            let estimated_tokens = request.prompt.len() / 4;
            let max_tokens = model.metadata.capabilities.max_input_tokens as usize;
            
            if estimated_tokens > max_tokens {
                if config.auto_truncate {
                    let max_chars = max_tokens * 4;
                    request.prompt.truncate(max_chars);
                } else {
                    return Err(anyhow!(
                        "Input exceeds token limit: {} > {}",
                        estimated_tokens,
                        max_tokens
                    ));
                }
            }
        }
        
        Ok(())
    }
    
    /// Sanitize input to prevent injection attacks
    fn sanitize_input(&self, input: &str) -> String {
        // Remove potential prompt injection patterns
        input
            .replace("</system>", "")
            .replace("<system>", "")
            .replace("</assistant>", "")
            .replace("<assistant>", "")
            .replace("</user>", "")
            .replace("<user>", "")
    }
    
    /// Strip sensitive data patterns
    fn strip_sensitive_data(&self, input: &str) -> String {
        // Simple regex patterns for common sensitive data
        let patterns = [
            (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[EMAIL]"),
            (r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", "[PHONE]"),
            (r"\b\d{3}-\d{2}-\d{4}\b", "[SSN]"),
            (r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b", "[CREDIT_CARD]"),
        ];
        
        let mut result = input.to_string();
        for (pattern, replacement) in patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                result = re.replace_all(&result, replacement).to_string();
            }
        }
        
        result
    }
    
    /// Process request with streaming support
    pub async fn process_request(
        &self,
        mut request: ProcessRequest,
        api_key: String,
        app_handle: AppHandle,
    ) -> Result<()> {
        // Preprocess request
        self.preprocess_request(&mut request).await?;
        
        // Acquire rate limit permit
        let _permit = self.rate_limiter.acquire().await
            .map_err(|e| anyhow!("Failed to acquire rate limit permit: {}", e))?;
        
        if request.stream {
            self.process_streaming(request, api_key, app_handle).await
        } else {
            self.process_standard(request, api_key, app_handle).await
        }
    }
    
    /// Process standard (non-streaming) request
    async fn process_standard(
        &self,
        request: ProcessRequest,
        api_key: String,
        app_handle: AppHandle,
    ) -> Result<()> {
        let model = MODEL_REGISTRY.get_model(&request.model)
            .ok_or_else(|| anyhow!("Model not found"))?;
        
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model.metadata.id,
            api_key
        );
        
        let body = self.build_request_body(&request, &model.metadata).await?;
        
        let start_time = std::time::Instant::now();
        
        match self.client.post(&url).json(&body).send().await {
            Ok(response) => {
                let response_time = start_time.elapsed().as_millis() as u64;
                
                if response.status().is_success() {
                    let json: serde_json::Value = response.json().await?;
                    
                    // Update model statistics
                    MODEL_REGISTRY.update_model_stats(&request.model, true, response_time);
                    
                    // Emit response
                    self.emit_response(&app_handle, &request, json).await?;
                    
                    Ok(())
                } else {
                    let error_text = response.text().await?;
                    MODEL_REGISTRY.update_model_stats(&request.model, false, response_time);
                    
                    Err(anyhow!("API error: {}", error_text))
                }
            }
            Err(e) => {
                MODEL_REGISTRY.update_model_stats(&request.model, false, 0);
                Err(anyhow!("Request failed: {}", e))
            }
        }
    }
    
    /// Process streaming request
    async fn process_streaming(
        &self,
        request: ProcessRequest,
        api_key: String,
        app_handle: AppHandle,
    ) -> Result<()> {
        let model = MODEL_REGISTRY.get_model(&request.model)
            .ok_or_else(|| anyhow!("Model not found"))?;
        
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}",
            model.metadata.id,
            api_key
        );
        
        let body = self.build_request_body(&request, &model.metadata).await?;
        
        let response = self.client.post(&url)
            .json(&body)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Streaming API error: {}", error_text));
        }
        
        // Process streaming response
        let mut stream = response.bytes_stream();
        let mut accumulated_text = String::new();
        
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        // Parse SSE format
                        for line in text.lines() {
                            if line.starts_with("data: ") {
                                let data = &line[6..];
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                    if let Some(text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                                        accumulated_text.push_str(text);
                                        
                                        // Emit streaming chunk
                                        let chunk_event = serde_json::json!({
                                            "type": "streaming",
                                            "delta": text,
                                            "accumulated": accumulated_text.clone(),
                                        });
                                        
                                        app_handle.emit("gemini-stream", chunk_event.to_string())?;
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    return Err(anyhow!("Stream error: {}", e));
                }
            }
        }
        
        Ok(())
    }
    
    /// Build request body for Gemini API
    async fn build_request_body(
        &self,
        request: &ProcessRequest,
        model_metadata: &ModelMetadata,
    ) -> Result<serde_json::Value> {
        let mut contents = Vec::new();
        
        // Add conversation history if session exists
        if let Some(session_id) = &request.session_id {
            let conversations = self.conversations.lock().await;
            if let Some(context) = conversations.get(session_id) {
                // Add system instruction if present
                if let Some(system_instruction) = &context.system_instruction {
                    contents.push(serde_json::json!({
                        "role": "system",
                        "parts": [{
                            "text": system_instruction
                        }]
                    }));
                }
                
                // Add previous messages
                for msg in &context.messages {
                    let parts: Vec<serde_json::Value> = msg.content.iter().map(|content| {
                        match content {
                            MessageContent::Text { text } => {
                                serde_json::json!({ "text": text })
                            }
                            MessageContent::Image { mime_type, data } => {
                                serde_json::json!({
                                    "inline_data": {
                                        "mime_type": mime_type,
                                        "data": data
                                    }
                                })
                            }
                            MessageContent::File { mime_type, data, name: _ } => {
                                serde_json::json!({
                                    "inline_data": {
                                        "mime_type": mime_type,
                                        "data": data
                                    }
                                })
                            }
                        }
                    }).collect();
                    
                    contents.push(serde_json::json!({
                        "role": msg.role,
                        "parts": parts
                    }));
                }
            }
        }
        
        // Build current message parts
        let mut parts = vec![serde_json::json!({ "text": request.prompt })];
        
        // Add images
        for (mime_type, data) in &request.images {
            parts.push(serde_json::json!({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": general_purpose::STANDARD.encode(data)
                }
            }));
        }
        
        // Add files
        for (_name, mime_type, data) in &request.files {
            parts.push(serde_json::json!({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": general_purpose::STANDARD.encode(data)
                }
            }));
        }
        
        contents.push(serde_json::json!({
            "parts": parts
        }));
        
        // Build generation config
        let mut generation_config = serde_json::json!({
            "temperature": request.generation_config.temperature.unwrap_or(0.7),
            "maxOutputTokens": request.generation_config.max_output_tokens
                .unwrap_or(model_metadata.capabilities.max_output_tokens),
        });
        
        if model_metadata.capabilities.supports_top_k {
            if let Some(top_k) = request.generation_config.top_k {
                generation_config["topK"] = serde_json::json!(top_k);
            }
        }
        
        if model_metadata.capabilities.supports_top_p {
            if let Some(top_p) = request.generation_config.top_p {
                generation_config["topP"] = serde_json::json!(top_p);
            }
        }
        
        if model_metadata.capabilities.supports_stop_sequences {
            if let Some(stop_sequences) = &request.generation_config.stop_sequences {
                generation_config["stopSequences"] = serde_json::json!(stop_sequences);
            }
        }
        
        if model_metadata.capabilities.json_mode {
            if let Some(response_mime_type) = &request.generation_config.response_mime_type {
                generation_config["responseMimeType"] = serde_json::json!(response_mime_type);
            }
            
            if let Some(response_schema) = &request.generation_config.response_schema {
                generation_config["responseSchema"] = response_schema.clone();
            }
        }
        
        let body = serde_json::json!({
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
        
        Ok(body)
    }
    
    /// Emit response to frontend
    async fn emit_response(
        &self,
        app_handle: &AppHandle,
        request: &ProcessRequest,
        response: serde_json::Value,
    ) -> Result<()> {
        // Update conversation context if session exists
        if let Some(session_id) = &request.session_id {
            let mut conversations = self.conversations.lock().await;
            let context = conversations.entry(session_id.clone())
                .or_insert_with(|| ConversationContext {
                    session_id: session_id.clone(),
                    messages: Vec::new(),
                    system_instruction: None,
                    total_tokens: 0,
                    created_at: chrono::Utc::now(),
                    last_updated: chrono::Utc::now(),
                });
            
            // Add user message
            context.messages.push(ConversationMessage {
                role: "user".to_string(),
                content: vec![MessageContent::Text { text: request.prompt.clone() }],
                timestamp: chrono::Utc::now(),
                tokens: None,
            });
            
            // Add assistant response
            if let Some(text) = response["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                context.messages.push(ConversationMessage {
                    role: "assistant".to_string(),
                    content: vec![MessageContent::Text { text: text.to_string() }],
                    timestamp: chrono::Utc::now(),
                    tokens: None,
                });
            }
            
            context.last_updated = chrono::Utc::now();
        }
        
        // Emit to frontend
        app_handle.emit("gemini-response", response.to_string())?;
        
        Ok(())
    }
    
    /// Queue request for batch processing
    pub async fn queue_request(&self, request: ProcessRequest) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let queued = QueuedRequest {
            id: id.clone(),
            request: request.clone(),
            priority: request.priority,
            created_at: chrono::Utc::now(),
        };
        
        let mut queue = self.request_queue.lock().await;
        queue.push(queued);
        
        // Sort by priority and timestamp
        queue.sort_by(|a, b| {
            b.priority.cmp(&a.priority)
                .then(a.created_at.cmp(&b.created_at))
        });
        
        Ok(id)
    }
    
    /// Process batch of queued requests
    pub async fn process_batch(&self, api_key: String, app_handle: AppHandle) -> Result<Vec<String>> {
        let mut queue = self.request_queue.lock().await;
        let batch_size = 5.min(queue.len());
        let batch: Vec<QueuedRequest> = queue.drain(..batch_size).collect();
        drop(queue);
        
        let mut processed_ids = Vec::new();
        
        for queued in batch {
            match self.process_request(queued.request, api_key.clone(), app_handle.clone()).await {
                Ok(_) => processed_ids.push(queued.id),
                Err(e) => {
                    log::error!("Failed to process queued request {}: {}", queued.id, e);
                }
            }
            
            // Small delay between requests
            sleep(Duration::from_millis(100)).await;
        }
        
        Ok(processed_ids)
    }
}

/// Process Gemini request with advanced features
#[tauri::command]
pub async fn process_gemini_request(
    prompt: String,
    model: String,
    session_id: Option<String>,
    stream: bool,
    api_key: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let processor = GeminiRequestProcessor::new();
    
    let request = ProcessRequest {
        prompt,
        model,
        session_id,
        images: Vec::new(),
        files: Vec::new(),
        stream,
        priority: RequestPriority::Normal,
        preprocess_config: None,
        generation_config: GenerationConfig {
            temperature: Some(0.7),
            max_output_tokens: Some(8192),
            top_k: Some(10),
            top_p: Some(0.95),
            stop_sequences: None,
            response_mime_type: None,
            response_schema: None,
        },
    };
    
    processor.process_request(request, api_key, app_handle)
        .await
        .map_err(|e| e.to_string())
}