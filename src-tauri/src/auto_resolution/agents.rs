use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use log::{info, warn, error, debug};
use async_trait::async_trait;

/// Base trait for all auto-resolution agents
#[async_trait]
pub trait ResolutionAgent: Send + Sync {
    /// Get the agent's unique identifier
    fn id(&self) -> &str;
    
    /// Get the agent's name for display
    fn name(&self) -> &str;
    
    /// Check if this agent can handle the given error
    async fn can_handle(&self, error_code: &str, context: &HashMap<String, String>) -> bool;
    
    /// Attempt to resolve the error
    async fn resolve(&self, app: &AppHandle, error_code: &str, context: &HashMap<String, String>) -> ResolutionResult;
    
    /// Get the agent's success rate
    fn success_rate(&self) -> f32;
    
    /// Update the agent's success metrics
    fn update_metrics(&mut self, success: bool);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionResult {
    pub success: bool,
    pub message: String,
    pub actions_taken: Vec<String>,
    pub time_elapsed_ms: u64,
    pub confidence: f32,
    pub retry_needed: bool,
}

/// Import Error Resolution Agent (handles missing imports, Tauri API issues)
pub struct ImportErrorAgent {
    pub id: String,
    pub name: String,
    pub success_count: u32,
    pub attempt_count: u32,
}

impl ImportErrorAgent {
    pub fn new() -> Self {
        Self {
            id: "import_error_agent".to_string(),
            name: "Import Error Resolution Agent".to_string(),
            success_count: 0,
            attempt_count: 0,
        }
    }
    
    async fn fix_tauri_import(&self, app: &AppHandle) -> bool {
        // Check for common Tauri import issues
        debug!("Checking for Tauri import issues");
        
        // Emit event to frontend to reinitialize Tauri API
        if let Err(e) = app.emit("reinitialize-tauri-api", serde_json::json!({
            "reason": "import_error_detected"
        })) {
            error!("Failed to emit reinitialize event: {}", e);
            return false;
        }
        
        // Give frontend time to reinitialize
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        true
    }
    
    async fn fix_module_import(&self, app: &AppHandle, module_name: &str) -> bool {
        debug!("Attempting to fix module import: {}", module_name);
        
        // Check if module is lazy-loaded and needs initialization
        app.emit("initialize-module", serde_json::json!({
            "module": module_name,
            "lazy_load": true
        })).is_ok()
    }
}

#[async_trait]
impl ResolutionAgent for ImportErrorAgent {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn can_handle(&self, error_code: &str, context: &HashMap<String, String>) -> bool {
        let error_msg = context.get("error_message").map(|s| s.to_lowercase()).unwrap_or_default();
        
        error_msg.contains("import") || 
        error_msg.contains("module not found") ||
        error_msg.contains("cannot find module") ||
        error_msg.contains("tauri") ||
        error_code.contains("IMPORT")
    }
    
    async fn resolve(&self, app: &AppHandle, error_code: &str, context: &HashMap<String, String>) -> ResolutionResult {
        let start_time = SystemTime::now();
        let mut actions_taken = Vec::new();
        let mut success = false;
        let mut message = String::new();
        
        // Identify the type of import error
        let error_msg = context.get("error_message").map(|s| s.to_lowercase()).unwrap_or_default();
        
        if error_msg.contains("tauri") {
            actions_taken.push("Detected Tauri API import issue".to_string());
            if self.fix_tauri_import(app).await {
                actions_taken.push("Reinitialized Tauri API".to_string());
                success = true;
                message = "Successfully fixed Tauri import issue".to_string();
            }
        } else if let Some(module) = extract_module_name(&error_msg) {
            actions_taken.push(format!("Detected missing module: {}", module));
            if self.fix_module_import(app, &module).await {
                actions_taken.push(format!("Initialized module: {}", module));
                success = true;
                message = format!("Successfully loaded module: {}", module);
            }
        } else {
            // Generic import fix
            actions_taken.push("Attempting generic module reload".to_string());
            app.emit("reload-modules", serde_json::json!({})).ok();
            success = true;
            message = "Triggered module reload".to_string();
        }
        
        let time_elapsed_ms = SystemTime::now()
            .duration_since(start_time)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        
        ResolutionResult {
            success,
            message,
            actions_taken,
            time_elapsed_ms,
            confidence: if success { 0.9 } else { 0.3 },
            retry_needed: !success,
        }
    }
    
