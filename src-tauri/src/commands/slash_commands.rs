use anyhow::{Context, Result};
use dirs;
use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Represents a custom slash command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommand {
    /// Unique identifier for the command (derived from file path)
    pub id: String,
    /// Command name (without prefix)
    pub name: String,
    /// Full command with prefix (e.g., "/project:optimize")
    pub full_command: String,
    /// Command scope: "project" or "user"
    pub scope: String,
    /// Optional namespace (e.g., "frontend" in "/project:frontend:component")
    pub namespace: Option<String>,
    /// Path to the markdown file
    pub file_path: String,
    /// Command content (markdown body)
    pub content: String,
    /// Optional description from frontmatter
    pub description: Option<String>,
    /// Allowed tools from frontmatter
    pub allowed_tools: Vec<String>,
    /// Whether the command has bash commands (!)
    pub has_bash_commands: bool,
    /// Whether the command has file references (@)
    pub has_file_references: bool,
    /// Whether the command uses $ARGUMENTS placeholder
    pub accepts_arguments: bool,
}

/// YAML frontmatter structure
#[derive(Debug, Deserialize)]
struct CommandFrontmatter {
    #[serde(rename = "allowed-tools")]
    allowed_tools: Option<Vec<String>>,
    description: Option<String>,
}

/// Parse a markdown file with optional YAML frontmatter
fn parse_markdown_with_frontmatter(content: &str) -> Result<(Option<CommandFrontmatter>, String)> {
    let lines: Vec<&str> = content.lines().collect();
    
    // Check if the file starts with YAML frontmatter
    if lines.is_empty() || lines[0] != "---" {
        // No frontmatter
        return Ok((None, content.to_string()));
    }
    
    // Find the end of frontmatter
    let mut frontmatter_end = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            frontmatter_end = Some(i);
            break;
        }
    }
    
    if let Some(end) = frontmatter_end {
        // Extract frontmatter
        let frontmatter_content = lines[1..end].join("\n");
        let body_content = lines[(end + 1)..].join("\n");
        
        // Parse YAML
        match serde_yaml::from_str::<CommandFrontmatter>(&frontmatter_content) {
            Ok(frontmatter) => Ok((Some(frontmatter), body_content)),
            Err(e) => {
                debug!("Failed to parse frontmatter: {}", e);
                // Return full content if frontmatter parsing fails
                Ok((None, content.to_string()))
            }
        }
    } else {
        // Malformed frontmatter, treat as regular content
        Ok((None, content.to_string()))
    }
}

/// Extract command name and namespace from file path
fn extract_command_info(file_path: &Path, base_path: &Path) -> Result<(String, Option<String>)> {
    let relative_path = file_path
        .strip_prefix(base_path)
        .context("Failed to get relative path")?;
    
    // Remove .md extension
    let path_without_ext = relative_path
        .with_extension("")
        .to_string_lossy()
        .to_string();
    
    // Split into components
    let components: Vec<&str> = path_without_ext.split('/').collect();
    
    if components.is_empty() {
        return Err(anyhow::anyhow!("Invalid command path"));
    }
    
    if components.len() == 1 {
        // No namespace
        Ok((components[0].to_string(), None))
    } else {
        // Last component is the command name, rest is namespace
        let command_name = components.last().unwrap().to_string();
        let namespace = components[..components.len() - 1].join(":");
        Ok((command_name, Some(namespace)))
    }
}

/// Load a single command from a markdown file
fn load_command_from_file(
    file_path: &Path,
    base_path: &Path,
    scope: &str,
) -> Result<SlashCommand> {
    debug!("Loading command from: {:?}", file_path);
    
    // Read file content
    let content = fs::read_to_string(file_path)
        .context("Failed to read command file")?;
    
    // Parse frontmatter
    let (frontmatter, body) = parse_markdown_with_frontmatter(&content)?;
    
    // Extract command info
    let (name, namespace) = extract_command_info(file_path, base_path)?;
    
    // Build full command (no scope prefix, just /command or /namespace:command)
    let full_command = match &namespace {
        Some(ns) => format!("/{ns}:{name}"),
        None => format!("/{name}"),
    };
    
    // Generate unique ID
    let id = format!("{}-{}", scope, file_path.to_string_lossy().replace('/', "-"));
    
    // Check for special content
    let has_bash_commands = body.contains("!`");
    let has_file_references = body.contains('@');
    let accepts_arguments = body.contains("$ARGUMENTS");
    
    // Extract metadata from frontmatter
    let (description, allowed_tools) = if let Some(fm) = frontmatter {
        (fm.description, fm.allowed_tools.unwrap_or_default())
    } else {
        (None, Vec::new())
    };
    
    Ok(SlashCommand {
        id,
        name,
        full_command,
        scope: scope.to_string(),
        namespace,
        file_path: file_path.to_string_lossy().to_string(),
        content: body,
        description,
        allowed_tools,
        has_bash_commands,
        has_file_references,
        accepts_arguments,
    })
}

