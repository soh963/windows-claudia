'''# PRD: Gemini CLI Agent Integration for Claudia

- **Project**: Gemini CLI as a Core Agent in Claudia
- **Version**: 1.0
- **Date**: 2025-08-01
- **Author**: Gemini Assistant (based on SuperClaude Framework)

---

## 1. Overview

### 1.1. Goal
To integrate the Google Gemini CLI as a first-class, executable agent within the Claudia ecosystem. This will allow users and other agents to leverage Gemini's capabilities directly from the Claudia interface, receiving real-time feedback and results within the existing UI.

### 1.2. Background
Claudia has a robust agent-based architecture (`cc_agents`) and a powerful command execution system. Currently, it supports Claude-based agents and slash commands. Integrating Gemini CLI as a new type of agent will create a multi-AI backend, providing users with greater flexibility and power without altering the familiar Claudia user experience. This integration focuses on a command-line execution model rather than a separate chat tab.

### 1.3. Success Metrics
- **Functional**: Gemini CLI commands can be successfully executed from Claudia's input, with results displayed in real-time.
- **Performance**: The overhead of launching the Gemini CLI agent is less than 500ms.
- **User Experience**: The process is seamless and integrated into the existing chat/command flow.
- **Stability**: The integration does not interfere with any existing Claudia functionality (Zero Breaking Changes).

---

## 2. System Architecture & Data Flow

The integration will leverage Claudia's existing Tauri backend to manage and execute the Gemini CLI as a sandboxed child process.

### 2.1. Architecture Diagram
```
┌─────────────────────────────────────────────┐
│                  Claudia UI                 │
│  (Input Bar: /gemini "analyze this code...")│
└──────────────────────┬──────────────────────┘
                       │ Tauri IPC
┌──────────────────────▼──────────────────────┐
│             Tauri Backend (Rust)            │
│ ┌─────────────────────────────────────────┐ │
│ │          Agent Execution Service        │ │
│ │ 1. Parse command: /gemini               │ │
│ │ 2. Load `gemini-cli-agent.claudia.json` │ │
│ │ 3. Construct CLI command string         │ │
│ │ 4. Spawn Gemini CLI process             │ │
│ │ 5. Stream stdout/stderr back to UI      │ │
│ └─────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────┘
                       │ Spawns Child Process
                       │
┌──────────────────────▼──────────────────────┐
│                Gemini CLI                   │
│ (e.g., gemini.exe --key "..." "analyze...") │
└──────────────────────┬──────────────────────┘
                       │ Google Cloud API
┌──────────────────────▼──────────────────────┐
│                 Google AI Platform          │
└─────────────────────────────────────────────┘
```

### 2.2. Data Flow
1.  **User Input**: User types a command like `/gemini "Summarize this file: @file.txt"` in the Claudia chat interface.
2.  **IPC to Backend**: The UI sends the command to the Rust backend via Tauri's IPC bridge.
3.  **Agent Dispatch**: The backend's `AgentExecutionService` identifies the `/gemini` command and loads the corresponding agent configuration.
4.  **Command Construction**: The service replaces placeholders (like `@file.txt` with its content) and builds the full shell command to execute the Gemini CLI.
5.  **Process Execution**: The backend spawns the Gemini CLI as a non-blocking child process, capturing its `stdout` and `stderr` streams.
6.  **Real-time Feedback**: The captured output is streamed back to the UI in real-time and displayed within a dedicated widget.
7.  **Completion**: Once the process exits, a final status (success/error, exit code) is sent to the UI.

---

## 3. Core Requirements

### 3.1. Functional Requirements

#### 3.1.1. Authentication
-   **Secure Key Storage**: The Gemini API key must be stored securely using Claudia's existing configuration secrets management. A new entry for `gemini_api_key` will be added.
-   **First-Time Setup**: On the first use of the `/gemini` agent, if the key is not found, the UI must prompt the user to enter it in the Settings panel.
-   **Command-line Injection**: The stored API key will be passed to the Gemini CLI via a command-line argument (`--api-key`) or environment variable during execution. It must never be logged or stored in plain text.

#### 3.1.2. Agent Registration
-   A new agent configuration file will be created at `cc_agents/gemini-cli-agent.claudia.json`.
-   This file will define the agent's properties, including the command to invoke it.

**`gemini-cli-agent.claudia.json` Schema:**
```json
{
  "name": "gemini",
  "description": "Executes prompts using the Google Gemini CLI for powerful generative AI tasks.",
  "version": "1.0",
  "author": "Claudia Core Team",
  "type": "executable",
  "executable_config": {
    "path": "gemini", // Assumes gemini is in the system PATH. Can be an absolute path.
    "arguments": [
      "--api-key",
      "$GEMINI_API_KEY", // Placeholder for the key
      "$PROMPT" // Placeholder for the user's prompt
    ],
    "streaming_output": true
  },
  "ui": {
    "icon": "Sparkles", // Icon from lucide-react
    "widget": "GeminiAgentWidget"
  }
}
```

#### 3.1.3. Execution & Feedback
-   **Process Management**: The Rust backend must manage the lifecycle of the Gemini CLI process, including graceful termination.
-   **Input Handling**: The agent must support passing large text blocks and file content via standard input (`stdin`) to the CLI to avoid command length limits.
-   **Output Parsing**: The backend will not parse the Gemini CLI's output. It will be treated as raw text and displayed in the UI. This simplifies the initial implementation.
-   **Error Handling**: `stderr` from the CLI must be clearly distinguished from `stdout` in the UI, likely with a different color or icon.

### 3.2. UI/UX Requirements
-   **Command Invocation**: The Gemini agent is invoked via a slash command: `/gemini "your prompt here"`.
-   **Real-time Output Widget**: A new React component, `GeminiAgentWidget`, will be created to display the execution. This widget should be similar to the existing `BashWidget` or `CommandOutputWidget`.
-   **Widget Features**:
    -   Display the command being executed.
    -   Show a "Running..." or streaming indicator.
    -   Display `stdout` and `stderr` in a formatted, monospaced block.
    -   Show the final exit code and status (e.g., "Completed successfully" or "Failed with exit code 1").
-   **Settings Integration**: A new section under `Settings > Agents` will allow users to configure the path to the Gemini CLI executable and manage their API key.

---

## 4. Implementation Plan

### Phase 1: Backend & Core Logic (4 days)
-   **Task 1 (Rust)**: Extend `AgentExecutionService` to handle agents of `type: "executable"`.
-   **Task 2 (Rust)**: Implement the logic to spawn a child process based on `executable_config`, inject the API key, and handle `stdin`.
-   **Task 3 (Rust)**: Implement the real-time streaming of `stdout` and `stderr` back to the frontend via the Tauri event system.
-   **Task 4 (Config)**: Create the initial `gemini-cli-agent.claudia.json` file.

### Phase 2: Frontend & UI (3 days)
-   **Task 1 (React)**: Create the `GeminiAgentWidget` component in `src/components/ToolWidgets.tsx` to render the execution status and output.
-   **Task 2 (React)**: Integrate the widget into `StreamMessage.tsx` so it's displayed when the `gemini` agent is used.
-   **Task 3 (React)**: Implement the API key input prompt and the settings UI for configuring the Gemini agent.

### Phase 3: Integration & Testing (2 days)
-   **Task 1 (E2E)**: Write end-to-end tests covering successful execution, error handling, and file input.
-   **Task 2 (QA)**: Manual testing across Windows, focusing on edge cases (no API key, invalid command, large outputs).
-   **Task 3 (Docs)**: Update user documentation to explain how to set up and use the new Gemini agent.

---

## 5. Risks & Mitigation

| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Gemini CLI not in PATH** | High | Medium | Provide a setting in the UI for users to specify the absolute path to the executable. On first run, guide the user to this setting. |
| **Authentication Failures** | Medium | High | The UI must display clear, actionable error messages from the CLI (e.g., "Invalid API Key"). |
| **CLI Breaking Changes** | Low | High | Pin the integration to a specific version of the Gemini CLI. The agent config can include a `version` field for future compatibility checks. |
| **Process Hangs** | Medium | Medium | Implement a configurable timeout in the Rust backend to kill the process if it doesn't complete within a reasonable time. |

---
'''