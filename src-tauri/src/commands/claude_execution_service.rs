use tauri::{AppHandle, State};
use async_trait::async_trait;
use super::agents::{AgentDb};
use super::execution_service::{ExecutionService, ExecutionRequest, ExecutionResult};

pub struct ClaudeExecutionService;

#[async_trait]
impl ExecutionService for ClaudeExecutionService {
    async fn execute(
        &self,
        app: AppHandle,
        db: State<'_, AgentDb>,
        request: ExecutionRequest,
        registry: State<'_, crate::process::ProcessRegistryState>,
    ) -> Result<ExecutionResult, String> {
        let agent = request.agent;
        let task = request.task;
        let project_path = request.project_path;
        let model = request.model;

        let run_id = {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO agent_runs (agent_id, agent_name, agent_icon, task, model, project_path, session_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![agent.id.unwrap(), agent.name, agent.icon, task, model, project_path, ""],
            )
            .map_err(|e| e.to_string())?;
            conn.last_insert_rowid()
        };

        let claude_path = crate::claude_binary::find_claude_binary(&app)?;
        
        let mut args = vec![
            "-p".to_string(),
            task.clone(),
            "--system-prompt".to_string(),
            agent.system_prompt.clone(),
            "--model".to_string(),
            model.clone(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--verbose".to_string(),
            "--dangerously-skip-permissions".to_string(),
        ];

        spawn_agent_system(app, run_id, agent.id.unwrap(), agent.name, claude_path, args, project_path, task, model, db, registry, false).await?;

        // This part needs to be adapted to wait for the actual result
        // For now, we'll just return a placeholder.
        Ok(ExecutionResult {
            run_id,
            session_id: "claude-session-id".to_string(), // Placeholder
            output: "Execution started".to_string(),
            status: "running".to_string(),
        })
    }
}