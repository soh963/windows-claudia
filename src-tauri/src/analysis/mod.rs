use anyhow::Result;
use log::{info, warn};
use std::path::Path;
use tokio::fs;
use walkdir::WalkDir;
use regex::Regex;
use chrono::Utc;

use crate::commands::dashboard::{
    ProjectHealthMetric, FeatureItem, RiskItem, DocumentationStatus
};

/// Main project analyzer
pub struct ProjectAnalyzer {
    project_path: String,
    project_id: String,
}

impl ProjectAnalyzer {
    pub fn new(project_path: String, project_id: String) -> Self {
        Self { project_path, project_id }
    }

    /// Analyze overall project health
    pub async fn analyze_health(&self) -> Result<Vec<ProjectHealthMetric>> {
        info!("Analyzing project health for: {}", self.project_path);
        
        let mut metrics = Vec::new();
        let timestamp = Utc::now().timestamp();
        
        // Analyze security
        let security_score = self.analyze_security().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "security".to_string(),
            value: security_score,
            timestamp,
            details: Some("Security analysis including vulnerability scanning".to_string()),
            trend: Some("stable".to_string()),
        });
        
        // Analyze dependencies
        let dependencies_score = self.analyze_dependencies().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "dependencies".to_string(),
            value: dependencies_score,
            timestamp,
            details: Some("Dependency health and update status".to_string()),
            trend: Some("improving".to_string()),
        });
        
        // Analyze complexity
        let complexity_score = self.analyze_complexity().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "complexity".to_string(),
            value: complexity_score,
            timestamp,
            details: Some("Code complexity metrics".to_string()),
            trend: Some("stable".to_string()),
        });
        
        // Analyze scalability
        let scalability_score = self.analyze_scalability().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "scalability".to_string(),
            value: scalability_score,
            timestamp,
            details: Some("Performance and scalability assessment".to_string()),
            trend: Some("improving".to_string()),
        });
        
        // Analyze error rate
        let error_rate_score = self.analyze_error_rate().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "error_rate".to_string(),
            value: error_rate_score,
            timestamp,
            details: Some("Runtime error frequency analysis".to_string()),
            trend: Some("improving".to_string()),
        });
        
        Ok(metrics)
    }

    /// Analyze security aspects
    async fn analyze_security(&self) -> Result<f64> {
        let mut issues = 0;
        let mut total_checks = 0;
        
        // Check for hardcoded secrets
        let secret_patterns = vec![
            r#"(?i)(api[_\-]?key|apikey|secret|password|pwd|token|auth)[\s]*[:=][\s]*["']([^"']+)["']"#,
            r#"(?i)(api[_\-]?key|apikey|secret|password|pwd|token|auth)[\s]*[:=][\s]*([^\s]+)"#,
        ];
        
        for entry in WalkDir::new(&self.project_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                let path = e.path();
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                matches!(ext, "rs" | "ts" | "tsx" | "js" | "jsx" | "env")
            })
        {
            total_checks += 1;
            let content = match fs::read_to_string(entry.path()).await {
                Ok(c) => c,
                Err(_) => continue,
            };
            
            for pattern in &secret_patterns {
                let re = Regex::new(pattern)?;
                if re.is_match(&content) {
                    issues += 1;
                    warn!("Potential hardcoded secret found in: {:?}", entry.path());
                }
            }
        }
        
        // Check for vulnerable patterns
        let vulnerable_patterns = vec![
            r#"eval\s*\("#,
            r#"dangerouslySetInnerHTML"#,
            r#"innerHTML\s*="#,
            r#"document\.write"#,
        ];
        
        for pattern in &vulnerable_patterns {
            let re = Regex::new(pattern)?;
            for entry in WalkDir::new(&self.project_path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
            {
                let content = match fs::read_to_string(entry.path()).await {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                
                if re.is_match(&content) {
                    issues += 1;
                }
            }
        }
        
        // Calculate score (100 - penalty per issue)
        let score = f64::max(0.0, 100.0 - (issues as f64 * 10.0));
        Ok(score)
    }

    /// Analyze dependencies
    async fn analyze_dependencies(&self) -> Result<f64> {
        let mut score = 100.0;
        
        // Check package.json
        let package_json_path = Path::new(&self.project_path).join("package.json");
        if let Ok(content) = fs::read_to_string(package_json_path).await {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let deps = json["dependencies"].as_object();
                let dev_deps = json["devDependencies"].as_object();
                
                let total_deps = deps.map(|d| d.len()).unwrap_or(0) 
                    + dev_deps.map(|d| d.len()).unwrap_or(0);
                
                // Penalize for too many dependencies
                if total_deps > 50 {
                    score -= 10.0;
                }
                
                // Check for outdated patterns
                let mut outdated = 0;
                if let Some(deps) = deps {
                    for (_, version) in deps {
                        if let Some(v) = version.as_str() {
                            if v.starts_with("^0.") || v.starts_with("~0.") {
                                outdated += 1;
                            }
                        }
                    }
                }
                
                score -= outdated as f64 * 2.0;
            }
        }
        
        // Check Cargo.toml
        let cargo_toml_path = Path::new(&self.project_path).join("src-tauri").join("Cargo.toml");
        if let Ok(content) = fs::read_to_string(cargo_toml_path).await {
            // Simple check for dependency count
            let dep_count = content.matches("[dependencies]").count();
            if dep_count > 30 {
                score -= 5.0;
            }
        }
        
        Ok(f64::max(0.0, score))
    }

    /// Analyze code complexity
    async fn analyze_complexity(&self) -> Result<f64> {
        let mut total_complexity = 0;
        let mut file_count = 0;
        
        for entry in WalkDir::new(&self.project_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                let path = e.path();
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                matches!(ext, "rs" | "ts" | "tsx" | "js" | "jsx")
            })
        {
            file_count += 1;
            let content = match fs::read_to_string(entry.path()).await {
                Ok(c) => c,
                Err(_) => continue,
            };
            
            // Simple complexity metrics
            let lines = content.lines().count();
            let functions = content.matches("function ").count() 
                + content.matches("fn ").count()
                + content.matches("const ").count() / 2; // Rough estimate
            
            // Check for deep nesting
            let mut max_depth = 0usize;
            let mut current_depth = 0usize;
            for char in content.chars() {
                match char {
                    '{' => {
                        current_depth += 1;
                        max_depth = max_depth.max(current_depth);
                    }
                    '}' => current_depth = current_depth.saturating_sub(1),
                    _ => {}
                }
            }
            
            // Penalize for high complexity
            if lines > 500 {
                total_complexity += 10;
            }
            if functions > 20 {
                total_complexity += 5;
            }
            if max_depth > 5 {
                total_complexity += 5;
            }
        }
        
        // Calculate score
        let avg_complexity = if file_count > 0 {
            total_complexity / file_count
        } else {
            0
        };
        
        let score = f64::max(0.0, 100.0 - (avg_complexity as f64 * 5.0));
        Ok(score)
    }

    /// Analyze scalability
    async fn analyze_scalability(&self) -> Result<f64> {
        let mut score = 100.0;
        
        // Check for proper async patterns
        let mut async_usage = 0;
        let mut blocking_operations = 0;
        
        for entry in WalkDir::new(&self.project_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                let path = e.path();
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                matches!(ext, "rs" | "ts" | "tsx" | "js" | "jsx")
            })
        {
            let content = match fs::read_to_string(entry.path()).await {
                Ok(c) => c,
                Err(_) => continue,
            };
            
            // Check for async patterns
            async_usage += content.matches("async").count();
            async_usage += content.matches("await").count();
            
            // Check for blocking operations
            if content.contains("readFileSync") || content.contains("execSync") {
                blocking_operations += 1;
            }
        }
        
        // Penalize blocking operations
        score -= blocking_operations as f64 * 5.0;
        
        // Reward async usage
        if async_usage > 10 {
            score = f64::min(100.0, score + 5.0);
        }
        
        Ok(f64::max(0.0, score))
    }

    /// Analyze error rate
    async fn analyze_error_rate(&self) -> Result<f64> {
        let mut score = 100.0;
        let mut error_handling = 0;
        let mut total_functions = 0;
        
        for entry in WalkDir::new(&self.project_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                let path = e.path();
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                matches!(ext, "rs" | "ts" | "tsx" | "js" | "jsx")
            })
        {
            let content = match fs::read_to_string(entry.path()).await {
                Ok(c) => c,
                Err(_) => continue,
            };
            
            // Count error handling
            error_handling += content.matches("try {").count();
            error_handling += content.matches(".catch(").count();
            error_handling += content.matches("Result<").count();
            error_handling += content.matches("Option<").count();
            
            // Count functions
            total_functions += content.matches("function ").count();
            total_functions += content.matches("fn ").count();
            total_functions += content.matches("=>").count();
        }
        
        // Calculate error handling ratio
        if total_functions > 0 {
            let ratio = error_handling as f64 / total_functions as f64;
            if ratio < 0.3 {
                score -= 20.0;
            } else if ratio < 0.5 {
                score -= 10.0;
            }
        }
        
        Ok(f64::max(0.0, score))
    }

    /// Scan and identify features
    pub async fn scan_features(&self) -> Result<Vec<FeatureItem>> {
        info!("Scanning features in: {}", self.project_path);
        let mut features = Vec::new();
        let timestamp = Utc::now().timestamp();
        
        // Scan React components
        let components_dir = Path::new(&self.project_path).join("src").join("components");
        if components_dir.exists() {
            for entry in WalkDir::new(&components_dir)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter(|e| {
                    let path = e.path();
                    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                    matches!(ext, "tsx" | "jsx")
                })
            {
                let file_name = entry.file_name().to_string_lossy();
                let component_name = file_name.trim_end_matches(".tsx").trim_end_matches(".jsx");
                
                // Read file to determine status
                let content = fs::read_to_string(entry.path()).await.unwrap_or_default();
                let status = if content.contains("TODO") || content.contains("FIXME") {
                    "in_progress"
                } else if content.len() < 100 {
                    "planned"
                } else {
                    "completed"
                };
                
                features.push(FeatureItem {
                    id: None,
                    project_id: self.project_id.clone(),
                    name: format!("Component: {}", component_name),
                    description: Some(format!("React component {}", component_name)),
                    status: status.to_string(),
                    independence_score: Some(self.calculate_independence_score(&content).await),
                    dependencies: Some("[]".to_string()),
                    file_paths: Some(format!(r#"["{}"]"#, entry.path().display())),
                    complexity_score: Some(self.calculate_complexity_score(&content)),
                    created_at: timestamp,
                    updated_at: timestamp,
                });
            }
        }
        
        // Scan Rust modules
        let rust_src = Path::new(&self.project_path).join("src-tauri").join("src");
        if rust_src.exists() {
            for entry in WalkDir::new(&rust_src)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter(|e| e.path().extension().map_or(false, |ext| ext == "rs"))
            {
                let content = fs::read_to_string(entry.path()).await.unwrap_or_default();
                
                // Look for Tauri commands
                if content.contains("#[tauri::command]") {
                    let command_regex = Regex::new(r#"#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)"#)?;
                    for cap in command_regex.captures_iter(&content) {
                        if let Some(cmd_name) = cap.get(1) {
                            features.push(FeatureItem {
                                id: None,
                                project_id: self.project_id.clone(),
                                name: format!("API: {}", cmd_name.as_str()),
                                description: Some(format!("Tauri command endpoint")),
                                status: "available".to_string(),
                                independence_score: Some(85.0),
                                dependencies: Some("[]".to_string()),
                                file_paths: Some(format!(r#"["{}"]"#, entry.path().display())),
                                complexity_score: Some(self.calculate_complexity_score(&content)),
                                created_at: timestamp,
                                updated_at: timestamp,
                            });
                        }
                    }
                }
            }
        }
        
        Ok(features)
    }

    /// Calculate feature independence score
    async fn calculate_independence_score(&self, content: &str) -> f64 {
        let mut score = 100.0;
        
        // Count imports/dependencies
        let import_count = content.matches("import ").count() + content.matches("use ").count();
        
        // Penalize for many dependencies
        if import_count > 10 {
            score -= 20.0;
        } else if import_count > 5 {
            score -= 10.0;
        }
        
        // Check for external dependencies
        if content.contains("axios") || content.contains("lodash") {
            score -= 5.0;
        }
        
        f64::max(0.0, score)
    }

    /// Calculate complexity score
    fn calculate_complexity_score(&self, content: &str) -> f64 {
        let lines = content.lines().count();
        let functions = content.matches("function").count() + content.matches("fn ").count();
        
        let complexity = (lines as f64 / 100.0) + (functions as f64 * 2.0);
        f64::min(100.0, complexity * 10.0)
    }

    /// Detect project risks
    pub async fn detect_risks(&self) -> Result<Vec<RiskItem>> {
        info!("Detecting risks in: {}", self.project_path);
        let mut risks = Vec::new();
        let timestamp = Utc::now().timestamp();
        
        // Security risks
        for entry in WalkDir::new(&self.project_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let content = match fs::read_to_string(entry.path()).await {
                Ok(c) => c,
                Err(_) => continue,
            };
            
            // Check for hardcoded secrets
            if content.contains("password =") || content.contains("api_key =") {
                risks.push(RiskItem {
                    id: None,
                    project_id: self.project_id.clone(),
                    category: "security".to_string(),
                    severity: "high".to_string(),
                    title: "Hardcoded credentials detected".to_string(),
                    description: format!("Found potential hardcoded credentials in {:?}", entry.path()),
                    mitigation: Some("Move credentials to environment variables".to_string()),
                    status: "open".to_string(),
                    impact_score: Some(8.0),
                    probability: Some(0.9),
                    detected_at: timestamp,
                    resolved_at: None,
                    file_paths: Some(format!(r#"["{}"]"#, entry.path().display())),
                });
            }
            
            // Check for SQL injection risks
            if content.contains("query(") && content.contains("${") {
                risks.push(RiskItem {
                    id: None,
                    project_id: self.project_id.clone(),
                    category: "security".to_string(),
                    severity: "critical".to_string(),
                    title: "Potential SQL injection vulnerability".to_string(),
                    description: format!("Unsafe query construction in {:?}", entry.path()),
                    mitigation: Some("Use parameterized queries".to_string()),
                    status: "open".to_string(),
                    impact_score: Some(9.0),
                    probability: Some(0.7),
                    detected_at: timestamp,
                    resolved_at: None,
                    file_paths: Some(format!(r#"["{}"]"#, entry.path().display())),
                });
            }
        }
        
        // Performance risks
        let large_files = WalkDir::new(&self.project_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| e.metadata().map(|m| m.len() > 500_000).unwrap_or(false))
            .count();
            
        if large_files > 0 {
            risks.push(RiskItem {
                id: None,
                project_id: self.project_id.clone(),
                category: "performance".to_string(),
                severity: "medium".to_string(),
                title: format!("{} large files detected", large_files),
                description: "Large files can impact build and runtime performance".to_string(),
                mitigation: Some("Consider splitting large files or lazy loading".to_string()),
                status: "open".to_string(),
                impact_score: Some(5.0),
                probability: Some(0.8),
                detected_at: timestamp,
                resolved_at: None,
                file_paths: None,
            });
        }
        
        Ok(risks)
    }

    /// Analyze documentation status
    pub async fn analyze_documentation(&self) -> Result<Vec<DocumentationStatus>> {
        info!("Analyzing documentation in: {}", self.project_path);
        let mut docs = Vec::new();
        let timestamp = Utc::now().timestamp();
        
        // Check for various documentation types
        let doc_checks = vec![
            ("prd", vec!["PRD.md", "requirements.md", "product-requirements.md"]),
            ("tech_stack", vec!["TECH_STACK.md", "ARCHITECTURE.md", "package.json", "Cargo.toml"]),
            ("usage_guides", vec!["README.md", "USAGE.md", "GUIDE.md"]),
            ("workflows", vec!["CONTRIBUTING.md", "DEVELOPMENT.md", "WORKFLOW.md"]),
            ("reports", vec!["CHANGELOG.md", "RELEASE.md"]),
        ];
        
        for (doc_type, files) in doc_checks {
            let mut found_files = Vec::new();
            let mut total_sections = 0;
            let mut completed_sections = 0;
            
            for file in &files {
                let file_path = Path::new(&self.project_path).join(file);
                if file_path.exists() {
                    found_files.push(file_path.display().to_string());
                    
                    if let Ok(content) = fs::read_to_string(&file_path).await {
                        // Count sections (headers)
                        total_sections += content.matches("##").count();
                        // Assume sections with content > 50 chars after header are complete
                        let lines: Vec<&str> = content.lines().collect();
                        for (i, line) in lines.iter().enumerate() {
                            if line.starts_with("##") {
                                if i + 1 < lines.len() && lines[i + 1].len() > 50 {
                                    completed_sections += 1;
                                }
                            }
                        }
                    }
                }
            }
            
            let completion = if total_sections > 0 {
                (completed_sections as f64 / total_sections as f64) * 100.0
            } else if !found_files.is_empty() {
                75.0 // If files exist but no sections, assume 75%
            } else {
                0.0
            };
            
            docs.push(DocumentationStatus {
                id: None,
                project_id: self.project_id.clone(),
                doc_type: doc_type.to_string(),
                completion_percentage: Some(completion),
                total_sections: Some(total_sections as i64),
                completed_sections: Some(completed_sections as i64),
                missing_sections: if found_files.is_empty() {
                    Some(format!(r#"["All files missing"]"#))
                } else {
                    Some("[]".to_string())
                },
                file_paths: Some(serde_json::to_string(&found_files).unwrap_or("[]".to_string())),
                last_updated: timestamp,
                quality_score: Some(if completion > 80.0 { 85.0 } else { completion }),
            });
        }
        
        Ok(docs)
    }
}