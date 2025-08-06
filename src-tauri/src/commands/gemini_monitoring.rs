use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock};
use std::time::Duration;

/// Request/Response metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestMetrics {
    pub request_id: String,
    pub model: String,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: u64,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub total_tokens: u32,
    pub cost_estimate: f64,
    pub status: RequestStatus,
    pub error: Option<String>,
    pub cache_hit: bool,
    pub retry_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RequestStatus {
    Success,
    Failed,
    Timeout,
    RateLimited,
    Blocked,
}

/// Usage tracking data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageMetrics {
    pub model: String,
    pub period: UsagePeriod,
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cost: f64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum UsagePeriod {
    Hourly,
    Daily,
    Weekly,
    Monthly,
}

/// Real-time monitoring data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeMetrics {
    pub timestamp: DateTime<Utc>,
    pub active_requests: u32,
    pub requests_per_second: f64,
    pub tokens_per_second: f64,
    pub error_rate: f64,
    pub avg_latency_ms: f64,
    pub queue_depth: u32,
    pub circuit_breaker_status: HashMap<String, String>,
}

/// Performance analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAnalytics {
    pub model: String,
    pub time_range: TimeRange,
    pub latency_distribution: LatencyDistribution,
    pub error_distribution: HashMap<String, u32>,
    pub throughput_metrics: ThroughputMetrics,
    pub cost_analysis: CostAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyDistribution {
    pub min: u64,
    pub max: u64,
    pub mean: f64,
    pub median: f64,
    pub p50: u64,
    pub p75: u64,
    pub p90: u64,
    pub p95: u64,
    pub p99: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThroughputMetrics {
    pub requests_per_minute: f64,
    pub tokens_per_minute: f64,
    pub peak_rpm: f64,
    pub peak_tpm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostAnalysis {
    pub total_cost: f64,
    pub input_cost: f64,
    pub output_cost: f64,
    pub cached_savings: f64,
    pub cost_per_request: f64,
    pub cost_per_thousand_tokens: f64,
}

/// Monitoring collector
pub struct MonitoringCollector {
    request_history: Arc<RwLock<VecDeque<RequestMetrics>>>,
    usage_metrics: Arc<RwLock<HashMap<(String, UsagePeriod), UsageMetrics>>>,
    realtime_metrics: Arc<RwLock<RealtimeMetrics>>,
    max_history_size: usize,
}

impl MonitoringCollector {
    pub fn new(max_history_size: usize) -> Self {
        Self {
            request_history: Arc::new(RwLock::new(VecDeque::with_capacity(max_history_size))),
            usage_metrics: Arc::new(RwLock::new(HashMap::new())),
            realtime_metrics: Arc::new(RwLock::new(RealtimeMetrics {
                timestamp: Utc::now(),
                active_requests: 0,
                requests_per_second: 0.0,
                tokens_per_second: 0.0,
                error_rate: 0.0,
                avg_latency_ms: 0.0,
                queue_depth: 0,
                circuit_breaker_status: HashMap::new(),
            })),
            max_history_size,
        }
    }
    
    /// Record a request
    pub fn record_request(&self, metrics: RequestMetrics) {
        // Add to history
        {
            let mut history = self.request_history.write().unwrap();
            if history.len() >= self.max_history_size {
                history.pop_front();
            }
            history.push_back(metrics.clone());
        }
        
        // Update usage metrics
        self.update_usage_metrics(&metrics);
        
        // Update realtime metrics
        self.update_realtime_metrics();
    }
    
    /// Update usage metrics
    fn update_usage_metrics(&self, metrics: &RequestMetrics) {
        let mut usage = self.usage_metrics.write().unwrap();
        
        // Update hourly metrics
        let hourly_key = (metrics.model.clone(), UsagePeriod::Hourly);
        let hourly = usage.entry(hourly_key).or_insert_with(|| UsageMetrics {
            model: metrics.model.clone(),
            period: UsagePeriod::Hourly,
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost: 0.0,
            avg_latency_ms: 0.0,
            p95_latency_ms: 0.0,
            p99_latency_ms: 0.0,
        });
        
        hourly.total_requests += 1;
        
        if metrics.status == RequestStatus::Success {
            hourly.successful_requests += 1;
            hourly.total_input_tokens += metrics.input_tokens as u64;
            hourly.total_output_tokens += metrics.output_tokens as u64;
            hourly.total_cost += metrics.cost_estimate;
            
            // Update average latency (simple rolling average)
            let n = hourly.successful_requests as f64;
            hourly.avg_latency_ms = ((n - 1.0) * hourly.avg_latency_ms + metrics.duration_ms as f64) / n;
        } else {
            hourly.failed_requests += 1;
        }
        
        // Similar updates for daily, weekly, monthly...
    }
    
    /// Update realtime metrics
    fn update_realtime_metrics(&self) {
        let history = self.request_history.read().unwrap();
        let mut realtime = self.realtime_metrics.write().unwrap();
        
        realtime.timestamp = Utc::now();
        
        // Calculate metrics from recent history
        let recent_window = Duration::from_secs(60); // 1 minute window
        let cutoff_time = Utc::now() - chrono::Duration::from_std(recent_window).unwrap();
        
        let recent_requests: Vec<&RequestMetrics> = history.iter()
            .filter(|r| r.timestamp > cutoff_time)
            .collect();
        
        if !recent_requests.is_empty() {
            // Requests per second
            realtime.requests_per_second = recent_requests.len() as f64 / recent_window.as_secs() as f64;
            
            // Tokens per second
            let total_tokens: u32 = recent_requests.iter()
                .filter(|r| r.status == RequestStatus::Success)
                .map(|r| r.total_tokens)
                .sum();
            realtime.tokens_per_second = total_tokens as f64 / recent_window.as_secs() as f64;
            
            // Error rate
            let failed_count = recent_requests.iter()
                .filter(|r| r.status != RequestStatus::Success)
                .count();
            realtime.error_rate = failed_count as f64 / recent_requests.len() as f64;
            
            // Average latency
            let successful_requests: Vec<&RequestMetrics> = recent_requests.iter()
                .filter(|r| r.status == RequestStatus::Success)
                .copied()
                .collect();
            
            if !successful_requests.is_empty() {
                let total_latency: u64 = successful_requests.iter()
                    .map(|r| r.duration_ms)
                    .sum();
                realtime.avg_latency_ms = total_latency as f64 / successful_requests.len() as f64;
            }
        }
    }
    
    /// Get request history
    pub fn get_request_history(&self, limit: Option<usize>) -> Vec<RequestMetrics> {
        let history = self.request_history.read().unwrap();
        let limit = limit.unwrap_or(history.len());
        
        history.iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }
    
    /// Get usage metrics
    pub fn get_usage_metrics(
        &self,
        model: &str,
        period: UsagePeriod,
    ) -> Option<UsageMetrics> {
        self.usage_metrics.read().unwrap()
            .get(&(model.to_string(), period))
            .cloned()
    }
    
    /// Get realtime metrics
    pub fn get_realtime_metrics(&self) -> RealtimeMetrics {
        self.realtime_metrics.read().unwrap().clone()
    }
    
    /// Generate performance analytics
    pub fn generate_analytics(
        &self,
        model: &str,
        time_range: TimeRange,
    ) -> PerformanceAnalytics {
        let history = self.request_history.read().unwrap();
        
        // Filter requests by model and time range
        let filtered_requests: Vec<&RequestMetrics> = history.iter()
            .filter(|r| r.model == model && r.timestamp >= time_range.start && r.timestamp <= time_range.end)
            .collect();
        
        // Calculate latency distribution
        let mut latencies: Vec<u64> = filtered_requests.iter()
            .filter(|r| r.status == RequestStatus::Success)
            .map(|r| r.duration_ms)
            .collect();
        
        latencies.sort();
        
        let latency_distribution = if !latencies.is_empty() {
            LatencyDistribution {
                min: *latencies.first().unwrap(),
                max: *latencies.last().unwrap(),
                mean: latencies.iter().sum::<u64>() as f64 / latencies.len() as f64,
                median: latencies[latencies.len() / 2] as f64,
                p50: latencies[latencies.len() / 2],
                p75: latencies[latencies.len() * 3 / 4],
                p90: latencies[latencies.len() * 9 / 10],
                p95: latencies[latencies.len() * 95 / 100],
                p99: latencies[latencies.len() * 99 / 100],
            }
        } else {
            LatencyDistribution {
                min: 0,
                max: 0,
                mean: 0.0,
                median: 0.0,
                p50: 0,
                p75: 0,
                p90: 0,
                p95: 0,
                p99: 0,
            }
        };
        
        // Calculate error distribution
        let mut error_distribution = HashMap::new();
        for request in &filtered_requests {
            if request.status != RequestStatus::Success {
                let error_type = request.error.as_ref()
                    .map(|e| e.clone())
                    .unwrap_or_else(|| format!("{:?}", request.status));
                *error_distribution.entry(error_type).or_insert(0) += 1;
            }
        }
        
        // Calculate throughput metrics
        let duration = (time_range.end - time_range.start).num_minutes() as f64;
        let total_requests = filtered_requests.len() as f64;
        let total_tokens: u32 = filtered_requests.iter()
            .filter(|r| r.status == RequestStatus::Success)
            .map(|r| r.total_tokens)
            .sum();
        
        let throughput_metrics = ThroughputMetrics {
            requests_per_minute: total_requests / duration,
            tokens_per_minute: total_tokens as f64 / duration,
            peak_rpm: 0.0, // Would need more granular data
            peak_tpm: 0.0, // Would need more granular data
        };
        
        // Calculate cost analysis
        let total_cost: f64 = filtered_requests.iter()
            .filter(|r| r.status == RequestStatus::Success)
            .map(|r| r.cost_estimate)
            .sum();
        
        let total_input_tokens: u32 = filtered_requests.iter()
            .filter(|r| r.status == RequestStatus::Success)
            .map(|r| r.input_tokens)
            .sum();
        
        let total_output_tokens: u32 = filtered_requests.iter()
            .filter(|r| r.status == RequestStatus::Success)
            .map(|r| r.output_tokens)
            .sum();
        
        let cached_count = filtered_requests.iter()
            .filter(|r| r.cache_hit)
            .count();
        
        let cost_analysis = CostAnalysis {
            total_cost,
            input_cost: total_cost * (total_input_tokens as f64 / (total_input_tokens + total_output_tokens) as f64),
            output_cost: total_cost * (total_output_tokens as f64 / (total_input_tokens + total_output_tokens) as f64),
            cached_savings: cached_count as f64 * 0.001, // Estimate
            cost_per_request: if total_requests > 0.0 { total_cost / total_requests } else { 0.0 },
            cost_per_thousand_tokens: if total_tokens > 0 { total_cost / (total_tokens as f64 / 1000.0) } else { 0.0 },
        };
        
        PerformanceAnalytics {
            model: model.to_string(),
            time_range,
            latency_distribution,
            error_distribution,
            throughput_metrics,
            cost_analysis,
        }
    }
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub log_requests: bool,
    pub log_responses: bool,
    pub log_errors: bool,
    pub log_performance: bool,
    pub sanitize_sensitive_data: bool,
    pub max_response_length: usize,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            log_requests: true,
            log_responses: false,
            log_errors: true,
            log_performance: true,
            sanitize_sensitive_data: true,
            max_response_length: 1000,
        }
    }
}

