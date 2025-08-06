use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::path::PathBuf;

/// Centralized configuration system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiConfiguration {
    pub global: GlobalConfig,
    pub models: HashMap<String, ModelConfig>,
    pub environments: HashMap<String, EnvironmentConfig>,
    pub feature_flags: FeatureFlags,
    pub runtime_overrides: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalConfig {
    pub api_key: Option<String>,
    pub api_key_source: ApiKeySource,
    pub base_url: String,
    pub default_model: String,
    pub request_timeout_ms: u64,
    pub max_retries: u32,
    pub rate_limit_enabled: bool,
    pub cache_enabled: bool,
    pub monitoring_enabled: bool,
    pub debug_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApiKeySource {
    Environment,
    Database,
    File(PathBuf),
    Vault(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub enabled: bool,
    pub display_name: String,
    pub description: String,
    pub default_parameters: ModelParameters,
    pub rate_limits: RateLimitConfig,
    pub pricing_overrides: Option<PricingConfig>,
    pub custom_headers: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelParameters {
    pub temperature: f32,
    pub max_output_tokens: u32,
    pub top_k: Option<u32>,
    pub top_p: Option<f32>,
    pub stop_sequences: Vec<String>,
    pub safety_settings: Vec<SafetySetting>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetySetting {
    pub category: String,
    pub threshold: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub tokens_per_day: u64,
    pub concurrent_requests: u32,
    pub burst_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingConfig {
    pub input_per_million: f64,
    pub output_per_million: f64,
    pub cached_input_per_million: Option<f64>,
    pub custom_rates: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentConfig {
    pub name: String,
    pub base_url_override: Option<String>,
    pub proxy_settings: Option<ProxyConfig>,
    pub model_overrides: HashMap<String, ModelParameters>,
    pub feature_flags: HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub no_proxy: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureFlags {
    pub streaming_enabled: bool,
    pub function_calling_enabled: bool,
    pub json_mode_enabled: bool,
    pub context_caching_enabled: bool,
    pub auto_retry_enabled: bool,
    pub request_validation_enabled: bool,
    pub response_caching_enabled: bool,
    pub metrics_collection_enabled: bool,
}

impl Default for FeatureFlags {
    fn default() -> Self {
        Self {
            streaming_enabled: true,
            function_calling_enabled: true,
            json_mode_enabled: true,
            context_caching_enabled: true,
            auto_retry_enabled: true,
            request_validation_enabled: true,
            response_caching_enabled: true,
            metrics_collection_enabled: true,
        }
    }
}

/// Configuration manager with hot reloading
pub struct ConfigurationManager {
    config: Arc<RwLock<GeminiConfiguration>>,
    config_path: PathBuf,
    environment: String,
    watchers: Arc<RwLock<Vec<ConfigWatcher>>>,
}

#[derive(Clone)]
struct ConfigWatcher {
    name: String,
    callback: Arc<dyn Fn(&GeminiConfiguration) + Send + Sync>,
}

impl ConfigurationManager {
    pub fn new(config_path: PathBuf, environment: String) -> Result<Self> {
        let config = Self::load_config(&config_path)?;
        
        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            config_path,
            environment,
            watchers: Arc::new(RwLock::new(Vec::new())),
        })
    }
    
    /// Load configuration from file
    fn load_config(path: &PathBuf) -> Result<GeminiConfiguration> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            let config: GeminiConfiguration = toml::from_str(&content)
                .or_else(|_| serde_json::from_str(&content))
                .map_err(|e| anyhow!("Failed to parse config: {}", e))?;
            Ok(config)
        } else {
            // Return default configuration
            Ok(Self::default_config())
        }
    }
    
    /// Get default configuration
    fn default_config() -> GeminiConfiguration {
        let mut models = HashMap::new();
        
        // Default model configurations
        models.insert("gemini-2.0-flash-exp".to_string(), ModelConfig {
            enabled: true,
            display_name: "Gemini 2.0 Flash (Experimental)".to_string(),
            description: "Fast, efficient model for quick tasks".to_string(),
            default_parameters: ModelParameters {
                temperature: 0.7,
                max_output_tokens: 8192,
                top_k: Some(10),
                top_p: Some(0.95),
                stop_sequences: vec![],
                safety_settings: vec![
                    SafetySetting {
                        category: "HARM_CATEGORY_HARASSMENT".to_string(),
                        threshold: "BLOCK_ONLY_HIGH".to_string(),
                    },
                    SafetySetting {
                        category: "HARM_CATEGORY_HATE_SPEECH".to_string(),
                        threshold: "BLOCK_ONLY_HIGH".to_string(),
                    },
                ],
            },
            rate_limits: RateLimitConfig {
                requests_per_minute: 1000,
                tokens_per_day: 10_000_000,
                concurrent_requests: 100,
                burst_size: 200,
            },
            pricing_overrides: None,
            custom_headers: HashMap::new(),
        });
        
        let mut environments = HashMap::new();
        environments.insert("production".to_string(), EnvironmentConfig {
            name: "Production".to_string(),
            base_url_override: None,
            proxy_settings: None,
            model_overrides: HashMap::new(),
            feature_flags: HashMap::new(),
        });
        
        environments.insert("development".to_string(), EnvironmentConfig {
            name: "Development".to_string(),
            base_url_override: None,
            proxy_settings: None,
            model_overrides: HashMap::new(),
            feature_flags: HashMap::from([
                ("debug_mode".to_string(), true),
                ("verbose_logging".to_string(), true),
            ]),
        });
        
        GeminiConfiguration {
            global: GlobalConfig {
                api_key: None,
                api_key_source: ApiKeySource::Environment,
                base_url: "https://generativelanguage.googleapis.com/v1beta".to_string(),
                default_model: "gemini-2.0-flash-exp".to_string(),
                request_timeout_ms: 120000,
                max_retries: 3,
                rate_limit_enabled: true,
                cache_enabled: true,
                monitoring_enabled: true,
                debug_mode: false,
            },
            models,
            environments,
            feature_flags: FeatureFlags::default(),
            runtime_overrides: HashMap::new(),
        }
    }
    
    /// Get current configuration
    pub async fn get_config(&self) -> GeminiConfiguration {
        self.config.read().await.clone()
    }
    
    /// Get environment-specific configuration
    pub async fn get_environment_config(&self) -> Result<EnvironmentConfig> {
        let config = self.config.read().await;
        config.environments.get(&self.environment)
            .cloned()
            .ok_or_else(|| anyhow!("Environment '{}' not found", self.environment))
    }
    
    /// Get model configuration with environment overrides
    pub async fn get_model_config(&self, model_id: &str) -> Result<ModelConfig> {
        let config = self.config.read().await;
        
        // Get base model config
        let mut model_config = config.models.get(model_id)
            .cloned()
            .ok_or_else(|| anyhow!("Model '{}' not configured", model_id))?;
        
        // Apply environment overrides if present
        if let Some(env_config) = config.environments.get(&self.environment) {
            if let Some(overrides) = env_config.model_overrides.get(model_id) {
                model_config.default_parameters = overrides.clone();
            }
        }
        
        Ok(model_config)
    }
    
    /// Update configuration
    pub async fn update_config<F>(&self, updater: F) -> Result<()>
    where
        F: FnOnce(&mut GeminiConfiguration),
    {
        let mut config = self.config.write().await;
        updater(&mut config);
        
        // Save to file
        self.save_config(&config).await?;
        
        // Notify watchers
        let watchers = self.watchers.read().await;
        for watcher in watchers.iter() {
            (watcher.callback)(&config);
        }
        
        Ok(())
    }
    
    /// Save configuration to file
    async fn save_config(&self, config: &GeminiConfiguration) -> Result<()> {
        let content = toml::to_string_pretty(config)?;
        tokio::fs::write(&self.config_path, content).await?;
        Ok(())
    }
    
    /// Reload configuration from file
    pub async fn reload(&self) -> Result<()> {
        let new_config = Self::load_config(&self.config_path)?;
        *self.config.write().await = new_config;
        
        // Notify watchers
        let config = self.config.read().await;
        let watchers = self.watchers.read().await;
        for watcher in watchers.iter() {
            (watcher.callback)(&config);
        }
        
        Ok(())
    }
    
    /// Register a configuration change watcher
    pub async fn watch<F>(&self, name: String, callback: F)
    where
        F: Fn(&GeminiConfiguration) + Send + Sync + 'static,
    {
        let watcher = ConfigWatcher {
            name,
            callback: Arc::new(callback),
        };
        
        self.watchers.write().await.push(watcher);
    }
    
    /// Apply runtime override
    pub async fn set_runtime_override(&self, key: String, value: serde_json::Value) -> Result<()> {
        self.update_config(|config| {
            config.runtime_overrides.insert(key, value);
        }).await
    }
    
    /// Get effective value with overrides
    pub async fn get_value<T>(&self, path: &str) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let config = self.config.read().await;
        
        // Check runtime overrides first
        if let Some(override_value) = config.runtime_overrides.get(path) {
            return serde_json::from_value(override_value.clone())
                .map_err(|e| anyhow!("Failed to deserialize override: {}", e));
        }
        
        // Parse path and get value from config
        let parts: Vec<&str> = path.split('.').collect();
        let config_json = serde_json::to_value(&*config)?;
        
        let mut current = &config_json;
        for part in parts {
            current = current.get(part)
                .ok_or_else(|| anyhow!("Path '{}' not found", path))?;
        }
        
        serde_json::from_value(current.clone())
            .map_err(|e| anyhow!("Failed to deserialize value: {}", e))
    }
    
    /// Validate configuration
    pub async fn validate(&self) -> Result<Vec<ConfigValidationIssue>> {
        let config = self.config.read().await;
        let mut issues = Vec::new();
        
        // Validate global config
        if config.global.api_key.is_none() && matches!(config.global.api_key_source, ApiKeySource::Database) {
            issues.push(ConfigValidationIssue {
                severity: IssueSeverity::Error,
                path: "global.api_key".to_string(),
                message: "API key not set but source is Database".to_string(),
            });
        }
        
        if config.global.request_timeout_ms < 1000 {
            issues.push(ConfigValidationIssue {
                severity: IssueSeverity::Warning,
                path: "global.request_timeout_ms".to_string(),
                message: "Request timeout is very low (<1s)".to_string(),
            });
        }
        
        // Validate model configs
        for (model_id, model_config) in &config.models {
            if model_config.default_parameters.temperature < 0.0 || 
               model_config.default_parameters.temperature > 2.0 {
                issues.push(ConfigValidationIssue {
                    severity: IssueSeverity::Warning,
                    path: format!("models.{}.default_parameters.temperature", model_id),
                    message: "Temperature should be between 0.0 and 2.0".to_string(),
                });
            }
            
            if model_config.rate_limits.requests_per_minute == 0 {
                issues.push(ConfigValidationIssue {
                    severity: IssueSeverity::Error,
                    path: format!("models.{}.rate_limits.requests_per_minute", model_id),
                    message: "Rate limit cannot be 0".to_string(),
                });
            }
        }
        
        Ok(issues)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigValidationIssue {
    pub severity: IssueSeverity,
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueSeverity {
    Error,
    Warning,
    Info,
}

/// Configuration commands
#[tauri::command]
pub async fn get_gemini_configuration(
    environment: Option<String>,
) -> Result<GeminiConfiguration, String> {
    let config_path = dirs::config_dir()
        .ok_or("Failed to get config directory")?
        .join("claudia")
        .join("gemini-config.toml");
    
    let env = environment.unwrap_or_else(|| "production".to_string());
    let manager = ConfigurationManager::new(config_path, env)
        .map_err(|e| e.to_string())?;
    
    Ok(manager.get_config().await)
}

#[tauri::command]
pub async fn update_gemini_configuration(
    config: GeminiConfiguration,
    environment: Option<String>,
) -> Result<(), String> {
    let config_path = dirs::config_dir()
        .ok_or("Failed to get config directory")?
        .join("claudia")
        .join("gemini-config.toml");
    
    let env = environment.unwrap_or_else(|| "production".to_string());
    let manager = ConfigurationManager::new(config_path, env)
        .map_err(|e| e.to_string())?;
    
    manager.update_config(|c| *c = config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_gemini_configuration(
    environment: Option<String>,
) -> Result<Vec<ConfigValidationIssue>, String> {
    let config_path = dirs::config_dir()
        .ok_or("Failed to get config directory")?
        .join("claudia")
        .join("gemini-config.toml");
    
    let env = environment.unwrap_or_else(|| "production".to_string());
    let manager = ConfigurationManager::new(config_path, env)
        .map_err(|e| e.to_string())?;
    
    manager.validate().await.map_err(|e| e.to_string())
}