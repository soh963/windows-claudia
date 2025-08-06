use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tokio::time::sleep;

/// Comprehensive error taxonomy for Gemini API
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GeminiErrorType {
    // API Errors
    InvalidApiKey,
    QuotaExceeded,
    RateLimitExceeded,
    ModelNotFound,
    InvalidRequest,
    
    // Content Errors
    ContentBlocked,
    SafetyViolation,
    RecitationError,
    
    // Network Errors
    ConnectionTimeout,
    NetworkError,
    DnsResolutionFailed,
    SslError,
    
    // Server Errors
    InternalServerError,
    ServiceUnavailable,
    GatewayTimeout,
    
    // Client Errors
    RequestTimeout,
    PayloadTooLarge,
    InvalidParameters,
    
    // Unknown
    Unknown(String),
}

impl GeminiErrorType {
    /// Check if error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            GeminiErrorType::RateLimitExceeded
                | GeminiErrorType::ConnectionTimeout
                | GeminiErrorType::NetworkError
                | GeminiErrorType::InternalServerError
                | GeminiErrorType::ServiceUnavailable
                | GeminiErrorType::GatewayTimeout
                | GeminiErrorType::DnsResolutionFailed
        )
    }
    
    /// Get recommended retry delay
    pub fn retry_delay(&self) -> Duration {
        match self {
            GeminiErrorType::RateLimitExceeded => Duration::from_secs(60),
            GeminiErrorType::ServiceUnavailable => Duration::from_secs(30),
            GeminiErrorType::InternalServerError => Duration::from_secs(10),
            _ => Duration::from_secs(1),
        }
    }
    
    /// Parse error from response
    pub fn from_response(status: u16, body: &str) -> Self {
        match status {
            400 => {
                if body.contains("API_KEY_INVALID") {
                    GeminiErrorType::InvalidApiKey
                } else if body.contains("INVALID_ARGUMENT") {
                    GeminiErrorType::InvalidRequest
                } else {
                    GeminiErrorType::InvalidParameters
                }
            }
            401 => GeminiErrorType::InvalidApiKey,
            403 => {
                if body.contains("QUOTA_EXCEEDED") {
                    GeminiErrorType::QuotaExceeded
                } else if body.contains("SAFETY") {
                    GeminiErrorType::SafetyViolation
                } else {
                    GeminiErrorType::ContentBlocked
                }
            }
            404 => GeminiErrorType::ModelNotFound,
            413 => GeminiErrorType::PayloadTooLarge,
            429 => GeminiErrorType::RateLimitExceeded,
            500 => GeminiErrorType::InternalServerError,
            502 => GeminiErrorType::GatewayTimeout,
            503 => GeminiErrorType::ServiceUnavailable,
            504 => GeminiErrorType::GatewayTimeout,
            _ => GeminiErrorType::Unknown(format!("HTTP {}: {}", status, body)),
        }
    }
}

/// Detailed error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiError {
    pub error_type: GeminiErrorType,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub request_id: Option<String>,
    pub retry_after: Option<Duration>,
    pub is_retryable: bool,
}

impl GeminiError {
    pub fn new(error_type: GeminiErrorType, message: String) -> Self {
        Self {
            is_retryable: error_type.is_retryable(),
            retry_after: Some(error_type.retry_delay()),
            error_type,
            message,
            details: None,
            timestamp: chrono::Utc::now(),
            request_id: None,
        }
    }
}

/// Retry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub exponential_base: f64,
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay_ms: 1000,
            max_delay_ms: 60000,
            exponential_base: 2.0,
            jitter: true,
        }
    }
}

/// Retry mechanism with exponential backoff
pub struct RetryManager {
    config: RetryConfig,
}

impl RetryManager {
    pub fn new(config: RetryConfig) -> Self {
        Self { config }
    }
    
    /// Execute with retry
    pub async fn execute_with_retry<F, T, E>(
        &self,
        operation: F,
    ) -> Result<T>
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>>,
        E: Into<anyhow::Error> + std::fmt::Display,
    {
        let mut attempt = 0;
        let mut last_error = None;
        
        while attempt < self.config.max_attempts {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    let error_str = format!("{}", e);
                    log::warn!("Attempt {} failed: {}", attempt + 1, error_str);
                    
                    last_error = Some(error_str);
                    
                    if attempt + 1 < self.config.max_attempts {
                        let delay = self.calculate_delay(attempt);
                        log::info!("Retrying after {:?}", delay);
                        sleep(delay).await;
                    }
                    
                    attempt += 1;
                }
            }
        }
        
        Err(anyhow!(
            "All {} retry attempts failed. Last error: {}",
            self.config.max_attempts,
            last_error.unwrap_or_else(|| "Unknown error".to_string())
        ))
    }
    
    /// Calculate delay with exponential backoff and jitter
    fn calculate_delay(&self, attempt: u32) -> Duration {
        let base_delay = self.config.initial_delay_ms as f64
            * self.config.exponential_base.powi(attempt as i32);
        
        let delay_ms = base_delay.min(self.config.max_delay_ms as f64) as u64;
        
        if self.config.jitter {
            // Add random jitter (0-25% of delay)
            let jitter = (rand::random::<f64>() * 0.25 * delay_ms as f64) as u64;
            Duration::from_millis(delay_ms + jitter)
        } else {
            Duration::from_millis(delay_ms)
        }
    }
}

