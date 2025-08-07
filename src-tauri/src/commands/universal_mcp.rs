use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, AppHandle, State};
use log::{info, warn, error, debug};
use anyhow::{Context, Result};

use super::agents::AgentDb;
use super::mcp::{MCPServer, MCPServerConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelProvider {
    Claude,
    Gemini,
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalMCPConfig {
    pub provider: ModelProvider,
    pub model_id: String,
    pub mcp_servers: Vec<String>, // List of MCP server names to use with this model
    pub server_preferences: HashMap<String, MCPServerPreference>,
    pub fallback_enabled: bool,
    pub timeout_ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerPreference {
    pub enabled: bool,
    pub priority: u8, // 1-10, higher priority servers are tried first
    pub tool_mapping: HashMap<String, String>, // Map MCP tools to model-specific implementations
    pub custom_prompts: HashMap<String, String>, // Custom prompts for this model/server combination
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPIntegrationResult {
    pub success: bool,
    pub provider: ModelProvider,
    pub model_id: String,
    pub servers_used: Vec<String>,
    pub tools_available: Vec<MCPToolInfo>,
    pub execution_time_ms: u64,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPToolInfo {
    pub server_name: String,
    pub tool_name: String,
    pub description: String,
    pub available_for_provider: bool,
    pub mapped_implementation: Option<String>,
}

/// Get MCP configuration for a specific model
#[command]
pub async fn get_universal_mcp_config(
    provider: String,
    model_id: String,
    db: State<'_, AgentDb>,
) -> Result<Option<UniversalMCPConfig>, String> {
    let provider_enum = match provider.as_str() {
        "claude" => ModelProvider::Claude,
        "gemini" => ModelProvider::Gemini,
        "ollama" => ModelProvider::Ollama,
        _ => return Err("Unsupported provider".to_string()),
    };

    // Scope the database connection to avoid Send issues
    let config_result = {
        let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

        // Check if configuration exists
        conn.query_row(
            "SELECT mcp_config FROM universal_mcp_configs WHERE provider = ? AND model_id = ?",
            rusqlite::params![provider, model_id],
            |row| {
                let config_json: String = row.get(0)?;
                Ok(config_json)
            }
        )
    };

    match config_result {
        Ok(config_json) => {
            match serde_json::from_str::<UniversalMCPConfig>(&config_json) {
                Ok(config) => Ok(Some(config)),
                Err(e) => {
                    warn!("Failed to parse MCP config for {}/{}: {}", provider, model_id, e);
                    Ok(None)
                }
            }
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // No configuration exists, create default
            let default_config = create_default_mcp_config(provider_enum, model_id.clone()).await?;
            Ok(Some(default_config))
        }
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Create default MCP configuration for a model
async fn create_default_mcp_config(
    provider: ModelProvider,
    model_id: String,
) -> Result<UniversalMCPConfig, String> {
    let mut server_preferences = HashMap::new();
    
    // Default server configurations based on provider
    match provider {
        ModelProvider::Claude => {
            // Claude works well with all MCP servers
            server_preferences.insert("filesystem".to_string(), MCPServerPreference {
                enabled: true,
                priority: 10,
                tool_mapping: HashMap::new(), // Direct mapping
                custom_prompts: HashMap::new(),
            });
            server_preferences.insert("github".to_string(), MCPServerPreference {
                enabled: true,
                priority: 9,
                tool_mapping: HashMap::new(),
                custom_prompts: HashMap::new(),
            });
        }
        ModelProvider::Gemini => {
            // Gemini needs more specific tool mappings
            let mut fs_mapping = HashMap::new();
            fs_mapping.insert("read_file".to_string(), "analyze_file_content".to_string());
            fs_mapping.insert("write_file".to_string(), "create_file_content".to_string());
            
            server_preferences.insert("filesystem".to_string(), MCPServerPreference {
                enabled: true,
                priority: 8,
                tool_mapping: fs_mapping,
                custom_prompts: HashMap::new(),
            });
        }
        ModelProvider::Ollama => {
            // Ollama has more limited tool support, use simpler mappings
            let mut simple_mapping = HashMap::new();
            simple_mapping.insert("complex_tool".to_string(), "simple_equivalent".to_string());
            
            server_preferences.insert("filesystem".to_string(), MCPServerPreference {
                enabled: true,
                priority: 7,
                tool_mapping: simple_mapping,
                custom_prompts: HashMap::new(),
            });
        }
    }

    Ok(UniversalMCPConfig {
        provider,
        model_id,
        mcp_servers: vec!["filesystem".to_string()], // Default to filesystem
        server_preferences,
        fallback_enabled: true,
        timeout_ms: 30000,
    })
}

/// Save MCP configuration for a model
#[command]
pub async fn save_universal_mcp_config(
    config: UniversalMCPConfig,
    db: State<'_, AgentDb>,
) -> Result<(), String> {
    let provider_str = match config.provider {
        ModelProvider::Claude => "claude",
        ModelProvider::Gemini => "gemini",
        ModelProvider::Ollama => "ollama",
    };

    let config_json = serde_json::to_string(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // Scope the database connection to avoid Send issues
    {
        let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

        // Upsert the configuration
        conn.execute(
            "INSERT OR REPLACE INTO universal_mcp_configs (provider, model_id, mcp_config, updated_at)
             VALUES (?1, ?2, ?3, datetime('now'))",
            rusqlite::params![provider_str, config.model_id, config_json],
        ).map_err(|e| format!("Failed to save MCP config: {}", e))?;
    }

    info!("Saved MCP config for {}/{}", provider_str, config.model_id);
    Ok(())
}

/// Execute model request with MCP integration
#[command]
pub async fn execute_with_universal_mcp(
    provider: String,
    model_id: String,
    prompt: String,
    context: Option<String>,
    app_handle: AppHandle,
    db: State<'_, AgentDb>,
) -> Result<MCPIntegrationResult, String> {
    let start_time = std::time::Instant::now();
    
    // Get MCP configuration for this model
    let config = get_universal_mcp_config(provider.clone(), model_id.clone(), db.clone()).await?
        .unwrap_or_else(|| {
            // Fallback to default if no config exists
            tauri::async_runtime::block_on(async {
                create_default_mcp_config(
                    match provider.as_str() {
                        "claude" => ModelProvider::Claude,
                        "gemini" => ModelProvider::Gemini,
                        "ollama" => ModelProvider::Ollama,
                        _ => ModelProvider::Claude,
                    },
                    model_id.clone()
                ).await.unwrap_or_default()
            })
        });

    let mut servers_used = Vec::new();
    let mut tools_available = Vec::new();
    let mut success = false;
    let mut error_message = None;

    // Get available MCP servers
    match super::mcp::mcp_list(app_handle.clone()).await {
        Ok(available_servers) => {
            // Filter servers based on configuration
            let configured_servers: Vec<_> = available_servers.into_iter()
                .filter(|server| config.mcp_servers.contains(&server.name))
                .collect();

            // Sort by priority
            let mut prioritized_servers = configured_servers.clone();
            prioritized_servers.sort_by_key(|server| {
                config.server_preferences.get(&server.name)
                    .map(|pref| 10 - pref.priority) // Reverse for descending order
                    .unwrap_or(10)
            });

            // Test and use servers
            for server in prioritized_servers {
                if let Some(preferences) = config.server_preferences.get(&server.name) {
                    if !preferences.enabled {
                        continue;
                    }

                    // Test server connection
                    match super::mcp::mcp_test_connection(app_handle.clone(), server.name.clone()).await {
                        Ok(status_msg) => {
                            info!("MCP server {} connection successful: {}", server.name, status_msg);
                            servers_used.push(server.name.clone());
                            
                            // Get available tools for this server
                            if let Ok(server_config) = super::mcp::mcp_get(app_handle.clone(), server.name.clone()).await {
                                // Mock tool info (in real implementation, this would query the MCP server)
                                tools_available.push(MCPToolInfo {
                                    server_name: server.name.clone(),
                                    tool_name: "filesystem_operations".to_string(),
                                    description: "File system operations via MCP".to_string(),
                                    available_for_provider: true,
                                    mapped_implementation: preferences.tool_mapping.get("filesystem_operations").cloned(),
                                });
                            }
                        }
                        Err(e) => {
                            warn!("Failed to test MCP server {}: {}", server.name, e);
                        }
                    }
                }
            }

            // Execute the actual model request with MCP context
            match execute_model_with_mcp_context(
                &config.provider,
                &model_id,
                &prompt,
                context.as_deref(),
                &tools_available,
                app_handle.clone()
            ).await {
                Ok(_) => success = true,
                Err(e) => error_message = Some(e.to_string()),
            }
        }
        Err(e) => {
            error_message = Some(format!("Failed to list MCP servers: {}", e));
        }
    }

    let execution_time = start_time.elapsed().as_millis() as u64;

    Ok(MCPIntegrationResult {
        success,
        provider: config.provider,
        model_id,
        servers_used,
        tools_available,
        execution_time_ms: execution_time,
        error_message,
    })
}

/// Execute model request with MCP context
async fn execute_model_with_mcp_context(
    provider: &ModelProvider,
    model_id: &str,
    prompt: &str,
    context: Option<&str>,
    tools: &[MCPToolInfo],
    app_handle: AppHandle,
) -> Result<String> {
    // Build enhanced prompt with MCP tool context
    let mut enhanced_prompt = prompt.to_string();
    
    if !tools.is_empty() {
        enhanced_prompt.push_str("\n\nAvailable Tools:\n");
        for tool in tools {
            enhanced_prompt.push_str(&format!(
                "- {}: {} (from {})\n",
                tool.tool_name, tool.description, tool.server_name
            ));
        }
    }

    if let Some(ctx) = context {
        enhanced_prompt.push_str(&format!("\n\nContext:\n{}\n", ctx));
    }

    // Execute based on provider
    match provider {
        ModelProvider::Claude => {
            // Use existing Claude execution with enhanced prompt
            execute_claude_with_mcp(&enhanced_prompt, model_id, app_handle).await
        }
        ModelProvider::Gemini => {
            // Use existing Gemini execution with enhanced prompt
            execute_gemini_with_mcp(&enhanced_prompt, model_id, app_handle).await
        }
        ModelProvider::Ollama => {
            // Use existing Ollama execution with enhanced prompt
            execute_ollama_with_mcp(&enhanced_prompt, model_id, app_handle).await
        }
    }
}

/// Execute Claude request with MCP integration
async fn execute_claude_with_mcp(
    prompt: &str,
    model_id: &str,
    app_handle: AppHandle,
) -> Result<String> {
    // This would integrate with the existing Claude execution
    // For now, return a mock response
    info!("Executing Claude {} with MCP context", model_id);
    Ok("Claude response with MCP integration (mock)".to_string())
}

/// Execute Gemini request with MCP integration
async fn execute_gemini_with_mcp(
    prompt: &str,
    model_id: &str,
    app_handle: AppHandle,
) -> Result<String> {
    // This would integrate with the existing Gemini execution
    info!("Executing Gemini {} with MCP context", model_id);
    Ok("Gemini response with MCP integration (mock)".to_string())
}

/// Execute Ollama request with MCP integration
async fn execute_ollama_with_mcp(
    prompt: &str,
    model_id: &str,
    app_handle: AppHandle,
) -> Result<String> {
    // This would integrate with the existing Ollama execution
    info!("Executing Ollama {} with MCP context", model_id);
    Ok("Ollama response with MCP integration (mock)".to_string())
}

/// List supported MCP servers for a specific provider
#[command]
pub async fn get_supported_mcp_servers(
    provider: String,
    app_handle: AppHandle,
) -> Result<Vec<MCPServer>, String> {
    let all_servers = super::mcp::mcp_list(app_handle).await
        .map_err(|e| format!("Failed to list MCP servers: {}", e))?;

    // Filter servers based on provider capabilities
    let supported_servers: Vec<_> = all_servers.into_iter()
        .filter(|server| {
            match provider.as_str() {
                "claude" => true, // Claude supports all MCP servers
                "gemini" => {
                    // Gemini supports most servers with some limitations
                    !server.name.contains("claude-specific")
                }
                "ollama" => {
                    // Ollama has more limited support
                    matches!(server.name.as_str(), "filesystem" | "http" | "database")
                }
                _ => false,
            }
        })
        .collect();

    Ok(supported_servers)
}

/// Test MCP integration for all models
#[command]
pub async fn test_universal_mcp_integration(
    app_handle: AppHandle,
    db: State<'_, AgentDb>,
) -> Result<HashMap<String, MCPIntegrationResult>, String> {
    let mut results = HashMap::new();
    
    let providers = vec![
        ("claude", "claude-3-sonnet-20240229"),
        ("gemini", "gemini-pro"),
        ("ollama", "llama2"),
    ];

    for (provider, model) in providers {
        let test_prompt = "Test MCP integration with a simple request".to_string();
        
        match execute_with_universal_mcp(
            provider.to_string(),
            model.to_string(),
            test_prompt,
            None,
            app_handle.clone(),
            db.clone()
        ).await {
            Ok(result) => {
                results.insert(format!("{}-{}", provider, model), result);
            }
            Err(e) => {
                results.insert(format!("{}-{}", provider, model), MCPIntegrationResult {
                    success: false,
                    provider: match provider {
                        "claude" => ModelProvider::Claude,
                        "gemini" => ModelProvider::Gemini,
                        "ollama" => ModelProvider::Ollama,
                        _ => ModelProvider::Claude,
                    },
                    model_id: model.to_string(),
                    servers_used: vec![],
                    tools_available: vec![],
                    execution_time_ms: 0,
                    error_message: Some(e),
                });
            }
        }
    }

    Ok(results)
}

/// Initialize universal MCP configuration table
pub async fn init_universal_mcp_tables(db: &State<'_, AgentDb>) -> Result<(), String> {
    // Scope the database connection to avoid Send issues
    {
        let conn = db.0.lock().map_err(|e| format!("Database lock error: {}", e))?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS universal_mcp_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                model_id TEXT NOT NULL,
                mcp_config TEXT NOT NULL, -- JSON configuration
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, model_id)
            )",
            [],
        ).map_err(|e| format!("Failed to create universal_mcp_configs table: {}", e))?;

        // Create index for better performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mcp_provider_model ON universal_mcp_configs(provider, model_id)",
            [],
        ).map_err(|e| format!("Failed to create MCP provider index: {}", e))?;
    }

    Ok(())
}

impl Default for UniversalMCPConfig {
    fn default() -> Self {
        Self {
            provider: ModelProvider::Claude,
            model_id: "default".to_string(),
            mcp_servers: vec!["filesystem".to_string()],
            server_preferences: HashMap::new(),
            fallback_enabled: true,
            timeout_ms: 30000,
        }
    }
}