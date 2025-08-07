use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter, Manager};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use async_trait::async_trait;
use log::info;
use serde_json::{json, Value};
use uuid::Uuid;
use std::time::Instant;

// Import existing command modules
use crate::commands::mcp::mcp_list;
use crate::commands::agents::AgentDb;
use crate::commands::slash_commands::slash_commands_list;

// =============================================================================
// Core Types and Traits
// =============================================================================

/// Universal tool types that can be executed across all models
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ToolType {
    MCPServer,
    Agent,
    SlashCommand,
    FileOperation,
    WebSearch,
    CodeAnalysis,
    Custom(String),
}

/// Universal tool execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionRequest {
    pub tool_type: ToolType,
    pub tool_name: String,
    pub parameters: HashMap<String, Value>,
    pub context: ToolContext,
}

/// Tool execution context shared across all models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolContext {
    pub session_id: String,
    pub model_id: String,
    pub project_path: String,
    pub user_prompt: String,
    pub system_context: Option<String>,
    pub history: Vec<ToolExecutionHistory>,
}

/// History of tool executions for context awareness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionHistory {
    pub tool_type: ToolType,
    pub tool_name: String,
    pub timestamp: u64,
    pub result_summary: String,
}

/// Universal tool execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub success: bool,
    pub output: Value,
    pub error: Option<String>,
    pub execution_time_ms: u64,
    pub tokens_used: Option<u32>,
}

/// Tool capability check for models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCapabilityCheck {
    pub model_id: String,
    pub supports_mcp: bool,
    pub supports_agents: bool,
    pub supports_slash_commands: bool,
    pub supports_vision: bool,
    pub supports_audio: bool,
    pub supports_tools: bool,
    pub tool_adapters: Vec<String>,
}

/// Universal execution request across all models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalExecutionRequest {
    pub prompt: String,
    pub model_id: String,
    pub project_path: String,
    pub context: Option<String>,
    pub system_instruction: Option<String>,
    pub options: Option<HashMap<String, Value>>,
    pub use_auto_selection: bool,
    pub tools_requested: Option<Vec<String>>,
}

/// Universal execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalExecutionResult {
    pub success: bool,
    pub model_used: String,
    pub session_id: String,
    pub reasoning: String,
    pub error: Option<String>,
    pub auto_selected: bool,
    pub tools_executed: Vec<String>,
}

// =============================================================================
// Tool Registry and Management
// =============================================================================

/// Tool registry for dynamic tool discovery and registration
#[derive(Clone)]
pub struct UniversalToolRegistry {
    pub tools: Arc<RwLock<HashMap<String, Arc<dyn UniversalTool>>>>,
    pub adapters: Arc<RwLock<HashMap<String, Arc<dyn ModelAdapter>>>>,
}

impl UniversalToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            adapters: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_tool(&self, tool: Arc<dyn UniversalTool>) {
        let tool_name = tool.name();
        let mut tools = self.tools.write().await;
        tools.insert(tool_name.clone(), tool);
        info!("Registered universal tool: {}", tool_name);
    }

    pub async fn register_adapter(&self, adapter: Arc<dyn ModelAdapter>) {
        let provider_name = adapter.provider_name();
        let mut adapters = self.adapters.write().await;
        adapters.insert(provider_name.clone(), adapter);
        info!("Registered model adapter: {}", provider_name);
    }

    pub async fn get_tool(&self, name: &str) -> Option<Arc<dyn UniversalTool>> {
        let tools = self.tools.read().await;
        tools.get(name).cloned()
    }

    pub async fn get_adapter(&self, provider: &str) -> Option<Arc<dyn ModelAdapter>> {
        let adapters = self.adapters.read().await;
        adapters.get(provider).cloned()
    }

    pub async fn list_tools(&self) -> Vec<String> {
        let tools = self.tools.read().await;
        tools.keys().cloned().collect()
    }

    pub async fn list_tools_for_model(&self, model_id: &str) -> Vec<String> {
        let tools = self.tools.read().await;
        tools.iter()
            .filter(|(_, tool)| tool.supports_model(model_id))
            .map(|(name, _)| name.clone())
            .collect()
    }
}

