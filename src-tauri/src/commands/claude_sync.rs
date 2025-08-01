use anyhow::{Context, Result};
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, Emitter};
use tokio::sync::Mutex;
use tokio::time::{timeout, interval};

use crate::commands::slash_commands::SlashCommand;
use crate::claude_binary::find_claude_binary;

/// Claude Code CLI command metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCliCommand {
    pub name: String,
    pub description: String,
    pub usage: Option<String>,
    pub aliases: Vec<String>,
    pub category: String,
    pub is_slash_command: bool,
    pub discovered_at: u64,
}

/// Claude Code CLI sync result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSyncResult {
    pub success: bool,
    pub commands_found: usize,
    pub new_commands: usize,
    pub updated_commands: usize,
    pub sync_time: u64,
    pub error: Option<String>,
    pub claude_version: Option<String>,
}

/// Claude Code sync state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSyncState {
    pub last_sync: Option<u64>,
    pub claude_version: Option<String>,
    pub commands_cache: HashMap<String, ClaudeCliCommand>,
    pub sync_enabled: bool,
    pub auto_sync_interval_hours: u64,
}

impl Default for ClaudeSyncState {
    fn default() -> Self {
        Self {
            last_sync: None,
            claude_version: None,
            commands_cache: HashMap::new(),
            sync_enabled: true,
            auto_sync_interval_hours: 24, // Default to 24 hours
        }
    }
}

/// Global sync state for background tasks
pub struct GlobalSyncState {
    pub state: Arc<Mutex<ClaudeSyncState>>,
    pub sync_in_progress: Arc<Mutex<bool>>,
}

impl Default for GlobalSyncState {
    fn default() -> Self {
        Self {
            state: Arc::new(Mutex::new(ClaudeSyncState::default())),
            sync_in_progress: Arc::new(Mutex::new(false)),
        }
    }
}

/// Extract Claude Code version
async fn get_claude_version(app_handle: &AppHandle) -> Result<String> {
    let claude_binary = find_claude_binary(app_handle)
        .map_err(|e| anyhow::anyhow!("Claude binary not found: {}", e))?;
    
    debug!("Getting Claude version from: {:?}", claude_binary);
    
    let mut cmd = if claude_binary.ends_with(".cmd") {
        crate::windows_command::execute_cmd_file_hidden_tokio(&claude_binary, vec!["--version".to_string()])
    } else {
        crate::windows_command::create_hidden_tokio_command(&claude_binary)
    };
    
    if !claude_binary.ends_with(".cmd") {
        cmd.arg("--version");
    }
    
    let output = timeout(
        Duration::from_secs(10),
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .context("Failed to spawn claude --version")?
            .wait_with_output()
    ).await.context("Claude version command timed out")??;
    
    if !output.status.success() {
        return Err(anyhow::anyhow!("Claude version command failed"));
    }
    
    let version_output = String::from_utf8_lossy(&output.stdout);
    Ok(version_output.trim().to_string())
}

/// Discover slash commands by analyzing Claude's interactive help
async fn discover_slash_commands(app_handle: &AppHandle) -> Result<Vec<ClaudeCliCommand>> {
    let claude_binary = find_claude_binary(app_handle)
        .map_err(|e| anyhow::anyhow!("Claude binary not found: {}", e))?;
    
    debug!("Discovering slash commands from Claude binary: {:?}", claude_binary);
    
    let mut commands = Vec::new();
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    
    // Try to extract commands from different sources
    
    // 1. Try to get help for known commands
    let known_commands = vec![
        "analyze", "build", "implement", "improve", "design", "test", 
        "document", "git", "agents", "init", "clear", "compact", 
        "review", "explain", "help", "add-dir"
    ];
    
    for cmd_name in known_commands {
        // Try to get help for this command
        if let Ok(cmd_info) = get_command_info(&PathBuf::from(&claude_binary), cmd_name).await {
            commands.push(ClaudeCliCommand {
                name: cmd_name.to_string(),
                description: cmd_info.description,
                usage: cmd_info.usage,
                aliases: cmd_info.aliases,
                category: cmd_info.category,
                is_slash_command: true,
                discovered_at: now,
            });
        }
    }
    
    // 2. Try to analyze Claude's configuration files
    if let Ok(config_commands) = discover_from_config().await {
        commands.extend(config_commands);
    }
    
    // 3. Try to analyze Claude's help output patterns
    if let Ok(help_commands) = discover_from_help_patterns(&PathBuf::from(&claude_binary)).await {
        commands.extend(help_commands);
    }
    
    info!("Discovered {} Claude CLI commands", commands.len());
    Ok(commands)
}

