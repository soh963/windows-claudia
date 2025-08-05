use anyhow::{Context, Result};
use dirs;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;


/// Helper function to create a std::process::Command with proper environment variables
/// This ensures commands like Claude can find Node.js and other dependencies
fn create_command_with_env(program: &str) -> Command {
    // The parent function already sets CREATE_NO_WINDOW on Windows
    crate::claude_binary::create_command_with_env(program)
}

/// Finds the full path to the claude binary
/// This is necessary because macOS apps have a limited PATH environment
fn find_claude_binary(app_handle: &AppHandle) -> Result<String> {
    crate::claude_binary::find_claude_binary(app_handle).map_err(|e| anyhow::anyhow!(e))
}

/// Represents an MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServer {
    /// Server name/identifier
    pub name: String,
    /// Transport type: "stdio" or "sse"
    pub transport: String,
    /// Command to execute (for stdio)
    pub command: Option<String>,
    /// Command arguments (for stdio)
    pub args: Vec<String>,
    /// Environment variables
    pub env: HashMap<String, String>,
    /// URL endpoint (for SSE)
    pub url: Option<String>,
    /// Configuration scope: "local", "project", or "user"
    pub scope: String,
    /// Whether the server is currently active
    pub is_active: bool,
    /// Server status
    pub status: ServerStatus,
}

/// MCP server configuration for JSON export/import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub env: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// Server status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    /// Whether the server is running
    pub running: bool,
    /// Last error message if any
    pub error: Option<String>,
    /// Last checked timestamp
    pub last_checked: Option<u64>,
}

/// MCP configuration for project scope (.mcp.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPProjectConfig {
    #[serde(rename = "mcpServers")]
    pub mcp_servers: HashMap<String, MCPServerConfig>,
}


/// Result of adding a server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddServerResult {
    pub success: bool,
    pub message: String,
    pub server_name: Option<String>,
}

/// Import result for multiple servers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_count: u32,
    pub failed_count: u32,
    pub servers: Vec<ImportServerResult>,
}

/// Result for individual server import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportServerResult {
    pub name: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Executes a claude mcp command
fn execute_claude_mcp_command(app_handle: &AppHandle, args: Vec<&str>) -> Result<String> {
    info!("Executing claude mcp command with args: {:?}", args);

    let claude_path = find_claude_binary(app_handle)?;
    info!("Found claude binary at: {}", claude_path);
    
    // Handle .cmd files properly on Windows, bypassing MSYS2 path translation
    let mut cmd = if claude_path.ends_with(".cmd") {
        #[cfg(target_os = "windows")]
        {
            // Force use of actual Windows cmd.exe, not MSYS2's bash
            let cmd_exe = "C:\\Windows\\System32\\cmd.exe";
            let mut cmd = Command::new(cmd_exe);
            
            // Clear MSYS2 environment variables that cause path translation issues
            cmd.env_remove("MSYSTEM");
            cmd.env_remove("MSYS");
            cmd.env_remove("MINGW_PREFIX");
            cmd.env_remove("MSYSTEM_PREFIX");
            cmd.env_remove("MSYSTEM_CARCH");
            cmd.env_remove("MSYSTEM_CHOST");
            cmd.env_remove("MINGW_CHOST");
            cmd.env_remove("MINGW_PACKAGE_PREFIX");
            
            // Ensure Windows COMSPEC is set correctly
            cmd.env("COMSPEC", cmd_exe);
            
            // Build the complete command string with proper quoting
            let mut command_parts = Vec::new();
            
            // Quote the path if it contains spaces
            if claude_path.contains(' ') {
                command_parts.push(format!("\"{}\"", claude_path));
            } else {
                command_parts.push(claude_path.to_string());
            }
            
            // Add MCP command
            command_parts.push("mcp".to_string());
            
            // Add arguments with proper quoting
            for arg in &args {
                if arg.contains(' ') || arg.contains('"') {
                    command_parts.push(format!("\"{}\"", arg.replace('"', "\\\"")));
                } else {
                    command_parts.push(arg.to_string());
                }
            }
            
            let full_command = command_parts.join(" ");
            
            cmd.arg("/c");
            cmd.arg(&full_command);
            
            // Apply CREATE_NO_WINDOW flag
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd
        }
        #[cfg(not(target_os = "windows"))]
        {
            let mut cmd = Command::new("sh");
            cmd.arg("-c");
            let mut command_str = format!("\"{}\"", claude_path);
            command_str.push_str(" mcp");
            for arg in &args {
                command_str.push_str(&format!(" \"{}\"", arg.replace('"', "\\\"")));
            }
            cmd.arg(command_str);
            cmd
        }
    } else {
        let mut cmd = create_command_with_env(&claude_path);
        // Add MCP command and arguments normally for non-.cmd files
        cmd.arg("mcp");
        for arg in args {
            cmd.arg(arg);
        }
        cmd
    };
    
    info!("Executing command: {:?}", cmd);
    let output = cmd.output().context("Failed to execute claude command")?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(anyhow::anyhow!("Command failed: {}", stderr))
    }
}

