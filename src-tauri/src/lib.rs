// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// Declare modules
pub mod checkpoint;
pub mod claude_binary;
pub mod commands;
pub mod analysis;
pub mod process;
pub mod sidecar_wrapper;
pub mod windows_command;
pub mod runtime_utils;
pub mod adapters;
pub mod auto_resolution;
pub mod rollback;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
