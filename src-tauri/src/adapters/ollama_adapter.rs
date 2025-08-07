use async_trait::async_trait;
use log::{info, debug, warn};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::universal_tool_executor::{
    ModelAdapter, UniversalTool, ToolExecutionRequest, ToolExecutionResult, ToolType, ToolContext
};

/// Ollama-specific tool adapter with simulated tool support
pub struct OllamaToolAdapter {
    pub app_handle: AppHandle,
}

impl OllamaToolAdapter {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Create tool-aware system prompt for Ollama
    fn create_tool_aware_system_prompt(&self, tools: &[String]) -> String {
        let tool_list = tools.iter().map(|t| {
            if t.starts_with("mcp_") {
                format!("- MCP:{}", t.trim_start_matches("mcp_"))
            } else if t.starts_with("agent_") {
                format!("- AGENT:{}", t.trim_start_matches("agent_"))
            } else if t.starts_with("cmd_") {
                format!("- CMD:/{}", t.trim_start_matches("cmd_"))
            } else {
                format!("- {}", t)
            }
        }).collect::<Vec<_>>().join("\n");
        
        format!(
            "You are an AI assistant with access to external tools through Claudia.\n\
            Available tools:\n{}\n\n\
            To use a tool, format your request as:\n\
            {{TOOL:name}} description of what you need\n\
            Example: {{TOOL:MCP:context7}} Get React documentation\n\
            Example: {{TOOL:AGENT:code_reviewer}} Review this function\n\
            Example: {{TOOL:CMD:/analyze}} Analyze the codebase",
            tool_list
        )
    }

    /// Simulate MCP server execution for Ollama
    async fn simulate_mcp_for_ollama(&self, server_name: &str, params: HashMap<String, Value>, context: &ToolContext) -> Result<Value, String> {
        info!("Ollama simulating MCP server: {}", server_name);
        
        // Build context-aware response
        let context_info = format!(
            "MCP Server '{}' provides:\n\
            - Documentation and API references\n\
            - Code patterns and best practices\n\
            - Context-aware suggestions\n\
            Project: {}\n\
            Session: {}",
            server_name,
            context.project_path,
            context.session_id
        );
        
        // Emit event for UI feedback
        let event = json!({
            "type": "ollama_tool_simulation",
            "tool_type": "mcp_server",
            "server": server_name,
            "context": context_info,
            "session_id": context.session_id,
            "model": context.model_id
        });
        
        self.app_handle.emit("ollama-tool-event", event)
            .map_err(|e| format!("Failed to emit Ollama tool event: {}", e))?;
        
        Ok(json!({
            "simulated": true,
            "type": "mcp_server",
            "server": server_name,
            "context_enhancement": context_info,
            "integration": "ollama"
        }))
    }

    /// Simulate agent execution for Ollama
    async fn simulate_agent_for_ollama(&self, agent_name: &str, params: HashMap<String, Value>, context: &ToolContext) -> Result<Value, String> {
        info!("Ollama simulating agent: {}", agent_name);
        
        let task = params.get("task")
            .and_then(|v| v.as_str())
            .unwrap_or("general assistance");
        
        // Get agent capabilities
        let agent_db = self.app_handle.state::<crate::commands::agents::AgentDb>();
        let agents = agent_db.list_agents().unwrap_or_default();
        let agent = agents.iter().find(|a| a.name == agent_name);
        
        let capabilities = agent.map(|a| {
            let mut caps = Vec::new();
            if a.enable_file_read { caps.push("file reading"); }
            if a.enable_file_write { caps.push("file writing"); }
            if a.enable_network { caps.push("network access"); }
            caps.join(", ")
        }).unwrap_or_else(|| "standard capabilities".to_string());
        
        let agent_info = format!(
            "Agent '{}' executing:\n\
            Task: {}\n\
            Capabilities: {}\n\
            Model: {}\n\
            Working in: {}",
            agent_name,
            task,
            capabilities,
            agent.map(|a| &a.model).unwrap_or(&context.model_id),
            context.project_path
        );
        
        // Emit event
        let event = json!({
            "type": "ollama_tool_simulation",
            "tool_type": "agent",
            "agent": agent_name,
            "task": task,
            "info": agent_info,
            "session_id": context.session_id,
            "model": context.model_id
        });
        
        self.app_handle.emit("ollama-tool-event", event)
            .map_err(|e| format!("Failed to emit Ollama tool event: {}", e))?;
        
        Ok(json!({
            "simulated": true,
            "type": "agent",
            "agent": agent_name,
            "task": task,
            "capabilities": capabilities,
            "context_enhancement": agent_info,
            "integration": "ollama"
        }))
    }

    /// Simulate slash command for Ollama
    async fn simulate_slash_command_for_ollama(&self, command: &str, params: HashMap<String, Value>, context: &ToolContext) -> Result<Value, String> {
        info!("Ollama simulating slash command: /{}", command);
        
        let args = params.get("arguments")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        
        // Map common commands to actions
        let action = match command {
            "analyze" => "Analyzing code structure and patterns",
            "explain" => "Providing detailed explanation",
            "improve" => "Suggesting improvements and optimizations",
            "test" => "Generating test cases",
            "document" => "Creating documentation",
            _ => "Executing custom command"
        };
        
        let command_info = format!(
            "Command: /{} {}\n\
            Action: {}\n\
            Context: {}\n\
            Session: {}",
            command,
            args,
            action,
            context.project_path,
            context.session_id
        );
        
        // Emit event
        let event = json!({
            "type": "ollama_tool_simulation",
            "tool_type": "slash_command",
            "command": command,
            "arguments": args,
            "action": action,
            "info": command_info,
            "session_id": context.session_id,
            "model": context.model_id
        });
        
        self.app_handle.emit("ollama-tool-event", event)
            .map_err(|e| format!("Failed to emit Ollama tool event: {}", e))?;
        
        Ok(json!({
            "simulated": true,
            "type": "slash_command",
            "command": command,
            "arguments": args,
            "action": action,
            "context_enhancement": command_info,
            "integration": "ollama"
        }))
    }

