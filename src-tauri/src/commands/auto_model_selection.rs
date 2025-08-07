use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, State};
use super::agents::AgentDb;
use super::model_knowledge_base::AiModelKnowledge;
use log::{info, warn};
use rusqlite::Connection;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAnalysis {
    pub text_length: usize,
    pub complexity_score: f64,
    pub task_type: TaskType,
    pub context_requirements: ContextRequirements,
    pub intelligence_requirements: IntelligenceRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskType {
    Coding,
    Analysis,
    Writing,
    Translation,
    LargeDocument,
    Research,
    Creative,
    Technical,
    Simple,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextRequirements {
    pub needs_large_context: bool,
    pub estimated_tokens: usize,
    pub has_multiple_files: bool,
    pub context_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceRequirements {
    pub needs_reasoning: bool,
    pub needs_creativity: bool,
    pub needs_precision: bool,
    pub intelligence_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRecommendation {
    pub recommended_model: String,
    pub confidence: f64,
    pub reasoning: String,
    pub alternative_models: Vec<String>,
    pub selection_criteria: SelectionCriteria,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionCriteria {
    pub context_weight: f64,
    pub intelligence_weight: f64,
    pub speed_weight: f64,
    pub cost_weight: f64,
}

pub fn analyze_task(prompt: &str) -> TaskAnalysis {
    let text_length = prompt.len();
    let word_count = prompt.split_whitespace().count();

    if word_count < 20 && !prompt.to_lowercase().contains("code") && !prompt.to_lowercase().contains("analyze") {
        return TaskAnalysis {
            text_length,
            complexity_score: 0.1,
            task_type: TaskType::Simple,
            context_requirements: analyze_context_requirements(prompt, text_length),
            intelligence_requirements: analyze_intelligence_requirements(prompt, &TaskType::Simple),
        };
    }
    
    let task_type = detect_task_type(prompt);
    let complexity_score = calculate_complexity_score(prompt, word_count);
    let context_requirements = analyze_context_requirements(prompt, text_length);
    let intelligence_requirements = analyze_intelligence_requirements(prompt, &task_type);
    
    TaskAnalysis {
        text_length,
        complexity_score,
        task_type,
        context_requirements,
        intelligence_requirements,
    }
}

fn detect_task_type(prompt: &str) -> TaskType {
    let prompt_lower = prompt.to_lowercase();
    if prompt_lower.contains("code") || prompt_lower.contains("function") || prompt_lower.contains("debug") {
        return TaskType::Coding;
    }
    if prompt_lower.contains("analyze this file") || prompt_lower.contains("summarize") || prompt.len() > 8000 {
        return TaskType::LargeDocument;
    }
    if prompt_lower.contains("analyze") || prompt_lower.contains("explain") || prompt_lower.contains("evaluate") {
        return TaskType::Analysis;
    }
    TaskType::Writing
}

fn calculate_complexity_score(prompt: &str, word_count: usize) -> f64 {
    let mut score: f64 = 0.0;
    if word_count > 500 { score += 0.3; } else if word_count > 100 { score += 0.2; } else { score += 0.1; }
    let complexity_keywords = ["complex", "advanced", "architecture", "system", "algorithm", "optimization"];
    let prompt_lower = prompt.to_lowercase();
    for keyword in &complexity_keywords { if prompt_lower.contains(keyword) { score += 0.15; } }
    if prompt_lower.contains("and") && prompt_lower.contains("also") { score += 0.1; }
    score.min(1.0)
}

fn analyze_context_requirements(prompt: &str, text_length: usize) -> ContextRequirements {
    let prompt_lower = prompt.to_lowercase();
    let needs_large_context = text_length > 20000 || prompt_lower.contains("entire file") || prompt_lower.contains("full context");
    let estimated_tokens = text_length / 4;
    let has_multiple_files = prompt_lower.contains("files") || prompt_lower.contains("multiple documents");
    let mut context_score: f64 = 0.0;
    if needs_large_context { context_score += 0.4; }
    if estimated_tokens > 50000 { context_score += 0.3; }
    if has_multiple_files { context_score += 0.3; }
    ContextRequirements { needs_large_context, estimated_tokens, has_multiple_files, context_score: context_score.min(1.0) }
}

fn analyze_intelligence_requirements(prompt: &str, task_type: &TaskType) -> IntelligenceRequirements {
    let prompt_lower = prompt.to_lowercase();
    let needs_reasoning = prompt_lower.contains("why") || prompt_lower.contains("reason") || matches!(task_type, TaskType::Analysis | TaskType::Technical | TaskType::Coding);
    let needs_creativity = prompt_lower.contains("creative") || prompt_lower.contains("story") || matches!(task_type, TaskType::Creative);
    let needs_precision = prompt_lower.contains("precise") || prompt_lower.contains("exact") || matches!(task_type, TaskType::Coding | TaskType::Technical);
    let mut intelligence_score: f64 = 0.0;
    if needs_reasoning { intelligence_score += 0.4; }
    if needs_creativity { intelligence_score += 0.3; }
    if needs_precision { intelligence_score += 0.3; }
    IntelligenceRequirements { needs_reasoning, needs_creativity, needs_precision, intelligence_score: intelligence_score.min(1.0) }
}

fn get_all_models_from_db(conn: &Connection) -> Result<Vec<AiModelKnowledge>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT id, name, performance, features, strengths, weaknesses, benchmark_score, last_updated FROM ai_model_knowledge")?;
    let model_iter = stmt.query_map([], |row| {
        Ok(AiModelKnowledge {
            id: row.get(0)?,
            name: row.get(1)?,
            performance: row.get(2)?,
            features: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or_default(),
            strengths: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
            weaknesses: serde_json::from_str(&row.get::<_, String>(5)?).unwrap_or_default(),
            benchmark_score: row.get(6)?,
            last_updated: row.get(7)?,
        })
    })?;

    let mut models = Vec::new();
    for model in model_iter {
        models.push(model?);
    }
    Ok(models)
}

pub fn select_optimal_model(analysis: &TaskAnalysis, all_models: &[AiModelKnowledge]) -> ModelRecommendation {
    if analysis.task_type == TaskType::Simple && analysis.complexity_score < 0.2 {
        return ModelRecommendation {
            recommended_model: "claude-3-sonnet-20240229".to_string(),
            confidence: 0.95,
            reasoning: "Selected Sonnet for a simple task to optimize for speed and cost.".to_string(),
            alternative_models: vec!["gemini-1.5-flash-latest".to_string()],
            selection_criteria: SelectionCriteria { intelligence_weight: 0.1, speed_weight: 0.5, context_weight: 0.1, cost_weight: 0.3 },
        };
    }

    if analysis.intelligence_requirements.intelligence_score > 0.8 || analysis.complexity_score > 0.8 {
         return ModelRecommendation {
            recommended_model: "claude-3-opus-20240229".to_string(),
            confidence: 0.98,
            reasoning: "Selected Opus for a high-complexity/high-intelligence task to ensure maximum quality and reasoning capabilities.".to_string(),
            alternative_models: vec!["gemini-1.5-pro-latest".to_string()],
            selection_criteria: SelectionCriteria { intelligence_weight: 0.6, speed_weight: 0.1, context_weight: 0.2, cost_weight: 0.1 },
        };
    }

    let criteria = calculate_selection_weights(analysis);
    let mut model_scores: Vec<(String, f64, String)> = Vec::new();

    for model in all_models {
        let intelligence_score = model.performance / 10.0;
        let context_score = if model.features.contains(&"Large context window".to_string()) { 0.9 } else { 0.5 };
        let speed_score = 0.8; 
        let cost_score = 0.7;

        let score = (intelligence_score * criteria.intelligence_weight) +
                    (speed_score * criteria.speed_weight) +
                    (context_score * criteria.context_weight) +
                    (cost_score * criteria.cost_weight);
        
        let reasoning = format!(
            "{}: Score {:.2} (I:{:.2}, S:{:.2}, Ctx:{:.2}, Cost:{:.2})",
            model.name, score, intelligence_score, speed_score, context_score, cost_score
        );
        model_scores.push((model.id.clone(), score, reasoning));
    }

    model_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    if model_scores.is_empty() {
        return ModelRecommendation {
            recommended_model: "claude-3-opus-20240229".to_string(),
            confidence: 0.5,
            reasoning: "No models found in the knowledge base. Defaulting to Opus.".to_string(),
            alternative_models: vec![],
            selection_criteria: criteria,
        };
    }

    let best_model = &model_scores[0];
    let alternatives = model_scores.iter().skip(1).take(3).map(|(id, _, _)| id.clone()).collect();

    ModelRecommendation {
        recommended_model: best_model.0.clone(),
        confidence: 0.9,
        reasoning: format!("Selected {} based on a weighted score. Top contender reasoning: {}", best_model.0, best_model.2),
        alternative_models: alternatives,
        selection_criteria: criteria,
    }
}

fn calculate_selection_weights(analysis: &TaskAnalysis) -> SelectionCriteria {
    let mut context_weight = 0.2;
    let mut intelligence_weight = 0.4;
    let mut speed_weight = 0.2;
    let mut cost_weight = 0.2;

    if analysis.context_requirements.needs_large_context {
        context_weight = 0.5;
        intelligence_weight = 0.3;
    }
    if analysis.intelligence_requirements.intelligence_score > 0.7 {
        intelligence_weight = 0.6;
        context_weight = 0.2;
    }
    if analysis.complexity_score < 0.3 {
        speed_weight = 0.4;
        cost_weight = 0.3;
        intelligence_weight = 0.2;
    }
    SelectionCriteria { context_weight, intelligence_weight, speed_weight, cost_weight }
}

#[command]
pub async fn get_auto_model_recommendation(prompt: String, app: AppHandle) -> Result<ModelRecommendation, String> {
    info!("Getting auto model recommendation for prompt.");
    
    let db_state = app.state::<AgentDb>();
    let conn = db_state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;

    let all_models = get_all_models_from_db(&conn)
        .map_err(|e| format!("Failed to get models from knowledge base: {}", e))?;

    if all_models.is_empty() {
        warn!("Model knowledge base is empty. Daily update may not have run yet. Using fallback.");
         return Ok(ModelRecommendation {
            recommended_model: "claude-3-opus-20240229".to_string(),
            confidence: 0.5,
            reasoning: "Knowledge base is empty. Defaulting to Opus. Please wait for the daily update.".to_string(),
            alternative_models: vec![],
            selection_criteria: SelectionCriteria { intelligence_weight: 1.0, speed_weight: 0.0, context_weight: 0.0, cost_weight: 0.0 },
        });
    }

    let analysis = analyze_task(&prompt);
    let recommendation = select_optimal_model(&analysis, &all_models);
    
    Ok(recommendation)
}