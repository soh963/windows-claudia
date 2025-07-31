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
        // Combine CREATE_NO_WINDOW with CREATE_NEW_PROCESS_GROUP for better window suppression
        cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
    }
    
    cmd
}

/// Creates a tokio::process::Command configured to run without a visible window on Windows
pub fn create_hidden_tokio_command(program: &str) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    
    #[cfg(target_os = "windows")]
    {
        // Combine CREATE_NO_WINDOW with CREATE_NEW_PROCESS_GROUP for better window suppression
        cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
    }
    
    cmd
}

/// Executes a .cmd file on Windows without showing a console window
#[cfg(target_os = "windows")]
pub fn execute_cmd_file_hidden(cmd_path: &str, args: Vec<String>) -> std::process::Command {
    let comspec = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
    let mut cmd = std::process::Command::new(&comspec);
    
    // Use /c to execute and close
    cmd.arg("/c");
    cmd.arg(cmd_path);
    
    // Add all arguments
    for arg in args {
        cmd.arg(arg);
    }
    
    // Apply all flags to ensure no window appears
    cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS);
    
    cmd
}

/// Executes a .cmd file on Windows without showing a console window (tokio version)
#[cfg(target_os = "windows")]
pub fn execute_cmd_file_hidden_tokio(cmd_path: &str, args: Vec<String>) -> tokio::process::Command {
    let comspec = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
    let mut cmd = tokio::process::Command::new(&comspec);
    
    // Use /c to execute and close
    cmd.arg("/c");
    cmd.arg(cmd_path);
    
    // Add all arguments
    for arg in args {
        cmd.arg(arg);
    }
    
    // Apply all flags to ensure no window appears
    cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS);
    
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