/// Get information about a specific command
async fn get_command_info(_claude_binary: &PathBuf, command: &str) -> Result<CommandInfo> {
    // This is a heuristic approach since Claude doesn't expose command metadata directly
    let description = match command {
        "analyze" => "Multi-dimensional code and system analysis",
        "build" => "Project builder with framework detection",
        "implement" => "Feature and code implementation",
        "improve" => "Evidence-based code enhancement", 
        "design" => "System design and architecture planning",
        "test" => "Testing workflow automation",
        "document" => "Documentation generation",
        "git" => "Git workflow automation",
        "agents" => "Sub Agent creation with domain expertise",
        "init" => "Initialize project configuration",
        "clear" => "Clear session context",
        "compact" => "Compact conversation history",
        "review" => "Code review assistant",
        "explain" => "Code explanation assistant",
        "help" => "Display help information",
        "add-dir" => "Add additional working directories",
        _ => "Custom command",
    };
    
    let category = match command {
        "analyze" | "review" | "explain" => "Analysis",
        "build" | "implement" | "design" => "Development",
        "improve" | "test" => "Quality",
        "document" => "Documentation",
        "git" => "Version Control",
        "agents" => "AI Agents",
        "init" | "clear" | "compact" | "add-dir" => "Session Management",
        "help" => "Help",
        _ => "Custom",
    };
    
    Ok(CommandInfo {
        description: description.to_string(),
        usage: Some(format!("/{} [arguments]", command)),
        aliases: vec![],
        category: category.to_string(),
    })
}

#[derive(Debug)]
struct CommandInfo {
    description: String,
    usage: Option<String>,
    aliases: Vec<String>,
    category: String,
}

/// Discover commands from Claude configuration
async fn discover_from_config() -> Result<Vec<ClaudeCliCommand>> {
    let mut commands = Vec::new();
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    
    // Check for Claude configuration directories
    if let Some(home_dir) = dirs::home_dir() {
        let claude_dir = home_dir.join(".claude");
        
        // Look for commands in .claude/commands
        let commands_dir = claude_dir.join("commands");
        if commands_dir.exists() {
            if let Ok(entries) = fs::read_dir(commands_dir) {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.ends_with(".md") {
                            let cmd_name = name.trim_end_matches(".md");
                            commands.push(ClaudeCliCommand {
                                name: cmd_name.to_string(),
                                description: format!("User-defined command: {}", cmd_name),
                                usage: Some(format!("/{}", cmd_name)),
                                aliases: vec![],
                                category: "User Commands".to_string(),
                                is_slash_command: true,
                                discovered_at: now,
                            });
                        }
                    }
                }
            }
        }
    }
    
    Ok(commands)
}