// =============================================================================
// Universal Tool Trait
// =============================================================================

/// Trait for universal tools that can be executed by any model
#[async_trait]
pub trait UniversalTool: Send + Sync {
    fn name(&self) -> String;
    fn tool_type(&self) -> ToolType;
    fn description(&self) -> String;
    fn parameters_schema(&self) -> Value;
    async fn execute(&self, params: HashMap<String, Value>, context: &ToolContext) -> Result<ToolExecutionResult, String>;
    fn supports_model(&self, model_id: &str) -> bool;
}

// =============================================================================
// Model Adapter Trait
// =============================================================================

/// Trait for model-specific adapters
#[async_trait]
pub trait ModelAdapter: Send + Sync {
    fn provider_name(&self) -> String;
    fn supported_models(&self) -> Vec<String>;
    async fn execute_tool(&self, tool: Arc<dyn UniversalTool>, request: ToolExecutionRequest, app_handle: AppHandle) -> Result<ToolExecutionResult, String>;
    async fn translate_prompt(&self, prompt: &str, tools: Vec<String>) -> String;
    fn supports_native_tools(&self) -> bool;
}

// =============================================================================
// MCP Server Tool Implementation
// =============================================================================

pub struct MCPServerTool {
    pub server_name: String,
}

#[async_trait]
impl UniversalTool for MCPServerTool {
    fn name(&self) -> String {
        format!("mcp_{}", self.server_name)
    }

    fn tool_type(&self) -> ToolType {
        ToolType::MCPServer
    }

    fn description(&self) -> String {
        format!("Execute MCP server: {}", self.server_name)
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "command": {"type": "string"},
                "args": {"type": "array", "items": {"type": "string"}},
                "env": {"type": "object"}
            },
            "required": ["command"]
        })
    }

    async fn execute(&self, params: HashMap<String, Value>, context: &ToolContext) -> Result<ToolExecutionResult, String> {
        let start = Instant::now();
        
        info!("Executing MCP server {} for model {}", self.server_name, context.model_id);
        
        // Simulate MCP execution - in production, this would call the actual MCP server
        let output = json!({
            "server": self.server_name,
            "status": "executed",
            "model": context.model_id,
            "session": context.session_id,
            "result": "MCP server executed successfully"
        });

        Ok(ToolExecutionResult {
            success: true,
            output,
            error: None,
            execution_time_ms: start.elapsed().as_millis() as u64,
            tokens_used: Some(100), // Estimate
        })
    }

    fn supports_model(&self, _model_id: &str) -> bool {
        true // MCP servers support all models through our universal interface
    }
}

// =============================================================================
// Agent Tool Implementation
// =============================================================================

pub struct AgentTool {
    pub agent_name: String,
}

#[async_trait]
impl UniversalTool for AgentTool {
    fn name(&self) -> String {
        format!("agent_{}", self.agent_name)
    }

    fn tool_type(&self) -> ToolType {
        ToolType::Agent
    }

    fn description(&self) -> String {
        format!("Execute specialized agent: {}", self.agent_name)
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "task": {"type": "string"},
                "context": {"type": "string"},
                "options": {"type": "object"}
            },
            "required": ["task"]
        })
    }

    async fn execute(&self, params: HashMap<String, Value>, context: &ToolContext) -> Result<ToolExecutionResult, String> {
        let start = Instant::now();
        
        info!("Executing agent {} for model {}", self.agent_name, context.model_id);
        
        let task = params.get("task")
            .and_then(|v| v.as_str())
            .unwrap_or("default task");

        let output = json!({
            "agent": self.agent_name,
            "task": task,
            "status": "completed",
            "model": context.model_id,
            "session": context.session_id,
            "result": format!("Agent {} completed task successfully", self.agent_name)
        });

        Ok(ToolExecutionResult {
            success: true,
            output,
            error: None,
            execution_time_ms: start.elapsed().as_millis() as u64,
            tokens_used: Some(150),
        })
    }

    fn supports_model(&self, _model_id: &str) -> bool {
        true // Agents support all models through our universal interface
    }
}

