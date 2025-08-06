use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::RwLock;
use prometheus::{Encoder, TextEncoder, Counter, Gauge, Histogram, HistogramOpts};
use tracing::{info, warn, error};

/// Comprehensive metrics collector
pub struct MetricsCollector {
    // Counters
    request_total: Counter,
    request_success: Counter,
    request_failure: Counter,
    cache_hits: Counter,
    cache_misses: Counter,
    
    // Gauges
    active_requests: Gauge,
    queue_depth: Gauge,
    circuit_breaker_open: Gauge,
    
    // Histograms
    request_duration: Histogram,
    token_usage: Histogram,
    response_size: Histogram,
    
    // Custom metrics
    model_metrics: Arc<RwLock<HashMap<String, ModelMetrics>>>,
    error_metrics: Arc<RwLock<HashMap<String, ErrorMetrics>>>,
}

#[derive(Debug, Clone)]
pub struct ModelMetrics {
    request_count: u64,
    success_count: u64,
    total_tokens: u64,
    total_cost: f64,
    avg_latency: f64,
}

#[derive(Debug, Clone)]
pub struct ErrorMetrics {
    count: u64,
    last_occurred: DateTime<Utc>,
    error_types: HashMap<String, u64>,
}

impl MetricsCollector {
    pub fn new() -> Result<Self> {
        let request_total = Counter::new("gemini_requests_total", "Total number of Gemini requests")?;
        let request_success = Counter::new("gemini_requests_success", "Successful Gemini requests")?;
        let request_failure = Counter::new("gemini_requests_failure", "Failed Gemini requests")?;
        let cache_hits = Counter::new("gemini_cache_hits", "Cache hit count")?;
        let cache_misses = Counter::new("gemini_cache_misses", "Cache miss count")?;
        
        let active_requests = Gauge::new("gemini_active_requests", "Currently active requests")?;
        let queue_depth = Gauge::new("gemini_queue_depth", "Request queue depth")?;
        let circuit_breaker_open = Gauge::new("gemini_circuit_breaker_open", "Circuit breaker state")?;
        
        let request_duration = Histogram::with_opts(
            HistogramOpts::new("gemini_request_duration_seconds", "Request duration in seconds")
                .buckets(vec![0.1, 0.5, 1.0, 2.5, 5.0, 10.0])
        )?;
        
        let token_usage = Histogram::with_opts(
            HistogramOpts::new("gemini_token_usage", "Token usage per request")
                .buckets(vec![100.0, 500.0, 1000.0, 5000.0, 10000.0])
        )?;
        
        let response_size = Histogram::with_opts(
            HistogramOpts::new("gemini_response_size_bytes", "Response size in bytes")
                .buckets(vec![1000.0, 10000.0, 100000.0, 1000000.0])
        )?;
        
        // Register metrics
        prometheus::register(Box::new(request_total.clone()))?;
        prometheus::register(Box::new(request_success.clone()))?;
        prometheus::register(Box::new(request_failure.clone()))?;
        prometheus::register(Box::new(cache_hits.clone()))?;
        prometheus::register(Box::new(cache_misses.clone()))?;
        prometheus::register(Box::new(active_requests.clone()))?;
        prometheus::register(Box::new(queue_depth.clone()))?;
        prometheus::register(Box::new(circuit_breaker_open.clone()))?;
        prometheus::register(Box::new(request_duration.clone()))?;
        prometheus::register(Box::new(token_usage.clone()))?;
        prometheus::register(Box::new(response_size.clone()))?;
        
        Ok(Self {
            request_total,
            request_success,
            request_failure,
            cache_hits,
            cache_misses,
            active_requests,
            queue_depth,
            circuit_breaker_open,
            request_duration,
            token_usage,
            response_size,
            model_metrics: Arc::new(RwLock::new(HashMap::new())),
            error_metrics: Arc::new(RwLock::new(HashMap::new())),
        })
    }
    
    /// Record request start
    pub fn record_request_start(&self) {
        self.request_total.inc();
        self.active_requests.inc();
    }
    
    /// Record request completion
    pub fn record_request_complete(
        &self,
        success: bool,
        duration_ms: u64,
        tokens: u32,
        response_bytes: usize,
    ) {
        self.active_requests.dec();
        
        if success {
            self.request_success.inc();
        } else {
            self.request_failure.inc();
        }
        
        self.request_duration.observe(duration_ms as f64 / 1000.0);
        self.token_usage.observe(tokens as f64);
        self.response_size.observe(response_bytes as f64);
    }
    
