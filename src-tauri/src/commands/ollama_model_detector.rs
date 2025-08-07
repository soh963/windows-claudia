use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::command;
use log;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedOllamaModel {
    pub id: String,
    pub name: String,
    pub size: i64,
    pub modified_at: String,
    pub parameter_size: String,
    pub quantization_level: String,
    pub family: String,
    pub capabilities: ModelCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCapabilities {
    pub intelligence: u8,
    pub speed: u8,
    pub coding_excellence: u8,
    pub analysis_depth: u8,
    pub creative_writing: u8,
    pub technical_precision: u8,
    pub supports_vision: bool,
    pub context_window: u32,
}

/// Dynamically detect and analyze all available Ollama models
#[command]
pub async fn detect_available_ollama_models() -> Result<Vec<DetectedOllamaModel>, String> {
    log::info!("Starting dynamic Ollama model detection");
    
    let client = reqwest::Client::new();
    let ollama_url = "http://localhost:11434/api/tags";
    
    // First check if Ollama is available
    let response = client.get(ollama_url).send().await
        .map_err(|e| format!("Failed to connect to Ollama: {}. Is Ollama running?", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Ollama API returned error: {}", response.status()));
    }
    
    let list_response: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
    
    let models = list_response["models"].as_array()
        .ok_or("Invalid Ollama API response: missing models array")?;
    
    let mut detected_models = Vec::new();
    
    for model in models {
        if let Some(model_obj) = model.as_object() {
            let name = model_obj["name"].as_str().unwrap_or("unknown").to_string();
            let size = model_obj["size"].as_i64().unwrap_or(0);
            let modified_at = model_obj["modified_at"].as_str().unwrap_or("").to_string();
            
            let details = model_obj.get("details");
            let parameter_size = details
                .and_then(|d| d["parameter_size"].as_str())
                .unwrap_or("unknown")
                .to_string();
            let quantization_level = details
                .and_then(|d| d["quantization_level"].as_str())
                .unwrap_or("unknown")
                .to_string();
            let family = details
                .and_then(|d| d["family"].as_str())
                .unwrap_or("llama")
                .to_string();
            
            // Analyze model capabilities based on name, size, and family
            let capabilities = analyze_model_capabilities(&name, size, &family, &parameter_size);
            
            detected_models.push(DetectedOllamaModel {
                id: name.clone(),
                name: format_model_display_name(&name, &parameter_size, size),
                size,
                modified_at,
                parameter_size,
                quantization_level,
                family,
                capabilities,
            });
        }
    }
    
    // Sort by intelligence (descending) then by speed (descending)
    detected_models.sort_by(|a, b| {
        let intel_cmp = b.capabilities.intelligence.cmp(&a.capabilities.intelligence);
        if intel_cmp == std::cmp::Ordering::Equal {
            b.capabilities.speed.cmp(&a.capabilities.speed)
        } else {
            intel_cmp
        }
    });
    
    log::info!("Detected {} Ollama models successfully", detected_models.len());
    Ok(detected_models)
}

/// Analyze model capabilities based on name, size, family and parameters
fn analyze_model_capabilities(name: &str, size: i64, family: &str, param_size: &str) -> ModelCapabilities {
    let name_lower = name.to_lowercase();
    let size_gb = size as f64 / (1024.0 * 1024.0 * 1024.0);
    
    // Extract parameter count for analysis
    let param_billions = extract_param_count(param_size);
    
    // Base capabilities
    let mut capabilities = ModelCapabilities {
        intelligence: 70,
        speed: 80,
        coding_excellence: 70,
        analysis_depth: 70,
        creative_writing: 70,
        technical_precision: 70,
        supports_vision: false,
        context_window: 4096,
    };
    
    // Model family-based adjustments
    match family {
        "llama" => {
            capabilities.intelligence += 10;
            capabilities.analysis_depth += 10;
            capabilities.context_window = 131072; // 128K for most Llama models
        },
        "gemma" | "gemma3" => {
            capabilities.technical_precision += 15;
            capabilities.coding_excellence += 10;
            capabilities.intelligence += 8;
        },
        "qwen" | "qwen2" | "qwen3" | "qwen3moe" => {
            capabilities.creative_writing += 15;
            capabilities.intelligence += 12;
            capabilities.analysis_depth += 8;
            capabilities.context_window = 32768;
        },
        "phi2" | "phi3" => {
            capabilities.speed += 15;
            capabilities.technical_precision += 12;
            capabilities.coding_excellence += 10;
            capabilities.context_window = 131072;
        },
        "deepseek" | "deepseek2" => {
            capabilities.coding_excellence += 18;
            capabilities.technical_precision += 15;
            capabilities.analysis_depth += 12;
        },
        "gptoss" => {
            capabilities.intelligence += 20;
            capabilities.analysis_depth += 18;
            capabilities.coding_excellence += 15;
            capabilities.creative_writing += 12;
        },
        _ => {}
    }
    
    // Parameter size adjustments
    if param_billions >= 70.0 {
        capabilities.intelligence += 15;
        capabilities.analysis_depth += 15;
        capabilities.speed -= 25; // Large models are slower
        capabilities.coding_excellence += 12;
    } else if param_billions >= 30.0 {
        capabilities.intelligence += 12;
        capabilities.analysis_depth += 12;
        capabilities.speed -= 15;
        capabilities.coding_excellence += 8;
    } else if param_billions >= 13.0 {
        capabilities.intelligence += 8;
        capabilities.analysis_depth += 8;
        capabilities.speed -= 8;
        capabilities.coding_excellence += 5;
    } else if param_billions <= 3.0 {
        capabilities.speed += 15; // Small models are faster
        capabilities.intelligence -= 5;
    }
    
    // Name-based adjustments
    if name_lower.contains("code") {
        capabilities.coding_excellence += 20;
        capabilities.technical_precision += 15;
        capabilities.creative_writing -= 10;
    }
    
    if name_lower.contains("vision") || name_lower.contains("llava") {
        capabilities.supports_vision = true;
        capabilities.analysis_depth += 12;
        capabilities.speed -= 10; // Vision models are slower
    }
    
    if name_lower.contains("chat") || name_lower.contains("instruct") {
        capabilities.creative_writing += 8;
        capabilities.analysis_depth += 5;
    }
    
    // Quantization and size adjustments
    if size_gb > 50.0 {
        capabilities.intelligence += 10;
        capabilities.speed -= 20;
    } else if size_gb < 5.0 {
        capabilities.speed += 10;
        capabilities.intelligence -= 5;
    }
    
    // Ensure values are within bounds
    capabilities.intelligence = capabilities.intelligence.min(100).max(50);
    capabilities.speed = capabilities.speed.min(100).max(30);
    capabilities.coding_excellence = capabilities.coding_excellence.min(100).max(40);
    capabilities.analysis_depth = capabilities.analysis_depth.min(100).max(40);
    capabilities.creative_writing = capabilities.creative_writing.min(100).max(40);
    capabilities.technical_precision = capabilities.technical_precision.min(100).max(40);
    
    capabilities
}

/// Extract parameter count in billions from parameter size string
fn extract_param_count(param_size: &str) -> f64 {
    let param_lower = param_size.to_lowercase();
    
    // Extract number from strings like "70.6B", "8.0B", "3.2B", etc.
    if let Some(b_pos) = param_lower.find('b') {
        let num_str = &param_lower[..b_pos];
        if let Ok(num) = num_str.parse::<f64>() {
            return num;
        }
    }
    
    // Extract from strings like "7B", "13B", "70B"
    if param_lower.ends_with('b') && param_lower.len() > 1 {
        let num_str = &param_lower[..param_lower.len() - 1];
        if let Ok(num) = num_str.parse::<f64>() {
            return num;
        }
    }
    
    // Default fallback based on common patterns
    if param_lower.contains("70") {
        70.0
    } else if param_lower.contains("30") {
        30.0
    } else if param_lower.contains("13") {
        13.0
    } else if param_lower.contains("7") || param_lower.contains("8") {
        7.5
    } else if param_lower.contains("3") {
        3.0
    } else {
        7.0 // Default assumption
    }
}

/// Format display name for model
fn format_model_display_name(model_id: &str, param_size: &str, size: i64) -> String {
    let size_gb = (size as f64 / (1024.0 * 1024.0 * 1024.0)) as u32;
    
    // Clean up model name
    let clean_name = model_id
        .replace(":latest", "")
        .replace(":", " ");
    
    // Capitalize first letter of each word
    let formatted_name = clean_name
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().chain(chars).collect(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    
    // Add emoji and size info
    let emoji = if model_id.contains("vision") || model_id.contains("llava") {
        "🏠👁️"
    } else if model_id.contains("code") {
        "🏠💻"
    } else if size_gb > 50 {
        "🏠🔥🚀"
    } else if size_gb > 20 {
        "🏠🔥"
    } else if size_gb < 5 {
        "🏠⚡"
    } else {
        "🏠"
    };
    
    if param_size != "unknown" {
        format!("{} {} {} ({}GB)", formatted_name, param_size, emoji, size_gb)
    } else {
        format!("{} {} ({}GB)", formatted_name, emoji, size_gb)
    }
}

/// Check if a specific Ollama model exists
#[command]
pub async fn check_ollama_model_exists(model_id: String) -> Result<bool, String> {
    log::info!("Checking if Ollama model exists: {}", model_id);
    
    let models = detect_available_ollama_models().await?;
    let exists = models.iter().any(|m| m.id == model_id);
    
    log::info!("Model {} exists: {}", model_id, exists);
    Ok(exists)
}

/// Get recommended models based on use case
#[command]
pub async fn get_recommended_ollama_models(use_case: String) -> Result<Vec<DetectedOllamaModel>, String> {
    log::info!("Getting recommended Ollama models for use case: {}", use_case);
    
    let all_models = detect_available_ollama_models().await?;
    
    let recommended = match use_case.as_str() {
        "coding" => {
            all_models.into_iter()
                .filter(|m| m.capabilities.coding_excellence >= 85)
                .collect()
        },
        "analysis" => {
            all_models.into_iter()
                .filter(|m| m.capabilities.analysis_depth >= 85)
                .collect()
        },
        "creative" => {
            all_models.into_iter()
                .filter(|m| m.capabilities.creative_writing >= 85)
                .collect()
        },
        "fast" => {
            all_models.into_iter()
                .filter(|m| m.capabilities.speed >= 90)
                .collect()
        },
        "vision" => {
            all_models.into_iter()
                .filter(|m| m.capabilities.supports_vision)
                .collect()
        },
        "balanced" => {
            all_models.into_iter()
                .filter(|m| {
                    m.capabilities.intelligence >= 80 && 
                    m.capabilities.speed >= 80 &&
                    m.capabilities.coding_excellence >= 75
                })
                .collect()
        },
        _ => all_models // Return all models for unknown use cases
    };
    
    log::info!("Found {} recommended models for {}", recommended.len(), use_case);
    Ok(recommended)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_param_count() {
        assert_eq!(extract_param_count("70.6B"), 70.6);
        assert_eq!(extract_param_count("8.0B"), 8.0);
        assert_eq!(extract_param_count("3.2B"), 3.2);
        assert_eq!(extract_param_count("7B"), 7.0);
        assert_eq!(extract_param_count("13B"), 13.0);
        assert_eq!(extract_param_count("unknown"), 7.0);
    }

    #[test]
    fn test_format_model_display_name() {
        let name = format_model_display_name("llama3.1:8b", "8.0B", 4920753328);
        assert!(name.contains("Llama3.1"));
        assert!(name.contains("8.0B"));
        assert!(name.contains("🏠"));
    }

    #[test]
    fn test_analyze_model_capabilities() {
        let caps = analyze_model_capabilities("codellama:latest", 3825910662, "llama", "7B");
        assert!(caps.coding_excellence > 80);
        assert!(caps.technical_precision > 80);
        
        let caps_vision = analyze_model_capabilities("llama3.2-vision:latest", 7901829417, "mllama", "9.8B");
        assert!(caps_vision.supports_vision);
        assert!(caps_vision.analysis_depth > 80);
    }
}