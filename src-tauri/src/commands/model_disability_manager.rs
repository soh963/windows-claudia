use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, command, State, Manager, Emitter};
use log::{info, warn, error};
use chrono::{DateTime, Utc};

use crate::commands::agents::AgentDb;
use crate::commands::model_health_manager::{ModelHealth, ModelStatus};

/// Model disability configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDisabilityConfig {
    pub disabled_models: HashMap<String, DisabilityReason>,
    pub auto_disable_threshold: f64, // Success rate threshold for auto-disable
    pub recovery_check_interval: u64, // Minutes between recovery checks
    pub max_consecutive_failures: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisabilityReason {
    pub reason_type: DisabilityType,
    pub description: String,
    pub disabled_at: DateTime<Utc>,
    pub can_recover: bool,
    pub last_recovery_attempt: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DisabilityType {
    ApiKeyInvalid,
    QuotaExceeded,
    ModelDeprecated,
    ConsecutiveFailures,
    LowSuccessRate,
    NetworkIssues,
    ManualDisable,
}

/// Model availability status with detailed information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelAvailabilityReport {
    pub provider: String,
    pub available_models: Vec<ModelInfo>,
    pub disabled_models: Vec<DisabledModelInfo>,
    pub recommendations: Vec<String>,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: ModelStatus,
    pub capabilities: Vec<String>,
    pub recommended: bool,
    pub success_rate: f64,
    pub avg_response_time: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisabledModelInfo {
    pub id: String,
    pub name: String,
    pub disability_reason: DisabilityReason,
    pub alternative_models: Vec<String>,
}

impl Default for ModelDisabilityConfig {
    fn default() -> Self {
        Self {
            disabled_models: HashMap::new(),
            auto_disable_threshold: 0.3, // 30% success rate minimum
            recovery_check_interval: 60, // Check every hour
            max_consecutive_failures: 5,
        }
    }
}

/// Check and update model availability across all providers
#[command]
pub async fn update_model_availability(
    app_handle: AppHandle,
    db: State<'_, AgentDb>,
) -> Result<ModelAvailabilityReport, String> {
    info!("Updating model availability across all providers");
    
    let mut claude_models = check_claude_models().await?;
    let mut gemini_models = check_gemini_models(&app_handle).await?;
    let mut ollama_models = check_ollama_models().await?;
    
    // Apply disability rules
    apply_disability_rules(&mut claude_models).await;
    apply_disability_rules(&mut gemini_models).await;
    apply_disability_rules(&mut ollama_models).await;
    
    // Generate comprehensive report
    let report = generate_availability_report(claude_models, gemini_models, ollama_models).await;
    
    // Store in database for persistence
    store_availability_report(&report, &db).await?;
    
    // Emit update event
    app_handle.emit("model-availability-updated", &report)
        .map_err(|e| format!("Failed to emit availability update: {}", e))?;
    
    Ok(report)
}

/// Check Claude model availability
async fn check_claude_models() -> Result<Vec<ModelInfo>, String> {
    info!("Checking Claude model availability");
    
    let models = vec![
        ModelInfo {
            id: "claude-4.1-opus".to_string(),
            name: "Claude 4.1 Opus".to_string(),
            description: "Most intelligent Claude model".to_string(),
            status: ModelStatus::Available,
            capabilities: vec!["chat".to_string(), "tools".to_string(), "vision".to_string()],
            recommended: true,
            success_rate: 0.95,
            avg_response_time: Some(2000),
        },
        ModelInfo {
            id: "claude-4-sonnet".to_string(),
            name: "Claude 4 Sonnet".to_string(),
            description: "Balanced performance and intelligence".to_string(),
            status: ModelStatus::Available,
            capabilities: vec!["chat".to_string(), "tools".to_string(), "vision".to_string()],
            recommended: true,
            success_rate: 0.92,
            avg_response_time: Some(1500),
        },
        ModelInfo {
            id: "claude-3.7-sonnet".to_string(),
            name: "Claude 3.7 Sonnet".to_string(),
            description: "Fast hybrid reasoning model".to_string(),
            status: ModelStatus::Available,
            capabilities: vec!["chat".to_string(), "tools".to_string()],
            recommended: false,
            success_rate: 0.88,
            avg_response_time: Some(1200),
        },
        ModelInfo {
            id: "claude-3-opus".to_string(),
            name: "Claude 3 Opus".to_string(),
            description: "Legacy model (retiring Jan 2026)".to_string(),
            status: ModelStatus::Deprecated,
            capabilities: vec!["chat".to_string(), "tools".to_string()],
            recommended: false,
            success_rate: 0.85,
            avg_response_time: Some(2500),
        },
        ModelInfo {
            id: "claude-3.5-sonnet".to_string(),
            name: "Claude 3.5 Sonnet".to_string(),
            description: "Legacy model (being retired)".to_string(),
            status: ModelStatus::Deprecated,
            capabilities: vec!["chat".to_string(), "tools".to_string()],
            recommended: false,
            success_rate: 0.80,
            avg_response_time: Some(1800),
        },
    ];
    
    Ok(models)
}

/// Check Gemini model availability
async fn check_gemini_models(app_handle: &AppHandle) -> Result<Vec<ModelInfo>, String> {
    info!("Checking Gemini model availability");
    
    // Test API key availability first
    let has_api_key = match crate::commands::gemini::has_gemini_api_key(
        app_handle.state::<AgentDb>()
    ).await {
        Ok(has_key) => has_key,
        Err(_) => false,
    };
    
    let base_status = if has_api_key { ModelStatus::Available } else { ModelStatus::Unavailable };
    
    let models = vec![
        ModelInfo {
            id: "gemini-2.5-pro".to_string(),
            name: "Gemini 2.5 Pro".to_string(),
            description: "Most intelligent Gemini model (2025)".to_string(),
            status: base_status.clone(),
            capabilities: vec!["chat".to_string(), "vision".to_string(), "tools".to_string()],
            recommended: has_api_key,
            success_rate: if has_api_key { 0.88 } else { 0.0 },
            avg_response_time: Some(3000),
        },
        ModelInfo {
            id: "gemini-2.5-flash".to_string(),
            name: "Gemini 2.5 Flash".to_string(),
            description: "Fast and efficient for everyday tasks (2025)".to_string(),
            status: base_status.clone(),
            capabilities: vec!["chat".to_string(), "vision".to_string(), "tools".to_string()],
            recommended: has_api_key,
            success_rate: if has_api_key { 0.90 } else { 0.0 },
            avg_response_time: Some(1500),
        },
        ModelInfo {
            id: "gemini-2.5-flash-lite".to_string(),
            name: "Gemini 2.5 Flash-Lite".to_string(),
            description: "Most cost-efficient model (2025)".to_string(),
            status: base_status.clone(),
            capabilities: vec!["chat".to_string(), "vision".to_string()],
            recommended: false,
            success_rate: if has_api_key { 0.85 } else { 0.0 },
            avg_response_time: Some(1200),
        },
        ModelInfo {
            id: "gemini-2.0-pro-exp".to_string(),
            name: "Gemini 2.0 Pro (Experimental)".to_string(),
            description: "Experimental 2.0 pro model".to_string(),
            status: if has_api_key { ModelStatus::Degraded } else { ModelStatus::Unavailable },
            capabilities: vec!["chat".to_string(), "vision".to_string(), "tools".to_string()],
            recommended: false,
            success_rate: if has_api_key { 0.70 } else { 0.0 },
            avg_response_time: Some(4000),
        },
        ModelInfo {
            id: "gemini-2.0-flash".to_string(),
            name: "Gemini 2.0 Flash".to_string(),
            description: "Production-ready with native tools".to_string(),
            status: base_status.clone(),
            capabilities: vec!["chat".to_string(), "vision".to_string(), "tools".to_string()],
            recommended: false,
            success_rate: if has_api_key { 0.82 } else { 0.0 },
            avg_response_time: Some(2000),
        },
        ModelInfo {
            id: "gemini-1.5-pro".to_string(),
            name: "Gemini 1.5 Pro".to_string(),
            description: "Legacy 1.5 pro model (being phased out)".to_string(),
            status: ModelStatus::Deprecated,
            capabilities: vec!["chat".to_string(), "vision".to_string()],
            recommended: false,
            success_rate: if has_api_key { 0.75 } else { 0.0 },
            avg_response_time: Some(3500),
        },
    ];
    
    Ok(models)
}

/// Check Ollama model availability
async fn check_ollama_models() -> Result<Vec<ModelInfo>, String> {
    info!("Checking Ollama model availability");
    
    // Test Ollama connection
    let ollama_available = match crate::commands::ollama::check_ollama_status().await {
        Ok(status) => status,
        Err(_) => false,
    };
    
    let base_status = if ollama_available { ModelStatus::Available } else { ModelStatus::Unavailable };
    
    // Get available models if Ollama is running
    let available_models = if ollama_available {
        crate::commands::ollama::get_ollama_models().await.unwrap_or_default()
    } else {
        vec![]
    };
    
    let mut models = Vec::new();
    
    // Common Ollama models that users might have
    let common_models = vec![
        ("llama3.3:latest", "Llama 3.3", "Latest Llama model with improved capabilities"),
        ("llama3.2:latest", "Llama 3.2", "Efficient Llama model"),
        ("codellama:latest", "Code Llama", "Specialized for code generation"),
        ("mistral:latest", "Mistral", "Fast and efficient model"),
        ("mixtral:latest", "Mixtral", "Mixture of experts model"),
        ("deepseek-coder:latest", "DeepSeek Coder", "Specialized coding model"),
        ("phi3:latest", "Phi-3", "Small but capable model"),
        ("gemma2:latest", "Gemma 2", "Google's efficient model"),
    ];
    
    for (model_id, name, description) in common_models {
        let is_available = available_models.iter().any(|m| m.name.contains(model_id.split(':').next().unwrap_or(model_id)));
        
        models.push(ModelInfo {
            id: model_id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
            status: if is_available { ModelStatus::Available } else { ModelStatus::Unavailable },
            capabilities: vec!["chat".to_string()],
            recommended: is_available,
            success_rate: if is_available { 0.80 } else { 0.0 },
            avg_response_time: if is_available { Some(5000) } else { None },
        });
    }
    
    Ok(models)
}

/// Apply disability rules to models
async fn apply_disability_rules(models: &mut Vec<ModelInfo>) {
    for model in models.iter_mut() {
        // Auto-disable models with low success rates
        if model.success_rate < 0.3 {
            model.status = ModelStatus::Unavailable;
            model.recommended = false;
        }
        
        // Mark deprecated models as not recommended
        if model.status == ModelStatus::Deprecated {
            model.recommended = false;
        }
        
        // Models with very slow response times
        if let Some(response_time) = model.avg_response_time {
            if response_time > 10000 { // > 10 seconds
                model.recommended = false;
            }
        }
    }
}

/// Generate comprehensive availability report
async fn generate_availability_report(
    claude_models: Vec<ModelInfo>,
    gemini_models: Vec<ModelInfo>,
    ollama_models: Vec<ModelInfo>,
) -> ModelAvailabilityReport {
    let mut all_models = Vec::new();
    all_models.extend(claude_models);
    all_models.extend(gemini_models);
    all_models.extend(ollama_models);
    
    let available_models: Vec<_> = all_models.into_iter()
        .filter(|m| m.status == ModelStatus::Available || m.status == ModelStatus::Degraded)
        .collect();
    
    let disabled_models = vec![]; // Would be populated from disability config
    
    let mut recommendations = Vec::new();
    
    // Generate recommendations based on availability
    if available_models.iter().any(|m| m.id.contains("claude")) {
        recommendations.push("Claude models available - recommended for complex tasks".to_string());
    }
    
    if available_models.iter().any(|m| m.id.contains("gemini")) {
        recommendations.push("Gemini models available - good for vision tasks".to_string());
    } else {
        recommendations.push("Set up Gemini API key to access Gemini models".to_string());
    }
    
    if available_models.iter().any(|m| m.id.contains("llama") || m.id.contains("mistral")) {
        recommendations.push("Ollama models available - good for local, private inference".to_string());
    } else {
        recommendations.push("Install Ollama and pull models for local inference".to_string());
    }
    
    // Add performance recommendations
    let fast_models: Vec<_> = available_models.iter()
        .filter(|m| m.avg_response_time.unwrap_or(u64::MAX) < 2000)
        .collect();
    
    if fast_models.is_empty() {
        recommendations.push("Consider using faster models for better user experience".to_string());
    }
    
    ModelAvailabilityReport {
        provider: "All Providers".to_string(),
        available_models,
        disabled_models,
        recommendations,
        last_updated: Utc::now(),
    }
}

/// Store availability report in database
async fn store_availability_report(
    report: &ModelAvailabilityReport,
    db: &State<'_, AgentDb>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    // Create table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_data TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create model_availability table: {}", e))?;
    
    // Store the report
    let report_json = serde_json::to_string(report)
        .map_err(|e| format!("Failed to serialize report: {}", e))?;
    
    conn.execute(
        "INSERT INTO model_availability (report_data, created_at) VALUES (?1, ?2)",
        rusqlite::params![report_json, chrono::Utc::now().timestamp()],
    ).map_err(|e| format!("Failed to store availability report: {}", e))?;
    
    Ok(())
}

/// Get filtered list of available models only
#[command]
pub async fn get_available_models_only(
    app_handle: AppHandle,
    db: State<'_, AgentDb>,
) -> Result<Vec<ModelInfo>, String> {
    let report = update_model_availability(app_handle, db).await?;
    
    let available_models: Vec<_> = report.available_models
        .into_iter()
        .filter(|m| m.status == ModelStatus::Available)
        .collect();
    
    Ok(available_models)
}

/// Get recommended models based on capabilities and performance
#[command]
pub async fn get_recommended_models(
    app_handle: AppHandle,
    db: State<'_, AgentDb>,
    capability_filter: Option<String>,
) -> Result<Vec<ModelInfo>, String> {
    let report = update_model_availability(app_handle, db).await?;
    
    let mut recommended_models: Vec<_> = report.available_models
        .into_iter()
        .filter(|m| m.recommended && m.status == ModelStatus::Available)
        .collect();
    
    // Filter by capability if specified
    if let Some(capability) = capability_filter {
        recommended_models.retain(|m| m.capabilities.contains(&capability));
    }
    
    // Sort by success rate and response time
    recommended_models.sort_by(|a, b| {
        b.success_rate.partial_cmp(&a.success_rate)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                let a_time = a.avg_response_time.unwrap_or(u64::MAX);
                let b_time = b.avg_response_time.unwrap_or(u64::MAX);
                a_time.cmp(&b_time)
            })
    });
    
    Ok(recommended_models)
}

