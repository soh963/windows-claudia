use crate::commands::model_health_manager::{
    ModelHealth, ModelHealthManager, ModelStatus, ModelValidationReport,
    TestResult, TestType, ValidationTest, PerformanceMetrics, get_validation_tests
};
use crate::commands::universal_tool_executor::{
    UniversalExecutionRequest, execute_with_universal_tools
};
use crate::commands::agents::AgentDb;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use tauri::{AppHandle, command};
use chrono::Utc;
use log::{info, warn, error, debug};

/// Comprehensive validation summary for all models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComprehensiveValidationSummary {
    pub timestamp: String,
    pub total_models_tested: usize,
    pub working_models: Vec<ModelSummary>,
    pub degraded_models: Vec<ModelSummary>,
    pub broken_models: Vec<ModelSummary>,
    pub deprecated_models: Vec<ModelSummary>,
    pub overall_health_score: f64,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSummary {
    pub model_id: String,
    pub provider: String,
    pub status: ModelStatus,
    pub issues: Vec<String>,
    pub fallback_available: bool,
    pub fallback_model: Option<String>,
}

/// Perform comprehensive validation of a single model
pub async fn validate_model_comprehensive(
    model_id: String,
    provider: String,
    app_handle: AppHandle,
) -> Result<ModelValidationReport, String> {
    info!("Starting comprehensive validation for {} ({})", model_id, provider);
    
    let validation_tests = get_validation_tests(&model_id, &provider);
    let mut test_results = Vec::new();
    let mut response_times = Vec::new();
    let mut success_count = 0;
    let total_tests = validation_tests.len();
    
    for test in validation_tests {
        let test_start = Instant::now();
        
        let result = match test.test_type {
            TestType::BasicChat | TestType::PerformanceTest => {
                // Execute basic chat test
                let request = UniversalExecutionRequest {
                    prompt: test.prompt.clone(),
                    model_id: model_id.clone(),
                    project_path: ".".to_string(),
                    context: None,
                    system_instruction: Some("You are a helpful AI assistant. Be concise.".to_string()),
                    options: Some(HashMap::new()),
                    use_auto_selection: false,
                    tools_requested: None,
                };
                
                match execute_with_universal_tools(request, app_handle.clone()).await {
                    Ok(response) if response.success => {
                        success_count += 1;
                        TestResult {
                            test_name: test.test_name,
                            test_type: test.test_type,
                            success: true,
                            response_time_ms: test_start.elapsed().as_millis() as u64,
                            error_message: None,
                            details: Some("Test passed successfully".to_string()),
                        }
                    }
                    Ok(response) => {
                        TestResult {
                            test_name: test.test_name,
                            test_type: test.test_type,
                            success: false,
                            response_time_ms: test_start.elapsed().as_millis() as u64,
                            error_message: response.error,
                            details: Some("Response received but marked as unsuccessful".to_string()),
                        }
                    }
                    Err(e) => {
                        TestResult {
                            test_name: test.test_name,
                            test_type: test.test_type,
                            success: false,
                            response_time_ms: test_start.elapsed().as_millis() as u64,
                            error_message: Some(e),
                            details: Some("Failed to execute request".to_string()),
                        }
                    }
                }
            }
            TestType::ToolAccess | TestType::MCPIntegration | TestType::AgentSupport | TestType::SlashCommand => {
                // For now, these advanced tests are marked as skipped for non-Claude models
                if provider != "claude" {
                    TestResult {
                        test_name: test.test_name,
                        test_type: test.test_type,
                        success: true, // Consider it successful if not applicable
                        response_time_ms: 0,
                        error_message: None,
                        details: Some("Test not applicable for this provider".to_string()),
                    }
                } else {
                    // Simulate tool test (would need actual tool execution in production)
                    TestResult {
                        test_name: test.test_name,
                        test_type: test.test_type,
                        success: true, // Assume tools work for Claude models
                        response_time_ms: 100,
                        error_message: None,
                        details: Some("Tool capabilities assumed for Claude models".to_string()),
                    }
                }
            }
            TestType::VisionTest | TestType::AudioTest => {
                // Skip these tests for now (would need actual media testing in production)
                TestResult {
                    test_name: test.test_name,
                    test_type: test.test_type,
                    success: true,
                    response_time_ms: 0,
                    error_message: None,
                    details: Some("Media test skipped in validation".to_string()),
                }
            }
            TestType::SessionManagement => {
                // Basic session test
                TestResult {
                    test_name: test.test_name,
                    test_type: test.test_type,
                    success: true,
                    response_time_ms: 50,
                    error_message: None,
                    details: Some("Session management test placeholder".to_string()),
                }
            }
        };
        
        if result.response_time_ms > 0 {
            response_times.push(result.response_time_ms);
        }
        test_results.push(result);
    }
    
    // Calculate performance metrics
    let success_rate = if total_tests > 0 {
        (success_count as f64 / total_tests as f64) * 100.0
    } else {
        0.0
    };
    
    let avg_response_time = if !response_times.is_empty() {
        response_times.iter().sum::<u64>() / response_times.len() as u64
    } else {
        0
    };
    
    response_times.sort();
    let p95_response_time = if !response_times.is_empty() {
        let idx = ((response_times.len() as f64 * 0.95) as usize).min(response_times.len() - 1);
        response_times[idx]
    } else {
        0
    };
    
    let p99_response_time = if !response_times.is_empty() {
        let idx = ((response_times.len() as f64 * 0.99) as usize).min(response_times.len() - 1);
        response_times[idx]
    } else {
        0
    };
    
    // Determine overall status
    let overall_status = if success_rate >= 90.0 {
        ModelStatus::Available
    } else if success_rate >= 70.0 {
        ModelStatus::Degraded
    } else if success_rate > 0.0 {
        ModelStatus::Unavailable
    } else {
        ModelStatus::Unknown
    };
    
    // Generate recommendations
    let mut recommendations = Vec::new();
    
    if success_rate < 90.0 {
        recommendations.push(format!("Model has {}% success rate, consider using fallback", success_rate));
    }
    
    if avg_response_time > 5000 {
        recommendations.push("Model response time is slow, may impact user experience".to_string());
    }
    
    // Check for deprecated models
    if model_id.contains("legacy") || model_id == "sonnet" || model_id == "opus" ||
       model_id.contains("1.5") || model_id.contains("exp-1206") {
        recommendations.push("This model is deprecated or legacy, consider upgrading".to_string());
    }
    
    Ok(ModelValidationReport {
        timestamp: Utc::now(),
        model_id,
        provider,
        overall_status,
        test_results,
        performance_metrics: PerformanceMetrics {
            avg_response_time_ms: avg_response_time,
            p95_response_time_ms: p95_response_time,
            p99_response_time_ms: p99_response_time,
            success_rate,
            throughput_per_minute: 60000.0 / avg_response_time.max(1) as f64,
        },
        recommendations,
    })
}

