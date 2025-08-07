use anyhow::{Result, anyhow};
use git2::{Repository, Signature, Tree, Oid, ObjectType, Status};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use sha2::{Sha256, Digest};

use crate::checkpoint::manager::CheckpointManager;
use super::types::*;

pub struct GitRollbackManager {
    project_path: PathBuf,
    checkpoint_manager: Arc<CheckpointManager>,
    git_available: bool,
}

impl GitRollbackManager {
    pub async fn new(project_path: PathBuf, checkpoint_manager: Arc<CheckpointManager>) -> Result<Self> {
        let git_available = Self::check_git_repository(&project_path).await;
        
        Ok(Self {
            project_path,
            checkpoint_manager,
            git_available,
        })
    }

    async fn check_git_repository(path: &Path) -> bool {
        match Repository::open(path) {
            Ok(_) => true,
            Err(_) => false,
        }
    }

    pub async fn get_git_status(&self) -> Result<GitStatus> {
        if !self.git_available {
            return Ok(GitStatus {
                is_repository: false,
                has_uncommitted: false,
                current_branch: None,
                ahead_commits: 0,
                behind_commits: 0,
                modified_files: Vec::new(),
                untracked_files: Vec::new(),
            });
        }

        let mut repo = Repository::open(&self.project_path)?;
        
        // Get current branch
        let head = repo.head()?;
        let current_branch = head.shorthand().map(|s| s.to_string());
        
        // Check for uncommitted changes
        let mut modified_files = Vec::new();
        let mut untracked_files = Vec::new();
        let mut has_uncommitted = false;
        
        let statuses = repo.statuses(None)?;
        for entry in statuses.iter() {
            let flags = entry.status();
            let path = entry.path().unwrap_or("").to_string();
            
            if flags.contains(Status::WT_MODIFIED) || 
               flags.contains(Status::WT_DELETED) ||
               flags.contains(Status::INDEX_MODIFIED) ||
               flags.contains(Status::INDEX_DELETED) {
                modified_files.push(path);
                has_uncommitted = true;
            } else if flags.contains(Status::WT_NEW) {
                untracked_files.push(path);
                has_uncommitted = true;
            }
        }

        Ok(GitStatus {
            is_repository: true,
            has_uncommitted,
            current_branch,
            ahead_commits: 0, // TODO: Calculate ahead/behind commits
            behind_commits: 0,
            modified_files,
            untracked_files,
        })
    }

