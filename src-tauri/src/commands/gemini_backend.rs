use anyhow::Result;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;

use super::agents::AgentDb;
use super::gemini_models::MODEL_REGISTRY;
use super::gemini_performance::{
    ConnectionPool, ResponseCache, RateLimiter, RateLimit, 
    BatchAggregator, PerformanceMonitor
};
use super::gemini_processor::{
    GeminiRequestProcessor, ProcessRequest, RequestPriority,
    GenerationConfig, PreprocessConfig
};
use super::gemini_resilience::{
    ResilienceManager, RetryConfig, HealthCheckManager
};
use super::gemini_monitoring::{
    MonitoringCollector, GeminiLogger, LoggingConfig,
    RequestMetrics, RequestStatus
};

lazy_static! {
    static ref GEMINI_BACKEND: Arc<GeminiBackendService> = Arc::new(
        GeminiBackendService::new()
    );
}

/// Comprehensive Gemini backend service
pub struct GeminiBackendService {
    // Core components
    request_processor: Arc<GeminiRequestProcessor>,
    model_registry: Arc<super::gemini_models::ModelRegistry>,
    
    // Performance components
    connection_pool: Arc<ConnectionPool>,
    response_cache: Arc<ResponseCache>,
    rate_limiter: Arc<RateLimiter>,
    batch_aggregator: Arc<BatchAggregator>,
    performance_monitor: Arc<PerformanceMonitor>,
    
    // Resilience components
    resilience_manager: Arc<ResilienceManager>,
    health_check_manager: Arc<HealthCheckManager>,
    
    // Monitoring components
    monitoring_collector: Arc<MonitoringCollector>,
    logger: Arc<GeminiLogger>,
    
    // Configuration
    config: Arc<RwLock<BackendConfig>>,
}

/// Backend configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendConfig {
    // Performance settings
    pub max_concurrent_requests: usize,
    pub connection_pool_size: usize,
    pub cache_max_entries: usize,
    pub cache_max_size_mb: usize,
    pub batch_size: usize,
    pub batch_timeout_ms: u64,
    
    // Resilience settings
    pub retry_config: RetryConfig,
    pub health_check_interval_secs: u64,
    pub circuit_breaker_enabled: bool,
    
    // Monitoring settings
    pub monitoring_enabled: bool,
    pub logging_config: LoggingConfig,
    pub metrics_retention_hours: u64,
}

impl Default for BackendConfig {
    fn default() -> Self {
        Self {
            max_concurrent_requests: 10,
            connection_pool_size: 20,
            cache_max_entries: 1000,
            cache_max_size_mb: 100,
            batch_size: 5,
            batch_timeout_ms: 5000,
            retry_config: RetryConfig::default(),
            health_check_interval_secs: 300,
            circuit_breaker_enabled: true,
            monitoring_enabled: true,
            logging_config: LoggingConfig::default(),
            metrics_retention_hours: 24,
        }
    }
}

impl GeminiBackendService {
    pub fn new() -> Self {
        let config = BackendConfig::default();
        
        // Initialize components
        let connection_pool = Arc::new(ConnectionPool::new(
            config.connection_pool_size,
            std::time::Duration::from_secs(300),
        ));
        
        let response_cache = Arc::new(ResponseCache::new(
            config.cache_max_entries,
            config.cache_max_size_mb * 1024 * 1024,
        ));
        
        let rate_limiter = Arc::new(RateLimiter::new());
        
        // Set default rate limits for models
        rate_limiter.set_limit(
            "gemini-2.0-flash-exp".to_string(),
            RateLimit {
                requests_per_minute: 1000,
                tokens_per_day: 10_000_000,
                concurrent_requests: 100,
            },
        );
        
        rate_limiter.set_limit(
            "gemini-exp-1206".to_string(),
            RateLimit {
                requests_per_minute: 60,
                tokens_per_day: 1_000_000,
                concurrent_requests: 50,
            },
        );
        
        let batch_aggregator = Arc::new(BatchAggregator::new(
            config.batch_size,
            std::time::Duration::from_millis(config.batch_timeout_ms),
        ));
        
        let performance_monitor = Arc::new(PerformanceMonitor::new());
        
        let resilience_manager = Arc::new(ResilienceManager::new(
            config.retry_config.clone(),
        ));
        
        let health_check_manager = Arc::new(HealthCheckManager::new(
            std::time::Duration::from_secs(config.health_check_interval_secs),
        ));
        
        let monitoring_collector = Arc::new(MonitoringCollector::new(10000));
        
        let logger = Arc::new(GeminiLogger::new(config.logging_config.clone()));
        
        let request_processor = Arc::new(GeminiRequestProcessor::new());
        
        Self {
            request_processor,
            model_registry: Arc::new(MODEL_REGISTRY.clone()),
            connection_pool,
            response_cache,
            rate_limiter,
            batch_aggregator,
            performance_monitor,
            resilience_manager,
            health_check_manager,
            monitoring_collector,
            logger,
            config: Arc::new(RwLock::new(config)),
        }
    }
    