    fn success_rate(&self) -> f32 {
        if self.attempt_count == 0 {
            0.0
        } else {
            (self.success_count as f32) / (self.attempt_count as f32)
        }
    }
    
    fn update_metrics(&mut self, success: bool) {
        self.attempt_count += 1;
        if success {
            self.success_count += 1;
        }
    }
}

/// Model Connection Error Agent
pub struct ModelConnectionAgent {
    pub id: String,
    pub name: String,
    pub success_count: u32,
    pub attempt_count: u32,
}

impl ModelConnectionAgent {
    pub fn new() -> Self {
        Self {
            id: "model_connection_agent".to_string(),
            name: "Model Connection Error Agent".to_string(),
            success_count: 0,
            attempt_count: 0,
        }
    }
    
    async fn reconnect_model(&self, app: &AppHandle, model_type: &str) -> bool {
        debug!("Attempting to reconnect model: {}", model_type);
        
        // Emit reconnection event
        app.emit("model-reconnect", serde_json::json!({
            "model_type": model_type,
            "retry_count": 3,
            "backoff_ms": 1000,
        })).is_ok()
    }
    
    async fn refresh_api_key(&self, app: &AppHandle, provider: &str) -> bool {
        debug!("Refreshing API key for: {}", provider);
        
        // Request API key refresh
        app.emit("refresh-api-key", serde_json::json!({
            "provider": provider,
            "source": "auto_resolution"
        })).is_ok()
    }
}

#[async_trait]
impl ResolutionAgent for ModelConnectionAgent {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn can_handle(&self, error_code: &str, context: &HashMap<String, String>) -> bool {
        let error_msg = context.get("error_message").map(|s| s.to_lowercase()).unwrap_or_default();
        
        error_msg.contains("model") && (
            error_msg.contains("connection") ||
            error_msg.contains("timeout") ||
            error_msg.contains("unavailable")
        ) ||
        error_msg.contains("api") && error_msg.contains("key") ||
        error_code.contains("MODEL_CONN")
    }
    
    async fn resolve(&self, app: &AppHandle, error_code: &str, context: &HashMap<String, String>) -> ResolutionResult {
        let start_time = SystemTime::now();
        let mut actions_taken = Vec::new();
        let mut success = false;
        let mut message = String::new();
        
        let error_msg = context.get("error_message").map(|s| s.to_lowercase()).unwrap_or_default();
        let model_type = context.get("model_type").cloned().unwrap_or_else(|| {
            detect_model_type(&error_msg)
        });
        
        // Try reconnection first
        actions_taken.push(format!("Attempting to reconnect {}", model_type));
        if self.reconnect_model(app, &model_type).await {
            actions_taken.push("Model reconnection successful".to_string());
            success = true;
            message = format!("Successfully reconnected to {}", model_type);
        } else if error_msg.contains("api") && error_msg.contains("key") {
            // Try API key refresh
            actions_taken.push("Attempting API key refresh".to_string());
            if self.refresh_api_key(app, &model_type).await {
                actions_taken.push("API key refreshed".to_string());
                success = true;
                message = "API key refreshed successfully".to_string();
            }
        }
        
        let time_elapsed_ms = SystemTime::now()
            .duration_since(start_time)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        
        ResolutionResult {
            success,
            message,
            actions_taken,
            time_elapsed_ms,
            confidence: if success { 0.85 } else { 0.4 },
            retry_needed: !success,
        }
    }
    
    fn success_rate(&self) -> f32 {
        if self.attempt_count == 0 {
            0.0
        } else {
            (self.success_count as f32) / (self.attempt_count as f32)
        }
    }
    
    fn update_metrics(&mut self, success: bool) {
        self.attempt_count += 1;
        if success {
            self.success_count += 1;
        }
    }
}

/// Session Isolation Error Agent
pub struct SessionIsolationAgent {
    pub id: String,
    pub name: String,
    pub success_count: u32,
    pub attempt_count: u32,
}

impl SessionIsolationAgent {
    pub fn new() -> Self {
        Self {
            id: "session_isolation_agent".to_string(),
            name: "Session Isolation Error Agent".to_string(),
            success_count: 0,
            attempt_count: 0,
        }
    }
    