    pub async fn create_safety_commit(&self, message: &str) -> Result<String> {
        if !self.git_available {
            return Err(anyhow!("Git repository not available"));
        }

        let mut repo = Repository::open(&self.project_path)?;
        
        // Add all modified files to index
        let mut index = repo.index()?;
        index.add_all(["."], git2::IndexAddOption::DEFAULT, None)?;
        index.write()?;
        
        // Create signature
        let signature = Self::create_signature(&repo)?;
        
        // Get tree
        let tree_id = index.write_tree()?;
        let tree = repo.find_tree(tree_id)?;
        
        // Get parent commit
        let parent_commit = match repo.head() {
            Ok(head) => Some(head.peel_to_commit()?),
            Err(_) => None, // Initial commit
        };
        
        // Create commit
        let commit_id = match parent_commit {
            Some(parent) => {
                repo.commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    message,
                    &tree,
                    &[&parent],
                )?
            },
            None => {
                repo.commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    message,
                    &tree,
                    &[],
                )?
            }
        };

        Ok(commit_id.to_string())
    }

    pub async fn create_stash(&self, message: Option<&str>) -> Result<String> {
        if !self.git_available {
            return Err(anyhow!("Git repository not available"));
        }

        let mut repo = Repository::open(&self.project_path)?;
        let signature = Self::create_signature(&repo)?;
        
        let stash_message = message.unwrap_or("Automatic stash before rollback");
        
        let stash_id = repo.stash_save(&signature, stash_message, None)?;
        Ok(stash_id.to_string())
    }

    pub async fn rollback_to_commit(&self, commit_sha: &str, create_backup: bool) -> Result<RollbackResult> {
        if !self.git_available {
            return Err(anyhow!("Git repository not available"));
        }

        let mut repo = Repository::open(&self.project_path)?;
        
        // Parse commit SHA
        let commit_oid = Oid::from_str(commit_sha)?;
        let commit = repo.find_commit(commit_oid)?;
        
        // Create backup commit if requested
        let backup_sha = if create_backup {
            Some(self.create_safety_commit("Backup before rollback").await?)
        } else {
            None
        };

        let mut result = RollbackResult {
            success: false,
            strategy_used: RollbackStrategyType::Git,
            files_restored: Vec::new(),
            backup_created: backup_sha,
            commit_sha: Some(commit_sha.to_string()),
            errors: Vec::new(),
            warnings: Vec::new(),
        };

        // Get list of files that will be affected
        let current_tree = repo.head()?.peel_to_tree()?;
        let target_tree = commit.tree()?;
        
        let mut diff_opts = git2::DiffOptions::new();
        let diff = repo.diff_tree_to_tree(Some(&current_tree), Some(&target_tree), Some(&mut diff_opts))?;
        
        diff.foreach(
            &mut |delta, _progress| {
                if let Some(path) = delta.new_file().path() {
                    result.files_restored.push(path.to_string_lossy().to_string());
                }
                true
            },
            None,
            None,
            None,
        )?;

        // Perform hard reset
        let object = repo.find_object(commit_oid, Some(ObjectType::Commit))?;
        repo.reset(&object, git2::ResetType::Hard, None)?;
        
        result.success = true;
        Ok(result)
    }

    pub async fn restore_from_stash(&self, stash_id: &str) -> Result<()> {
        if !self.git_available {
            return Err(anyhow!("Git repository not available"));
        }

        let mut repo = Repository::open(&self.project_path)?;
        let stash_oid = Oid::from_str(stash_id)?;
        
        // Find stash index by OID
        let mut stash_index = None;
        repo.stash_foreach(|index, _message, oid| {
            if *oid == stash_oid {
                stash_index = Some(index);
                false // Stop iteration
            } else {
                true // Continue
            }
        })?;

        if let Some(index) = stash_index {
            repo.stash_pop(index, None)?;
        } else {
            return Err(anyhow!("Stash not found"));
        }

        Ok(())
    }

    pub async fn get_file_history(&self, file_path: &str, limit: usize) -> Result<Vec<FileVersion>> {
        if !self.git_available {
            return Ok(Vec::new());
        }

        let mut repo = Repository::open(&self.project_path)?;
        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;
        revwalk.set_sorting(git2::Sort::TIME)?;

        let mut versions = Vec::new();
        let mut count = 0;

        for oid in revwalk {
            if count >= limit {
                break;
            }

            let oid = oid?;
            let commit = repo.find_commit(oid)?;
            let tree = commit.tree()?;

            // Check if file exists in this commit
            if let Ok(entry) = tree.get_path(Path::new(file_path)) {
                let object = entry.to_object(&repo)?;
                let blob = object.as_blob().ok_or_else(|| anyhow!("Not a blob"))?;
                
                let content_hash = format!("{:x}", Sha256::digest(blob.content()));
                
                versions.push(FileVersion {
                    path: file_path.to_string(),
                    content_hash,
                    commit_sha: oid.to_string(),
                    timestamp: DateTime::<Utc>::from_timestamp(commit.time().seconds(), 0)
                        .unwrap_or_else(|| Utc::now()),
                    author: commit.author().name().unwrap_or("Unknown").to_string(),
                    message: commit.message().unwrap_or("No message").to_string(),
                });
                
                count += 1;
            }
        }

        Ok(versions)
    }

    pub async fn create_rollback_checkpoint(
        &self, 
        session_id: &str,
        message_index: usize,
        operation_type: &str,
        affected_files: Vec<String>
    ) -> Result<RollbackCheckpoint> {
        // Create safety commit first
        let commit_message = format!("Auto-checkpoint: {} (session: {}, msg: {})", 
            operation_type, session_id, message_index);
        
        let git_commit_sha = if self.git_available {
            match self.create_safety_commit(&commit_message).await {
                Ok(sha) => Some(sha),
                Err(e) => {
                    log::warn!("Failed to create git commit: {}", e);
                    None
                }
            }
        } else {
            None
        };

        // Create stash for uncommitted changes
        let stash_id = if self.git_available {
            let status = self.get_git_status().await?;
            if status.has_uncommitted {
                match self.create_stash(Some(&format!("Auto-stash for {}", operation_type))).await {
                    Ok(id) => Some(id),
                    Err(e) => {
                        log::warn!("Failed to create stash: {}", e);
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        };

        let checkpoint = RollbackCheckpoint {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            message_index,
            timestamp: Utc::now(),
            git_commit_sha,
            stash_id,
            affected_files,
            operation_type: operation_type.to_string(),
            auto_created: true,
            description: commit_message,
        };

        Ok(checkpoint)
    }

    fn create_signature(repo: &Repository) -> Result<Signature<'static>> {
        // Try to get signature from git config
        let config = repo.config()?;
        
        let name = config.get_string("user.name")
            .unwrap_or_else(|_| "Claudia AI".to_string());
        let email = config.get_string("user.email")
            .unwrap_or_else(|_| "claudia@ai.assistant".to_string());
        
        Ok(Signature::now(&name, &email)?)
    }

    pub async fn analyze_rollback_strategy(
        &self,
        session_id: &str,
        target_message_index: usize
    ) -> Result<RollbackStrategy> {
        let git_status = self.get_git_status().await?;
        
        // Check if checkpoint exists
        let checkpoint_available = self.checkpoint_manager
            .get_checkpoint_for_message(session_id, target_message_index)
            .await
            .is_ok();

        let mut strategy = if git_status.is_repository && !git_status.has_uncommitted {
            RollbackStrategy {
                strategy_type: RollbackStrategyType::Git,
                confidence: 0.95,
                warnings: Vec::new(),
                recommendations: vec!["Git rollback is the safest option".to_string()],
                estimated_changes: git_status.modified_files.len(),
                can_proceed: true,
            }
        } else if checkpoint_available {
            let mut warnings = Vec::new();
            if git_status.has_uncommitted {
                warnings.push("Uncommitted changes will be lost".to_string());
            }
            
            RollbackStrategy {
                strategy_type: RollbackStrategyType::Checkpoint,
                confidence: 0.85,
                warnings,
                recommendations: vec!["Checkpoint restore available".to_string()],
                estimated_changes: git_status.modified_files.len(),
                can_proceed: true,
            }
        } else {
            RollbackStrategy {
                strategy_type: RollbackStrategyType::Hybrid,
                confidence: 0.7,
                warnings: vec!["Manual file restoration required".to_string()],
                recommendations: vec!["Create backup before proceeding".to_string()],
                estimated_changes: git_status.modified_files.len(),
                can_proceed: false,
            }
        };

        // Add additional warnings based on git status
        if git_status.has_uncommitted && git_status.modified_files.len() > 10 {
            strategy.warnings.push(format!("{} modified files will be lost", git_status.modified_files.len()));
            strategy.confidence -= 0.1;
        }

        if !git_status.untracked_files.is_empty() {
            strategy.warnings.push(format!("{} untracked files present", git_status.untracked_files.len()));
        }

        Ok(strategy)
    }
}