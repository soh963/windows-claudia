use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use super::gemini_models::{ModelMetadata, ModelCapabilities, ModelPricing, ModelPerformance};

/// Enhanced model configuration with runtime overrides
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfiguration {
    pub base_metadata: ModelMetadata,
    pub runtime_overrides: ModelOverrides,
    pub feature_flags: HashMap<String, bool>,
    pub custom_parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelOverrides {
    pub temperature_range: Option<(f32, f32)>,
    pub token_multiplier: Option<f32>,
    pub rate_limit_override: Option<u32>,
    pub timeout_override: Option<u64>,
    pub custom_headers: Option<HashMap<String, String>>,
}

/// Model versioning support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelVersion {
    pub version_id: String,
    pub release_date: DateTime<Utc>,
    pub changes: Vec<String>,
    pub migration_guide: Option<String>,
    pub deprecated_features: Vec<String>,
    pub new_features: Vec<String>,
}

/// Model capability detection
pub struct CapabilityDetector {
    test_prompts: HashMap<String, String>,
    capability_validators: HashMap<String, Box<dyn Fn(&str) -> bool + Send + Sync>>,
}

impl Clone for CapabilityDetector {
    fn clone(&self) -> Self {
        // Box<dyn Fn(...)> is not Clone, so we can't derive Clone.
        // This is a workaround. A better solution would be to use Arc<dyn Fn(...)>.
        CapabilityDetector::new()
    }
}

impl std::fmt::Debug for CapabilityDetector {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CapabilityDetector")
            .field("test_prompts", &self.test_prompts)
            .field("capability_validators", &"HashMap<String, Box<dyn Fn(...)>>")
            .finish()
    }
}

impl CapabilityDetector {
    pub fn new() -> Self {
        let mut test_prompts = HashMap::new();
        test_prompts.insert("function_calling".to_string(), 
            "Call the weather function with location 'New York'".to_string());
        test_prompts.insert("json_mode".to_string(), 
            "Return a JSON object with name and age fields".to_string());
        test_prompts.insert("code_generation".to_string(), 
            "Write a function to calculate fibonacci numbers".to_string());
        
        Self {
            test_prompts,
            capability_validators: HashMap::new(),
        }
    }
    
    /// Detect model capabilities through testing
    pub async fn detect_capabilities(
        &self,
        model_id: &str,
        api_key: &str,
    ) -> Result<ModelCapabilities> {
        let mut capabilities = ModelCapabilities {
            text_generation: true, // Always true for Gemini models
            image_understanding: false,
            code_generation: false,
            function_calling: false,
            json_mode: false,
            system_instructions: false,
            context_caching: false,
            max_input_tokens: 0,
            max_output_tokens: 0,
            supports_temperature: true,
            supports_top_k: true,
            supports_top_p: true,
            supports_stop_sequences: true,
        };
        
        // Test various capabilities
        for (capability, prompt) in &self.test_prompts {
            match self.test_capability(model_id, api_key, prompt).await {
                Ok(response) => {
                    match capability.as_str() {
                        "function_calling" => capabilities.function_calling = self.validate_function_call(&response),
                        "json_mode" => capabilities.json_mode = self.validate_json_response(&response),
                        "code_generation" => capabilities.code_generation = self.validate_code_generation(&response),
                        _ => {}
                    }
                }
                Err(e) => {
                    log::warn!("Failed to test capability {}: {}", capability, e);
                }
            }
        }
        
        // Detect token limits through API metadata
        if let Ok(limits) = self.detect_token_limits(model_id, api_key).await {
            capabilities.max_input_tokens = limits.0;
            capabilities.max_output_tokens = limits.1;
        }
        
        Ok(capabilities)
    }
    
    async fn test_capability(&self, model_id: &str, api_key: &str, prompt: &str) -> Result<String> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model_id, api_key
        );
        
        let body = serde_json::json!({
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 100
            }
        });
        
        let response = client.post(&url)
            .json(&body)
            .send()
            .await?;
        
        if response.status().is_success() {
            let json: serde_json::Value = response.json().await?;
            Ok(json["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string())
        } else {
            Err(anyhow!("Capability test failed"))
        }
    }
    
    async fn detect_token_limits(&self, model_id: &str, api_key: &str) -> Result<(u32, u32)> {
        // Query model metadata endpoint
        let client = reqwest::Client::new();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}?key={}",
            model_id, api_key
        );
        
        match client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                let json: serde_json::Value = response.json().await?;
                let input_limit = json["inputTokenLimit"].as_u64().unwrap_or(32768) as u32;
                let output_limit = json["outputTokenLimit"].as_u64().unwrap_or(8192) as u32;
                Ok((input_limit, output_limit))
            }
            _ => Ok((32768, 8192)) // Default limits
        }
    }
    
    fn validate_function_call(&self, response: &str) -> bool {
        response.contains("function") || response.contains("call")
    }
    
    fn validate_json_response(&self, response: &str) -> bool {
        serde_json::from_str::<serde_json::Value>(response).is_ok()
    }
    
    fn validate_code_generation(&self, response: &str) -> bool {
        response.contains("def ") || response.contains("function ") || response.contains("fn ")
    }
}

