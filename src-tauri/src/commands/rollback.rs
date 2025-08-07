use std::sync::Arc;
use tauri::State;
use anyhow::Result;

use crate::rollback::{GitRollbackManager, RollbackSafety, SafetyReport, RollbackStrategy, RollbackResult, GitStatus};
use crate::checkpoint::manager::CheckpointManager;

#[tauri::command]
pub async fn get_git_status(project_path: String) -> Result<GitStatus, String> {
    let path = std::path::PathBuf::from(project_path);
    
    // Create a dummy checkpoint manager for now
    let checkpoint_manager = Arc::new(CheckpointManager::new_for_rollback(path.clone()).await.map_err(|e| e.to_string())?);
    
    let git_manager = GitRollbackManager::new(path, checkpoint_manager)
        .await
        .map_err(|e| e.to_string())?;

    git_manager.get_git_status()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn analyze_rollback_strategy(
    project_path: String,
    session_id: String,
    target_message_index: usize
) -> Result<RollbackStrategy, String> {
    let path = std::path::PathBuf::from(project_path);
    
    // Create a dummy checkpoint manager for now
    let checkpoint_manager = Arc::new(CheckpointManager::new_for_rollback(path.clone()).await.map_err(|e| e.to_string())?);
    
    let git_manager = GitRollbackManager::new(path, checkpoint_manager)
        .await
        .map_err(|e| e.to_string())?;

    git_manager.analyze_rollback_strategy(&session_id, target_message_index)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_rollback_safety(
    project_path: String,
    target_state: String
) -> Result<SafetyReport, String> {
    let path = std::path::PathBuf::from(project_path);
    let safety = RollbackSafety::new(path);
    
    safety.validate_rollback(&target_state)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_safety_backup(project_path: String) -> Result<String, String> {
    let path = std::path::PathBuf::from(project_path);
    let safety = RollbackSafety::new(path);
    
    safety.create_backup()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_rollback_checkpoint(
    project_path: String,
    session_id: String,
    message_index: usize,
    operation_type: String,
    affected_files: Vec<String>
) -> Result<crate::rollback::RollbackCheckpoint, String> {
    let path = std::path::PathBuf::from(project_path);
    
    // Create a dummy checkpoint manager for now
    let checkpoint_manager = Arc::new(CheckpointManager::new_for_rollback(path.clone()).await.map_err(|e| e.to_string())?);
    
    let git_manager = GitRollbackManager::new(path, checkpoint_manager)
        .await
        .map_err(|e| e.to_string())?;

    git_manager.create_rollback_checkpoint(&session_id, message_index, &operation_type, affected_files)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn perform_rollback(
    project_path: String,
    session_id: String,
    target_message_index: usize,
    strategy: String,
    create_backup: Option<bool>
) -> Result<RollbackResult, String> {
    let path = std::path::PathBuf::from(project_path);
    let create_backup = create_backup.unwrap_or(true);
    
    // Create a dummy checkpoint manager for now
    let checkpoint_manager = Arc::new(CheckpointManager::new_for_rollback(path.clone()).await.map_err(|e| e.to_string())?);
    
    let git_manager = GitRollbackManager::new(path, checkpoint_manager)
        .await
        .map_err(|e| e.to_string())?;

    match strategy.as_str() {
        "git" => {
            // Get the commit SHA for the target message
            // This would need to be stored when creating checkpoints
            // For now, we'll return an error
            Err("Git rollback not yet implemented - commit SHA mapping needed".to_string())
        },
        "checkpoint" => {
            // Use checkpoint system
            Err("Checkpoint rollback not yet implemented".to_string())
        },
        "hybrid" => {
            // Combined approach
            Err("Hybrid rollback not yet implemented".to_string())
        },
        _ => Err("Invalid rollback strategy".to_string())
    }
}

#[tauri::command]
pub async fn get_file_history(
    project_path: String,
    file_path: String,
    limit: Option<usize>
) -> Result<Vec<crate::rollback::FileVersion>, String> {
    let path = std::path::PathBuf::from(project_path);
    let limit = limit.unwrap_or(10);
    
    // Create a dummy checkpoint manager for now
    let checkpoint_manager = Arc::new(CheckpointManager::new_for_rollback(path.clone()).await.map_err(|e| e.to_string())?);
    
    let git_manager = GitRollbackManager::new(path, checkpoint_manager)
        .await
        .map_err(|e| e.to_string())?;

    git_manager.get_file_history(&file_path, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_git_available(project_path: String) -> Result<bool, String> {
    let path = std::path::PathBuf::from(project_path);
    
    match git2::Repository::open(&path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}