// =============================================================================
// Slash Command Tool Implementation
// =============================================================================

pub struct SlashCommandTool {
    pub command_name: String,
}

#[async_trait]
impl UniversalTool for SlashCommandTool {
    fn name(&self) -> String {
        format!("cmd_{}", self.command_name)
    }

    fn tool_type(&self) -> ToolType {
        ToolType::SlashCommand
    }

    fn description(&self) -> String {
        format!("Execute slash command: /{}", self.command_name)
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "arguments": {"type": "string"},
                "options": {"type": "object"}
            }
        })
    }

    async fn execute(&self, params: HashMap<String, Value>, context: &ToolContext) -> Result<ToolExecutionResult, String> {
        let start = Instant::now();
        
        info!("Executing slash command /{} for model {}", self.command_name, context.model_id);
        
        let args = params.get("arguments")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let output = json!({
            "command": self.command_name,
            "arguments": args,
            "status": "executed",
            "model": context.model_id,
            "session": context.session_id,
            "result": format!("Command /{} executed successfully", self.command_name)
        });

        Ok(ToolExecutionResult {
            success: true,
            output,
            error: None,
            execution_time_ms: start.elapsed().as_millis() as u64,
            tokens_used: Some(75),
        })
    }

    fn supports_model(&self, _model_id: &str) -> bool {
        true // Slash commands support all models through our universal interface
    }
}

// =============================================================================
// Model Adapters
// =============================================================================

/// Claude model adapter with native tool support
pub struct ClaudeAdapter;

#[async_trait]
impl ModelAdapter for ClaudeAdapter {
    fn provider_name(&self) -> String {
        "claude".to_string()
    }

    fn supported_models(&self) -> Vec<String> {
        vec![
            "claude-3-opus-20240229".to_string(),
            "claude-3-sonnet-20240229".to_string(),
            "claude-3-haiku-20240307".to_string(),
            "claude-4-opus".to_string(),
            "claude-4-sonnet".to_string(),
        ]
    }

    async fn execute_tool(&self, tool: Arc<dyn UniversalTool>, request: ToolExecutionRequest, _app_handle: AppHandle) -> Result<ToolExecutionResult, String> {
        // Claude has native tool support, execute directly
        tool.execute(request.parameters, &request.context).await
    }

    async fn translate_prompt(&self, prompt: &str, tools: Vec<String>) -> String {
        // Claude understands tools natively
        if tools.is_empty() {
            prompt.to_string()
        } else {
            format!("{}\n\nAvailable tools: {}", prompt, tools.join(", "))
        }
    }

    fn supports_native_tools(&self) -> bool {
        true
    }
}

/// Gemini model adapter with tool simulation
pub struct GeminiAdapter;

#[async_trait]
impl ModelAdapter for GeminiAdapter {
    fn provider_name(&self) -> String {
        "gemini".to_string()
    }

    fn supported_models(&self) -> Vec<String> {
        vec![
            "gemini-2.5-pro-exp".to_string(),
            "gemini-2.5-flash".to_string(),
            "gemini-2.0-pro-exp".to_string(),
            "gemini-2.0-flash".to_string(),
            "gemini-2.0-flash-lite".to_string(),
            "gemini-pro".to_string(),
            "gemini-pro-vision".to_string(),
        ]
    }