/// Adds a new MCP server
#[tauri::command]
pub async fn mcp_add(
    app: AppHandle,
    name: String,
    transport: String,
    command: Option<String>,
    args: Vec<String>,
    env: HashMap<String, String>,
    url: Option<String>,
    scope: String,
) -> Result<AddServerResult, String> {
    info!("Adding MCP server: {} with transport: {}", name, transport);

    // Prepare owned strings for environment variables
    let env_args: Vec<String> = env
        .iter()
        .map(|(key, value)| format!("{}={}", key, value))
        .collect();

    let mut cmd_args = vec!["add"];

    // Add scope flag
    cmd_args.push("-s");
    cmd_args.push(&scope);

    // Add transport flag for SSE
    if transport == "sse" {
        cmd_args.push("--transport");
        cmd_args.push("sse");
    }

    // Add environment variables
    for (i, _) in env.iter().enumerate() {
        cmd_args.push("-e");
        cmd_args.push(&env_args[i]);
    }

    // Add name
    cmd_args.push(&name);

    // Add command/URL based on transport
    if transport == "stdio" {
        if let Some(cmd) = &command {
            // Add "--" separator before command to prevent argument parsing issues
            if !args.is_empty() || cmd.contains('-') {
                cmd_args.push("--");
            }
            cmd_args.push(cmd);
            // Add arguments
            for arg in &args {
                cmd_args.push(arg);
            }
        } else {
            return Ok(AddServerResult {
                success: false,
                message: "Command is required for stdio transport".to_string(),
                server_name: None,
            });
        }
    } else if transport == "sse" {
        if let Some(url_str) = &url {
            cmd_args.push(url_str);
        } else {
            return Ok(AddServerResult {
                success: false,
                message: "URL is required for SSE transport".to_string(),
                server_name: None,
            });
        }
    }

    match execute_claude_mcp_command(&app, cmd_args) {
        Ok(output) => {
            info!("Successfully added MCP server: {}", name);
            Ok(AddServerResult {
                success: true,
                message: output.trim().to_string(),
                server_name: Some(name),
            })
        }
        Err(e) => {
            error!("Failed to add MCP server: {}", e);
            Ok(AddServerResult {
                success: false,
                message: e.to_string(),
                server_name: None,
            })
        }
    }
}