    /// Record cache access
    pub fn record_cache_access(&self, hit: bool) {
        if hit {
            self.cache_hits.inc();
        } else {
            self.cache_misses.inc();
        }
    }
    
    /// Update queue depth
    pub fn update_queue_depth(&self, depth: usize) {
        self.queue_depth.set(depth as f64);
    }
    
    /// Update circuit breaker state
    pub fn update_circuit_breaker(&self, open: bool) {
        self.circuit_breaker_open.set(if open { 1.0 } else { 0.0 });
    }
    
    /// Record model-specific metrics
    pub async fn record_model_metrics(
        &self,
        model: &str,
        success: bool,
        tokens: u32,
        cost: f64,
        latency_ms: u64,
    ) {
        let mut metrics = self.model_metrics.write().await;
        let model_metric = metrics.entry(model.to_string()).or_insert(ModelMetrics {
            request_count: 0,
            success_count: 0,
            total_tokens: 0,
            total_cost: 0.0,
            avg_latency: 0.0,
        });
        
        model_metric.request_count += 1;
        if success {
            model_metric.success_count += 1;
        }
        model_metric.total_tokens += tokens as u64;
        model_metric.total_cost += cost;
        
        // Update rolling average latency
        let n = model_metric.request_count as f64;
        model_metric.avg_latency = ((n - 1.0) * model_metric.avg_latency + latency_ms as f64) / n;
    }
    
    /// Record error metrics
    pub async fn record_error(&self, model: &str, error_type: &str) {
        let mut metrics = self.error_metrics.write().await;
        let error_metric = metrics.entry(model.to_string()).or_insert(ErrorMetrics {
            count: 0,
            last_occurred: Utc::now(),
            error_types: HashMap::new(),
        });
        
        error_metric.count += 1;
        error_metric.last_occurred = Utc::now();
        *error_metric.error_types.entry(error_type.to_string()).or_insert(0) += 1;
    }
    
    /// Export metrics in Prometheus format
    pub fn export_metrics(&self) -> Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = prometheus::gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }
    
    /// Get model-specific metrics
    pub async fn get_model_metrics(&self) -> HashMap<String, ModelMetrics> {
        self.model_metrics.read().await.clone()
    }
    
    /// Get error metrics
    pub async fn get_error_metrics(&self) -> HashMap<String, ErrorMetrics> {
        self.error_metrics.read().await.clone()
    }
}

