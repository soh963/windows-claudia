use anyhow::{Context, Result};
use log::{info, error, warn};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State, Emitter};
use tokio::sync::Mutex;
use std::collections::HashMap;

/// Represents the state of an execution session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionState {
    pub session_id: String,
    pub status: ExecutionStatus,
    pub can_continue: bool,
    pub checkpoint_data: Option<serde_json::Value>,
    pub elapsed_time: u64,
    pub total_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    Idle,
    Executing,
    Stopped,
    Completed,
    Error,
}

/// Global execution control state
pub struct ExecutionControlState {
    pub sessions: Arc<Mutex<HashMap<String, ExecutionState>>>,
    pub active_processes: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
}

impl Default for ExecutionControlState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            active_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// Stop execution for a specific session
#[tauri::command]
pub async fn stop_execution(
    session_id: String,
    app_handle: AppHandle,
    state: State<'_, ExecutionControlState>,
) -> Result<ExecutionState, String> {
    info!("Stopping execution for session: {}", session_id);
    
    // Update session state
    let mut sessions = state.sessions.lock().await;
    let session_state = sessions.entry(session_id.clone())
        .or_insert_with(|| ExecutionState {
            session_id: session_id.clone(),
            status: ExecutionStatus::Executing,
            can_continue: false,
            checkpoint_data: None,
            elapsed_time: 0,
            total_tokens: 0,
        });
    
    // Check if already stopped
    if session_state.status == ExecutionStatus::Stopped {
        warn!("Session {} is already stopped", session_id);
        return Ok(session_state.clone());
    }
    
    // Update status
    session_state.status = ExecutionStatus::Stopped;
    session_state.can_continue = true;
    
    // Try to kill the process if it exists
    let mut processes = state.active_processes.lock().await;
    if let Some(mut child) = processes.remove(&session_id) {
        match child.kill().await {
            Ok(_) => {
                info!("Successfully killed process for session: {}", session_id);
            }
            Err(e) => {
                error!("Failed to kill process for session {}: {}", session_id, e);
            }
        }
    }
    
    // Emit stop event
    app_handle.emit(
        &format!("execution-stopped:{}", session_id),
        &session_state,
    ).map_err(|e| format!("Failed to emit stop event: {}", e))?;
    
    Ok(session_state.clone())
}

/// Continue execution from where it was stopped
#[tauri::command]
pub async fn continue_execution(
    session_id: String,
    app_handle: AppHandle,
    state: State<'_, ExecutionControlState>,
) -> Result<ExecutionState, String> {
    info!("Continuing execution for session: {}", session_id);
    
    let mut sessions = state.sessions.lock().await;
    let session_state = sessions.get_mut(&session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;
    
    // Check if can continue
    if !session_state.can_continue {
        return Err("Session cannot be continued".to_string());
    }
    
    if session_state.status != ExecutionStatus::Stopped {
        return Err(format!("Session is not in stopped state: {:?}", session_state.status));
    }
    
    // Update status
    session_state.status = ExecutionStatus::Executing;
    session_state.can_continue = false;
    
    // Emit continue event
    app_handle.emit(
        &format!("execution-continued:{}", session_id),
        &session_state,
    ).map_err(|e| format!("Failed to emit continue event: {}", e))?;
    
    Ok(session_state.clone())
}

/// Reset execution session
#[tauri::command]
pub async fn reset_execution(
    session_id: String,
    app_handle: AppHandle,
    state: State<'_, ExecutionControlState>,
) -> Result<(), String> {
    info!("Resetting execution for session: {}", session_id);
    
    // Kill any active process
    let mut processes = state.active_processes.lock().await;
    if let Some(mut child) = processes.remove(&session_id) {
        let _ = child.kill().await;
    }
    
    // Remove session state
    let mut sessions = state.sessions.lock().await;
    sessions.remove(&session_id);
    
    // Emit reset event
    app_handle.emit(
        &format!("execution-reset:{}", session_id),
        serde_json::json!({ "session_id": session_id }),
    ).map_err(|e| format!("Failed to emit reset event: {}", e))?;
    
    Ok(())
}

/// Get execution status for a session
#[tauri::command]
pub async fn get_execution_status(
    session_id: String,
    state: State<'_, ExecutionControlState>,
) -> Result<ExecutionState, String> {
    let sessions = state.sessions.lock().await;
    
    sessions.get(&session_id)
        .cloned()
        .ok_or_else(|| format!("Session {} not found", session_id))
}

/// Update execution metrics
#[tauri::command]
pub async fn update_execution_metrics(
    session_id: String,
    elapsed_time: Option<u64>,
    total_tokens: Option<u64>,
    state: State<'_, ExecutionControlState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    
    if let Some(session_state) = sessions.get_mut(&session_id) {
        if let Some(time) = elapsed_time {
            session_state.elapsed_time = time;
        }
        if let Some(tokens) = total_tokens {
            session_state.total_tokens = tokens;
        }
        Ok(())
    } else {
        Err(format!("Session {} not found", session_id))
    }
}

/// Register a process for a session
pub async fn register_process(
    session_id: String,
    child: tokio::process::Child,
    state: &ExecutionControlState,
) -> Result<()> {
    let mut processes = state.active_processes.lock().await;
    processes.insert(session_id.clone(), child);
    
    // Initialize session state if not exists
    let mut sessions = state.sessions.lock().await;
    sessions.entry(session_id.clone())
        .or_insert_with(|| ExecutionState {
            session_id,
            status: ExecutionStatus::Executing,
            can_continue: false,
            checkpoint_data: None,
            elapsed_time: 0,
            total_tokens: 0,
        });
    
    Ok(())
}

/// Mark execution as completed
pub async fn mark_execution_completed(
    session_id: String,
    state: &ExecutionControlState,
    app_handle: &AppHandle,
) -> Result<()> {
    let mut sessions = state.sessions.lock().await;
    
    if let Some(session_state) = sessions.get_mut(&session_id) {
        session_state.status = ExecutionStatus::Completed;
        session_state.can_continue = false;
        
        // Emit completion event
        app_handle.emit(
            &format!("execution-completed:{}", session_id),
            &session_state,
        )?;
    }
    
    // Remove from active processes
    let mut processes = state.active_processes.lock().await;
    processes.remove(&session_id);
    
    Ok(())
}