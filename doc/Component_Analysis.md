# Component Analysis Report

This document details the analysis of the React components found in the `src/components` directory of the Claudia project. The goal is to understand the overall structure and functionality of the application's frontend.

## Directory Overview

The `src/components` directory contains a large number of individual component files and several subdirectories, indicating a modular and organized structure.

### Subdirectories:

- `claude-code-session`: Likely contains components related to Claude Code session management.
- `dashboard`: Expected to house components for the application's dashboard or reporting features.
- `ui`: Probably a collection of reusable UI primitives or design system components.
- `widgets`: May contain smaller, self-contained UI widgets.

## Component Categorization and Analysis Plan

To better understand the application, the components will be categorized based on their apparent functionality. Key components from each category will then be analyzed in more detail.

### Categories:

1.  **Agent & Execution Management:** Components related to managing AI agents, their execution, and output.
2.  **Claude Code Integration:** Components specifically interacting with the Claude Code CLI or its features.
3.  **User Interface (UI) & Layout:** General UI elements, layout components, and common patterns.
4.  **Settings & Configuration:** Components for managing application settings and user preferences.
5.  **Data Display & Visualization:** Components responsible for presenting data, possibly in charts or tables.
6.  **Utility & Miscellaneous:** General-purpose components or those that don't fit neatly into other categories.


## Detailed Component Analysis

### 1. Agent & Execution Management

#### `AgentExecution.tsx`

-   **Purpose:** This is a central component for running Claude Code agents. It provides the user interface for configuring, initiating, monitoring, and stopping agent executions. It displays real-time output from the agent and manages execution-related settings and statistics.

-   **Key Props:**
    -   `agent: Agent`: The specific agent object to be executed, including its ID, name, default task, and model.
    -   `onBack: () => void`: A callback function to navigate back to the list of agents.
    -   `className?: string`: Optional CSS classes for styling.

-   **Key State Variables:**
    -   `projectPath`: The file system path where the agent's operations will be performed.
    -   `task`: The specific instruction or goal given to the agent.
    -   `model`: The Claude model version to be used (e.g., "sonnet", "opus").
    -   `isRunning`: A boolean flag indicating whether an agent execution is currently in progress.
    -   `messages`: An array of `ClaudeStreamMessage` objects, representing the streamed output from the agent in real-time.
    -   `rawJsonlOutput`: Stores the raw JSONL output for copying purposes.
    -   `error`: Holds any error messages that occur during execution.
    -   `isHooksDialogOpen`: Controls the visibility of the hooks configuration dialog.
    -   `totalTokens`, `elapsedTime`: Metrics related to the agent's execution (token usage, duration).
    -   `isFullscreenModalOpen`: Manages the visibility of a fullscreen modal for viewing agent output.
    -   `runId`: A unique identifier for the current agent execution session.

