use anyhow::Result;
use log::{error, info};
use rusqlite::{params, Connection, OptionalExtension, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use tauri::State;

use super::agents::AgentDb;

/// Project Health Metrics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectHealthMetric {
    pub id: Option<i64>,
    pub project_id: String,
    pub metric_type: String, // 'security', 'dependencies', 'complexity', 'scalability', 'error_rate'
    pub value: f64,          // 0-100 score
    pub timestamp: i64,      // Unix timestamp
    pub details: Option<String>,
    pub trend: Option<String>, // 'improving', 'stable', 'declining'
}

/// Feature Registry
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeatureItem {
    pub id: Option<i64>,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String, // 'completed', 'in_progress', 'planned', 'available', 'unavailable'
    pub independence_score: Option<f64>, // 0-100 independence score
    pub dependencies: Option<String>,    // JSON array of feature IDs
    pub file_paths: Option<String>,      // JSON array of relevant file paths
    pub complexity_score: Option<f64>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Risk Assessment Item
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RiskItem {
    pub id: Option<i64>,
    pub project_id: String,
    pub category: String, // 'security', 'feature', 'performance', 'dependency', 'technical_debt'
    pub severity: String, // 'critical', 'high', 'medium', 'low'
    pub title: String,
    pub description: String,
    pub mitigation: Option<String>,
    pub status: String, // 'open', 'mitigated', 'accepted', 'resolved'
    pub impact_score: Option<f64>, // 1-10 impact score
    pub probability: Option<f64>,  // 0-1 probability
    pub detected_at: i64,
    pub resolved_at: Option<i64>,
    pub file_paths: Option<String>, // JSON array of affected files
}

/// Documentation Status
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentationStatus {
    pub id: Option<i64>,
    pub project_id: String,
    pub doc_type: String, // 'prd', 'tasks', 'tech_stack', 'workflows', 'usage_guides', 'reports'
    pub completion_percentage: Option<f64>, // 0-100
    pub total_sections: Option<i64>,
    pub completed_sections: Option<i64>,
    pub missing_sections: Option<String>, // JSON array
    pub file_paths: Option<String>,       // JSON array of relevant file paths
    pub last_updated: i64,
    pub quality_score: Option<f64>,
}

/// AI Usage Metrics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AIUsageMetric {
    pub id: Option<i64>,
    pub project_id: String,
    pub model_name: String,
    pub agent_type: Option<String>,
    pub mcp_server: Option<String>,
    pub token_count: i64,
    pub request_count: i64,
    pub success_count: i64,
    pub failure_count: i64,
    pub success_rate: Option<f64>,
    pub avg_response_time: Option<i64>, // milliseconds
    pub total_cost: Option<f64>,
    pub session_date: String, // YYYY-MM-DD format
    pub timestamp: i64,
}

/// Workflow Stage
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkflowStage {
    pub id: Option<i64>,
    pub project_id: String,
    pub stage_name: String,
    pub stage_order: i64,
    pub status: String, // 'completed', 'active', 'pending', 'skipped'
    pub start_date: Option<i64>,
    pub end_date: Option<i64>,
    pub duration_days: Option<i64>,
    pub efficiency_score: Option<f64>,
    pub bottlenecks: Option<String>, // JSON array of identified bottlenecks
    pub updated_at: i64,
}

/// Project Goals
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectGoals {
    pub id: Option<i64>,
    pub project_id: String,
    pub primary_goal: Option<String>,
    pub secondary_goals: Option<String>, // JSON array
    pub overall_completion: Option<f64>, // 0-100
    pub features_completion: Option<f64>,
    pub documentation_completion: Option<f64>,
    pub tests_completion: Option<f64>,
    pub deployment_readiness: Option<f64>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Dashboard Configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardConfig {
    pub id: Option<i64>,
    pub project_id: String,
    pub config_version: Option<String>,
    pub refresh_interval: Option<i64>, // seconds
    pub cache_duration: Option<i64>,   // seconds
    pub enabled_widgets: Option<String>, // JSON array of enabled widget names
    pub custom_metrics: Option<String>,  // JSON object of custom metric definitions
    pub created_at: i64,
    pub updated_at: i64,
}

/// Dashboard Summary Data
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardSummary {
    pub project_id: String,
    pub health_metrics: Vec<ProjectHealthMetric>,
    pub feature_status: Vec<FeatureItem>,
    pub risk_items: Vec<RiskItem>,
    pub documentation_status: Vec<DocumentationStatus>,
    pub ai_usage: Vec<AIUsageMetric>,
    pub workflow_stages: Vec<WorkflowStage>,
    pub project_goals: Option<ProjectGoals>,
    pub config: Option<DashboardConfig>,
}

/// Apply dashboard database migration
pub fn apply_dashboard_migration(conn: &Connection) -> SqliteResult<()> {
    info!("Applying dashboard database migration...");

    // Read and execute the migration file content
    let migration_sql = include_str!("../../migrations/002_dashboard.sql");
    
    // Split the migration into individual statements and execute them
    for statement in migration_sql.split(';') {
        let statement = statement.trim();
        if !statement.is_empty() && !statement.starts_with("--") {
            if let Err(e) = conn.execute(statement, []) {
                error!("Failed to execute migration statement: {}", e);
                error!("Statement: {}", statement);
                // Continue with other statements even if one fails
            }
        }
    }

    info!("Dashboard database migration completed");
    Ok(())
}

/// Get dashboard summary for a project
#[tauri::command]
pub async fn dashboard_get_summary(
    db: State<'_, AgentDb>,
    project_id: String,
) -> Result<DashboardSummary, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Get health metrics (latest 10)
    let health_metrics = get_health_metrics(&conn, &project_id, Some(10))?;

    // Get feature status
    let feature_status = get_features(&conn, &project_id)?;

    // Get risk items (only open ones)
    let risk_items = get_risk_items(&conn, &project_id, Some("open"))?;

    // Get documentation status
    let documentation_status = get_documentation_status(&conn, &project_id)?;

    // Get AI usage metrics (last 7 days)
    let ai_usage = get_ai_usage_metrics(&conn, &project_id, Some(7))?;

    // Get workflow stages
    let workflow_stages = get_workflow_stages(&conn, &project_id)?;

    // Get project goals
    let project_goals = get_project_goals(&conn, &project_id)?;

    // Get dashboard config
    let config = get_dashboard_config(&conn, &project_id)?;

    Ok(DashboardSummary {
        project_id,
        health_metrics,
        feature_status,
        risk_items,
        documentation_status,
        ai_usage,
        workflow_stages,
        project_goals,
        config,
    })
}

