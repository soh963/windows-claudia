#![allow(dead_code)]
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use chrono::{DateTime, Utc};
use lazy_static::lazy_static;

/// Model capability flags
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelCapabilities {
    pub text_generation: bool,
    pub image_understanding: bool,
    pub code_generation: bool,
    pub function_calling: bool,
    pub json_mode: bool,
    pub system_instructions: bool,
    pub context_caching: bool,
    pub max_input_tokens: u32,
    pub max_output_tokens: u32,
    pub supports_temperature: bool,
    pub supports_top_k: bool,
    pub supports_top_p: bool,
    pub supports_stop_sequences: bool,
}

/// Model pricing information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    pub input_per_million: f64,
    pub output_per_million: f64,
    pub cached_input_per_million: Option<f64>,
    pub image_per_thousand: Option<f64>,
}

/// Performance characteristics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPerformance {
    pub avg_latency_ms: u32,
    pub tokens_per_second: u32,
    pub concurrency_limit: u32,
    pub rate_limit_rpm: u32,
    pub rate_limit_tpd: u32, // tokens per day
}

/// Model metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub release_date: DateTime<Utc>,
    pub deprecation_date: Option<DateTime<Utc>>,
    pub capabilities: ModelCapabilities,
    pub pricing: ModelPricing,
    pub performance: ModelPerformance,
    pub aliases: Vec<String>,
    pub recommended_use_cases: Vec<String>,
    pub limitations: Vec<String>,
}

