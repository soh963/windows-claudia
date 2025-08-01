use anyhow::Result;
use chrono::Utc;
use rusqlite::params;
use serde_json::json;
use tauri::State;

use super::agents::AgentDb;

/// Seed sample dashboard data for testing
#[tauri::command]
pub async fn dashboard_seed_data(
    db: State<'_, AgentDb>,
    project_id: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let timestamp = Utc::now().timestamp();
    
    // First, ensure the project exists in the projects table
    let project_exists = conn
        .prepare("SELECT 1 FROM projects WHERE id = ?")
        .and_then(|mut stmt| stmt.query_row([&project_id], |_| Ok(())))
        .is_ok();
    
    if !project_exists {
        // Try to create a project record with a reasonable default path
        let default_path = std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "D:\\claudia".to_string());
        
        if let Err(e) = conn.execute(
            "INSERT OR IGNORE INTO projects (id, path, name, created_at) VALUES (?1, ?2, ?3, datetime('now'))",
            params![&project_id, &default_path, &project_id]
        ) {
            return Err(format!("Failed to create project record: {}", e));
        }
    }
    
    // Seed health metrics
    let health_metrics = vec![
        ("security", 85.0, "Good security posture with minor improvements needed"),
        ("dependencies", 72.0, "Some outdated dependencies detected"),
        ("complexity", 78.0, "Manageable complexity with room for simplification"),
        ("scalability", 92.0, "Excellent scalability patterns implemented"),
        ("error_rate", 8.0, "Low error rate, monitoring in place"),
    ];
    
    for (metric_type, value, details) in health_metrics {
        conn.execute(
            "INSERT OR REPLACE INTO project_health 
             (project_id, metric_type, value, timestamp, details, trend) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                &project_id,
                metric_type,
                value,
                timestamp,
                details,
                if value > 80.0 { "improving" } else { "stable" }
            ],
        ).map_err(|e| e.to_string())?;
    }
    
    // Seed features
    let features = vec![
        ("Session Management", "completed", 95.0, 85.0, r#"["src/components/ClaudeCodeSession.tsx"]"#),
        ("Project Browser", "completed", 90.0, 75.0, r#"["src/components/ProjectList.tsx"]"#),
        ("MCP Integration", "in_progress", 85.0, 65.0, r#"["src/components/MCPManager.tsx"]"#),
        ("Agent System", "completed", 88.0, 70.0, r#"["src/components/CCAgents.tsx"]"#),
        ("Dashboard", "in_progress", 75.0, 80.0, r#"["src/components/Dashboard/*"]"#),
        ("Settings Management", "completed", 100.0, 45.0, r#"["src/stores/settingsStore.ts"]"#),
    ];
    
    for (name, status, independence, complexity, paths) in features {
        conn.execute(
            "INSERT OR REPLACE INTO feature_registry 
             (project_id, name, description, status, independence_score, 
              dependencies, file_paths, complexity_score, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                &project_id,
                name,
                format!("{} feature implementation", name),
                status,
                independence,
                "[]",
                paths,
                complexity,
                timestamp,
                timestamp
            ],
        ).map_err(|e| e.to_string())?;
    }
    
    // Seed risks
    let risks = vec![
        ("security", "high", "Outdated crypto dependency", "crypto-js library has known vulnerabilities", "Update to latest version", 8.0, 0.7),
        ("performance", "medium", "Large bundle size", "Main bundle exceeds 2MB, impacting load times", "Implement code splitting", 6.0, 0.8),
        ("dependency", "medium", "React 18 deprecations", "Using deprecated lifecycle methods", "Refactor to use hooks", 5.0, 0.6),
        ("technical_debt", "low", "Missing TypeScript types", "Some API responses lack proper typing", "Add comprehensive type definitions", 4.0, 0.9),
    ];
    
    for (category, severity, title, description, mitigation, impact, probability) in risks {
        conn.execute(
            "INSERT OR REPLACE INTO risk_items 
             (project_id, category, severity, title, description, mitigation, 
              status, impact_score, probability, detected_at, file_paths) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                &project_id,
                category,
                severity,
                title,
                description,
                mitigation,
                "open",
                impact,
                probability,
                timestamp,
                None::<String>
            ],
        ).map_err(|e| e.to_string())?;
    }
    
    // Seed documentation
    let docs = vec![
        ("prd", 95.0, 20, 19, r#"["README.md", "docs/PRD.md"]"#),
        ("tech_stack", 88.0, 15, 13, r#"["package.json", "Cargo.toml"]"#),
        ("usage_guides", 72.0, 10, 7, r#"["README.md", "docs/USAGE.md"]"#),
        ("workflows", 65.0, 8, 5, r#"["CONTRIBUTING.md"]"#),
        ("reports", 45.0, 5, 2, r#"["CHANGELOG.md"]"#),
    ];
    
    for (doc_type, completion, total, completed, paths) in docs {
        conn.execute(
            "INSERT OR REPLACE INTO documentation_status 
             (project_id, doc_type, completion_percentage, total_sections, 
              completed_sections, missing_sections, file_paths, last_updated, quality_score) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &project_id,
                doc_type,
                completion,
                total,
                completed,
                "[]",
                paths,
                timestamp,
                completion * 0.9
            ],
        ).map_err(|e| e.to_string())?;
    }
    
    // Seed comprehensive AI usage data
    let ai_usage_scenarios = vec![
        // Claude models with different usage patterns
        ("claude-3-opus", Some("architect"), Some("Context7"), 45000, 150, 145, 5, 280, 0.00015),
        ("claude-3-opus", Some("analyzer"), Some("Sequential"), 38000, 120, 115, 5, 245, 0.00015),
        ("claude-3-sonnet", Some("frontend"), Some("Magic"), 35000, 200, 190, 10, 180, 0.00003),
        ("claude-3-sonnet", Some("backend"), Some("Context7"), 42000, 180, 172, 8, 195, 0.00003),
        ("claude-3-sonnet", Some("security"), Some("Sequential"), 28000, 95, 92, 3, 220, 0.00003),
        ("claude-sonnet-4", Some("performance"), Some("Playwright"), 52000, 85, 82, 3, 165, 0.00004),
        
        // GPT models
        ("gpt-4", Some("qa"), Some("Playwright"), 25000, 100, 95, 5, 320, 0.00003),
        ("gpt-4-turbo", Some("refactorer"), Some("Sequential"), 33000, 75, 72, 3, 190, 0.00001),
        ("gpt-3.5-turbo", Some("scribe"), Some("Context7"), 18000, 300, 285, 15, 145, 0.000002),
        
        // MCP server specific usage (using default model)
        ("claude-3-sonnet", None, Some("Context7"), 15000, 250, 240, 10, 120, 0.0),
        ("claude-3-sonnet", None, Some("Sequential"), 22000, 180, 175, 5, 160, 0.0),
        ("claude-3-sonnet", None, Some("Magic"), 12000, 320, 310, 10, 95, 0.0),
        ("claude-3-sonnet", None, Some("Playwright"), 8000, 90, 87, 3, 380, 0.0),
    ];
    
    let mut day_offset = 0;
    for (model_opt, agent_opt, mcp_opt, tokens, requests, success, failure, response_time, cost_per_token) in ai_usage_scenarios {
        let session_timestamp = timestamp - (day_offset * 86400);
        let session_date = chrono::DateTime::from_timestamp(session_timestamp, 0)
            .unwrap_or_else(|| chrono::DateTime::from_timestamp(timestamp, 0).unwrap())
            .format("%Y-%m-%d")
            .to_string();
        
        conn.execute(
            "INSERT OR REPLACE INTO ai_usage_metrics 
             (project_id, model_name, agent_type, mcp_server, token_count, 
              request_count, success_count, failure_count, success_rate, 
              avg_response_time, total_cost, session_date, timestamp) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                &project_id,
                model_opt,
                agent_opt,
                mcp_opt,
                tokens,
                requests,
                success,
                failure,
                (success as f64 / requests as f64) * 100.0,
                response_time,
                tokens as f64 * cost_per_token,
                session_date,
                session_timestamp
            ],
        ).map_err(|e| e.to_string())?;
        
        day_offset = (day_offset + 1) % 7; // Cycle through last 7 days
    }
    
    // Add historical aggregated data for trend analysis
    for days_back in 1..=30 {
        let historical_timestamp = timestamp - (days_back * 86400);
        let historical_date = chrono::DateTime::from_timestamp(historical_timestamp, 0)
            .unwrap_or_else(|| chrono::DateTime::from_timestamp(timestamp, 0).unwrap())
            .format("%Y-%m-%d")
            .to_string();
        
        // Generate varied usage patterns
        let base_tokens = 20000 + (days_back * 500) % 15000;
        let base_requests = 50 + (days_back * 10) % 100;
        let success_rate = 90.0 + (days_back as f64 * 0.3) % 8.0;
        let failures = ((base_requests as f64) * (100.0 - success_rate) / 100.0) as i64;
        let successes = base_requests - failures;
        
        conn.execute(
            "INSERT OR REPLACE INTO ai_usage_metrics 
             (project_id, model_name, agent_type, mcp_server, token_count, 
              request_count, success_count, failure_count, success_rate, 
              avg_response_time, total_cost, session_date, timestamp) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                &project_id,
                "claude-3-sonnet",
                Some("analyzer"),
                Some("Sequential"),
                base_tokens,
                base_requests,
                successes,
                failures,
                success_rate,
                180 + (days_back * 5) % 100,
                base_tokens as f64 * 0.00003,
                historical_date,
                historical_timestamp
            ],
        ).map_err(|e| e.to_string())?;
    }
    
    // Seed workflow stages
    let stages = vec![
        ("Planning", 1, "completed", 7, 95.0),
        ("Development", 2, "active", 14, 78.0),
        ("Testing", 3, "pending", 0, 0.0),
        ("Deployment", 4, "pending", 0, 0.0),
    ];
    
    for (name, order, status, duration, efficiency) in stages {
        conn.execute(
            "INSERT OR REPLACE INTO workflow_stages 
             (project_id, stage_name, stage_order, status, start_date, 
              end_date, duration_days, efficiency_score, bottlenecks, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                &project_id,
                name,
                order,
                status,
                if status != "pending" { Some(timestamp - (duration * 86400)) } else { None::<i64> },
                if status == "completed" { Some(timestamp) } else { None::<i64> },
                if duration > 0 { Some(duration) } else { None::<i64> },
                if efficiency > 0.0 { Some(efficiency) } else { None::<f64> },
                "[]",
                timestamp
            ],
        ).map_err(|e| e.to_string())?;
    }
    
    // Seed project goals
    conn.execute(
        "INSERT OR REPLACE INTO project_goals 
         (project_id, primary_goal, secondary_goals, overall_completion, 
          features_completion, documentation_completion, tests_completion, 
          deployment_readiness, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &project_id,
            "Build a comprehensive project management dashboard for Claudia",
            json!(["Real-time project analytics", "AI usage tracking", "Risk management"]).to_string(),
            75.0,
            83.0,
            73.0,
            65.0,
            45.0,
            timestamp,
            timestamp
        ],
    ).map_err(|e| e.to_string())?;
    
    // Seed dashboard config
    conn.execute(
        "INSERT OR REPLACE INTO dashboard_config 
         (project_id, config_version, refresh_interval, cache_duration, 
          enabled_widgets, custom_metrics, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            &project_id,
            "1.0.0",
            300, // 5 minutes
            3600, // 1 hour
            json!(["health", "features", "ai", "risks", "docs"]).to_string(),
            "{}",
            timestamp,
            timestamp
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok("Sample dashboard data seeded successfully".to_string())
}