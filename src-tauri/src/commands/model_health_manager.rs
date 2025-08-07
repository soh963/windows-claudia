use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, command};
use chrono::{DateTime, Utc, Duration};
use log::{info, warn, error};

/// Model health status tracking
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModelStatus {
    Available,      // Model is working correctly
    Degraded,       // Model works but with issues
    Unavailable,    // Model is not working
    Deprecated,     // Model is being phased out
    Unknown,        // Not yet tested
}

/// Detailed model health information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelHealth {
    pub model_id: String,
    pub provider: String,
    pub status: ModelStatus,
    pub last_checked: DateTime<Utc>,
    pub last_success: Option<DateTime<Utc>>,
    pub consecutive_failures: u32,
    pub average_response_time_ms: Option<u64>,
    pub success_rate: f64,
    pub error_messages: Vec<String>,
    pub capabilities_verified: ModelCapabilityStatus,
    pub fallback_model: Option<String>,
}

/// Capability verification status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCapabilityStatus {
    pub basic_chat: Option<bool>,
    pub tool_access: Option<bool>,
    pub mcp_support: Option<bool>,
    pub agent_support: Option<bool>,
    pub slash_commands: Option<bool>,
    pub vision_support: Option<bool>,
    pub audio_support: Option<bool>,
    pub session_management: Option<bool>,
}

/// Model validation test case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationTest {
    pub test_name: String,
    pub test_type: TestType,
    pub prompt: String,
    pub expected_behavior: String,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestType {
    BasicChat,
    ToolAccess,
    MCPIntegration,
    AgentSupport,
    SlashCommand,
    VisionTest,
    AudioTest,
    SessionManagement,
    PerformanceTest,
}

/// Complete model validation report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelValidationReport {
    pub timestamp: DateTime<Utc>,
    pub model_id: String,
    pub provider: String,
    pub overall_status: ModelStatus,
    pub test_results: Vec<TestResult>,
    pub performance_metrics: PerformanceMetrics,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub test_name: String,
    pub test_type: TestType,
    pub success: bool,
    pub response_time_ms: u64,
    pub error_message: Option<String>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub avg_response_time_ms: u64,
    pub p95_response_time_ms: u64,
    pub p99_response_time_ms: u64,
    pub success_rate: f64,
    pub throughput_per_minute: f64,
}

/// Global model health cache
pub struct ModelHealthManager {
    health_cache: Arc<Mutex<HashMap<String, ModelHealth>>>,
    last_full_check: Arc<Mutex<Option<DateTime<Utc>>>>,
    config: HealthCheckConfig,
}

#[derive(Debug, Clone)]
pub struct HealthCheckConfig {
    pub check_interval_minutes: i64,
    pub failure_threshold: u32,
    pub degraded_threshold: f64,
    pub timeout_ms: u64,
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            check_interval_minutes: 30,
            failure_threshold: 3,
            degraded_threshold: 0.8,
            timeout_ms: 10000,
        }
    }
}

impl ModelHealthManager {
    pub fn new() -> Self {
        Self {
            health_cache: Arc::new(Mutex::new(HashMap::new())),
            last_full_check: Arc::new(Mutex::new(None)),
            config: HealthCheckConfig::default(),
        }
    }

    /// Check if a model is currently available
    pub fn is_model_available(&self, model_id: &str) -> bool {
        let cache = self.health_cache.lock().unwrap();
        cache.get(model_id)
            .map(|health| matches!(health.status, ModelStatus::Available | ModelStatus::Degraded))
            .unwrap_or(false)
    }

    /// Get the current health status of a model
    pub fn get_model_health(&self, model_id: &str) -> Option<ModelHealth> {
        let cache = self.health_cache.lock().unwrap();
        cache.get(model_id).cloned()
    }

