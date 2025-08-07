use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

use super::agents::AgentDb;
use super::cross_model_memory::{MemoryEntry, MemoryPriority, MemoryType};

/// Model-specific context requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelContextRequirements {
    pub model_name: String,
    pub max_tokens: i32,
    pub supports_system_prompt: bool,
    pub supports_tools: bool,
    pub supports_images: bool,
    pub context_window: i32,
    pub preferred_format: ContextFormat,
}

/// Context format preferences for different models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextFormat {
    Markdown,
    PlainText,
    Structured,
    JSON,
}

/// Context transfer result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextTransferResult {
    pub session_id: String,
    pub source_model: String,
    pub target_model: String,
    pub transferred_memories: Vec<MemoryEntry>,
    pub total_tokens: i32,
    pub compression_applied: bool,
    pub transfer_time_ms: i64,
    pub success: bool,
    pub message: String,
}

/// Context similarity score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSimilarity {
    pub session_id_1: String,
    pub session_id_2: String,
    pub similarity_score: f32,
    pub shared_topics: Vec<String>,
    pub common_tools: Vec<String>,
}

/// Get model-specific context requirements
pub fn get_model_requirements(model: &str) -> ModelContextRequirements {
    match model {
        // Claude models
        "opus-4.1" | "claude-3-opus" => ModelContextRequirements {
            model_name: model.to_string(),
            max_tokens: 200000,
            supports_system_prompt: true,
            supports_tools: true,
            supports_images: true,
            context_window: 200000,
            preferred_format: ContextFormat::Markdown,
        },
        "sonnet-4" | "sonnet-3.7" | "claude-3.5-sonnet" => ModelContextRequirements {
            model_name: model.to_string(),
            max_tokens: 200000,
            supports_system_prompt: true,
            supports_tools: true,
            supports_images: true,
            context_window: 200000,
            preferred_format: ContextFormat::Markdown,
        },
        
        // Gemini models
        "gemini-2.5-pro-exp" | "gemini-2.0-pro-exp" => ModelContextRequirements {
            model_name: model.to_string(),
            max_tokens: 2000000,
            supports_system_prompt: true,
            supports_tools: true,
            supports_images: true,
            context_window: 2000000,
            preferred_format: ContextFormat::Structured,
        },
        "gemini-2.5-flash" | "gemini-2.0-flash" => ModelContextRequirements {
            model_name: model.to_string(),
            max_tokens: 1000000,
            supports_system_prompt: true,
            supports_tools: true,
            supports_images: true,
            context_window: 1000000,
            preferred_format: ContextFormat::Structured,
        },
        
        // Ollama models (generic defaults)
        model if model.starts_with("ollama:") => ModelContextRequirements {
            model_name: model.to_string(),
            max_tokens: 8192,
            supports_system_prompt: true,
            supports_tools: false,
            supports_images: false,
            context_window: 8192,
            preferred_format: ContextFormat::PlainText,
        },
        
        // Default for unknown models
        _ => ModelContextRequirements {
            model_name: model.to_string(),
            max_tokens: 32768,
            supports_system_prompt: true,
            supports_tools: false,
            supports_images: false,
            context_window: 32768,
            preferred_format: ContextFormat::PlainText,
        },
    }
}

/// Transfer context between models with intelligent filtering
#[tauri::command]
pub async fn transfer_context_to_model(
    db: State<'_, AgentDb>,
    session_id: String,
    source_model: String,
    target_model: String,
) -> Result<ContextTransferResult, String> {
    let start_time = std::time::Instant::now();
    
    // Get model requirements
    let target_requirements = get_model_requirements(&target_model);
    
    // Retrieve memories from source
    let memories = super::cross_model_memory::retrieve_memory_for_model(
        db.clone(),
        session_id.clone(),
        source_model.clone(),
        Some(target_requirements.max_tokens),
    ).await?;
    
    // Filter memories based on target model capabilities
    let mut filtered_memories = Vec::new();
    let mut total_tokens = 0;
    
    for memory in memories {
        // Skip tool usage if target doesn't support tools
        if !target_requirements.supports_tools && memory.memory_type == MemoryType::ToolUsage {
            continue;
        }
        
        // Skip system prompts if not supported
        if !target_requirements.supports_system_prompt && memory.memory_type == MemoryType::SystemPrompt {
            continue;
        }
        
        // Check token limits
        if total_tokens + memory.token_count > target_requirements.max_tokens {
            break;
        }
        
        // Apply format conversion if needed
        let formatted_memory = format_memory_for_model(&memory, &target_requirements.preferred_format);
        
        total_tokens += formatted_memory.token_count;
        filtered_memories.push(formatted_memory);
    }
    
    // Check if compression is needed
    let compression_applied = total_tokens > target_requirements.context_window / 2;
    
    if compression_applied {
        // Apply intelligent compression
        filtered_memories = compress_memories(filtered_memories, target_requirements.context_window);
        total_tokens = filtered_memories.iter().map(|m| m.token_count).sum();
    }
    
    let transfer_time_ms = start_time.elapsed().as_millis() as i64;
    
    Ok(ContextTransferResult {
        session_id,
        source_model,
        target_model,
        transferred_memories: filtered_memories.clone(),
        total_tokens,
        compression_applied,
        transfer_time_ms,
        success: true,
        message: format!("Successfully transferred {} memories with {} tokens", 
                        filtered_memories.len(), total_tokens),
    })
}