/// Discover commands from help patterns
async fn discover_from_help_patterns(claude_binary: &PathBuf) -> Result<Vec<ClaudeCliCommand>> {
    let mut commands = Vec::new();
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    
    // Try to run Claude with various help-related arguments
    let help_args = vec!["--help", "help"];
    
    for arg in help_args {
        let mut cmd = if claude_binary.ends_with(".cmd") {
            crate::windows_command::execute_cmd_file_hidden_tokio(claude_binary.to_string_lossy().as_ref(), vec![arg.to_string()])
        } else {
            let mut cmd = crate::windows_command::create_hidden_tokio_command(claude_binary.to_string_lossy().as_ref());
            cmd.arg(arg);
            cmd
        };
        
        if let Ok(output) = timeout(
            Duration::from_secs(10),
            cmd.stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .context("Failed to spawn claude help")?
                .wait_with_output()
        ).await {
            if let Ok(help_output) = output {
                let help_text = String::from_utf8_lossy(&help_output.stdout);
                
                // Parse help output for command patterns
                for line in help_text.lines() {
                    if let Some(cmd) = parse_help_line(line, now) {
                        commands.push(cmd);
                    }
                }
            }
        }
    }
    
    Ok(commands)
}

/// Parse a help line for command information
fn parse_help_line(line: &str, discovered_at: u64) -> Option<ClaudeCliCommand> {
    let trimmed = line.trim();
    
    // Look for patterns like:
    // "config                           Manage configuration"
    // "mcp                              Configure and manage MCP servers"
    if trimmed.len() > 20 && !trimmed.starts_with('-') && !trimmed.starts_with("Usage:") {
        let parts: Vec<&str> = trimmed.splitn(2, "  ").collect();
        if parts.len() == 2 {
            let command = parts[0].trim();
            let description = parts[1].trim();
            
            // Skip if it doesn't look like a command
            if command.contains(' ') || command.is_empty() {
                return None;
            }
            
            return Some(ClaudeCliCommand {
                name: command.to_string(),
                description: description.to_string(),
                usage: Some(format!("claude {}", command)),
                aliases: vec![],
                category: "CLI Commands".to_string(),
                is_slash_command: false,
                discovered_at,
            });
        }
    }
    
    None
}

/// Convert Claude CLI commands to SlashCommand format
fn convert_to_slash_commands(cli_commands: Vec<ClaudeCliCommand>) -> Vec<SlashCommand> {
    cli_commands
        .into_iter()
        .filter(|cmd| cmd.is_slash_command)
        .map(|cmd| SlashCommand {
            id: format!("claude-sync-{}", cmd.name),
            name: cmd.name.clone(),
            full_command: format!("/{}", cmd.name),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: format!("{}\n\nUsage: {}", cmd.description, cmd.usage.as_deref().unwrap_or("")),
            description: Some(cmd.description),
            allowed_tools: get_default_tools_for_command(&cmd.name),
            has_bash_commands: requires_bash(&cmd.name),
            has_file_references: requires_file_refs(&cmd.name),
            accepts_arguments: accepts_args(&cmd.name),
        })
        .collect()
}

/// Get default tools for a command
fn get_default_tools_for_command(command: &str) -> Vec<String> {
    match command {
        "analyze" => vec!["Read".to_string(), "Grep".to_string(), "Bash".to_string(), "TodoWrite".to_string()],
        "build" => vec!["Bash".to_string(), "Read".to_string(), "Write".to_string(), "TodoWrite".to_string()],
        "implement" => vec!["Write".to_string(), "Edit".to_string(), "Read".to_string(), "MultiEdit".to_string(), "TodoWrite".to_string()],
        "improve" => vec!["Edit".to_string(), "Read".to_string(), "Grep".to_string(), "MultiEdit".to_string(), "Bash".to_string()],
        "design" => vec!["Read".to_string(), "Write".to_string(), "TodoWrite".to_string()],
        "test" => vec!["Read".to_string(), "Write".to_string(), "Bash".to_string(), "TodoWrite".to_string()],
        "document" => vec!["Read".to_string(), "Write".to_string(), "TodoWrite".to_string()],
        "git" => vec!["Bash".to_string(), "Read".to_string(), "Write".to_string(), "TodoWrite".to_string()],
        "agents" => vec!["Task".to_string(), "Write".to_string(), "Read".to_string(), "TodoWrite".to_string()],
        "init" => vec!["Write".to_string(), "Read".to_string()],
        "review" => vec!["Read".to_string(), "Grep".to_string(), "TodoWrite".to_string()],
        "explain" => vec!["Read".to_string(), "Grep".to_string()],
        _ => vec![],
    }
}

