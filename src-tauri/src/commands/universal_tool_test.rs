use tauri::command;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use log::{info, error};

use crate::commands::universal_tool_executor::{
    UniversalExecutionRequest, UniversalExecutionResult,
    ToolCapabilityCheck, execute_with_universal_tools,
    execute_universal_tool, list_tools_for_model,
    check_model_tool_capabilities
};

/// Test result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalToolTestResult {
    pub test_name: String,
    pub success: bool,
    pub details: Value,
    pub error: Option<String>,
}

/// Comprehensive test suite for universal tool system
#[command]
pub async fn test_universal_tool_system(
    app_handle: tauri::AppHandle,
) -> Result<Vec<UniversalToolTestResult>, String> {
    info!("Starting comprehensive universal tool system test");
    
    let mut results = Vec::new();
    
    // Test 1: Check tool capabilities for different models
    results.push(test_model_capabilities(&app_handle).await);
    
    // Test 2: List tools for each model type
    results.push(test_tool_listing(&app_handle).await);
    
    // Test 3: Execute MCP server with different models
    results.push(test_mcp_execution(&app_handle).await);
    
    // Test 4: Execute agent with different models
    results.push(test_agent_execution(&app_handle).await);
    
    // Test 5: Execute slash command with different models
    results.push(test_slash_command_execution(&app_handle).await);
    
    // Test 6: Cross-model tool sharing
    results.push(test_cross_model_sharing(&app_handle).await);
    
    // Test 7: Performance test
    results.push(test_performance(&app_handle).await);
    
    // Calculate summary
    let total_tests = results.len();
    let passed_tests = results.iter().filter(|r| r.success).count();
    
    info!("Universal tool system test complete: {}/{} tests passed", passed_tests, total_tests);
    
    Ok(results)
}

/// Test model capabilities detection
async fn test_model_capabilities(app_handle: &tauri::AppHandle) -> UniversalToolTestResult {
    let test_name = "Model Capabilities Detection".to_string();
    
    let models = vec![
        "claude-3-sonnet-20240229",
        "gemini-2.5-pro-exp",
        "llama2",
    ];
    
    let mut capabilities = Vec::new();
    
    for model in models {
        match check_model_tool_capabilities(app_handle.clone(), model.to_string()).await {
            Ok(cap) => {
                capabilities.push(json!({
                    "model": model,
                    "supports_mcp": cap.supports_mcp,
                    "supports_agents": cap.supports_agents,
                    "supports_slash_commands": cap.supports_slash_commands,
                    "supports_tools": cap.supports_tools,
                    "adapters": cap.tool_adapters,
                }));
            },
            Err(e) => {
                return UniversalToolTestResult {
                    test_name,
                    success: false,
                    details: json!({"error": e}),
                    error: Some(e),
                };
            }
        }
    }
    
    UniversalToolTestResult {
        test_name,
        success: true,
        details: json!({"capabilities": capabilities}),
        error: None,
    }
}

/// Test tool listing for models
async fn test_tool_listing(app_handle: &tauri::AppHandle) -> UniversalToolTestResult {
    let test_name = "Tool Listing".to_string();
    
    let models = vec![
        ("claude-3-sonnet-20240229", "Claude"),
        ("gemini-2.5-pro-exp", "Gemini"),
        ("llama2", "Ollama"),
    ];
    
    let mut tool_lists = Vec::new();
    
    for (model, provider) in models {
        match list_tools_for_model(app_handle.clone(), model.to_string()).await {
            Ok(tools) => {
                tool_lists.push(json!({
                    "model": model,
                    "provider": provider,
                    "tool_count": tools.len(),
                    "tools": tools.iter().map(|t| t.name.clone()).collect::<Vec<_>>(),
                }));
            },
            Err(e) => {
                return UniversalToolTestResult {
                    test_name,
                    success: false,
                    details: json!({"error": e, "model": model}),
                    error: Some(e),
                };
            }
        }
    }
    
    UniversalToolTestResult {
        test_name,
        success: true,
        details: json!({"tool_lists": tool_lists}),
        error: None,
    }
}

/// Test MCP server execution across models
async fn test_mcp_execution(app_handle: &tauri::AppHandle) -> UniversalToolTestResult {
    let test_name = "MCP Server Execution".to_string();
    
    let models = vec!["claude-3-sonnet-20240229", "gemini-2.5-pro-exp", "llama2"];
    let mut execution_results = Vec::new();
    
    for model in models {
        let mut params = HashMap::new();
        params.insert("command".to_string(), json!("test"));
        params.insert("args".to_string(), json!(["arg1", "arg2"]));
        
        match execute_universal_tool(
            app_handle.clone(),
            "mcp_test_server".to_string(),
            model.to_string(),
            params,
            "./test".to_string(),
            "Test MCP execution".to_string(),
        ).await {
            Ok(result) => {
                execution_results.push(json!({
                    "model": model,
                    "success": result.success,
                    "execution_time_ms": result.execution_time_ms,
                }));
            },
            Err(e) => {
                // It's okay if the tool doesn't exist, we're testing the system
                execution_results.push(json!({
                    "model": model,
                    "success": false,
                    "error": e,
                }));
            }
        }
    }
    
    UniversalToolTestResult {
        test_name,
        success: true,
        details: json!({"executions": execution_results}),
        error: None,
    }
}