/// Structured logger for Gemini operations
pub struct GeminiLogger {
    config: LoggingConfig,
}

impl GeminiLogger {
    pub fn new(config: LoggingConfig) -> Self {
        Self { config }
    }
    
    /// Log request
    pub fn log_request(&self, request_id: &str, model: &str, prompt: &str) {
        if !self.config.log_requests {
            return;
        }
        
        let sanitized_prompt = if self.config.sanitize_sensitive_data {
            self.sanitize_content(prompt)
        } else {
            prompt.to_string()
        };
        
        log::info!(
            "[GEMINI_REQUEST] id={} model={} prompt_length={}",
            request_id,
            model,
            sanitized_prompt.len()
        );
        
        log::debug!(
            "[GEMINI_REQUEST_DETAIL] id={} prompt={}",
            request_id,
            sanitized_prompt
        );
    }
    
    /// Log response
    pub fn log_response(
        &self,
        request_id: &str,
        status: &RequestStatus,
        duration_ms: u64,
        tokens: Option<(u32, u32)>,
    ) {
        if !self.config.log_responses {
            return;
        }
        
        match status {
            RequestStatus::Success => {
                if let Some((input_tokens, output_tokens)) = tokens {
                    log::info!(
                        "[GEMINI_RESPONSE] id={} status=success duration_ms={} input_tokens={} output_tokens={}",
                        request_id,
                        duration_ms,
                        input_tokens,
                        output_tokens
                    );
                } else {
                    log::info!(
                        "[GEMINI_RESPONSE] id={} status=success duration_ms={}",
                        request_id,
                        duration_ms
                    );
                }
            }
            _ => {
                log::warn!(
                    "[GEMINI_RESPONSE] id={} status={:?} duration_ms={}",
                    request_id,
                    status,
                    duration_ms
                );
            }
        }
    }
    
