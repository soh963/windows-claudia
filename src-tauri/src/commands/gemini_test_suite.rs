use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tauri::State;
use super::agents::AgentDb;
use log;

/// Test case for model validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelTestCase {
    pub name: String,
    pub description: String,
    pub test_type: TestType,
    pub input: TestInput,
    pub expected_behavior: ExpectedBehavior,
    pub timeout: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestType {
    BasicText,
    LongContext,
    CodeGeneration,
    Streaming,
    FunctionCalling,
    SystemInstructions,
    Multimodal,
    JsonMode,
    ErrorHandling,
    RateLimiting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestInput {
    pub prompt: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub system_instruction: Option<String>,
    pub functions: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpectedBehavior {
    pub should_succeed: bool,
    pub min_response_length: Option<usize>,
    pub max_response_time: Option<Duration>,
    pub should_contain: Option<Vec<String>>,
    pub should_not_contain: Option<Vec<String>>,
}

/// Test result for a single test case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub test_name: String,
    pub model: String,
    pub status: TestStatus,
    pub response_time: Duration,
    pub response_length: usize,
    pub error_message: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestStatus {
    Passed,
    Failed,
    Skipped,
    Timeout,
    Error,
}

/// Comprehensive test report for a model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelTestReport {
    pub model_id: String,
    pub test_date: String,
    pub total_tests: usize,
    pub passed: usize,
    pub failed: usize,
    pub skipped: usize,
    pub compatibility_score: f32,
    pub performance_score: f32,
    pub reliability_score: f32,
    pub test_results: Vec<TestResult>,
    pub recommendations: Vec<String>,
}

/// Test suite for comprehensive model validation
pub struct GeminiTestSuite {
    test_cases: Vec<ModelTestCase>,
    api_key: String,
}

impl GeminiTestSuite {
    pub fn new(api_key: String) -> Self {
        Self {
            test_cases: Self::create_default_test_cases(),
            api_key,
        }
    }

    /// Create default test cases for all models
    fn create_default_test_cases() -> Vec<ModelTestCase> {
        vec![
            // Basic text generation
            ModelTestCase {
                name: "basic_text".to_string(),
                description: "Simple text generation test".to_string(),
                test_type: TestType::BasicText,
                input: TestInput {
                    prompt: "Write a haiku about programming".to_string(),
                    temperature: Some(0.7),
                    max_tokens: Some(100),
                    system_instruction: None,
                    functions: None,
                },
                expected_behavior: ExpectedBehavior {
                    should_succeed: true,
                    min_response_length: Some(10),
                    max_response_time: Some(Duration::from_secs(5)),
                    should_contain: None,
                    should_not_contain: None,
                },
                timeout: Duration::from_secs(10),
            },
            
            // Code generation
            ModelTestCase {
                name: "code_generation".to_string(),
                description: "Test code generation capabilities".to_string(),
                test_type: TestType::CodeGeneration,
                input: TestInput {
                    prompt: "Write a Python function to calculate fibonacci numbers".to_string(),
                    temperature: Some(0.3),
                    max_tokens: Some(500),
                    system_instruction: Some("You are a helpful coding assistant".to_string()),
                    functions: None,
                },
                expected_behavior: ExpectedBehavior {
                    should_succeed: true,
                    min_response_length: Some(50),
                    max_response_time: Some(Duration::from_secs(10)),
                    should_contain: Some(vec!["def".to_string(), "fibonacci".to_string()]),
                    should_not_contain: None,
                },
                timeout: Duration::from_secs(15),
            },
            
            // Long context handling
            ModelTestCase {
                name: "long_context".to_string(),
                description: "Test handling of long input context".to_string(),
                test_type: TestType::LongContext,
                input: TestInput {
                    prompt: format!("Summarize this text: {}", "Lorem ipsum ".repeat(1000)),
                    temperature: Some(0.5),
                    max_tokens: Some(200),
                    system_instruction: None,
                    functions: None,
                },
                expected_behavior: ExpectedBehavior {
                    should_succeed: true,
                    min_response_length: Some(50),
                    max_response_time: Some(Duration::from_secs(20)),
                    should_contain: None,
                    should_not_contain: None,
                },
                timeout: Duration::from_secs(30),
            },
            
            // System instructions
            ModelTestCase {
                name: "system_instructions".to_string(),
                description: "Test system instruction support".to_string(),
                test_type: TestType::SystemInstructions,
                input: TestInput {
                    prompt: "What is 2+2?".to_string(),
                    temperature: Some(0.1),
                    max_tokens: Some(50),
                    system_instruction: Some("Always respond in JSON format with a 'result' field".to_string()),
                    functions: None,
                },
                expected_behavior: ExpectedBehavior {
                    should_succeed: true,
                    min_response_length: Some(10),
                    max_response_time: Some(Duration::from_secs(5)),
                    should_contain: Some(vec!["result".to_string()]),
                    should_not_contain: None,
                },
                timeout: Duration::from_secs(10),
            },
            
            // JSON mode
            ModelTestCase {
                name: "json_mode".to_string(),
                description: "Test JSON response format".to_string(),
                test_type: TestType::JsonMode,
                input: TestInput {
                    prompt: "List 3 programming languages with their year of creation in JSON format".to_string(),
                    temperature: Some(0.3),
                    max_tokens: Some(200),
                    system_instruction: None,
                    functions: None,
                },
                expected_behavior: ExpectedBehavior {
                    should_succeed: true,
                    min_response_length: Some(30),
                    max_response_time: Some(Duration::from_secs(10)),
                    should_contain: Some(vec!["{".to_string(), "}".to_string()]),
                    should_not_contain: None,
                },
                timeout: Duration::from_secs(15),
            },
            
            // Error handling - Invalid temperature
            ModelTestCase {
                name: "error_invalid_temperature".to_string(),
                description: "Test error handling for invalid parameters".to_string(),
                test_type: TestType::ErrorHandling,
                input: TestInput {
                    prompt: "Test".to_string(),
                    temperature: Some(10.0), // Invalid - too high
                    max_tokens: Some(10),
                    system_instruction: None,
                    functions: None,
                },
                expected_behavior: ExpectedBehavior {
                    should_succeed: false,
                    min_response_length: None,
                    max_response_time: Some(Duration::from_secs(5)),
                    should_contain: None,
                    should_not_contain: None,
                },
                timeout: Duration::from_secs(10),
            },
        ]
    }

    /// Run all tests for a specific model
    pub async fn test_model(&self, model_id: &str) -> ModelTestReport {
        log::info!("Starting comprehensive test suite for model: {}", model_id);
        
        let mut test_results = Vec::new();
        let start_time = Instant::now();
        
        for test_case in &self.test_cases {
            let result = self.run_single_test(model_id, test_case).await;
            test_results.push(result);
        }
        
        // Calculate scores
        let passed = test_results.iter().filter(|r| matches!(r.status, TestStatus::Passed)).count();
        let failed = test_results.iter().filter(|r| matches!(r.status, TestStatus::Failed)).count();
        let skipped = test_results.iter().filter(|r| matches!(r.status, TestStatus::Skipped)).count();
        
        let compatibility_score = if test_results.is_empty() {
            0.0
        } else {
            (passed as f32 / test_results.len() as f32) * 100.0
        };
        
        // Calculate performance score based on response times
        let avg_response_time = test_results.iter()
            .filter_map(|r| {
                if matches!(r.status, TestStatus::Passed) {
                    Some(r.response_time.as_millis() as f32)
                } else {
                    None
                }
            })
            .sum::<f32>() / passed.max(1) as f32;
        
        let performance_score = (1.0 - (avg_response_time / 10000.0).min(1.0)) * 100.0;
        
        // Calculate reliability score
        let error_rate = failed as f32 / test_results.len().max(1) as f32;
        let reliability_score = (1.0 - error_rate) * 100.0;
        
        // Generate recommendations
        let recommendations = self.generate_recommendations(&test_results, model_id);
        
        ModelTestReport {
            model_id: model_id.to_string(),
            test_date: chrono::Utc::now().to_rfc3339(),
            total_tests: test_results.len(),
            passed,
            failed,
            skipped,
            compatibility_score,
            performance_score,
            reliability_score,
            test_results,
            recommendations,
        }
    }

    /// Run a single test case
    async fn run_single_test(&self, model_id: &str, test_case: &ModelTestCase) -> TestResult {
        log::info!("Running test '{}' for model '{}'", test_case.name, model_id);
        
        let start = Instant::now();
        let client = reqwest::Client::new();
        
        // Determine API version
        let api_version = if model_id.contains("2.5") || model_id.contains("2.0") {
            "v1"
        } else {
            "v1beta"
        };
        
        let url = format!(
            "https://generativelanguage.googleapis.com/{}/models/{}:generateContent?key={}",
            api_version, model_id, self.api_key
        );
        
        // Build request body
        let mut request_body = serde_json::json!({
            "contents": [{
                "parts": [{
                    "text": test_case.input.prompt
                }]
            }],
            "generationConfig": {
                "temperature": test_case.input.temperature.unwrap_or(0.7),
                "maxOutputTokens": test_case.input.max_tokens.unwrap_or(8192),
                "topK": 10,
                "topP": 0.95
            }
        });
        
        // Add system instruction if provided
        if let Some(system_instruction) = &test_case.input.system_instruction {
            request_body["systemInstruction"] = serde_json::json!({
                "parts": [{
                    "text": system_instruction
                }]
            });
        }
        
        // Execute request with timeout
        let result = tokio::time::timeout(
            test_case.timeout,
            client.post(&url).json(&request_body).send()
        ).await;
        
        match result {
            Ok(Ok(response)) => {
                let response_time = start.elapsed();
                
                if response.status().is_success() {
                    if let Ok(json) = response.json::<serde_json::Value>().await {
                        // Extract response text
                        let response_text = json["candidates"][0]["content"]["parts"][0]["text"]
                            .as_str()
                            .unwrap_or("")
                            .to_string();
                        
                        // Validate response
                        let status = self.validate_response(
                            &response_text,
                            &test_case.expected_behavior,
                            response_time
                        );
                        
                        TestResult {
                            test_name: test_case.name.clone(),
                            model: model_id.to_string(),
                            status,
                            response_time,
                            response_length: response_text.len(),
                            error_message: None,
                            metadata: HashMap::new(),
                        }
                    } else {
                        TestResult {
                            test_name: test_case.name.clone(),
                            model: model_id.to_string(),
                            status: TestStatus::Error,
                            response_time,
                            response_length: 0,
                            error_message: Some("Failed to parse response".to_string()),
                            metadata: HashMap::new(),
                        }
                    }
                } else {
                    let error_text = response.text().await.unwrap_or_default();
                    
                    // Check if failure was expected
                    let status = if !test_case.expected_behavior.should_succeed {
                        TestStatus::Passed // Expected to fail and it did
                    } else {
                        TestStatus::Failed
                    };
                    
                    TestResult {
                        test_name: test_case.name.clone(),
                        model: model_id.to_string(),
                        status,
                        response_time: start.elapsed(),
                        response_length: 0,
                        error_message: Some(error_text),
                        metadata: HashMap::new(),
                    }
                }
            },
            Ok(Err(e)) => TestResult {
                test_name: test_case.name.clone(),
                model: model_id.to_string(),
                status: TestStatus::Error,
                response_time: start.elapsed(),
                response_length: 0,
                error_message: Some(format!("Request failed: {}", e)),
                metadata: HashMap::new(),
            },
            Err(_) => TestResult {
                test_name: test_case.name.clone(),
                model: model_id.to_string(),
                status: TestStatus::Timeout,
                response_time: test_case.timeout,
                response_length: 0,
                error_message: Some("Request timed out".to_string()),
                metadata: HashMap::new(),
            },
        }
    }

    /// Validate response against expected behavior
    fn validate_response(
        &self,
        response: &str,
        expected: &ExpectedBehavior,
        response_time: Duration,
    ) -> TestStatus {
        // Check response length
        if let Some(min_length) = expected.min_response_length {
            if response.len() < min_length {
                return TestStatus::Failed;
            }
        }
        
        // Check response time
        if let Some(max_time) = expected.max_response_time {
            if response_time > max_time {
                return TestStatus::Failed;
            }
        }
        
        // Check required content
        if let Some(should_contain) = &expected.should_contain {
            for keyword in should_contain {
                if !response.to_lowercase().contains(&keyword.to_lowercase()) {
                    return TestStatus::Failed;
                }
            }
        }
        
        // Check forbidden content
        if let Some(should_not_contain) = &expected.should_not_contain {
            for keyword in should_not_contain {
                if response.to_lowercase().contains(&keyword.to_lowercase()) {
                    return TestStatus::Failed;
                }
            }
        }
        
        TestStatus::Passed
    }

    /// Generate recommendations based on test results
    fn generate_recommendations(&self, results: &[TestResult], model_id: &str) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        // Check for consistent failures
        let failed_tests: Vec<_> = results.iter()
            .filter(|r| matches!(r.status, TestStatus::Failed))
            .collect();
        
        if failed_tests.len() > results.len() / 2 {
            recommendations.push(format!(
                "Model {} has high failure rate ({}%). Consider using a different model.",
                model_id,
                (failed_tests.len() * 100) / results.len()
            ));
        }
        
        // Check for specific test type failures
        for test in failed_tests {
            if test.test_name.contains("system_instructions") {
                recommendations.push("This model may not support system instructions properly.".to_string());
            }
            if test.test_name.contains("long_context") {
                recommendations.push("Consider using a model with larger context window for long inputs.".to_string());
            }
            if test.test_name.contains("code") {
                recommendations.push("This model may not be optimized for code generation.".to_string());
            }
        }
        
        // Performance recommendations
        let avg_response_time: u128 = results.iter()
            .filter(|r| matches!(r.status, TestStatus::Passed))
            .map(|r| r.response_time.as_millis())
            .sum::<u128>() / results.len().max(1) as u128;
        
        if avg_response_time > 5000 {
            recommendations.push("Response times are slow. Consider using a faster model variant.".to_string());
        }
        
        // Timeout recommendations
        let timeout_count = results.iter()
            .filter(|r| matches!(r.status, TestStatus::Timeout))
            .count();
        
        if timeout_count > 0 {
            recommendations.push(format!(
                "{} tests timed out. The model may be overloaded or unavailable.",
                timeout_count
            ));
        }
        
        if recommendations.is_empty() && 
           results.iter().all(|r| matches!(r.status, TestStatus::Passed)) {
            recommendations.push(format!("Model {} passed all tests successfully!", model_id));
        }
        
        recommendations
    }
}