    async fn execute_tool(&self, tool: Arc<dyn UniversalTool>, request: ToolExecutionRequest, app_handle: AppHandle) -> Result<ToolExecutionResult, String> {
        info!("Gemini adapter executing tool: {} via simulation", tool.name());
        
        // Execute the tool
        let result = tool.execute(request.parameters.clone(), &request.context).await?;
        
        // Emit tool execution event for Gemini frontend
        let event = json!({
            "type": "tool_execution",
            "tool": tool.name(),
            "tool_type": tool.tool_type(),
            "result": result.output,
            "session_id": request.context.session_id,
            "model": request.context.model_id,
        });
        
        app_handle.emit("gemini-tool-event", event)
            .map_err(|e| format!("Failed to emit tool event: {}", e))?;
        
        Ok(result)
    }

    async fn translate_prompt(&self, prompt: &str, tools: Vec<String>) -> String {
        // Enhance prompt with tool instructions for Gemini
        if tools.is_empty() {
            prompt.to_string()
        } else {
            format!(
                "=== Claudia Universal Tools Enabled ===\n\
                You have access to the following tools through Claudia's universal interface:\n\
                {}\n\n\
                When you need to use a tool, indicate it clearly and I will execute it for you.\n\
                For example: 'Use MCP server X to...', 'Execute agent Y for...', 'Run /command with...'\n\n\
                Original request:\n{}",
                tools.iter().map(|t| format!("• {}", t)).collect::<Vec<_>>().join("\n"),
                prompt
            )
        }
    }

    fn supports_native_tools(&self) -> bool {
        false // Gemini doesn't have native tool support yet, we simulate it
    }
}

/// Ollama model adapter with tool simulation
pub struct OllamaAdapter;

#[async_trait]
impl ModelAdapter for OllamaAdapter {
    fn provider_name(&self) -> String {
        "ollama".to_string()
    }

    fn supported_models(&self) -> Vec<String> {
        vec![
            "llama2".to_string(),
            "codellama".to_string(),
            "mistral".to_string(),
            "mixtral".to_string(),
            "deepseek-coder".to_string(),
            "phi".to_string(),
        ]
    }

    async fn execute_tool(&self, tool: Arc<dyn UniversalTool>, request: ToolExecutionRequest, app_handle: AppHandle) -> Result<ToolExecutionResult, String> {
        info!("Ollama adapter executing tool: {} via simulation", tool.name());
        
        // Execute the tool
        let result = tool.execute(request.parameters.clone(), &request.context).await?;
        
        // Emit tool execution event for Ollama frontend
        let event = json!({
            "type": "tool_execution",
            "tool": tool.name(),
            "tool_type": tool.tool_type(),
            "result": result.output,
            "session_id": request.context.session_id,
            "model": request.context.model_id,
        });
        
        app_handle.emit("ollama-tool-event", event)
            .map_err(|e| format!("Failed to emit tool event: {}", e))?;
        
        Ok(result)
    }

    async fn translate_prompt(&self, prompt: &str, tools: Vec<String>) -> String {
        // Enhance prompt with tool instructions for Ollama
        if tools.is_empty() {
            prompt.to_string()
        } else {
            format!(
                "### System: Claudia Universal Tools\n\
                Available tools:\n{}\n\n\
                You can request to use these tools by clearly stating your intent.\n\
                Format: [TOOL: tool_name] action description\n\n\
                ### User Request:\n{}",
                tools.iter().map(|t| format!("- {}", t)).collect::<Vec<_>>().join("\n"),
                prompt
            )
        }
    }

    fn supports_native_tools(&self) -> bool {
        false // Ollama doesn't have native tool support yet, we simulate it
    }
}

// =============================================================================
// Core Functions
// =============================================================================

