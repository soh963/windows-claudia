use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use async_trait::async_trait;
use super::agents::{Agent, AgentDb};

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionRequest {
    pub agent: Agent,
    pub task: String,
    pub project_path: String,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub run_id: i64,
    pub session_id: String,
    pub output: String,
    pub status: String, // e.g., "completed", "failed"
}

#[async_trait]
pub trait ExecutionService: Send + Sync {
    async fn execute(
        &self,
        app: AppHandle,
        db: State<'_, AgentDb>,
        request: ExecutionRequest,
        registry: State<'_, crate::process::ProcessRegistryState>,
    ) -> Result<ExecutionResult, String>;
}