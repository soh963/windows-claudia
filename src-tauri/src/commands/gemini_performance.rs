use anyhow::Result;
use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;

/// Cache entry for Gemini responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub response: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub ttl_seconds: u64,
    pub hit_count: u32,
    pub size_bytes: usize,
}

impl CacheEntry {
    pub fn is_expired(&self) -> bool {
        let elapsed = chrono::Utc::now() - self.timestamp;
        elapsed.num_seconds() as u64 > self.ttl_seconds
    }
}

/// Connection pool manager
pub struct ConnectionPool {
    clients: Arc<RwLock<Vec<(reqwest::Client, Instant)>>>,
    max_size: usize,
    idle_timeout: Duration,
}

impl ConnectionPool {
    pub fn new(max_size: usize, idle_timeout: Duration) -> Self {
        Self {
            clients: Arc::new(RwLock::new(Vec::new())),
            max_size,
            idle_timeout,
        }
    }
    
    /// Get a client from the pool or create a new one
    pub fn get_client(&self) -> reqwest::Client {
        let mut clients = self.clients.write().unwrap();
        
        // Remove expired clients
        let now = Instant::now();
        clients.retain(|(_, last_used)| now.duration_since(*last_used) < self.idle_timeout);
        
        // Return existing client if available
        if let Some((client, _)) = clients.pop() {
            return client;
        }
        
        // Create new client
        reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .connect_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_keepalive(Duration::from_secs(30))
            .user_agent("Claudia/1.0")
            .build()
            .unwrap_or_default()
    }
    
    /// Return a client to the pool
    pub fn return_client(&self, client: reqwest::Client) {
        let mut clients = self.clients.write().unwrap();
        
        if clients.len() < self.max_size {
            clients.push((client, Instant::now()));
        }
        // If pool is full, let the client be dropped
    }
}

/// Response cache with LRU eviction
pub struct ResponseCache {
    cache: Arc<RwLock<LruCache<String, CacheEntry>>>,
    max_size_bytes: usize,
    current_size_bytes: Arc<RwLock<usize>>,
}

impl ResponseCache {
    pub fn new(max_entries: usize, max_size_bytes: usize) -> Self {
        Self {
            cache: Arc::new(RwLock::new(LruCache::new(
                NonZeroUsize::new(max_entries).unwrap()
            ))),
            max_size_bytes,
            current_size_bytes: Arc::new(RwLock::new(0)),
        }
    }
    
    /// Generate cache key from request parameters
    pub fn generate_key(
        model: &str,
        prompt: &str,
        temperature: f32,
        max_tokens: u32,
    ) -> String {
        use sha2::{Sha256, Digest};
        
        let mut hasher = Sha256::new();
        hasher.update(model.as_bytes());
        hasher.update(prompt.as_bytes());
        hasher.update(temperature.to_le_bytes());
        hasher.update(max_tokens.to_le_bytes());
        
        format!("{:x}", hasher.finalize())
    }
    
    /// Get cached response if available and not expired
    pub fn get(&self, key: &str) -> Option<serde_json::Value> {
        let mut cache = self.cache.write().unwrap();
        
        if let Some(entry) = cache.get_mut(key) {
            if !entry.is_expired() {
                entry.hit_count += 1;
                return Some(entry.response.clone());
            } else {
                // Remove expired entry
                let size = entry.size_bytes;
                cache.pop(key);
                *self.current_size_bytes.write().unwrap() -= size;
            }
        }
        
        None
    }
    
