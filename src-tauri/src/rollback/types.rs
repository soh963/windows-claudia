use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackCheckpoint {
    pub id: String,
    pub session_id: String,
    pub message_index: usize,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub git_commit_sha: Option<String>,
    pub stash_id: Option<String>,
    pub affected_files: Vec<String>,
    pub operation_type: String,
    pub auto_created: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersion {
    pub path: String,
    pub content_hash: String,
    pub commit_sha: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub author: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackStrategy {
    pub strategy_type: RollbackStrategyType,
    pub confidence: f32,
    pub warnings: Vec<String>,
    pub recommendations: Vec<String>,
    pub estimated_changes: usize,
    pub can_proceed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RollbackStrategyType {
    Git,
    Checkpoint,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackResult {
    pub success: bool,
    pub strategy_used: RollbackStrategyType,
    pub files_restored: Vec<String>,
    pub backup_created: Option<String>,
    pub commit_sha: Option<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyReport {
    pub can_proceed: bool,
    pub requires_confirmation: bool,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub estimated_changes: usize,
    pub uncommitted_files: Vec<String>,
    pub locked_files: Vec<String>,
    pub backup_recommended: bool,
}

impl Default for SafetyReport {
    fn default() -> Self {
        Self {
            can_proceed: true,
            requires_confirmation: false,
            warnings: Vec::new(),
            errors: Vec::new(),
            estimated_changes: 0,
            uncommitted_files: Vec::new(),
            locked_files: Vec::new(),
            backup_recommended: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub is_repository: bool,
    pub has_uncommitted: bool,
    pub current_branch: Option<String>,
    pub ahead_commits: usize,
    pub behind_commits: usize,
    pub modified_files: Vec<String>,
    pub untracked_files: Vec<String>,
}