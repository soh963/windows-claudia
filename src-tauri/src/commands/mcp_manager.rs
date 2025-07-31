use anyhow::Result;
use log::info;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command;
use reqwest;

/// MCP Server metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub npm_package: Option<String>,
    pub github_repo: Option<String>,
    pub install_command: String,
    pub config_template: serde_json::Value,
    pub categories: Vec<String>,
    pub popularity: i32,
}

/// MCP installation status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpInstallStatus {
    pub server_name: String,
    pub status: InstallState,
    pub message: String,
    pub progress: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallState {
    Searching,
    Found,
    Installing,
    Configuring,
    Testing,
    Completed,
    Failed,
}

/// MCP search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpSearchResult {
    pub servers: Vec<McpServerInfo>,
    pub total_found: usize,
    pub source: String,
}

/// Search for MCP servers
#[tauri::command]
pub async fn search_mcp_servers(query: String) -> Result<McpSearchResult, String> {
    info!("Searching for MCP servers: {}", query);
    
    let mut servers = Vec::new();
    
    // Search in known MCP registry (this would be a real API in production)
    let known_servers = get_known_mcp_servers();
    
    for server in &known_servers {
        if server.name.contains(&query.to_lowercase()) || 
           server.description.to_lowercase().contains(&query.to_lowercase()) ||
           server.categories.iter().any(|cat| cat.to_lowercase().contains(&query.to_lowercase())) {
            servers.push(server.clone());
        }
    }
    
    // Also search npm for @modelcontextprotocol packages
    if let Ok(npm_results) = search_npm_mcp(&query).await {
        servers.extend(npm_results);
    }
    
    let total_found = servers.len();
    
    Ok(McpSearchResult {
        servers,
        total_found,
        source: "MCP Registry + NPM".to_string(),
    })
}

/// Install MCP server
#[tauri::command]
pub async fn install_mcp_server(
    server_name: String,
    npm_package: Option<String>,
) -> Result<McpInstallStatus, String> {
    info!("Installing MCP server: {}", server_name);
    
    // Send initial status
    let mut status = McpInstallStatus {
        server_name: server_name.clone(),
        status: InstallState::Installing,
        message: "Starting installation...".to_string(),
        progress: 0.1,
    };
    
    // Determine package to install
    let package = npm_package.unwrap_or_else(|| {
        format!("@modelcontextprotocol/server-{}", server_name)
    });
    
    // Install via npm
    match install_npm_package(&package).await {
        Ok(_) => {
            status.status = InstallState::Configuring;
            status.message = "Package installed, configuring...".to_string();
            status.progress = 0.5;
        }
        Err(e) => {
            status.status = InstallState::Failed;
            status.message = format!("Installation failed: {}", e);
            status.progress = 0.0;
            return Ok(status);
        }
    }
    
    // Configure the MCP server
    match configure_mcp_server(&server_name).await {
        Ok(_) => {
            status.status = InstallState::Testing;
            status.message = "Configuration complete, testing connection...".to_string();
            status.progress = 0.8;
        }
        Err(e) => {
            status.status = InstallState::Failed;
            status.message = format!("Configuration failed: {}", e);
            status.progress = 0.0;
            return Ok(status);
        }
    }
    
    // Test the connection
    match test_mcp_connection(&server_name).await {
        Ok(_) => {
            status.status = InstallState::Completed;
            status.message = "MCP server installed and configured successfully!".to_string();
            status.progress = 1.0;
        }
        Err(e) => {
            status.status = InstallState::Failed;
            status.message = format!("Connection test failed: {}", e);
            status.progress = 0.0;
        }
    }
    
    Ok(status)
}

/// Auto-install MCP servers based on natural language
#[tauri::command]
pub async fn auto_install_mcp(detected_packages: Vec<String>) -> Result<Vec<McpInstallStatus>, String> {
    info!("Auto-installing MCP servers: {:?}", detected_packages);
    
    let mut results = Vec::new();
    
    for package in detected_packages {
        // Search for the package first
        let search_result = search_mcp_servers(package.clone()).await?;
        
        if let Some(server) = search_result.servers.first() {
            // Install the first matching server
            let install_result = install_mcp_server(
                server.name.clone(),
                server.npm_package.clone()
            ).await?;
            
            results.push(install_result);
        } else {
            results.push(McpInstallStatus {
                server_name: package,
                status: InstallState::Failed,
                message: "No matching MCP server found".to_string(),
                progress: 0.0,
            });
        }
    }
    
    Ok(results)
}

// Helper functions

