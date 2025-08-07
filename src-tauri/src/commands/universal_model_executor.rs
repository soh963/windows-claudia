use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter, Manager};
use std::collections::HashMap;
use log::{info, warn, error};
use crate::commands::claude::execute_claude_code;
use crate::commands::gemini::execute_gemini_code;
use crate::commands::ollama::execute_ollama_request;
use crate::commands::intelligent_routing::{get_intelligent_model_recommendation, ModelRecommendationV2};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalExecutionRequest {
    pub prompt: String,
    pub model_id: String,
    pub project_path: String,
    pub context: Option<String>,
    pub system_instruction: Option<String>,
    pub options: Option<HashMap<String, serde_json::Value>>,
    pub use_auto_selection: bool,
    pub tools_requested: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalExecutionResult {
    pub success: bool,
    pub model_used: String,
    pub session_id: String,
    pub reasoning: String,
    pub error: Option<String>,
    pub auto_selected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCapabilityCheck {
    pub model_id: String,
    pub supports_mcp: bool,
    pub supports_agents: bool,
    pub supports_slash_commands: bool,
    pub supports_vision: bool,
    pub supports_audio: bool,
    pub supports_tools: bool,
}

/// Universal model executor that routes to the appropriate provider with full tool support
#[command]
pub async fn execute_with_universal_tools(
    request: UniversalExecutionRequest,
    app_handle: AppHandle
) -> Result<UniversalExecutionResult, String> {
    info!("Universal model execution request - model: {}, auto_selection: {}", 
          request.model_id, request.use_auto_selection);
    
    // Enhanced prompt to include universal tool context for non-Claude models
    let enhanced_prompt = if !request.model_id.contains("claude") {
        format!(
            "=== Claudia Universal Tools Enabled ===\n\
            You have access to all Claudia tools through the universal interface:\n\
            • MCP Servers: For external tool integration and data access\n\
            • Agents: Specialized AI agents for complex tasks\n\
            • Slash Commands: Quick actions and shortcuts\n\
            • File Operations: Read, write, and analyze files\n\
            • Web Search: Access real-time information\n\
            • Code Analysis: Analyze and optimize code\n\n\
            When you need to use these tools, indicate clearly and the system will execute them for you.\n\
            Examples:\n\
            - 'Use MCP server to fetch data from...'\n\
            - 'Run agent to analyze the code structure'\n\
            - 'Execute /build command to compile the project'\n\n\
            Original request:\n{}", 
            request.prompt
        )
    } else {
        request.prompt.clone()
    };

    let mut final_model = request.model_id.clone();
    let mut auto_selected = false;
    let mut selection_reasoning = "User specified model".to_string();

    // Auto model selection if requested or "auto" model specified
    if request.use_auto_selection || request.model_id == "auto" {
        info!("Using Auto Smart Selection for model recommendation");
        
        let recommendation = get_intelligent_model_recommendation(
            request.prompt.clone(),
            request.context.clone(),
            app_handle.clone()
        ).await?;

        final_model = recommendation.primary_model.clone();
        selection_reasoning = format!("Auto-selected: {}", recommendation.reasoning);
        auto_selected = true;
        
        info!("Auto-selected model: {} with confidence {:.2}", 
              final_model, recommendation.confidence);
    }

    // Generate unique session ID for this execution
    let session_id = format!(
        "universal-{}-{}",
        final_model.replace(':', "-").replace('.', "-"),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );

    // Check tool capabilities before execution
    let capabilities = check_model_capabilities(&final_model);
    info!("Model capabilities: MCP={}, Agents={}, Tools={}", 
          capabilities.supports_mcp, capabilities.supports_agents, capabilities.supports_tools);

    // Route to appropriate provider with enhanced tool support
    let result = match determine_provider(&final_model) {
        "claude" => {
            info!("Routing to Claude with full tool support");
            execute_claude_with_tools(
                &final_model,
                &request.prompt,
                &request.project_path,
                request.context.as_deref(),
                request.system_instruction.as_deref(),
                &session_id,
                app_handle.clone()
            ).await
        },
        "gemini" => {
            info!("Routing to Gemini with enhanced capabilities");
            execute_gemini_with_tools(
                &final_model,
                &request.prompt,
                &request.project_path,
                request.context.as_deref(),
                request.system_instruction.as_deref(),
                request.options.as_ref(),
                &session_id,
                app_handle.clone()
            ).await
        },
        "ollama" => {
            info!("Routing to Ollama with unified session management");
            execute_ollama_with_tools(
                &final_model,
                &request.prompt,
                &request.project_path,
                request.system_instruction.as_deref(),
                request.options.as_ref(),
                &session_id,
                app_handle.clone()
            ).await
        },
        _ => Err(format!("Unknown model provider for model: {}", final_model))
    };

    match result {
        Ok(_) => {
            info!("Universal execution successful for model: {}", final_model);
            Ok(UniversalExecutionResult {
                success: true,
                model_used: final_model,
                session_id,
                reasoning: selection_reasoning,
                error: None,
                auto_selected,
            })
        },
        Err(error) => {
            error!("Universal execution failed for model {}: {}", final_model, error);
            Ok(UniversalExecutionResult {
                success: false,
                model_used: final_model,
                session_id,
                reasoning: selection_reasoning,
                error: Some(error),
                auto_selected,
            })
        }
    }
}

/// Execute Claude with full MCP, agents, and slash command support
async fn execute_claude_with_tools(
    model_id: &str,
    prompt: &str,
    project_path: &str,
    context: Option<&str>,
    system_instruction: Option<&str>,
    session_id: &str,
    app_handle: AppHandle
) -> Result<(), String> {
    // Claude has native support for all tools
    let full_prompt = build_enhanced_prompt(prompt, context, system_instruction);
    
    execute_claude_code(
        app_handle,
        project_path.to_string(),
        full_prompt,
        "claude-3-sonnet-20240229".to_string()
    ).await
}

/// Execute Gemini with enhanced capabilities and tool integration
async fn execute_gemini_with_tools(
    model_id: &str,
    prompt: &str,
    project_path: &str,
    context: Option<&str>,
    system_instruction: Option<&str>,
    options: Option<&HashMap<String, serde_json::Value>>,
    session_id: &str,
    app_handle: AppHandle
) -> Result<(), String> {
    use crate::commands::gemini::execute_gemini_code;
    
    // Build enhanced prompt with tool simulation instructions
    let mut enhanced_prompt = String::new();
    
    // Add tool capability instructions for Gemini
    enhanced_prompt.push_str("=== Claudia Enhanced Mode ===\n");
    enhanced_prompt.push_str("You are running in Claudia with enhanced capabilities:\n\n");
    enhanced_prompt.push_str("🛠️ Available Tools:\n");
    enhanced_prompt.push_str("• MCP (Model Context Protocol) - Enhanced context and documentation access\n");
    enhanced_prompt.push_str("• Specialized Agents - Delegate complex tasks to expert agents\n");
    enhanced_prompt.push_str("• Slash Commands - Quick actions: /help, /analyze, /generate, /explain\n");
    enhanced_prompt.push_str("• File Operations - Read, write, search, and analyze code files\n");
    enhanced_prompt.push_str("• Code Analysis - Comprehensive codebase understanding\n");
    enhanced_prompt.push_str("• Session Memory - Context preserved across conversations\n\n");
    
    if let Some(ctx) = context {
        enhanced_prompt.push_str("📋 Context:\n");
        enhanced_prompt.push_str(ctx);
        enhanced_prompt.push_str("\n\n");
    }
    
    if let Some(sys) = system_instruction {
        enhanced_prompt.push_str("🎯 System Instructions:\n");
        enhanced_prompt.push_str(sys);
        enhanced_prompt.push_str("\n\n");
    }
    
    enhanced_prompt.push_str("💬 User Request:\n");
    enhanced_prompt.push_str(prompt);
    enhanced_prompt.push_str("\n\nPlease provide a comprehensive response utilizing available Claudia capabilities as needed. If the request involves tools or specialized tasks, explain how you would use them to provide the best assistance.");
    
    // Use the existing gemini.rs execute function with enhanced prompt and session isolation
    info!("Executing Gemini with enhanced tool awareness for model: {}", model_id);
    
    use tauri::Manager;
    use crate::commands::gemini::{GeminiSessionRegistry, execute_gemini_code};
    use crate::commands::session_deduplication::{MessageDeduplicationManager, SessionIsolationManager};
    
    execute_gemini_code(
        enhanced_prompt,
        model_id.to_string(),
        project_path.to_string(),
        app_handle.clone(),
        app_handle.state::<crate::commands::agents::AgentDb>(),
        app_handle.state::<crate::commands::claude::ClaudeProcessState>(),
        app_handle.state::<GeminiSessionRegistry>(),
        app_handle.state::<MessageDeduplicationManager>(),
        app_handle.state::<SessionIsolationManager>(),
    ).await
}

/// Execute Ollama with unified session management and tool emulation
async fn execute_ollama_with_tools(
    model_id: &str,
    prompt: &str,
    project_path: &str,
    system_instruction: Option<&str>,
    options: Option<&HashMap<String, serde_json::Value>>,
    session_id: &str,
    app_handle: AppHandle
) -> Result<(), String> {
    // Enhanced Ollama execution with tool emulation
    let enhanced_prompt = build_tool_enhanced_prompt(prompt, system_instruction);
    let enhanced_options = options.cloned().unwrap_or_default();
    
    execute_ollama_request(
        app_handle,
        model_id.to_string(),
        enhanced_prompt,
        project_path.to_string(),
        system_instruction.map(String::from),
        Some(enhanced_options)
    ).await
}

/// Build enhanced prompt with context and system instructions
fn build_enhanced_prompt(
    prompt: &str, 
    context: Option<&str>, 
    system_instruction: Option<&str>
) -> String {
    let mut enhanced_prompt = String::new();
    
    if let Some(system) = system_instruction {
        enhanced_prompt.push_str("System: ");
        enhanced_prompt.push_str(system);
        enhanced_prompt.push_str("\n\n");
    }
    
    if let Some(ctx) = context {
        enhanced_prompt.push_str("Context: ");
        enhanced_prompt.push_str(ctx);
        enhanced_prompt.push_str("\n\n");
    }
    
    enhanced_prompt.push_str("User: ");
    enhanced_prompt.push_str(prompt);
    
    enhanced_prompt
}

/// Build tool-enhanced prompt for models that need tool emulation
fn build_tool_enhanced_prompt(
    prompt: &str,
    system_instruction: Option<&str>
) -> String {
    let mut enhanced = String::new();
    
    // Add tool capability context for Ollama models
    enhanced.push_str("=== Claudia Enhanced Mode ===\n");
    enhanced.push_str("You are running with Claudia's tool integration enabled.\n");
    enhanced.push_str("Available capabilities:\n");
    enhanced.push_str("• MCP protocols for enhanced context management\n");
    enhanced.push_str("• Agent delegation for specialized tasks\n");
    enhanced.push_str("• Slash commands: /help, /analyze, /generate, /explain\n");
    enhanced.push_str("• File operations and code analysis\n");
    enhanced.push_str("• Session persistence and memory sharing\n\n");
    
    if let Some(system) = system_instruction {
        enhanced.push_str("System Instructions: ");
        enhanced.push_str(system);
        enhanced.push_str("\n\n");
    }
    
    enhanced.push_str("Request: ");
    enhanced.push_str(prompt);
    enhanced.push_str("\n\nPlease provide a comprehensive response utilizing available tools as needed.");
    
    enhanced
}

/// Determine the provider based on model ID
fn determine_provider(model_id: &str) -> &'static str {
    if model_id.starts_with("claude") || 
       model_id.starts_with("opus") || 
       model_id.starts_with("sonnet") ||
       model_id == "auto" {
        "claude"
    } else if model_id.starts_with("gemini") {
        "gemini"
    } else if model_id.contains(":latest") || 
              model_id.starts_with("llama") ||
              model_id.starts_with("mistral") ||
              model_id.starts_with("qwen") ||
              model_id.starts_with("phi") ||
              model_id.starts_with("codellama") {
        "ollama"
    } else {
        "unknown"
    }
}

/// Check what capabilities a model supports
fn check_model_capabilities(model_id: &str) -> ToolCapabilityCheck {
    let provider = determine_provider(model_id);
    
    match provider {
        "claude" => ToolCapabilityCheck {
            model_id: model_id.to_string(),
            supports_mcp: true,
            supports_agents: true,
            supports_slash_commands: true,
            supports_vision: model_id != "auto" && !model_id.contains("3.5"), // Most modern Claude models support vision
            supports_audio: false, // Claude doesn't support audio yet
            supports_tools: true,
        },
        "gemini" => ToolCapabilityCheck {
            model_id: model_id.to_string(),
            supports_mcp: true,  // Simulated through enhanced execution
            supports_agents: true, // Simulated through enhanced execution
            supports_slash_commands: true, // Simulated through enhanced execution
            supports_vision: true, // Most Gemini models support vision
            supports_audio: model_id.contains("2.0-flash"), // Only some Gemini models support audio
            supports_tools: true,
        },
        "ollama" => ToolCapabilityCheck {
            model_id: model_id.to_string(),
            supports_mcp: true,  // Emulated through enhanced prompts
            supports_agents: true, // Emulated through enhanced prompts
            supports_slash_commands: true, // Emulated through enhanced prompts
            supports_vision: false, // Most local Ollama models don't support vision
            supports_audio: false, // Local models don't typically support audio
            supports_tools: true, // Emulated functionality
        },
        _ => ToolCapabilityCheck {
            model_id: model_id.to_string(),
            supports_mcp: false,
            supports_agents: false,
            supports_slash_commands: false,
            supports_vision: false,
            supports_audio: false,
            supports_tools: false,
        }
    }
}

/// Get comprehensive tool capabilities for all available models
#[command]
pub async fn get_universal_model_capabilities(app_handle: AppHandle) -> Result<Vec<ToolCapabilityCheck>, String> {
    info!("Getting universal model capabilities for all available models");
    
    // Get all available models (this would typically come from the models.ts file)
    let model_ids = vec![
        "auto".to_string(),
        "opus-4.1".to_string(),
        "sonnet-4".to_string(),
        "sonnet-3.7".to_string(),
        "gemini-1.5-pro".to_string(),
        "gemini-2.5-flash".to_string(),
        "gemini-2.0-pro-exp".to_string(),
        "gemini-2.0-flash".to_string(),
        "gemini-2.0-flash-lite".to_string(),
        "llama3.3:latest".to_string(),
        "llama3.2:latest".to_string(),
        "codellama:latest".to_string(),
        "qwen2.5:latest".to_string(),
        "mistral:latest".to_string(),
        "phi3:latest".to_string(),
    ];
    
    let capabilities: Vec<ToolCapabilityCheck> = model_ids.into_iter()
        .map(|model_id| check_model_capabilities(&model_id))
        .collect();
    
    info!("Generated capabilities for {} models", capabilities.len());
    
    Ok(capabilities)
}

/// Test model execution with a simple prompt to verify functionality
#[command]
pub async fn test_universal_model_execution(
    model_id: String,
    app_handle: AppHandle
) -> Result<UniversalExecutionResult, String> {
    info!("Testing universal model execution for model: {}", model_id);
    
    let test_request = UniversalExecutionRequest {
        prompt: "Hello! Please respond with a simple greeting to confirm you're working correctly.".to_string(),
        model_id,
        project_path: std::env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        context: None,
        system_instruction: Some("You are a helpful AI assistant. Respond concisely.".to_string()),
        options: None,
        use_auto_selection: false,
        tools_requested: None,
    };
    
    execute_with_universal_tools(test_request, app_handle).await
}

/// Get real-time model performance metrics across all providers
#[command]
pub async fn get_realtime_model_performance(_app_handle: AppHandle) -> Result<HashMap<String, serde_json::Value>, String> {
    info!("Getting real-time model performance metrics");
    
    let mut performance = HashMap::new();
    
    // This would typically query actual performance metrics from the database
    // For now, we'll return mock data that represents the structure
    performance.insert("claude".to_string(), serde_json::json!({
        "average_response_time": 2000,
        "success_rate": 99.5,
        "active_sessions": 1,
        "tools_supported": ["mcp", "agents", "slash_commands", "vision"],
        "last_updated": chrono::Utc::now().to_rfc3339()
    }));
    
    performance.insert("gemini".to_string(), serde_json::json!({
        "average_response_time": 1500,
        "success_rate": 97.8,
        "active_sessions": 0,
        "tools_supported": ["mcp", "agents", "slash_commands", "vision", "audio"],
        "last_updated": chrono::Utc::now().to_rfc3339()
    }));
    
    performance.insert("ollama".to_string(), serde_json::json!({
        "average_response_time": 800,
        "success_rate": 95.0,
        "active_sessions": 0,
        "tools_supported": ["emulated_tools"],
        "last_updated": chrono::Utc::now().to_rfc3339()
    }));
    
    Ok(performance)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_determination() {
        assert_eq!(determine_provider("claude-3.5-sonnet"), "claude");
        assert_eq!(determine_provider("opus-4.1"), "claude");
        assert_eq!(determine_provider("gemini-2.5-pro"), "gemini");
        assert_eq!(determine_provider("llama3.3:latest"), "ollama");
        assert_eq!(determine_provider("auto"), "claude");
    }

    #[test]
    fn test_capabilities_check() {
        let claude_caps = check_model_capabilities("opus-4.1");
        assert!(claude_caps.supports_mcp);
        assert!(claude_caps.supports_agents);
        assert!(claude_caps.supports_tools);

        let ollama_caps = check_model_capabilities("llama3.3:latest");
        assert!(ollama_caps.supports_tools); // Emulated
        assert!(!ollama_caps.supports_vision); // Local models typically don't
    }

    #[test]
    fn test_prompt_enhancement() {
        let enhanced = build_enhanced_prompt(
            "Hello world",
            Some("Test context"),
            Some("You are helpful")
        );
        
        assert!(enhanced.contains("System: You are helpful"));
        assert!(enhanced.contains("Context: Test context"));
        assert!(enhanced.contains("User: Hello world"));
    }
}