/// Lists all configured MCP servers
#[tauri::command]
pub async fn mcp_list(app: AppHandle) -> Result<Vec<MCPServer>, String> {
    info!("Listing MCP servers");

    match execute_claude_mcp_command(&app, vec!["list"]) {
        Ok(output) => {
            info!("Raw output from 'claude mcp list': {:?}", output);
            let trimmed = output.trim();
            info!("Trimmed output: {:?}", trimmed);

            // Check if no servers are configured
            if trimmed.contains("No MCP servers configured") || trimmed.is_empty() {
                info!("No servers found - empty or 'No MCP servers' message");
                return Ok(vec![]);
            }

            // Parse the text output, handling multi-line commands
            let mut servers = Vec::new();
            let lines: Vec<&str> = trimmed.lines().collect();
            info!("Total lines in output: {}", lines.len());
            for (idx, line) in lines.iter().enumerate() {
                info!("Line {}: {:?}", idx, line);
            }

            let mut i = 0;

            while i < lines.len() {
                let line = lines[i];
                info!("Processing line {}: {:?}", i, line);

                // Check if this line starts a new server entry
                if let Some(colon_pos) = line.find(':') {
                    info!("Found colon at position {} in line: {:?}", colon_pos, line);
                    // Make sure this is a server name line (not part of a path)
                    // Server names typically don't contain '/' or '\'
                    let potential_name = line[..colon_pos].trim();
                    info!("Potential server name: {:?}", potential_name);

                    if !potential_name.contains('/') && !potential_name.contains('\\') {
                        info!("Valid server name detected: {:?}", potential_name);
                        let name = potential_name.to_string();
                        let mut command_parts = vec![line[colon_pos + 1..].trim().to_string()];
                        info!("Initial command part: {:?}", command_parts[0]);

                        // Check if command continues on next lines
                        i += 1;
                        while i < lines.len() {
                            let next_line = lines[i];
                            info!("Checking next line {} for continuation: {:?}", i, next_line);

                            // If the next line starts with a server name pattern, break
                            if next_line.contains(':') {
                                let potential_next_name =
                                    next_line.split(':').next().unwrap_or("").trim();
                                info!(
                                    "Found colon in next line, potential name: {:?}",
                                    potential_next_name
                                );
                                if !potential_next_name.is_empty()
                                    && !potential_next_name.contains('/')
                                    && !potential_next_name.contains('\\')
                                {
                                    info!("Next line is a new server, breaking");
                                    break;
                                }
                            }
                            // Otherwise, this line is a continuation of the command
                            info!("Line {} is a continuation", i);
                            command_parts.push(next_line.trim().to_string());
                            i += 1;
                        }

                        // Join all command parts
                        let full_command = command_parts.join(" ");
                        info!("Full command for server '{}': {:?}", name, full_command);

                        // For now, we'll create a basic server entry
                        servers.push(MCPServer {
                            name: name.clone(),
                            transport: "stdio".to_string(), // Default assumption
                            command: Some(full_command),
                            args: vec![],
                            env: HashMap::new(),
                            url: None,
                            scope: "local".to_string(), // Default assumption
                            is_active: false,
                            status: ServerStatus {
                                running: false,
                                error: None,
                                last_checked: None,
                            },
                        });
                        info!("Added server: {:?}", name);

                        continue;
                    } else {
                        info!("Skipping line - name contains path separators");
                    }
                } else {
                    info!("No colon found in line {}", i);
                }

                i += 1;
            }

            info!("Found {} MCP servers total", servers.len());
            for (idx, server) in servers.iter().enumerate() {
                info!(
                    "Server {}: name='{}', command={:?}",
                    idx, server.name, server.command
                );
            }
            Ok(servers)
        }
        Err(e) => {
            error!("Failed to list MCP servers: {}", e);
            Err(e.to_string())
        }
    }
}