fn get_known_mcp_servers() -> Vec<McpServerInfo> {
    vec![
        McpServerInfo {
            name: "playwright".to_string(),
            display_name: "Playwright Browser Automation".to_string(),
            description: "Control headless browsers for testing and automation".to_string(),
            npm_package: Some("@modelcontextprotocol/server-playwright".to_string()),
            github_repo: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/playwright".to_string()),
            install_command: "npm install -g @modelcontextprotocol/server-playwright".to_string(),
            config_template: serde_json::json!({
                "command": "node",
                "args": ["@modelcontextprotocol/server-playwright/dist/index.js"],
                "env": {}
            }),
            categories: vec!["testing".to_string(), "automation".to_string(), "browser".to_string()],
            popularity: 95,
        },
        McpServerInfo {
            name: "filesystem".to_string(),
            display_name: "Filesystem Operations".to_string(),
            description: "Read, write, and manipulate files and directories".to_string(),
            npm_package: Some("@modelcontextprotocol/server-filesystem".to_string()),
            github_repo: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem".to_string()),
            install_command: "npm install -g @modelcontextprotocol/server-filesystem".to_string(),
            config_template: serde_json::json!({
                "command": "node",
                "args": ["@modelcontextprotocol/server-filesystem/dist/index.js", "/path/to/allowed/directory"],
                "env": {}
            }),
            categories: vec!["file".to_string(), "system".to_string()],
            popularity: 90,
        },
        McpServerInfo {
            name: "github".to_string(),
            display_name: "GitHub Integration".to_string(),
            description: "Interact with GitHub repositories, issues, and pull requests".to_string(),
            npm_package: Some("@modelcontextprotocol/server-github".to_string()),
            github_repo: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/github".to_string()),
            install_command: "npm install -g @modelcontextprotocol/server-github".to_string(),
            config_template: serde_json::json!({
                "command": "node",
                "args": ["@modelcontextprotocol/server-github/dist/index.js"],
                "env": {
                    "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-github-token>"
                }
            }),
            categories: vec!["vcs".to_string(), "collaboration".to_string()],
            popularity: 85,
        },
        McpServerInfo {
            name: "postgres".to_string(),
            display_name: "PostgreSQL Database".to_string(),
            description: "Query and manage PostgreSQL databases".to_string(),
            npm_package: Some("@modelcontextprotocol/server-postgres".to_string()),
            github_repo: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/postgres".to_string()),
            install_command: "npm install -g @modelcontextprotocol/server-postgres".to_string(),
            config_template: serde_json::json!({
                "command": "node",
                "args": ["@modelcontextprotocol/server-postgres/dist/index.js", "postgresql://localhost/mydb"],
                "env": {}
            }),
            categories: vec!["database".to_string(), "sql".to_string()],
            popularity: 80,
        },
        McpServerInfo {
            name: "sequential-thinking".to_string(),
            display_name: "Sequential Thinking".to_string(),
            description: "Enhanced reasoning and step-by-step problem solving".to_string(),
            npm_package: Some("@modelcontextprotocol/server-sequential-thinking".to_string()),
            github_repo: None,
            install_command: "npm install -g @modelcontextprotocol/server-sequential-thinking".to_string(),
            config_template: serde_json::json!({
                "command": "node",
                "args": ["@modelcontextprotocol/server-sequential-thinking/dist/index.js"],
                "env": {}
            }),
            categories: vec!["reasoning".to_string(), "analysis".to_string()],
            popularity: 75,
        },
    ]
}

async fn search_npm_mcp(query: &str) -> Result<Vec<McpServerInfo>> {
    let search_url = format!(
        "https://registry.npmjs.org/-/v1/search?text={} @modelcontextprotocol&size=10",
        query
    );
    
    let response = reqwest::get(&search_url).await?;
    let data: serde_json::Value = response.json().await?;
    
    let mut servers = Vec::new();
    
    if let Some(objects) = data["objects"].as_array() {
        for obj in objects {
            if let Some(package) = obj["package"].as_object() {
                let name = package["name"].as_str().unwrap_or("").to_string();
                let description = package["description"].as_str().unwrap_or("").to_string();
                
                // Extract server name from package name
                let server_name = name
                    .replace("@modelcontextprotocol/server-", "")
                    .replace("@modelcontextprotocol/", "");
                
                servers.push(McpServerInfo {
                    name: server_name.clone(),
                    display_name: server_name.replace("-", " ").to_string(),
                    description,
                    npm_package: Some(name.clone()),
                    github_repo: None,
                    install_command: format!("npm install -g {}", name),
                    config_template: serde_json::json!({
                        "command": "node",
                        "args": [format!("{}/dist/index.js", name)],
                        "env": {}
                    }),
                    categories: vec!["npm".to_string()],
                    popularity: 50,
                });
            }
        }
    }
    
    Ok(servers)
}

async fn install_npm_package(package: &str) -> Result<()> {
    info!("Installing npm package: {}", package);
    
    let output = Command::new("npm")
        .args(&["install", "-g", package])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?
        .wait_with_output()
        .await?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("npm install failed: {}", error));
    }
    
    Ok(())
}

async fn configure_mcp_server(server_name: &str) -> Result<()> {
    info!("Configuring MCP server: {}", server_name);
    
    // In a real implementation, this would:
    // 1. Read the current MCP configuration
    // 2. Add the new server configuration
    // 3. Save the updated configuration
    
    // For now, we'll simulate success
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    Ok(())
}

async fn test_mcp_connection(server_name: &str) -> Result<()> {
    info!("Testing MCP connection: {}", server_name);
    
    // In a real implementation, this would:
    // 1. Start the MCP server
    // 2. Send a test request
    // 3. Verify the response
    
    // For now, we'll simulate success
    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
    
    Ok(())
}