-   **Core Functionality & Logic:**
    -   **Agent Execution Control:** Handles starting (`handleExecute`) and stopping (`handleStop`) agent runs. It interacts with the backend API (`api.executeAgent`, `api.killAgentSession`) to manage the agent's lifecycle.
    -   **Real-time Output:** Listens to Tauri events (`agent-output`, `agent-error`, `agent-complete`, `agent-cancelled`) to receive and display live updates from the running agent. Messages are rendered using the `StreamMessage` component.
    -   **UI Configuration:** Provides input fields for `projectPath` (with a file picker using `@tauri-apps/plugin-dialog`), `task`, and radio buttons for `model` selection.
    -   **Performance Optimization:** Utilizes `@tanstack/react-virtual` (`useVirtualizer`) for efficient rendering of long lists of messages, ensuring smooth scrolling performance.
    -   **Hooks Integration:** Includes a `HooksEditor` component within a dialog, allowing users to define and manage pre- and post-execution scripts (hooks) for the agent.
    -   **Output Export:** Offers functionality to copy the agent's output in JSONL or Markdown format to the clipboard.
    -   **User Experience:** Implements auto-scrolling to the latest messages, a confirmation dialog when navigating away during an active run, and a fullscreen view for the output.

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`, `useRef`, `useMemo` for state management and lifecycle.
    -   **UI Libraries:** `@/components/ui/button`, `@/components/ui/input`, `@/components/ui/label`, `@/components/ui/dialog`, `@/components/ui/tabs`, `@/components/ui/popover` (likely custom components built on Radix UI).
    -   **Icons:** `lucide-react` for various UI icons.
    -   **Animation:** `framer-motion` for smooth UI transitions.
    -   **Tauri:** `@tauri-apps/api` (`listen`) for event handling and `@tauri-apps/plugin-dialog` (`open`) for file system interaction.
    -   **Internal API:** `api` from `@/lib/api` for backend communication.
    -   **Utilities:** `cn` from `@/lib/utils` for conditional class names.
    -   **Child Components:** `StreamMessage`, `ExecutionControlBar`, `ErrorBoundary`, `HooksEditor`, `CCAgents` (for agent icons).

#### `AgentRunOutputViewer.tsx`

-   **Purpose:** This component is designed to display the historical output of a specific agent run. Unlike `AgentExecution.tsx` which focuses on live execution, this component retrieves and renders previously recorded agent output, making it suitable for reviewing past runs.

-   **Key Props:**
    -   `agentRunId: string`: The unique identifier of the agent run whose output is to be displayed.
    -   `tabId: string`: An identifier for the current tab, used for updating tab titles and statuses.
    -   `className?: string`: Optional CSS classes for styling.

-   **Key State Variables:**
    -   `run`: An `AgentRunWithMetrics` object containing details and metrics of the agent run.
    -   `messages`: An array of `ClaudeStreamMessage` objects representing the parsed output from the agent.
    -   `rawJsonlOutput`: Stores the raw JSONL output lines, primarily for copy functionality.
    -   `loading`: A boolean indicating if the output is currently being loaded.
    -   `isFullscreen`: Controls whether the output viewer is in fullscreen mode.
    -   `refreshing`: Indicates if the output is being refreshed.
    -   `toast`: Manages toast notifications for user feedback (e.g., copy success, error).
    -   `hasUserScrolled`: Tracks if the user has manually scrolled the output area.

-   **Core Functionality & Logic:**
    -   **Data Loading:** Fetches agent run details (`api.getAgentRun`) and its output (`api.getSessionOutput` or `api.loadAgentSessionHistory`) based on `agentRunId`. It attempts to load from a cached output first (`useOutputCache`) for faster display.
    -   **Live Event Listening (for running sessions):** If the `run.status` is `running`, it sets up Tauri event listeners (`agent-output`, `agent-error`, `agent-complete`, `agent-cancelled`) to stream real-time updates, similar to `AgentExecution.tsx`. It also attempts to `api.streamSessionOutput` to ensure continuous streaming.
    -   **Output Display:** Renders the `messages` using the `StreamMessage` component, providing a formatted view of the agent's interaction.
    -   **UI Controls:** Includes buttons for toggling fullscreen, refreshing the output, and copying the output as JSONL or Markdown.
    -   **Metrics Display:** Shows key metrics of the agent run such as duration, total tokens, and cost.
    -   **Tab Integration:** Uses `useTabState` hook to update the title and status of the associated tab.
    -   **Auto-scrolling:** Implements logic to automatically scroll to the bottom of the output, with an override if the user manually scrolls.

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`, `useRef`, `useMemo`.
    -   **UI Libraries:** `@/components/ui/button`, `@/components/ui/card`, `@/components/ui/badge`, `@/components/ui/toast`, `@/components/ui/popover`.
    -   **Icons:** `lucide-react`.
    -   **Animation:** `framer-motion`.
    -   **Tauri:** `@tauri-apps/api` (`listen`).
    -   **Internal API:** `api` from `@/lib/api` for backend communication.
    -   **Utilities:** `useOutputCache` for caching, `formatISOTimestamp` for date formatting, `useTabState` for tab management.
    -   **Child Components:** `StreamMessage`, `ErrorBoundary`, `CCAgents` (for agent icons).
    -   **Type Import:** `ClaudeStreamMessage` from `./AgentExecution`.

