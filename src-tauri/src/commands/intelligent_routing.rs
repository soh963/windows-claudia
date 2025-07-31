use anyhow::Result;
use log::{debug, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use regex::Regex;

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