/// Check if command requires bash
fn requires_bash(command: &str) -> bool {
    matches!(command, "build" | "test" | "git")
}

/// Check if command requires file references
fn requires_file_refs(command: &str) -> bool {
    matches!(command, "review" | "explain")
}

/// Check if command accepts arguments
fn accepts_args(command: &str) -> bool {
    !matches!(command, "init" | "clear" | "compact")
}

/// Internal sync function for background tasks
async fn sync_claude_commands_internal(
    app: AppHandle,
    global_state: Arc<GlobalSyncState>,
) -> Result<ClaudeSyncResult, String> {
    info!("Starting Claude Code commands sync");
    
    // Check if sync is already in progress
    {
        let mut in_progress = global_state.sync_in_progress.lock().await;
        if *in_progress {
            return Ok(ClaudeSyncResult {
                success: false,
                commands_found: 0,
                new_commands: 0,
                updated_commands: 0,
                sync_time: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
                error: Some("Sync already in progress".to_string()),
                claude_version: None,
            });
        }
        *in_progress = true;
    }
    
    // Ensure we reset the flag when done
    let sync_flag = global_state.sync_in_progress.clone();
    let _guard = scopeguard::guard(sync_flag, |flag| {
        let flag = flag.clone();
        tokio::spawn(async move {
            *flag.lock().await = false;
        });
    });
    
    let sync_start = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    
    // Get Claude version
    let claude_version = match get_claude_version(&app).await {
        Ok(version) => {
            info!("Claude version: {}", version);
            Some(version)
        }
        Err(e) => {
            warn!("Could not get Claude version: {}", e);
            None
        }
    };
    
    // Discover commands
    let cli_commands = match discover_slash_commands(&app).await {
        Ok(commands) => commands,
        Err(e) => {
            let error_msg = format!("Failed to discover Claude commands: {}", e);
            error!("{}", error_msg);
            return Ok(ClaudeSyncResult {
                success: false,
                commands_found: 0,
                new_commands: 0,
                updated_commands: 0,
                sync_time: sync_start,
                error: Some(error_msg),
                claude_version,
            });
        }
    };
    
    let commands_found = cli_commands.len();
    info!("Found {} Claude CLI commands", commands_found);
    
    // Convert to SlashCommand format
    let slash_commands = convert_to_slash_commands(cli_commands.clone());
    let new_commands = slash_commands.len();
    
    // Update sync state
    {
        let mut sync_state = global_state.state.lock().await;
        sync_state.last_sync = Some(sync_start);
        sync_state.claude_version = claude_version.clone();
        
        // Update commands cache
        for cmd in &cli_commands {
            sync_state.commands_cache.insert(cmd.name.clone(), cmd.clone());
        }
        
        // Save sync state
        if let Err(e) = save_sync_state(&sync_state, &app).await {
            error!("Failed to save sync state: {}", e);
        }
    }
    
    // Store slash commands in database
    if let Err(e) = store_slash_commands(&slash_commands, &app).await {
        error!("Failed to store slash commands: {}", e);
    }
    
    // Emit event to notify UI
    app.emit("claude-commands-synced", &slash_commands)
        .map_err(|e| e.to_string())?;
    
    Ok(ClaudeSyncResult {
        success: true,
        commands_found,
        new_commands,
        updated_commands: 0, // We don't track updates yet
        sync_time: sync_start,
        error: None,
        claude_version,
    })
}