    /// Log error
    pub fn log_error(&self, request_id: &str, error: &str) {
        if !self.config.log_errors {
            return;
        }
        
        log::error!(
            "[GEMINI_ERROR] id={} error={}",
            request_id,
            error
        );
    }
    
    /// Log performance metrics
    pub fn log_performance(&self, metrics: &RequestMetrics) {
        if !self.config.log_performance {
            return;
        }
        
        log::info!(
            "[GEMINI_PERF] model={} duration_ms={} tokens={} cost=${:.4} cache_hit={} retries={}",
            metrics.model,
            metrics.duration_ms,
            metrics.total_tokens,
            metrics.cost_estimate,
            metrics.cache_hit,
            metrics.retry_count
        );
    }
    
    /// Sanitize sensitive content
    fn sanitize_content(&self, content: &str) -> String {
        // Simple sanitization - in production would be more sophisticated
        let patterns = [
            (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[EMAIL]"),
            (r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", "[PHONE]"),
            (r"\b\d{16}\b", "[CARD_NUMBER]"),
            (r"\b[A-Za-z0-9]{20,}\b", "[API_KEY]"),
        ];
        
        let mut result = content.to_string();
        for (pattern, replacement) in patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                result = re.replace_all(&result, replacement).to_string();
            }
        }
        
        // Truncate if too long
        if result.len() > self.config.max_response_length {
            result.truncate(self.config.max_response_length);
            result.push_str("...[truncated]");
        }
        
        result
    }
}