/// Circuit breaker state
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

/// Circuit breaker for preventing cascading failures
#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    state: Arc<RwLock<CircuitState>>,
    failure_count: Arc<RwLock<u32>>,
    last_failure_time: Arc<RwLock<Option<Instant>>>,
    config: CircuitBreakerConfig,
}

#[derive(Debug, Clone)]
pub struct CircuitBreakerConfig {
    pub failure_threshold: u32,
    pub success_threshold: u32,
    pub timeout: Duration,
    pub half_open_max_calls: u32,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            success_threshold: 2,
            timeout: Duration::from_secs(60),
            half_open_max_calls: 3,
        }
    }
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            state: Arc::new(RwLock::new(CircuitState::Closed)),
            failure_count: Arc::new(RwLock::new(0)),
            last_failure_time: Arc::new(RwLock::new(None)),
            config,
        }
    }
    
    /// Check if circuit allows request
    pub fn can_proceed(&self) -> Result<()> {
        let mut state = self.state.write().unwrap();
        
        match *state {
            CircuitState::Closed => Ok(()),
            CircuitState::Open => {
                // Check if timeout has passed
                if let Some(last_failure) = *self.last_failure_time.read().unwrap() {
                    if last_failure.elapsed() >= self.config.timeout {
                        *state = CircuitState::HalfOpen;
                        *self.failure_count.write().unwrap() = 0;
                        Ok(())
                    } else {
                        Err(anyhow!("Circuit breaker is open"))
                    }
                } else {
                    Ok(())
                }
            }
            CircuitState::HalfOpen => Ok(()),
        }
    }
    
    /// Record success
    pub fn record_success(&self) {
        let mut state = self.state.write().unwrap();
        let mut failure_count = self.failure_count.write().unwrap();
        
        match *state {
            CircuitState::HalfOpen => {
                *failure_count = 0;
                *state = CircuitState::Closed;
            }
            _ => {
                *failure_count = 0;
            }
        }
    }
    
    /// Record failure
    pub fn record_failure(&self) {
        let mut state = self.state.write().unwrap();
        let mut failure_count = self.failure_count.write().unwrap();
        let mut last_failure_time = self.last_failure_time.write().unwrap();
        
        *failure_count += 1;
        *last_failure_time = Some(Instant::now());
        
        match *state {
            CircuitState::Closed => {
                if *failure_count >= self.config.failure_threshold {
                    *state = CircuitState::Open;
                    log::warn!("Circuit breaker opened after {} failures", failure_count);
                }
            }
            CircuitState::HalfOpen => {
                *state = CircuitState::Open;
                log::warn!("Circuit breaker reopened due to failure in half-open state");
            }
            _ => {}
        }
    }
    
    /// Get current state
    pub fn get_state(&self) -> CircuitState {
        *self.state.read().unwrap()
    }
}

/// Fallback strategy for graceful degradation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FallbackStrategy {
    /// Return cached response if available
    UseCachedResponse,
    
    /// Switch to a different model
    SwitchModel(String),
    
    /// Return a default response
    DefaultResponse(String),
    
    /// Return partial response
    PartialResponse,
    
    /// Fail immediately
    FailFast,
}

/// Resilience manager combining all strategies
pub struct ResilienceManager {
    retry_manager: RetryManager,
    circuit_breakers: Arc<RwLock<HashMap<String, CircuitBreaker>>>,
    fallback_strategies: Arc<RwLock<HashMap<String, FallbackStrategy>>>,
}