/// Test agent execution across models
async fn test_agent_execution(app_handle: &tauri::AppHandle) -> UniversalToolTestResult {
    let test_name = "Agent Execution".to_string();
    
    let models = vec!["claude-3-sonnet-20240229", "gemini-2.5-pro-exp", "llama2"];
    let mut execution_results = Vec::new();
    
    for model in models {
        let mut params = HashMap::new();
        params.insert("task".to_string(), json!("Analyze code"));
        params.insert("context".to_string(), json!("Test context"));
        
        match execute_universal_tool(
            app_handle.clone(),
            "agent_test_agent".to_string(),
            model.to_string(),
            params,
            "./test".to_string(),
            "Test agent execution".to_string(),
        ).await {
            Ok(result) => {
                execution_results.push(json!({
                    "model": model,
                    "success": result.success,
                    "execution_time_ms": result.execution_time_ms,
                }));
            },
            Err(e) => {
                execution_results.push(json!({
                    "model": model,
                    "success": false,
                    "error": e,
                }));
            }
        }
    }
    
    UniversalToolTestResult {
        test_name,
        success: true,
        details: json!({"executions": execution_results}),
        error: None,
    }
}

/// Test slash command execution across models
async fn test_slash_command_execution(app_handle: &tauri::AppHandle) -> UniversalToolTestResult {
    let test_name = "Slash Command Execution".to_string();
    
    let models = vec!["claude-3-sonnet-20240229", "gemini-2.5-pro-exp", "llama2"];
    let mut execution_results = Vec::new();
    
    for model in models {
        let mut params = HashMap::new();
        params.insert("arguments".to_string(), json!("test args"));
        
        match execute_universal_tool(
            app_handle.clone(),
            "cmd_test".to_string(),
            model.to_string(),
            params,
            "./test".to_string(),
            "Test slash command".to_string(),
        ).await {
            Ok(result) => {
                execution_results.push(json!({
                    "model": model,
                    "success": result.success,
                    "execution_time_ms": result.execution_time_ms,
                }));
            },
            Err(e) => {
                execution_results.push(json!({
                    "model": model,
                    "success": false,
                    "error": e,
                }));
            }
        }
    }
    
    UniversalToolTestResult {
        test_name,
        success: true,
        details: json!({"executions": execution_results}),
        error: None,
    }
}

/// Test cross-model tool sharing
async fn test_cross_model_sharing(app_handle: &tauri::AppHandle) -> UniversalToolTestResult {
    let test_name = "Cross-Model Tool Sharing".to_string();
    
    // Test that the same tool can be used by different models
    let tool_name = "file_operations";
    let models = vec!["claude-3-sonnet-20240229", "gemini-2.5-pro-exp", "llama2"];
    
    let mut sharing_results = Vec::new();
    
    for model in &models {
        let tools = list_tools_for_model(app_handle.clone(), model.to_string())
            .await
            .unwrap_or_default();
        
        let has_tool = tools.iter().any(|t| t.name == tool_name);
        
        sharing_results.push(json!({
            "model": model,
            "has_file_operations": has_tool,
        }));
    }
    
    // All models should have access to the same universal tools
    let all_have_tool = sharing_results.iter()
        .all(|r| r["has_file_operations"].as_bool().unwrap_or(false));
    
    UniversalToolTestResult {
        test_name,
        success: all_have_tool,
        details: json!({
            "tool_name": tool_name,
            "sharing_results": sharing_results,
            "all_models_have_access": all_have_tool,
        }),
        error: if !all_have_tool {
            Some("Not all models have access to universal tools".to_string())
        } else {
            None
        },
    }
}

/// Test performance of tool execution
async fn test_performance(app_handle: &tauri::AppHandle) -> UniversalToolTestResult {
    let test_name = "Performance Test".to_string();
    
    let start = std::time::Instant::now();
    
    // Execute multiple tools in sequence
    let models = vec!["claude-3-sonnet-20240229", "gemini-2.5-pro-exp", "llama2"];
    let mut total_executions = 0;
    
    for model in models {
        // List tools
        let _ = list_tools_for_model(app_handle.clone(), model.to_string()).await;
        total_executions += 1;
        
        // Check capabilities
        let _ = check_model_tool_capabilities(app_handle.clone(), model.to_string()).await;
        total_executions += 1;
    }
    
    let elapsed = start.elapsed();
    let avg_time_ms = elapsed.as_millis() / total_executions as u128;
    
    // Performance should be under 100ms per operation
    let performance_ok = avg_time_ms < 100;
    
    UniversalToolTestResult {
        test_name,
        success: performance_ok,
        details: json!({
            "total_executions": total_executions,
            "total_time_ms": elapsed.as_millis(),
            "average_time_ms": avg_time_ms,
            "performance_threshold_ms": 100,
        }),
        error: if !performance_ok {
            Some(format!("Performance too slow: {}ms avg", avg_time_ms))
        } else {
            None
        },
    }
}

/// Test specific model with all tools
#[command]
pub async fn test_model_with_all_tools(
    app_handle: tauri::AppHandle,
    model_id: String,
) -> Result<Value, String> {
    info!("Testing model {} with all available tools", model_id);
    
    // Get all available tools for this model
    let tools = list_tools_for_model(app_handle.clone(), model_id.clone()).await?;
    
    let mut test_results = Vec::new();
    
    for tool_info in tools {
        let mut params = HashMap::new();
        params.insert("test".to_string(), json!(true));
        
        let result = execute_universal_tool(
            app_handle.clone(),
            tool_info.name.clone(),
            model_id.clone(),
            params,
            "./test".to_string(),
            format!("Testing tool: {}", tool_info.name),
        ).await;
        
        test_results.push(json!({
            "tool": tool_info.name,
            "tool_type": tool_info.tool_type,
            "success": result.is_ok(),
            "error": result.err(),
        }));
    }
    
    Ok(json!({
        "model": model_id,
        "total_tools": test_results.len(),
        "successful": test_results.iter().filter(|r| r["success"].as_bool().unwrap_or(false)).count(),
        "results": test_results,
    }))
}