/// Recursively find all markdown files in a directory
fn find_markdown_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        
        // Skip hidden files/directories
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }
        
        if path.is_dir() {
            find_markdown_files(&path, files)?;
        } else if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    files.push(path);
                }
            }
        }
    }
    
    Ok(())
}

/// Create default/built-in slash commands
fn create_default_commands() -> Vec<SlashCommand> {
    vec![
        SlashCommand {
            id: "default-add-dir".to_string(),
            name: "add-dir".to_string(),
            full_command: "/add-dir".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Add additional working directories".to_string(),
            description: Some("Add additional working directories".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        SlashCommand {
            id: "default-init".to_string(),
            name: "init".to_string(),
            full_command: "/init".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Initialize project with CLAUDE.md guide".to_string(),
            description: Some("Initialize project with CLAUDE.md guide".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        SlashCommand {
            id: "default-review".to_string(),
            name: "review".to_string(),
            full_command: "/review".to_string(),
            scope: "default".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Request code review".to_string(),
            description: Some("Request code review".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
    ]
}

/// Create Claude Code CLI compatible slash commands
fn create_claude_code_defaults() -> Vec<SlashCommand> {
    vec![
        SlashCommand {
            id: "claude-analyze".to_string(),
            name: "analyze".to_string(),
            full_command: "/analyze".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Analyze $ARGUMENTS for patterns, issues, and improvements. Multi-dimensional code and system analysis with evidence-based reasoning.".to_string(),
            description: Some("Multi-dimensional code analysis".to_string()),
            allowed_tools: vec!["Read".to_string(), "Grep".to_string(), "Bash".to_string(), "TodoWrite".to_string()],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-build".to_string(),
            name: "build".to_string(),
            full_command: "/build".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Build $ARGUMENTS with framework detection and optimization. Project builder with intelligent persona activation and tool orchestration.".to_string(),
            description: Some("Project builder with framework detection".to_string()),
            allowed_tools: vec!["Bash".to_string(), "Read".to_string(), "Write".to_string(), "TodoWrite".to_string()],
            has_bash_commands: true,
            has_file_references: false,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-implement".to_string(),
            name: "implement".to_string(),
            full_command: "/implement".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Implement $ARGUMENTS with intelligent framework detection and best practices. Feature and code implementation with context-aware persona activation.".to_string(),
            description: Some("Feature and code implementation".to_string()),
            allowed_tools: vec!["Write".to_string(), "Edit".to_string(), "Read".to_string(), "MultiEdit".to_string(), "TodoWrite".to_string()],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-improve".to_string(),
            name: "improve".to_string(),
            full_command: "/improve".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Improve $ARGUMENTS with evidence-based enhancements. Code enhancement with quality analysis and optimization strategies.".to_string(),
            description: Some("Evidence-based code enhancement".to_string()),
            allowed_tools: vec!["Edit".to_string(), "Read".to_string(), "Grep".to_string(), "MultiEdit".to_string(), "Bash".to_string()],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-design".to_string(),
            name: "design".to_string(),
            full_command: "/design".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Design and architect $ARGUMENTS with system-wide analysis".to_string(),
            description: Some("System design and architecture planning".to_string()),
            allowed_tools: vec!["Read".to_string(), "Write".to_string(), "TodoWrite".to_string()],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-test".to_string(),
            name: "test".to_string(),
            full_command: "/test".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Generate and run tests for $ARGUMENTS with comprehensive coverage".to_string(),
            description: Some("Testing workflow automation".to_string()),
            allowed_tools: vec!["Read".to_string(), "Write".to_string(), "Bash".to_string(), "TodoWrite".to_string()],
            has_bash_commands: true,
            has_file_references: false,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-document".to_string(),
            name: "document".to_string(),
            full_command: "/document".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Create comprehensive documentation for $ARGUMENTS".to_string(),
            description: Some("Documentation generation".to_string()),
            allowed_tools: vec!["Read".to_string(), "Write".to_string(), "TodoWrite".to_string()],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-git".to_string(),
            name: "git".to_string(),
            full_command: "/git".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Git workflow assistance for $ARGUMENTS".to_string(),
            description: Some("Git workflow automation".to_string()),
            allowed_tools: vec!["Bash".to_string(), "Read".to_string(), "Write".to_string(), "TodoWrite".to_string()],
            has_bash_commands: true,
            has_file_references: false,
            accepts_arguments: true,
        },
        // New Claude Code CLI commands (2025)
        SlashCommand {
            id: "claude-agents".to_string(),
            name: "agents".to_string(),
            full_command: "/agents".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Create and manage specialized Sub Agents for $ARGUMENTS".to_string(),
            description: Some("Sub Agent creation with domain expertise".to_string()),
            allowed_tools: vec!["Task".to_string(), "Write".to_string(), "Read".to_string(), "TodoWrite".to_string()],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-init".to_string(),
            name: "init".to_string(),
            full_command: "/init".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Create CLAUDE.md file for project-specific instructions".to_string(),
            description: Some("Initialize project configuration".to_string()),
            allowed_tools: vec!["Write".to_string(), "Read".to_string()],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        SlashCommand {
            id: "claude-clear".to_string(),
            name: "clear".to_string(),
            full_command: "/clear".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Reset the current session's context".to_string(),
            description: Some("Clear session context".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        SlashCommand {
            id: "claude-compact".to_string(),
            name: "compact".to_string(),
            full_command: "/compact".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Summarize the conversation to continue without hitting context limit".to_string(),
            description: Some("Compact conversation history".to_string()),
            allowed_tools: vec![],
            has_bash_commands: false,
            has_file_references: false,
            accepts_arguments: false,
        },
        SlashCommand {
            id: "claude-review".to_string(),
            name: "review".to_string(),
            full_command: "/review".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Review $ARGUMENTS (PR, file, or code block)".to_string(),
            description: Some("Code review assistant".to_string()),
            allowed_tools: vec!["Read".to_string(), "Grep".to_string(), "TodoWrite".to_string()],
            has_bash_commands: false,
            has_file_references: true,
            accepts_arguments: true,
        },
        SlashCommand {
            id: "claude-explain".to_string(),
            name: "explain".to_string(),
            full_command: "/explain".to_string(),
            scope: "system".to_string(),
            namespace: None,
            file_path: "".to_string(),
            content: "Explain $ARGUMENTS in detail".to_string(),
            description: Some("Code explanation assistant".to_string()),
            allowed_tools: vec!["Read".to_string(), "Grep".to_string()],
            has_bash_commands: false,
            has_file_references: true,
            accepts_arguments: true,
        },
    ]
}

/// Discover all custom slash commands
#[tauri::command]
pub async fn slash_commands_list(
    project_path: Option<String>,
    app: tauri::AppHandle,
) -> Result<Vec<SlashCommand>, String> {
    info!("Discovering slash commands");
    let mut commands = Vec::new();
    
    // Add default commands
    commands.extend(create_default_commands());
    
    // Add Claude Code CLI compatible commands
    commands.extend(create_claude_code_defaults());
    
    // Try to add synced Claude commands if available
    if let Ok(synced_commands) = crate::commands::claude_sync::get_synced_claude_commands(app.clone()).await {
        info!("Adding {} synced Claude commands", synced_commands.len());
        commands.extend(synced_commands);
    }
    
    // Load project commands if project path is provided
    if let Some(proj_path) = project_path {
        let project_commands_dir = PathBuf::from(&proj_path).join(".claude").join("commands");
        if project_commands_dir.exists() {
            debug!("Scanning project commands at: {:?}", project_commands_dir);
            
            let mut md_files = Vec::new();
            if let Err(e) = find_markdown_files(&project_commands_dir, &mut md_files) {
                error!("Failed to find project command files: {}", e);
            } else {
                for file_path in md_files {
                    match load_command_from_file(&file_path, &project_commands_dir, "project") {
                        Ok(cmd) => {
                            debug!("Loaded project command: {}", cmd.full_command);
                            commands.push(cmd);
                        }
                        Err(e) => {
                            error!("Failed to load command from {:?}: {}", file_path, e);
                        }
                    }
                }
            }
        }
    }
    
    // Load user commands
    if let Some(home_dir) = dirs::home_dir() {
        let user_commands_dir = home_dir.join(".claude").join("commands");
        if user_commands_dir.exists() {
            debug!("Scanning user commands at: {:?}", user_commands_dir);
            
            let mut md_files = Vec::new();
            if let Err(e) = find_markdown_files(&user_commands_dir, &mut md_files) {
                error!("Failed to find user command files: {}", e);
            } else {
                for file_path in md_files {
                    match load_command_from_file(&file_path, &user_commands_dir, "user") {
                        Ok(cmd) => {
                            debug!("Loaded user command: {}", cmd.full_command);
                            commands.push(cmd);
                        }
                        Err(e) => {
                            error!("Failed to load command from {:?}: {}", file_path, e);
                        }
                    }
                }
            }
        }
    }
    
    info!("Found {} slash commands", commands.len());
    Ok(commands)
}

/// Get a single slash command by ID
#[tauri::command]
pub async fn slash_command_get(command_id: String) -> Result<SlashCommand, String> {
    debug!("Getting slash command: {}", command_id);
    
    // Parse the ID to determine scope and reconstruct file path
    let parts: Vec<&str> = command_id.split('-').collect();
    if parts.len() < 2 {
        return Err("Invalid command ID".to_string());
    }
    
    // The actual implementation would need to reconstruct the path and reload the command
    // For now, we'll return a simplified error since we need AppHandle for sync
    Err("Command retrieval not implemented without AppHandle".to_string())
}

/// Create or update a slash command
#[tauri::command]
pub async fn slash_command_save(
    scope: String,
    name: String,
    namespace: Option<String>,
    content: String,
    description: Option<String>,
    allowed_tools: Vec<String>,
    project_path: Option<String>,
) -> Result<SlashCommand, String> {
    info!("Saving slash command: {} in scope: {}", name, scope);
    
    // Validate inputs
    if name.is_empty() {
        return Err("Command name cannot be empty".to_string());
    }
    
    if !["project", "user"].contains(&scope.as_str()) {
        return Err("Invalid scope. Must be 'project' or 'user'".to_string());
    }
    
    // Determine base directory
    let base_dir = if scope == "project" {
        if let Some(proj_path) = project_path {
            PathBuf::from(proj_path).join(".claude").join("commands")
        } else {
            return Err("Project path required for project scope".to_string());
        }
    } else {
        dirs::home_dir()
            .ok_or_else(|| "Could not find home directory".to_string())?
            .join(".claude")
            .join("commands")
    };
    
    // Build file path
    let mut file_path = base_dir.clone();
    if let Some(ns) = &namespace {
        for component in ns.split(':') {
            file_path = file_path.join(component);
        }
    }
    
    // Create directories if needed
    fs::create_dir_all(&file_path)
        .map_err(|e| format!("Failed to create directories: {}", e))?;
    
    // Add filename
    file_path = file_path.join(format!("{}.md", name));
    
    // Build content with frontmatter
    let mut full_content = String::new();
    
    // Add frontmatter if we have metadata
    if description.is_some() || !allowed_tools.is_empty() {
        full_content.push_str("---\n");
        
        if let Some(desc) = &description {
            full_content.push_str(&format!("description: {}\n", desc));
        }
        
        if !allowed_tools.is_empty() {
            full_content.push_str("allowed-tools:\n");
            for tool in &allowed_tools {
                full_content.push_str(&format!("  - {}\n", tool));
            }
        }
        
        full_content.push_str("---\n\n");
    }
    
    full_content.push_str(&content);
    
    // Write file
    fs::write(&file_path, &full_content)
        .map_err(|e| format!("Failed to write command file: {}", e))?;
    
    // Load and return the saved command
    load_command_from_file(&file_path, &base_dir, &scope)
        .map_err(|e| format!("Failed to load saved command: {}", e))
}

/// Delete a slash command
#[tauri::command]
pub async fn slash_command_delete(
    command_id: String, 
    project_path: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    info!("Deleting slash command: {}", command_id);
    
    // First, we need to determine if this is a project command by parsing the ID
    let is_project_command = command_id.starts_with("project-");
    
    // If it's a project command and we don't have a project path, error out
    if is_project_command && project_path.is_none() {
        return Err("Project path required to delete project commands".to_string());
    }
    
    // List all commands (including project commands if applicable)
    let commands = slash_commands_list(project_path, app).await?;
    
    // Find the command by ID
    let command = commands
        .into_iter()
        .find(|cmd| cmd.id == command_id)
        .ok_or_else(|| format!("Command not found: {}", command_id))?;
    
    // Delete the file
    fs::remove_file(&command.file_path)
        .map_err(|e| format!("Failed to delete command file: {}", e))?;
    
    // Clean up empty directories
    if let Some(parent) = Path::new(&command.file_path).parent() {
        let _ = remove_empty_dirs(parent);
    }
    
    Ok(format!("Deleted command: {}", command.full_command))
}

/// Remove empty directories recursively
fn remove_empty_dirs(dir: &Path) -> Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    
    // Check if directory is empty
    let is_empty = fs::read_dir(dir)?.next().is_none();
    
    if is_empty {
        fs::remove_dir(dir)?;
        
        // Try to remove parent if it's also empty
        if let Some(parent) = dir.parent() {
            let _ = remove_empty_dirs(parent);
        }
    }
    
    Ok(())
}
