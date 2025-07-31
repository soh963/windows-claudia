use std::path::{Path, PathBuf};
use tokio::fs;
use serde_json::Value;
use regex::Regex;
use anyhow::{Result, Context};
use log::{info, warn, error};
use std::collections::{HashMap, HashSet};
use chrono::{DateTime, Utc};

use crate::commands::dashboard::{
    ProjectHealthMetric, FeatureItem, RiskItem, DocumentationStatus, 
    AIUsageMetric, WorkflowStage, ProjectGoals
};

pub mod advanced_analyzer;

pub struct ProjectAnalyzer {
    project_path: PathBuf,
    project_id: String,
}

impl ProjectAnalyzer {
    pub fn new(project_path: String, project_id: String) -> Self {
        Self { 
            project_path: PathBuf::from(project_path),
            project_id,
        }
    }

    /// 프로젝트 전체 건강 지표 계산
    pub async fn analyze_health(&self) -> Result<Vec<ProjectHealthMetric>> {
        info!("Starting comprehensive project health analysis for {}", self.project_id);
        
        let mut metrics = Vec::new();
        let timestamp = chrono::Utc::now().timestamp();

        // 1. 보안 분석
        let security_score = self.analyze_security().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "security".to_string(),
            value: security_score,
            timestamp,
            details: Some(self.get_security_details(security_score).await),
            trend: Some(self.calculate_trend("security").await?),
        });

        // 2. 의존성 분석
        let dependencies_score = self.analyze_dependencies().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "dependencies".to_string(),
            value: dependencies_score,
            timestamp,
            details: Some(self.get_dependencies_details(dependencies_score).await),
            trend: Some(self.calculate_trend("dependencies").await?),
        });

        // 3. 복잡도 분석
        let complexity_score = self.analyze_complexity().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "complexity".to_string(),
            value: complexity_score,
            timestamp,
            details: Some(self.get_complexity_details(complexity_score).await),
            trend: Some(self.calculate_trend("complexity").await?),
        });

        // 4. 확장성 분석
        let scalability_score = self.analyze_scalability().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "scalability".to_string(),
            value: scalability_score,
            timestamp,
            details: Some(self.get_scalability_details(scalability_score).await),
            trend: Some(self.calculate_trend("scalability").await?),
        });

        // 5. 에러율 분석
        let error_rate = self.analyze_error_rate().await?;
        metrics.push(ProjectHealthMetric {
            id: None,
            project_id: self.project_id.clone(),
            metric_type: "error_rate".to_string(),
            value: error_rate,
            timestamp,
            details: Some(self.get_error_rate_details(error_rate).await),
            trend: Some(self.calculate_trend("error_rate").await?),
        });

        info!("Health analysis completed with {} metrics", metrics.len());
        Ok(metrics)
    }

    /// 보안 점수 계산 (0-100)
    async fn analyze_security(&self) -> Result<f64> {
        let mut security_score = 100.0;
        let mut issues = Vec::new();

        // 1. 하드코딩된 시크릿 검사
        let hardcoded_secrets = self.scan_hardcoded_secrets().await?;
        if !hardcoded_secrets.is_empty() {
            let secrets_count = hardcoded_secrets.len();
            security_score -= secrets_count as f64 * 15.0;
            issues.extend(hardcoded_secrets);
            info!("Found {} hardcoded secrets", secrets_count);
        }

        // 2. 취약한 패키지 의존성 검사
        let vulnerable_deps = self.scan_vulnerable_dependencies().await?;
        if !vulnerable_deps.is_empty() {
            security_score -= vulnerable_deps.len() as f64 * 10.0;
            info!("Found {} vulnerable dependencies", vulnerable_deps.len());
        }

        // 3. 안전하지 않은 코드 패턴 검사
        let unsafe_patterns = self.scan_unsafe_patterns().await?;
        if !unsafe_patterns.is_empty() {
            security_score -= unsafe_patterns.len() as f64 * 8.0;
            info!("Found {} unsafe code patterns", unsafe_patterns.len());
        }

        // 4. 권한 설정 검사
        let permission_issues = self.check_file_permissions().await?;
        if !permission_issues.is_empty() {
            security_score -= permission_issues.len() as f64 * 5.0;
            info!("Found {} permission issues", permission_issues.len());
        }

        // 5. 환경 변수 및 설정 파일 보안 검사
        let config_issues = self.check_config_security().await?;
        if !config_issues.is_empty() {
            security_score -= config_issues.len() as f64 * 6.0;
            info!("Found {} configuration security issues", config_issues.len());
        }

        let final_score = security_score.max(0.0).min(100.0);
        info!("Security analysis completed with score: {:.1}", final_score);
        Ok(final_score)
    }

    /// 의존성 건강도 분석 (0-100)
    async fn analyze_dependencies(&self) -> Result<f64> {
        let mut deps_score = 100.0;

        // 1. package.json 분석
        if let Ok(package_json) = self.read_package_json().await {
            let outdated_count = self.count_outdated_npm_packages(&package_json).await?;
            deps_score -= outdated_count as f64 * 3.0;

            let vulnerable_count = self.count_vulnerable_npm_packages(&package_json).await?;
            deps_score -= vulnerable_count as f64 * 8.0;
        }

        // 2. Cargo.toml 분석
        if let Ok(cargo_toml) = self.read_cargo_toml().await {
            let outdated_count = self.count_outdated_rust_crates(&cargo_toml).await?;
            deps_score -= outdated_count as f64 * 3.0;
        }

        // 3. dep 파일 크기 및 중복 검사
        let duplicate_deps = self.find_duplicate_dependencies().await?;
        deps_score -= duplicate_deps.len() as f64 * 2.0;

        Ok(deps_score.max(0.0).min(100.0))
    }

    /// 코드 복잡도 분석 (0-100, 낮을수록 좋음)
    async fn analyze_complexity(&self) -> Result<f64> {
        let mut complexity_penalties = 0.0;

        // 1. 파일 크기 분석
        let large_files = self.find_large_files(1000).await?; // 1000+ lines
        complexity_penalties += large_files.len() as f64 * 2.0;

        // 2. 함수 복잡도 분석
        let complex_functions = self.find_complex_functions().await?;
        complexity_penalties += complex_functions.len() as f64 * 3.0;

        // 3. 깊은 중첩 구조 검사
        let deep_nesting = self.find_deep_nesting(5).await?; // 5+ levels
        complexity_penalties += deep_nesting.len() as f64 * 4.0;

        // 4. 중복 코드 검사
        let duplicate_code = self.find_duplicate_code_blocks().await?;
        complexity_penalties += duplicate_code.len() as f64 * 3.0;

        let complexity_score = 100.0 - complexity_penalties;
        Ok(complexity_score.max(0.0).min(100.0))
    }

    /// 확장성 분석 (0-100)
    async fn analyze_scalability(&self) -> Result<f64> {
        let mut scalability_score = 100.0;

        // 1. 아키텍처 패턴 분석
        let has_modular_structure = self.check_modular_architecture().await?;
        if !has_modular_structure {
            scalability_score -= 20.0;
        }

        // 2. 데이터베이스 스키마 분석
        let db_issues = self.analyze_database_scalability().await?;
        scalability_score -= db_issues.len() as f64 * 5.0;

        // 3. API 설계 분석
        let api_issues = self.analyze_api_scalability().await?;
        scalability_score -= api_issues.len() as f64 * 4.0;

        // 4. 성능 병목점 검사
        let bottlenecks = self.find_performance_bottlenecks().await?;
        scalability_score -= bottlenecks.len() as f64 * 8.0;

        Ok(scalability_score.max(0.0).min(100.0))
    }

    /// 에러율 분석 (0-100, 낮을수록 좋음)
    async fn analyze_error_rate(&self) -> Result<f64> {
        let mut error_issues = 0.0;

        // 1. 에러 핸들링 누락 검사
        let missing_error_handling = self.find_missing_error_handling().await?;
        error_issues += missing_error_handling.len() as f64;

        // 2. 런타임 에러 패턴 검사
        let runtime_error_patterns = self.find_runtime_error_patterns().await?;
        error_issues += runtime_error_patterns.len() as f64 * 2.0;

        // 3. 테스트 커버리지 분석
        let test_coverage = self.calculate_test_coverage().await?;
        if test_coverage < 80.0 {
            error_issues += (80.0 - test_coverage) / 10.0;
        }

        let error_rate = error_issues.min(100.0);
        Ok(100.0 - error_rate) // 높을수록 좋게 변환
    }

    /// 프로젝트 기능 스캔
    pub async fn scan_features(&self) -> Result<Vec<FeatureItem>> {
        info!("Scanning project features for {}", self.project_id);
        
        let mut features = Vec::new();
        
        // 고급 분석기 사용
        let advanced_analyzer = advanced_analyzer::AdvancedProjectAnalyzer::new(
            self.project_path.to_string_lossy().to_string(),
            self.project_id.clone()
        );

        // 1. React 컴포넌트 실제 스캔
        match advanced_analyzer.scan_react_components().await {
            Ok(react_features) => {
                features.extend(react_features);
                info!("Found {} React components", features.len());
            }
            Err(e) => {
                warn!("Failed to scan React components: {}", e);
            }
        }

        // 2. Rust 모듈 실제 스캔
        match advanced_analyzer.scan_rust_modules().await {
            Ok(rust_features) => {
                let rust_count = rust_features.len();
                features.extend(rust_features);
                info!("Found {} Rust modules", rust_count);
            }
            Err(e) => {
                warn!("Failed to scan Rust modules: {}", e);
            }
        }

        // 3. API 엔드포인트 스캔 (기본 구현)
        let api_endpoints = self.scan_api_endpoints().await?;
        features.extend(api_endpoints);

        info!("Total features found: {}", features.len());
        Ok(features)
    }

    /// 위험 요소 감지
    pub async fn detect_risks(&self) -> Result<Vec<RiskItem>> {
        info!("Detecting project risks for {}", self.project_id);
        
        let mut risks = Vec::new();

        // 고급 분석기 사용하여 실제 위험 감지
        let advanced_analyzer = advanced_analyzer::AdvancedProjectAnalyzer::new(
            self.project_path.to_string_lossy().to_string(),
            self.project_id.clone()
        );

        match advanced_analyzer.detect_comprehensive_risks().await {
            Ok(comprehensive_risks) => {
                risks.extend(comprehensive_risks);
                info!("Detected {} comprehensive risks", risks.len());
            }
            Err(e) => {
                warn!("Failed to detect comprehensive risks: {}", e);
                
                // 폴백: 기본 위험 감지
                let basic_risks = self.detect_basic_risks().await?;
                risks.extend(basic_risks);
            }
        }

        info!("Total risks detected: {}", risks.len());
        Ok(risks)
    }

    /// 기본 위험 감지 (폴백용)
    async fn detect_basic_risks(&self) -> Result<Vec<RiskItem>> {
        let mut risks = Vec::new();
        let timestamp = chrono::Utc::now().timestamp();

        // 1. 보안 위험
        let security_risks = self.detect_security_risks().await?;
        risks.extend(security_risks);

        // 2. 성능 위험
        let performance_risks = self.detect_performance_risks().await?;
        risks.extend(performance_risks);

        // 3. 의존성 위험
        let dependency_risks = self.detect_dependency_risks().await?;
        risks.extend(dependency_risks);

        // 4. 기술적 부채
        let technical_debt = self.detect_technical_debt().await?;
        risks.extend(technical_debt);

        Ok(risks)
    }

    /// 문서화 상태 분석
    pub async fn analyze_documentation(&self) -> Result<Vec<DocumentationStatus>> {
        info!("Analyzing documentation status for {}", self.project_id);
        
        let mut docs = Vec::new();
        let timestamp = chrono::Utc::now().timestamp();

        // 문서 타입별 분석
        let doc_types = ["prd", "tasks", "tech_stack", "workflows", "usage_guides", "reports"];
        
        for doc_type in &doc_types {
            let doc_status = self.analyze_doc_type(doc_type).await?;
            docs.push(DocumentationStatus {
                id: None,
                project_id: self.project_id.clone(),
                doc_type: doc_type.to_string(),
                completion_percentage: doc_status.completion_percentage,
                total_sections: doc_status.total_sections,
                completed_sections: doc_status.completed_sections,
                missing_sections: doc_status.missing_sections,
                file_paths: doc_status.file_paths,
                last_updated: timestamp,
                quality_score: doc_status.quality_score,
            });
        }

        info!("Analyzed {} documentation types", docs.len());
        Ok(docs)
    }

    // Helper methods for security analysis
    async fn scan_hardcoded_secrets(&self) -> Result<Vec<String>> {
        let mut secrets = Vec::new();
        let secret_patterns = [
            r#"(?i)api[_-]?key\s*[=:]\s*['"][^'"]{8,}['"]"#,
            r#"(?i)password\s*[=:]\s*['"][^'"]{4,}['"]"#,
            r#"(?i)secret\s*[=:]\s*['"][^'"]{8,}['"]"#,
            r#"(?i)token\s*[=:]\s*['"][^'"]{8,}['"]"#,
            r#"(?i)private[_-]?key\s*[=:]\s*['"][^'"]+['"]"#,
            r#"(?i)access[_-]?token\s*[=:]\s*['"][^'"]+['"]"#,
            r"sk-[a-zA-Z0-9]{32,}", // OpenAI API keys
            r"xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}", // Slack bot tokens
        ];

        // 스캔할 파일 확장자
        let file_extensions = [".js", ".ts", ".tsx", ".jsx", ".rs", ".py", ".json", ".env", ".yaml", ".yml"];
        
        for ext in &file_extensions {
            let files = self.find_files_by_extension(ext).await?;
            for file_path in files {
                if let Ok(content) = fs::read_to_string(&file_path).await {
                    for pattern in &secret_patterns {
                        if let Ok(regex) = Regex::new(pattern) {
                            for m in regex.find_iter(&content) {
                                secrets.push(format!("{}:{}", file_path.display(), m.as_str()));
                            }
                        }
                    }
                }
            }
        }

        Ok(secrets)
    }

    async fn scan_vulnerable_dependencies(&self) -> Result<Vec<String>> {
        // 실제 구현에서는 vulnerability database와 연동
        Ok(Vec::new())
    }

    async fn scan_unsafe_patterns(&self) -> Result<Vec<String>> {
        let unsafe_patterns = [
            r"eval\s*\(",
            r"innerHTML\s*=",
            r"dangerouslySetInnerHTML",
            r"exec\s*\(",
        ];

        let mut unsafe_code = Vec::new();
        for pattern in &unsafe_patterns {
            let regex = Regex::new(pattern)?;
            let matches = self.scan_files_with_regex(&regex).await?;
            unsafe_code.extend(matches);
        }

        Ok(unsafe_code)
    }

    async fn check_file_permissions(&self) -> Result<Vec<String>> {
        // 파일 권한 검사 로직
        Ok(Vec::new())
    }

    // Helper methods for dependencies analysis
    async fn read_package_json(&self) -> Result<Value> {
        let package_path = self.project_path.join("package.json");
        let content = fs::read_to_string(package_path).await?;
        Ok(serde_json::from_str(&content)?)
    }

    async fn read_cargo_toml(&self) -> Result<Value> {
        let cargo_path = self.project_path.join("Cargo.toml");
        let content = fs::read_to_string(cargo_path).await?;
        // TOML parsing logic would go here
        Ok(Value::Null)
    }

    async fn count_outdated_npm_packages(&self, _package_json: &Value) -> Result<usize> {
        // npm outdated 명령어 실행 로직
        Ok(0)
    }

    async fn count_vulnerable_npm_packages(&self, _package_json: &Value) -> Result<usize> {
        // npm audit 명령어 실행 로직
        Ok(0)
    }

    async fn count_outdated_rust_crates(&self, _cargo_toml: &Value) -> Result<usize> {
        // cargo outdated 명령어 실행 로직
        Ok(0)
    }

    async fn find_duplicate_dependencies(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    // Helper methods for complexity analysis
    async fn find_large_files(&self, line_threshold: usize) -> Result<Vec<PathBuf>> {
        let mut large_files = Vec::new();
        // 파일 크기 검사 로직
        Ok(large_files)
    }

    async fn find_complex_functions(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    async fn find_deep_nesting(&self, depth_threshold: usize) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    async fn find_duplicate_code_blocks(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    // Helper methods for scalability analysis
    async fn check_modular_architecture(&self) -> Result<bool> {
        Ok(true)
    }

    async fn analyze_database_scalability(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    async fn analyze_api_scalability(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    async fn find_performance_bottlenecks(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    // Helper methods for error rate analysis
    async fn find_missing_error_handling(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    async fn find_runtime_error_patterns(&self) -> Result<Vec<String>> {
        Ok(Vec::new())
    }

    async fn calculate_test_coverage(&self) -> Result<f64> {
        Ok(85.0) // 임시값
    }

    // Helper methods for feature scanning
    async fn scan_react_components(&self) -> Result<Vec<ComponentInfo>> {
        Ok(Vec::new())
    }

    async fn scan_rust_modules(&self) -> Result<Vec<FeatureItem>> {
        Ok(Vec::new())
    }

    async fn scan_api_endpoints(&self) -> Result<Vec<FeatureItem>> {
        Ok(Vec::new())
    }

    // Helper methods for risk detection
    async fn detect_security_risks(&self) -> Result<Vec<RiskItem>> {
        Ok(Vec::new())
    }

    async fn detect_performance_risks(&self) -> Result<Vec<RiskItem>> {
        Ok(Vec::new())
    }

    async fn detect_dependency_risks(&self) -> Result<Vec<RiskItem>> {
        Ok(Vec::new())
    }

    async fn detect_technical_debt(&self) -> Result<Vec<RiskItem>> {
        Ok(Vec::new())
    }

    // Helper methods for documentation analysis
    async fn analyze_doc_type(&self, doc_type: &str) -> Result<DocAnalysisResult> {
        Ok(DocAnalysisResult {
            completion_percentage: Some(75.0),
            total_sections: Some(10),
            completed_sections: Some(7),
            missing_sections: Some("[]".to_string()),
            file_paths: Some("[]".to_string()),
            quality_score: Some(80.0),
        })
    }

    // Utility methods
    async fn scan_files_with_regex(&self, regex: &Regex) -> Result<Vec<String>> {
        let mut matches = Vec::new();
        // 파일 스캔 로직
        Ok(matches)
    }

    async fn find_files_by_extension(&self, extension: &str) -> Result<Vec<PathBuf>> {
        use walkdir::WalkDir;
        
        let mut files = Vec::new();
        
        for entry in WalkDir::new(&self.project_path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                if let Some(ext) = entry.path().extension() {
                    if ext.to_string_lossy() == extension.trim_start_matches('.') {
                        files.push(entry.path().to_path_buf());
                    }
                }
            }
        }
        
        Ok(files)
    }

    async fn check_config_security(&self) -> Result<Vec<String>> {
        let mut issues = Vec::new();
        
        // .env 파일 검사
        let env_files = [".env", ".env.local", ".env.production", ".env.development"];
        for env_file in &env_files {
            let env_path = self.project_path.join(env_file);
            if env_path.exists() {
                if let Ok(content) = fs::read_to_string(&env_path).await {
                    // 빈 값이나 예제 값 검사
                    let insecure_patterns = [
                        r"(?i)(password|secret|key|token)\s*=\s*$",
                        r"(?i)(password|secret|key|token)\s*=\s*(test|example|demo|placeholder)",
                        r"(?i)(password|secret|key|token)\s*=\s*123",
                    ];
                    
                    for pattern in &insecure_patterns {
                        if let Ok(regex) = Regex::new(pattern) {
                            if regex.is_match(&content) {
                                issues.push(format!("Insecure configuration in {}", env_file));
                            }
                        }
                    }
                }
            }
        }
        
        Ok(issues)
    }

    async fn calculate_trend(&self, metric_type: &str) -> Result<String> {
        // 트렌드 계산 로직 (과거 데이터와 비교)
        Ok("stable".to_string())
    }

    // Details generation methods
    async fn get_security_details(&self, score: f64) -> String {
        if score >= 90.0 {
            "Excellent security posture with no critical issues".to_string()
        } else if score >= 70.0 {
            "Good security with minor issues to address".to_string()
        } else {
            "Security improvements needed".to_string()
        }
    }

    async fn get_dependencies_details(&self, score: f64) -> String {
        format!("Dependencies health score: {:.1}%", score)
    }

    async fn get_complexity_details(&self, score: f64) -> String {
        format!("Code complexity score: {:.1}%", score)
    }

    async fn get_scalability_details(&self, score: f64) -> String {
        format!("Scalability readiness: {:.1}%", score)
    }

    async fn get_error_rate_details(&self, score: f64) -> String {
        format!("Error handling quality: {:.1}%", score)
    }
}

// Supporting structures
#[derive(Debug)]
struct ComponentInfo {
    name: String,
    description: Option<String>,
    status: String,
    independence_score: f64,
    dependencies: Option<String>,
    file_paths: Option<String>,
    complexity_score: f64,
}

#[derive(Debug)]
struct DocAnalysisResult {
    completion_percentage: Option<f64>,
    total_sections: Option<i64>,
    completed_sections: Option<i64>,
    missing_sections: Option<String>,
    file_paths: Option<String>,
    quality_score: Option<f64>,
}