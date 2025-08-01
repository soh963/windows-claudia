use anyhow::Result;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

use super::agents::AgentDb;

/// Real-time AI usage tracking and analytics
/// Provides comprehensive tracking of AI model usage, costs, and performance metrics

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIUsageEvent {
    pub project_id: String,
    pub model_name: String,
    pub agent_type: Option<String>,
    pub mcp_server: Option<String>,
    pub token_count: i64,
    pub request_type: String, // "completion", "analysis", "generation", etc.
    pub response_time_ms: Option<i64>,
    pub success: bool,
    pub error_message: Option<String>,
    pub session_id: Option<String>,
    pub user_prompt_tokens: Option<i64>,
    pub assistant_response_tokens: Option<i64>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIUsageStats {
    pub total_tokens: i64,
    pub total_requests: i64,
    pub success_count: i64,
    pub failure_count: i64,
    pub success_rate: f64,
    pub avg_response_time: Option<f64>,
    pub total_cost: f64,
    pub cost_breakdown: HashMap<String, f64>, // model_name -> cost
    pub usage_by_agent: HashMap<String, AIAgentUsage>,
    pub usage_by_mcp: HashMap<String, AIMCPUsage>,
    pub daily_usage: Vec<DailyUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAgentUsage {
    pub agent_type: String,
    pub total_tokens: i64,
    pub total_requests: i64,
    pub success_rate: f64,
    pub avg_response_time: Option<f64>,
    pub total_cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIMCPUsage {
    pub mcp_server: String,
    pub total_tokens: i64,
    pub total_requests: i64,
    pub success_rate: f64,
    pub avg_response_time: Option<f64>,
    pub cache_hit_rate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyUsage {
    pub date: String, // YYYY-MM-DD
    pub total_tokens: i64,
    pub total_requests: i64,
    pub total_cost: f64,
    pub success_rate: f64,
    pub peak_hour: Option<i32>, // 0-23
    pub models_used: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostCalculation {
    pub model_name: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub input_cost_per_token: f64,
    pub output_cost_per_token: f64,
    pub total_cost: f64,
}

// Cost per token rates (as of 2024) - in USD
const MODEL_COSTS: &[(&str, f64, f64)] = &[
    // (model_name, input_cost_per_1k_tokens, output_cost_per_1k_tokens)
    ("claude-3-opus", 0.015, 0.075),
    ("claude-3-sonnet", 0.003, 0.015),
    ("claude-3-haiku", 0.00025, 0.00125),
    ("claude-sonnet-4", 0.004, 0.020),
    ("gpt-4", 0.03, 0.06),
    ("gpt-4-turbo", 0.01, 0.03),
    ("gpt-3.5-turbo", 0.0005, 0.0015),
    ("gpt-4o", 0.005, 0.015),
    ("gpt-4o-mini", 0.00015, 0.0006),
];

impl CostCalculation {
    pub fn calculate(model_name: &str, input_tokens: i64, output_tokens: i64) -> Self {
        let (input_rate, output_rate) = MODEL_COSTS
            .iter()
            .find(|(name, _, _)| name == &model_name)
            .map(|(_, input, output)| (*input, *output))
            .unwrap_or((0.003, 0.015)); // Default to Claude Sonnet rates

        let input_cost = (input_tokens as f64 / 1000.0) * input_rate;
        let output_cost = (output_tokens as f64 / 1000.0) * output_rate;
        let total_cost = input_cost + output_cost;

        CostCalculation {
            model_name: model_name.to_string(),
            input_tokens,
            output_tokens,
            input_cost_per_token: input_rate / 1000.0,
            output_cost_per_token: output_rate / 1000.0,
            total_cost,
        }
    }
}

/// Track a new AI usage event
#[tauri::command]
pub async fn track_ai_usage(
    db: State<'_, AgentDb>,
    event: AIUsageEvent,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Calculate cost if token breakdown is available
    let cost = if let (Some(input_tokens), Some(output_tokens)) = 
        (event.user_prompt_tokens, event.assistant_response_tokens) {
        CostCalculation::calculate(&event.model_name, input_tokens, output_tokens).total_cost
    } else {
        // Fallback to simple calculation
        let (_, _, avg_rate) = MODEL_COSTS
            .iter()
            .find(|(name, _, _)| name == &event.model_name)
            .map(|(_, input, output)| (input, output, (input + output) / 2.0))
            .unwrap_or((&0.003, &0.015, 0.009));
        (event.token_count as f64 / 1000.0) * avg_rate
    };

    let session_date = DateTime::from_timestamp(event.timestamp, 0)
        .unwrap_or_else(Utc::now)
        .format("%Y-%m-%d")
        .to_string();

    // Insert individual event for detailed tracking
    conn.execute(
        "INSERT INTO ai_usage_events 
         (project_id, model_name, agent_type, mcp_server, token_count, request_type,
          response_time_ms, success, error_message, session_id, user_prompt_tokens,
          assistant_response_tokens, cost, session_date, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            &event.project_id,
            &event.model_name,
            &event.agent_type,
            &event.mcp_server,
            event.token_count,
            &event.request_type,
            event.response_time_ms,
            event.success,
            &event.error_message,
            &event.session_id,
            event.user_prompt_tokens,
            event.assistant_response_tokens,
            cost,
            &session_date,
            event.timestamp
        ],
    ).map_err(|e| e.to_string())?;

    // Update aggregated metrics
    update_aggregated_metrics(&conn, &event, cost)?;

    Ok("AI usage tracked successfully".to_string())
}

/// Update aggregated metrics for dashboard display
fn update_aggregated_metrics(
    conn: &Connection,
    event: &AIUsageEvent,
    cost: f64,
) -> Result<(), String> {
    let session_date = DateTime::from_timestamp(event.timestamp, 0)
        .unwrap_or_else(Utc::now)
        .format("%Y-%m-%d")
        .to_string();

    // Check if daily aggregate exists
    let existing_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM ai_usage_metrics 
             WHERE project_id = ?1 AND model_name = ?2 AND agent_type IS ?3 
             AND mcp_server IS ?4 AND session_date = ?5",
            params![
                &event.project_id,
                &event.model_name,
                &event.agent_type,
                &event.mcp_server,
                &session_date
            ],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if existing_count > 0 {
        // Update existing record
        conn.execute(
            "UPDATE ai_usage_metrics 
             SET token_count = token_count + ?1,
                 request_count = request_count + 1,
                 success_count = success_count + ?2,
                 failure_count = failure_count + ?3,
                 success_rate = (CAST(success_count AS REAL) / CAST(request_count AS REAL)) * 100.0,
                 avg_response_time = CASE 
                     WHEN ?4 IS NOT NULL THEN 
                         CASE WHEN avg_response_time IS NULL THEN ?4
                              ELSE (avg_response_time * (request_count - 1) + ?4) / request_count
                         END
                     ELSE avg_response_time
                 END,
                 total_cost = total_cost + ?5,
                 timestamp = ?6
             WHERE project_id = ?7 AND model_name = ?8 AND agent_type IS ?9 
             AND mcp_server IS ?10 AND session_date = ?11",
            params![
                event.token_count,
                if event.success { 1 } else { 0 },
                if event.success { 0 } else { 1 },
                event.response_time_ms,
                cost,
                event.timestamp,
                &event.project_id,
                &event.model_name,
                &event.agent_type,
                &event.mcp_server,
                &session_date
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        // Insert new record
        conn.execute(
            "INSERT INTO ai_usage_metrics 
             (project_id, model_name, agent_type, mcp_server, token_count, 
              request_count, success_count, failure_count, success_rate, 
              avg_response_time, total_cost, session_date, timestamp) 
             VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                &event.project_id,
                &event.model_name,
                &event.agent_type,
                &event.mcp_server,
                event.token_count,
                if event.success { 1 } else { 0 },
                if event.success { 0 } else { 1 },
                if event.success { 100.0 } else { 0.0 },
                event.response_time_ms,
                cost,
                &session_date,
                event.timestamp
            ],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Get comprehensive AI usage statistics
#[tauri::command]
pub async fn get_ai_usage_stats(
    db: State<'_, AgentDb>,
    project_id: String,
    days_limit: Option<i64>,
) -> Result<AIUsageStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let time_filter = match days_limit {
        Some(days) => format!("AND timestamp > (strftime('%s', 'now') - {} * 24 * 60 * 60)", days),
        None => String::new(),
    };

    // Get overall stats
    let (total_tokens, total_requests, success_count, failure_count, total_cost, avg_response_time): 
        (i64, i64, i64, i64, f64, Option<f64>) = conn
        .query_row(
            &format!(
                "SELECT COALESCE(SUM(token_count), 0), COALESCE(SUM(request_count), 0),
                        COALESCE(SUM(success_count), 0), COALESCE(SUM(failure_count), 0),
                        COALESCE(SUM(total_cost), 0.0), AVG(avg_response_time)
                 FROM ai_usage_metrics WHERE project_id = ?1 {}", 
                time_filter
            ),
            params![&project_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
        )
        .unwrap_or((0, 0, 0, 0, 0.0, None));

    let success_rate = if total_requests > 0 {
        (success_count as f64 / total_requests as f64) * 100.0
    } else {
        0.0
    };

    // Get cost breakdown by model
    let mut cost_breakdown = HashMap::new();
    let mut stmt = conn.prepare(&format!(
        "SELECT model_name, SUM(total_cost) FROM ai_usage_metrics 
         WHERE project_id = ?1 {} GROUP BY model_name", 
        time_filter
    )).map_err(|e| e.to_string())?;
    
    let cost_rows = stmt.query_map(params![&project_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
    }).map_err(|e| e.to_string())?;

    for row in cost_rows {
        let (model, cost) = row.map_err(|e| e.to_string())?;
        cost_breakdown.insert(model, cost);
    }

    // Get usage by agent
    let mut usage_by_agent = HashMap::new();
    let mut stmt = conn.prepare(&format!(
        "SELECT agent_type, SUM(token_count), SUM(request_count), 
                SUM(success_count), SUM(failure_count), AVG(avg_response_time), SUM(total_cost)
         FROM ai_usage_metrics 
         WHERE project_id = ?1 AND agent_type IS NOT NULL {} 
         GROUP BY agent_type", 
        time_filter
    )).map_err(|e| e.to_string())?;

    let agent_rows = stmt.query_map(params![&project_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, i64>(4)?,
            row.get::<_, Option<f64>>(5)?,
            row.get::<_, f64>(6)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in agent_rows {
        let (agent_type, tokens, requests, successes, _failures, avg_time, cost) = 
            row.map_err(|e| e.to_string())?;
        let agent_success_rate = if requests > 0 {
            (successes as f64 / requests as f64) * 100.0
        } else {
            0.0
        };
        
        usage_by_agent.insert(agent_type.clone(), AIAgentUsage {
            agent_type,
            total_tokens: tokens,
            total_requests: requests,
            success_rate: agent_success_rate,
            avg_response_time: avg_time,
            total_cost: cost,
        });
    }

    // Get usage by MCP server
    let mut usage_by_mcp = HashMap::new();
    let mut stmt = conn.prepare(&format!(
        "SELECT mcp_server, SUM(token_count), SUM(request_count), 
                SUM(success_count), SUM(failure_count), AVG(avg_response_time)
         FROM ai_usage_metrics 
         WHERE project_id = ?1 AND mcp_server IS NOT NULL {} 
         GROUP BY mcp_server", 
        time_filter
    )).map_err(|e| e.to_string())?;

    let mcp_rows = stmt.query_map(params![&project_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, i64>(4)?,
            row.get::<_, Option<f64>>(5)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in mcp_rows {
        let (mcp_server, tokens, requests, successes, _failures, avg_time) = 
            row.map_err(|e| e.to_string())?;
        let mcp_success_rate = if requests > 0 {
            (successes as f64 / requests as f64) * 100.0
        } else {
            0.0
        };
        
        usage_by_mcp.insert(mcp_server.clone(), AIMCPUsage {
            mcp_server,
            total_tokens: tokens,
            total_requests: requests,
            success_rate: mcp_success_rate,
            avg_response_time: avg_time,
            cache_hit_rate: None, // TODO: Implement cache tracking
        });
    }

    // Get daily usage trends
    let mut daily_usage = Vec::new();
    let mut stmt = conn.prepare(&format!(
        "SELECT session_date, SUM(token_count), SUM(request_count), SUM(total_cost),
                SUM(success_count), SUM(failure_count),
                GROUP_CONCAT(DISTINCT model_name) as models
         FROM ai_usage_metrics 
         WHERE project_id = ?1 {} 
         GROUP BY session_date ORDER BY session_date DESC", 
        time_filter
    )).map_err(|e| e.to_string())?;

    let daily_rows = stmt.query_map(params![&project_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, f64>(3)?,
            row.get::<_, i64>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, Option<String>>(6)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in daily_rows {
        let (date, tokens, requests, cost, successes, _failures, models_str) = 
            row.map_err(|e| e.to_string())?;
        let daily_success_rate = if requests > 0 {
            (successes as f64 / requests as f64) * 100.0
        } else {
            0.0
        };
        
        let models_used = models_str
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        daily_usage.push(DailyUsage {
            date,
            total_tokens: tokens,
            total_requests: requests,
            total_cost: cost,
            success_rate: daily_success_rate,
            peak_hour: None, // TODO: Implement hourly tracking
            models_used,
        });
    }

    Ok(AIUsageStats {
        total_tokens,
        total_requests,
        success_count,
        failure_count,
        success_rate,
        avg_response_time,
        total_cost,
        cost_breakdown,
        usage_by_agent,
        usage_by_mcp,
        daily_usage,
    })
}

/// Get real-time AI usage for current session
#[tauri::command]
pub async fn get_session_ai_usage(
    db: State<'_, AgentDb>,
    project_id: String,
    session_id: String,
) -> Result<AIUsageStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Query events for current session only
    let mut stmt = conn.prepare(
        "SELECT model_name, agent_type, mcp_server, token_count, success, 
                response_time_ms, cost, request_type
         FROM ai_usage_events 
         WHERE project_id = ?1 AND session_id = ?2 
         ORDER BY timestamp DESC"
    ).map_err(|e| e.to_string())?;

    let events = stmt.query_map(params![&project_id, &session_id], |row| {
        Ok((
            row.get::<_, String>(0)?,      // model_name
            row.get::<_, Option<String>>(1)?, // agent_type
            row.get::<_, Option<String>>(2)?, // mcp_server
            row.get::<_, i64>(3)?,         // token_count
            row.get::<_, bool>(4)?,        // success
            row.get::<_, Option<i64>>(5)?, // response_time_ms
            row.get::<_, f64>(6)?,         // cost
            row.get::<_, String>(7)?,      // request_type
        ))
    }).map_err(|e| e.to_string())?;

    let mut total_tokens = 0i64;
    let mut total_requests = 0i64;
    let mut success_count = 0i64;
    let mut failure_count = 0i64;
    let mut total_cost = 0.0;
    let mut response_times = Vec::new();
    let mut cost_breakdown = HashMap::new();
    let mut usage_by_agent = HashMap::new();
    let mut usage_by_mcp = HashMap::new();

    for event in events {
        let (model, agent, mcp, tokens, success, response_time, cost, _request_type) = 
            event.map_err(|e| e.to_string())?;
        
        total_tokens += tokens;
        total_requests += 1;
        if success {
            success_count += 1;
        } else {
            failure_count += 1;
        }
        total_cost += cost;
        
        if let Some(rt) = response_time {
            response_times.push(rt as f64);
        }

        // Update cost breakdown
        *cost_breakdown.entry(model.clone()).or_insert(0.0) += cost;

        // Update agent usage
        if let Some(agent_type) = agent {
            let agent_usage = usage_by_agent.entry(agent_type.clone()).or_insert(AIAgentUsage {
                agent_type: agent_type.clone(),
                total_tokens: 0,
                total_requests: 0,
                success_rate: 0.0,
                avg_response_time: None,
                total_cost: 0.0,
            });
            agent_usage.total_tokens += tokens;
            agent_usage.total_requests += 1;
            agent_usage.total_cost += cost;
            if success {
                agent_usage.success_rate = 
                    ((agent_usage.success_rate * (agent_usage.total_requests - 1) as f64) + 100.0) 
                    / agent_usage.total_requests as f64;
            } else {
                agent_usage.success_rate = 
                    (agent_usage.success_rate * (agent_usage.total_requests - 1) as f64) 
                    / agent_usage.total_requests as f64;
            }
        }

        // Update MCP usage
        if let Some(mcp_server) = mcp {
            let mcp_usage = usage_by_mcp.entry(mcp_server.clone()).or_insert(AIMCPUsage {
                mcp_server: mcp_server.clone(),
                total_tokens: 0,
                total_requests: 0,
                success_rate: 0.0,
                avg_response_time: None,
                cache_hit_rate: None,
            });
            mcp_usage.total_tokens += tokens;
            mcp_usage.total_requests += 1;
            if success {
                mcp_usage.success_rate = 
                    ((mcp_usage.success_rate * (mcp_usage.total_requests - 1) as f64) + 100.0) 
                    / mcp_usage.total_requests as f64;
            } else {
                mcp_usage.success_rate = 
                    (mcp_usage.success_rate * (mcp_usage.total_requests - 1) as f64) 
                    / mcp_usage.total_requests as f64;
            }
        }
    }

    let success_rate = if total_requests > 0 {
        (success_count as f64 / total_requests as f64) * 100.0
    } else {
        0.0
    };

    let avg_response_time = if !response_times.is_empty() {
        Some(response_times.iter().sum::<f64>() / response_times.len() as f64)
    } else {
        None
    };

    Ok(AIUsageStats {
        total_tokens,
        total_requests,
        success_count,
        failure_count,
        success_rate,
        avg_response_time,
        total_cost,
        cost_breakdown,
        usage_by_agent,
        usage_by_mcp,
        daily_usage: vec![], // Not applicable for session-specific data
    })
}

/// Calculate estimated cost for planned operations
#[tauri::command]
pub async fn estimate_ai_cost(
    model_name: String,
    estimated_input_tokens: i64,
    estimated_output_tokens: i64,
) -> Result<CostCalculation, String> {
    Ok(CostCalculation::calculate(
        &model_name,
        estimated_input_tokens,
        estimated_output_tokens,
    ))
}

/// Get available AI models and their cost information
#[tauri::command]
pub async fn get_ai_model_info() -> Result<Vec<serde_json::Value>, String> {
    let models: Vec<serde_json::Value> = MODEL_COSTS
        .iter()
        .map(|(name, input_cost, output_cost)| {
            serde_json::json!({
                "name": name,
                "input_cost_per_1k_tokens": input_cost,
                "output_cost_per_1k_tokens": output_cost,
                "provider": if name.starts_with("claude") { "Anthropic" } else { "OpenAI" },
                "context_window": match *name {
                    "claude-3-opus" | "claude-3-sonnet" | "claude-3-haiku" => 200000,
                    "claude-sonnet-4" => 200000,
                    "gpt-4" => 8192,
                    "gpt-4-turbo" | "gpt-4o" => 128000,
                    "gpt-3.5-turbo" | "gpt-4o-mini" => 16385,
                    _ => 4096
                }
            })
        })
        .collect();

    Ok(models)
}