use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{State, Emitter};
use super::agents::AgentDb;
use log;

/// Universal Gemini model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalModelInfo {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub version: String,
    pub status: ModelStatus,
    pub capabilities: ModelCapabilities,
    pub limits: ModelLimits,
    pub api_version: String,
    pub supported_generation_methods: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelStatus {
    Stable,
    Experimental,
    Deprecated,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCapabilities {
    pub text_generation: bool,
    pub code_generation: bool,
    pub multimodal: bool,
    pub streaming: bool,
    pub function_calling: bool,
    pub system_instructions: bool,
    pub json_mode: bool,
    pub thinking_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelLimits {
    pub max_input_tokens: u32,
    pub max_output_tokens: u32,
    pub max_temperature: f32,
    pub rate_limit_rpm: u32,
    pub rate_limit_tpm: u32,
}

/// Model discovery and validation system
#[derive(Clone)]
pub struct GeminiModelRegistry {
    models: Arc<RwLock<HashMap<String, UniversalModelInfo>>>,
    api_key: String,
    last_refresh: Arc<RwLock<std::time::Instant>>,
}

impl GeminiModelRegistry {
    pub fn new(api_key: String) -> Self {
        Self {
            models: Arc::new(RwLock::new(HashMap::new())),
            api_key,
            last_refresh: Arc::new(RwLock::new(std::time::Instant::now())),
        }
    }

    /// Discover all available Gemini models dynamically
    pub async fn discover_models(&self) -> Result<Vec<UniversalModelInfo>, String> {
        log::info!("Discovering available Gemini models...");
        
        let client = reqwest::Client::new();
        
        // Try v1 API first (for newer models)
        let v1_url = format!(
            "https://generativelanguage.googleapis.com/v1/models?key={}",
            self.api_key
        );
        
        let mut all_models = Vec::new();
        
        // Fetch v1 models
        match client.get(&v1_url).send().await {
            Ok(response) if response.status().is_success() => {
                if let Ok(json) = response.json::<serde_json::Value>().await {
                    if let Some(models) = json["models"].as_array() {
                        for model in models {
                            if let Ok(info) = self.parse_model_info(model, "v1") {
                                all_models.push(info);
                            }
                        }
                    }
                }
            },
            _ => log::warn!("Failed to fetch v1 models"),
        }
        
        // Try v1beta API (for experimental and older models)
        let v1beta_url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            self.api_key
        );
        
        match client.get(&v1beta_url).send().await {
            Ok(response) if response.status().is_success() => {
                if let Ok(json) = response.json::<serde_json::Value>().await {
                    if let Some(models) = json["models"].as_array() {
                        for model in models {
                            if let Ok(info) = self.parse_model_info(model, "v1beta") {
                                // Avoid duplicates
                                if !all_models.iter().any(|m| m.id == info.id) {
                                    all_models.push(info);
                                }
                            }
                        }
                    }
                }
            },
            _ => log::warn!("Failed to fetch v1beta models"),
        }
        
        // Update registry
        let mut registry = self.models.write().await;
        registry.clear();
        for model in &all_models {
            registry.insert(model.id.clone(), model.clone());
        }
        
        // Update last refresh time
        *self.last_refresh.write().await = std::time::Instant::now();
        
        log::info!("Discovered {} Gemini models", all_models.len());
        Ok(all_models)
    }

    /// Parse model information from API response
    fn parse_model_info(&self, model: &serde_json::Value, api_version: &str) -> Result<UniversalModelInfo, String> {
        let id = model["name"].as_str()
            .ok_or("Missing model name")?
            .replace("models/", "");
        
        let display_name = model["displayName"].as_str()
            .unwrap_or(&id)
            .to_string();
        
        let description = model["description"].as_str()
            .unwrap_or("No description available")
            .to_string();
        
        let version = model["version"].as_str()
            .unwrap_or("unknown")
            .to_string();
        
        // Determine model status
        let status = if id.contains("exp") || id.contains("experimental") {
            ModelStatus::Experimental
        } else if id.contains("deprecated") {
            ModelStatus::Deprecated
        } else {
            ModelStatus::Stable
        };
        
        // Parse capabilities
        let supported_methods: Vec<String> = model["supportedGenerationMethods"]
            .as_array()
            .map(|arr| arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect())
            .unwrap_or_default();
        
        let capabilities = ModelCapabilities {
            text_generation: supported_methods.contains(&"generateContent".to_string()),
            code_generation: id.contains("code") || id.contains("2.0") || id.contains("2.5"),
            multimodal: supported_methods.contains(&"generateContent".to_string()),
            streaming: supported_methods.contains(&"streamGenerateContent".to_string()),
            function_calling: !id.contains("1.0"),
            system_instructions: !id.contains("1.0"),
            json_mode: id.contains("2.") || id.contains("1.5"),
            thinking_mode: id.contains("2.5") || id.contains("thinking"),
        };
        
        // Parse limits
        let limits = ModelLimits {
            max_input_tokens: model["inputTokenLimit"].as_u64()
                .unwrap_or(32768) as u32,
            max_output_tokens: model["outputTokenLimit"].as_u64()
                .unwrap_or(8192) as u32,
            max_temperature: 2.0,
            rate_limit_rpm: if api_version == "v1" { 300 } else { 60 },
            rate_limit_tpm: if api_version == "v1" { 1_000_000 } else { 60_000 },
        };
        
        Ok(UniversalModelInfo {
            id: id.clone(),
            name: id,
            display_name,
            description,
            version,
            status,
            capabilities,
            limits,
            api_version: api_version.to_string(),
            supported_generation_methods: supported_methods,
        })
    }

    /// Validate if a specific model is available and working
    pub async fn validate_model(&self, model_id: &str) -> Result<bool, String> {
        log::info!("Validating model: {}", model_id);
        
        let client = reqwest::Client::new();
        
        // Determine API version for the model
        let api_version = if model_id.contains("2.5") || model_id.contains("2.0") {
            "v1"
        } else {
            "v1beta"
        };
        
        let url = format!(
            "https://generativelanguage.googleapis.com/{}/models/{}:generateContent?key={}",
            api_version, model_id, self.api_key
        );
        
        // Simple test request
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
        
        match client.post(&url).json(&test_body).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    log::info!("Model {} validated successfully", model_id);
                    Ok(true)
                } else {
                    let status = response.status();
                    let error_text = response.text().await.unwrap_or_default();
                    log::warn!("Model {} validation failed: {} - {}", model_id, status, error_text);
                    Ok(false)
                }
            },
            Err(e) => {
                log::error!("Model {} validation error: {}", model_id, e);
                Ok(false)
            }
        }
    }

    /// Get fallback chain for a model
    pub async fn get_fallback_chain(&self, primary_model: &str) -> Vec<String> {
        let registry = self.models.read().await;
        
        let mut chain = Vec::new();
        chain.push(primary_model.to_string());
        
        // Add similar models based on capabilities
        if let Some(primary) = registry.get(primary_model) {
            // Find models with similar capabilities
            let mut similar_models: Vec<(String, u32)> = registry
                .iter()
                .filter(|(id, _)| *id != primary_model)
                .map(|(id, model)| {
                    let score = self.calculate_similarity_score(primary, model);
                    (id.clone(), score)
                })
                .collect();
            
            // Sort by similarity score
            similar_models.sort_by(|a, b| b.1.cmp(&a.1));
            
            // Add top 3 similar models
            for (model_id, _) in similar_models.iter().take(3) {
                chain.push(model_id.clone());
            }
        }
        
        // Always add stable fallbacks
        if !chain.contains(&"gemini-2.0-flash".to_string()) {
            chain.push("gemini-2.0-flash".to_string());
        }
        if !chain.contains(&"gemini-1.5-flash-002".to_string()) {
            chain.push("gemini-1.5-flash-002".to_string());
        }
        
        chain
    }

    /// Calculate similarity score between two models
    fn calculate_similarity_score(&self, model1: &UniversalModelInfo, model2: &UniversalModelInfo) -> u32 {
        let mut score = 0;
        
        // Status similarity
        if matches!(model1.status, ModelStatus::Stable) && matches!(model2.status, ModelStatus::Stable) {
            score += 10;
        }
        
        // Capability matching
        if model1.capabilities.code_generation == model2.capabilities.code_generation {
            score += 5;
        }
        if model1.capabilities.multimodal == model2.capabilities.multimodal {
            score += 5;
        }
        if model1.capabilities.streaming == model2.capabilities.streaming {
            score += 3;
        }
        if model1.capabilities.function_calling == model2.capabilities.function_calling {
            score += 3;
        }
        if model1.capabilities.thinking_mode == model2.capabilities.thinking_mode {
            score += 4;
        }
        
        // API version matching
        if model1.api_version == model2.api_version {
            score += 5;
        }
        
        // Token limit similarity
        let token_diff = (model1.limits.max_input_tokens as i32 - model2.limits.max_input_tokens as i32).abs();
        if token_diff < 10000 {
            score += 3;
        }
        
        score
    }
}