    /// Update model health based on test results
    pub fn update_model_health(&self, model_id: String, report: ModelValidationReport) {
        let mut cache = self.health_cache.lock().unwrap();
        
        let health = cache.entry(model_id.clone()).or_insert(ModelHealth {
            model_id: model_id.clone(),
            provider: report.provider.clone(),
            status: ModelStatus::Unknown,
            last_checked: Utc::now(),
            last_success: None,
            consecutive_failures: 0,
            average_response_time_ms: None,
            success_rate: 0.0,
            error_messages: Vec::new(),
            capabilities_verified: ModelCapabilityStatus {
                basic_chat: None,
                tool_access: None,
                mcp_support: None,
                agent_support: None,
                slash_commands: None,
                vision_support: None,
                audio_support: None,
                session_management: None,
            },
            fallback_model: None,
        });

        // Update health based on report
        health.last_checked = report.timestamp;
        health.status = report.overall_status.clone();
        health.success_rate = report.performance_metrics.success_rate;
        health.average_response_time_ms = Some(report.performance_metrics.avg_response_time_ms);

        // Update capabilities based on test results
        for test_result in &report.test_results {
            match test_result.test_type {
                TestType::BasicChat => health.capabilities_verified.basic_chat = Some(test_result.success),
                TestType::ToolAccess => health.capabilities_verified.tool_access = Some(test_result.success),
                TestType::MCPIntegration => health.capabilities_verified.mcp_support = Some(test_result.success),
                TestType::AgentSupport => health.capabilities_verified.agent_support = Some(test_result.success),
                TestType::SlashCommand => health.capabilities_verified.slash_commands = Some(test_result.success),
                TestType::VisionTest => health.capabilities_verified.vision_support = Some(test_result.success),
                TestType::AudioTest => health.capabilities_verified.audio_support = Some(test_result.success),
                TestType::SessionManagement => health.capabilities_verified.session_management = Some(test_result.success),
                _ => {}
            }
        }

        // Update consecutive failures and last success
        if report.overall_status == ModelStatus::Available {
            health.last_success = Some(report.timestamp);
            health.consecutive_failures = 0;
        } else {
            health.consecutive_failures += 1;
        }

        // Collect error messages
        health.error_messages = report.test_results
            .iter()
            .filter_map(|r| r.error_message.clone())
            .collect();
    }

    /// Determine if a full health check is needed
    pub fn needs_health_check(&self) -> bool {
        let last_check = self.last_full_check.lock().unwrap();
        match *last_check {
            None => true,
            Some(last) => {
                let elapsed = Utc::now() - last;
                elapsed > Duration::minutes(self.config.check_interval_minutes)
            }
        }
    }

    /// Mark that a full health check was completed
    pub fn mark_health_check_complete(&self) {
        let mut last_check = self.last_full_check.lock().unwrap();
        *last_check = Some(Utc::now());
    }

    /// Get all model health statuses
    pub fn get_all_health_status(&self) -> HashMap<String, ModelHealth> {
        let cache = self.health_cache.lock().unwrap();
        cache.clone()
    }

    /// Get recommended fallback model for a failed model
    pub fn get_fallback_model(&self, model_id: &str, provider: &str) -> Option<String> {
        // Define fallback chains for each provider
        let fallback_chains: HashMap<&str, Vec<&str>> = HashMap::from([
            // Claude fallbacks
            ("opus-4.1", vec!["sonnet-4", "sonnet-3.7", "gemini-2.5-pro-exp"]),
            ("sonnet-4", vec!["sonnet-3.7", "opus-4.1", "gemini-2.5-flash"]),
            ("sonnet-3.7", vec!["sonnet-4", "gemini-2.5-flash", "llama3.3:latest"]),
            ("sonnet", vec!["sonnet-3.7", "sonnet-4", "gemini-2.5-flash"]),
            ("opus", vec!["opus-4.1", "sonnet-4", "gemini-2.5-pro-exp"]),
            
            // Gemini fallbacks
            ("gemini-2.5-pro-exp", vec!["gemini-2.0-pro-exp", "gemini-2.5-flash", "opus-4.1"]),
            ("gemini-2.5-flash", vec!["gemini-2.0-flash", "gemini-2.0-flash-lite", "sonnet-3.7"]),
            ("gemini-2.0-pro-exp", vec!["gemini-2.5-pro-exp", "gemini-2.0-flash", "sonnet-4"]),
            ("gemini-2.0-flash", vec!["gemini-2.5-flash", "gemini-2.0-flash-lite", "llama3.3:latest"]),
            
            // Ollama fallbacks
            ("llama3.3:latest", vec!["llama3.2:latest", "phi3:latest", "mistral:latest"]),
            ("llama3.2:latest", vec!["llama3.3:latest", "mistral:latest", "qwen2.5:latest"]),
            ("codellama:latest", vec!["llama3.3:latest", "phi3:latest", "sonnet-4"]),
            ("qwen2.5:latest", vec!["llama3.3:latest", "mistral:latest", "gemini-2.5-flash"]),
            ("mistral:latest", vec!["llama3.3:latest", "phi3:latest", "gemini-2.0-flash-lite"]),
            ("phi3:latest", vec!["llama3.3:latest", "mistral:latest", "gemini-2.0-flash-lite"]),
        ]);

        // Get fallback chain for the model
        if let Some(fallbacks) = fallback_chains.get(model_id) {
            // Find first available fallback
            for fallback_id in fallbacks {
                if self.is_model_available(fallback_id) {
                    return Some(fallback_id.to_string());
                }
            }
        }

        // If no specific fallback found, try default by provider
        match provider {
            "claude" => {
                if self.is_model_available("sonnet-4") { return Some("sonnet-4".to_string()); }
                if self.is_model_available("opus-4.1") { return Some("opus-4.1".to_string()); }
            }
            "gemini" => {
                if self.is_model_available("gemini-2.5-flash") { return Some("gemini-2.5-flash".to_string()); }
                if self.is_model_available("gemini-2.0-flash") { return Some("gemini-2.0-flash".to_string()); }
            }
            "ollama" => {
                if self.is_model_available("llama3.3:latest") { return Some("llama3.3:latest".to_string()); }
                if self.is_model_available("phi3:latest") { return Some("phi3:latest".to_string()); }
            }
            _ => {}
        }

        None
    }
}

