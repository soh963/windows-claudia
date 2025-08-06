use serde::{Deserialize, Serialize};
use tauri::{command, State};
use super::agents::AgentDb;
use log;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAnalysis {
    pub text_length: usize,
    pub complexity_score: f64,
    pub task_type: TaskType,
    pub context_requirements: ContextRequirements,
    pub intelligence_requirements: IntelligenceRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskType {
    Coding,
    Analysis,
    Writing,
    Translation,
    LargeDocument,
    Research,
    Creative,
    Technical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextRequirements {
    pub needs_large_context: bool,
    pub estimated_tokens: usize,
    pub has_multiple_files: bool,
    pub context_score: f64, // 0-1 scale
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceRequirements {
    pub needs_reasoning: bool,
    pub needs_creativity: bool,
    pub needs_precision: bool,
    pub intelligence_score: f64, // 0-1 scale
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

/// Analyze the task to determine requirements
pub fn analyze_task(prompt: &str) -> TaskAnalysis {
    let text_length = prompt.len();
    let word_count = prompt.split_whitespace().count();
    
    // Detect task type
    let task_type = detect_task_type(prompt);
    
    // Calculate complexity score (0-1)
    let complexity_score = calculate_complexity_score(prompt, word_count);
    
    // Analyze context requirements
    let context_requirements = analyze_context_requirements(prompt, text_length);
    
    // Analyze intelligence requirements
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
    
    // Coding indicators
    if prompt_lower.contains("code") || prompt_lower.contains("function") || 
       prompt_lower.contains("class") || prompt_lower.contains("api") ||
       prompt_lower.contains("programming") || prompt_lower.contains("debug") {
        return TaskType::Coding;
    }
    
    // Large document indicators
    if prompt_lower.contains("analyze this file") || prompt_lower.contains("summarize") ||
       prompt_lower.contains("review this document") || prompt.len() > 10000 {
        return TaskType::LargeDocument;
    }
    
    // Analysis indicators
    if prompt_lower.contains("analyze") || prompt_lower.contains("explain") ||
       prompt_lower.contains("compare") || prompt_lower.contains("evaluate") {
        return TaskType::Analysis;
    }
    
    // Research indicators
    if prompt_lower.contains("research") || prompt_lower.contains("find information") ||
       prompt_lower.contains("investigate") {
        return TaskType::Research;
    }
    
    // Translation indicators
    if prompt_lower.contains("translate") || prompt_lower.contains("번역") ||
       prompt_lower.contains("翻译") {
        return TaskType::Translation;
    }
    
    // Creative indicators
    if prompt_lower.contains("creative") || prompt_lower.contains("story") ||
       prompt_lower.contains("write") || prompt_lower.contains("poem") {
        return TaskType::Creative;
    }
    
    // Technical indicators
    if prompt_lower.contains("technical") || prompt_lower.contains("specification") ||
       prompt_lower.contains("architecture") {
        return TaskType::Technical;
    }
    
    TaskType::Writing // Default
}

fn calculate_complexity_score(prompt: &str, word_count: usize) -> f64 {
    let mut score: f64 = 0.0;
    
    // Length factor
    if word_count > 500 { score += 0.3; }
    else if word_count > 100 { score += 0.2; }
    else { score += 0.1; }
    
    // Technical complexity indicators
    let complexity_keywords = [
        "complex", "advanced", "sophisticated", "intricate", "detailed",
        "architecture", "system", "algorithm", "optimization", "performance"
    ];
    
    let prompt_lower = prompt.to_lowercase();
    for keyword in &complexity_keywords {
        if prompt_lower.contains(keyword) {
            score += 0.15;
        }
    }
    
    // Multiple requirements
    if prompt_lower.contains("and") || prompt_lower.contains("also") {
        score += 0.1;
    }
    
    score.min(1.0_f64)
}

fn analyze_context_requirements(prompt: &str, text_length: usize) -> ContextRequirements {
    let prompt_lower = prompt.to_lowercase();
    
    // Check for large context indicators
    let needs_large_context = 
        text_length > 5000 ||
        prompt_lower.contains("entire file") ||
        prompt_lower.contains("whole document") ||
        prompt_lower.contains("all the code") ||
        prompt_lower.contains("complete analysis") ||
        prompt_lower.contains("full context");
    
    // Estimate token count (rough approximation: 1 token ≈ 4 chars)
    let estimated_tokens = text_length / 4;
    
    // Check for multiple files
    let has_multiple_files = 
        prompt_lower.contains("files") ||
        prompt_lower.contains("compare") ||
        prompt_lower.contains("multiple");
    
    // Calculate context score
    let mut context_score: f64 = 0.0;
    if needs_large_context { context_score += 0.4; }
    if estimated_tokens > 50000 { context_score += 0.3; }
    if has_multiple_files { context_score += 0.3; }
    
    ContextRequirements {
        needs_large_context,
        estimated_tokens,
        has_multiple_files,
        context_score: context_score.min(1.0_f64),
    }
}

fn analyze_intelligence_requirements(prompt: &str, task_type: &TaskType) -> IntelligenceRequirements {
    let prompt_lower = prompt.to_lowercase();
    
    // Intelligence indicators
    let needs_reasoning = 
        prompt_lower.contains("why") ||
        prompt_lower.contains("how") ||
        prompt_lower.contains("reason") ||
        prompt_lower.contains("logic") ||
        matches!(task_type, TaskType::Analysis | TaskType::Technical | TaskType::Coding);
    
    let needs_creativity = 
        prompt_lower.contains("creative") ||
        prompt_lower.contains("innovative") ||
        prompt_lower.contains("design") ||
        matches!(task_type, TaskType::Creative | TaskType::Writing);
    
    let needs_precision = 
        prompt_lower.contains("precise") ||
        prompt_lower.contains("accurate") ||
        prompt_lower.contains("exact") ||
        matches!(task_type, TaskType::Coding | TaskType::Technical);
    
    // Calculate intelligence score
    let mut intelligence_score: f64 = 0.0;
    if needs_reasoning { intelligence_score += 0.4; }
    if needs_creativity { intelligence_score += 0.3; }
    if needs_precision { intelligence_score += 0.3; }
    
    // Additional scoring for complex analysis tasks
    if prompt_lower.contains("complex") && needs_reasoning {
        intelligence_score += 0.2;
    }
    
    IntelligenceRequirements {
        needs_reasoning,
        needs_creativity,
        needs_precision,
        intelligence_score: intelligence_score.min(1.0_f64),
    }
}

/// Select the optimal model based on task analysis
pub fn select_optimal_model(analysis: &TaskAnalysis) -> ModelRecommendation {
    let context_threshold = 0.6; // If context score > 0.6, prefer Gemini
    let intelligence_threshold = 0.7; // If intelligence score > 0.7, prefer Claude
    
    let mut reasoning = String::new();
    let recommended_model: String;
    let confidence: f64;
    let mut alternative_models = Vec::new();
    
    // Decision logic: Context vs Intelligence
    if analysis.context_requirements.context_score > context_threshold {
        // Large context requirement - prefer Gemini
        if analysis.context_requirements.estimated_tokens > 100000 {
            recommended_model = "gemini-2.5-pro".to_string();
            reasoning.push_str("Large context requirement (>100K tokens) - Gemini 2.5 Pro selected for superior context handling and latest reasoning capabilities. ");
            confidence = 0.95_f64;
            alternative_models.push("gemini-2.5-flash".to_string());
        } else {
            recommended_model = "gemini-2.5-flash".to_string();
            reasoning.push_str("Moderate context requirement - Gemini 2.5 Flash selected for balance of context, speed, and efficiency. ");
            confidence = 0.9_f64;
            alternative_models.push("gemini-2.5-pro".to_string());
        }
        alternative_models.push("claude-3-5-sonnet-20250106".to_string());
    } else if analysis.intelligence_requirements.intelligence_score > intelligence_threshold {
        // High intelligence requirement - prefer Claude
        if analysis.complexity_score > 0.8 {
            recommended_model = "claude-3-5-sonnet-20250106".to_string();
            reasoning.push_str("High intelligence and complexity requirement - Claude 3.5 Sonnet selected for superior reasoning and latest capabilities. ");
            confidence = 0.95_f64;
            alternative_models.push("claude-3-5-haiku-20250107".to_string());
        } else {
            recommended_model = "claude-3-5-sonnet-20250106".to_string();
            reasoning.push_str("Moderate intelligence requirement - Claude 3.5 Sonnet selected for balanced intelligence and efficiency. ");
            confidence = 0.9_f64;
            alternative_models.push("claude-3-5-haiku-20250107".to_string());
        }
        alternative_models.push("gemini-2.5-pro".to_string());
    } else {
        // Balanced requirement - use heuristics
        match analysis.task_type {
            TaskType::Coding | TaskType::Technical => {
                recommended_model = "claude-3-5-sonnet-20250106".to_string();
                reasoning.push_str("Coding/Technical task - Claude 3.5 Sonnet selected for superior programming expertise and latest capabilities. ");
                confidence = 0.9_f64;
                alternative_models.extend(["claude-3-5-haiku-20250107".to_string(), "gemini-2.5-pro".to_string()]);
            },
            TaskType::LargeDocument | TaskType::Research => {
                recommended_model = "gemini-2.5-pro".to_string();
                reasoning.push_str("Large document/Research task - Gemini 2.5 Pro selected for superior context capacity and reasoning. ");
                confidence = 0.9_f64;
                alternative_models.extend(["gemini-2.5-flash".to_string(), "claude-3-5-sonnet-20250106".to_string()]);
            },
            TaskType::Creative | TaskType::Writing => {
                recommended_model = "claude-3-5-sonnet-20250106".to_string();
                reasoning.push_str("Creative/Writing task - Claude 3.5 Sonnet selected for excellent creative and writing capabilities. ");
                confidence = 0.9_f64;
                alternative_models.extend(["claude-3-5-haiku-20250107".to_string(), "gemini-2.5-pro".to_string()]);
            },
            _ => {
                recommended_model = "claude-3-5-sonnet-20250106".to_string();
                reasoning.push_str("General task - Claude 3.5 Sonnet selected as the most balanced and capable option. ");
                confidence = 0.85_f64;
                alternative_models.extend(["gemini-2.5-flash".to_string(), "claude-3-5-haiku-20250107".to_string()]);
            }
        }
    }
    
    // Add task-specific reasoning
    reasoning.push_str(&format!(
        "Task analysis: {} complexity, {} context requirement, {} intelligence requirement.",
        match analysis.complexity_score {
            s if s > 0.8 => "High",
            s if s > 0.5 => "Medium",
            _ => "Low"
        },
        match analysis.context_requirements.context_score {
            s if s > 0.7 => "High",
            s if s > 0.4 => "Medium", 
            _ => "Low"
        },
        match analysis.intelligence_requirements.intelligence_score {
            s if s > 0.7 => "High",
            s if s > 0.4 => "Medium",
            _ => "Low"
        }
    ));
    
    ModelRecommendation {
        recommended_model,
        confidence,
        reasoning,
        alternative_models,
        selection_criteria: SelectionCriteria {
            context_weight: analysis.context_requirements.context_score,
            intelligence_weight: analysis.intelligence_requirements.intelligence_score,
            speed_weight: 1.0 - analysis.complexity_score,
            cost_weight: 1.0 - analysis.context_requirements.context_score,
        },
    }
}

/// Latest model definitions for auto-selection (August 2025)
const LATEST_MODELS: &[(&str, &str, f64, f64, f64, f64)] = &[
    // Model ID, Display Name, Intelligence Score, Speed Score, Context Score, Cost Score
    ("opus-4.1", "Claude 4.1 Opus", 0.95, 0.70, 0.80, 0.30), // Most intelligent, expensive
    ("sonnet-4", "Claude 4 Sonnet", 0.90, 0.85, 0.80, 0.60), // Balanced excellence
    ("sonnet-3.7", "Claude 3.7 Sonnet", 0.85, 0.88, 0.80, 0.65), // Fast hybrid reasoning
    ("gemini-1.5-pro", "Gemini 1.5 Pro", 0.92, 0.75, 0.95, 0.50), // State-of-the-art thinking
    ("gemini-2.5-flash", "Gemini 2.5 Flash", 0.85, 0.95, 0.90, 0.80), // Fast thinking model
    ("gemini-2.0-pro-exp", "Gemini 2.0 Pro", 0.88, 0.78, 0.90, 0.55), // Best coding
    ("gemini-2.0-flash", "Gemini 2.0 Flash", 0.82, 0.90, 0.85, 0.75), // Production ready
    ("gemini-2.0-flash-lite", "Gemini 2.0 Flash-Lite", 0.75, 0.95, 0.80, 0.90), // Most cost-efficient
];

/// Update model database with latest model information on app startup
#[command]
pub async fn update_latest_models_on_startup(
    db: State<'_, AgentDb>
) -> Result<String, String> {
    log::info!("Updating latest models on startup");
    
    let conn = db.0.lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;
    
    // Create or update model_metadata table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_metadata (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            provider TEXT NOT NULL,
            intelligence_score REAL NOT NULL,
            speed_score REAL NOT NULL,
            context_score REAL NOT NULL,
            cost_score REAL NOT NULL,
            is_latest BOOLEAN DEFAULT 1,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )",
        [],
    ).map_err(|e| format!("Failed to create model_metadata table: {}", e))?;
    
    // Clear existing latest models
    conn.execute("DELETE FROM model_metadata", [])
        .map_err(|e| format!("Failed to clear model_metadata: {}", e))?;
    
    // Insert latest models
    for (model_id, display_name, intelligence, speed, context, cost) in LATEST_MODELS {
        let provider = if model_id.starts_with("claude") || model_id.contains("opus") || model_id.contains("sonnet") {
            "claude"
        } else {
            "gemini"
        };
        
        conn.execute(
            "INSERT INTO model_metadata (id, display_name, provider, intelligence_score, speed_score, context_score, cost_score)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            [
                model_id,
                display_name,
                provider,
                &intelligence.to_string(),
                &speed.to_string(), 
                &context.to_string(),
                &cost.to_string()
            ],
        ).map_err(|e| format!("Failed to insert model metadata for {}: {}", model_id, e))?;
    }
    
    log::info!("Successfully updated {} latest models", LATEST_MODELS.len());
    Ok(format!("Updated {} latest models in database", LATEST_MODELS.len()))
}

/// Get all latest models from database
#[command]
pub async fn get_latest_models(
    db: State<'_, AgentDb>
) -> Result<Vec<serde_json::Value>, String> {
    let conn = db.0.lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT id, display_name, provider, intelligence_score, speed_score, context_score, cost_score, updated_at
         FROM model_metadata WHERE is_latest = 1 ORDER BY intelligence_score DESC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let model_iter = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "display_name": row.get::<_, String>(1)?,
            "provider": row.get::<_, String>(2)?,
            "intelligence_score": row.get::<_, f64>(3)?,
            "speed_score": row.get::<_, f64>(4)?,
            "context_score": row.get::<_, f64>(5)?,
            "cost_score": row.get::<_, f64>(6)?,
            "updated_at": row.get::<_, i64>(7)?
        }))
    }).map_err(|e| format!("Failed to query models: {}", e))?;
    
    let mut models = Vec::new();
    for model in model_iter {
        models.push(model.map_err(|e| format!("Failed to process model row: {}", e))?);
    }
    
    Ok(models)
}