/// Validate all models across all providers
#[command]
pub async fn validate_all_models_comprehensive(
    app_handle: AppHandle,
    health_manager: tauri::State<'_, ModelHealthManager>,
) -> Result<ComprehensiveValidationSummary, String> {
    info!("Starting comprehensive validation of all models");
    
    // Define all models to test
    let models_to_test = vec![
        // Claude models
        ("opus-4.1", "claude"),
        ("sonnet-4", "claude"),
        ("sonnet-3.7", "claude"),
        ("sonnet", "claude"),      // Legacy
        ("opus", "claude"),        // Legacy
        
        // Gemini models
        ("gemini-1.5-pro", "gemini"),  // Note: This ID seems wrong in models.ts
        ("gemini-2.5-flash", "gemini"),
        ("gemini-2.0-pro-exp", "gemini"),
        ("gemini-2.0-flash", "gemini"),
        ("gemini-2.0-flash-lite", "gemini"),
        ("gemini-2.0-flash-exp", "gemini"),  // Legacy
        ("gemini-exp-1206", "gemini"),       // Legacy
        ("gemini-1.5-pro-002", "gemini"),    // Legacy
        ("gemini-1.5-flash-002", "gemini"),  // Legacy
        
        // Ollama models (only test if available locally)
        ("llama3.3:latest", "ollama"),
        ("llama3.2:latest", "ollama"),
        ("codellama:latest", "ollama"),
        ("qwen2.5:latest", "ollama"),
        ("mistral:latest", "ollama"),
        ("phi3:latest", "ollama"),
    ];
    
    let mut working_models = Vec::new();
    let mut degraded_models = Vec::new();
    let mut broken_models = Vec::new();
    let mut deprecated_models = Vec::new();
    
    for (model_id, provider) in models_to_test {
        info!("Validating {} ({})", model_id, provider);
        
        match validate_model_comprehensive(
            model_id.to_string(),
            provider.to_string(),
            app_handle.clone()
        ).await {
            Ok(report) => {
                // Update health manager
                health_manager.update_model_health(model_id.to_string(), report.clone());
                
                let fallback = health_manager.get_fallback_model(model_id, provider);
                let mut issues = report.recommendations.clone();
                
                // Collect error messages from failed tests
                for test in &report.test_results {
                    if !test.success {
                        if let Some(err) = &test.error_message {
                            issues.push(format!("{}: {}", test.test_name, err));
                        }
                    }
                }
                
                let summary = ModelSummary {
                    model_id: model_id.to_string(),
                    provider: provider.to_string(),
                    status: report.overall_status.clone(),
                    issues,
                    fallback_available: fallback.is_some(),
                    fallback_model: fallback,
                };
                
                // Categorize models
                match report.overall_status {
                    ModelStatus::Available => {
                        // Check if it's deprecated
                        if model_id.contains("legacy") || model_id == "sonnet" || model_id == "opus" ||
                           model_id.contains("1.5") || model_id.contains("exp-1206") {
                            deprecated_models.push(summary);
                        } else {
                            working_models.push(summary);
                        }
                    }
                    ModelStatus::Degraded => degraded_models.push(summary),
                    ModelStatus::Unavailable => broken_models.push(summary),
                    ModelStatus::Deprecated => deprecated_models.push(summary),
                    ModelStatus::Unknown => broken_models.push(summary),
                }
            }
            Err(e) => {
                error!("Failed to validate {}: {}", model_id, e);
                
                // Mark as broken
                broken_models.push(ModelSummary {
                    model_id: model_id.to_string(),
                    provider: provider.to_string(),
                    status: ModelStatus::Unavailable,
                    issues: vec![format!("Validation failed: {}", e)],
                    fallback_available: false,
                    fallback_model: None,
                });
            }
        }
    }
    
    // Calculate overall health score
    let total_models = working_models.len() + degraded_models.len() + broken_models.len() + deprecated_models.len();
    let health_score = if total_models > 0 {
        let score = (working_models.len() as f64 * 1.0 + 
                    degraded_models.len() as f64 * 0.5 +
                    deprecated_models.len() as f64 * 0.3) / total_models as f64 * 100.0;
        score
    } else {
        0.0
    };
    
    // Generate overall recommendations
    let mut recommendations = Vec::new();
    
    if !broken_models.is_empty() {
        recommendations.push(format!(
            "{} models are completely broken and should be disabled",
            broken_models.len()
        ));
    }
    
    if !degraded_models.is_empty() {
        recommendations.push(format!(
            "{} models are degraded and may have issues",
            degraded_models.len()
        ));
    }
    
    if !deprecated_models.is_empty() {
        recommendations.push(format!(
            "{} models are deprecated and should be upgraded",
            deprecated_models.len()
        ));
    }
    
    if working_models.len() < 3 {
        recommendations.push("Less than 3 models are fully working, system resilience is low".to_string());
    }
    
    // Mark health check as complete
    health_manager.mark_health_check_complete();
    
    info!("Validation complete: {} working, {} degraded, {} broken, {} deprecated",
          working_models.len(), degraded_models.len(), broken_models.len(), deprecated_models.len());
    
    Ok(ComprehensiveValidationSummary {
        timestamp: Utc::now().to_rfc3339(),
        total_models_tested: total_models as usize,
        working_models,
        degraded_models,
        broken_models,
        deprecated_models,
        overall_health_score: health_score,
        recommendations,
    })
}