/// Sync Claude Code commands
#[tauri::command]
pub async fn sync_claude_commands(
    app: AppHandle,
    state: tauri::State<'_, GlobalSyncState>,
) -> Result<ClaudeSyncResult, String> {
    // Create an Arc wrapper around the state for the internal function
    let global_state = Arc::new(GlobalSyncState {
        state: state.state.clone(),
        sync_in_progress: state.sync_in_progress.clone(),
    });
    
    sync_claude_commands_internal(app, global_state).await
}

/// Get current sync state
#[tauri::command]
pub async fn get_claude_sync_state(state: tauri::State<'_, GlobalSyncState>) -> Result<ClaudeSyncState, String> {
    let sync_state = state.state.lock().await;
    Ok(sync_state.clone())
}

/// Enable/disable Claude sync
#[tauri::command]
pub async fn set_claude_sync_enabled(
    enabled: bool,
    state: tauri::State<'_, GlobalSyncState>,
    app: AppHandle,
) -> Result<bool, String> {
    info!("Claude sync enabled: {}", enabled);
    
    let mut sync_state = state.state.lock().await;
    sync_state.sync_enabled = enabled;
    
    // Save state to disk
    if let Err(e) = save_sync_state(&sync_state, &app).await {
        error!("Failed to save sync state: {}", e);
    }
    
    Ok(enabled)
}

/// Get synced commands as SlashCommand format
#[tauri::command]
pub async fn get_synced_claude_commands(app: AppHandle) -> Result<Vec<SlashCommand>, String> {
    info!("Getting synced Claude commands");
    
    match discover_slash_commands(&app).await {
        Ok(cli_commands) => {
            let slash_commands = convert_to_slash_commands(cli_commands);
            info!("Returning {} synced commands", slash_commands.len());
            Ok(slash_commands)
        }
        Err(e) => {
            let error_msg = format!("Failed to get synced commands: {}", e);
            error!("{}", error_msg);
            Err(error_msg)
        }
    }
}

/// Check if Claude binary is available
#[tauri::command]
pub async fn check_claude_availability(app: AppHandle) -> Result<bool, String> {
    match find_claude_binary(&app) {
        Ok(binary) => {
            debug!("Claude binary found at: {:?}", binary);
            
            // Try to run claude --version to verify it works
            match get_claude_version(&app).await {
                Ok(version) => {
                    info!("Claude is available, version: {}", version);
                    Ok(true)
                }
                Err(e) => {
                    warn!("Claude binary found but not working: {}", e);
                    Ok(false)
                }
            }
        }
        Err(e) => {
            warn!("Claude binary not found: {}", e);
            Ok(false)
        }
    }
}

/// Get sync state file path
fn get_sync_state_path(app: &AppHandle) -> Result<PathBuf> {
    let app_data = app.path().app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
    
    // Ensure directory exists
    if !app_data.exists() {
        fs::create_dir_all(&app_data)?;
    }
    
    Ok(app_data.join("claude_sync_state.json"))
}

/// Save sync state to disk
async fn save_sync_state(state: &ClaudeSyncState, app: &AppHandle) -> Result<()> {
    let path = get_sync_state_path(app)?;
    let json = serde_json::to_string_pretty(state)?;
    fs::write(path, json)?;
    Ok(())
}

/// Load sync state from disk
pub async fn load_sync_state(app: &AppHandle) -> Result<ClaudeSyncState> {
    let path = get_sync_state_path(app)?;
    
    if !path.exists() {
        return Ok(ClaudeSyncState::default());
    }
    
    let json = fs::read_to_string(path)?;
    let state: ClaudeSyncState = serde_json::from_str(&json)?;
    Ok(state)
}

/// Store slash commands in database
async fn store_slash_commands(commands: &[SlashCommand], app: &AppHandle) -> Result<()> {
    // Get the commands cache directory
    let app_data = app.path().app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
    
    let commands_file = app_data.join("claude_synced_commands.json");
    
    // Save commands to file
    let json = serde_json::to_string_pretty(commands)?;
    fs::write(commands_file, json)?;
    
    info!("Stored {} synced Claude commands", commands.len());
    Ok(())
}

