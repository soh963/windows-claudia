use serde::{Deserialize, Serialize};
use rusqlite::{Connection, Result};
use tokio::time::{self, Duration};
use std::sync::Arc;
use log::{info, error};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AiModelKnowledge {
    pub id: String,
    pub name: String,
    pub performance: f64,
    pub features: Vec<String>,
    pub strengths: Vec<String>,
    pub weaknesses: Vec<String>,
    pub benchmark_score: f64,
    pub last_updated: String,
}

// Mock function to simulate fetching data from the web.
// In a real implementation, this would use a library like reqwest to call external APIs or scrape web pages.
async fn fetch_latest_models_data() -> Result<Vec<AiModelKnowledge>, String> {
    info!("Fetching latest AI model data from simulated web source.");
    // In a real scenario, this would be a web request.
    // Here we use mock data for demonstration.
    Ok(vec![
        AiModelKnowledge {
            id: "claude-3-opus-20240229".to_string(),
            name: "Claude 3 Opus".to_string(),
            performance: 9.5,
            features: vec!["Large context window".to_string(), "Advanced reasoning".to_string()],
            strengths: vec!["Analysis".to_string(), "Complex tasks".to_string()],
            weaknesses: vec!["Higher cost".to_string()],
            benchmark_score: 95.0,
            last_updated: chrono::Utc::now().to_rfc3339(),
        },
        AiModelKnowledge {
            id: "gemini-1.5-pro-latest".to_string(),
            name: "Gemini 1.5 Pro".to_string(),
            performance: 9.2,
            features: vec!["Multimodality".to_string(), "Large context".to_string()],
            strengths: vec!["Video analysis".to_string(), "Code understanding".to_string()],
            weaknesses: vec!["API rate limits".to_string()],
            benchmark_score: 92.0,
            last_updated: chrono::Utc::now().to_rfc3339(),
        },
    ])
}

fn initialize_database(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_model_knowledge (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            performance REAL,
            features TEXT,
            strengths TEXT,
            weaknesses TEXT,
            benchmark_score REAL,
            last_updated TEXT NOT NULL
        )",
        [],
    )?;
    info!("AI model knowledge base table initialized.");
    Ok(())
}

fn store_models_in_db(conn: &Connection, models: &[AiModelKnowledge]) -> Result<()> {
    let tx = conn.transaction()?;
    for model in models {
        tx.execute(
            "INSERT OR REPLACE INTO ai_model_knowledge (id, name, performance, features, strengths, weaknesses, benchmark_score, last_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            &[
                &model.id,
                &model.name,
                &model.performance.to_string(),
                &serde_json::to_string(&model.features).unwrap(),
                &serde_json::to_string(&model.strengths).unwrap(),
                &serde_json::to_string(&model.weaknesses).unwrap(),
                &model.benchmark_score.to_string(),
                &model.last_updated,
            ],
        )?;
    }
    tx.commit()?;
    info!("Successfully stored {} models in the knowledge base.", models.len());
    Ok(())
}

pub async fn daily_knowledge_update_task(db_path: Arc<String>) {
    let mut interval = time::interval(Duration::from_secs(24 * 60 * 60)); // Run once every 24 hours
    info!("Starting daily AI model knowledge update task.");

    loop {
        interval.tick().await;
        info!("Running daily knowledge base update...");
        match Connection::open(db_path.as_str()) {
            Ok(conn) => {
                if let Err(e) = initialize_database(&conn) {
                    error!("Failed to initialize knowledge base DB: {}", e);
                    continue;
                }
                match fetch_latest_models_data().await {
                    Ok(models) => {
                        if let Err(e) = store_models_in_db(&conn, &models) {
                            error!("Failed to store model knowledge in DB: {}", e);
                        }
                    }
                    Err(e) => error!("Failed to fetch latest model data: {}", e),
                }
            }
            Err(e) => error!("Failed to open database for knowledge update: {}", e),
        }
    }
}