/// Tauri command to get model recommendation using latest 2025 models
#[command]
pub async fn get_auto_model_recommendation(prompt: String, _db: State<'_, AgentDb>) -> Result<ModelRecommendation, String> {
    log::info!("Getting auto model recommendation with latest 2025 models");
    let analysis = analyze_task(&prompt);
    let recommendation = select_optimal_model_2025(&analysis);
    Ok(recommendation)
}

/// Enhanced model selection using latest 2025 models
fn select_optimal_model_2025(analysis: &TaskAnalysis) -> ModelRecommendation {
    let criteria = calculate_selection_weights(analysis);
    
    let mut model_scores: Vec<(String, f64, String)> = Vec::new();
    
    for (model_id, display_name, intelligence, speed, context, cost) in LATEST_MODELS {
        let score = calculate_weighted_score(
            *intelligence, *speed, *context, *cost,
            &criteria, analysis
        );
        
        let reasoning = format!(
            "{}: I({:.2}), S({:.2}), C({:.2}), Cost({:.2}) = {:.2}",
            display_name, intelligence, speed, context, cost, score
        );
        
        model_scores.push((model_id.to_string(), score, reasoning));
    }
    
    // Sort by score descending
    model_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    
    let recommended_model = model_scores[0].0.clone();
    let confidence = model_scores[0].1;
    let reasoning = generate_detailed_reasoning(analysis, &model_scores[0], &criteria);
    
    // Get top 3 alternatives
    let alternative_models: Vec<String> = model_scores.iter()
        .skip(1)
        .take(3)
        .map(|(id, _, _)| id.clone())
        .collect();
    
    ModelRecommendation {
        recommended_model,
        confidence,
        reasoning,
        alternative_models,
        selection_criteria: criteria,
    }
}