/// Get monitoring metrics command
#[tauri::command]
pub async fn get_gemini_monitoring_metrics(
    model: Option<String>,
    limit: Option<usize>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    // In a real implementation, this would use a global collector instance
    let collector = MonitoringCollector::new(10000);
    
    let mut result = HashMap::new();
    
    // Get request history
    result.insert(
        "request_history".to_string(),
        serde_json::to_value(collector.get_request_history(limit))
            .map_err(|e| e.to_string())?,
    );
    
    // Get realtime metrics
    result.insert(
        "realtime_metrics".to_string(),
        serde_json::to_value(collector.get_realtime_metrics())
            .map_err(|e| e.to_string())?,
    );
    
    // Get usage metrics if model specified
    if let Some(model) = model {
        let hourly = collector.get_usage_metrics(&model, UsagePeriod::Hourly);
        let daily = collector.get_usage_metrics(&model, UsagePeriod::Daily);
        
        let mut usage = HashMap::new();
        if let Some(metrics) = hourly {
            usage.insert("hourly", serde_json::to_value(metrics).unwrap());
        }
        if let Some(metrics) = daily {
            usage.insert("daily", serde_json::to_value(metrics).unwrap());
        }
        
        result.insert(
            "usage_metrics".to_string(),
            serde_json::Value::Object(usage.into_iter().map(|(k, v)| (k.to_string(), v)).collect()),
        );
    }
    
    Ok(result)
}

/// Get performance analytics command
#[tauri::command]
pub async fn get_gemini_analytics(
    model: String,
    start_time: String,
    end_time: String,
) -> Result<PerformanceAnalytics, String> {
    let collector = MonitoringCollector::new(10000);
    
    let time_range = TimeRange {
        start: DateTime::parse_from_rfc3339(&start_time)
            .map_err(|e| e.to_string())?
            .with_timezone(&Utc),
        end: DateTime::parse_from_rfc3339(&end_time)
            .map_err(|e| e.to_string())?
            .with_timezone(&Utc),
    };
    
    Ok(collector.generate_analytics(&model, time_range))
}