/// Gets details for a specific MCP server
#[tauri::command]
pub async fn mcp_get(app: AppHandle, name: String) -> Result<MCPServer, String> {
    info!("Getting MCP server details for: {}", name);

    match execute_claude_mcp_command(&app, vec!["get", &name]) {
        Ok(output) => {
            // Parse the structured text output
            let mut scope = "local".to_string();
            let mut transport = "stdio".to_string();
            let mut command = None;
            let mut args = vec![];
            let mut env = HashMap::new();
            let mut url = None;

            let lines: Vec<&str> = output.lines().collect();
            for line in lines.iter() {
                let line = line.trim();

                if line.starts_with("Scope:") {
                    let scope_part = line.replace("Scope:", "").trim().to_string();
                    if scope_part.to_lowercase().contains("local") {
                        scope = "local".to_string();
                    } else if scope_part.to_lowercase().contains("project") {
                        scope = "project".to_string();
                    } else if scope_part.to_lowercase().contains("user")
                        || scope_part.to_lowercase().contains("global")
                    {
                        scope = "user".to_string();
                    }
                } else if line.starts_with("Type:") {
                    transport = line.replace("Type:", "").trim().to_string();
                } else if line.starts_with("Command:") {
                    command = Some(line.replace("Command:", "").trim().to_string());
                } else if line.starts_with("Args:") {
                    let args_str = line.replace("Args:", "").trim().to_string();
                    if !args_str.is_empty() {
                        args = args_str.split_whitespace().map(|s| s.to_string()).collect();
                    }
                } else if line.starts_with("URL:") {
                    url = Some(line.replace("URL:", "").trim().to_string());
                } else if line.starts_with("Environment:") {
                    // Parse environment variables if they're listed
                    // Check if the next lines contain env var definitions
                    let env_start_idx = lines.iter().position(|l| l.trim() == line).unwrap_or(0);
                    if env_start_idx + 1 < lines.len() {
                        for env_line in lines.iter().skip(env_start_idx + 1) {
                            let trimmed_env = env_line.trim();
                            // Stop if we hit another section or empty line
                            if trimmed_env.is_empty() || trimmed_env.contains(':') {
                                break;
                            }
                            // Parse KEY=value format
                            if let Some(eq_pos) = trimmed_env.find('=') {
                                let key = trimmed_env[..eq_pos].trim().to_string();
                                let value = trimmed_env[eq_pos + 1..].trim().to_string();
                                env.insert(key, value);
                            }
                        }
                    }
                }
            }

            Ok(MCPServer {
                name,
                transport,
                command,
                args,
                env,
                url,
                scope,
                is_active: false,
                status: ServerStatus {
                    running: false,
                    error: None,
                    last_checked: None,
                },
            })
        }
        Err(e) => {
            error!("Failed to get MCP server: {}", e);
            Err(e.to_string())
        }
    }
}

/// Removes an MCP server
#[tauri::command]
pub async fn mcp_remove(app: AppHandle, name: String) -> Result<String, String> {
    info!("Removing MCP server: {}", name);

    match execute_claude_mcp_command(&app, vec!["remove", &name]) {
        Ok(output) => {
            info!("Successfully removed MCP server: {}", name);
            Ok(output.trim().to_string())
        }
        Err(e) => {
            error!("Failed to remove MCP server: {}", e);
            Err(e.to_string())
        }
    }
}

