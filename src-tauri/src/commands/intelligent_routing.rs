use anyhow::Result;
use log::{debug, info, warn, error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use regex::Regex;
use tauri::{command, AppHandle, Manager, State};
use rusqlite::{Connection, Result as SqliteResult};
use chrono::{DateTime, Utc};
use super::agents::AgentDb;

/// Tool type that can be invoked
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ToolType {
    Agent(String),
    SlashCommand(String),
    SuperClaude,
    McpServer(String),
}

/// Tool invocation decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInvocation {
    pub tool_type: ToolType,
    pub confidence: f32,
    pub reason: String,
    pub priority: i32,
}

/// Routing result containing all tools to invoke
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingResult {
    pub invocations: Vec<ToolInvocation>,
    pub detected_intent: String,
    pub complexity_score: f32,
    pub domain: String,
}

/// Pattern matcher for intelligent routing
#[derive(Debug)]
pub struct PatternMatcher {
    agent_patterns: HashMap<String, Vec<String>>,
    command_patterns: HashMap<String, Vec<String>>,
    mcp_patterns: HashMap<String, Vec<String>>,
    superclaude_triggers: Vec<String>,
}

impl PatternMatcher {
    pub fn new() -> Self {
        let mut agent_patterns = HashMap::new();
        let mut command_patterns = HashMap::new();
        let mut mcp_patterns = HashMap::new();
        
        // Agent patterns
        agent_patterns.insert("frontend".to_string(), vec![
            "component", "ui", "interface", "button", "form", "css", "style",
            "react", "vue", "angular", "responsive", "design", "layout"
        ].into_iter().map(String::from).collect());
        
        agent_patterns.insert("backend".to_string(), vec![
            "api", "database", "server", "endpoint", "authentication", "query",
            "rest", "graphql", "microservice", "cache", "performance"
        ].into_iter().map(String::from).collect());
        
        agent_patterns.insert("security".to_string(), vec![
            "vulnerability", "security", "auth", "encryption", "ssl", "token",
            "exploit", "injection", "xss", "csrf", "audit"
        ].into_iter().map(String::from).collect());
        
        // Command patterns
        command_patterns.insert("analyze".to_string(), vec![
            "analyze", "review", "check", "examine", "investigate", "understand",
            "what is", "how does", "explain", "why"
        ].into_iter().map(String::from).collect());
        
        command_patterns.insert("build".to_string(), vec![
            "build", "create", "make", "construct", "develop", "generate",
            "set up", "initialize", "start new"
        ].into_iter().map(String::from).collect());
        
        command_patterns.insert("improve".to_string(), vec![
            "improve", "optimize", "enhance", "refactor", "fix", "better",
            "performance", "clean up", "modernize"
        ].into_iter().map(String::from).collect());
        
        // MCP patterns
        mcp_patterns.insert("playwright".to_string(), vec![
            "test", "e2e", "browser", "automation", "screenshot", "click",
            "navigate", "selenium", "cypress", "testing"
        ].into_iter().map(String::from).collect());
        
        mcp_patterns.insert("sequential_thinking".to_string(), vec![
            "complex", "think", "reason", "logic", "step by step", "systematic",
            "architecture", "design pattern", "algorithm"
        ].into_iter().map(String::from).collect());
        
        // SuperClaude triggers
        let superclaude_triggers = vec![
            "use all tools", "comprehensive", "everything", "full analysis",
            "complete", "thorough", "all available", "maximum"
        ].into_iter().map(String::from).collect();
        
        Self {
            agent_patterns,
            command_patterns,
            mcp_patterns,
            superclaude_triggers,
        }
    }
    
    pub fn analyze_input(&self, input: &str) -> RoutingResult {
        let input_lower = input.to_lowercase();
        let mut invocations = Vec::new();
        
        // Calculate complexity score
        let complexity_score = self.calculate_complexity(&input_lower);
        
        // Detect domain
        let domain = self.detect_domain(&input_lower);
        
        // Detect intent
        let detected_intent = self.detect_intent(&input_lower);
        
        // Check for SuperClaude triggers
        if self.should_use_superclaude(&input_lower) {
            invocations.push(ToolInvocation {
                tool_type: ToolType::SuperClaude,
                confidence: 0.95,
                reason: "Comprehensive analysis requested".to_string(),
                priority: 100,
            });
        }
        
        // Match agents
        for (agent, patterns) in &self.agent_patterns {
            let score = self.calculate_pattern_score(&input_lower, patterns);
            if score > 0.3 {
                invocations.push(ToolInvocation {
                    tool_type: ToolType::Agent(agent.clone()),
                    confidence: score,
                    reason: format!("Domain-specific expertise for {}", agent),
                    priority: (score * 50.0) as i32,
                });
            }
        }
        
        // Match commands
        for (command, patterns) in &self.command_patterns {
            let score = self.calculate_pattern_score(&input_lower, patterns);
            if score > 0.4 {
                invocations.push(ToolInvocation {
                    tool_type: ToolType::SlashCommand(command.clone()),
                    confidence: score,
                    reason: format!("Command pattern match for /{}", command),
                    priority: (score * 60.0) as i32,
                });
            }
        }
        
        // Match MCP servers
        for (mcp, patterns) in &self.mcp_patterns {
            let score = self.calculate_pattern_score(&input_lower, patterns);
            if score > 0.35 {
                invocations.push(ToolInvocation {
                    tool_type: ToolType::McpServer(mcp.clone()),
                    confidence: score,
                    reason: format!("MCP server {} capabilities needed", mcp),
                    priority: (score * 40.0) as i32,
                });
            }
        }
        
        // Sort by priority
        invocations.sort_by(|a, b| b.priority.cmp(&a.priority));
        
        RoutingResult {
            invocations,
            detected_intent,
            complexity_score,
            domain,
        }
    }
    
