use tauri::{AppHandle, State};
use async_trait::async_trait;
use super::agents::AgentDb;
use super::execution_service::{ExecutionService, ExecutionRequest, ExecutionResult};
use super::ollama; // Assuming ollama execution logic is here

pub struct OllamaExecutionService;

#[async_trait]
impl ExecutionService for OllamaExecutionService {
    async fn execute(
        &self,
        _app: AppHandle,
        db: State<'_, AgentDb>,
        request: ExecutionRequest,
        _registry: State<'_, crate::process::ProcessRegistryState>,
    ) -> Result<ExecutionResult, String> {
        let agent = request.agent;
        let task = request.task;
        let model = request.model;

        let run_id = {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO agent_runs (agent_id, agent_name, agent_icon, task, model, project_path, session_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![agent.id.unwrap(), agent.name, agent.icon, task, model.clone(), request.project_path, ""],
            )
            .map_err(|e| e.to_string())?;
            conn.last_insert_rowid()
        };

        // This is a simplified placeholder.
        // A real implementation would call the Ollama API, handle tool calls, and stream results.
        let result = ollama::execute_ollama_request(model, task, Some(agent.system_prompt)).await?;

        Ok(ExecutionResult {
            run_id,
            session_id: format!("ollama-session-{}", run_id), // Placeholder
            output: result, // Assuming the result is a string
            status: "completed".to_string(),
        })
    }
}