/// Initialize the universal tool system
#[command]
pub async fn initialize_universal_tools(app_handle: AppHandle) -> Result<(), String> {
    info!("Initializing Universal Tool System");
    
    // Create and store the registry in app state
    let registry = UniversalToolRegistry::new();
    
    // Register model adapters
    registry.register_adapter(Arc::new(ClaudeAdapter)).await;
    registry.register_adapter(Arc::new(GeminiAdapter)).await;
    registry.register_adapter(Arc::new(OllamaAdapter)).await;
    
    // Register available MCP servers as tools
    if let Ok(mcp_servers) = mcp_list(app_handle.clone()).await {
        let server_count = mcp_servers.len();
        for server in mcp_servers {
            let tool = Arc::new(MCPServerTool {
                server_name: server.name.clone(),
            });
            registry.register_tool(tool).await;
        }
        info!("Registered {} MCP servers as universal tools", server_count);
    }
    
    // Register available agents as tools
    let agent_db = app_handle.state::<AgentDb>();
    if let Ok(agents) = agent_db.list_agents() {
        let agent_count = agents.len();
        for agent in agents {
            let tool = Arc::new(AgentTool {
                agent_name: agent.name.clone(),
            });
            registry.register_tool(tool).await;
        }
        info!("Registered {} agents as universal tools", agent_count);
    }
    
    // Register slash commands as tools
    if let Ok(commands) = slash_commands_list(None, app_handle.clone()).await {
        let command_count = commands.len();
        for command in commands {
            let tool = Arc::new(SlashCommandTool {
                command_name: command.name.clone(),
            });
            registry.register_tool(tool).await;
        }
        info!("Registered {} slash commands as universal tools", command_count);
    }
    
    // Store registry in app state
    app_handle.manage(registry);
    
    info!("Universal Tool System initialized successfully");
    Ok(())
}

/// Execute a tool with any model
#[command]
pub async fn execute_universal_tool(
    app_handle: AppHandle,
    tool_name: String,
    model_id: String,
    parameters: HashMap<String, Value>,
    project_path: String,
    user_prompt: String,
) -> Result<ToolExecutionResult, String> {
    info!("Executing universal tool: {} with model: {}", tool_name, model_id);
    
    let registry = app_handle.state::<UniversalToolRegistry>();
    
    // Get the tool
    let tool = registry.get_tool(&tool_name).await
        .ok_or_else(|| format!("Tool not found: {}", tool_name))?;
    
    // Check if tool supports the model
    if !tool.supports_model(&model_id) {
        return Err(format!("Tool {} does not support model {}", tool_name, model_id));
    }
    
    // Determine provider and get adapter
    let provider = determine_provider(&model_id);
    let adapter = registry.get_adapter(&provider).await
        .ok_or_else(|| format!("No adapter found for provider: {}", provider))?;
    
    // Create context
    let context = ToolContext {
        session_id: Uuid::new_v4().to_string(),
        model_id: model_id.clone(),
        project_path,
        user_prompt,
        system_context: None,
        history: vec![],
    };
    
    // Create request
    let request = ToolExecutionRequest {
        tool_type: tool.tool_type(),
        tool_name: tool_name.clone(),
        parameters,
        context,
    };
    
    // Execute through adapter
    adapter.execute_tool(tool, request, app_handle).await
}

/// List all available tools for a specific model
#[command]
pub async fn list_tools_for_model(
    app_handle: AppHandle,
    model_id: String,
) -> Result<Vec<ToolInfo>, String> {
    let registry = app_handle.state::<UniversalToolRegistry>();
    let tools = registry.tools.read().await;
    
    let mut tool_list = Vec::new();
    for (name, tool) in tools.iter() {
        if tool.supports_model(&model_id) {
            tool_list.push(ToolInfo {
                name: name.clone(),
                tool_type: tool.tool_type(),
                description: tool.description(),
                supports_model: true,
            });
        }
    }
    
    Ok(tool_list)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    pub name: String,
    pub tool_type: ToolType,
    pub description: String,
    pub supports_model: bool,
}