/// Format memory entry for specific model
fn format_memory_for_model(memory: &MemoryEntry, format: &ContextFormat) -> MemoryEntry {
    let mut formatted = memory.clone();
    
    match format {
        ContextFormat::Markdown => {
            // Already in markdown format for most cases
            if memory.memory_type == MemoryType::Conversation {
                formatted.content = format!("**{}**: {}", memory.model, memory.content);
            }
        },
        ContextFormat::PlainText => {
            // Strip markdown formatting
            formatted.content = strip_markdown(&memory.content);
        },
        ContextFormat::Structured => {
            // Add structure tags
            formatted.content = format!("[{}] {}", 
                format!("{:?}", memory.memory_type).to_uppercase(), 
                memory.content
            );
        },
        ContextFormat::JSON => {
            // Convert to JSON structure
            let json_content = serde_json::json!({
                "type": format!("{:?}", memory.memory_type),
                "priority": format!("{:?}", memory.priority),
                "content": memory.content,
                "metadata": memory.metadata,
            });
            formatted.content = json_content.to_string();
        },
    }
    
    // Recalculate token count after formatting
    formatted.token_count = super::cross_model_memory::estimate_token_count(&formatted.content);
    formatted
}

/// Strip markdown formatting from text
fn strip_markdown(text: &str) -> String {
    // Simple markdown stripping (can be enhanced)
    text.replace("**", "")
        .replace("*", "")
        .replace("#", "")
        .replace("`", "")
        .replace("[", "")
        .replace("]", "")
        .replace("(", "")
        .replace(")", "")
}

/// Compress memories to fit within token limit
fn compress_memories(memories: Vec<MemoryEntry>, max_tokens: i32) -> Vec<MemoryEntry> {
    let mut compressed = Vec::new();
    let mut current_tokens = 0;
    
    // First pass: Keep all critical memories
    for memory in &memories {
        if memory.priority == MemoryPriority::Critical {
            compressed.push(memory.clone());
            current_tokens += memory.token_count;
        }
    }
    
    // Second pass: Add high priority memories
    for memory in &memories {
        if current_tokens >= max_tokens {
            break;
        }
        if memory.priority == MemoryPriority::High {
            compressed.push(memory.clone());
            current_tokens += memory.token_count;
        }
    }
    
    // Third pass: Add medium priority memories with compression
    for memory in &memories {
        if current_tokens >= max_tokens {
            break;
        }
        if memory.priority == MemoryPriority::Medium {
            let mut compressed_memory = memory.clone();
            // Compress content by taking first 70%
            let content_len = compressed_memory.content.len();
            compressed_memory.content = compressed_memory.content.chars()
                .take(content_len * 7 / 10)
                .collect();
            compressed_memory.token_count = super::cross_model_memory::estimate_token_count(&compressed_memory.content);
            
            if current_tokens + compressed_memory.token_count <= max_tokens {
                compressed.push(compressed_memory.clone());
                current_tokens += compressed_memory.token_count;
            }
        }
    }
    
    compressed
}

/// Calculate similarity between two session contexts
#[tauri::command]
pub async fn calculate_context_similarity(
    db: State<'_, AgentDb>,
    session_id_1: String,
    session_id_2: String,
) -> Result<ContextSimilarity, String> {
    // Retrieve memories for both sessions
    let memories_1 = super::cross_model_memory::retrieve_memory_for_model(
        db.clone(),
        session_id_1.clone(),
        String::new(),
        Some(10000),
    ).await?;
    
    let memories_2 = super::cross_model_memory::retrieve_memory_for_model(
        db.clone(),
        session_id_2.clone(),
        String::new(),
        Some(10000),
    ).await?;
    
    // Extract topics and tools
    let topics_1 = extract_topics(&memories_1);
    let topics_2 = extract_topics(&memories_2);
    
    let tools_1 = extract_tools(&memories_1);
    let tools_2 = extract_tools(&memories_2);
    
    // Calculate similarity
    let shared_topics: Vec<String> = topics_1.intersection(&topics_2)
        .cloned()
        .collect();
    
    let common_tools: Vec<String> = tools_1.intersection(&tools_2)
        .cloned()
        .collect();
    
    let topic_similarity = if topics_1.is_empty() || topics_2.is_empty() {
        0.0
    } else {
        shared_topics.len() as f32 / (topics_1.len().max(topics_2.len()) as f32)
    };
    
    let tool_similarity = if tools_1.is_empty() || tools_2.is_empty() {
        0.0
    } else {
        common_tools.len() as f32 / (tools_1.len().max(tools_2.len()) as f32)
    };
    
    let similarity_score = (topic_similarity * 0.7 + tool_similarity * 0.3).min(1.0);
    
    Ok(ContextSimilarity {
        session_id_1,
        session_id_2,
        similarity_score,
        shared_topics,
        common_tools,
    })
}

