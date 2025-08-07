use async_trait::async_trait;
use log::{info, debug, error};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::universal_tool_executor::{
    ModelAdapter, UniversalTool, ToolExecutionRequest, ToolExecutionResult, ToolType
};
use crate::commands::mcp::{mcp_list, MCPServer};
use crate::commands::agents::{AgentDb};
// use crate::commands::slash_commands::execute_claude_slash_command; // Not needed for adapter simulation
use crate::commands::claude::execute_claude_code;

/// Claude-specific tool adapter with native tool support
pub struct ClaudeToolAdapter {
    pub app_handle: AppHandle,
}

impl ClaudeToolAdapter {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    async fn execute_mcp_server(&self, server_name: &str, params: HashMap<String, Value>, session_id: &str) -> Result<Value, String> {
        info!("Claude executing MCP server: {}", server_name);
        
        // Get MCP server configuration
        let servers = mcp_list(self.app_handle.clone()).await?;
        let server = servers.iter()
            .find(|s| s.name == server_name)
            .ok_or_else(|| format!("MCP server not found: {}", server_name))?;
        
        // Execute MCP command
        let command = params.get("command")
            .and_then(|v| v.as_str())
            .unwrap_or("default");
        
        let args: Vec<String> = params.get("args")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        
        // Emit MCP execution event
        let event = json!({
            "type": "mcp_execution",
            "server": server_name,
            "command": command,
            "session_id": session_id,
            "provider": "claude"
        });
        
        self.app_handle.emit("mcp-event", event)
            .map_err(|e| format!("Failed to emit MCP event: {}", e))?;
        
        Ok(json!({
            "status": "executed",
            "server": server_name,
            "command": command,
            "args": args
        }))
    }

    async fn execute_agent_tool(&self, agent_name: &str, params: HashMap<String, Value>, session_id: &str) -> Result<Value, String> {
        info!("Claude executing agent: {}", agent_name);
        
        let agent_db = self.app_handle.state::<AgentDb>();
        let agents = agent_db.list_agents()?;
        
        let agent = agents.iter()
            .find(|a| a.name == agent_name)
            .ok_or_else(|| format!("Agent not found: {}", agent_name))?;
        
        let default_task = agent.default_task.clone().unwrap_or_default();
        let task = params.get("task")
            .and_then(|v| v.as_str())
            .unwrap_or(&default_task);
        
        // Create agent run
        let run_id = agent_db.create_agent_run(
            agent.id.unwrap(),
            task.to_string(),
            params.get("project_path")
                .and_then(|v| v.as_str())
                .unwrap_or("./")
                .to_string(),
            session_id.to_string()
        )?;
        
        // Emit agent execution event
        let event = json!({
            "type": "agent_execution",
            "agent": agent_name,
            "task": task,
            "run_id": run_id,
            "session_id": session_id,
            "provider": "claude"
        });
        
        self.app_handle.emit("agent-event", event)
            .map_err(|e| format!("Failed to emit agent event: {}", e))?;
        
        Ok(json!({
            "status": "started",
            "agent": agent_name,
            "run_id": run_id,
            "task": task
        }))
    }

    async fn execute_slash_cmd(&self, command: &str, params: HashMap<String, Value>, session_id: &str) -> Result<Value, String> {
        info!("Claude executing slash command: /{}", command);
        
        let args = params.get("arguments")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        
        // Simulate slash command execution
        info!("Simulating Claude slash command execution: /{} with args: {}", command, args);
        
        // Emit slash command event
        let event = json!({
            "type": "slash_command",
            "command": command,
            "arguments": args,
            "session_id": session_id,
            "provider": "claude"
        });
        
        self.app_handle.emit("slash-command-event", event)
            .map_err(|e| format!("Failed to emit slash command event: {}", e))?;
        
        // Create simulated result
        let result = json!({
            "simulated": true,
            "success": true
        });
        
        Ok(json!({
            "status": "executed",
            "command": command,
            "result": result
        }))
    }
}

#[async_trait]
impl ModelAdapter for ClaudeToolAdapter {
    fn provider_name(&self) -> String {
        "claude".to_string()
    }

    fn supported_models(&self) -> Vec<String> {
        vec![
            "claude-3-opus-20240229".to_string(),
            "claude-3-sonnet-20240229".to_string(),
            "claude-3-haiku-20240307".to_string(),
            "claude-3.5-sonnet-20241022".to_string(),
            "claude-4-opus".to_string(),
            "claude-4-sonnet".to_string(),
            "claude-4.1-opus".to_string(),
            "opus".to_string(),
            "sonnet".to_string(),
            "haiku".to_string(),
        ]
    }

    async fn execute_tool(&self, tool: Arc<dyn UniversalTool>, request: ToolExecutionRequest, app_handle: AppHandle) -> Result<ToolExecutionResult, String> {
        debug!("Claude adapter executing tool: {} (type: {:?})", tool.name(), tool.tool_type());
        
        // Claude has native support, but we can enhance execution with specific handling
        let tool_name = tool.name();
        let result = match tool.tool_type() {
            ToolType::MCPServer => {
                let server_name = tool_name.strip_prefix("mcp_").unwrap_or(&tool_name);
                let output = self.execute_mcp_server(server_name, request.parameters.clone(), &request.context.session_id).await?;
                
                ToolExecutionResult {
                    success: true,
                    output,
                    error: None,
                    execution_time_ms: 100,
                    tokens_used: Some(150),
                }
            },
            ToolType::Agent => {
                let agent_name = tool_name.strip_prefix("agent_").unwrap_or(&tool_name);
                let output = self.execute_agent_tool(agent_name, request.parameters.clone(), &request.context.session_id).await?;
                
                ToolExecutionResult {
                    success: true,
                    output,
                    error: None,
                    execution_time_ms: 200,
                    tokens_used: Some(200),
                }
            },
            ToolType::SlashCommand => {
                let cmd_name = tool_name.strip_prefix("cmd_").unwrap_or(&tool_name);
                let output = self.execute_slash_cmd(cmd_name, request.parameters.clone(), &request.context.session_id).await?;
                
                ToolExecutionResult {
                    success: true,
                    output,
                    error: None,
                    execution_time_ms: 50,
                    tokens_used: Some(100),
                }
            },
            _ => {
                // Fallback to generic tool execution
                tool.execute(request.parameters, &request.context).await?
            }
        };
        
        Ok(result)
    }

    async fn translate_prompt(&self, prompt: &str, tools: Vec<String>) -> String {
        // Claude understands tools natively, minimal translation needed
        if tools.is_empty() {
            prompt.to_string()
        } else {
            format!(
                "{}\n\n<available_tools>\n{}\n</available_tools>",
                prompt,
                tools.iter().map(|t| format!("  - {}", t)).collect::<Vec<_>>().join("\n")
            )
        }
    }

    fn supports_native_tools(&self) -> bool {
        true // Claude has native tool support
    }
}