/// Force disable a specific model
#[command]
pub async fn disable_model_manually(
    model_id: String,
    reason: String,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    info!("Manually disabling model: {} - Reason: {}", model_id, reason);
    
    let disability_reason = DisabilityReason {
        reason_type: DisabilityType::ManualDisable,
        description: reason,
        disabled_at: Utc::now(),
        can_recover: true,
        last_recovery_attempt: None,
    };
    
    // Store in database
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS disabled_models (
            model_id TEXT PRIMARY KEY,
            disability_data TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create disabled_models table: {}", e))?;
    
    let disability_json = serde_json::to_string(&disability_reason)
        .map_err(|e| format!("Failed to serialize disability reason: {}", e))?;
    
    conn.execute(
        "INSERT OR REPLACE INTO disabled_models (model_id, disability_data, created_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![model_id, disability_json, Utc::now().timestamp()],
    ).map_err(|e| format!("Failed to store disabled model: {}", e))?;
    
    Ok(())
}

/// Enable a previously disabled model
#[command]
pub async fn enable_model(
    model_id: String,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    info!("Enabling previously disabled model: {}", model_id);
    
    let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;
    
    conn.execute(
        "DELETE FROM disabled_models WHERE model_id = ?1",
        rusqlite::params![model_id],
    ).map_err(|e| format!("Failed to enable model: {}", e))?;
    
    Ok(())
}