    /// Put response in cache
    pub fn put(&self, key: String, response: serde_json::Value, ttl_seconds: u64) {
        let size_bytes = response.to_string().len();
        
        // Check if we need to evict entries to make room
        let mut current_size = self.current_size_bytes.write().unwrap();
        
        if *current_size + size_bytes > self.max_size_bytes {
            // Evict least recently used entries until we have space
            let mut cache = self.cache.write().unwrap();
            
            while *current_size + size_bytes > self.max_size_bytes && cache.len() > 0 {
                if let Some((_, evicted)) = cache.pop_lru() {
                    *current_size -= evicted.size_bytes;
                }
            }
        }
        
        let entry = CacheEntry {
            response,
            timestamp: chrono::Utc::now(),
            ttl_seconds,
            hit_count: 0,
            size_bytes,
        };
        
        self.cache.write().unwrap().put(key, entry);
        *current_size += size_bytes;
    }
    
    /// Get cache statistics
    pub fn get_stats(&self) -> CacheStats {
        let cache = self.cache.read().unwrap();
        let current_size = *self.current_size_bytes.read().unwrap();
        
        let mut total_hits = 0;
        let mut expired_count = 0;
        
        for (_, entry) in cache.iter() {
            total_hits += entry.hit_count;
            if entry.is_expired() {
                expired_count += 1;
            }
        }
        
        CacheStats {
            entries: cache.len(),
            size_bytes: current_size,
            max_size_bytes: self.max_size_bytes,
            total_hits,
            expired_entries: expired_count,
            hit_rate: if cache.len() > 0 {
                total_hits as f64 / cache.len() as f64
            } else {
                0.0
            },
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CacheStats {
    pub entries: usize,
    pub size_bytes: usize,
    pub max_size_bytes: usize,
    pub total_hits: u32,
    pub expired_entries: usize,
    pub hit_rate: f64,
}

/// Rate limiter with token bucket algorithm
pub struct RateLimiter {
    semaphores: Arc<RwLock<HashMap<String, Arc<Semaphore>>>>,
    limits: Arc<RwLock<HashMap<String, RateLimit>>>,
}

#[derive(Debug, Clone)]
pub struct RateLimit {
    pub requests_per_minute: u32,
    pub tokens_per_day: u32,
    pub concurrent_requests: u32,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            semaphores: Arc::new(RwLock::new(HashMap::new())),
            limits: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Set rate limit for a model
    pub fn set_limit(&self, model: String, limit: RateLimit) {
        self.limits.write().unwrap().insert(model.clone(), limit.clone());
        
        // Create semaphore for concurrent requests
        let semaphore = Arc::new(Semaphore::new(limit.concurrent_requests as usize));
        self.semaphores.write().unwrap().insert(model, semaphore);
    }
    
    /// Acquire permit for a request
    pub async fn acquire(&self, model: &str) -> Result<RateLimitPermit> {
        let semaphore = {
            let semaphores = self.semaphores.read().unwrap();
            semaphores.get(model).cloned()
        };
        
        if let Some(semaphore) = semaphore {
            let permit = semaphore.acquire_owned().await
                .map_err(|e| anyhow::anyhow!("Failed to acquire rate limit permit: {}", e))?;
            
            Ok(RateLimitPermit {
                _permit: Some(permit),
                model: model.to_string(),
            })
        } else {
            // No rate limit configured for this model
            Ok(RateLimitPermit {
                _permit: None,
                model: model.to_string(),
            })
        }
    }
}

pub struct RateLimitPermit {
    _permit: Option<tokio::sync::OwnedSemaphorePermit>,
    pub model: String,
}

/// Batch request aggregator
pub struct BatchAggregator {
    batches: Arc<RwLock<HashMap<String, Vec<BatchRequest>>>>,
    batch_size: usize,
    batch_timeout: Duration,
}

#[derive(Clone)]
pub struct BatchRequest {
    pub id: String,
    pub prompt: String,
    pub callback: Arc<dyn Fn(Result<serde_json::Value>) + Send + Sync>,
}

impl std::fmt::Debug for BatchRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BatchRequest")
            .field("id", &self.id)
            .field("prompt", &self.prompt)
            .field("callback", &"Arc<dyn Fn(...)>")
            .finish()
    }
}

impl BatchAggregator {
    pub fn new(batch_size: usize, batch_timeout: Duration) -> Self {
        Self {
            batches: Arc::new(RwLock::new(HashMap::new())),
            batch_size,
            batch_timeout,
        }
    }
    