#### `AgentRunsList.tsx`

-   **Purpose:** This component displays a paginated list of past agent execution runs. It provides a summary of each run, including the agent's name, task, status, creation timestamp, duration, and token usage. Users can click on a run to view its detailed output.

-   **Key Props:**
    -   `runs: AgentRunWithMetrics[]`: An array of agent run objects, each containing metrics and details.
    -   `onRunClick?: (run: AgentRunWithMetrics) => void`: An optional callback function that is triggered when an agent run in the list is clicked. If not provided, it defaults to opening the run in a new tab.
    -   `className?: string`: Optional CSS classes for styling.

-   **Key State Variables:**
    -   `currentPage`: Manages the current page number for pagination.

-   **Core Functionality & Logic:**
    -   **Pagination:** Divides the list of `runs` into pages, with `ITEMS_PER_PAGE` (defaulting to 5) runs per page. It calculates the total number of pages and displays only the runs for the current page.
    -   **Run Display:** Renders each agent run as a `Card` component, showing the agent's icon, name, task, status (Running, Completed, Failed, Pending), creation time, duration, and token count.
    -   **Interactive Elements:** Each run card is clickable. When clicked, it either invokes the `onRunClick` callback (if provided) or uses `createAgentTab` from `useTabState` to open the run's detailed output in a new tab.
    -   **Visual Feedback:** Uses `framer-motion` for subtle animations on run cards (e.g., hover effects, entry/exit animations) and changes card styling based on the run's status (e.g., green border for running agents).
    -   **Empty State:** Displays a message and an icon when there is no execution history.

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`.
    -   **UI Libraries:** `@/components/ui/card`, `@/components/ui/badge`, `@/components/ui/pagination` (likely custom components).
    -   **Icons:** `lucide-react`.
    -   **Animation:** `framer-motion`.
    -   **Utilities:** `cn` for class names, `formatISOTimestamp` for date formatting, `AGENT_ICONS` for agent-specific icons.
    -   **Internal API:** `AgentRunWithMetrics` type from `@/lib/api`.
    -   **Hooks:** `useTabState` for managing application tabs.

#### `AgentRunView.tsx`

-   **Purpose:** This component provides a detailed, full-page view of a single agent execution. It displays comprehensive information about the run, including its metadata (agent name, task, model, status, metrics) and the complete stream of messages generated during the execution.

-   **Key Props:**
    -   `runId: number`: The ID of the specific agent run to be displayed.
    -   `onBack: () => void`: A callback function to navigate back to the previous view (e.g., the list of agent runs).
    -   `className?: string`: Optional CSS classes for styling.

-   **Key State Variables:**
    -   `run`: An `AgentRunWithMetrics` object containing all details of the agent run.
    -   `messages`: An array of `ClaudeStreamMessage` objects representing the parsed output of the run.
    -   `loading`: A boolean indicating if the run data is currently being loaded.
    -   `error`: Stores any error messages encountered during data loading.
    -   `copyPopoverOpen`: Controls the visibility of the copy output popover.

-   **Core Functionality & Logic:**
    -   **Data Loading:** Fetches the agent run details and its output using `api.getAgentRunWithRealTimeMetrics` and `api.loadAgentSessionHistory` (if a `session_id` is available). It includes a fallback mechanism to parse output directly from the `run.output` field if session history loading fails.
    -   **Output Display:** Renders the `messages` using the `StreamMessage` component, providing a structured and formatted view of the agent's interaction.
    -   **UI Controls:** Provides a back button (`ArrowLeft`), a stop button (if the run is still `running`), and a copy output feature (JSONL or Markdown format) via a popover.
    -   **Run Details Display:** Presents the agent's task, model, status, creation date, duration, total tokens, and estimated cost in a `Card` component.
    -   **Error and Loading States:** Displays loading spinners or error messages based on the `loading` and `error` state variables.

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`.
    -   **UI Libraries:** `@/components/ui/button`, `@/components/ui/badge`, `@/components/ui/card`, `@/components/ui/popover`.
    -   **Icons:** `lucide-react`.
    -   **Animation:** `framer-motion`.
    -   **Internal API:** `api` from `@/lib/api` for backend communication, `AgentRunWithMetrics` type.
    -   **Utilities:** `cn` for class names, `formatISOTimestamp` for date formatting.
    -   **Child Components:** `StreamMessage`, `CCAgents` (for agent icons), `ErrorBoundary`.
    -   **Type Import:** `ClaudeStreamMessage` from `./AgentExecution`.