/// Load stored slash commands
pub async fn load_stored_commands(app: &AppHandle) -> Result<Vec<SlashCommand>> {
    let app_data = app.path().app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;
    
    let commands_file = app_data.join("claude_synced_commands.json");
    
    if !commands_file.exists() {
        return Ok(Vec::new());
    }
    
    let json = fs::read_to_string(commands_file)?;
    let commands: Vec<SlashCommand> = serde_json::from_str(&json)?;
    Ok(commands)
}

/// Set automatic sync interval
#[tauri::command]
pub async fn set_claude_sync_interval(
    hours: u64,
    state: tauri::State<'_, GlobalSyncState>,
    app: AppHandle,
) -> Result<u64, String> {
    info!("Setting Claude sync interval to {} hours", hours);
    
    let mut sync_state = state.state.lock().await;
    sync_state.auto_sync_interval_hours = hours;
    
    // Save state to disk
    if let Err(e) = save_sync_state(&sync_state, &app).await {
        error!("Failed to save sync state: {}", e);
    }
    
    Ok(hours)
}

/// Force refresh Claude commands (clears cache and re-syncs)
#[tauri::command]
pub async fn force_refresh_claude_commands(
    app: AppHandle,
    state: tauri::State<'_, GlobalSyncState>,
) -> Result<ClaudeSyncResult, String> {
    info!("Force refreshing Claude commands");
    
    // Clear cache
    {
        let mut sync_state = state.state.lock().await;
        sync_state.commands_cache.clear();
        sync_state.last_sync = None;
        sync_state.claude_version = None;
    }
    
    // Perform sync
    sync_claude_commands(app, state).await
}

/// Start automatic sync background task
pub async fn start_auto_sync(app: AppHandle, global_state: Arc<GlobalSyncState>) {
    info!("Starting automatic Claude sync background task");
    
    // Load initial state
    if let Ok(saved_state) = load_sync_state(&app).await {
        let mut state = global_state.state.lock().await;
        *state = saved_state;
    }
    
    // Initial sync after 10 seconds
    tokio::time::sleep(Duration::from_secs(10)).await;
    
    // Perform initial sync
    if let Err(e) = sync_claude_commands_internal(app.clone(), global_state.clone()).await {
        error!("Initial Claude sync failed: {}", e);
    }
    
    // Set up periodic sync
    let interval_hours = {
        let state = global_state.state.lock().await;
        state.auto_sync_interval_hours
    };
    
    let mut interval = interval(Duration::from_secs(interval_hours * 60 * 60));
    
    loop {
        interval.tick().await;
        
        // Check if sync is enabled
        let sync_enabled = {
            let state = global_state.state.lock().await;
            state.sync_enabled
        };
        
        if !sync_enabled {
            info!("Automatic Claude sync is disabled, skipping");
            continue;
        }
        
        info!("Running scheduled Claude sync");
        
        match sync_claude_commands_internal(app.clone(), global_state.clone()).await {
            Ok(result) => {
                if result.success {
                    info!("Scheduled Claude sync completed successfully");
                } else {
                    warn!("Scheduled Claude sync completed with errors: {:?}", result.error);
                }
            }
            Err(e) => {
                error!("Scheduled Claude sync failed: {}", e);
            }
        }
    }
}

/// Get next sync time
#[tauri::command]
pub async fn get_next_sync_time(state: tauri::State<'_, GlobalSyncState>) -> Result<Option<u64>, String> {
    let sync_state = state.state.lock().await;
    
    if !sync_state.sync_enabled {
        return Ok(None);
    }
    
    if let Some(last_sync) = sync_state.last_sync {
        let next_sync = last_sync + (sync_state.auto_sync_interval_hours * 60 * 60);
        Ok(Some(next_sync))
    } else {
        Ok(None)
    }
}