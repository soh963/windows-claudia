pub mod claude_adapter;
pub mod gemini_adapter;
pub mod ollama_adapter;
pub mod tool_bridge;

pub use claude_adapter::ClaudeToolAdapter;
pub use gemini_adapter::GeminiToolAdapter;
pub use ollama_adapter::OllamaToolAdapter;
pub use tool_bridge::UniversalToolBridge;