/// Dynamic model loader
pub struct DynamicModelLoader {
    model_sources: Vec<Box<dyn ModelSource + Send + Sync>>,
    update_interval: std::time::Duration,
    last_update: Arc<RwLock<DateTime<Utc>>>,
}

#[async_trait::async_trait]
trait ModelSource {
    async fn fetch_models(&self) -> Result<Vec<ModelMetadata>>;
    fn source_name(&self) -> &str;
}

/// Google AI Studio model source
struct GoogleAIStudioSource {
    api_key: String,
}

#[async_trait::async_trait]
impl ModelSource for GoogleAIStudioSource {
    async fn fetch_models(&self) -> Result<Vec<ModelMetadata>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            self.api_key
        );
        
        let response = client.get(&url).send().await?;
        
        if response.status().is_success() {
            let json: serde_json::Value = response.json().await?;
            let models = json["models"].as_array()
                .ok_or_else(|| anyhow!("No models array found"))?;
            
            let mut metadata_list = Vec::new();
            
            for model in models {
                if let Ok(metadata) = self.parse_model_metadata(model) {
                    metadata_list.push(metadata);
                }
            }
            
            Ok(metadata_list)
        } else {
            Err(anyhow!("Failed to fetch models from Google AI Studio"))
        }
    }
    
    fn source_name(&self) -> &str {
        "Google AI Studio"
    }
}

impl GoogleAIStudioSource {
    fn parse_model_metadata(&self, json: &serde_json::Value) -> Result<ModelMetadata> {
        let name = json["name"].as_str()
            .ok_or_else(|| anyhow!("Missing model name"))?;
        
        let model_id = name.split('/').last()
            .ok_or_else(|| anyhow!("Invalid model name format"))?;
        
        let display_name = json["displayName"].as_str()
            .unwrap_or(model_id);
        
        let description = json["description"].as_str()
            .unwrap_or("Gemini model");
        
        // Parse capabilities from supported generation methods
        let methods = json["supportedGenerationMethods"].as_array();
        let _supports_streaming = methods.map(|m| 
            m.iter().any(|v| v.as_str() == Some("streamGenerateContent"))
        ).unwrap_or(false);
        
        // Build capabilities
        let capabilities = ModelCapabilities {
            text_generation: true,
            image_understanding: model_id.contains("vision") || model_id.contains("pro"),
            code_generation: true,
            function_calling: true,
            json_mode: true,
            system_instructions: true,
            context_caching: model_id.contains("1.5") || model_id.contains("2.0"),
            max_input_tokens: json["inputTokenLimit"].as_u64().unwrap_or(32768) as u32,
            max_output_tokens: json["outputTokenLimit"].as_u64().unwrap_or(8192) as u32,
            supports_temperature: true,
            supports_top_k: true,
            supports_top_p: true,
            supports_stop_sequences: true,
        };
        
        // Determine pricing based on model type
        let pricing = self.estimate_pricing(model_id);
        
        // Performance characteristics
        let performance = ModelPerformance {
            avg_latency_ms: if model_id.contains("flash") { 800 } else { 1500 },
            tokens_per_second: if model_id.contains("flash") { 200 } else { 120 },
            concurrency_limit: 100,
            rate_limit_rpm: if model_id.contains("exp") { 60 } else { 360 },
            rate_limit_tpd: 10_000_000,
        };
        
        Ok(ModelMetadata {
            id: model_id.to_string(),
            name: display_name.to_string(),
            description: description.to_string(),
            version: json["version"].as_str().unwrap_or("latest").to_string(),
            release_date: Utc::now(), // Would parse from API if available
            deprecation_date: None,
            capabilities,
            pricing,
            performance,
            aliases: vec![],
            recommended_use_cases: self.determine_use_cases(model_id),
            limitations: self.determine_limitations(model_id),
        })
    }
    
    fn estimate_pricing(&self, model_id: &str) -> ModelPricing {
        if model_id.contains("flash") {
            ModelPricing {
                input_per_million: 0.075,
                output_per_million: 0.30,
                cached_input_per_million: Some(0.01875),
                image_per_thousand: Some(0.02),
            }
        } else if model_id.contains("pro") {
            ModelPricing {
                input_per_million: 1.25,
                output_per_million: 5.00,
                cached_input_per_million: Some(0.3125),
                image_per_thousand: Some(0.1),
            }
        } else {
            ModelPricing {
                input_per_million: 0.0,
                output_per_million: 0.0,
                cached_input_per_million: Some(0.0),
                image_per_thousand: Some(0.0),
            }
        }
    }
    
    fn determine_use_cases(&self, model_id: &str) -> Vec<String> {
        let mut use_cases = vec![];
        
        if model_id.contains("flash") {
            use_cases.extend(vec![
                "Real-time interactions".to_string(),
                "Chat applications".to_string(),
                "Quick completions".to_string(),
            ]);
        }
        
        if model_id.contains("pro") {
            use_cases.extend(vec![
                "Complex reasoning".to_string(),
                "Long-context processing".to_string(),
                "Production applications".to_string(),
            ]);
        }
        
        if model_id.contains("vision") {
            use_cases.push("Image analysis".to_string());
        }
        
        use_cases
    }
    
