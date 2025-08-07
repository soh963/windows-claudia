use tauri::command;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct VersionInfo {
    pub version: String,
    pub build_time: String,
    pub git_commit: Option<String>,
    pub tauri_version: String,
}

#[command]
pub async fn get_version_info() -> Result<VersionInfo, String> {
    let version = env!("PACKAGE_VERSION", "unknown");
    let build_time = env!("BUILD_TIME", "unknown");
    let git_commit = option_env!("GIT_COMMIT").map(|s| s.to_string());
    let tauri_version = env!("CARGO_PKG_VERSION");

    Ok(VersionInfo {
        version: version.to_string(),
        build_time: build_time.to_string(),
        git_commit,
        tauri_version: tauri_version.to_string(),
    })
}