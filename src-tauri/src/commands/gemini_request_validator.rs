use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use regex::Regex;

/// Request validation rules
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRule {
    pub name: String,
    pub rule_type: ValidationRuleType,
    pub severity: ValidationSeverity,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationRuleType {
    ContentLength { min: Option<usize>, max: Option<usize> },
    ContentPattern { pattern: String, flags: Option<String> },
    TokenLimit { max_tokens: u32 },
    SafetyCheck { categories: Vec<String> },
    ParameterRange { param: String, min: f32, max: f32 },
    RequiredFields { fields: Vec<String> },
    CustomValidator { script: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationSeverity {
    Error,   // Blocks request
    Warning, // Logs warning but allows
    Info,    // Informational only
}

/// Content filter for safety and compliance
#[derive(Debug, Clone)]
pub struct ContentFilter {
    rules: Vec<ContentFilterRule>,
    sensitive_patterns: Vec<SensitivePattern>,
}

#[derive(Debug, Clone)]
struct ContentFilterRule {
    name: String,
    pattern: Regex,
    action: FilterAction,
    replacement: Option<String>,
}

#[derive(Debug, Clone)]
struct SensitivePattern {
    pattern: Regex,
    category: String,
    severity: String,
}

#[derive(Debug, Clone)]
enum FilterAction {
    Block,
    Redact,
    Flag,
    Transform(String),
}

impl ContentFilter {
    pub fn new() -> Self {
        let mut rules = Vec::new();
        let mut sensitive_patterns = Vec::new();
        
        // PII patterns
        if let Ok(re) = Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b") {
            rules.push(ContentFilterRule {
                name: "email_filter".to_string(),
                pattern: re,
                action: FilterAction::Redact,
                replacement: Some("[EMAIL_REDACTED]".to_string()),
            });
        }
        
        if let Ok(re) = Regex::new(r"\b\d{3}-\d{2}-\d{4}\b") {
            rules.push(ContentFilterRule {
                name: "ssn_filter".to_string(),
                pattern: re,
                action: FilterAction::Block,
                replacement: None,
            });
        }
        
        // Credit card patterns
        if let Ok(re) = Regex::new(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b") {
            sensitive_patterns.push(SensitivePattern {
                pattern: re,
                category: "financial".to_string(),
                severity: "high".to_string(),
            });
        }
        
        // API key patterns
        if let Ok(re) = Regex::new(r"\b[A-Za-z0-9]{32,}\b") {
            sensitive_patterns.push(SensitivePattern {
                pattern: re,
                category: "credentials".to_string(),
                severity: "high".to_string(),
            });
        }
        
        Self {
            rules,
            sensitive_patterns,
        }
    }
    
    /// Apply content filtering
    pub fn filter_content(&self, content: &str) -> Result<FilterResult> {
        let mut filtered_content = content.to_string();
        let mut violations = Vec::new();
        let mut redactions = 0;
        
        // Apply filter rules
        for rule in &self.rules {
            match &rule.action {
                FilterAction::Block => {
                    if rule.pattern.is_match(&filtered_content) {
                        violations.push(Violation {
                            rule_name: rule.name.clone(),
                            severity: "high".to_string(),
                            message: format!("Content blocked by {}", rule.name),
                        });
                        return Err(anyhow!("Content blocked by filter: {}", rule.name));
                    }
                }
                FilterAction::Redact => {
                    if let Some(replacement) = &rule.replacement {
                        let matches = rule.pattern.find_iter(&filtered_content).count();
                        if matches > 0 {
                            filtered_content = rule.pattern.replace_all(&filtered_content, replacement).to_string();
                            redactions += matches;
                        }
                    }
                }
                FilterAction::Flag => {
                    if rule.pattern.is_match(&filtered_content) {
                        violations.push(Violation {
                            rule_name: rule.name.clone(),
                            severity: "medium".to_string(),
                            message: format!("Content flagged by {}", rule.name),
                        });
                    }
                }
                FilterAction::Transform(transform) => {
                    // Apply transformation logic
                    filtered_content = self.apply_transform(&filtered_content, transform);
                }
            }
        }
        
        // Check sensitive patterns
        for pattern in &self.sensitive_patterns {
            if pattern.pattern.is_match(&filtered_content) {
                violations.push(Violation {
                    rule_name: pattern.category.clone(),
                    severity: pattern.severity.clone(),
                    message: format!("Sensitive {} data detected", pattern.category),
                });
            }
        }
        
        Ok(FilterResult {
            filtered_content: filtered_content.clone(),
            original_length: content.len(),
            filtered_length: filtered_content.len(),
            redactions,
            violations,
        })
    }
    
    fn apply_transform(&self, content: &str, transform: &str) -> String {
        match transform {
            "lowercase" => content.to_lowercase(),
            "uppercase" => content.to_uppercase(),
            "trim" => content.trim().to_string(),
            _ => content.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterResult {
    pub filtered_content: String,
    pub original_length: usize,
    pub filtered_length: usize,
    pub redactions: usize,
    pub violations: Vec<Violation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Violation {
    pub rule_name: String,
    pub severity: String,
    pub message: String,
}

/// Request sanitizer
pub struct RequestSanitizer {
    max_prompt_length: usize,
    allowed_mime_types: Vec<String>,
    max_file_size: usize,
}

impl RequestSanitizer {
    pub fn new() -> Self {
        Self {
            max_prompt_length: 1_000_000, // 1MB
            allowed_mime_types: vec![
                "image/png".to_string(),
                "image/jpeg".to_string(),
                "image/webp".to_string(),
                "image/gif".to_string(),
                "application/pdf".to_string(),
                "text/plain".to_string(),
                "application/json".to_string(),
            ],
            max_file_size: 10 * 1024 * 1024, // 10MB
        }
    }
    
    /// Sanitize request prompt
    pub fn sanitize_prompt(&self, prompt: &str) -> Result<String> {
        // Check length
        if prompt.len() > self.max_prompt_length {
            return Err(anyhow!(
                "Prompt exceeds maximum length: {} > {}",
                prompt.len(),
                self.max_prompt_length
            ));
        }
        
        // Remove null bytes
        let sanitized = prompt.replace('\0', "");
        
        // Normalize whitespace
        let sanitized = sanitized
            .lines()
            .map(|line| line.trim_end())
            .collect::<Vec<_>>()
            .join("\n");
        
        // Remove control characters (except newlines and tabs)
        let sanitized = sanitized
            .chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
            .collect();
        
        Ok(sanitized)
    }
    
    /// Validate file attachments
    pub fn validate_files(
        &self,
        files: &[(String, String, Vec<u8>)],
    ) -> Result<Vec<FileValidation>> {
        let mut validations = Vec::new();
        
        for (name, mime_type, data) in files {
            let mut validation = FileValidation {
                name: name.clone(),
                mime_type: mime_type.clone(),
                size: data.len(),
                valid: true,
                issues: Vec::new(),
            };
            
            // Check MIME type
            if !self.allowed_mime_types.contains(mime_type) {
                validation.valid = false;
                validation.issues.push(format!(
                    "Unsupported MIME type: {}. Allowed types: {:?}",
                    mime_type, self.allowed_mime_types
                ));
            }
            
            // Check file size
            if data.len() > self.max_file_size {
                validation.valid = false;
                validation.issues.push(format!(
                    "File size exceeds limit: {} > {} bytes",
                    data.len(), self.max_file_size
                ));
            }
            
            // Validate file content matches MIME type
            if validation.valid {
                if let Err(e) = self.validate_file_content(mime_type, data) {
                    validation.valid = false;
                    validation.issues.push(format!("Content validation failed: {}", e));
                }
            }
            
            validations.push(validation);
        }
        
        Ok(validations)
    }
    
    fn validate_file_content(&self, mime_type: &str, data: &[u8]) -> Result<()> {
        match mime_type {
            "image/png" => {
                if data.len() < 8 || &data[0..8] != b"\x89PNG\r\n\x1a\n" {
                    return Err(anyhow!("Invalid PNG signature"));
                }
            }
            "image/jpeg" => {
                if data.len() < 3 || &data[0..3] != b"\xFF\xD8\xFF" {
                    return Err(anyhow!("Invalid JPEG signature"));
                }
            }
            "application/pdf" => {
                if data.len() < 5 || &data[0..5] != b"%PDF-" {
                    return Err(anyhow!("Invalid PDF signature"));
                }
            }
            _ => {} // Skip validation for other types
        }
        
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileValidation {
    pub name: String,
    pub mime_type: String,
    pub size: usize,
    pub valid: bool,
    pub issues: Vec<String>,
}

/// Request validator combining all validation logic
pub struct RequestValidator {
    content_filter: ContentFilter,
    sanitizer: RequestSanitizer,
    validation_rules: Vec<ValidationRule>,
}

impl RequestValidator {
    pub fn new() -> Self {
        let mut validation_rules = Vec::new();
        
        // Default validation rules
        validation_rules.push(ValidationRule {
            name: "prompt_required".to_string(),
            rule_type: ValidationRuleType::RequiredFields {
                fields: vec!["prompt".to_string()],
            },
            severity: ValidationSeverity::Error,
            message: "Prompt is required".to_string(),
        });
        
        validation_rules.push(ValidationRule {
            name: "temperature_range".to_string(),
            rule_type: ValidationRuleType::ParameterRange {
                param: "temperature".to_string(),
                min: 0.0,
                max: 2.0,
            },
            severity: ValidationSeverity::Warning,
            message: "Temperature should be between 0.0 and 2.0".to_string(),
        });
        
        Self {
            content_filter: ContentFilter::new(),
            sanitizer: RequestSanitizer::new(),
            validation_rules,
        }
    }
    
    /// Validate request comprehensively
    pub async fn validate_request(
        &self,
        request: &super::gemini_backend::GeminiRequest,
    ) -> Result<ValidationReport> {
        let mut report = ValidationReport {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
            info: Vec::new(),
            filtered_prompt: None,
            sanitization_applied: false,
        };
        
        // Validate required fields
        if request.prompt.trim().is_empty() {
            report.valid = false;
            report.errors.push(ValidationError {
                field: "prompt".to_string(),
                message: "Prompt cannot be empty".to_string(),
                code: "EMPTY_PROMPT".to_string(),
            });
        }
        
        // Sanitize prompt
        match self.sanitizer.sanitize_prompt(&request.prompt) {
            Ok(sanitized) => {
                if sanitized != request.prompt {
                    report.sanitization_applied = true;
                }
                
                // Apply content filtering
                match self.content_filter.filter_content(&sanitized) {
                    Ok(filter_result) => {
                        report.filtered_prompt = Some(filter_result.filtered_content);
                        
                        for violation in filter_result.violations {
                            match violation.severity.as_str() {
                                "high" => {
                                    report.valid = false;
                                    report.errors.push(ValidationError {
                                        field: "prompt".to_string(),
                                        message: violation.message,
                                        code: violation.rule_name,
                                    });
                                }
                                "medium" => {
                                    report.warnings.push(ValidationWarning {
                                        field: "prompt".to_string(),
                                        message: violation.message,
                                        code: violation.rule_name,
                                    });
                                }
                                _ => {
                                    report.info.push(ValidationInfo {
                                        field: "prompt".to_string(),
                                        message: violation.message,
                                    });
                                }
                            }
                        }
                        
                        if filter_result.redactions > 0 {
                            report.info.push(ValidationInfo {
                                field: "prompt".to_string(),
                                message: format!("{} sensitive data items redacted", filter_result.redactions),
                            });
                        }
                    }
                    Err(e) => {
                        report.valid = false;
                        report.errors.push(ValidationError {
                            field: "prompt".to_string(),
                            message: e.to_string(),
                            code: "CONTENT_FILTER_ERROR".to_string(),
                        });
                    }
                }
            }
            Err(e) => {
                report.valid = false;
                report.errors.push(ValidationError {
                    field: "prompt".to_string(),
                    message: e.to_string(),
                    code: "SANITIZATION_ERROR".to_string(),
                });
            }
        }
        
        // Validate files if present
        if let Some(files) = &request.files {
            match self.sanitizer.validate_files(files) {
                Ok(validations) => {
                    for validation in validations {
                        if !validation.valid {
                            report.valid = false;
                            for issue in validation.issues {
                                report.errors.push(ValidationError {
                                    field: format!("file:{}", validation.name),
                                    message: issue,
                                    code: "FILE_VALIDATION_ERROR".to_string(),
                                });
                            }
                        }
                    }
                }
                Err(e) => {
                    report.valid = false;
                    report.errors.push(ValidationError {
                        field: "files".to_string(),
                        message: e.to_string(),
                        code: "FILE_VALIDATION_ERROR".to_string(),
                    });
                }
            }
        }
        
        // Validate parameters
        if let Some(temp) = request.temperature {
            if temp < 0.0 || temp > 2.0 {
                report.warnings.push(ValidationWarning {
                    field: "temperature".to_string(),
                    message: format!("Temperature {} is outside recommended range [0.0, 2.0]", temp),
                    code: "PARAMETER_RANGE".to_string(),
                });
            }
        }
        
        if let Some(max_tokens) = request.max_output_tokens {
            if max_tokens > 32768 {
                report.warnings.push(ValidationWarning {
                    field: "max_output_tokens".to_string(),
                    message: format!("Max output tokens {} exceeds typical limit", max_tokens),
                    code: "TOKEN_LIMIT".to_string(),
                });
            }
        }
        
        Ok(report)
    }
    
    /// Add custom validation rule
    pub fn add_rule(&mut self, rule: ValidationRule) {
        self.validation_rules.push(rule);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
    pub info: Vec<ValidationInfo>,
    pub filtered_prompt: Option<String>,
    pub sanitization_applied: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationWarning {
    pub field: String,
    pub message: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationInfo {
    pub field: String,
    pub message: String,
}

/// Validate Gemini request command
#[tauri::command]
pub async fn validate_gemini_request(
    request: super::gemini_backend::GeminiRequest,
) -> Result<ValidationReport, String> {
    let validator = RequestValidator::new();
    validator.validate_request(&request)
        .await
        .map_err(|e| e.to_string())
}