/// Robust request execution with automatic fallback
pub struct UniversalGeminiExecutor {
    registry: GeminiModelRegistry,
    max_retries: u32,
    retry_delay: std::time::Duration,
}

impl UniversalGeminiExecutor {
    pub fn new(api_key: String) -> Self {
        Self {
            registry: GeminiModelRegistry::new(api_key),
            max_retries: 3,
            retry_delay: std::time::Duration::from_millis(500),
        }
    }

    /// Execute request with automatic fallback and retry
    pub async fn execute_with_fallback(
        &self,
        prompt: String,
        preferred_model: String,
        app_handle: tauri::AppHandle,
    ) -> Result<serde_json::Value, String> {
        // Get fallback chain
        let fallback_chain = self.registry.get_fallback_chain(&preferred_model).await;
        
        log::info!("Executing with fallback chain: {:?}", fallback_chain);
        
        for model in fallback_chain {
            log::info!("Trying model: {}", model);
            
            // Try multiple times with the same model
            for attempt in 0..self.max_retries {
                match self.execute_single_request(&prompt, &model).await {
                    Ok(response) => {
                        log::info!("Success with model {} on attempt {}", model, attempt + 1);
                        
                        // Emit success event
                        let _ = app_handle.emit("gemini-model-used", serde_json::json!({
                            "requested": preferred_model,
                            "used": model,
                            "attempt": attempt + 1
                        }));
                        
                        return Ok(response);
                    },
                    Err(e) => {
                        log::warn!("Attempt {} with model {} failed: {}", attempt + 1, model, e);
                        
                        // Check if error is retryable
                        if !self.is_retryable_error(&e) {
                            break; // Move to next model
                        }
                        
                        // Wait before retry
                        if attempt < self.max_retries - 1 {
                            tokio::time::sleep(self.retry_delay * (attempt + 1)).await;
                        }
                    }
                }
            }
        }
        
        Err("All models and retries exhausted".to_string())
    }

