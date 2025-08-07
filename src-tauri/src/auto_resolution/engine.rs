use super::agents::{ResolutionAgent, ResolutionResult, ImportErrorAgent, ModelConnectionAgent, SessionIsolationAgent, ToolAccessAgent};
use super::patterns::{PatternEngine, PatternMatch};
use super::strategies::{ResolutionStrategy, StrategyExecutor, get_default_strategies};
use crate::commands::agents::AgentDb;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State, Emitter};
use tokio::sync::RwLock;
use log::{info, warn, error, debug};
use uuid::Uuid;

/// Main auto-resolution engine
pub struct AutoResolutionEngine {
    agents: Arc<RwLock<Vec<Box<dyn ResolutionAgent>>>>,
    pattern_engine: Arc<RwLock<PatternEngine>>,
    strategies: Arc<RwLock<HashMap<String, ResolutionStrategy>>>,
    resolution_history: Arc<RwLock<Vec<ResolutionHistoryEntry>>>,
    app_handle: AppHandle,
    enabled: Arc<RwLock<bool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionHistoryEntry {
    pub id: String,
    pub error_code: String,
    pub timestamp: i64,
    pub agent_used: String,
    pub strategy_used: Option<String>,
    pub success: bool,
    pub time_elapsed_ms: u64,
    pub actions_taken: Vec<String>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionReport {
    pub total_errors: u32,
    pub auto_resolved: u32,
    pub manual_resolved: u32,
    pub pending: u32,
    pub success_rate: f32,
    pub avg_resolution_time_ms: u64,
    pub top_errors: Vec<ErrorFrequency>,
    pub agent_performance: Vec<AgentPerformance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorFrequency {
    pub error_code: String,
    pub occurrences: u32,
    pub auto_resolved: u32,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPerformance {
    pub agent_id: String,
    pub agent_name: String,
    pub attempts: u32,
    pub successes: u32,
    pub success_rate: f32,
    pub avg_time_ms: u64,
}

impl AutoResolutionEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        let mut engine = Self {
            agents: Arc::new(RwLock::new(Vec::new())),
            pattern_engine: Arc::new(RwLock::new(PatternEngine::new())),
            strategies: Arc::new(RwLock::new(get_default_strategies())),
            resolution_history: Arc::new(RwLock::new(Vec::new())),
            app_handle,
            enabled: Arc::new(RwLock::new(true)),
        };
        
        // Initialize default agents
        let agents_clone = engine.agents.clone();
        tokio::spawn(async move {
            let mut agents = agents_clone.write().await;
            agents.push(Box::new(ImportErrorAgent::new()));
            agents.push(Box::new(ModelConnectionAgent::new()));
            agents.push(Box::new(SessionIsolationAgent::new()));
            agents.push(Box::new(ToolAccessAgent::new()));
        });
        
        engine
    }
    
    /// Process an error and attempt auto-resolution
    pub async fn process_error(
        &self,
        error_code: &str,
        error_message: &str,
        context: HashMap<String, String>,
        stack_trace: Option<String>,
    ) -> Result<ResolutionResult, String> {
        // Check if auto-resolution is enabled
        if !*self.enabled.read().await {
            return Err("Auto-resolution is disabled".to_string());
        }
        
        let start_time = SystemTime::now();
        
        // First, try pattern matching
        let pattern_matches = {
            let pattern_engine = self.pattern_engine.read().await;
            pattern_engine.match_error(error_message, &context, stack_trace.as_deref())
        };
        
        debug!("Found {} pattern matches for error {}", pattern_matches.len(), error_code);
        
        // Try to find the best resolution approach
        let mut best_result: Option<ResolutionResult> = None;
        let mut best_agent: Option<String> = None;
        
        // If we have high-confidence pattern matches, use strategy-based resolution
        if let Some(best_match) = pattern_matches.first() {
            if best_match.confidence > 0.8 && best_match.auto_resolvable {
                info!("Using pattern-based resolution for {} (confidence: {})", 
                      error_code, best_match.confidence);
                
                // Execute strategy if available
                if let Some(strategy) = self.strategies.read().await.get(&best_match.pattern_id) {
                    let executor = StrategyExecutor::new(self.app_handle.clone());
                    let strategy_result = executor.execute(strategy, &context).await;
                    
                    if strategy_result.success {
                        let result = ResolutionResult {
                            success: true,
                            message: strategy_result.message,
                            actions_taken: strategy_result.steps_completed,
                            time_elapsed_ms: strategy_result.time_elapsed_ms,
                            confidence: best_match.confidence,
                            retry_needed: false,
                        };
                        
                        self.record_resolution(
                            error_code,
                            "pattern_strategy",
                            Some(best_match.pattern_id.clone()),
                            &result,
                        ).await;
                        
                        return Ok(result);
                    }
                }
            }
        }
        
        // Try agent-based resolution
        let agents = self.agents.read().await;
        for agent in agents.iter() {
            if agent.can_handle(error_code, &context).await {
                info!("Agent {} attempting to resolve {}", agent.id(), error_code);
                
                let result = agent.resolve(&self.app_handle, error_code, &context).await;
                
                if result.success {
                    best_result = Some(result.clone());
                    best_agent = Some(agent.id().to_string());
                    break; // Use first successful agent
                } else if best_result.is_none() || result.confidence > best_result.as_ref().unwrap().confidence {
                    // Keep the result with highest confidence even if not successful
                    best_result = Some(result);
                    best_agent = Some(agent.id().to_string());
                }
            }
        }
        
        // Record resolution attempt
        if let Some(result) = &best_result {
            if let Some(agent_id) = &best_agent {
                self.record_resolution(
                    error_code,
                    agent_id,
                    None,
                    result,
                ).await;
            }
        }
        
        // Emit resolution event
        self.emit_resolution_event(error_code, &best_result).await;
        
        best_result.ok_or_else(|| "No suitable resolution agent found".to_string())
    }
    
    /// Record resolution in history
    async fn record_resolution(
        &self,
        error_code: &str,
        agent_id: &str,
        strategy_id: Option<String>,
        result: &ResolutionResult,
    ) {
        let entry = ResolutionHistoryEntry {
            id: Uuid::new_v4().to_string(),
            error_code: error_code.to_string(),
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
            agent_used: agent_id.to_string(),
            strategy_used: strategy_id,
            success: result.success,
            time_elapsed_ms: result.time_elapsed_ms,
            actions_taken: result.actions_taken.clone(),
            confidence: result.confidence,
        };
        
        self.resolution_history.write().await.push(entry);
        
        // Keep only last 1000 entries  
        let mut history = self.resolution_history.write().await;
        if history.len() > 1000 {
            let drain_count = history.len() - 1000;
            history.drain(0..drain_count);
        }
    }
    
    /// Emit resolution event to frontend
    async fn emit_resolution_event(&self, error_code: &str, result: &Option<ResolutionResult>) {
        let event_data = if let Some(res) = result {
            serde_json::json!({
                "error_code": error_code,
                "resolved": res.success,
                "message": res.message,
                "confidence": res.confidence,
                "retry_needed": res.retry_needed,
            })
        } else {
            serde_json::json!({
                "error_code": error_code,
                "resolved": false,
                "message": "No resolution available",
                "confidence": 0.0,
                "retry_needed": true,
            })
        };
        
        if let Err(e) = self.app_handle.emit("error-resolution-attempt", event_data) {
            warn!("Failed to emit resolution event: {}", e);
        }
    }
    
    /// Get resolution report
    pub async fn get_resolution_report(&self, hours: Option<i32>) -> ResolutionReport {
        let history = self.resolution_history.read().await;
        let cutoff_time = if let Some(h) = hours {
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64 - (h as i64 * 3600)
        } else {
            0
        };
        
        let filtered_history: Vec<_> = history.iter()
            .filter(|e| e.timestamp >= cutoff_time)
            .collect();
        
        let total_errors = filtered_history.len() as u32;
        let auto_resolved = filtered_history.iter().filter(|e| e.success).count() as u32;
        
        // Calculate success rate
        let success_rate = if total_errors > 0 {
            (auto_resolved as f32 / total_errors as f32) * 100.0
        } else {
            0.0
        };
        
        // Calculate average resolution time
        let total_time: u64 = filtered_history.iter()
            .filter(|e| e.success)
            .map(|e| e.time_elapsed_ms)
            .sum();
        let avg_resolution_time_ms = if auto_resolved > 0 {
            total_time / auto_resolved as u64
        } else {
            0
        };
        
        // Calculate error frequencies
        let mut error_freq_map: HashMap<String, (u32, u32, String)> = HashMap::new();
        for entry in &filtered_history {
            let freq = error_freq_map.entry(entry.error_code.clone())
                .or_insert((0, 0, "Unknown".to_string()));
            freq.0 += 1;
            if entry.success {
                freq.1 += 1;
            }
        }
        
        let mut top_errors: Vec<ErrorFrequency> = error_freq_map.into_iter()
            .map(|(code, (occurrences, resolved, category))| ErrorFrequency {
                error_code: code,
                occurrences,
                auto_resolved: resolved,
                category,
            })
            .collect();
        top_errors.sort_by(|a, b| b.occurrences.cmp(&a.occurrences));
        top_errors.truncate(10);
        
        // Calculate agent performance
        let mut agent_stats: HashMap<String, (u32, u32, u64)> = HashMap::new();
        for entry in &filtered_history {
            let stats = agent_stats.entry(entry.agent_used.clone())
                .or_insert((0, 0, 0));
            stats.0 += 1; // attempts
            if entry.success {
                stats.1 += 1; // successes
            }
            stats.2 += entry.time_elapsed_ms; // total time
        }
        
        let agent_performance: Vec<AgentPerformance> = agent_stats.into_iter()
            .map(|(id, (attempts, successes, total_time))| {
                let success_rate = if attempts > 0 {
                    (successes as f32 / attempts as f32) * 100.0
                } else {
                    0.0
                };
                let avg_time_ms = if attempts > 0 {
                    total_time / attempts as u64
                } else {
                    0
                };
                
                AgentPerformance {
                    agent_id: id.clone(),
                    agent_name: id, // Could be enhanced with proper names
                    attempts,
                    successes,
                    success_rate,
                    avg_time_ms,
                }
            })
            .collect();
        
        ResolutionReport {
            total_errors,
            auto_resolved,
            manual_resolved: 0, // Would need to track this separately
            pending: total_errors - auto_resolved,
            success_rate,
            avg_resolution_time_ms,
            top_errors,
            agent_performance,
        }
    }
    
    /// Enable or disable auto-resolution
    pub async fn set_enabled(&self, enabled: bool) {
        *self.enabled.write().await = enabled;
        info!("Auto-resolution {}", if enabled { "enabled" } else { "disabled" });
    }
    
    /// Check if auto-resolution is enabled
    pub async fn is_enabled(&self) -> bool {
        *self.enabled.read().await
    }
    
    /// Add a custom resolution agent
    pub async fn add_agent(&self, agent: Box<dyn ResolutionAgent>) {
        self.agents.write().await.push(agent);
    }
    
    /// Add a custom resolution strategy
    pub async fn add_strategy(&self, id: String, strategy: ResolutionStrategy) {
        self.strategies.write().await.insert(id, strategy);
    }
    
    /// Clear resolution history
    pub async fn clear_history(&self) {
        self.resolution_history.write().await.clear();
        info!("Resolution history cleared");
    }
}

/// Initialize the auto-resolution engine
pub fn init_auto_resolution_engine(app_handle: AppHandle) -> Arc<AutoResolutionEngine> {
    let engine = Arc::new(AutoResolutionEngine::new(app_handle));
    info!("Auto-resolution engine initialized");
    engine
}