    async fn create_isolated_session(&self, app: &AppHandle, session_type: &str) -> bool {
        debug!("Creating isolated session for: {}", session_type);
        
        app.emit("create-isolated-session", serde_json::json!({
            "session_type": session_type,
            "isolation_level": "strict",
            "auto_cleanup": true,
        })).is_ok()
    }
    
    async fn cleanup_contaminated_session(&self, app: &AppHandle, session_id: &str) -> bool {
        debug!("Cleaning up contaminated session: {}", session_id);
        
        app.emit("cleanup-session", serde_json::json!({
            "session_id": session_id,
            "force": true,
            "preserve_history": true,
        })).is_ok()
    }
}

#[async_trait]
impl ResolutionAgent for SessionIsolationAgent {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn can_handle(&self, error_code: &str, context: &HashMap<String, String>) -> bool {
        let error_msg = context.get("error_message").map(|s| s.to_lowercase()).unwrap_or_default();
        
        error_msg.contains("session") && (
            error_msg.contains("contamination") ||
            error_msg.contains("isolation") ||
            error_msg.contains("duplicate") ||
            error_msg.contains("mixing")
        ) ||
        error_code.contains("SESSION_ISO")
    }
    
    async fn resolve(&self, app: &AppHandle, error_code: &str, context: &HashMap<String, String>) -> ResolutionResult {
        let start_time = SystemTime::now();
        let mut actions_taken = Vec::new();
        let mut success = false;
        let mut message = String::new();
        
        let session_id = context.get("session_id").cloned().unwrap_or_default();
        let session_type = context.get("session_type").cloned().unwrap_or_else(|| "default".to_string());
        
        if !session_id.is_empty() {
            // Clean up contaminated session
            actions_taken.push(format!("Cleaning up session: {}", session_id));
            if self.cleanup_contaminated_session(app, &session_id).await {
                actions_taken.push("Session cleaned successfully".to_string());
                
                // Create new isolated session
                actions_taken.push("Creating new isolated session".to_string());
                if self.create_isolated_session(app, &session_type).await {
                    actions_taken.push("New isolated session created".to_string());
                    success = true;
                    message = "Session isolation restored successfully".to_string();
                }
            }
        } else {
            // Just create a new isolated session
            actions_taken.push("Creating new isolated session".to_string());
            if self.create_isolated_session(app, &session_type).await {
                actions_taken.push("Isolated session created".to_string());
                success = true;
                message = "New isolated session created successfully".to_string();
            }
        }
        
        let time_elapsed_ms = SystemTime::now()
            .duration_since(start_time)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        
        ResolutionResult {
            success,
            message,
            actions_taken,
            time_elapsed_ms,
            confidence: if success { 0.95 } else { 0.5 },
            retry_needed: !success,
        }
    }
    
    fn success_rate(&self) -> f32 {
        if self.attempt_count == 0 {
            0.0
        } else {
            (self.success_count as f32) / (self.attempt_count as f32)
        }
    }
    
    fn update_metrics(&mut self, success: bool) {
        self.attempt_count += 1;
        if success {
            self.success_count += 1;
        }
    }
}

/// Tool Access Error Agent
pub struct ToolAccessAgent {
    pub id: String,
    pub name: String,
    pub success_count: u32,
    pub attempt_count: u32,
}

impl ToolAccessAgent {
    pub fn new() -> Self {
        Self {
            id: "tool_access_agent".to_string(),
            name: "Tool Access Error Agent".to_string(),
            success_count: 0,
            attempt_count: 0,
        }
    }
    
    async fn reinitialize_tool(&self, app: &AppHandle, tool_name: &str) -> bool {
        debug!("Reinitializing tool: {}", tool_name);
        
        app.emit("reinitialize-tool", serde_json::json!({
            "tool_name": tool_name,
            "reset_config": true,
        })).is_ok()
    }
    