### 2. Claude Code Integration

#### `ClaudeCodeSession.tsx`

-   **Purpose:** This is the primary component for managing interactive Claude Code CLI sessions. It allows users to send prompts, view real-time streamed responses, manage session history (checkpoints), fork sessions, and configure project-specific settings like hooks and slash commands. It aims to provide a rich, integrated development environment experience within the application.

-   **Key Props:**
    -   `session?: Session`: An optional `Session` object to resume a previously existing session.
    -   `initialProjectPath?: string`: The initial project directory path for new sessions.
    -   `onBack: () => void`: Callback to navigate back from the session view.
    -   `onProjectSettings?: (projectPath: string) => void`: Optional callback to open project-specific settings (e.g., hooks configuration).
    -   `className?: string`: Optional CSS classes for styling.
    -   `onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void`: Callback to report changes in the session's streaming status.

-   **Key State Variables:**
    -   `projectPath`: The current working directory for the Claude Code session.
    -   `messages`: An array of `ClaudeStreamMessage` objects representing the conversation history and tool outputs.
    -   `isLoading`: Indicates if the session is currently processing a prompt or loading history.
    -   `error`: Stores any error messages related to session execution.
    -   `rawJsonlOutput`: Stores the raw JSONL output for copying.
    -   `isFirstPrompt`: A flag to differentiate between starting a new session and resuming an existing one.
    -   `totalTokens`: Accumulates the total token usage for the session.
    -   `extractedSessionInfo`, `claudeSessionId`: Information about the current Claude session ID and project ID.
    -   `showTimeline`, `timelineVersion`: Controls the visibility and refresh of the session timeline.
    -   `showSettings`, `showForkDialog`, `showSlashCommandsSettings`: Control the visibility of various configuration dialogs.
    -   `queuedPrompts`: An array to hold prompts that are sent while another operation is in progress.
    -   `showPreview`, `previewUrl`, `showPreviewPrompt`, `splitPosition`, `isPreviewMaximized`: State variables for managing an integrated webview preview feature.