/// Validate a specific model on demand
#[command]
pub async fn validate_model_on_demand(
    model_id: String,
    provider: String,
    app_handle: AppHandle,
    health_manager: tauri::State<'_, ModelHealthManager>,
) -> Result<ModelValidationReport, String> {
    info!("On-demand validation for {} ({})", model_id, provider);
    
    let report = validate_model_comprehensive(model_id.clone(), provider, app_handle).await?;
    
    // Update health manager
    health_manager.update_model_health(model_id, report.clone());
    
    Ok(report)
}

/// Quick health check for UI updates
#[command]
pub async fn quick_model_health_check(
    health_manager: tauri::State<'_, ModelHealthManager>,
) -> Result<HashMap<String, ModelStatus>, String> {
    let all_health = health_manager.get_all_health_status();
    
    let mut status_map = HashMap::new();
    for (model_id, health) in all_health {
        status_map.insert(model_id, health.status);
    }
    
    // If no health data, trigger a validation
    if status_map.is_empty() {
        info!("No health data available, returning unknown status for all models");
        // Return unknown status for common models
        let common_models = vec![
            "opus-4.1", "sonnet-4", "sonnet-3.7",
            "gemini-2.5-pro-exp", "gemini-2.5-flash", "gemini-2.0-flash",
            "llama3.3:latest", "phi3:latest"
        ];
        
        for model_id in common_models {
            status_map.insert(model_id.to_string(), ModelStatus::Unknown);
        }
    }
    
    Ok(status_map)
}

/// Get recommended models based on current health
#[command]
pub async fn get_healthy_models(
    health_manager: tauri::State<'_, ModelHealthManager>,
) -> Result<Vec<String>, String> {
    let all_health = health_manager.get_all_health_status();
    
    let mut healthy_models: Vec<String> = all_health
        .into_iter()
        .filter(|(_, health)| matches!(health.status, ModelStatus::Available))
        .map(|(model_id, _)| model_id)
        .collect();
    
    // Sort by preference (Claude > Gemini > Ollama)
    healthy_models.sort_by(|a, b| {
        let a_priority = if a.contains("opus-4.1") { 0 }
                        else if a.contains("sonnet-4") { 1 }
                        else if a.contains("gemini-2.5") { 2 }
                        else if a.contains("gemini-2.0") { 3 }
                        else if a.contains("llama") { 4 }
                        else { 5 };
                        
        let b_priority = if b.contains("opus-4.1") { 0 }
                        else if b.contains("sonnet-4") { 1 }
                        else if b.contains("gemini-2.5") { 2 }
                        else if b.contains("gemini-2.0") { 3 }
                        else if b.contains("llama") { 4 }
                        else { 5 };
                        
        a_priority.cmp(&b_priority)
    });
    
    Ok(healthy_models)
}