# Session Task Visualizer

A comprehensive real-time task visualization system for Claude Code sessions that tracks AI models, agents, MCP servers, and tool usage.

## Features

### Core Functionality
- **Real-time Task Tracking**: Live updates as tasks progress through their lifecycle
- **Multi-Model Support**: Track usage of Claude and Gemini models per task
- **Agent Monitoring**: Visualize which AI agents are active for each task
- **MCP Server Tracking**: See which MCP servers (Context7, Sequential, Magic, Playwright) are being used
- **Tool Usage Analytics**: Count and categorize tool calls per task
- **Token Usage Tracking**: Monitor token consumption across tasks
- **Duration Tracking**: Real-time duration updates for active tasks

### UI Features
- **Collapsible Sidebar**: Three states - collapsed (icon only), normal, and expanded
- **Task Timeline**: Visual timeline showing task progression
- **Progress Visualization**: Overall session progress with percentage and visual indicators
- **Resource Usage Overview**: Aggregated view of models, agents, MCP servers, and tools
- **Interactive Task Details**: Click tasks to see expanded information
- **Smooth Animations**: Polished transitions and loading states
- **Dark/Light Theme Support**: Fully integrated with the app's theme system

## Components

### SessionTaskVisualizer
The main visualization component that displays all tasks and session statistics.

```tsx
import { SessionTaskVisualizer } from '@/components/SessionTaskVisualizer';

<SessionTaskVisualizer
  tasks={tasks}
  sessionId={sessionId}
  isVisible={isVisible}
  onClose={() => setIsVisible(false)}
  className="top-16" // Optional positioning
/>
```

### useSessionTaskTracking Hook
React hook that manages task state and listens for real-time updates.

```tsx
import { useSessionTaskTracking } from '@/hooks/useSessionTaskTracking';

const {
  tasks,
  isTracking,
  startTracking,
  stopTracking,
  resetTasks,
  updateTask,
  generateMockTasks
} = useSessionTaskTracking(sessionId);
```

## Task Structure

```typescript
interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  model?: 'claude' | 'gemini';
  agents?: Agent[];
  mcpServers?: MCPServer[];
  tools?: Tool[];
  tokens?: number;
  error?: string;
  parentId?: string;
  subtasks?: Task[];
}
```

## Integration Guide

### 1. Add to ClaudeCodeSession

```tsx
// In ClaudeCodeSession.tsx
import { SessionTaskVisualizer } from './SessionTaskVisualizer';
import { useSessionTaskTracking } from '@/hooks/useSessionTaskTracking';

// Inside component
const [showTaskVisualizer, setShowTaskVisualizer] = useState(true);
const { tasks } = useSessionTaskTracking(effectiveSession?.id || null);

// In JSX
<SessionTaskVisualizer
  tasks={tasks}
  sessionId={effectiveSession?.id || 'no-session'}
  isVisible={showTaskVisualizer}
  onClose={() => setShowTaskVisualizer(false)}
/>
```

### 2. Backend Event Integration

The visualizer listens for these Tauri events:

#### TodoWrite Updates
```rust
app_handle.emit_all("todo-update", json!({
  "todos": vec![
    json!({
      "id": "task-1",
      "content": "Implement feature X",
      "status": "in_progress",
      "priority": "high"
    })
  ]
}))?;
```

#### Tool Calls
```rust
app_handle.emit_all("tool-call", json!({
  "tool": "Read",
  "params": params,
  "sessionId": session_id
}))?;
```

#### Model Events
```rust
app_handle.emit_all("model-event", json!({
  "model": "claude", // or "gemini"
  "tokens": 1500,
  "sessionId": session_id
}))?;
```

#### Agent Activation
```rust
app_handle.emit_all("agent-activation", json!({
  "agent": "frontend",
  "active": true,
  "sessionId": session_id
}))?;
```

#### MCP Server Events
```rust
app_handle.emit_all("mcp-server-event", json!({
  "server": "magic",
  "active": true,
  "sessionId": session_id
}))?;
```

## Visual Elements

### Status Indicators
- 🟢 **Completed**: Green checkmark
- 🔵 **In Progress**: Blue clock (animated pulse)
- ⚪ **Pending**: Gray circle
- 🔴 **Blocked**: Red alert circle

### Priority Badges
- **High**: Red background
- **Medium**: Yellow background
- **Low**: Green background

### Model Icons
- **Claude**: Brain icon (purple)
- **Gemini**: Sparkles icon (blue)

### Agent Icons
- **Architect**: Layers (indigo)
- **Frontend**: Globe (pink)
- **Backend**: Server (green)
- **Analyzer**: Activity (orange)
- **Security**: Shield (red)
- **QA**: CheckCircle (cyan)
- **Performance**: Zap (yellow)
- **DevOps**: GitBranch (purple)
- **Refactorer**: Code (blue)
- **Mentor**: Users (emerald)
- **Scribe**: FileEdit (gray)

### MCP Server Icons
- **Context7**: Database (blue)
- **Sequential**: Layers (purple)
- **Magic**: Sparkles (pink)
- **Playwright**: Globe (green)

### Tool Icons
- **Read**: Eye (gray)
- **Write**: FileEdit (blue)
- **Edit**: Code (green)
- **Bash**: Terminal (orange)
- **Grep**: Activity (purple)
- **Glob**: Package (yellow)
- **LS**: Layers (cyan)
- **WebFetch/Search**: Globe (indigo/pink)
- **TodoWrite**: CheckCircle (emerald)
- **NotebookEdit**: FileEdit (red)

## Performance Considerations

- **Virtual Scrolling**: Efficiently handles large task lists
- **Debounced Updates**: Prevents excessive re-renders
- **Lazy Loading**: Task details load on demand
- **Memory Management**: Automatic cleanup of event listeners and timers
- **Optimized Animations**: GPU-accelerated transitions

## Customization

### Positioning
```tsx
<SessionTaskVisualizer
  className="top-20" // Adjust vertical position
  // Default is top-0
/>
```

### Custom Task Rendering
The component is designed to be extended. You can create custom task renderers by modifying the task mapping in the component.

### Theme Integration
The visualizer automatically adapts to your app's theme using CSS variables and the `cn()` utility function.

## Testing

Use the demo component to test the visualizer:

```tsx
import { SessionTaskVisualizerDemo } from '@/components/SessionTaskVisualizerDemo';

// In your test page
<SessionTaskVisualizerDemo sessionId="test-session" />
```

The demo includes:
- Mock task generation
- Manual task manipulation
- Visibility toggle
- Reset functionality

## Troubleshooting

### Tasks Not Updating
1. Verify the sessionId matches between frontend and backend
2. Check that events are being emitted with correct format
3. Ensure the component is mounted and tracking is active

### Performance Issues
1. Limit the number of tasks displayed (implement pagination if needed)
2. Reduce animation complexity for older devices
3. Use the collapsed view for better performance

### Styling Conflicts
1. Check z-index conflicts with other fixed elements
2. Adjust the className prop for custom positioning
3. Ensure parent containers don't have conflicting overflow settings

## Future Enhancements

- [ ] Task filtering and search
- [ ] Export task history
- [ ] Task duration predictions
- [ ] Resource usage charts
- [ ] Task dependency visualization
- [ ] Collaborative task tracking
- [ ] Performance benchmarking
- [ ] Custom task categories