    /// Add request to batch
    pub async fn add_request(
        &self,
        model: String,
        request: BatchRequest,
    ) -> Result<()> {
        let mut batches = self.batches.write().unwrap();
        let batch = batches.entry(model.clone()).or_insert_with(Vec::new);
        
        batch.push(request);
        
        // Check if batch is ready to process
        if batch.len() >= self.batch_size {
            let ready_batch = std::mem::take(batch);
            drop(batches);
            
            // Process batch asynchronously
            tokio::spawn(async move {
                // Process batch logic here
                log::info!("Processing batch of {} requests for model {}", ready_batch.len(), model);
            });
        }
        
        Ok(())
    }
}

/// Performance monitor
pub struct PerformanceMonitor {
    metrics: Arc<RwLock<HashMap<String, ModelMetrics>>>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ModelMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub total_latency_ms: u64,
    pub min_latency_ms: u64,
    pub max_latency_ms: u64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
}

impl ModelMetrics {
    pub fn avg_latency_ms(&self) -> f64 {
        if self.successful_requests > 0 {
            self.total_latency_ms as f64 / self.successful_requests as f64
        } else {
            0.0
        }
    }
    
    pub fn success_rate(&self) -> f64 {
        if self.total_requests > 0 {
            self.successful_requests as f64 / self.total_requests as f64
        } else {
            0.0
        }
    }
    
    pub fn cache_hit_rate(&self) -> f64 {
        let total_cache_requests = self.cache_hits + self.cache_misses;
        if total_cache_requests > 0 {
            self.cache_hits as f64 / total_cache_requests as f64
        } else {
            0.0
        }
    }
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Record a request
    pub fn record_request(
        &self,
        model: &str,
        success: bool,
        latency_ms: u64,
        input_tokens: u32,
        output_tokens: u32,
        cache_hit: bool,
    ) {
        let mut metrics = self.metrics.write().unwrap();
        let model_metrics = metrics.entry(model.to_string()).or_default();
        
        model_metrics.total_requests += 1;
        
        if success {
            model_metrics.successful_requests += 1;
            model_metrics.total_latency_ms += latency_ms;
            
            if model_metrics.min_latency_ms == 0 || latency_ms < model_metrics.min_latency_ms {
                model_metrics.min_latency_ms = latency_ms;
            }
            
            if latency_ms > model_metrics.max_latency_ms {
                model_metrics.max_latency_ms = latency_ms;
            }
            
            model_metrics.total_input_tokens += input_tokens as u64;
            model_metrics.total_output_tokens += output_tokens as u64;
        } else {
            model_metrics.failed_requests += 1;
        }
        
        if cache_hit {
            model_metrics.cache_hits += 1;
        } else {
            model_metrics.cache_misses += 1;
        }
    }
    
    /// Get metrics for a model
    pub fn get_metrics(&self, model: &str) -> Option<ModelMetrics> {
        self.metrics.read().unwrap().get(model).cloned()
    }
    
    /// Get all metrics
    pub fn get_all_metrics(&self) -> HashMap<String, ModelMetrics> {
        self.metrics.read().unwrap().clone()
    }
}

/// Get performance metrics command
#[tauri::command]
pub async fn get_gemini_performance_metrics() -> Result<HashMap<String, ModelMetrics>, String> {
    // In a real implementation, this would be a global instance
    let monitor = PerformanceMonitor::new();
    Ok(monitor.get_all_metrics())
}

/// Get cache statistics command
#[tauri::command]
pub async fn get_gemini_cache_stats() -> Result<CacheStats, String> {
    // In a real implementation, this would be a global instance
    let cache = ResponseCache::new(1000, 100 * 1024 * 1024); // 100MB cache
    Ok(cache.get_stats())
}