/// Update project health metric
#[tauri::command]
pub async fn dashboard_update_health_metric(
    db: State<'_, AgentDb>,
    metric: ProjectHealthMetric,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let id = conn
        .query_row(
            "INSERT OR REPLACE INTO project_health 
             (project_id, metric_type, value, details, trend) 
             VALUES (?1, ?2, ?3, ?4, ?5)
             RETURNING id",
            params![
                metric.project_id,
                metric.metric_type,
                metric.value,
                metric.details,
                metric.trend
            ],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(id)
}

/// Update or create feature
#[tauri::command]
pub async fn dashboard_update_feature(
    db: State<'_, AgentDb>,
    feature: FeatureItem,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let id = conn
        .query_row(
            "INSERT OR REPLACE INTO feature_registry 
             (project_id, name, description, status, independence_score, dependencies, file_paths, complexity_score) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             RETURNING id",
            params![
                feature.project_id,
                feature.name,
                feature.description,
                feature.status,
                feature.independence_score,
                feature.dependencies,
                feature.file_paths,
                feature.complexity_score
            ],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(id)
}

/// Helper functions to retrieve data from database
fn get_health_metrics(
    conn: &Connection,
    project_id: &str,
    limit: Option<i64>,
) -> Result<Vec<ProjectHealthMetric>, String> {
    let query = match limit {
        Some(l) => format!(
            "SELECT id, project_id, metric_type, value, timestamp, details, trend 
             FROM project_health WHERE project_id = ? 
             ORDER BY timestamp DESC LIMIT {}",
            l
        ),
        None => "SELECT id, project_id, metric_type, value, timestamp, details, trend 
                 FROM project_health WHERE project_id = ? 
                 ORDER BY timestamp DESC"
            .to_string(),
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let metrics = stmt
        .query_map(params![project_id], |row| {
            Ok(ProjectHealthMetric {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                metric_type: row.get(2)?,
                value: row.get(3)?,
                timestamp: row.get(4)?,
                details: row.get(5)?,
                trend: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(metrics)
}

fn get_features(conn: &Connection, project_id: &str) -> Result<Vec<FeatureItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, description, status, independence_score, 
                    dependencies, file_paths, complexity_score, created_at, updated_at 
             FROM feature_registry WHERE project_id = ? 
             ORDER BY independence_score DESC",
        )
        .map_err(|e| e.to_string())?;

    let features = stmt
        .query_map(params![project_id], |row| {
            Ok(FeatureItem {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                independence_score: row.get(5)?,
                dependencies: row.get(6)?,
                file_paths: row.get(7)?,
                complexity_score: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(features)
}

fn get_risk_items(
    conn: &Connection,
    project_id: &str,
    status_filter: Option<&str>,
) -> Result<Vec<RiskItem>, String> {
    let query = match status_filter {
        Some(status) => format!(
            "SELECT id, project_id, category, severity, title, description, mitigation, 
                    status, impact_score, probability, detected_at, resolved_at, file_paths 
             FROM risk_items WHERE project_id = ? AND status = '{}' 
             ORDER BY severity DESC, impact_score DESC",
            status
        ),
        None => "SELECT id, project_id, category, severity, title, description, mitigation, 
                        status, impact_score, probability, detected_at, resolved_at, file_paths 
                 FROM risk_items WHERE project_id = ? 
                 ORDER BY severity DESC, impact_score DESC"
            .to_string(),
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let risks = stmt
        .query_map(params![project_id], |row| {
            Ok(RiskItem {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                category: row.get(2)?,
                severity: row.get(3)?,
                title: row.get(4)?,
                description: row.get(5)?,
                mitigation: row.get(6)?,
                status: row.get(7)?,
                impact_score: row.get(8)?,
                probability: row.get(9)?,
                detected_at: row.get(10)?,
                resolved_at: row.get(11)?,
                file_paths: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(risks)
}

fn get_documentation_status(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<DocumentationStatus>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, doc_type, completion_percentage, total_sections, 
                    completed_sections, missing_sections, file_paths, last_updated, quality_score 
             FROM documentation_status WHERE project_id = ? 
             ORDER BY completion_percentage ASC",
        )
        .map_err(|e| e.to_string())?;

    let docs = stmt
        .query_map(params![project_id], |row| {
            Ok(DocumentationStatus {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                doc_type: row.get(2)?,
                completion_percentage: row.get(3)?,
                total_sections: row.get(4)?,
                completed_sections: row.get(5)?,
                missing_sections: row.get(6)?,
                file_paths: row.get(7)?,
                last_updated: row.get(8)?,
                quality_score: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(docs)
}

fn get_ai_usage_metrics(
    conn: &Connection,
    project_id: &str,
    days_limit: Option<i64>,
) -> Result<Vec<AIUsageMetric>, String> {
    let query = match days_limit {
        Some(days) => format!(
            "SELECT id, project_id, model_name, agent_type, mcp_server, token_count, 
                    request_count, success_count, failure_count, success_rate, 
                    avg_response_time, total_cost, session_date, timestamp 
             FROM ai_usage_metrics WHERE project_id = ? 
             AND timestamp > (strftime('%s', 'now') - {} * 24 * 60 * 60)
             ORDER BY timestamp DESC",
            days
        ),
        None => "SELECT id, project_id, model_name, agent_type, mcp_server, token_count, 
                        request_count, success_count, failure_count, success_rate, 
                        avg_response_time, total_cost, session_date, timestamp 
                 FROM ai_usage_metrics WHERE project_id = ? 
                 ORDER BY timestamp DESC"
            .to_string(),
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let metrics = stmt
        .query_map(params![project_id], |row| {
            Ok(AIUsageMetric {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                model_name: row.get(2)?,
                agent_type: row.get(3)?,
                mcp_server: row.get(4)?,
                token_count: row.get(5)?,
                request_count: row.get(6)?,
                success_count: row.get(7)?,
                failure_count: row.get(8)?,
                success_rate: row.get(9)?,
                avg_response_time: row.get(10)?,
                total_cost: row.get(11)?,
                session_date: row.get(12)?,
                timestamp: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(metrics)
}

fn get_workflow_stages(conn: &Connection, project_id: &str) -> Result<Vec<WorkflowStage>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, stage_name, stage_order, status, start_date, 
                    end_date, duration_days, efficiency_score, bottlenecks, updated_at 
             FROM workflow_stages WHERE project_id = ? 
             ORDER BY stage_order ASC",
        )
        .map_err(|e| e.to_string())?;

    let stages = stmt
        .query_map(params![project_id], |row| {
            Ok(WorkflowStage {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                stage_name: row.get(2)?,
                stage_order: row.get(3)?,
                status: row.get(4)?,
                start_date: row.get(5)?,
                end_date: row.get(6)?,
                duration_days: row.get(7)?,
                efficiency_score: row.get(8)?,
                bottlenecks: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<SqliteResult<Vec<_>>>()
        .map_err(|e| e.to_string())?;

    Ok(stages)
}

fn get_project_goals(conn: &Connection, project_id: &str) -> Result<Option<ProjectGoals>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, primary_goal, secondary_goals, overall_completion, 
                    features_completion, documentation_completion, tests_completion, 
                    deployment_readiness, created_at, updated_at 
             FROM project_goals WHERE project_id = ?",
        )
        .map_err(|e| e.to_string())?;

    let goals = stmt
        .query_row(params![project_id], |row| {
            Ok(ProjectGoals {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                primary_goal: row.get(2)?,
                secondary_goals: row.get(3)?,
                overall_completion: row.get(4)?,
                features_completion: row.get(5)?,
                documentation_completion: row.get(6)?,
                tests_completion: row.get(7)?,
                deployment_readiness: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(goals)
}

fn get_dashboard_config(
    conn: &Connection,
    project_id: &str,
) -> Result<Option<DashboardConfig>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, config_version, refresh_interval, cache_duration, 
                    enabled_widgets, custom_metrics, created_at, updated_at 
             FROM dashboard_config WHERE project_id = ?",
        )
        .map_err(|e| e.to_string())?;

    let config = stmt
        .query_row(params![project_id], |row| {
            Ok(DashboardConfig {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                config_version: row.get(2)?,
                refresh_interval: row.get(3)?,
                cache_duration: row.get(4)?,
                enabled_widgets: row.get(5)?,
                custom_metrics: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(config)
}