    /// Process a Gemini request with full backend features
    pub async fn process_request(
        &self,
        request: GeminiRequest,
        api_key: String,
        app_handle: AppHandle,
    ) -> Result<()> {
        let request_id = uuid::Uuid::new_v4().to_string();
        let start_time = std::time::Instant::now();
        
        // Log request
        self.logger.log_request(&request_id, &request.model, &request.prompt);
        
        // Check cache first
        let cache_key = ResponseCache::generate_key(
            &request.model,
            &request.prompt,
            request.temperature.unwrap_or(0.7),
            request.max_output_tokens.unwrap_or(8192),
        );
        
        if let Some(cached_response) = self.response_cache.get(&cache_key) {
            // Record cache hit
            let duration = start_time.elapsed().as_millis() as u64;
            self.record_metrics(
                &request_id,
                &request.model,
                duration,
                0,
                0,
                true,
                RequestStatus::Success,
                None,
            );
            
            // Emit cached response
            app_handle.emit("gemini-response", cached_response)?;
            return Ok(());
        }
        
        // Acquire rate limit permit
        let _permit = self.rate_limiter.acquire(&request.model).await?;
        
        // Build process request
        let process_request = ProcessRequest {
            prompt: request.prompt.clone(),
            model: request.model.clone(),
            session_id: request.session_id.clone(),
            images: request.images.unwrap_or_default(),
            files: request.files.unwrap_or_default(),
            stream: request.stream.unwrap_or(false),
            priority: request.priority.unwrap_or(RequestPriority::Normal),
            preprocess_config: request.preprocess_config,
            generation_config: GenerationConfig {
                temperature: request.temperature,
                max_output_tokens: request.max_output_tokens,
                top_k: request.top_k,
                top_p: request.top_p,
                stop_sequences: request.stop_sequences,
                response_mime_type: request.response_mime_type,
                response_schema: request.response_schema,
            },
        };
        
        // Execute with resilience
        let processor = self.request_processor.clone();
        let result = self.resilience_manager.execute_resilient(
            &request.model,
            move || {
                let req = process_request.clone();
                let key = api_key.clone();
                let handle = app_handle.clone();
                let processor = processor.clone();
                
                Box::pin(async move {
                    processor.process_request(req, key, handle).await
                })
            },
        ).await;
        
        let duration = start_time.elapsed().as_millis() as u64;
        
        match result {
            Ok(_) => {
                // Record success metrics
                self.record_metrics(
                    &request_id,
                    &request.model,
                    duration,
                    request.prompt.len() as u32 / 4, // Rough estimate
                    2000, // Rough estimate
                    false,
                    RequestStatus::Success,
                    None,
                );
                
                // Cache successful response (would need to capture actual response)
                // self.response_cache.put(cache_key, response, 3600);
                
                Ok(())
            }
            Err(e) => {
                // Log error
                self.logger.log_error(&request_id, &e.to_string());
                
                // Record failure metrics
                self.record_metrics(
                    &request_id,
                    &request.model,
                    duration,
                    0,
                    0,
                    false,
                    RequestStatus::Failed,
                    Some(e.to_string()),
                );
                
                Err(e)
            }
        }
    }
    