-   **Core Functionality & Logic:**
    -   **Session Management:** Initiates new Claude Code sessions (`api.executeClaudeCode`) or resumes existing ones (`api.resumeClaudeCode`). It handles the lifecycle of the Claude CLI process.
    -   **Real-time Communication:** Listens to Tauri events (`claude-output`, `claude-error`, `claude-complete`) to receive streamed messages from the Claude Code CLI. It implements a robust listener setup strategy to handle dynamic session IDs.
    -   **Prompt Handling:** Allows users to send text prompts (`handleSendPrompt`). It queues prompts if the session is busy and processes them sequentially.
    -   **Output Display:** Renders the `messages` using the `StreamMessage` component, which can interpret various message types (system, assistant, user, tool results) and display them appropriately.
    -   **Project Path Selection:** Provides a file picker (`@tauri-apps/plugin-dialog`) to select the project directory.
    -   **Checkpoint & Timeline:** Integrates `TimelineNavigator` to visualize session history and `CheckpointSettings` for configuring auto-checkpointing. Users can fork sessions from specific checkpoints.
    -   **Slash Commands:** Manages project-specific slash commands through `SlashCommandsManager`.
    -   **Webview Preview:** Detects URLs in the output and can launch an integrated `WebviewPreview` to display web content directly within the application, supporting split-pane view and maximization.
    -   **Output Export:** Allows copying the entire session output as JSONL or Markdown.
    -   **Token Counter:** Displays the cumulative token usage for the session.
    -   **Error Handling & Loading States:** Manages and displays errors, and shows loading indicators during active operations.
    -   **Performance:** Uses `@tanstack/react-virtual` for efficient rendering of long message lists.

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`, `useRef`, `useMemo`.
    -   **UI Libraries:** `@/components/ui/button`, `@/components/ui/input`, `@/components/ui/label`, `@/components/ui/popover`, `@/components/ui/dialog`, `@/components/ui/tooltip`, `@/components/ui/split-pane`.
    -   **Icons:** `lucide-react`.
    -   **Animation:** `framer-motion`.
    -   **Tauri:** `@tauri-apps/api` (`open`, `listen`).
    -   **Internal API:** `api` from `@/lib/api` for backend communication, `Session` type.
    -   **Utilities:** `cn` for class names.
    -   **Child Components:** `StreamMessage`, `FloatingPromptInput`, `ErrorBoundary`, `TimelineNavigator`, `CheckpointSettings`, `SlashCommandsManager`, `WebviewPreview`, `IntelligentChat`.
    -   **Type Import:** `ClaudeStreamMessage` from `./AgentExecution`.

#### `ClaudeCommandSync.tsx`

-   **Purpose:** This component manages the synchronization of Claude Code CLI commands with the application. It checks for Claude CLI availability, performs the synchronization process, displays the sync status and results, and allows users to enable/disable automatic synchronization.

-   **Key Props:**
    -   `setToast?: (toast: { message: string; type: 'success' | 'error' }) => void`: An optional callback to display toast notifications for user feedback.

-   **Key State Variables:**
    -   `syncState`: Stores the current synchronization state, including last sync time, Claude version, and sync enabled status.
    -   `syncResult`: Holds the results of the last synchronization attempt (commands found, new, updated, errors).
    -   `syncedCommands`: An array of `SlashCommand` objects representing the commands successfully synced from Claude CLI.
    -   `isLoading`: A boolean indicating if a sync operation is currently in progress.
    -   `claudeAvailable`: A boolean indicating whether the Claude Code CLI is installed and accessible.

-   **Core Functionality & Logic:**
    -   **Initialization:** On component mount, it loads the initial sync state and checks for Claude CLI availability by invoking Tauri commands (`get_claude_sync_state`, `check_claude_availability`).
    -   **Command Synchronization:** The `syncCommands` function triggers the synchronization process (`sync_claude_commands` Tauri invoke). It updates the UI with the sync results and fetches the newly synced commands (`get_synced_claude_commands`).
    -   **Toggle Sync:** Allows users to enable or disable automatic command synchronization (`set_claude_sync_enabled` Tauri invoke).
    -   **Status Display:** Provides visual feedback on Claude CLI availability, sync status (loading, success, error), and detailed sync results (number of commands found, new, updated).
    -   **User Feedback:** Uses the `setToast` prop to display success or error messages to the user.
    -   **Data Formatting:** Includes helper functions (`formatTime`) to format timestamps for display.

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`.
    -   **Tauri:** `invoke` from `@tauri-apps/api/core` for direct communication with the Rust backend.
    -   **UI Libraries:** `./ui/button`, `./ui/card`, `./ui/badge` (relative paths suggest these are local UI components).
    -   **Icons:** `lucide-react`.
    -   **Types:** `ClaudeSyncResult`, `ClaudeSyncState`, `SlashCommand` interfaces define the data structures for sync operations.

#### `ClaudeSyncStatus.tsx`

-   **Purpose:** This component provides a user interface to display and manage the current status of Claude Code CLI command synchronization. It allows users to view the sync status, enable/disable auto-sync, adjust sync intervals, and manually trigger sync operations.

-   **Key Props:** None explicitly defined, but it likely relies on global state or direct Tauri API calls.