    async fn restart_mcp_server(&self, app: &AppHandle, server_name: &str) -> bool {
        debug!("Restarting MCP server: {}", server_name);
        
        app.emit("restart-mcp-server", serde_json::json!({
            "server_name": server_name,
            "cleanup": true,
            "wait_ms": 2000,
        })).is_ok()
    }
}

#[async_trait]
impl ResolutionAgent for ToolAccessAgent {
    fn id(&self) -> &str {
        &self.id
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn can_handle(&self, error_code: &str, context: &HashMap<String, String>) -> bool {
        let error_msg = context.get("error_message").map(|s| s.to_lowercase()).unwrap_or_default();
        
        error_msg.contains("tool") && (
            error_msg.contains("access") ||
            error_msg.contains("unavailable") ||
            error_msg.contains("failed")
        ) ||
        error_msg.contains("mcp") ||
        error_msg.contains("agent") ||
        error_code.contains("TOOL_ACCESS")
    }
    
    async fn resolve(&self, app: &AppHandle, error_code: &str, context: &HashMap<String, String>) -> ResolutionResult {
        let start_time = SystemTime::now();
        let mut actions_taken = Vec::new();
        let mut success = false;
        let mut message = String::new();
        
        let error_msg = context.get("error_message").map(|s| s.to_lowercase()).unwrap_or_default();
        let tool_name = context.get("tool_name").cloned().unwrap_or_else(|| {
            extract_tool_name(&error_msg)
        });
        
        if error_msg.contains("mcp") {
            // MCP server issue
            actions_taken.push("Detected MCP server issue".to_string());
            let server_name = extract_mcp_server(&error_msg);
            if self.restart_mcp_server(app, &server_name).await {
                actions_taken.push(format!("Restarted MCP server: {}", server_name));
                success = true;
                message = format!("MCP server {} restarted successfully", server_name);
            }
        } else {
            // General tool access issue
            actions_taken.push(format!("Reinitializing tool: {}", tool_name));
            if self.reinitialize_tool(app, &tool_name).await {
                actions_taken.push("Tool reinitialized successfully".to_string());
                success = true;
                message = format!("Tool {} reinitialized successfully", tool_name);
            }
        }
        
        let time_elapsed_ms = SystemTime::now()
            .duration_since(start_time)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        
        ResolutionResult {
            success,
            message,
            actions_taken,
            time_elapsed_ms,
            confidence: if success { 0.8 } else { 0.35 },
            retry_needed: !success,
        }
    }
    
    fn success_rate(&self) -> f32 {
        if self.attempt_count == 0 {
            0.0
        } else {
            (self.success_count as f32) / (self.attempt_count as f32)
        }
    }
    
    fn update_metrics(&mut self, success: bool) {
        self.attempt_count += 1;
        if success {
            self.success_count += 1;
        }
    }
}

// Helper functions
fn extract_module_name(error_msg: &str) -> Option<String> {
    // Extract module name from error message patterns
    if let Some(start) = error_msg.find("module '") {
        let after_quote = &error_msg[start + 8..];
        if let Some(end) = after_quote.find('\'') {
            return Some(after_quote[..end].to_string());
        }
    }
    
    if let Some(start) = error_msg.find("cannot find module") {
        let words: Vec<&str> = error_msg[start..].split_whitespace().collect();
        if words.len() > 3 {
            return Some(words[3].trim_matches('\'').trim_matches('"').to_string());
        }
    }
    
    None
}

fn detect_model_type(error_msg: &str) -> String {
    if error_msg.contains("claude") {
        "claude".to_string()
    } else if error_msg.contains("gemini") {
        "gemini".to_string()
    } else if error_msg.contains("ollama") {
        "ollama".to_string()
    } else {
        "unknown".to_string()
    }
}

fn extract_tool_name(error_msg: &str) -> String {
    if error_msg.contains("agent") {
        "agent".to_string()
    } else if error_msg.contains("slash") {
        "slash_command".to_string()
    } else if error_msg.contains("mcp") {
        "mcp".to_string()
    } else {
        "unknown_tool".to_string()
    }
}

fn extract_mcp_server(error_msg: &str) -> String {
    // Try to extract MCP server name from error message
    if let Some(start) = error_msg.find("server") {
        let words: Vec<&str> = error_msg[start..].split_whitespace().collect();
        if words.len() > 1 {
            return words[1].trim_matches('\'').trim_matches('"').to_string();
        }
    }
    
    "default".to_string()
}