fn calculate_selection_weights(analysis: &TaskAnalysis) -> SelectionCriteria {
    let mut context_weight = 0.2;
    let mut intelligence_weight = 0.3;
    let mut speed_weight = 0.3;
    let mut cost_weight = 0.2;
    
    // Adjust weights based on requirements
    if analysis.context_requirements.needs_large_context {
        context_weight = 0.4;
        intelligence_weight = 0.3;
        speed_weight = 0.2;
        cost_weight = 0.1;
    }
    
    if analysis.intelligence_requirements.intelligence_score > 0.8 {
        intelligence_weight = 0.5;
        context_weight = 0.2;
        speed_weight = 0.2;
        cost_weight = 0.1;
    }
    
    if matches!(analysis.task_type, TaskType::Coding | TaskType::Technical) && analysis.complexity_score > 0.7 {
        intelligence_weight = 0.4;
        context_weight = 0.3;
        speed_weight = 0.2;
        cost_weight = 0.1;
    }
    
    // For simple tasks, prioritize speed and cost
    if analysis.complexity_score < 0.3 {
        speed_weight = 0.4;
        cost_weight = 0.3;
        intelligence_weight = 0.2;
        context_weight = 0.1;
    }
    
    SelectionCriteria {
        context_weight,
        intelligence_weight,
        speed_weight,
        cost_weight,
    }
}