    /// Execute a single request to a specific model
    async fn execute_single_request(
        &self,
        prompt: &str,
        model: &str,
    ) -> Result<serde_json::Value, String> {
        let client = reqwest::Client::new();
        
        // Determine API version
        let api_version = self.determine_api_version(model);
        
        let url = format!(
            "https://generativelanguage.googleapis.com/{}/models/{}:generateContent?key={}",
            api_version, model, self.registry.api_key
        );
        
        let request_body = self.build_request_body(prompt, model);
        
        let response = client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        let status = response.status();
        
        if status.is_success() {
            response.json().await
                .map_err(|e| format!("Failed to parse response: {}", e))
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(format!("API error ({}): {}", status, error_text))
        }
    }

    /// Determine the correct API version for a model
    fn determine_api_version(&self, model: &str) -> &str {
        // Use v1 for 2.0+ models
        if model.contains("2.5") || model.contains("2.0") {
            "v1"
        } else {
            "v1beta"
        }
    }

    /// Build request body adapted to model requirements
    fn build_request_body(&self, prompt: &str, model: &str) -> serde_json::Value {
        let mut body = serde_json::json!({
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8192,
                "topK": 10,
                "topP": 0.95
            }
        });
        
        // Add model-specific configurations
        if model.contains("2.5") {
            // 2.5 models support thinking mode
            body["generationConfig"]["responseModalities"] = serde_json::json!(["TEXT"]);
        }
        
