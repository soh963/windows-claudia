use std::env;
use std::path::{Path, PathBuf};
use std::fs::canonicalize;
use tauri::State;
use crate::commands::agents::AgentDb;
use serde::{Deserialize, Serialize};
use rusqlite::OptionalExtension;
use log::{debug, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub path: String,
    pub name: Option<String>,
    pub created_at: String,
    pub last_accessed: Option<String>,
    pub sessions_count: Option<i32>,
}

/// Normalize and canonicalize a path for consistent comparison
pub fn normalize_path(path: &str) -> Result<String, String> {
    debug!("Normalizing path: {}", path);
    
    // First, check if path exists and try to canonicalize
    match canonicalize(path) {
        Ok(canonical) => {
            let result = canonical.to_string_lossy().to_string();
            debug!("Canonicalized path: {} -> {}", path, result);
            Ok(result)
        }
        Err(e) => {
            warn!("Failed to canonicalize path '{}': {}", path, e);
            
            // If canonicalization fails, check if path exists
            if !Path::new(path).exists() {
                return Err(format!("Path does not exist: {}", path));
            }
            
            // Try to normalize without canonicalization
            let path_buf = PathBuf::from(path);
            let normalized = if path_buf.is_absolute() {
                path_buf
            } else {
                env::current_dir()
                    .map_err(|e| format!("Failed to get current directory: {}", e))?
                    .join(path_buf)
            };
            
            let result = normalized.to_string_lossy().to_string();
            debug!("Normalized path without canonicalization: {} -> {}", path, result);
            Ok(result)
        }
    }
}

/// Check if two paths refer to the same location
pub fn paths_equal(path1: &str, path2: &str) -> bool {
    // Try exact match first
    if path1 == path2 {
        return true;
    }
    
    // Try normalized comparison
    if let (Ok(norm1), Ok(norm2)) = (normalize_path(path1), normalize_path(path2)) {
        norm1 == norm2
    } else {
        false
    }
}

#[tauri::command]
pub async fn get_current_working_project(db: State<'_, AgentDb>) -> Result<Option<Project>, String> {
    // Get current working directory
    let current_dir = env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    
    let current_path = current_dir.to_string_lossy().to_string();
    
    // Get database connection
    let conn = db.0.lock().unwrap();
    
    // Check if this directory is a known project
    match get_project_by_path_sync(&*conn, &current_path) {
        Ok(Some(project)) => Ok(Some(project)),
        Ok(None) => {
            // Check parent directories (up to 3 levels)
            let mut parent_path = current_dir.clone();
            for _ in 0..3 {
                if let Some(parent) = parent_path.parent() {
                    parent_path = parent.to_path_buf();
                    let parent_str = parent_path.to_string_lossy().to_string();
                    
                    if let Ok(Some(project)) = get_project_by_path_sync(&*conn, &parent_str) {
                        return Ok(Some(project));
                    }
                }
            }
            Ok(None)
        }
        Err(e) => Err(format!("Database error: {}", e))
    }
}

fn get_project_by_path_sync(conn: &rusqlite::Connection, path: &str) -> Result<Option<Project>, rusqlite::Error> {
    let query = "SELECT id, path, name, created_at FROM projects WHERE path = ?";
    
    let mut stmt = conn.prepare(query)?;
    let project = stmt.query_row([path], |row| {
        Ok(Project {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
            last_accessed: None,
            sessions_count: None,
        })
    }).optional()?;
    
    Ok(project)
}

fn get_project_by_id_sync(conn: &rusqlite::Connection, id: &str) -> Result<Option<Project>, rusqlite::Error> {
    let query = "SELECT id, path, name, created_at FROM projects WHERE id = ?";
    
    let mut stmt = conn.prepare(query)?;
    let project = stmt.query_row([id], |row| {
        Ok(Project {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
            last_accessed: None,
            sessions_count: None,
        })
    }).optional()?;
    
    Ok(project)
}

#[tauri::command]
pub async fn get_recent_projects(db: State<'_, AgentDb>, limit: i32) -> Result<Vec<Project>, String> {
    let conn = db.0.lock().unwrap();
    
    let query = r#"
        SELECT p.id, p.path, p.name, p.created_at,
               COUNT(DISTINCT s.id) as sessions_count,
               MAX(s.created_at) as last_accessed
        FROM projects p
        LEFT JOIN sessions s ON p.id = s.project_id
        GROUP BY p.id
        ORDER BY last_accessed DESC
        LIMIT ?
    "#;
    
    let mut stmt = conn.prepare(query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let projects = stmt.query_map([limit], |row| {
        Ok(Project {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            created_at: row.get(3)?,
            sessions_count: row.get(4)?,
            last_accessed: row.get(5)?,
        })
    })
    .map_err(|e| format!("Failed to execute query: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect results: {}", e))?;
    
    Ok(projects)
}

#[tauri::command]
pub async fn create_project_if_not_exists(
    db: State<'_, AgentDb>,
    path: String,
    name: Option<String>
) -> Result<Project, String> {
    debug!("Creating project if not exists: {}", path);
    
    // Normalize the path to handle different representations
    let canonical_path = match normalize_path(&path) {
        Ok(p) => p,
        Err(e) => {
            warn!("Path normalization failed for '{}': {}", path, e);
            return Err(format!("Invalid project path '{}': {}", path, e));
        }
    };
    
    debug!("Normalized path: {} -> {}", path, canonical_path);
    
    let conn = db.0.lock().unwrap();
    
    // Check if project already exists using canonical path
    if let Ok(Some(existing)) = get_project_by_path_sync(&*conn, &canonical_path) {
        debug!("Project already exists with canonical path: {}", canonical_path);
        return Ok(existing);
    }
    
    // Also check using original path for backward compatibility
    if canonical_path != path {
        if let Ok(Some(existing)) = get_project_by_path_sync(&*conn, &path) {
            debug!("Project already exists with original path: {}", path);
            return Ok(existing);
        }
    }
    
    // Create new project with canonical path
    let project_name = name.unwrap_or_else(|| {
        PathBuf::from(&canonical_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unnamed Project")
            .to_string()
    });
    
    debug!("Creating new project: {} at {}", project_name, canonical_path);
    
    let project_id = uuid::Uuid::new_v4().to_string();
    
    let query = r#"
        INSERT INTO projects (id, path, name, created_at)
        VALUES (?, ?, ?, datetime('now'))
    "#;
    
    conn.execute(
        query,
        rusqlite::params![&project_id, &canonical_path, &project_name],
    )
    .map_err(|e| format!("Failed to create project: {}", e))?;
    
    // Return the created project
    get_project_by_id_sync(&*conn, &project_id)
        .map_err(|e| format!("Failed to fetch created project: {}", e))?
        .ok_or_else(|| "Failed to find created project".to_string())
}