use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub version: String,
    pub name: String,
    pub description: String,
    pub build_date: Option<String>,
}

/// Get application version and basic information
#[command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        name: env!("CARGO_PKG_NAME").to_string(),
        description: env!("CARGO_PKG_DESCRIPTION").to_string(),
        build_date: option_env!("BUILD_DATE").map(|d| d.to_string()),
    }
}

/// Get just the application version string
#[command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}