        // Add safety settings for all models
        body["safetySettings"] = serde_json::json!([
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
        ]);
        
        body
    }

    /// Check if an error is retryable
    fn is_retryable_error(&self, error: &str) -> bool {
        error.contains("429") || // Rate limit
        error.contains("503") || // Service unavailable
        error.contains("timeout") || // Timeout
        error.contains("Network") // Network errors
    }
}

/// Tauri command to discover all available models
#[tauri::command]
pub async fn discover_gemini_models(
    db: State<'_, AgentDb>,
) -> Result<Vec<UniversalModelInfo>, String> {
    // Get API key
    let api_key = {
        let conn = db.0.lock().unwrap();
        match conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
            [],
            |row| row.get::<_, String>(0),
        ) {
            Ok(key) => key,
            Err(_) => std::env::var("GEMINI_API_KEY")
                .map_err(|_| "Gemini API key not configured")?
        }
    };
    
    let registry = GeminiModelRegistry::new(api_key);
    registry.discover_models().await
}

/// Tauri command to validate a specific model
#[tauri::command]
pub async fn validate_gemini_model_universal(
    model_id: String,
    db: State<'_, AgentDb>,
) -> Result<bool, String> {
    // Get API key
    let api_key = {
        let conn = db.0.lock().unwrap();
        match conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
            [],
            |row| row.get::<_, String>(0),
        ) {
            Ok(key) => key,
            Err(_) => std::env::var("GEMINI_API_KEY")
                .map_err(|_| "Gemini API key not configured")?
        }
    };
    
    let registry = GeminiModelRegistry::new(api_key);
    registry.validate_model(&model_id).await
}

/// Tauri command to execute with universal compatibility
#[tauri::command]
pub async fn execute_gemini_universal(
    prompt: String,
    model: String,
    app_handle: tauri::AppHandle,
    db: State<'_, AgentDb>,
) -> Result<String, String> {
    log::info!("Executing universal Gemini request with model: {}", model);
    
    // Get API key
    let api_key = {
        let conn = db.0.lock().unwrap();
        match conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
            [],
            |row| row.get::<_, String>(0),
        ) {
            Ok(key) => key,
            Err(_) => std::env::var("GEMINI_API_KEY")
                .map_err(|_| "Gemini API key not configured")?
        }
    };
    
    let executor = UniversalGeminiExecutor::new(api_key);
    
    // Execute with fallback
    let response = executor.execute_with_fallback(prompt, model, app_handle).await?;
    
    // Extract text from response
    if let Some(candidates) = response["candidates"].as_array() {
        if let Some(first) = candidates.first() {
            if let Some(text) = first["content"]["parts"][0]["text"].as_str() {
                return Ok(text.to_string());
            }
        }
    }
    
    Err("Failed to extract response text".to_string())
}

/// Get fallback chain for a model
#[tauri::command]
pub async fn get_gemini_fallback_chain(
    model: String,
    db: State<'_, AgentDb>,
) -> Result<Vec<String>, String> {
    // Get API key
    let api_key = {
        let conn = db.0.lock().unwrap();
        match conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
            [],
            |row| row.get::<_, String>(0),
        ) {
            Ok(key) => key,
            Err(_) => std::env::var("GEMINI_API_KEY")
                .map_err(|_| "Gemini API key not configured")?
        }
    };
    
    let registry = GeminiModelRegistry::new(api_key);
    Ok(registry.get_fallback_chain(&model).await)
}