fn calculate_weighted_score(
    intelligence: f64,
    speed: f64,
    context: f64,
    cost: f64,
    criteria: &SelectionCriteria,
    analysis: &TaskAnalysis,
) -> f64 {
    let base_score = 
        intelligence * criteria.intelligence_weight +
        speed * criteria.speed_weight +
        context * criteria.context_weight +
        cost * criteria.cost_weight;
    
    // Apply bonuses for specific requirements
    let mut bonus = 0.0;
    
    // Bonus for high intelligence models on complex tasks
    if analysis.complexity_score > 0.7 && intelligence > 0.9 {
        bonus += 0.1;
    }
    
    // Bonus for high context models on large context tasks
    if analysis.context_requirements.needs_large_context && context > 0.9 {
        bonus += 0.1;
    }
    
    // Bonus for coding-optimized models on coding tasks
    if matches!(analysis.task_type, TaskType::Coding) && intelligence > 0.88 {
        bonus += 0.05;
    }
    
    (base_score + bonus).min(1.0)
}

fn generate_detailed_reasoning(
    analysis: &TaskAnalysis,
    best_model: &(String, f64, String),
    criteria: &SelectionCriteria,
) -> String {
    let model_name = match best_model.0.as_str() {
        "opus-4.1" => "Claude 4.1 Opus",
        "sonnet-4" => "Claude 4 Sonnet", 
        "sonnet-3.7" => "Claude 3.7 Sonnet",
        "gemini-2.5-pro-exp" => "Gemini 2.5 Pro",
        "gemini-2.5-flash" => "Gemini 2.5 Flash",
        "gemini-2.0-pro-exp" => "Gemini 2.0 Pro",
        "gemini-2.0-flash" => "Gemini 2.0 Flash",
        "gemini-2.0-flash-lite" => "Gemini 2.0 Flash-Lite",
        _ => "Unknown Model"
    };
    
    let mut reasons = Vec::new();
    
    // Primary reason based on highest weight
    if criteria.intelligence_weight >= criteria.context_weight && 
       criteria.intelligence_weight >= criteria.speed_weight {
        reasons.push(format!("{} selected for superior intelligence on {:?} tasks", 
                           model_name, analysis.task_type));
    } else if criteria.context_weight >= criteria.speed_weight {
        reasons.push(format!("{} selected for excellent context handling", model_name));
    } else {
        reasons.push(format!("{} selected for optimal speed and efficiency", model_name));
    }
    
    // Add specific considerations
    if analysis.complexity_score > 0.7 {
        reasons.push("High complexity requires advanced reasoning".to_string());
    }
    
    if analysis.context_requirements.needs_large_context {
        reasons.push("Large context requirement prioritizes extensive context windows".to_string());
    }
    
    if matches!(analysis.task_type, TaskType::Coding) {
        reasons.push("Coding task benefits from programming-optimized models".to_string());
    }
    
    reasons.join(". ")
}

