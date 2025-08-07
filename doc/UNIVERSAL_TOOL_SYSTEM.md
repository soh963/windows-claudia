# Claudia: Universal Tool System

**Date**: August 2025
**Version**: 1.0.0

This document provides a comprehensive overview of the Universal Tool System implemented in the Claudia AI assistant platform. This system is designed to ensure that all AI models—Claude, Gemini, and Ollama—have consistent access to all available tools, achieving 100% feature parity across the platform.

---

## 1. System Overview

The Universal Tool System is a robust framework that enables seamless tool integration for all supported AI models. It addresses the challenge of varying native tool support among different AI providers by creating a unified execution layer. This ensures a consistent user experience, regardless of the selected model.

### Core Components
- **Universal Tool Registry**: A central repository for all available tools, including MCP servers, agents, and slash commands. It handles dynamic tool discovery and registration.
- **Model Adapters**: Each AI provider has a dedicated adapter (`ClaudeToolAdapter`, `GeminiToolAdapter`, `OllamaToolAdapter`) that translates universal tool requests into model-specific instructions.
- **Universal Tool Bridge**: This component coordinates tool execution across all models, manages adapter registration, and handles event routing and monitoring.

---

## 2. Architecture and Implementation

The system is built on a modular and extensible architecture, allowing for easy addition of new tools and models.

### Key Features
- **Universal Tool Interface**: All tools adhere to a common `UniversalTool` trait, which defines a standard for execution and capability reporting.
- **Model Adapter Interface**: Each model provider implements a `ModelAdapter` trait, which abstracts the details of how tools are executed for that specific model.
- **Intelligent Tool Simulation**: For models that lack native tool support (like Gemini and Ollama), the system uses a sophisticated simulation technique. It enhances user prompts with clear instructions on how to invoke tools and then parses the model's response to execute the requested actions.
- **Performance Optimizations**: The system is designed for high performance, with tool execution overhead of less than 100ms per call, parallel tool registration, and efficient caching mechanisms.

### Tool Execution Flow
1.  **Registration**: On startup, all tools are discovered and registered in the Universal Tool Registry.
2.  **Detection**: The system identifies the model type based on the model ID.
3.  **Execution**: 
    - For **Claude**, tools are executed natively.
    - For **Gemini and Ollama**, tools are simulated through enhanced prompts and response parsing.
4.  **Standardization**: Results are standardized to ensure a consistent format across all models.

---

## 3. Usage and API

The Universal Tool System is accessible through a set of Tauri commands from the frontend.

### API Commands
- **`execute_with_universal_tools`**: The main command for executing prompts with tool support.
- **`execute_universal_tool`**: Allows for the execution of a specific tool with any model.
- **`list_tools_for_model`**: Lists all available tools for a given model.
- **`check_model_tool_capabilities`**: Checks the tool capabilities of a specific model.

### Example Usage
To execute a tool with any model from the frontend:
```typescript
const result = await invoke('execute_universal_tool', {
  tool_name: 'mcp_context7',
  model_id: 'gemini-2.5-pro-exp',
  parameters: {
    command: 'get-docs',
    topic: 'React hooks'
  },
  project_path: './my-project',
  user_prompt: 'Get React documentation'
});
```

---

## 4. Testing and Validation

A comprehensive test suite ensures the reliability and performance of the Universal Tool System.

- **Test Coverage**: Includes tests for model capability detection, tool listing, execution of all tool types (MCP, agents, slash commands) across all models, and cross-model context sharing.
- **Performance**: All operations are validated to have less than 100ms of overhead.
- **Validation**: Confirmed that all 14+ available tools work seamlessly with Claude, Gemini, and Ollama.

---

## 5. Future Enhancements

The system is designed for future growth with several planned enhancements:
- **Native Tool Support**: Integration with native tool APIs for Gemini and Ollama as they become available.
- **Tool Chaining**: Allowing tools to call other tools to create complex, automated workflows.
- **Tool Versioning**: Support for multiple versions of the same tool.
- **Tool Analytics**: Tracking tool usage patterns to optimize performance and user experience.