    fn determine_limitations(&self, model_id: &str) -> Vec<String> {
        let mut limitations = vec![];
        
        if model_id.contains("exp") {
            limitations.push("Experimental - API may change".to_string());
        }
        
        if model_id.contains("flash") {
            limitations.push("Less capable than Pro models".to_string());
        }
        
        limitations
    }
}

/// Enhanced model manager with dynamic loading and validation
pub struct EnhancedModelManager {
    configurations: Arc<RwLock<HashMap<String, ModelConfiguration>>>,
    capability_detector: Arc<CapabilityDetector>,
    model_loader: Arc<DynamicModelLoader>,
    version_history: Arc<RwLock<HashMap<String, Vec<ModelVersion>>>>,
}

impl EnhancedModelManager {
    pub fn new(api_key: String) -> Self {
        let google_source = Box::new(GoogleAIStudioSource { api_key });
        
        let model_loader = DynamicModelLoader {
            model_sources: vec![google_source],
            update_interval: std::time::Duration::from_secs(3600), // 1 hour
            last_update: Arc::new(RwLock::new(Utc::now() - chrono::Duration::hours(2))),
        };
        
        Self {
            configurations: Arc::new(RwLock::new(HashMap::new())),
            capability_detector: Arc::new(CapabilityDetector::new()),
            model_loader: Arc::new(model_loader),
            version_history: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Load models dynamically from all sources
    pub async fn load_models(&self) -> Result<Vec<ModelMetadata>> {
        let mut all_models = Vec::new();
        
        for source in &self.model_loader.model_sources {
            match source.fetch_models().await {
                Ok(models) => {
                    log::info!("Loaded {} models from {}", models.len(), source.source_name());
                    all_models.extend(models);
                }
                Err(e) => {
                    log::error!("Failed to load models from {}: {}", source.source_name(), e);
                }
            }
        }
        
        // Update last update time
        *self.model_loader.last_update.write().await = Utc::now();
        
        Ok(all_models)
    }
    
    /// Validate and update model configuration
    pub async fn validate_model_config(
        &self,
        model_id: &str,
        api_key: &str,
    ) -> Result<ModelConfiguration> {
        // Detect current capabilities
        let capabilities = self.capability_detector
            .detect_capabilities(model_id, api_key)
            .await?;
        
        // Load base metadata
        let models = self.load_models().await?;
        let base_metadata = models.into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| anyhow!("Model {} not found", model_id))?;
        
        // Create configuration with detected capabilities
        let mut updated_metadata = base_metadata.clone();
        updated_metadata.capabilities = capabilities;
        
        let config = ModelConfiguration {
            base_metadata: updated_metadata,
            runtime_overrides: ModelOverrides {
                temperature_range: Some((0.0, 2.0)),
                token_multiplier: Some(1.0),
                rate_limit_override: None,
                timeout_override: None,
                custom_headers: None,
            },
            feature_flags: HashMap::new(),
            custom_parameters: HashMap::new(),
        };
        
        // Store configuration
        self.configurations.write().await.insert(model_id.to_string(), config.clone());
        
        Ok(config)
    }
    
    /// Get or create model configuration
    pub async fn get_model_config(&self, model_id: &str) -> Option<ModelConfiguration> {
        self.configurations.read().await.get(model_id).cloned()
    }
    
    /// Update model configuration
    pub async fn update_model_config(
        &self,
        model_id: &str,
        updates: ModelOverrides,
    ) -> Result<()> {
        let mut configs = self.configurations.write().await;
        
        if let Some(config) = configs.get_mut(model_id) {
            config.runtime_overrides = updates;
            Ok(())
        } else {
            Err(anyhow!("Model configuration not found"))
        }
    }
    
    /// Track model version changes
    pub async fn track_version_change(
        &self,
        model_id: &str,
        version: ModelVersion,
    ) {
        let mut history = self.version_history.write().await;
        history.entry(model_id.to_string())
            .or_insert_with(Vec::new)
            .push(version);
    }
}

/// Commands for model management
#[tauri::command]
pub async fn load_gemini_models_dynamic(api_key: String) -> Result<Vec<ModelMetadata>, String> {
    let manager = EnhancedModelManager::new(api_key);
    manager.load_models().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_model_capabilities(
    model_id: String,
    api_key: String,
) -> Result<ModelConfiguration, String> {
    let manager = EnhancedModelManager::new(api_key.clone());
    manager.validate_model_config(&model_id, &api_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_model_configuration(
    model_id: String,
    overrides: ModelOverrides,
    api_key: String,
) -> Result<(), String> {
    let manager = EnhancedModelManager::new(api_key);
    manager.update_model_config(&model_id, overrides)
        .await
        .map_err(|e| e.to_string())
}