/// Extract topics from memories
fn extract_topics(memories: &[MemoryEntry]) -> std::collections::HashSet<String> {
    let mut topics = std::collections::HashSet::new();
    
    for memory in memories {
        // Extract keywords (simplified version)
        let words: Vec<String> = memory.content
            .split_whitespace()
            .filter(|w| w.len() > 5)
            .take(10)
            .map(|w| w.to_lowercase())
            .collect();
        
        for word in words {
            topics.insert(word);
        }
        
        // Add metadata topics
        if let Some(topic) = memory.metadata.get("topic") {
            topics.insert(topic.clone());
        }
    }
    
    topics
}

/// Extract tools from memories
fn extract_tools(memories: &[MemoryEntry]) -> std::collections::HashSet<String> {
    let mut tools = std::collections::HashSet::new();
    
    for memory in memories {
        if memory.memory_type == MemoryType::ToolUsage {
            if let Some(tool_name) = memory.metadata.get("tool_name") {
                tools.insert(tool_name.clone());
            }
        }
    }
    
    tools
}

/// Get recommended model based on context
#[tauri::command]
pub async fn recommend_model_for_context(
    db: State<'_, AgentDb>,
    session_id: String,
) -> Result<String, String> {
    // Retrieve current context
    let memories = super::cross_model_memory::retrieve_memory_for_model(
        db.clone(),
        session_id.clone(),
        String::new(),
        Some(1000),
    ).await?;
    
    let mut needs_tools = false;
    let mut needs_long_context = false;
    let mut needs_images = false;
    let mut total_tokens = 0;
    
    for memory in &memories {
        total_tokens += memory.token_count;
        
        match memory.memory_type {
            MemoryType::ToolUsage => needs_tools = true,
            _ => {}
        }
        
        if memory.metadata.contains_key("has_images") {
            needs_images = true;
        }
    }
    
    needs_long_context = total_tokens > 100000;
    
    // Recommend based on requirements
    let recommended_model = if needs_long_context {
        "gemini-2.5-pro-exp" // Largest context window
    } else if needs_tools && needs_images {
        "opus-4.1" // Best for complex tasks with tools and images
    } else if needs_tools {
        "sonnet-4" // Good balance for tool usage
    } else {
        "gemini-2.5-flash" // Fast and efficient for simple tasks
    };
    
    Ok(recommended_model.to_string())
}

/// Preview context transfer
#[tauri::command]
pub async fn preview_context_transfer(
    db: State<'_, AgentDb>,
    session_id: String,
    source_model: String,
    target_model: String,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let target_requirements = get_model_requirements(&target_model);
    
    // Get current memories
    let memories = super::cross_model_memory::retrieve_memory_for_model(
        db.clone(),
        session_id.clone(),
        source_model.clone(),
        Some(target_requirements.max_tokens),
    ).await?;
    
    let total_memories = memories.len();
    let total_tokens: i32 = memories.iter().map(|m| m.token_count).sum();
    
    // Count by type
    let mut type_counts = HashMap::new();
    for memory in &memories {
        let type_name = format!("{:?}", memory.memory_type);
        *type_counts.entry(type_name).or_insert(0) += 1;
    }
    
    // Count by priority
    let mut priority_counts = HashMap::new();
    for memory in &memories {
        let priority_name = format!("{:?}", memory.priority);
        *priority_counts.entry(priority_name).or_insert(0) += 1;
    }
    
    let mut preview = HashMap::new();
    preview.insert("total_memories".to_string(), serde_json::json!(total_memories));
    preview.insert("total_tokens".to_string(), serde_json::json!(total_tokens));
    preview.insert("target_max_tokens".to_string(), serde_json::json!(target_requirements.max_tokens));
    preview.insert("will_compress".to_string(), serde_json::json!(total_tokens > target_requirements.context_window / 2));
    preview.insert("type_distribution".to_string(), serde_json::json!(type_counts));
    preview.insert("priority_distribution".to_string(), serde_json::json!(priority_counts));
    preview.insert("supports_tools".to_string(), serde_json::json!(target_requirements.supports_tools));
    preview.insert("supports_images".to_string(), serde_json::json!(target_requirements.supports_images));
    
    Ok(preview)
}