/// Tauri command to test a specific model
#[tauri::command]
pub async fn test_gemini_model_comprehensive(
    model_id: String,
    db: State<'_, AgentDb>,
) -> Result<ModelTestReport, String> {
    // Get API key
    let api_key = {
        let conn = db.0.lock().unwrap();
        match conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
            [],
            |row| row.get::<_, String>(0),
        ) {
            Ok(key) => key,
            Err(_) => std::env::var("GEMINI_API_KEY")
                .map_err(|_| "Gemini API key not configured")?
        }
    };
    
    let test_suite = GeminiTestSuite::new(api_key);
    Ok(test_suite.test_model(&model_id).await)
}

/// Tauri command to test all available models
#[tauri::command]
pub async fn test_all_gemini_models(
    db: State<'_, AgentDb>,
) -> Result<Vec<ModelTestReport>, String> {
    // Get API key
    let api_key = {
        let conn = db.0.lock().unwrap();
        match conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'gemini_api_key'",
            [],
            |row| row.get::<_, String>(0),
        ) {
            Ok(key) => key,
            Err(_) => std::env::var("GEMINI_API_KEY")
                .map_err(|_| "Gemini API key not configured")?
        }
    };
    
    // Get list of models to test
    let models = vec![
        "gemini-2.5-pro-exp",
        "gemini-2.5-flash",
        "gemini-2.0-pro-exp",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-pro-002",
        "gemini-1.5-flash-002",
    ];
    
    let test_suite = GeminiTestSuite::new(api_key);
    let mut reports = Vec::new();
    
    for model in models {
        log::info!("Testing model: {}", model);
        let report = test_suite.test_model(model).await;
        reports.push(report);
    }
    
    Ok(reports)
}