/// Distributed tracing support
pub struct TracingManager {
    spans: Arc<RwLock<HashMap<String, SpanInfo>>>,
    max_spans: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpanInfo {
    pub trace_id: String,
    pub span_id: String,
    pub parent_span_id: Option<String>,
    pub operation: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_ms: Option<u64>,
    pub tags: HashMap<String, String>,
    pub status: SpanStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SpanStatus {
    InProgress,
    Success,
    Error(String),
}

impl TracingManager {
    pub fn new(max_spans: usize) -> Self {
        Self {
            spans: Arc::new(RwLock::new(HashMap::new())),
            max_spans,
        }
    }
    
    /// Start a new span
    pub async fn start_span(
        &self,
        operation: &str,
        parent_span_id: Option<String>,
        tags: HashMap<String, String>,
    ) -> String {
        let trace_id = uuid::Uuid::new_v4().to_string();
        let span_id = uuid::Uuid::new_v4().to_string();
        
        let span_info = SpanInfo {
            trace_id: trace_id.clone(),
            span_id: span_id.clone(),
            parent_span_id,
            operation: operation.to_string(),
            start_time: Utc::now(),
            end_time: None,
            duration_ms: None,
            tags,
            status: SpanStatus::InProgress,
        };
        
        let mut spans = self.spans.write().await;
        
        // Evict old spans if needed
        if spans.len() >= self.max_spans {
            // Remove oldest completed spans
            let mut completed_spans: Vec<_> = spans.iter()
                .filter(|(_, s)| s.end_time.is_some())
                .map(|(k, s)| (k.clone(), s.end_time.unwrap()))
                .collect();
            completed_spans.sort_by_key(|(_, time)| *time);
            
            if let Some((oldest_key, _)) = completed_spans.first() {
                spans.remove(oldest_key);
            }
        }
        
        spans.insert(span_id.clone(), span_info);
        
        // Log span start
        info!(
            trace_id = %trace_id,
            span_id = %span_id,
            operation = %operation,
            "Span started"
        );
        
        span_id
    }
    
    /// End a span
    pub async fn end_span(&self, span_id: &str, status: SpanStatus) {
        let mut spans = self.spans.write().await;
        
        if let Some(span) = spans.get_mut(span_id) {
            let end_time = Utc::now();
            let duration = (end_time - span.start_time).num_milliseconds() as u64;
            
            span.end_time = Some(end_time);
            span.duration_ms = Some(duration);
            span.status = status.clone();
            
            // Log span completion
            match &status {
                SpanStatus::Success => {
                    info!(
                        trace_id = %span.trace_id,
                        span_id = %span_id,
                        operation = %span.operation,
                        duration_ms = duration,
                        "Span completed successfully"
                    );
                }
                SpanStatus::Error(err) => {
                    error!(
                        trace_id = %span.trace_id,
                        span_id = %span_id,
                        operation = %span.operation,
                        duration_ms = duration,
                        error = %err,
                        "Span completed with error"
                    );
                }
                _ => {}
            }
        }
    }
    
    /// Get span info
    pub async fn get_span(&self, span_id: &str) -> Option<SpanInfo> {
        self.spans.read().await.get(span_id).cloned()
    }
    
    /// Get all spans for a trace
    pub async fn get_trace_spans(&self, trace_id: &str) -> Vec<SpanInfo> {
        self.spans.read().await
            .values()
            .filter(|s| s.trace_id == trace_id)
            .cloned()
            .collect()
    }
    
    /// Export spans for analysis
    pub async fn export_spans(&self) -> Vec<SpanInfo> {
        self.spans.read().await.values().cloned().collect()
    }
}

/// Health check monitor
pub struct HealthMonitor {
    checks: Arc<RwLock<HashMap<String, HealthCheck>>>,
    history: Arc<RwLock<VecDeque<HealthSnapshot>>>,
    max_history: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub name: String,
    pub component: String,
    pub status: HealthStatus,
    pub last_check: DateTime<Utc>,
    pub message: Option<String>,
    pub metrics: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthSnapshot {
    pub timestamp: DateTime<Utc>,
    pub overall_status: HealthStatus,
    pub checks: HashMap<String, HealthCheck>,
}

impl HealthMonitor {
    pub fn new(max_history: usize) -> Self {
        Self {
            checks: Arc::new(RwLock::new(HashMap::new())),
            history: Arc::new(RwLock::new(VecDeque::with_capacity(max_history))),
            max_history,
        }
    }
    
    /// Register a health check
    pub async fn register_check(&self, name: String, component: String) {
        let check = HealthCheck {
            name: name.clone(),
            component,
            status: HealthStatus::Unknown,
            last_check: Utc::now(),
            message: None,
            metrics: HashMap::new(),
        };
        
        self.checks.write().await.insert(name, check);
    }
    
    /// Update health check status
    pub async fn update_check(
        &self,
        name: &str,
        status: HealthStatus,
        message: Option<String>,
        metrics: HashMap<String, f64>,
    ) {
        let mut checks = self.checks.write().await;
        
        if let Some(check) = checks.get_mut(name) {
            check.status = status;
            check.last_check = Utc::now();
            check.message = message;
            check.metrics = metrics;
        }
    }
    
    /// Run all health checks
    pub async fn run_checks(&self) -> HealthSnapshot {
        let checks = self.checks.read().await.clone();
        
        // Determine overall status
        let overall_status = if checks.values().all(|c| matches!(c.status, HealthStatus::Healthy)) {
            HealthStatus::Healthy
        } else if checks.values().any(|c| matches!(c.status, HealthStatus::Unhealthy)) {
            HealthStatus::Unhealthy
        } else if checks.values().any(|c| matches!(c.status, HealthStatus::Degraded)) {
            HealthStatus::Degraded
        } else {
            HealthStatus::Unknown
        };
        
        let snapshot = HealthSnapshot {
            timestamp: Utc::now(),
            overall_status,
            checks,
        };
        
        // Add to history
        let mut history = self.history.write().await;
        if history.len() >= self.max_history {
            history.pop_front();
        }
        history.push_back(snapshot.clone());
        
        snapshot
    }
    
    /// Get current health status
    pub async fn get_status(&self) -> HealthSnapshot {
        let checks = self.checks.read().await.clone();
        
        let overall_status = if checks.values().all(|c| matches!(c.status, HealthStatus::Healthy)) {
            HealthStatus::Healthy
        } else if checks.values().any(|c| matches!(c.status, HealthStatus::Unhealthy)) {
            HealthStatus::Unhealthy
        } else if checks.values().any(|c| matches!(c.status, HealthStatus::Degraded)) {
            HealthStatus::Degraded
        } else {
            HealthStatus::Unknown
        };
        
        HealthSnapshot {
            timestamp: Utc::now(),
            overall_status,
            checks,
        }
    }
    
    /// Get health history
    pub async fn get_history(&self) -> Vec<HealthSnapshot> {
        self.history.read().await.iter().cloned().collect()
    }
}

/// Audit logger for compliance
pub struct AuditLogger {
    entries: Arc<RwLock<VecDeque<AuditEntry>>>,
    max_entries: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub user: Option<String>,
    pub action: String,
    pub resource: String,
    pub result: AuditResult,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditResult {
    Success,
    Failure(String),
    Denied(String),
}

impl AuditLogger {
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: Arc::new(RwLock::new(VecDeque::with_capacity(max_entries))),
            max_entries,
        }
    }
    
    /// Log an audit entry
    pub async fn log(
        &self,
        user: Option<String>,
        action: &str,
        resource: &str,
        result: AuditResult,
        metadata: HashMap<String, serde_json::Value>,
    ) {
        let entry = AuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            user,
            action: action.to_string(),
            resource: resource.to_string(),
            result: result.clone(),
            metadata,
        };
        
        // Log to system logger
        match &result {
            AuditResult::Success => {
                info!(
                    audit_id = %entry.id,
                    user = ?entry.user,
                    action = %action,
                    resource = %resource,
                    "Audit: Action succeeded"
                );
            }
            AuditResult::Failure(err) => {
                warn!(
                    audit_id = %entry.id,
                    user = ?entry.user,
                    action = %action,
                    resource = %resource,
                    error = %err,
                    "Audit: Action failed"
                );
            }
            AuditResult::Denied(reason) => {
                warn!(
                    audit_id = %entry.id,
                    user = ?entry.user,
                    action = %action,
                    resource = %resource,
                    reason = %reason,
                    "Audit: Action denied"
                );
            }
        }
        
        // Store in memory
        let mut entries = self.entries.write().await;
        if entries.len() >= self.max_entries {
            entries.pop_front();
        }
        entries.push_back(entry);
    }
    
    /// Query audit logs
    pub async fn query(
        &self,
        filter: AuditFilter,
    ) -> Vec<AuditEntry> {
        let entries = self.entries.read().await;
        
        entries.iter()
            .filter(|e| {
                if let Some(user) = &filter.user {
                    if e.user.as_ref() != Some(user) {
                        return false;
                    }
                }
                
                if let Some(action) = &filter.action {
                    if !e.action.contains(action) {
                        return false;
                    }
                }
                
                if let Some(after) = &filter.after {
                    if e.timestamp < *after {
                        return false;
                    }
                }
                
                if let Some(before) = &filter.before {
                    if e.timestamp > *before {
                        return false;
                    }
                }
                
                true
            })
            .cloned()
            .collect()
    }
}

#[derive(Debug, Clone)]
pub struct AuditFilter {
    pub user: Option<String>,
    pub action: Option<String>,
    pub after: Option<DateTime<Utc>>,
    pub before: Option<DateTime<Utc>>,
}

/// Observability commands
#[tauri::command]
pub async fn get_gemini_metrics() -> Result<String, String> {
    let collector = MetricsCollector::new().map_err(|e| e.to_string())?;
    collector.export_metrics().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_gemini_health_dashboard() -> Result<HealthSnapshot, String> {
    let monitor = HealthMonitor::new(100);
    
    // Register default checks
    monitor.register_check("api_connectivity".to_string(), "api".to_string()).await;
    monitor.register_check("cache_health".to_string(), "cache".to_string()).await;
    monitor.register_check("rate_limiter".to_string(), "rate_limit".to_string()).await;
    
    Ok(monitor.get_status().await)
}

#[tauri::command]
pub async fn get_gemini_audit_logs(
    user: Option<String>,
    action: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<AuditEntry>, String> {
    let logger = AuditLogger::new(1000);
    
    let filter = AuditFilter {
        user,
        action,
        after: None,
        before: None,
    };
    
    let mut logs = logger.query(filter).await;
    
    if let Some(limit) = limit {
        logs.truncate(limit);
    }
    
    Ok(logs)
}