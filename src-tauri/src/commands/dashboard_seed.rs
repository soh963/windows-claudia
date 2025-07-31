use anyhow::Result;
use log::info;
use rusqlite::{params, Connection};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use super::agents::AgentDb;

/// Seed the dashboard with sample data for demonstration
#[tauri::command]
pub async fn dashboard_seed_data(db: State<'_, AgentDb>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let current_timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    info!("Seeding dashboard with sample data...");

    // Seed project health metrics
    let health_metrics = vec![
        ("claudia-main", "security", 85.5, "Security audits passed with minor warnings"),
        ("claudia-main", "dependencies", 92.0, "All dependencies up to date"),
        ("claudia-main", "complexity", 78.3, "Moderate complexity, refactoring recommended"),
        ("claudia-main", "scalability", 88.7, "Good scalability patterns implemented"),
        ("claudia-main", "error_rate", 96.2, "Very low error rate in production"),
    ];

    for (project_id, metric_type, value, details) in health_metrics {
        conn.execute(
            "INSERT OR REPLACE INTO project_health 
             (project_id, metric_type, value, details, trend, timestamp) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project_id, metric_type, value, details, "improving", current_timestamp],
        ).map_err(|e| e.to_string())?;
    }

    // Seed feature registry
    let features = vec![
        ("claudia-main", "Agent System", "Multi-agent orchestration for Claude Code", "completed", 95.0, 12.5),
        ("claudia-main", "MCP Integration", "Model Context Protocol server management", "completed", 88.5, 18.2),
        ("claudia-main", "Dashboard", "Project health and metrics dashboard", "in_progress", 78.0, 22.1),
        ("claudia-main", "Windows UI", "Windows-optimized user interface", "completed", 92.0, 15.8),
        ("claudia-main", "Session Management", "Claude Code session handling", "completed", 85.5, 9.3),
        ("claudia-main", "File Operations", "Enhanced file manipulation tools", "in_progress", 72.5, 16.7),
        ("claudia-main", "Cross-platform Support", "macOS and Linux compatibility", "planned", 45.0, 28.9),
    ];

    for (project_id, name, description, status, independence_score, complexity_score) in features {
        conn.execute(
            "INSERT OR REPLACE INTO feature_registry 
             (project_id, name, description, status, independence_score, complexity_score) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![project_id, name, description, status, independence_score, complexity_score],
        ).map_err(|e| e.to_string())?;
    }

    // Seed risk items
    let risks = vec![
        ("claudia-main", "security", "medium", "Dependency Vulnerabilities", 
         "Some npm packages have moderate security vulnerabilities", 
         "Update vulnerable packages to latest versions", 6.5, 0.3),
        ("claudia-main", "performance", "high", "Memory Usage Growth", 
         "Memory usage increases over time in long-running sessions", 
         "Investigate memory leaks and implement cleanup", 8.2, 0.7),
        ("claudia-main", "technical_debt", "low", "Legacy Code Patterns", 
         "Some components use outdated React patterns", 
         "Refactor to modern React hooks and patterns", 3.8, 0.2),
        ("claudia-main", "dependency", "medium", "Node.js Version Compatibility", 
         "Application requires specific Node.js version for optimal performance", 
         "Update dependencies and test with latest Node.js LTS", 5.5, 0.4),
    ];

    for (project_id, category, severity, title, description, mitigation, impact_score, probability) in risks {
        conn.execute(
            "INSERT OR REPLACE INTO risk_items 
             (project_id, category, severity, title, description, mitigation, status, impact_score, probability, detected_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![project_id, category, severity, title, description, mitigation, "open", impact_score, probability, current_timestamp],
        ).map_err(|e| e.to_string())?;
    }

    // Seed documentation status
    let docs = vec![
        ("claudia-main", "prd", 85.0, 12, 10, "User guide, API reference"),
        ("claudia-main", "tasks", 92.5, 8, 7, "Project roadmap"),
        ("claudia-main", "tech_stack", 78.3, 15, 12, "Architecture, deployment, testing"),
        ("claudia-main", "workflows", 65.0, 10, 6, "CI/CD, development, release"),
        ("claudia-main", "usage_guides", 70.5, 6, 4, "Installation, troubleshooting"),
        ("claudia-main", "reports", 45.0, 4, 2, "Performance, security"),
    ];

    for (project_id, doc_type, completion_percentage, total_sections, completed_sections, missing) in docs {
        conn.execute(
            "INSERT OR REPLACE INTO documentation_status 
             (project_id, doc_type, completion_percentage, total_sections, completed_sections, missing_sections, last_updated, quality_score) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![project_id, doc_type, completion_percentage, total_sections, completed_sections, missing, current_timestamp, completion_percentage * 0.9],
        ).map_err(|e| e.to_string())?;
    }

    // Seed AI usage metrics
    let ai_usage = vec![
        ("claudia-main", "claude-3-5-sonnet-20241022", "orchestrator", None, 15420, 8, 7, 1, 0.875, 1850, 0.089, "2025-07-31"),
        ("claudia-main", "claude-3-5-sonnet-20241022", "frontend", Some("mcp"), 8750, 5, 5, 0, 1.0, 1620, 0.051, "2025-07-31"),
        ("claudia-main", "claude-3-5-sonnet-20241022", "backend", Some("sequential"), 12300, 6, 6, 0, 1.0, 2100, 0.072, "2025-07-31"),
        ("claudia-main", "claude-3-5-sonnet-20241022", "analyzer", Some("context7"), 9800, 4, 4, 0, 1.0, 1450, 0.058, "2025-07-30"),
        ("claudia-main", "claude-3-haiku-20241022", "testing", Some("playwright"), 3200, 12, 11, 1, 0.917, 800, 0.018, "2025-07-30"),
    ];

    for (project_id, model_name, agent_type, mcp_server, token_count, request_count, success_count, failure_count, success_rate, avg_response_time, total_cost, session_date) in ai_usage {
        conn.execute(
            "INSERT OR REPLACE INTO ai_usage_metrics 
             (project_id, model_name, agent_type, mcp_server, token_count, request_count, success_count, failure_count, success_rate, avg_response_time, total_cost, session_date, timestamp) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![project_id, model_name, agent_type, mcp_server, token_count, request_count, success_count, failure_count, success_rate, avg_response_time, total_cost, session_date, current_timestamp],
        ).map_err(|e| e.to_string())?;
    }

    // Seed workflow stages
    let workflows = vec![
        ("claudia-main", "Analysis & Planning", 1, "completed", Some(current_timestamp - 86400 * 7), Some(current_timestamp - 86400 * 5), Some(2), Some(92.5)),
        ("claudia-main", "Backend Development", 2, "completed", Some(current_timestamp - 86400 * 5), Some(current_timestamp - 86400 * 2), Some(3), Some(88.0)),
        ("claudia-main", "Frontend Development", 3, "active", Some(current_timestamp - 86400 * 2), None, None, Some(75.5)),
        ("claudia-main", "Testing & Integration", 4, "pending", None, None, None, None),
        ("claudia-main", "Documentation", 5, "pending", None, None, None, None),
        ("claudia-main", "Deployment", 6, "pending", None, None, None, None),
    ];

    for (project_id, stage_name, stage_order, status, start_date, end_date, duration_days, efficiency_score) in workflows {
        conn.execute(
            "INSERT OR REPLACE INTO workflow_stages 
             (project_id, stage_name, stage_order, status, start_date, end_date, duration_days, efficiency_score, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![project_id, stage_name, stage_order, status, start_date, end_date, duration_days, efficiency_score, current_timestamp],
        ).map_err(|e| e.to_string())?;
    }

    // Update project goals
    conn.execute(
        "UPDATE project_goals SET 
         overall_completion = ?1, 
         features_completion = ?2, 
         documentation_completion = ?3, 
         tests_completion = ?4, 
         deployment_readiness = ?5, 
         updated_at = ?6 
         WHERE project_id = ?7",
        params![75.5, 82.3, 71.8, 45.0, 68.2, current_timestamp, "claudia-main"],
    ).map_err(|e| e.to_string())?;

    info!("Dashboard seeding completed successfully");
    Ok("Dashboard data seeded successfully".to_string())
}