/// Windows-specific command execution utilities
/// Ensures all commands are executed without visible console windows

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
#[cfg(target_os = "windows")]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
#[cfg(target_os = "windows")]
const DETACHED_PROCESS: u32 = 0x00000008;

/// Creates a std::process::Command configured to run without a visible window on Windows
pub fn create_hidden_std_command(program: &str) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    
    #[cfg(target_os = "windows")]
    {
        // Use runtime strategy to determine appropriate flags
        let strategy = crate::runtime_utils::get_command_strategy();
        cmd.creation_flags(strategy.get_creation_flags());
    }
    
    cmd
}

/// Creates a tokio::process::Command configured to run without a visible window on Windows
pub fn create_hidden_tokio_command(program: &str) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    
    #[cfg(target_os = "windows")]
    {
        // Use runtime strategy to determine appropriate flags
        let strategy = crate::runtime_utils::get_command_strategy();
        cmd.creation_flags(strategy.get_creation_flags());
    }
    
    cmd
}

/// Executes a .cmd file on Windows without showing a console window
#[cfg(target_os = "windows")]
pub fn execute_cmd_file_hidden(cmd_path: &str, args: Vec<String>) -> std::process::Command {
    // Force use of system cmd.exe to avoid MSYS2/Git Bash path issues
    let comspec = "C:\\Windows\\System32\\cmd.exe";
    let mut cmd = std::process::Command::new(comspec);
    
    // Use /c to execute and close
    cmd.arg("/c");
    cmd.arg(cmd_path);
    
    // Add all arguments
    for arg in args {
        cmd.arg(arg);
    }
    
    // Use runtime strategy to determine appropriate flags
    let strategy = crate::runtime_utils::get_command_strategy();
    cmd.creation_flags(strategy.get_creation_flags());
    
    cmd
}

/// Executes a .cmd file on Windows without showing a console window (tokio version)
#[cfg(target_os = "windows")]
pub fn execute_cmd_file_hidden_tokio(cmd_path: &str, args: Vec<String>) -> tokio::process::Command {
    use crate::runtime_utils::get_command_strategy;
    
    // Force use of system cmd.exe to avoid MSYS2/Git Bash path issues
    let comspec = "C:\\Windows\\System32\\cmd.exe";
    let mut cmd = tokio::process::Command::new(comspec);
    
    // Use /c to execute and close
    cmd.arg("/c");
    
    // Add the cmd file path WITHOUT quotes here - cmd.exe handles it
    cmd.arg(cmd_path);
    
    // Add all arguments individually
    for arg in args {
        cmd.arg(arg);
    }
    
    // Apply runtime-aware environment configuration
    let strategy = get_command_strategy();
    
    // Clear problematic environment variables
    for env_var in strategy.get_env_vars_to_remove() {
        cmd.env_remove(env_var);
    }
    
    // Set appropriate environment variables
    for (key, value) in strategy.get_env_vars() {
        cmd.env(key, value);
    }
    cmd.env("COMSPEC", comspec);
    
    // Apply runtime-appropriate creation flags
    cmd.creation_flags(strategy.get_creation_flags());
    
    cmd
}

/// Execute a .cmd file on non-Windows platforms (fallback)
#[cfg(not(target_os = "windows"))]
pub fn execute_cmd_file_hidden(cmd_path: &str, args: Vec<String>) -> std::process::Command {
    let mut cmd = std::process::Command::new("sh");
    cmd.arg("-c");
    cmd.arg(cmd_path);
    for arg in args {
        cmd.arg(arg);
    }
    cmd
}

/// Execute a .cmd file on non-Windows platforms (tokio version)
#[cfg(not(target_os = "windows"))]
pub fn execute_cmd_file_hidden_tokio(cmd_path: &str, args: Vec<String>) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new("sh");
    cmd.arg("-c");
    cmd.arg(cmd_path);
    for arg in args {
        cmd.arg(arg);
    }
    cmd
}