    /// Record metrics for a request
    fn record_metrics(
        &self,
        request_id: &str,
        model: &str,
        duration_ms: u64,
        input_tokens: u32,
        output_tokens: u32,
        cache_hit: bool,
        status: RequestStatus,
        error: Option<String>,
    ) {
        // Calculate cost estimate
        let cost_estimate = if let Some(model_entry) = self.model_registry.get_model(model) {
            let input_cost = (input_tokens as f64 / 1_000_000.0) * model_entry.metadata.pricing.input_per_million;
            let output_cost = (output_tokens as f64 / 1_000_000.0) * model_entry.metadata.pricing.output_per_million;
            input_cost + output_cost
        } else {
            0.0
        };
        
        let metrics = RequestMetrics {
            request_id: request_id.to_string(),
            model: model.to_string(),
            timestamp: chrono::Utc::now(),
            duration_ms,
            input_tokens,
            output_tokens,
            total_tokens: input_tokens + output_tokens,
            cost_estimate,
            status: status.clone(),
            error,
            cache_hit,
            retry_count: 0,
        };
        
        // Record in monitoring collector
        self.monitoring_collector.record_request(metrics.clone());
        
        // Update performance monitor
        self.performance_monitor.record_request(
            model,
            status == RequestStatus::Success,
            duration_ms,
            input_tokens,
            output_tokens,
            cache_hit,
        );
        
        // Log performance metrics
        self.logger.log_performance(&metrics);
    }
    
    /// Update backend configuration
    pub async fn update_config(&self, new_config: BackendConfig) {
        *self.config.write().await = new_config;
    }
    
    /// Get current configuration
    pub async fn get_config(&self) -> BackendConfig {
        self.config.read().await.clone()
    }
}

/// Unified Gemini request structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiRequest {
    pub prompt: String,
    pub model: String,
    pub session_id: Option<String>,
    pub temperature: Option<f32>,
    pub max_output_tokens: Option<u32>,
    pub top_k: Option<u32>,
    pub top_p: Option<f32>,
    pub stop_sequences: Option<Vec<String>>,
    pub system_instruction: Option<String>,
    pub images: Option<Vec<(String, Vec<u8>)>>,
    pub files: Option<Vec<(String, String, Vec<u8>)>>,
    pub stream: Option<bool>,
    pub priority: Option<RequestPriority>,
    pub preprocess_config: Option<PreprocessConfig>,
    pub response_mime_type: Option<String>,
    pub response_schema: Option<serde_json::Value>,
}

/// Enhanced Gemini execution command
#[tauri::command]
pub async fn execute_gemini_enhanced(
    request: GeminiRequest,
    app_handle: AppHandle,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    // Get API key
    let api_key = {
        let conn = db.0.lock()
            .map_err(|e| format!("Failed to acquire database lock: {}", e))?;
        
        // First check environment variable
        if let Ok(key) = std::env::var("GEMINI_API_KEY") {
            key
        } else {
            // Then check database
            match conn.query_row(
                "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
                [],
                |row| row.get::<_, String>(0),
            ) {
                Ok(key) => key,
                Err(_) => return Err("Gemini API key not configured".to_string()),
            }
        }
    };
    
    // Process request through backend service
    GEMINI_BACKEND.process_request(request, api_key, app_handle)
        .await
        .map_err(|e| e.to_string())
}

/// Get backend configuration command
#[tauri::command]
pub async fn get_gemini_backend_config() -> Result<BackendConfig, String> {
    Ok(GEMINI_BACKEND.get_config().await)
}

/// Update backend configuration command
#[tauri::command]
pub async fn update_gemini_backend_config(config: BackendConfig) -> Result<(), String> {
    GEMINI_BACKEND.update_config(config).await;
    Ok(())
}

/// Get comprehensive backend status
#[tauri::command]
pub async fn get_gemini_backend_status() -> Result<serde_json::Value, String> {
    let realtime_metrics = GEMINI_BACKEND.monitoring_collector.get_realtime_metrics();
    let cache_stats = GEMINI_BACKEND.response_cache.get_stats();
    let performance_metrics = GEMINI_BACKEND.performance_monitor.get_all_metrics();
    let health_statuses = GEMINI_BACKEND.health_check_manager.get_all_statuses();
    
    Ok(serde_json::json!({
        "realtime_metrics": realtime_metrics,
        "cache_stats": cache_stats,
        "performance_metrics": performance_metrics,
        "health_statuses": health_statuses,
        "config": GEMINI_BACKEND.get_config().await,
    }))
}