/// Get comprehensive validation tests for a model
pub fn get_validation_tests(model_id: &str, provider: &str) -> Vec<ValidationTest> {
    let mut tests = vec![
        // Basic chat test - all models should support this
        ValidationTest {
            test_name: "Basic Chat".to_string(),
            test_type: TestType::BasicChat,
            prompt: "Hello! Please respond with a simple greeting.".to_string(),
            expected_behavior: "Model should respond with a greeting".to_string(),
            timeout_ms: 5000,
        },
        
        // Performance test
        ValidationTest {
            test_name: "Response Performance".to_string(),
            test_type: TestType::PerformanceTest,
            prompt: "What is 2+2?".to_string(),
            expected_behavior: "Model should respond quickly with correct answer".to_string(),
            timeout_ms: 3000,
        },
    ];

    // Add provider-specific tests
    match provider {
        "claude" => {
            tests.push(ValidationTest {
                test_name: "Tool Access".to_string(),
                test_type: TestType::ToolAccess,
                prompt: "Can you list the available tools and capabilities you have access to?".to_string(),
                expected_behavior: "Model should list MCP, agents, and other tools".to_string(),
                timeout_ms: 8000,
            });
            tests.push(ValidationTest {
                test_name: "MCP Support".to_string(),
                test_type: TestType::MCPIntegration,
                prompt: "Can you access MCP servers?".to_string(),
                expected_behavior: "Model should confirm MCP access".to_string(),
                timeout_ms: 8000,
            });
        }
        "gemini" => {
            tests.push(ValidationTest {
                test_name: "Session Management".to_string(),
                test_type: TestType::SessionManagement,
                prompt: "Remember this number: 42. I'll ask about it next.".to_string(),
                expected_behavior: "Model should maintain session context".to_string(),
                timeout_ms: 8000,
            });
        }
        "ollama" => {
            tests.push(ValidationTest {
                test_name: "Code Generation".to_string(),
                test_type: TestType::BasicChat,
                prompt: "Write a simple Python hello world function.".to_string(),
                expected_behavior: "Model should generate valid Python code".to_string(),
                timeout_ms: 10000,
            });
        }
        _ => {}
    }

    // Add vision test for models that support it
    if model_id.contains("4.1") || model_id.contains("gemini") || model_id.contains("sonnet") {
        tests.push(ValidationTest {
            test_name: "Vision Support".to_string(),
            test_type: TestType::VisionTest,
            prompt: "Can you analyze images?".to_string(),
            expected_behavior: "Model should confirm image analysis capability".to_string(),
            timeout_ms: 5000,
        });
    }

    tests
}

/// Tauri command to get model health status
#[command]
pub async fn get_model_health_status(
    model_id: String,
    manager: tauri::State<'_, ModelHealthManager>,
) -> Result<Option<ModelHealth>, String> {
    Ok(manager.get_model_health(&model_id))
}

/// Tauri command to get all model health statuses
#[command]
pub async fn get_all_model_health(
    manager: tauri::State<'_, ModelHealthManager>,
) -> Result<HashMap<String, ModelHealth>, String> {
    Ok(manager.get_all_health_status())
}

/// Tauri command to check if model is available
#[command]
pub async fn is_model_available(
    model_id: String,
    manager: tauri::State<'_, ModelHealthManager>,
) -> Result<bool, String> {
    Ok(manager.is_model_available(&model_id))
}

/// Tauri command to get fallback model
#[command]
pub async fn get_fallback_model(
    model_id: String,
    provider: String,
    manager: tauri::State<'_, ModelHealthManager>,
) -> Result<Option<String>, String> {
    Ok(manager.get_fallback_model(&model_id, &provider))
}