use serde::{Deserialize, Serialize};
use regex::Regex;
use std::collections::HashMap;
use log::{debug, warn};

/// Advanced pattern matching for error detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPattern {
    pub id: String,
    pub name: String,
    pub description: String,
    pub patterns: Vec<PatternMatcher>,
    pub category: String,
    pub severity: String,
    pub resolution_hint: String,
    pub auto_resolvable: bool,
    pub confidence_threshold: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatcher {
    pub pattern_type: PatternType,
    pub value: String,
    pub weight: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternType {
    Regex,
    Contains,
    StartsWith,
    EndsWith,
    ExactMatch,
    ContextKey,
    StackTracePattern,
}

/// Pattern matching engine
pub struct PatternEngine {
    patterns: Vec<ErrorPattern>,
    compiled_regexes: HashMap<String, Regex>,
}

impl PatternEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            patterns: Vec::new(),
            compiled_regexes: HashMap::new(),
        };
        
        engine.load_default_patterns();
        engine
    }
    
    /// Load default error patterns
    fn load_default_patterns(&mut self) {
        self.patterns = vec![
            // Session Management Patterns
            ErrorPattern {
                id: "session_contamination".to_string(),
                name: "Session Contamination".to_string(),
                description: "Multiple sessions mixing data".to_string(),
                patterns: vec![
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "duplicate response".to_string(),
                        weight: 0.8,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "session mixing".to_string(),
                        weight: 0.9,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Regex,
                        value: r"session.*contamina|mix.*session".to_string(),
                        weight: 0.85,
                    },
                ],
                category: "SessionManagement".to_string(),
                severity: "High".to_string(),
                resolution_hint: "Create isolated session with unique ID".to_string(),
                auto_resolvable: true,
                confidence_threshold: 0.7,
            },
            
            // Import Error Patterns
            ErrorPattern {
                id: "tauri_import_error".to_string(),
                name: "Tauri Import Error".to_string(),
                description: "Tauri API import failure".to_string(),
                patterns: vec![
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "@tauri-apps/api".to_string(),
                        weight: 0.95,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Regex,
                        value: r"cannot.*import.*tauri|tauri.*not.*defined".to_string(),
                        weight: 0.9,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::StackTracePattern,
                        value: "invoke".to_string(),
                        weight: 0.7,
                    },
                ],
                category: "ModelIntegration".to_string(),
                severity: "Critical".to_string(),
                resolution_hint: "Reinitialize Tauri API and check module loading".to_string(),
                auto_resolvable: true,
                confidence_threshold: 0.8,
            },
            
            // Model Connection Patterns
            ErrorPattern {
                id: "api_key_invalid".to_string(),
                name: "Invalid API Key".to_string(),
                description: "API key authentication failure".to_string(),
                patterns: vec![
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "401".to_string(),
                        weight: 0.8,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "unauthorized".to_string(),
                        weight: 0.85,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Regex,
                        value: r"api.*key.*invalid|invalid.*api.*key".to_string(),
                        weight: 0.95,
                    },
                ],
                category: "Authentication".to_string(),
                severity: "Critical".to_string(),
                resolution_hint: "Refresh or update API key".to_string(),
                auto_resolvable: true,
                confidence_threshold: 0.75,
            },
            
            ErrorPattern {
                id: "model_timeout".to_string(),
                name: "Model Timeout".to_string(),
                description: "Model connection timeout".to_string(),
                patterns: vec![
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "timeout".to_string(),
                        weight: 0.9,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Regex,
                        value: r"model.*timeout|timeout.*model".to_string(),
                        weight: 0.85,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::ContextKey,
                        value: "model_type".to_string(),
                        weight: 0.7,
                    },
                ],
                category: "Network".to_string(),
                severity: "Medium".to_string(),
                resolution_hint: "Retry with exponential backoff".to_string(),
                auto_resolvable: true,
                confidence_threshold: 0.7,
            },
            
            // UI Duplication Patterns
            ErrorPattern {
                id: "ui_duplicate_render".to_string(),
                name: "UI Duplicate Rendering".to_string(),
                description: "UI elements rendering multiple times".to_string(),
                patterns: vec![
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "duplicate".to_string(),
                        weight: 0.7,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "render".to_string(),
                        weight: 0.6,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Regex,
                        value: r"multiple.*render|duplicate.*component".to_string(),
                        weight: 0.9,
                    },
                ],
                category: "UI".to_string(),
                severity: "Medium".to_string(),
                resolution_hint: "Clear UI cache and reset event listeners".to_string(),
                auto_resolvable: true,
                confidence_threshold: 0.65,
            },
            
            // MCP Server Patterns
            ErrorPattern {
                id: "mcp_server_down".to_string(),
                name: "MCP Server Down".to_string(),
                description: "MCP server not responding".to_string(),
                patterns: vec![
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "mcp".to_string(),
                        weight: 0.8,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Regex,
                        value: r"server.*not.*responding|mcp.*failed".to_string(),
                        weight: 0.9,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "connection refused".to_string(),
                        weight: 0.85,
                    },
                ],
                category: "ModelIntegration".to_string(),
                severity: "High".to_string(),
                resolution_hint: "Restart MCP server and check configuration".to_string(),
                auto_resolvable: true,
                confidence_threshold: 0.75,
            },
            
            // Database Patterns
            ErrorPattern {
                id: "database_locked".to_string(),
                name: "Database Locked".to_string(),
                description: "Database is locked or busy".to_string(),
                patterns: vec![
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "database locked".to_string(),
                        weight: 0.95,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "SQLITE_BUSY".to_string(),
                        weight: 0.95,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Regex,
                        value: r"database.*busy|locked.*database".to_string(),
                        weight: 0.9,
                    },
                ],
                category: "Database".to_string(),
                severity: "High".to_string(),
                resolution_hint: "Wait and retry with backoff".to_string(),
                auto_resolvable: true,
                confidence_threshold: 0.8,
            },
            
            // Performance Patterns
            ErrorPattern {
                id: "memory_leak".to_string(),
                name: "Memory Leak Detected".to_string(),
                description: "Potential memory leak detected".to_string(),
                patterns: vec![
                    PatternMatcher {
                        pattern_type: PatternType::Contains,
                        value: "out of memory".to_string(),
                        weight: 0.9,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::Regex,
                        value: r"memory.*leak|excessive.*memory".to_string(),
                        weight: 0.85,
                    },
                    PatternMatcher {
                        pattern_type: PatternType::ContextKey,
                        value: "memory_usage".to_string(),
                        weight: 0.8,
                    },
                ],
                category: "Performance".to_string(),
                severity: "Critical".to_string(),
                resolution_hint: "Clear caches and restart affected components".to_string(),
                auto_resolvable: true,
                confidence_threshold: 0.75,
            },
        ];
        
        // Compile regex patterns
        for pattern in &self.patterns {
            for matcher in &pattern.patterns {
                if let PatternType::Regex = matcher.pattern_type {
                    if let Ok(regex) = Regex::new(&matcher.value) {
                        self.compiled_regexes.insert(
                            format!("{}_{}", pattern.id, matcher.value),
                            regex
                        );
                    }
                }
            }
        }
    }
    
    /// Match error against all patterns
    pub fn match_error(
        &self,
        error_message: &str,
        context: &HashMap<String, String>,
        stack_trace: Option<&str>,
    ) -> Vec<PatternMatch> {
        let mut matches = Vec::new();
        let error_lower = error_message.to_lowercase();
        
        for pattern in &self.patterns {
            let mut total_score = 0.0;
            let mut matched_patterns = 0;
            let mut match_details = Vec::new();
            
            for matcher in &pattern.patterns {
                let matched = match &matcher.pattern_type {
                    PatternType::Regex => {
                        let key = format!("{}_{}", pattern.id, matcher.value);
                        if let Some(regex) = self.compiled_regexes.get(&key) {
                            regex.is_match(&error_lower)
                        } else {
                            false
                        }
                    }
                    PatternType::Contains => {
                        error_lower.contains(&matcher.value.to_lowercase())
                    }
                    PatternType::StartsWith => {
                        error_lower.starts_with(&matcher.value.to_lowercase())
                    }
                    PatternType::EndsWith => {
                        error_lower.ends_with(&matcher.value.to_lowercase())
                    }
                    PatternType::ExactMatch => {
                        error_lower == matcher.value.to_lowercase()
                    }
                    PatternType::ContextKey => {
                        context.contains_key(&matcher.value)
                    }
                    PatternType::StackTracePattern => {
                        if let Some(trace) = stack_trace {
                            trace.to_lowercase().contains(&matcher.value.to_lowercase())
                        } else {
                            false
                        }
                    }
                };
                
                if matched {
                    total_score += matcher.weight;
                    matched_patterns += 1;
                    match_details.push(format!("{:?}: {}", matcher.pattern_type, matcher.value));
                }
            }
            
            // Calculate confidence
            let confidence = if pattern.patterns.is_empty() {
                0.0
            } else {
                total_score / pattern.patterns.len() as f32
            };
            
            // Only include if confidence meets threshold
            if confidence >= pattern.confidence_threshold {
                matches.push(PatternMatch {
                    pattern_id: pattern.id.clone(),
                    pattern_name: pattern.name.clone(),
                    confidence,
                    matched_patterns,
                    category: pattern.category.clone(),
                    severity: pattern.severity.clone(),
                    resolution_hint: pattern.resolution_hint.clone(),
                    auto_resolvable: pattern.auto_resolvable,
                    match_details,
                });
            }
        }
        
        // Sort by confidence (highest first)
        matches.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        
        matches
    }
    
    /// Add a new pattern
    pub fn add_pattern(&mut self, pattern: ErrorPattern) {
        // Compile regex patterns for the new pattern
        for matcher in &pattern.patterns {
            if let PatternType::Regex = matcher.pattern_type {
                if let Ok(regex) = Regex::new(&matcher.value) {
                    self.compiled_regexes.insert(
                        format!("{}_{}", pattern.id, matcher.value),
                        regex
                    );
                }
            }
        }
        
        self.patterns.push(pattern);
    }
    
    /// Update pattern success metrics
    pub fn update_pattern_metrics(&mut self, pattern_id: &str, success: bool) {
        if let Some(pattern) = self.patterns.iter_mut().find(|p| p.id == pattern_id) {
            debug!("Updated metrics for pattern {}: success={}", pattern_id, success);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatch {
    pub pattern_id: String,
    pub pattern_name: String,
    pub confidence: f32,
    pub matched_patterns: usize,
    pub category: String,
    pub severity: String,
    pub resolution_hint: String,
    pub auto_resolvable: bool,
    pub match_details: Vec<String>,
}

/// Machine learning-based pattern recognition (future enhancement)
pub struct MLPatternRecognizer {
    // This would integrate with a machine learning model
    // for more sophisticated pattern recognition
}

impl MLPatternRecognizer {
    pub fn new() -> Self {
        Self {}
    }
    
    /// Analyze error patterns using ML
    pub fn analyze(&self, error_message: &str, context: &HashMap<String, String>) -> f32 {
        // Placeholder for ML-based analysis
        // Would return confidence score
        0.5
    }
    
    /// Train the model with new error patterns
    pub fn train(&mut self, error_data: Vec<(String, HashMap<String, String>, bool)>) {
        // Placeholder for training logic
        debug!("Training ML model with {} samples", error_data.len());
    }
}