-   **Key State Variables:**
    -   `syncState`: An object containing the current synchronization settings and last sync information.
    -   `syncing`: A boolean indicating if a sync operation is currently in progress.
    -   `nextSyncTime`: The timestamp for the next scheduled synchronization.
    -   `lastSyncResult`: The result of the most recent sync operation, including success/failure and command counts.
    -   `claudeAvailable`: A boolean indicating whether the Claude Code CLI is detected and accessible.

-   **Core Functionality & Logic:**
    -   **Initialization & Polling:** On mount, it loads the initial sync state and Claude CLI availability. It also sets up a periodic refresh (every minute) to update the sync status and next sync time.
    -   **Event Listening:** Listens for `claude-commands-synced` Tauri events to trigger a state refresh after a sync operation completes.
    -   **Sync Control:** Provides UI elements (Switch, Select) to enable/disable auto-sync and configure the sync interval (1, 6, 12, 24, 48 hours).
    -   **Manual Sync:** Offers buttons to trigger a manual sync (`handleSync`) or a force refresh (`handleForceRefresh`) of Claude commands.
    -   **Status Display:** Visually indicates Claude CLI availability (found/not found), current sync status (syncing, successful, failed), and details of the last sync (timestamp, commands cached, Claude version, new/updated commands).
    -   **Error Handling:** Displays error messages if sync operations fail or Claude CLI is not found.

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`.
    -   **Tauri:** `listen` from `@tauri-apps/api/event` for event handling.
    -   **UI Libraries:** `@/components/ui/card`, `@/components/ui/button`, `@/components/ui/switch`, `@/components/ui/label`, `@/components/ui/select`, `@/components/ui/badge`.
    -   **Icons:** `lucide-react`.
    -   **Date Formatting:** `date-fns` for formatting timestamps.
    -   **Internal API:** `api` from `@/lib/api` for backend communication (`getClaudeSyncState`, `checkClaudeAvailability`, `getNextSyncTime`, `syncClaudeCommands`, `forceRefreshClaudeCommands`, `setClaudeSyncEnabled`, `setClaudeSyncInterval`).
    -   **Types:** `ClaudeSyncState`, `ClaudeSyncResult` from `@/lib/api`.

#### `ClaudeVersionSelector.tsx`

-   **Purpose:** This component allows users to select a specific Claude Code CLI installation from available options (system-wide or custom paths). It detects installed versions, displays their details, and enables the user to set their preferred Claude CLI for the application.

-   **Key Props:**
    -   `selectedPath?: string | null`: The currently selected Claude CLI installation path.
    -   `onSelect: (installation: ClaudeInstallation) => void`: Callback function triggered when a new Claude installation is selected.
    -   `className?: string`: Optional CSS classes for styling.
    -   `showSaveButton?: boolean`: If true, displays a save button to persist the selection.
    -   `onSave?: () => void`: Callback triggered when the save button is clicked.
    -   `isSaving?: boolean`: Indicates if the save operation is in progress.

-   **Key State Variables:**
    -   `installations`: An array of `ClaudeInstallation` objects, representing all detected Claude CLI installations.
    -   `loading`: A boolean indicating if installations are currently being loaded.
    -   `error`: Stores any error messages encountered during installation loading.
    -   `selectedInstallation`: The currently selected `ClaudeInstallation` object.

-   **Core Functionality & Logic:**
    -   **Installation Detection:** On mount, it calls `api.listClaudeInstallations()` to discover all available Claude CLI installations on the system.
    -   **Selection Management:** Populates a `Select` component with the discovered installations. Users can choose an installation, and the `onSelect` callback is triggered with the selected `ClaudeInstallation` object.
    -   **Display Details:** For each installation, it displays its path, version (if available), and source (e.g., System, Custom). It also provides visual cues (icons, badges) based on the installation type.
    -   **Error and Loading States:** Shows loading indicators or error messages if installations cannot be loaded.
    -   **Save Functionality:** If `showSaveButton` is true, it provides a button to trigger the `onSave` callback, allowing the parent component to persist the user's selection.

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`.
    -   **UI Libraries:** `@/components/ui/button`, `@/components/ui/select`, `@/components/ui/badge`, `@/components/ui/card`, `@/components/ui/label`.
    -   **Icons:** `lucide-react`.
    -   **Internal API:** `api` from `@/lib/api` for backend communication (`listClaudeInstallations`).
    -   **Utilities:** `cn` for class names.
    -   **Types:** `ClaudeInstallation` interface defines the structure of a Claude CLI installation.

