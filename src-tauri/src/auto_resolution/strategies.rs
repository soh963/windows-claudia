use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};
use log::{info, warn, error, debug};
use tokio::time::sleep;

/// Resolution strategy with intelligent retry and fallback mechanisms
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionStrategy {
    pub id: String,
    pub name: String,
    pub steps: Vec<ResolutionStep>,
    pub retry_config: RetryConfig,
    pub fallback_strategy: Option<Box<ResolutionStrategy>>,
    pub success_criteria: SuccessCriteria,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionStep {
    pub step_type: StepType,
    pub action: String,
    pub parameters: HashMap<String, String>,
    pub validation: Option<ValidationRule>,
    pub on_failure: FailureAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepType {
    EmitEvent,
    WaitAndRetry,
    ExecuteCommand,
    CheckCondition,
    ClearCache,
    RestartService,
    RefreshConfig,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f32,
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2.0,
            jitter: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessCriteria {
    pub criteria_type: CriteriaType,
    pub expected_value: String,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CriteriaType {
    EventReceived,
    ConditionMet,
    NoErrorsFor,
    ResponseReceived,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRule {
    pub rule_type: ValidationType,
    pub expected: String,
    pub operator: ComparisonOperator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationType {
    StatusCode,
    ResponseContains,
    FileExists,
    ProcessRunning,
    MemoryUsage,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComparisonOperator {
    Equals,
    NotEquals,
    Contains,
    GreaterThan,
    LessThan,
    Exists,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FailureAction {
    Continue,
    Retry,
    Skip,
    Abort,
    Fallback,
}

/// Strategy executor
pub struct StrategyExecutor {
    app_handle: AppHandle,
}

impl StrategyExecutor {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }
    
    /// Execute a resolution strategy
    pub async fn execute(&self, strategy: &ResolutionStrategy, context: &HashMap<String, String>) -> StrategyResult {
        let start_time = SystemTime::now();
        let mut result = StrategyResult {
            success: false,
            message: String::new(),
            steps_completed: Vec::new(),
            steps_failed: Vec::new(),
            time_elapsed_ms: 0,
            retry_count: 0,
        };
        
        let mut attempt = 0;
        let mut delay_ms = strategy.retry_config.initial_delay_ms;
        
        while attempt < strategy.retry_config.max_attempts {
            attempt += 1;
            result.retry_count = attempt;
            
            debug!("Executing strategy {} (attempt {}/{})", strategy.name, attempt, strategy.retry_config.max_attempts);
            
            // Execute each step
            let mut all_steps_successful = true;
            for (i, step) in strategy.steps.iter().enumerate() {
                let step_result = self.execute_step(step, context).await;
                
                if step_result.success {
                    result.steps_completed.push(format!("Step {}: {}", i + 1, step.action));
                } else {
                    result.steps_failed.push(format!("Step {}: {} - {}", i + 1, step.action, step_result.error));
                    
                    match step.on_failure {
                        FailureAction::Continue => {
                            debug!("Step failed but continuing");
                        }
                        FailureAction::Retry => {
                            all_steps_successful = false;
                            break;
                        }
                        FailureAction::Skip => {
                            debug!("Skipping failed step");
                            continue;
                        }
                        FailureAction::Abort => {
                            error!("Aborting strategy due to step failure");
                            result.message = format!("Strategy aborted: {}", step_result.error);
                            return result;
                        }
                        FailureAction::Fallback => {
                            if let Some(fallback) = &strategy.fallback_strategy {
                                info!("Executing fallback strategy");
                                return Box::pin(self.execute(fallback, context)).await;
                            }
                        }
                    }
                }
            }
            
            if all_steps_successful {
                // Check success criteria
                if self.check_success_criteria(&strategy.success_criteria).await {
                    result.success = true;
                    result.message = format!("Strategy {} completed successfully", strategy.name);
                    break;
                }
            }
            
            // Apply retry delay with jitter
            if attempt < strategy.retry_config.max_attempts {
                let mut actual_delay = delay_ms;
                if strategy.retry_config.jitter {
                    actual_delay = (actual_delay as f64 * (0.5 + rand::random::<f64>() * 0.5)) as u64;
                }
                
                debug!("Waiting {}ms before retry", actual_delay);
                sleep(Duration::from_millis(actual_delay)).await;
                
                // Update delay for next iteration
                delay_ms = (delay_ms as f32 * strategy.retry_config.backoff_multiplier) as u64;
                if delay_ms > strategy.retry_config.max_delay_ms {
                    delay_ms = strategy.retry_config.max_delay_ms;
                }
            }
        }
        
        if !result.success {
            result.message = format!("Strategy {} failed after {} attempts", strategy.name, attempt);
        }
        
        result.time_elapsed_ms = SystemTime::now()
            .duration_since(start_time)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        
        result
    }
    
    /// Execute a single resolution step
    async fn execute_step(&self, step: &ResolutionStep, context: &HashMap<String, String>) -> StepResult {
        debug!("Executing step: {:?} - {}", step.step_type, step.action);
        
        let success = match &step.step_type {
            StepType::EmitEvent => {
                self.emit_event(&step.action, &step.parameters).await
            }
            StepType::WaitAndRetry => {
                let delay = step.parameters.get("delay_ms")
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(1000);
                sleep(Duration::from_millis(delay)).await;
                true
            }
            StepType::ExecuteCommand => {
                self.execute_command(&step.action, &step.parameters).await
            }
            StepType::CheckCondition => {
                self.check_condition(&step.action, &step.parameters, context).await
            }
            StepType::ClearCache => {
                self.clear_cache(&step.parameters).await
            }
            StepType::RestartService => {
                self.restart_service(&step.action, &step.parameters).await
            }
            StepType::RefreshConfig => {
                self.refresh_config(&step.parameters).await
            }
            StepType::Custom => {
                self.execute_custom(&step.action, &step.parameters, context).await
            }
        };
        
        // Validate if needed
        let validated = if let Some(validation) = &step.validation {
            self.validate_step(validation, context).await
        } else {
            success
        };
        
        StepResult {
            success: validated,
            error: if validated { String::new() } else { "Step validation failed".to_string() },
        }
    }
    
    async fn emit_event(&self, event_name: &str, params: &HashMap<String, String>) -> bool {
        self.app_handle.emit(event_name, serde_json::json!(params)).is_ok()
    }
    
    async fn execute_command(&self, command: &str, params: &HashMap<String, String>) -> bool {
        debug!("Executing command: {} with params: {:?}", command, params);
        // Implementation would execute actual commands
        true
    }
    
    async fn check_condition(&self, condition: &str, params: &HashMap<String, String>, context: &HashMap<String, String>) -> bool {
        debug!("Checking condition: {}", condition);
        // Implementation would check various conditions
        true
    }
    
    async fn clear_cache(&self, params: &HashMap<String, String>) -> bool {
        let cache_type = params.get("cache_type").cloned().unwrap_or_else(|| "all".to_string());
        self.app_handle.emit("clear-cache", serde_json::json!({
            "cache_type": cache_type
        })).is_ok()
    }
    
    async fn restart_service(&self, service_name: &str, params: &HashMap<String, String>) -> bool {
        self.app_handle.emit("restart-service", serde_json::json!({
            "service": service_name,
            "wait_ms": params.get("wait_ms").cloned().unwrap_or_else(|| "2000".to_string())
        })).is_ok()
    }
    
    async fn refresh_config(&self, params: &HashMap<String, String>) -> bool {
        self.app_handle.emit("refresh-config", serde_json::json!(params)).is_ok()
    }
    
    async fn execute_custom(&self, action: &str, params: &HashMap<String, String>, context: &HashMap<String, String>) -> bool {
        debug!("Executing custom action: {}", action);
        // Custom action implementation
        true
    }
    
    async fn validate_step(&self, validation: &ValidationRule, context: &HashMap<String, String>) -> bool {
        debug!("Validating step with rule: {:?}", validation.rule_type);
        // Validation implementation
        true
    }
    
    async fn check_success_criteria(&self, criteria: &SuccessCriteria) -> bool {
        match &criteria.criteria_type {
            CriteriaType::EventReceived => {
                // Check if expected event was received
                true
            }
            CriteriaType::ConditionMet => {
                // Check if condition is met
                true
            }
            CriteriaType::NoErrorsFor => {
                // Check if no errors occurred for specified duration
                true
            }
            CriteriaType::ResponseReceived => {
                // Check if expected response was received
                true
            }
            CriteriaType::Custom => {
                // Custom criteria check
                true
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyResult {
    pub success: bool,
    pub message: String,
    pub steps_completed: Vec<String>,
    pub steps_failed: Vec<String>,
    pub time_elapsed_ms: u64,
    pub retry_count: u32,
}

#[derive(Debug, Clone)]
struct StepResult {
    success: bool,
    error: String,
}

/// Pre-defined resolution strategies
pub fn get_default_strategies() -> HashMap<String, ResolutionStrategy> {
    let mut strategies = HashMap::new();
    
    // Session recovery strategy
    strategies.insert(
        "session_recovery".to_string(),
        ResolutionStrategy {
            id: "session_recovery".to_string(),
            name: "Session Recovery Strategy".to_string(),
            steps: vec![
                ResolutionStep {
                    step_type: StepType::EmitEvent,
                    action: "cleanup-session".to_string(),
                    parameters: [("force".to_string(), "true".to_string())].into(),
                    validation: None,
                    on_failure: FailureAction::Continue,
                },
                ResolutionStep {
                    step_type: StepType::WaitAndRetry,
                    action: "wait".to_string(),
                    parameters: [("delay_ms".to_string(), "500".to_string())].into(),
                    validation: None,
                    on_failure: FailureAction::Continue,
                },
                ResolutionStep {
                    step_type: StepType::EmitEvent,
                    action: "create-isolated-session".to_string(),
                    parameters: [("isolation_level".to_string(), "strict".to_string())].into(),
                    validation: None,
                    on_failure: FailureAction::Retry,
                },
            ],
            retry_config: RetryConfig::default(),
            fallback_strategy: None,
            success_criteria: SuccessCriteria {
                criteria_type: CriteriaType::EventReceived,
                expected_value: "session-created".to_string(),
                timeout_ms: 5000,
            },
            timeout_ms: 10000,
        }
    );
    
    // API retry strategy
    strategies.insert(
        "api_retry".to_string(),
        ResolutionStrategy {
            id: "api_retry".to_string(),
            name: "API Retry Strategy".to_string(),
            steps: vec![
                ResolutionStep {
                    step_type: StepType::CheckCondition,
                    action: "check-api-status".to_string(),
                    parameters: HashMap::new(),
                    validation: None,
                    on_failure: FailureAction::Continue,
                },
                ResolutionStep {
                    step_type: StepType::WaitAndRetry,
                    action: "exponential-backoff".to_string(),
                    parameters: [("initial_ms".to_string(), "1000".to_string())].into(),
                    validation: None,
                    on_failure: FailureAction::Continue,
                },
                ResolutionStep {
                    step_type: StepType::EmitEvent,
                    action: "retry-api-call".to_string(),
                    parameters: HashMap::new(),
                    validation: Some(ValidationRule {
                        rule_type: ValidationType::StatusCode,
                        expected: "200".to_string(),
                        operator: ComparisonOperator::Equals,
                    }),
                    on_failure: FailureAction::Retry,
                },
            ],
            retry_config: RetryConfig {
                max_attempts: 5,
                initial_delay_ms: 1000,
                max_delay_ms: 60000,
                backoff_multiplier: 2.0,
                jitter: true,
            },
            fallback_strategy: None,
            success_criteria: SuccessCriteria {
                criteria_type: CriteriaType::ResponseReceived,
                expected_value: "api-success".to_string(),
                timeout_ms: 60000,
            },
            timeout_ms: 120000,
        }
    );
    
    strategies
}