/// Tauri command to analyze task without recommendation
#[command]
pub async fn analyze_task_requirements(prompt: String) -> Result<TaskAnalysis, String> {
    let analysis = analyze_task(&prompt);
    Ok(analysis)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_coding_task_detection() {
        let prompt = "Write a function to sort an array in JavaScript";
        let analysis = analyze_task(prompt);
        assert!(matches!(analysis.task_type, TaskType::Coding));
    }

    #[test]
    fn test_large_context_detection() {
        let long_prompt = "a".repeat(10000);
        let analysis = analyze_task(&long_prompt);
        assert!(analysis.context_requirements.needs_large_context);
    }

    #[test]
    fn test_intelligence_requirement() {
        let prompt = "Explain the complex reasoning behind quantum entanglement and its implications";
        let analysis = analyze_task(prompt);
        assert!(analysis.intelligence_requirements.needs_reasoning);
        assert!(analysis.intelligence_requirements.intelligence_score > 0.5);
    }

    #[test]
    fn test_model_selection_for_large_context() {
        let analysis = TaskAnalysis {
            text_length: 50000,
            complexity_score: 0.3,
            task_type: TaskType::LargeDocument,
            context_requirements: ContextRequirements {
                needs_large_context: true,
                estimated_tokens: 150000,
                has_multiple_files: true,
                context_score: 0.9,
            },
            intelligence_requirements: IntelligenceRequirements {
                needs_reasoning: false,
                needs_creativity: false,
                needs_precision: false,
                intelligence_score: 0.2,
            },
        };
        
        let recommendation = select_optimal_model(&analysis);
        assert_eq!(recommendation.recommended_model, "gemini-2.5-pro");
        assert!(recommendation.confidence > 0.8);
    }

    #[test]
    fn test_model_selection_for_high_intelligence() {
        let analysis = TaskAnalysis {
            text_length: 500,
            complexity_score: 0.9,
            task_type: TaskType::Technical,
            context_requirements: ContextRequirements {
                needs_large_context: false,
                estimated_tokens: 1000,
                has_multiple_files: false,
                context_score: 0.2,
            },
            intelligence_requirements: IntelligenceRequirements {
                needs_reasoning: true,
                needs_creativity: true,
                needs_precision: true,
                intelligence_score: 0.9,
            },
        };
        
        let recommendation = select_optimal_model(&analysis);
        assert_eq!(recommendation.recommended_model, "claude-3-5-sonnet-20250106");
        assert!(recommendation.confidence > 0.9);
    }
}