### 3. User Interface (UI) & Layout

#### `StreamMessage.tsx`

-   **Purpose:** This is a crucial component responsible for rendering individual messages streamed from the Claude Code CLI or agent executions. It intelligently parses and displays various types of content, including plain text, code blocks (with syntax highlighting), tool calls, and tool results, often transforming raw JSONL output into a more human-readable and interactive format. It also integrates custom widgets for specific tool outputs.

-   **Key Props:**
    -   `message: ClaudeStreamMessage`: The single message object to be rendered.
    -   `className?: string`: Optional CSS classes for styling.
    -   `streamMessages: ClaudeStreamMessage[]`: The full array of messages in the stream, used for context (e.g., to find corresponding tool calls for tool results).
    -   `onLinkDetected?: (url: string) => void`: Optional callback to handle detected URLs within the message content (e.g., for webview preview).

-   **Key State Variables:**
    -   `toolResults`: A `Map` to store tool results, keyed by `tool_use_id`, allowing tool results to be associated with their corresponding tool calls.

-   **Core Functionality & Logic:**
    -   **Message Type Handling:** Differentiates between `system`, `assistant`, `user`, and `result` message types and renders them with distinct styling and content structures.
    -   **Content Parsing & Rendering:**
        -   **Text:** Renders text content using `ReactMarkdown` with `remarkGfm` for Markdown parsing and `SyntaxHighlighter` for code block syntax highlighting.
        -   **Tool Use:** For `assistant` messages containing `tool_use` content, it dynamically renders specialized widgets (e.g., `TodoWidget`, `EditWidget`, `BashWidget`, `WebSearchWidget`, `MCPWidget`) based on the tool's `name`. It passes the tool's input and its corresponding `tool_result` (if available) to these widgets.
        -   **Tool Result:** For `user` messages containing `tool_result` content, it checks if a dedicated widget has already handled the display (to avoid duplication). Otherwise, it renders the raw tool result or specific widgets for `EditResultWidget`, `MultiEditResultWidget`, `LSResultWidget`, `ReadResultWidget`, and `SystemReminderWidget`.
        -   **Image Content:** Displays images embedded in messages, handling base64 data or URLs.
    -   **Error Handling:** Includes a `try-catch` block to gracefully handle rendering errors and display a generic error message.
    -   **Contextual Rendering:** Uses the `streamMessages` prop to find related messages (e.g., matching `tool_use` with `tool_result`) to ensure correct and non-redundant rendering.
    -   **Styling:** Applies different `Card` styles and icons based on the message type and status (e.g., success, error).

-   **Key Imports/Dependencies:**
    -   **React:** `useState`, `useEffect`.
    -   **UI Libraries:** `@/components/ui/card`.
    -   **Icons:** `lucide-react`.
    -   **Markdown & Syntax Highlighting:** `react-markdown`, `remark-gfm`, `react-syntax-highlighter`.
    -   **Theming:** `getClaudeSyntaxTheme` and `useTheme` for dynamic syntax highlighting themes.
    -   **Utilities:** `cn` for class names.
    -   **Child Components (Tool Widgets):** A large number of specific tool widgets imported from `./ToolWidgets` (e.g., `TodoWidget`, `EditWidget`, `BashWidget`, `MCPWidget`, `SystemReminderWidget`, etc.).
    -   **Type Import:** `ClaudeStreamMessage` from `./AgentExecution`.