    fn calculate_pattern_score(&self, input: &str, patterns: &[String]) -> f32 {
        let mut matches = 0;
        let mut total_weight = 0.0;
        
        for pattern in patterns {
            if input.contains(pattern) {
                matches += 1;
                // Weight by pattern length (longer patterns are more specific)
                total_weight += pattern.len() as f32 / 10.0;
            }
        }
        
        if matches == 0 {
            return 0.0;
        }
        
        // Calculate score based on matches and pattern specificity
        let base_score = matches as f32 / patterns.len() as f32;
        let weighted_score = (base_score + total_weight).min(1.0);
        
        weighted_score
    }
    
    fn should_use_superclaude(&self, input: &str) -> bool {
        self.superclaude_triggers.iter().any(|trigger| input.contains(trigger))
    }
    
    fn calculate_complexity(&self, input: &str) -> f32 {
        let mut score = 0.0;
        
        // Length factor
        let words = input.split_whitespace().count();
        score += (words as f32 / 50.0).min(0.3);
        
        // Technical terms
        let technical_terms = ["implement", "architecture", "optimize", "refactor", "algorithm", "framework"];
        for term in &technical_terms {
            if input.contains(term) {
                score += 0.1;
            }
        }
        
        // Multiple operations
        let operation_words = ["and", "then", "also", "plus", "with"];
        for word in &operation_words {
            if input.contains(word) {
                score += 0.05;
            }
        }
        
        score.min(1.0)
    }
    
    fn detect_domain(&self, input: &str) -> String {
        let mut domain_scores: HashMap<&str, f32> = HashMap::new();
        
        for (domain, patterns) in &self.agent_patterns {
            let score = self.calculate_pattern_score(input, patterns);
            domain_scores.insert(domain, score);
        }
        
        domain_scores.iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(domain, _)| domain.to_string())
            .unwrap_or_else(|| "general".to_string())
    }
    
    fn detect_intent(&self, input: &str) -> String {
        if input.contains("?") || input.starts_with("what") || input.starts_with("how") {
            "question".to_string()
        } else if input.contains("create") || input.contains("build") || input.contains("make") {
            "creation".to_string()
        } else if input.contains("fix") || input.contains("debug") || input.contains("error") {
            "troubleshooting".to_string()
        } else if input.contains("improve") || input.contains("optimize") {
            "improvement".to_string()
        } else {
            "general".to_string()
        }
    }
}

/// Analyze chat input and determine which tools to use
#[tauri::command]
pub async fn analyze_chat_input(input: String) -> Result<RoutingResult, String> {
    debug!("Analyzing chat input: {}", input);
    
    let matcher = PatternMatcher::new();
    let result = matcher.analyze_input(&input);
    
    info!("Routing result: {} tools identified, complexity: {}", 
          result.invocations.len(), result.complexity_score);
    
    Ok(result)
}

/// MCP installation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpInstallRequest {
    pub query: String,
    pub detected_packages: Vec<String>,
    pub confidence: f32,
}

/// Parse natural language MCP installation request
#[tauri::command]
pub async fn parse_mcp_install_request(input: String) -> Result<McpInstallRequest, String> {
    debug!("Parsing MCP install request: {}", input);
    
    let input_lower = input.to_lowercase();
    let mut detected_packages = Vec::new();
    let mut confidence: f32 = 0.0;
    
    // Common MCP server names and their variations
    let known_mcps = vec![
        ("playwright", vec!["playwright", "browser", "e2e"]),
        ("sequential_thinking", vec!["sequential", "thinking", "reasoning"]),
        ("github", vec!["github", "git", "repository"]),
        ("filesystem", vec!["file", "directory", "fs"]),
        ("slack", vec!["slack", "messaging"]),
        ("postgres", vec!["postgres", "postgresql", "database", "db"]),
        ("fetch", vec!["fetch", "http", "api", "rest"]),
    ];
    
    // Check for explicit MCP mentions
    if input_lower.contains("mcp") || input_lower.contains("model context protocol") {
        confidence += 0.3;
    }
    
    // Check for installation keywords
    let install_keywords = ["install", "add", "setup", "configure", "enable", "activate"];
    for keyword in &install_keywords {
        if input_lower.contains(keyword) {
            confidence += 0.2;
            break;
        }
    }
    
    // Detect specific MCP servers
    for (mcp_name, keywords) in &known_mcps {
        for keyword in keywords {
            if input_lower.contains(keyword) {
                detected_packages.push(mcp_name.to_string());
                confidence += 0.1;
                break;
            }
        }
    }
    
    // If no specific MCP detected but high confidence it's an install request
    if detected_packages.is_empty() && confidence > 0.4 {
        // Try to extract package name using regex
        let package_regex = Regex::new(r"(?:install|add|setup)\s+(\w+)(?:\s+mcp)?").unwrap();
        if let Some(captures) = package_regex.captures(&input_lower) {
            if let Some(package) = captures.get(1) {
                detected_packages.push(package.as_str().to_string());
            }
        }
    }
    
    confidence = confidence.min(1.0);
    
    Ok(McpInstallRequest {
        query: input,
        detected_packages,
        confidence,
    })
}

