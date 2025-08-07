use std::fs;
use std::path::Path;

fn main() {
    // Read version from package.json
    let package_json_path = Path::new("../package.json");
    if package_json_path.exists() {
        if let Ok(content) = fs::read_to_string(package_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(version) = json.get("version").and_then(|v| v.as_str()) {
                    println!("cargo:rustc-env=PACKAGE_VERSION={}", version);
                }
            }
        }
    }

    // Get build timestamp
    let build_time = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
    println!("cargo:rustc-env=BUILD_TIME={}", build_time);

    // Get git commit hash if available
    if let Ok(output) = std::process::Command::new("git")
        .args(&["rev-parse", "--short", "HEAD"])
        .output()
    {
        if output.status.success() {
            let commit = String::from_utf8_lossy(&output.stdout).trim().to_string();
            println!("cargo:rustc-env=GIT_COMMIT={}", commit);
        }
    }

    // Run tauri build
    tauri_build::build()
}