/// Model registry entry
#[derive(Debug, Clone)]
pub struct ModelEntry {
    pub metadata: ModelMetadata,
    pub last_validated: DateTime<Utc>,
    pub validation_status: ValidationStatus,
    pub usage_count: u64,
    pub error_count: u64,
    pub avg_response_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValidationStatus {
    Valid,
    Deprecated,
    Unavailable,
    Unknown,
}

/// Dynamic model registry
#[derive(Clone)]
pub struct ModelRegistry {
    models: Arc<RwLock<HashMap<String, ModelEntry>>>,
    cache_ttl: std::time::Duration,
}

impl ModelRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            models: Arc::new(RwLock::new(HashMap::new())),
            cache_ttl: std::time::Duration::from_secs(3600), // 1 hour
        };
        
        // Initialize with known models
        registry.initialize_default_models();
        registry
    }
    
    /// Initialize registry with default Gemini models
    fn initialize_default_models(&mut self) {
        let models = vec![
            ModelMetadata {
                id: "gemini-2.5-pro".to_string(),
                name: "Gemini 2.5 Pro".to_string(),
                description: "Most advanced thinking model with deep reasoning capabilities and 1M context (2M coming soon)".to_string(),
                version: "2.5".to_string(),
                release_date: DateTime::parse_from_rfc3339("2025-03-01T00:00:00Z").unwrap().with_timezone(&Utc),
                deprecation_date: None,
                capabilities: ModelCapabilities {
                    text_generation: true,
                    image_understanding: true,
                    code_generation: true,
                    function_calling: true,
                    json_mode: true,
                    system_instructions: true,
                    context_caching: true,
                    max_input_tokens: 1_048_576, // 1M available now, 2M coming soon
                    max_output_tokens: 8192,
                    supports_temperature: true,
                    supports_top_k: true,
                    supports_top_p: true,
                    supports_stop_sequences: true,
                },
                pricing: ModelPricing {
                    input_per_million: 1.25,
                    output_per_million: 5.00,
                    cached_input_per_million: Some(0.3125),
                    image_per_thousand: Some(0.1),
                },
                performance: ModelPerformance {
                    avg_latency_ms: 2000,
                    tokens_per_second: 100,
                    concurrency_limit: 100,
                    rate_limit_rpm: 360,
                    rate_limit_tpd: 10_000_000,
                },
                aliases: vec!["gemini-pro-2.5".to_string(), "2.5-pro".to_string()],
                recommended_use_cases: vec![
                    "Complex reasoning and deep thinking tasks".to_string(),
                    "Mathematical problem solving and competition-level coding".to_string(),
                    "Advanced code analysis and multimodal reasoning".to_string(),
                    "Scientific research and algorithmic development".to_string(),
                ],
                limitations: vec![
                    "Thinking model - may take longer for complex responses".to_string(),
                    "Higher computational cost for deep reasoning".to_string(),
                ],
            },
            ModelMetadata {
                id: "gemini-2.5-flash".to_string(),
                name: "Gemini 2.5 Flash".to_string(),
                description: "Fast and efficient workhorse model for speed and low-cost".to_string(),
                version: "2.5".to_string(),
                release_date: DateTime::parse_from_rfc3339("2025-03-01T00:00:00Z").unwrap().with_timezone(&Utc),
                deprecation_date: None,
                capabilities: ModelCapabilities {
                    text_generation: true,
                    image_understanding: true,
                    code_generation: true,
                    function_calling: true,
                    json_mode: true,
                    system_instructions: true,
                    context_caching: true,
                    max_input_tokens: 1_048_576,
                    max_output_tokens: 8192,
                    supports_temperature: true,
                    supports_top_k: true,
                    supports_top_p: true,
                    supports_stop_sequences: true,
                },
                pricing: ModelPricing {
                    input_per_million: 0.075,
                    output_per_million: 0.30,
                    cached_input_per_million: Some(0.01875),
                    image_per_thousand: Some(0.02),
                },
                performance: ModelPerformance {
                    avg_latency_ms: 800,
                    tokens_per_second: 200,
                    concurrency_limit: 200,
                    rate_limit_rpm: 1000,
                    rate_limit_tpd: 10_000_000,
                },
                aliases: vec!["gemini-flash-2.5".to_string(), "2.5-flash".to_string()],
                recommended_use_cases: vec![
                    "Chat applications".to_string(),
                    "Quick completions".to_string(),
                    "High-volume tasks".to_string(),
                ],
                limitations: vec![
                    "Less capable than Pro models".to_string(),
                ],
            },
            ModelMetadata {
                id: "gemini-2.5-flash-lite".to_string(),
                name: "Gemini 2.5 Flash-Lite".to_string(),
                description: "Most cost-efficient and fastest model for high-volume tasks".to_string(),
                version: "2.5".to_string(),
                release_date: DateTime::parse_from_rfc3339("2025-03-01T00:00:00Z").unwrap().with_timezone(&Utc),
                deprecation_date: None,
                capabilities: ModelCapabilities {
                    text_generation: true,
                    image_understanding: true,
                    code_generation: true,
                    function_calling: true,
                    json_mode: true,
                    system_instructions: true,
                    context_caching: true,
                    max_input_tokens: 1_048_576,
                    max_output_tokens: 8192,
                    supports_temperature: true,
                    supports_top_k: true,
                    supports_top_p: true,
                    supports_stop_sequences: true,
                },
                pricing: ModelPricing {
                    input_per_million: 0.0375,
                    output_per_million: 0.15,
                    cached_input_per_million: Some(0.009375),
                    image_per_thousand: Some(0.01),
                },
                performance: ModelPerformance {
                    avg_latency_ms: 600,
                    tokens_per_second: 250,
                    concurrency_limit: 300,
                    rate_limit_rpm: 1500,
                    rate_limit_tpd: 15_000_000,
                },
                aliases: vec!["gemini-flash-lite-2.5".to_string(), "2.5-flash-lite".to_string()],
                recommended_use_cases: vec![
                    "Translation and classification".to_string(),
                    "High-volume processing".to_string(),
                    "Latency-sensitive tasks".to_string(),
                ],
                limitations: vec![
                    "Optimized for speed over quality".to_string(),
                ],
            },
            ModelMetadata {
                id: "gemini-2.0-flash-exp".to_string(),
                name: "Gemini 2.0 Flash (Experimental)".to_string(),
                description: "Previous generation experimental model".to_string(),
                version: "2.0".to_string(),
                release_date: DateTime::parse_from_rfc3339("2024-12-01T00:00:00Z").unwrap().with_timezone(&Utc),
                deprecation_date: None,
                capabilities: ModelCapabilities {
                    text_generation: true,
                    image_understanding: true,
                    code_generation: true,
                    function_calling: true,
                    json_mode: true,
                    system_instructions: true,
                    context_caching: true,
                    max_input_tokens: 1_048_576,
                    max_output_tokens: 8192,
                    supports_temperature: true,
                    supports_top_k: true,
                    supports_top_p: true,
                    supports_stop_sequences: true,
                },
                pricing: ModelPricing {
                    input_per_million: 0.075,
                    output_per_million: 0.30,
                    cached_input_per_million: Some(0.01875),
                    image_per_thousand: Some(0.02),
                },
                performance: ModelPerformance {
                    avg_latency_ms: 1000,
                    tokens_per_second: 150,
                    concurrency_limit: 100,
                    rate_limit_rpm: 1000,
                    rate_limit_tpd: 10_000_000,
                },
                aliases: vec!["gemini-flash-2.0".to_string(), "flash-2.0".to_string()],
                recommended_use_cases: vec![
                    "Real-time interactions".to_string(),
                    "Code generation".to_string(),
                    "Quick analysis".to_string(),
                ],
                limitations: vec![
                    "Superseded by 2.5 models".to_string(),
                ],
            },
        ];
        
        let mut registry = self.models.write().unwrap();
        for metadata in models {
            let entry = ModelEntry {
                metadata: metadata.clone(),
                last_validated: Utc::now(),
                validation_status: ValidationStatus::Valid,
                usage_count: 0,
                error_count: 0,
                avg_response_time: 0.0,
            };
            
            // Add by ID
            registry.insert(metadata.id.clone(), entry.clone());
            
            // Add by aliases
            for alias in &metadata.aliases {
                registry.insert(alias.clone(), entry.clone());
            }
        }
    }
    
    /// Get model by ID or alias
    pub fn get_model(&self, model_id: &str) -> Option<ModelEntry> {
        let registry = self.models.read().unwrap();
        registry.get(model_id).cloned()
    }
    
    /// List all available models
    pub fn list_models(&self) -> Vec<ModelMetadata> {
        let registry = self.models.read().unwrap();
        let mut seen_ids = std::collections::HashSet::new();
        let mut models = Vec::new();
        
        for entry in registry.values() {
            if seen_ids.insert(entry.metadata.id.clone()) {
                models.push(entry.metadata.clone());
            }
        }
        
        models.sort_by(|a, b| b.release_date.cmp(&a.release_date));
        models
    }
    
    /// Update model statistics
    pub fn update_model_stats(
        &self,
        model_id: &str,
        success: bool,
        response_time_ms: u64,
    ) {
        let mut registry = self.models.write().unwrap();
        if let Some(entry) = registry.get_mut(model_id) {
            entry.usage_count += 1;
            if !success {
                entry.error_count += 1;
            }
            
            // Update rolling average response time
            let n = entry.usage_count as f64;
            entry.avg_response_time = ((n - 1.0) * entry.avg_response_time + response_time_ms as f64) / n;
        }
    }
    
    /// Validate model availability
    pub async fn validate_model(&self, model_id: &str, api_key: &str) -> Result<bool, String> {
        let model = self.get_model(model_id)
            .ok_or_else(|| format!("Model '{}' not found in registry", model_id))?;
        
        // Create a simple test request
        let client = reqwest::Client::new();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model.metadata.id,
            api_key
        );
        
        let test_body = serde_json::json!({
            "contents": [{
                "parts": [{
                    "text": "Test"
                }]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1
            }
        });
        
        match client.post(&url).json(&test_body).send().await {
            Ok(response) => {
                let is_valid = response.status().is_success();
                
                // Update validation status
                let mut registry = self.models.write().unwrap();
                if let Some(entry) = registry.get_mut(model_id) {
                    entry.last_validated = Utc::now();
                    entry.validation_status = if is_valid {
                        ValidationStatus::Valid
                    } else {
                        ValidationStatus::Unavailable
                    };
                }
                
                Ok(is_valid)
            }
            Err(e) => Err(format!("Failed to validate model: {}", e)),
        }
    }
    
    /// Get model recommendations based on use case
    pub fn recommend_model(&self, use_case: &str) -> Vec<ModelMetadata> {
        let registry = self.models.read().unwrap();
        let mut recommendations = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();
        
        let use_case_lower = use_case.to_lowercase();
        
        for entry in registry.values() {
            if !seen_ids.insert(entry.metadata.id.clone()) {
                continue;
            }
            
            let score = entry.metadata.recommended_use_cases.iter()
                .filter(|uc| uc.to_lowercase().contains(&use_case_lower))
                .count();
            
            if score > 0 {
                recommendations.push((entry.metadata.clone(), score));
            }
        }
        
        // Sort by relevance score
        recommendations.sort_by(|a, b| b.1.cmp(&a.1));
        recommendations.into_iter().map(|(model, _)| model).collect()
    }
    
    /// Check if model supports a specific capability
    pub fn supports_capability(&self, model_id: &str, capability: &str) -> bool {
        if let Some(model) = self.get_model(model_id) {
            match capability {
                "text" => model.metadata.capabilities.text_generation,
                "image" => model.metadata.capabilities.image_understanding,
                "code" => model.metadata.capabilities.code_generation,
                "function_calling" => model.metadata.capabilities.function_calling,
                "json_mode" => model.metadata.capabilities.json_mode,
                "system_instructions" => model.metadata.capabilities.system_instructions,
                "context_caching" => model.metadata.capabilities.context_caching,
                _ => false,
            }
        } else {
            false
        }
    }
}

lazy_static! {
    pub static ref MODEL_REGISTRY: ModelRegistry = ModelRegistry::new();
}

/// Get model information command
#[tauri::command]
pub async fn get_gemini_model_info(model_id: String) -> Result<ModelMetadata, String> {
    MODEL_REGISTRY.get_model(&model_id)
        .map(|entry| entry.metadata)
        .ok_or_else(|| format!("Model '{}' not found", model_id))
}

/// List all available models command
#[tauri::command]
pub async fn list_gemini_models() -> Result<Vec<ModelMetadata>, String> {
    Ok(MODEL_REGISTRY.list_models())
}

/// Get model recommendations command
#[tauri::command]
pub async fn recommend_gemini_model(use_case: String) -> Result<Vec<ModelMetadata>, String> {
    Ok(MODEL_REGISTRY.recommend_model(&use_case))
}

/// Validate model availability command
#[tauri::command]
pub async fn validate_gemini_model(
    model_id: String,
    api_key: String,
) -> Result<bool, String> {
    MODEL_REGISTRY.validate_model(&model_id, &api_key).await
}