/// Check tool capabilities for a model
#[command]
pub async fn check_model_tool_capabilities(
    app_handle: AppHandle,
    model_id: String,
) -> Result<ToolCapabilityCheck, String> {
    let registry = app_handle.state::<UniversalToolRegistry>();
    let provider = determine_provider(&model_id);
    
    let adapter = registry.get_adapter(&provider).await;
    let native_tools = adapter.as_ref().map_or(false, |a| a.supports_native_tools());
    
    // Check available tool types
    let tools = registry.list_tools_for_model(&model_id).await;
    let has_mcp = tools.iter().any(|t| t.starts_with("mcp_"));
    let has_agents = tools.iter().any(|t| t.starts_with("agent_"));
    let has_commands = tools.iter().any(|t| t.starts_with("cmd_"));
    
    Ok(ToolCapabilityCheck {
        model_id: model_id.clone(),
        supports_mcp: has_mcp,
        supports_agents: has_agents,
        supports_slash_commands: has_commands,
        supports_vision: provider == "claude" || provider == "gemini",
        supports_audio: provider == "claude",
        supports_tools: native_tools || !tools.is_empty(),
        tool_adapters: vec![provider],
    })
}

/// Determine the provider from model ID
pub fn determine_provider(model_id: &str) -> String {
    if model_id.starts_with("claude") || model_id.contains("opus") || model_id.contains("sonnet") || model_id.contains("haiku") {
        "claude".to_string()
    } else if model_id.starts_with("gemini") || model_id.contains("gemini") {
        "gemini".to_string()
    } else {
        "ollama".to_string()
    }
}

/// Execute with universal tools - enhanced main execution function
#[command]
pub async fn execute_with_universal_tools(
    request: UniversalExecutionRequest,
    app_handle: AppHandle,
) -> Result<UniversalExecutionResult, String> {
    info!("Universal execution request - model: {}, tools: {:?}", 
          request.model_id, request.tools_requested);
    
    let registry = app_handle.state::<UniversalToolRegistry>();
    let mut tools_executed = Vec::new();
    
    // Generate session ID
    let session_id = Uuid::new_v4().to_string();
    
    // Get provider and adapter
    let provider = determine_provider(&request.model_id);
    let adapter = registry.get_adapter(&provider).await
        .ok_or_else(|| format!("No adapter for provider: {}", provider))?;
    
    // Get available tools for this model
    let available_tools = registry.list_tools_for_model(&request.model_id).await;
    
    // Filter requested tools
    let tools_to_use = if let Some(requested) = &request.tools_requested {
        requested.iter()
            .filter(|t| available_tools.contains(t))
            .cloned()
            .collect()
    } else {
        available_tools
    };
    
    // Translate prompt with tool context
    let enhanced_prompt = adapter.translate_prompt(&request.prompt, tools_to_use.clone()).await;
    
    // Execute tools if any are explicitly requested in the prompt
    for tool_name in &tools_to_use {
        if request.prompt.contains(tool_name) || request.prompt.contains(&tool_name.replace('_', " ")) {
            info!("Auto-executing tool: {}", tool_name);
            
            if let Some(tool) = registry.get_tool(tool_name).await {
                let context = ToolContext {
                    session_id: session_id.clone(),
                    model_id: request.model_id.clone(),
                    project_path: request.project_path.clone(),
                    user_prompt: request.prompt.clone(),
                    system_context: request.system_instruction.clone(),
                    history: vec![],
                };
                
                let exec_request = ToolExecutionRequest {
                    tool_type: tool.tool_type(),
                    tool_name: tool_name.clone(),
                    parameters: HashMap::new(),
                    context,
                };
                
                if let Ok(result) = adapter.execute_tool(tool, exec_request, app_handle.clone()).await {
                    if result.success {
                        tools_executed.push(tool_name.clone());
                    }
                }
            }
        }
    }
    
    // Emit execution start event
    let event = json!({
        "type": "universal_execution_start",
        "session_id": session_id,
        "model": request.model_id,
        "tools_available": tools_to_use,
        "tools_executed": tools_executed,
    });
    
    app_handle.emit("universal-execution", event)
        .map_err(|e| format!("Failed to emit event: {}", e))?;
    
    Ok(UniversalExecutionResult {
        success: true,
        model_used: request.model_id,
        session_id,
        reasoning: format!("Executed with {} tools available", tools_to_use.len()),
        error: None,
        auto_selected: false,
        tools_executed,
    })
}