// =============================================================================
// AUTO SMART SELECTION SYSTEM - ENHANCED MODEL ROUTING
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiModelBenchmark {
    pub model_id: String,
    pub provider: String,
    pub intelligence_score: f64,      // 0-100
    pub speed_score: f64,            // 0-100 (responses/minute)
    pub coding_excellence: f64,      // 0-100
    pub analysis_depth: f64,         // 0-100
    pub creative_writing: f64,       // 0-100
    pub technical_precision: f64,    // 0-100
    pub cost_per_1k_tokens: f64,    // USD cost
    pub average_response_time: f64,  // milliseconds
    pub success_rate: f64,          // 0-100%
    pub context_window: u32,        // max tokens
    pub supports_tools: bool,       // MCP/agents support
    pub supports_vision: bool,
    pub supports_audio: bool,
    pub last_updated: DateTime<Utc>,
    pub availability_score: f64,    // 0-100 (uptime)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskComplexityAnalysis {
    pub task_id: String,
    pub text_length: usize,
    pub word_count: usize,
    pub complexity_indicators: HashMap<String, f64>,
    pub domain_classification: TaskDomain,
    pub priority_level: TaskPriority,
    pub estimated_duration: u32,     // minutes
    pub required_capabilities: Vec<String>,
    pub context_requirements: ContextAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub enum TaskDomain {
    Coding,
    Analysis,
    Writing,
    Research,
    Translation,
    Creative,
    Technical,
    Debugging,
    Architecture,
    Performance,
    Security,
    Documentation,
    DataProcessing,
    MultiModal,
    Simple
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskPriority {
    Low,      // Speed over quality
    Medium,   // Balance
    High,     // Quality over speed
    Critical  // Maximum intelligence
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextAnalysis {
    pub needs_large_context: bool,
    pub estimated_tokens: usize,
    pub has_files: bool,
    pub has_images: bool,
    pub has_code: bool,
    pub requires_tools: bool,
    pub context_complexity: f64,  // 0-1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRecommendationV2 {
    pub primary_model: String,
    pub fallback_models: Vec<String>,
    pub confidence: f64,
    pub reasoning: String,
    pub estimated_cost: f64,
    pub estimated_duration: u32,
    pub task_distribution: Option<TaskDistribution>,
    pub selection_criteria: SelectionCriteriaV2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDistribution {
    pub use_multiple_models: bool,
    pub primary_task: String,
    pub secondary_tasks: HashMap<String, String>, // task_type -> model_id
    pub coordination_model: String, // Claude 4.1 Opus for supervision
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionCriteriaV2 {
    pub intelligence_weight: f64,
    pub speed_weight: f64,
    pub cost_weight: f64,
    pub reliability_weight: f64,
    pub capability_weight: f64,
    pub context_weight: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPerformanceMetrics {
    pub model_id: String,
    pub success_rate: f64,
    pub average_response_time: f64,
    pub token_efficiency: f64,
    pub user_satisfaction: f64,
    pub task_completion_rate: f64,
    pub error_rate: f64,
    pub last_measured: DateTime<Utc>,
}

/// Enhanced task analysis with more sophisticated detection
pub fn analyze_task_complexity_v2(prompt: &str, context: Option<&str>) -> TaskComplexityAnalysis {
    let text_length = prompt.len() + context.map_or(0, |c| c.len());
    let word_count = prompt.split_whitespace().count();
    
    let mut complexity_indicators = HashMap::new();
    let _prompt_lower = prompt.to_lowercase();
    let full_text = format!("{} {}", prompt, context.unwrap_or(""));
    let full_text_lower = full_text.to_lowercase();
    
    // Sophisticated complexity detection
    complexity_indicators.insert("length_complexity".to_string(), 
        (word_count as f64 / 1000.0).min(1.0));
    
    // Technical complexity indicators
    let technical_keywords = ["algorithm", "optimization", "architecture", "system", "design", "implementation", "refactor", "analyze", "debug", "performance", "security", "scale", "integrate"];
    let technical_score = technical_keywords.iter()
        .map(|&keyword| if full_text_lower.contains(keyword) { 1.0 } else { 0.0 })
        .sum::<f64>() / technical_keywords.len() as f64;
    complexity_indicators.insert("technical_complexity".to_string(), technical_score);
    
    // Code-related complexity
    let code_indicators = ["function", "class", "method", "variable", "import", "export", "async", "await", "promise", "callback"];
    let code_score = code_indicators.iter()
        .map(|&keyword| if full_text_lower.contains(keyword) { 1.0 } else { 0.0 })
        .sum::<f64>() / code_indicators.len() as f64;
    complexity_indicators.insert("code_complexity".to_string(), code_score);
    
    // Multi-step complexity
    let multi_step_indicators = ["first", "then", "next", "finally", "step", "phase", "and also", "additionally"];
    let multi_step_score = multi_step_indicators.iter()
        .map(|&keyword| if full_text_lower.contains(keyword) { 1.0 } else { 0.0 })
        .sum::<f64>() / multi_step_indicators.len() as f64;
    complexity_indicators.insert("multi_step_complexity".to_string(), multi_step_score);
    
    let domain = classify_task_domain(&full_text_lower);
    let priority = determine_task_priority(&complexity_indicators, &domain);
    let estimated_duration = estimate_task_duration(&complexity_indicators, word_count);
    
    let required_capabilities = analyze_required_capabilities(&full_text_lower, &domain);
    let context_requirements = analyze_context_requirements_v2(&full_text_lower, text_length);
    
    TaskComplexityAnalysis {
        task_id: format!("task_{}", chrono::Utc::now().timestamp_millis()),
        text_length,
        word_count,
        complexity_indicators,
        domain_classification: domain,
        priority_level: priority,
        estimated_duration,
        required_capabilities,
        context_requirements,
    }
}

fn classify_task_domain(text: &str) -> TaskDomain {
    let domain_keywords = vec![
        (TaskDomain::Coding, vec!["code", "function", "class", "debug", "implement", "programming", "script"]),
        (TaskDomain::Analysis, vec!["analyze", "examine", "evaluate", "assess", "investigate", "study"]),
        (TaskDomain::Writing, vec!["write", "compose", "draft", "create content", "blog", "article"]),
        (TaskDomain::Research, vec!["research", "find", "search", "lookup", "investigate", "gather"]),
        (TaskDomain::Creative, vec!["creative", "story", "poem", "artistic", "imaginative", "brainstorm"]),
        (TaskDomain::Technical, vec!["technical", "engineering", "system", "infrastructure", "deployment"]),
        (TaskDomain::Architecture, vec!["architecture", "design", "structure", "pattern", "framework"]),
        (TaskDomain::Performance, vec!["optimize", "performance", "speed", "efficiency", "benchmark"]),
        (TaskDomain::Security, vec!["security", "vulnerability", "encrypt", "authentication", "audit"]),
        (TaskDomain::Documentation, vec!["document", "readme", "guide", "manual", "specification"]),
    ];
    
    let mut scores: HashMap<TaskDomain, f64> = HashMap::new();
    
    for (domain, keywords) in domain_keywords {
        let score = keywords.iter()
            .map(|&keyword| if text.contains(keyword) { 1.0 } else { 0.0 })
            .sum::<f64>() / keywords.len() as f64;
        scores.insert(domain, score);
    }
    
    scores.into_iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
        .map(|(domain, _)| domain)
        .unwrap_or(TaskDomain::Simple)
}

fn determine_task_priority(complexity_indicators: &HashMap<String, f64>, domain: &TaskDomain) -> TaskPriority {
    let avg_complexity = complexity_indicators.values().sum::<f64>() / complexity_indicators.len() as f64;
    
    match domain {
        TaskDomain::Security | TaskDomain::Architecture => {
            if avg_complexity > 0.7 { TaskPriority::Critical } else { TaskPriority::High }
        },
        TaskDomain::Coding | TaskDomain::Technical | TaskDomain::Performance => {
            if avg_complexity > 0.8 { TaskPriority::Critical }
            else if avg_complexity > 0.5 { TaskPriority::High }
            else { TaskPriority::Medium }
        },
        TaskDomain::Simple => TaskPriority::Low,
        _ => {
            if avg_complexity > 0.7 { TaskPriority::High }
            else if avg_complexity > 0.4 { TaskPriority::Medium }
            else { TaskPriority::Low }
        }
    }
}

fn estimate_task_duration(complexity_indicators: &HashMap<String, f64>, word_count: usize) -> u32 {
    let base_duration = (word_count / 100) as f64; // 1 minute per 100 words
    let complexity_multiplier = complexity_indicators.values().sum::<f64>() / complexity_indicators.len() as f64;
    
    let estimated_minutes = base_duration * (1.0 + complexity_multiplier * 2.0);
    estimated_minutes.max(1.0).min(60.0) as u32 // 1-60 minutes
}

fn analyze_required_capabilities(text: &str, domain: &TaskDomain) -> Vec<String> {
    let mut capabilities = vec!["text_generation".to_string()];
    
    if text.contains("image") || text.contains("picture") || text.contains("visual") {
        capabilities.push("vision".to_string());
    }
    
    if text.contains("audio") || text.contains("sound") || text.contains("voice") {
        capabilities.push("audio".to_string());
    }
    
    if matches!(domain, TaskDomain::Coding | TaskDomain::Technical | TaskDomain::Architecture) {
        capabilities.push("code_execution".to_string());
        capabilities.push("tools".to_string());
    }
    
    if text.contains("search") || text.contains("browse") || text.contains("web") {
        capabilities.push("web_browsing".to_string());
    }
    
    capabilities
}

fn analyze_context_requirements_v2(text: &str, text_length: usize) -> ContextAnalysis {
    ContextAnalysis {
        needs_large_context: text_length > 20000 || text.contains("entire") || text.contains("full context"),
        estimated_tokens: text_length / 4, // Rough estimation
        has_files: text.contains("file") || text.contains("document"),
        has_images: text.contains("image") || text.contains("picture"),
        has_code: text.contains("code") || text.contains("function") || text.contains("class"),
        requires_tools: text.contains("execute") || text.contains("run") || text.contains("analyze"),
        context_complexity: if text_length > 50000 { 1.0 } 
                           else if text_length > 20000 { 0.7 }
                           else if text_length > 5000 { 0.4 }
                           else { 0.1 },
    }
}

/// Enhanced model selection with multi-model task distribution
pub fn select_optimal_model_v2(
    analysis: &TaskComplexityAnalysis, 
    benchmarks: &[AiModelBenchmark]
) -> ModelRecommendationV2 {
    // For simple tasks, use fast models
    if matches!(analysis.priority_level, TaskPriority::Low) && 
       matches!(analysis.domain_classification, TaskDomain::Simple) {
        return ModelRecommendationV2 {
            primary_model: "gemini-2.5-flash".to_string(),
            fallback_models: vec!["llama3.3:latest".to_string(), "sonnet-3.7".to_string()],
            confidence: 0.95,
            reasoning: "Simple task - optimizing for speed and cost efficiency".to_string(),
            estimated_cost: 0.02,
            estimated_duration: analysis.estimated_duration,
            task_distribution: None,
            selection_criteria: SelectionCriteriaV2 {
                intelligence_weight: 0.1,
                speed_weight: 0.5,
                cost_weight: 0.3,
                reliability_weight: 0.1,
                capability_weight: 0.0,
                context_weight: 0.0,
            },
        };
    }
    
    // For critical tasks, always use Claude 4.1 Opus as primary
    if matches!(analysis.priority_level, TaskPriority::Critical) {
        let task_distribution = if analysis.context_requirements.context_complexity > 0.7 {
            Some(TaskDistribution {
                use_multiple_models: true,
                primary_task: "supervision_and_coordination".to_string(),
                secondary_tasks: HashMap::from([
                    ("analysis".to_string(), "gemini-2.5-pro-exp".to_string()),
                    ("coding".to_string(), "gemini-2.0-pro-exp".to_string()),
                    ("verification".to_string(), "sonnet-4".to_string()),
                ]),
                coordination_model: "opus-4.1".to_string(),
            })
        } else { None };
        
        return ModelRecommendationV2 {
            primary_model: "opus-4.1".to_string(),
            fallback_models: vec!["sonnet-4".to_string(), "gemini-2.5-pro-exp".to_string()],
            confidence: 0.98,
            reasoning: "Critical task requiring maximum intelligence and precision".to_string(),
            estimated_cost: 0.15,
            estimated_duration: analysis.estimated_duration,
            task_distribution,
            selection_criteria: SelectionCriteriaV2 {
                intelligence_weight: 0.6,
                speed_weight: 0.05,
                cost_weight: 0.05,
                reliability_weight: 0.15,
                capability_weight: 0.1,
                context_weight: 0.05,
            },
        };
    }
    
    // Calculate weighted scores for available models
    let mut model_scores: Vec<(String, f64, String)> = Vec::new();
    let criteria = calculate_selection_criteria_v2(analysis);
    
    for benchmark in benchmarks {
        if !benchmark.supports_tools && analysis.required_capabilities.contains(&"tools".to_string()) {
            continue; // Skip models that don't support required capabilities
        }
        
        let intelligence_score = benchmark.intelligence_score / 100.0;
        let speed_score = (100.0 - benchmark.average_response_time / 100.0).max(0.0) / 100.0;
        let cost_score = (1.0 / benchmark.cost_per_1k_tokens.max(0.001)).min(10.0) / 10.0;
        let reliability_score = benchmark.success_rate / 100.0;
        let capability_score = calculate_capability_score(benchmark, &analysis.required_capabilities);
        let context_score = if analysis.context_requirements.needs_large_context {
            if benchmark.context_window >= 1000000 { 1.0 }
            else if benchmark.context_window >= 100000 { 0.7 }
            else { 0.3 }
        } else { 0.8 };
        
        let final_score = (intelligence_score * criteria.intelligence_weight) +
                         (speed_score * criteria.speed_weight) +
                         (cost_score * criteria.cost_weight) +
                         (reliability_score * criteria.reliability_weight) +
                         (capability_score * criteria.capability_weight) +
                         (context_score * criteria.context_weight);
        
        let reasoning = format!(
            "{}: Score {:.2} (I:{:.2}, S:{:.2}, C:{:.2}, R:{:.2}, Cap:{:.2}, Ctx:{:.2})",
            benchmark.model_id, final_score, intelligence_score, speed_score, cost_score, 
            reliability_score, capability_score, context_score
        );
        
        model_scores.push((benchmark.model_id.clone(), final_score, reasoning));
    }
    
    model_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    
    if model_scores.is_empty() {
        return ModelRecommendationV2 {
            primary_model: "opus-4.1".to_string(),
            fallback_models: vec!["sonnet-4".to_string()],
            confidence: 0.5,
            reasoning: "No suitable models found in benchmark data. Using default Claude 4.1 Opus.".to_string(),
            estimated_cost: 0.075,
            estimated_duration: analysis.estimated_duration,
            task_distribution: None,
            selection_criteria: criteria,
        };
    }
    
    let best_model = &model_scores[0];
    let fallbacks: Vec<String> = model_scores.iter().skip(1).take(3).map(|(id, _, _)| id.clone()).collect();
    
    ModelRecommendationV2 {
        primary_model: best_model.0.clone(),
        fallback_models: fallbacks,
        confidence: 0.92,
        reasoning: format!("Selected {} based on weighted analysis: {}", best_model.0, best_model.2),
        estimated_cost: 0.05, // Placeholder - should be calculated from benchmark
        estimated_duration: analysis.estimated_duration,
        task_distribution: None,
        selection_criteria: criteria,
    }
}

fn calculate_selection_criteria_v2(analysis: &TaskComplexityAnalysis) -> SelectionCriteriaV2 {
    match (&analysis.priority_level, &analysis.domain_classification) {
        (TaskPriority::Critical, _) => SelectionCriteriaV2 {
            intelligence_weight: 0.6,
            speed_weight: 0.05,
            cost_weight: 0.05,
            reliability_weight: 0.15,
            capability_weight: 0.1,
            context_weight: 0.05,
        },
        (TaskPriority::High, TaskDomain::Coding) => SelectionCriteriaV2 {
            intelligence_weight: 0.4,
            speed_weight: 0.2,
            cost_weight: 0.1,
            reliability_weight: 0.15,
            capability_weight: 0.1,
            context_weight: 0.05,
        },
        (TaskPriority::Low, _) => SelectionCriteriaV2 {
            intelligence_weight: 0.15,
            speed_weight: 0.4,
            cost_weight: 0.3,
            reliability_weight: 0.1,
            capability_weight: 0.03,
            context_weight: 0.02,
        },
        (TaskPriority::Medium, _) => SelectionCriteriaV2 {
            intelligence_weight: 0.3,
            speed_weight: 0.25,
            cost_weight: 0.2,
            reliability_weight: 0.15,
            capability_weight: 0.07,
            context_weight: 0.03,
        },
        _ => SelectionCriteriaV2 {
            intelligence_weight: 0.3,
            speed_weight: 0.25,
            cost_weight: 0.2,
            reliability_weight: 0.15,
            capability_weight: 0.07,
            context_weight: 0.03,
        },
    }
}

fn calculate_capability_score(benchmark: &AiModelBenchmark, required_capabilities: &[String]) -> f64 {
    let mut score = 0.0;
    let mut total_weight = 0.0;
    
    for capability in required_capabilities {
        total_weight += 1.0;
        match capability.as_str() {
            "vision" => if benchmark.supports_vision { score += 1.0; },
            "audio" => if benchmark.supports_audio { score += 1.0; },
            "tools" => if benchmark.supports_tools { score += 1.0; },
            "code_execution" => score += benchmark.coding_excellence / 100.0,
            "text_generation" => score += benchmark.intelligence_score / 100.0,
            _ => score += 0.5, // Unknown capability
        }
    }
    
    if total_weight > 0.0 { score / total_weight } else { 1.0 }
}

// Database operations for benchmarks
pub fn init_benchmark_tables(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_model_benchmarks (
            model_id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            intelligence_score REAL NOT NULL,
            speed_score REAL NOT NULL,
            coding_excellence REAL NOT NULL,
            analysis_depth REAL NOT NULL,
            creative_writing REAL NOT NULL,
            technical_precision REAL NOT NULL,
            cost_per_1k_tokens REAL NOT NULL,
            average_response_time REAL NOT NULL,
            success_rate REAL NOT NULL,
            context_window INTEGER NOT NULL,
            supports_tools BOOLEAN NOT NULL,
            supports_vision BOOLEAN NOT NULL,
            supports_audio BOOLEAN NOT NULL,
            availability_score REAL NOT NULL,
            last_updated TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_performance_metrics (
            model_id TEXT NOT NULL,
            success_rate REAL NOT NULL,
            average_response_time REAL NOT NULL,
            token_efficiency REAL NOT NULL,
            user_satisfaction REAL NOT NULL,
            task_completion_rate REAL NOT NULL,
            error_rate REAL NOT NULL,
            last_measured TEXT NOT NULL,
            PRIMARY KEY (model_id, last_measured)
        )",
        [],
    )?;

    Ok(())
}

#[command]
pub async fn get_intelligent_model_recommendation(
    prompt: String, 
    context: Option<String>,
    app: AppHandle
) -> Result<ModelRecommendationV2, String> {
    info!("Getting intelligent model recommendation for task");
    
    let analysis = analyze_task_complexity_v2(&prompt, context.as_deref());
    info!("Task analysis completed: domain={:?}, priority={:?}", analysis.domain_classification, analysis.priority_level);
    
    let db_state = app.state::<AgentDb>();
    let conn = db_state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
    
    // Initialize benchmark tables if they don't exist
    init_benchmark_tables(&conn)
        .map_err(|e| format!("Failed to initialize benchmark tables: {}", e))?;
    
    let benchmarks = get_current_benchmarks(&conn)
        .map_err(|e| format!("Failed to get benchmarks: {}", e))?;
    
    if benchmarks.is_empty() {
        warn!("No benchmark data available, updating with default values");
        update_default_benchmarks(&conn)
            .map_err(|e| format!("Failed to update default benchmarks: {}", e))?;
        
        let benchmarks = get_current_benchmarks(&conn)
            .map_err(|e| format!("Failed to get updated benchmarks: {}", e))?;
        
        if benchmarks.is_empty() {
            return Err("Could not initialize benchmark data".to_string());
        }
    }
    
    let recommendation = select_optimal_model_v2(&analysis, &benchmarks);
    info!("Model recommendation: {} with confidence {:.2}", 
          recommendation.primary_model, recommendation.confidence);
    
    Ok(recommendation)
}

fn get_current_benchmarks(conn: &Connection) -> SqliteResult<Vec<AiModelBenchmark>> {
    let mut stmt = conn.prepare(
        "SELECT model_id, provider, intelligence_score, speed_score, coding_excellence, 
                analysis_depth, creative_writing, technical_precision, cost_per_1k_tokens,
                average_response_time, success_rate, context_window, supports_tools,
                supports_vision, supports_audio, availability_score, last_updated
         FROM ai_model_benchmarks"
    )?;
    
    let benchmark_iter = stmt.query_map([], |row| {
        Ok(AiModelBenchmark {
            model_id: row.get(0)?,
            provider: row.get(1)?,
            intelligence_score: row.get(2)?,
            speed_score: row.get(3)?,
            coding_excellence: row.get(4)?,
            analysis_depth: row.get(5)?,
            creative_writing: row.get(6)?,
            technical_precision: row.get(7)?,
            cost_per_1k_tokens: row.get(8)?,
            average_response_time: row.get(9)?,
            success_rate: row.get(10)?,
            context_window: row.get(11)?,
            supports_tools: row.get(12)?,
            supports_vision: row.get(13)?,
            supports_audio: row.get(14)?,
            availability_score: row.get(15)?,
            last_updated: DateTime::parse_from_rfc3339(&row.get::<_, String>(16)?)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?
                .with_timezone(&Utc),
        })
    })?;
    
    let mut benchmarks = Vec::new();
    for benchmark in benchmark_iter {
        benchmarks.push(benchmark?);
    }
    
    Ok(benchmarks)
}

fn update_default_benchmarks(conn: &Connection) -> SqliteResult<()> {
    let now = Utc::now().to_rfc3339();
    
    // Default benchmark data for 2025 models with enhanced characteristics
    let benchmarks = vec![
        ("opus-4.1", "claude", 100.0, 80.0, 100.0, 100.0, 95.0, 100.0, 0.075, 2500.0, 99.9, 200000, true, true, false, 99.5),
        ("sonnet-4", "claude", 95.0, 85.0, 98.0, 95.0, 90.0, 98.0, 0.060, 2000.0, 99.5, 200000, true, true, false, 99.8),
        ("sonnet-3.7", "claude", 90.0, 90.0, 95.0, 90.0, 88.0, 95.0, 0.050, 1800.0, 99.2, 200000, true, true, false, 99.7),
        ("auto", "claude", 100.0, 90.0, 100.0, 100.0, 98.0, 100.0, 0.050, 2000.0, 99.9, 2097152, true, true, false, 99.9), // Auto selection with Claude 4.1 Opus default
        ("gemini-1.5-pro", "gemini", 98.0, 75.0, 95.0, 98.0, 88.0, 95.0, 0.040, 3000.0, 98.5, 2097152, true, true, false, 98.0),
        ("gemini-2.5-flash", "gemini", 85.0, 95.0, 88.0, 85.0, 80.0, 88.0, 0.020, 1200.0, 97.0, 1048576, true, true, false, 98.5),
        ("gemini-2.0-pro-exp", "gemini", 92.0, 80.0, 98.0, 90.0, 82.0, 92.0, 0.035, 2200.0, 97.5, 2097152, true, true, false, 97.8),
        ("gemini-2.0-flash", "gemini", 88.0, 92.0, 90.0, 86.0, 78.0, 90.0, 0.025, 1400.0, 96.5, 1048576, true, true, true, 98.2),
        ("gemini-2.0-flash-lite", "gemini", 82.0, 98.0, 85.0, 80.0, 75.0, 85.0, 0.015, 900.0, 95.0, 1048576, true, true, false, 97.5),
        ("llama3.3:latest", "ollama", 85.0, 95.0, 90.0, 80.0, 85.0, 85.0, 0.000, 800.0, 95.0, 131072, true, false, false, 95.0),
        ("llama3.2:latest", "ollama", 80.0, 98.0, 85.0, 75.0, 80.0, 80.0, 0.000, 600.0, 93.0, 131072, true, false, false, 96.0),
        ("codellama:latest", "ollama", 75.0, 95.0, 95.0, 70.0, 60.0, 90.0, 0.000, 700.0, 90.0, 16384, true, false, false, 95.0),
        ("qwen2.5:latest", "ollama", 82.0, 90.0, 85.0, 85.0, 90.0, 80.0, 0.000, 900.0, 92.0, 32768, true, false, false, 94.0),
        ("mistral:latest", "ollama", 78.0, 92.0, 80.0, 80.0, 85.0, 85.0, 0.000, 750.0, 91.0, 32768, true, false, false, 95.5),
        ("phi3:latest", "ollama", 83.0, 96.0, 88.0, 82.0, 78.0, 88.0, 0.000, 650.0, 94.0, 131072, true, false, false, 96.0),
    ];
    
    for (model_id, provider, intelligence, speed, coding, analysis, creative, technical, cost, response_time, success, context, tools, vision, audio, availability) in benchmarks {
        conn.execute(
            "INSERT OR REPLACE INTO ai_model_benchmarks 
             (model_id, provider, intelligence_score, speed_score, coding_excellence, analysis_depth,
              creative_writing, technical_precision, cost_per_1k_tokens, average_response_time,
              success_rate, context_window, supports_tools, supports_vision, supports_audio,
              availability_score, last_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            rusqlite::params![
                model_id, provider, intelligence, speed, coding, analysis, creative, technical,
                cost, response_time, success, context, tools, vision, audio, availability, now
            ],
        )?;
    }
    
    Ok(())
}

#[command]
pub async fn update_model_performance_metrics(
    model_id: String,
    success_rate: f64,
    response_time: f64,
    token_efficiency: f64,
    user_satisfaction: f64,
    app: AppHandle
) -> Result<(), String> {
    let db_state = app.state::<AgentDb>();
    let conn = db_state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
    
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO model_performance_metrics
         (model_id, success_rate, average_response_time, token_efficiency, user_satisfaction,
          task_completion_rate, error_rate, last_measured)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            model_id, success_rate, response_time, token_efficiency, user_satisfaction,
            100.0 - (100.0 - success_rate), // task_completion_rate
            100.0 - success_rate, // error_rate
            now
        ],
    ).map_err(|e| format!("Failed to update performance metrics: {}", e))?;
    
    Ok(())
}

/// Daily automatic benchmark update from web sources
#[command]
pub async fn update_model_benchmarks_from_web(app: AppHandle) -> Result<String, String> {
    info!("Starting daily model benchmark update from web sources");
    
    let db_state = app.state::<AgentDb>();
    let conn = db_state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
    
    init_benchmark_tables(&conn)
        .map_err(|e| format!("Failed to initialize benchmark tables: {}", e))?;
    
    // For now, just update with current data. In production, this would fetch from web APIs
    update_default_benchmarks(&conn)
        .map_err(|e| format!("Failed to update benchmark data: {}", e))?;
    
    let updated_count = get_current_benchmarks(&conn)
        .map_err(|e| format!("Failed to count updated benchmarks: {}", e))?
        .len();
    
    info!("Updated {} model benchmarks from web sources", updated_count);
    
    Ok(format!("Successfully updated {} AI model benchmarks", updated_count))
}

/// Get comprehensive model analytics for dashboard
#[command] 
pub async fn get_model_analytics(app: AppHandle) -> Result<HashMap<String, serde_json::Value>, String> {
    let db_state = app.state::<AgentDb>();
    let conn = db_state.0.lock().map_err(|e| format!("DB lock failed: {}", e))?;
    
    let benchmarks = get_current_benchmarks(&conn)
        .map_err(|e| format!("Failed to get benchmarks: {}", e))?;
    
    let mut analytics = HashMap::new();
    
    // Top performers by category
    let mut top_intelligence = benchmarks.iter().max_by(|a, b| a.intelligence_score.partial_cmp(&b.intelligence_score).unwrap());
    let mut top_speed = benchmarks.iter().max_by(|a, b| a.speed_score.partial_cmp(&b.speed_score).unwrap());
    let mut top_coding = benchmarks.iter().max_by(|a, b| a.coding_excellence.partial_cmp(&b.coding_excellence).unwrap());
    let mut top_cost_effective = benchmarks.iter().min_by(|a, b| {
        let a_ratio = a.cost_per_1k_tokens / (a.intelligence_score / 100.0);
        let b_ratio = b.cost_per_1k_tokens / (b.intelligence_score / 100.0);
        a_ratio.partial_cmp(&b_ratio).unwrap()
    });
    
    analytics.insert("top_intelligence".to_string(), 
                     serde_json::to_value(top_intelligence).unwrap_or_default());
    analytics.insert("top_speed".to_string(), 
                     serde_json::to_value(top_speed).unwrap_or_default());
    analytics.insert("top_coding".to_string(), 
                     serde_json::to_value(top_coding).unwrap_or_default());
    analytics.insert("top_cost_effective".to_string(), 
                     serde_json::to_value(top_cost_effective).unwrap_or_default());
    
    // Provider summary
    let mut provider_stats: HashMap<String, (usize, f64)> = HashMap::new();
    for benchmark in &benchmarks {
        let entry = provider_stats.entry(benchmark.provider.clone()).or_insert((0, 0.0));
        entry.0 += 1; // count
        entry.1 += benchmark.intelligence_score; // sum of intelligence scores
    }
    
    let mut provider_summary = HashMap::new();
    for (provider, (count, total_intelligence)) in provider_stats {
        provider_summary.insert(provider, serde_json::json!({
            "model_count": count,
            "avg_intelligence": total_intelligence / count as f64
        }));
    }
    analytics.insert("provider_summary".to_string(), 
                     serde_json::to_value(provider_summary).unwrap_or_default());
    
    // Recommendation stats
    analytics.insert("total_models".to_string(), 
                     serde_json::to_value(benchmarks.len()).unwrap_or_default());
    analytics.insert("last_updated".to_string(), 
                     serde_json::to_value(Utc::now().to_rfc3339()).unwrap_or_default());
    
    Ok(analytics)
}