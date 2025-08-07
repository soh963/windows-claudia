use anyhow::Result;
use std::path::{Path, PathBuf};
use std::fs;
use sysinfo::{System, Process};
use super::types::SafetyReport;

pub struct RollbackSafety {
    project_path: PathBuf,
}

impl RollbackSafety {
    pub fn new(project_path: PathBuf) -> Self {
        Self { project_path }
    }

    pub async fn validate_rollback(&self, _target_state: &str) -> Result<SafetyReport> {
        let mut report = SafetyReport::default();

        // Check for running processes that might interfere
        if let Some(running_processes) = self.check_running_processes().await {
            if !running_processes.is_empty() {
                report.warnings.push(format!(
                    "Found {} potentially interfering processes", 
                    running_processes.len()
                ));
                
                // If critical processes are running, prevent rollback
                for process in &running_processes {
                    if self.is_critical_process(process) {
                        report.errors.push(format!("Critical process '{}' must be stopped", process));
                        report.can_proceed = false;
                    }
                }
            }
        }

        // Check for file locks
        let locked_files = self.check_file_locks().await?;
        if !locked_files.is_empty() {
            report.locked_files = locked_files.clone();
            report.warnings.push(format!("{} files are currently locked", locked_files.len()));
            
            // If too many files are locked, recommend waiting
            if locked_files.len() > 5 {
                report.requires_confirmation = true;
                report.warnings.push("Many files are locked. Consider waiting before rollback.".to_string());
            }
        }

        // Check available disk space
        if let Ok(available_space) = self.check_available_space().await {
            let required_space = self.estimate_backup_size().await.unwrap_or(0);
            if available_space < required_space * 2 { // 2x safety margin
                report.warnings.push("Low disk space. Backup creation may fail.".to_string());
                report.backup_recommended = false;
            } else {
                report.backup_recommended = true;
            }
        }

        // Estimate the number of changes
        report.estimated_changes = self.calculate_estimated_changes().await.unwrap_or(0);
        
        // If many changes, require confirmation
        if report.estimated_changes > 50 {
            report.requires_confirmation = true;
            report.warnings.push(format!(
                "Large number of changes detected ({}). Please confirm.", 
                report.estimated_changes
            ));
        }

        // Check for uncommitted changes in version control
        if let Ok(uncommitted) = self.check_uncommitted_changes().await {
            report.uncommitted_files = uncommitted;
            if !report.uncommitted_files.is_empty() {
                report.requires_confirmation = true;
                report.warnings.push(format!(
                    "{} uncommitted changes will be lost", 
                    report.uncommitted_files.len()
                ));
            }
        }

        Ok(report)
    }

    pub async fn create_backup(&self) -> Result<String> {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let backup_name = format!("claudia_backup_{}", timestamp);
        let backup_path = self.project_path.parent()
            .unwrap_or(&self.project_path)
            .join(&backup_name);

        // Create backup directory
        fs::create_dir_all(&backup_path)?;

        // Copy important files (excluding common ignore patterns)
        self.copy_project_files(&self.project_path, &backup_path).await?;

        Ok(backup_path.to_string_lossy().to_string())
    }

    async fn copy_project_files(&self, source: &Path, dest: &Path) -> Result<()> {
        let ignore_patterns = vec![
            ".git",
            "node_modules",
            "target",
            "dist",
            "build",
            ".claudia",
            "*.log",
            "*.tmp",
        ];

        for entry in walkdir::WalkDir::new(source)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let relative_path = path.strip_prefix(source)?;

            // Skip ignored patterns
            if ignore_patterns.iter().any(|pattern| {
                relative_path.to_string_lossy().contains(pattern)
            }) {
                continue;
            }

            let dest_path = dest.join(relative_path);

            if entry.file_type().is_dir() {
                fs::create_dir_all(&dest_path)?;
            } else {
                if let Some(parent) = dest_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::copy(path, &dest_path)?;
            }
        }

        Ok(())
    }

    async fn check_running_processes(&self) -> Option<Vec<String>> {
        let mut system = System::new_all();
        system.refresh_all();

        let potentially_interfering = vec![
            "code", "vscode", "atom", "sublime", "vim", "nvim", "emacs",
            "node", "npm", "yarn", "cargo", "rustc",
            "git", "svn", "hg",
        ];

        let running_processes: Vec<String> = system
            .processes()
            .values()
            .filter_map(|process| {
                let name = process.name().to_string_lossy().to_lowercase();
                if potentially_interfering.iter().any(|&pattern| name.contains(pattern)) {
                    Some(process.name().to_string_lossy().to_string())
                } else {
                    None
                }
            })
            .collect();

        if running_processes.is_empty() {
            None
        } else {
            Some(running_processes)
        }
    }

    fn is_critical_process(&self, process_name: &str) -> bool {
        let critical_patterns = vec!["cargo", "rustc", "node", "npm"];
        let lower_name = process_name.to_lowercase();
        critical_patterns.iter().any(|&pattern| lower_name.contains(pattern))
    }

    async fn check_file_locks(&self) -> Result<Vec<String>> {
        let mut locked_files = Vec::new();

        // Simple check: try to open files in write mode
        for entry in walkdir::WalkDir::new(&self.project_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let path = entry.path();
            
            // Skip binary files and large files
            if let Ok(metadata) = fs::metadata(path) {
                if metadata.len() > 10_000_000 { // Skip files > 10MB
                    continue;
                }
            }

            // Try to open for writing
            if let Err(_) = fs::OpenOptions::new()
                .write(true)
                .append(true)
                .open(path)
            {
                locked_files.push(path.to_string_lossy().to_string());
            }
        }

        Ok(locked_files)
    }

    async fn check_available_space(&self) -> Result<u64> {
        let metadata = fs::metadata(&self.project_path)?;
        
        // This is a simplified implementation
        // In a real implementation, you'd use platform-specific APIs
        // to get actual available disk space
        
        Ok(1_000_000_000) // Return 1GB as placeholder
    }

    async fn estimate_backup_size(&self) -> Result<u64> {
        let mut total_size = 0u64;

        for entry in walkdir::WalkDir::new(&self.project_path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if let Ok(metadata) = fs::metadata(entry.path()) {
                total_size += metadata.len();
            }
        }

        Ok(total_size)
    }

    async fn calculate_estimated_changes(&self) -> Result<usize> {
        // This would integrate with git status or file modification tracking
        // For now, return a placeholder
        Ok(0)
    }

    async fn check_uncommitted_changes(&self) -> Result<Vec<String>> {
        // This would integrate with git2 to check for uncommitted changes
        // For now, return empty list
        Ok(Vec::new())
    }

    pub async fn validate_rollback_safety(
        project_path: &Path,
        target_state: &str
    ) -> Result<SafetyReport> {
        let safety = RollbackSafety::new(project_path.to_path_buf());
        safety.validate_rollback(target_state).await
    }
}