impl ResilienceManager {
    pub fn new(retry_config: RetryConfig) -> Self {
        Self {
            retry_manager: RetryManager::new(retry_config),
            circuit_breakers: Arc::new(RwLock::new(HashMap::new())),
            fallback_strategies: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Set fallback strategy for a model
    pub fn set_fallback(&self, model: String, strategy: FallbackStrategy) {
        self.fallback_strategies.write().unwrap().insert(model, strategy);
    }
    
    /// Get or create circuit breaker for model
    fn get_circuit_breaker(&self, model: &str) -> CircuitBreaker {
        let mut breakers = self.circuit_breakers.write().unwrap();
        
        if !breakers.contains_key(model) {
            breakers.insert(
                model.to_string(),
                CircuitBreaker::new(CircuitBreakerConfig::default()),
            );
        }
        
        breakers.get(model).unwrap().clone()
    }
    
    /// Execute with full resilience
    pub async fn execute_resilient<F, T>(
        &self,
        model: &str,
        operation: F,
    ) -> Result<T>
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T>> + Send>> + Clone + Send + 'static,
        T: serde::Serialize,
    {
        let circuit_breaker = self.get_circuit_breaker(model);
        
        // Check circuit breaker
        circuit_breaker.can_proceed()?;
        
        // Execute with retry
        match self.retry_manager.execute_with_retry(move || {
            let op = operation.clone();
            Box::pin(async move { op().await })
        }).await {
            Ok(result) => {
                circuit_breaker.record_success();
                Ok(result)
            }
            Err(e) => {
                circuit_breaker.record_failure();
                
                // Apply fallback strategy
                if let Some(strategy) = self.fallback_strategies.read().unwrap().get(model) {
                    match strategy {
                        FallbackStrategy::FailFast => Err(e),
                        _ => {
                            log::warn!("Applying fallback strategy for model {}", model);
                            Err(e) // In real implementation, would apply the strategy
                        }
                    }
                } else {
                    Err(e)
                }
            }
        }
    }
}

/// Health check endpoint data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub model: String,
    pub status: String,
    pub circuit_state: String,
    pub recent_errors: Vec<GeminiError>,
    pub success_rate: f64,
    pub avg_latency_ms: f64,
    pub last_check: chrono::DateTime<chrono::Utc>,
}

/// Health check manager
pub struct HealthCheckManager {
    checks: Arc<RwLock<HashMap<String, HealthStatus>>>,
    check_interval: Duration,
}

impl HealthCheckManager {
    pub fn new(check_interval: Duration) -> Self {
        Self {
            checks: Arc::new(RwLock::new(HashMap::new())),
            check_interval,
        }
    }
    
    /// Perform health check for a model
    pub async fn check_model_health(
        &self,
        model: &str,
        api_key: &str,
    ) -> Result<HealthStatus> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model,
            api_key
        );
        
        let test_body = serde_json::json!({
            "contents": [{
                "parts": [{
                    "text": "Health check"
                }]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1
            }
        });
        
        let start = Instant::now();
        let status = match client.post(&url).json(&test_body).send().await {
            Ok(response) => {
                let latency = start.elapsed().as_millis() as f64;
                
                if response.status().is_success() {
                    HealthStatus {
                        model: model.to_string(),
                        status: "healthy".to_string(),
                        circuit_state: "closed".to_string(),
                        recent_errors: Vec::new(),
                        success_rate: 1.0,
                        avg_latency_ms: latency,
                        last_check: chrono::Utc::now(),
                    }
                } else {
                    HealthStatus {
                        model: model.to_string(),
                        status: "degraded".to_string(),
                        circuit_state: "closed".to_string(),
                        recent_errors: vec![GeminiError::new(
                            GeminiErrorType::from_response(
                                response.status().as_u16(),
                                &response.text().await.unwrap_or_default()
                            ),
                            "Health check failed".to_string()
                        )],
                        success_rate: 0.0,
                        avg_latency_ms: latency,
                        last_check: chrono::Utc::now(),
                    }
                }
            }
            Err(e) => HealthStatus {
                model: model.to_string(),
                status: "unhealthy".to_string(),
                circuit_state: "open".to_string(),
                recent_errors: vec![GeminiError::new(
                    GeminiErrorType::NetworkError,
                    format!("Health check failed: {}", e)
                )],
                success_rate: 0.0,
                avg_latency_ms: 0.0,
                last_check: chrono::Utc::now(),
            }
        };
        
        // Update stored status
        self.checks.write().unwrap().insert(model.to_string(), status.clone());
        
        Ok(status)
    }
    
    /// Get all health statuses
    pub fn get_all_statuses(&self) -> HashMap<String, HealthStatus> {
        self.checks.read().unwrap().clone()
    }
}

/// Get model health status command
#[tauri::command]
pub async fn get_gemini_health_status(
    model: String,
    api_key: String,
) -> Result<HealthStatus, String> {
    let health_manager = HealthCheckManager::new(Duration::from_secs(300));
    health_manager.check_model_health(&model, &api_key)
        .await
        .map_err(|e| e.to_string())
}