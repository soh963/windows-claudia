/// Runtime utilities for dev/build mode compatibility
use std::env;
use tauri::{AppHandle, Manager};

/// Detect if running in development mode
pub fn is_dev_mode() -> bool {
    // Multiple ways to detect dev mode
    cfg!(debug_assertions) || 
    env::var("TAURI_DEV").is_ok() || 
    env::var("TAURI_SKIP_DEVSERVER_CHECK").is_ok() ||
    env::var("NODE_ENV").map(|v| v == "development").unwrap_or(false)
}

/// Get the appropriate URL for the current mode
pub fn get_frontend_url() -> String {
    if is_dev_mode() {
        "http://localhost:1428".to_string()
    } else {
        "tauri://localhost".to_string()
    }
}

/// Get the appropriate path resolver for the current mode
pub fn resolve_path(relative_path: &str, app: &AppHandle) -> Result<String, String> {
    if is_dev_mode() {
        // In dev mode, resolve relative to the working directory
        let current_dir = env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        Ok(current_dir.join(relative_path).to_string_lossy().to_string())
    } else {
        // In build mode, resolve relative to the app directory
        let app_dir = app.path().app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))?;
        Ok(app_dir.join(relative_path).to_string_lossy().to_string())
    }
}

/// Configure environment for cross-mode compatibility
pub fn setup_environment() {
    // Set common environment variables
    if is_dev_mode() {
        env::set_var("TAURI_ENV", "development");
        log::info!("Running in development mode");
    } else {
        env::set_var("TAURI_ENV", "production");
        log::info!("Running in production mode");
    }

    // Ensure COMSPEC is properly set on Windows
    #[cfg(target_os = "windows")]
    {
        if env::var("COMSPEC").is_err() {
            env::set_var("COMSPEC", "C:\\Windows\\System32\\cmd.exe");
        }
    }
}

/// Get appropriate command execution strategy
pub fn get_command_strategy() -> CommandStrategy {
    if is_dev_mode() {
        CommandStrategy::Development
    } else {
        CommandStrategy::Production
    }
}

#[derive(Debug, Clone)]
pub enum CommandStrategy {
    Development,
    Production,
}

impl CommandStrategy {
    /// Get appropriate flags for the command strategy
    pub fn get_creation_flags(&self) -> u32 {
        match self {
            CommandStrategy::Development => {
                // In dev mode, allow some visibility for debugging
                #[cfg(target_os = "windows")]
                return 0x08000000; // CREATE_NO_WINDOW
                #[cfg(not(target_os = "windows"))]
                return 0;
            }
            CommandStrategy::Production => {
                // In production, hide window but keep pipes working
                // Don't use DETACHED_PROCESS as it can break stdout/stderr pipes
                #[cfg(target_os = "windows")]
                return 0x08000000 | 0x00000200; // CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
                #[cfg(not(target_os = "windows"))]
                return 0;
            }
        }
    }
    
    /// Get environment variables to set
    pub fn get_env_vars(&self) -> Vec<(&'static str, &'static str)> {
        match self {
            CommandStrategy::Development => vec![
                ("TAURI_ENV", "development"),
            ],
            CommandStrategy::Production => vec![
                ("TAURI_ENV", "production"),
                ("NODE_ENV", "production"),
            ],
        }
    }
    
    /// Get environment variables to remove (for Windows compatibility)
    pub fn get_env_vars_to_remove(&self) -> Vec<&'static str> {
        vec![
            "MSYSTEM",
            "MSYS",
            "MINGW_PREFIX", 
            "MSYSTEM_PREFIX",
            "MSYS2_PATH_TYPE",
            "ORIGINAL_PATH",
            "BASH_ENV",
        ]
    }
}

/// Cross-mode logging setup
pub fn setup_logging() {
    let log_level = if is_dev_mode() {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };
    
    env_logger::Builder::from_default_env()
        .filter_level(log_level)
        .init();
}