    /// Parse tool requests from Ollama's response
    fn extract_tool_requests(&self, response: &str) -> Vec<(String, String, HashMap<String, Value>)> {
        let mut requests = Vec::new();
        
        // Look for {TOOL:name} patterns
        if let Ok(re) = regex::Regex::new(r"\{TOOL:([^}]+)\}") {
            for cap in re.captures_iter(response) {
                if let Some(tool_spec) = cap.get(1) {
                    let spec = tool_spec.as_str();
                    
                    // Parse tool type and name
                    if let Some(colon_pos) = spec.find(':') {
                        let tool_type = &spec[..colon_pos];
                        let tool_name = &spec[colon_pos + 1..];
                        
                        let full_name = match tool_type {
                            "MCP" => format!("mcp_{}", tool_name),
                            "AGENT" => format!("agent_{}", tool_name),
                            "CMD" => format!("cmd_{}", tool_name),
                            _ => tool_name.to_string(),
                        };
                        
                        requests.push((full_name, tool_type.to_string(), HashMap::new()));
                    } else {
                        requests.push((spec.to_string(), "generic".to_string(), HashMap::new()));
                    }
                }
            }
        }
        
        requests
    }
}

#[async_trait]
impl ModelAdapter for OllamaToolAdapter {
    fn provider_name(&self) -> String {
        "ollama".to_string()
    }

    fn supported_models(&self) -> Vec<String> {
        vec![
            // Popular Ollama models
            "llama2".to_string(),
            "llama2:7b".to_string(),
            "llama2:13b".to_string(),
            "llama2:70b".to_string(),
            "codellama".to_string(),
            "codellama:7b".to_string(),
            "codellama:13b".to_string(),
            "codellama:34b".to_string(),
            "mistral".to_string(),
            "mistral:7b".to_string(),
            "mixtral".to_string(),
            "mixtral:8x7b".to_string(),
            "deepseek-coder".to_string(),
            "deepseek-coder:6.7b".to_string(),
            "deepseek-coder:33b".to_string(),
            "phi".to_string(),
            "phi:2.7b".to_string(),
            "neural-chat".to_string(),
            "starling-lm".to_string(),
            "vicuna".to_string(),
            "orca-mini".to_string(),
            "qwen".to_string(),
            "starcoder".to_string(),
            "wizardcoder".to_string(),
        ]
    }

    async fn execute_tool(&self, tool: Arc<dyn UniversalTool>, request: ToolExecutionRequest, _app_handle: AppHandle) -> Result<ToolExecutionResult, String> {
        let start = Instant::now();
        debug!("Ollama adapter simulating tool: {} (type: {:?})", tool.name(), tool.tool_type());
        
        // Simulate based on tool type with Ollama-specific handling
        let tool_name = tool.name();
        let output = match tool.tool_type() {
            ToolType::MCPServer => {
                let server_name = tool_name.strip_prefix("mcp_").unwrap_or(&tool_name);
                self.simulate_mcp_for_ollama(server_name, request.parameters.clone(), &request.context).await?
            },
            ToolType::Agent => {
                let agent_name = tool_name.strip_prefix("agent_").unwrap_or(&tool_name);
                self.simulate_agent_for_ollama(agent_name, request.parameters.clone(), &request.context).await?
            },
            ToolType::SlashCommand => {
                let cmd_name = tool_name.strip_prefix("cmd_").unwrap_or(&tool_name);
                self.simulate_slash_command_for_ollama(cmd_name, request.parameters.clone(), &request.context).await?
            },
            _ => {
                // Generic tool simulation
                json!({
                    "simulated": true,
                    "tool": tool.name(),
                    "type": format!("{:?}", tool.tool_type()),
                    "model": request.context.model_id,
                    "integration": "ollama",
                    "note": "Tool simulated for Ollama model"
                })
            }
        };
        
        Ok(ToolExecutionResult {
            success: true,
            output,
            error: None,
            execution_time_ms: start.elapsed().as_millis() as u64,
            tokens_used: Some(50), // Lower estimate for local models
        })
    }

    async fn translate_prompt(&self, prompt: &str, tools: Vec<String>) -> String {
        if tools.is_empty() {
            prompt.to_string()
        } else {
            let system_prompt = self.create_tool_aware_system_prompt(&tools);
            
            format!(
                "### System Instructions ###\n{}\n\n\
                ### Available Tools ###\n\
                You can use these tools to enhance your capabilities:\n{}\n\n\
                ### How to Request Tools ###\n\
                Use the format {{TOOL:type:name}} when you need to use a tool.\n\
                Examples:\n\
                - {{TOOL:MCP:context7}} - Access documentation\n\
                - {{TOOL:AGENT:analyzer}} - Run code analysis\n\
                - {{TOOL:CMD:/improve}} - Improve code quality\n\n\
                ### User Request ###\n{}\n\n\
                ### Your Response ###\n\
                Provide a helpful response, using tools when beneficial.",
                system_prompt,
                tools.iter().map(|t| format!("• {}", t)).collect::<Vec<_>>().join("\n"),
                prompt
            )
        }
    }

    fn supports_native_tools(&self) -> bool {
        false // Ollama models don't have native tool support, we simulate it
    }
}