/// Adds an MCP server from JSON configuration
#[tauri::command]
pub async fn mcp_add_json(
    app: AppHandle,
    name: String,
    json_config: String,
    scope: String,
) -> Result<AddServerResult, String> {
    info!(
        "Adding MCP server from JSON: {} with scope: {}",
        name, scope
    );

    // Validate JSON structure before passing to command
    match serde_json::from_str::<serde_json::Value>(&json_config) {
        Ok(json_value) => {
            // Check if it's a valid object
            if !json_value.is_object() {
                return Ok(AddServerResult {
                    success: false,
                    message: "Invalid JSON: Expected an object".to_string(),
                    server_name: None,
                });
            }
            
            let obj = json_value.as_object().unwrap();
            
            // Check for required fields based on transport type
            if let Some(type_value) = obj.get("type") {
                if let Some(type_str) = type_value.as_str() {
                    match type_str {
                        "stdio" => {
                            // Validate stdio requirements
                            if !obj.contains_key("command") {
                                return Ok(AddServerResult {
                                    success: false,
                                    message: "Invalid JSON: 'command' is required for stdio transport".to_string(),
                                    server_name: None,
                                });
                            }
                            
                            // Validate command is a string
                            if let Some(cmd) = obj.get("command") {
                                if !cmd.is_string() || cmd.as_str().unwrap_or("").trim().is_empty() {
                                    return Ok(AddServerResult {
                                        success: false,
                                        message: "Invalid JSON: 'command' must be a non-empty string".to_string(),
                                        server_name: None,
                                    });
                                }
                            }
                            
                            // Validate args if present
                            if let Some(args) = obj.get("args") {
                                if !args.is_array() {
                                    return Ok(AddServerResult {
                                        success: false,
                                        message: "Invalid JSON: 'args' must be an array".to_string(),
                                        server_name: None,
                                    });
                                }
                                
                                // Check all args are strings
                                if let Some(args_array) = args.as_array() {
                                    for (idx, arg) in args_array.iter().enumerate() {
                                        if !arg.is_string() {
                                            return Ok(AddServerResult {
                                                success: false,
                                                message: format!("Invalid JSON: args[{}] must be a string", idx),
                                                server_name: None,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                        "sse" => {
                            // Validate SSE requirements
                            if !obj.contains_key("url") {
                                return Ok(AddServerResult {
                                    success: false,
                                    message: "Invalid JSON: 'url' is required for SSE transport".to_string(),
                                    server_name: None,
                                });
                            }
                            
                            // Validate URL is a string
                            if let Some(url) = obj.get("url") {
                                if !url.is_string() || url.as_str().unwrap_or("").trim().is_empty() {
                                    return Ok(AddServerResult {
                                        success: false,
                                        message: "Invalid JSON: 'url' must be a non-empty string".to_string(),
                                        server_name: None,
                                    });
                                }
                                
                                // Basic URL validation
                                let url_str = url.as_str().unwrap();
                                if !url_str.starts_with("http://") && !url_str.starts_with("https://") {
                                    return Ok(AddServerResult {
                                        success: false,
                                        message: "Invalid JSON: 'url' must start with http:// or https://".to_string(),
                                        server_name: None,
                                    });
                                }
                            }
                        }
                        _ => {
                            return Ok(AddServerResult {
                                success: false,
                                message: format!("Invalid JSON: Unknown transport type '{}'", type_str),
                                server_name: None,
                            });
                        }
                    }
                } else {
                    return Ok(AddServerResult {
                        success: false,
                        message: "Invalid JSON: 'type' must be a string".to_string(),
                        server_name: None,
                    });
                }
            } else {
                return Ok(AddServerResult {
                    success: false,
                    message: "Invalid JSON: 'type' field is required".to_string(),
                    server_name: None,
                });
            }
            
            // Validate env if present
            if let Some(env) = obj.get("env") {
                if !env.is_object() {
                    return Ok(AddServerResult {
                        success: false,
                        message: "Invalid JSON: 'env' must be an object".to_string(),
                        server_name: None,
                    });
                }
                
                // Check all env values are strings
                if let Some(env_obj) = env.as_object() {
                    for (key, value) in env_obj.iter() {
                        if !value.is_string() {
                            return Ok(AddServerResult {
                                success: false,
                                message: format!("Invalid JSON: env['{}'] must be a string", key),
                                server_name: None,
                            });
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Ok(AddServerResult {
                success: false,
                message: format!("Invalid JSON: {}", e),
                server_name: None,
            });
        }
    }

    // Build command args
    let mut cmd_args = vec!["add-json", &name, &json_config];

    // Add scope flag
    let scope_flag = "-s";
    cmd_args.push(scope_flag);
    cmd_args.push(&scope);

    match execute_claude_mcp_command(&app, cmd_args) {
        Ok(output) => {
            info!("Successfully added MCP server from JSON: {}", name);
            Ok(AddServerResult {
                success: true,
                message: output.trim().to_string(),
                server_name: Some(name),
            })
        }
        Err(e) => {
            error!("Failed to add MCP server from JSON: {}", e);
            Ok(AddServerResult {
                success: false,
                message: e.to_string(),
                server_name: None,
            })
        }
    }
}

/// Imports MCP servers from Claude Desktop
#[tauri::command]
pub async fn mcp_add_from_claude_desktop(
    app: AppHandle,
    scope: String,
) -> Result<ImportResult, String> {
    info!(
        "Importing MCP servers from Claude Desktop with scope: {}",
        scope
    );

    // Get Claude Desktop config path based on platform
    let config_path = if cfg!(target_os = "macos") {
        dirs::home_dir()
            .ok_or_else(|| "Could not find home directory".to_string())?
            .join("Library")
            .join("Application Support")
            .join("Claude")
            .join("claude_desktop_config.json")
    } else if cfg!(target_os = "linux") {
        // For WSL/Linux, check common locations
        dirs::config_dir()
            .ok_or_else(|| "Could not find config directory".to_string())?
            .join("Claude")
            .join("claude_desktop_config.json")
    } else {
        return Err(
            "Import from Claude Desktop is only supported on macOS and Linux/WSL".to_string(),
        );
    };

    // Check if config file exists
    if !config_path.exists() {
        return Err(
            "Claude Desktop configuration not found. Make sure Claude Desktop is installed."
                .to_string(),
        );
    }

    // Read and parse the config file
    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read Claude Desktop config: {}", e))?;

    let config: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse Claude Desktop config: {}", e))?;

    // Extract MCP servers
    let mcp_servers = config
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "No MCP servers found in Claude Desktop config".to_string())?;

    let mut imported_count = 0;
    let mut failed_count = 0;
    let mut server_results = Vec::new();

    // Import each server using add-json
    for (name, server_config) in mcp_servers {
        info!("Importing server: {}", name);

        // Convert Claude Desktop format to add-json format
        let mut json_config = serde_json::Map::new();

        // All Claude Desktop servers are stdio type
        json_config.insert(
            "type".to_string(),
            serde_json::Value::String("stdio".to_string()),
        );

        // Add command
        if let Some(command) = server_config.get("command").and_then(|v| v.as_str()) {
            json_config.insert(
                "command".to_string(),
                serde_json::Value::String(command.to_string()),
            );
        } else {
            failed_count += 1;
            server_results.push(ImportServerResult {
                name: name.clone(),
                success: false,
                error: Some("Missing command field".to_string()),
            });
            continue;
        }

        // Add args if present
        if let Some(args) = server_config.get("args").and_then(|v| v.as_array()) {
            json_config.insert("args".to_string(), args.clone().into());
        } else {
            json_config.insert("args".to_string(), serde_json::Value::Array(vec![]));
        }

        // Add env if present
        if let Some(env) = server_config.get("env").and_then(|v| v.as_object()) {
            json_config.insert("env".to_string(), env.clone().into());
        } else {
            json_config.insert(
                "env".to_string(),
                serde_json::Value::Object(serde_json::Map::new()),
            );
        }

        // Convert to JSON string
        let json_str = serde_json::to_string(&json_config)
            .map_err(|e| format!("Failed to serialize config for {}: {}", name, e))?;

        // Call add-json command
        match mcp_add_json(app.clone(), name.clone(), json_str, scope.clone()).await {
            Ok(result) => {
                if result.success {
                    imported_count += 1;
                    server_results.push(ImportServerResult {
                        name: name.clone(),
                        success: true,
                        error: None,
                    });
                    info!("Successfully imported server: {}", name);
                } else {
                    failed_count += 1;
                    let error_msg = result.message.clone();
                    server_results.push(ImportServerResult {
                        name: name.clone(),
                        success: false,
                        error: Some(result.message),
                    });
                    error!("Failed to import server {}: {}", name, error_msg);
                }
            }
            Err(e) => {
                failed_count += 1;
                let error_msg = e.clone();
                server_results.push(ImportServerResult {
                    name: name.clone(),
                    success: false,
                    error: Some(e),
                });
                error!("Error importing server {}: {}", name, error_msg);
            }
        }
    }

    info!(
        "Import complete: {} imported, {} failed",
        imported_count, failed_count
    );

    Ok(ImportResult {
        imported_count,
        failed_count,
        servers: server_results,
    })
}

/// Starts Claude Code as an MCP server
#[tauri::command]
pub async fn mcp_serve(app: AppHandle) -> Result<String, String> {
    info!("Starting Claude Code as MCP server");

    // Start the server in a separate process
    let claude_path = match find_claude_binary(&app) {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to find claude binary: {}", e);
            return Err(e.to_string());
        }
    };

    // Handle .cmd files properly on Windows, bypassing MSYS2 path translation
    let mut cmd = if claude_path.ends_with(".cmd") {
        #[cfg(target_os = "windows")]
        {
            // Force use of actual Windows cmd.exe, not MSYS2's bash
            let cmd_exe = "C:\\Windows\\System32\\cmd.exe";
            let mut cmd = Command::new(cmd_exe);
            
            // Clear MSYS2 environment variables that cause path translation issues
            cmd.env_remove("MSYSTEM");
            cmd.env_remove("MSYS");
            cmd.env_remove("MINGW_PREFIX");
            cmd.env_remove("MSYSTEM_PREFIX");
            cmd.env_remove("MSYSTEM_CARCH");
            cmd.env_remove("MSYSTEM_CHOST");
            cmd.env_remove("MINGW_CHOST");
            cmd.env_remove("MINGW_PACKAGE_PREFIX");
            
            // Ensure Windows COMSPEC is set correctly
            cmd.env("COMSPEC", cmd_exe);
            
            // Build the complete command string with proper quoting
            let full_command = if claude_path.contains(' ') {
                format!("\"{}\" mcp serve", claude_path)
            } else {
                format!("{} mcp serve", claude_path)
            };
            
            cmd.arg("/c");
            cmd.arg(&full_command);
            
            // Apply CREATE_NO_WINDOW flag
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd
        }
        #[cfg(not(target_os = "windows"))]
        {
            let mut cmd = Command::new("sh");
            cmd.arg("-c");
            cmd.arg(&format!("\"{}\" mcp serve", claude_path));
            cmd
        }
    } else {
        let mut cmd = create_command_with_env(&claude_path);
        cmd.arg("mcp").arg("serve");
        cmd
    };

    match cmd.spawn() {
        Ok(_) => {
            info!("Successfully started Claude Code MCP server");
            Ok("Claude Code MCP server started".to_string())
        }
        Err(e) => {
            error!("Failed to start MCP server: {}", e);
            Err(e.to_string())
        }
    }
}

/// Tests connection to an MCP server
#[tauri::command]
pub async fn mcp_test_connection(app: AppHandle, name: String) -> Result<String, String> {
    info!("Testing connection to MCP server: {}", name);

    // For now, we'll use the get command to test if the server exists
    match execute_claude_mcp_command(&app, vec!["get", &name]) {
        Ok(_) => Ok(format!("Connection to {} successful", name)),
        Err(e) => Err(e.to_string()),
    }
}

/// Resets project-scoped server approval choices
#[tauri::command]
pub async fn mcp_reset_project_choices(app: AppHandle) -> Result<String, String> {
    info!("Resetting MCP project choices");

    match execute_claude_mcp_command(&app, vec!["reset-project-choices"]) {
        Ok(output) => {
            info!("Successfully reset MCP project choices");
            Ok(output.trim().to_string())
        }
        Err(e) => {
            error!("Failed to reset project choices: {}", e);
            Err(e.to_string())
        }
    }
}

/// Gets the status of MCP servers
#[tauri::command]
pub async fn mcp_get_server_status(app: AppHandle) -> Result<HashMap<String, ServerStatus>, String> {
    info!("Getting MCP server status");

    // Get list of configured servers
    let servers = mcp_list(app.clone()).await?;
    let mut status_map = HashMap::new();

    for server in servers {
        // Check if server process is running by testing connection
        let status = if let Ok(_) = mcp_test_connection(app.clone(), server.name.clone()).await {
            ServerStatus {
                running: true,
                error: None,
                last_checked: Some(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
            }
        } else {
            ServerStatus {
                running: false,
                error: Some("Connection test failed".to_string()),
                last_checked: Some(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()),
            }
        };
        
        status_map.insert(server.name, status);
    }

    Ok(status_map)
}

/// Reads .mcp.json from the current project
#[tauri::command]
pub async fn mcp_read_project_config(project_path: String) -> Result<MCPProjectConfig, String> {
    info!("Reading .mcp.json from project: {}", project_path);

    let mcp_json_path = PathBuf::from(&project_path).join(".mcp.json");

    if !mcp_json_path.exists() {
        return Ok(MCPProjectConfig {
            mcp_servers: HashMap::new(),
        });
    }

    match fs::read_to_string(&mcp_json_path) {
        Ok(content) => match serde_json::from_str::<MCPProjectConfig>(&content) {
            Ok(config) => Ok(config),
            Err(e) => {
                error!("Failed to parse .mcp.json: {}", e);
                Err(format!("Failed to parse .mcp.json: {}", e))
            }
        },
        Err(e) => {
            error!("Failed to read .mcp.json: {}", e);
            Err(format!("Failed to read .mcp.json: {}", e))
        }
    }
}

/// Saves .mcp.json to the current project
#[tauri::command]
pub async fn mcp_save_project_config(
    project_path: String,
    config: MCPProjectConfig,
) -> Result<String, String> {
    info!("Saving .mcp.json to project: {}", project_path);

    let mcp_json_path = PathBuf::from(&project_path).join(".mcp.json");

    let json_content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&mcp_json_path, json_content)
        .map_err(|e| format!("Failed to write .mcp.json: {}", e))?;

    Ok("Project MCP configuration saved".to_string())
}

/// Updates an existing MCP server configuration
#[tauri::command]
pub async fn mcp_update(
    app: AppHandle,
    name: String,
    transport: String,
    command: Option<String>,
    args: Vec<String>,
    env: HashMap<String, String>,
    url: Option<String>,
    scope: String,
) -> Result<AddServerResult, String> {
    info!("Updating MCP server: {}", name);
    
    let claude_path = find_claude_binary(&app)
        .map_err(|e| format!("Could not find claude binary: {}", e))?;
    
    // First remove the existing server
    let mut remove_cmd = create_command_with_env(&claude_path);
    remove_cmd.args(&["mcp", "remove", &name]);
    
    let remove_output = remove_cmd.output()
        .map_err(|e| format!("Failed to execute claude mcp remove: {}", e))?;
    
    if !remove_output.status.success() {
        // If removal fails, it might not exist, so we'll continue anyway
        let stderr = String::from_utf8_lossy(&remove_output.stderr);
        error!("Failed to remove existing server (may not exist): {}", stderr);
    }
    
    // Now add the updated server
    let mut add_cmd = create_command_with_env(&claude_path);
    add_cmd.args(&["mcp", "add"]);
    
    // Add scope flag
    match scope.as_str() {
        "project" => add_cmd.arg("--project"),
        "user" => add_cmd.arg("--user"),
        _ => &mut add_cmd, // default is local
    };
    
    add_cmd.arg(&name);
    
    match transport.as_str() {
        "stdio" => {
            if let Some(cmd) = command {
                add_cmd.arg(&cmd);
                for arg in &args {
                    add_cmd.arg(arg);
                }
            } else {
                return Err("Command is required for stdio transport".to_string());
            }
        }
        "sse" => {
            if let Some(u) = url {
                add_cmd.arg(&u);
            } else {
                return Err("URL is required for SSE transport".to_string());
            }
        }
        _ => return Err(format!("Unknown transport type: {}", transport)),
    }
    
    // Add environment variables
    for (key, value) in &env {
        add_cmd.env(key, value);
    }
    
    let output = add_cmd.output()
        .map_err(|e| format!("Failed to execute claude mcp add: {}", e))?;
    
    if output.status.success() {
        Ok(AddServerResult {
            success: true,
            message: format!("Successfully updated MCP server '{}'", name),
            server_name: Some(name.clone()),
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(AddServerResult {
            success: false,
            message: format!("Failed to update MCP server: {}", stderr),
            server_name: None,
        })
    }
}

/// Exports an MCP server configuration as JSON
#[tauri::command]
pub async fn mcp_export_json(
    app: AppHandle,
    name: String,
) -> Result<String, String> {
    info!("Exporting MCP server {} as JSON", name);
    
    // Get the server details
    let server = mcp_get(app, name).await?;
    
    // Convert to MCPServerConfig format
    let config = MCPServerConfig {
        command: server.command,
        args: if server.args.is_empty() { vec![] } else { server.args },
        env: if server.env.is_empty() { HashMap::new() } else { server.env },
        url: server.url,
    };
    
    // Serialize to JSON
    serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize server config: {}", e))
}

/// Gets all MCP servers as a JSON configuration
#[tauri::command]
pub async fn mcp_export_all_json(
    app: AppHandle,
) -> Result<String, String> {
    info!("Exporting all MCP servers as JSON");
    
    // Get all servers
    let servers = mcp_list(app).await?;
    
    // Convert to a map of MCPServerConfig
    let mut config_map: HashMap<String, MCPServerConfig> = HashMap::new();
    
    for server in servers {
        let config = MCPServerConfig {
            command: server.command,
            args: if server.args.is_empty() { vec![] } else { server.args },
            env: if server.env.is_empty() { HashMap::new() } else { server.env },
            url: server.url,
        };
        config_map.insert(server.name, config);
    }
    
    // Serialize to JSON
    serde_json::to_string_pretty(&config_map)
        .map_err(|e| format!("Failed to serialize servers config: {}", e))
}
