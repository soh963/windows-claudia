/**
 * Integration guide for SessionTaskVisualizer in ClaudeCodeSession
 * 
 * This file demonstrates how to integrate the SessionTaskVisualizer
 * into the existing ClaudeCodeSession component.
 */

import React from 'react';
import { SessionTaskVisualizer } from './SessionTaskVisualizer';
import { useSessionTaskTracking } from '@/hooks/useSessionTaskTracking';

/**
 * Example integration in ClaudeCodeSession component
 * 
 * Add these imports to ClaudeCodeSession.tsx:
 * ```tsx
 * import { SessionTaskVisualizer } from './SessionTaskVisualizer';
 * import { useSessionTaskTracking } from '@/hooks/useSessionTaskTracking';
 * ```
 * 
 * Then add this state and hook in the component:
 * ```tsx
 * const [showTaskVisualizer, setShowTaskVisualizer] = useState(true);
 * const { tasks } = useSessionTaskTracking(effectiveSession?.id || null);
 * ```
 * 
 * Add a toggle button in the header:
 * ```tsx
 * <Button
 *   variant="ghost"
 *   size="sm"
 *   onClick={() => setShowTaskVisualizer(!showTaskVisualizer)}
 *   className="gap-2"
 * >
 *   <Activity className="h-4 w-4" />
 *   Tasks
 * </Button>
 * ```
 * 
 * Finally, add the visualizer component:
 * ```tsx
 * <SessionTaskVisualizer
 *   tasks={tasks}
 *   sessionId={effectiveSession?.id || 'no-session'}
 *   isVisible={showTaskVisualizer}
 *   onClose={() => setShowTaskVisualizer(false)}
 * />
 * ```
 */

/**
 * Example of triggering task updates from tool calls
 * 
 * In your backend/command handlers, emit events like:
 * 
 * ```rust
 * // When TodoWrite is called
 * app_handle.emit_all("todo-update", json!({
 *   "todos": todos
 * }))?;
 * 
 * // When a tool is called
 * app_handle.emit_all("tool-call", json!({
 *   "tool": tool_name,
 *   "params": params,
 *   "sessionId": session_id
 * }))?;
 * 
 * // When using a model
 * app_handle.emit_all("model-event", json!({
 *   "model": "claude", // or "gemini"
 *   "tokens": token_count,
 *   "sessionId": session_id
 * }))?;
 * 
 * // When activating an agent
 * app_handle.emit_all("agent-activation", json!({
 *   "agent": agent_name,
 *   "active": true,
 *   "sessionId": session_id
 * }))?;
 * 
 * // When using MCP server
 * app_handle.emit_all("mcp-server-event", json!({
 *   "server": server_name,
 *   "active": true,
 *   "sessionId": session_id
 * }))?;
 * ```
 */

// Example usage with custom positioning
export const SessionTaskVisualizerExample: React.FC = () => {
  const { tasks } = useSessionTaskTracking('example-session');
  const [isVisible, setIsVisible] = React.useState(true);

  return (
    <>
      {/* Your main content */}
      <div className="flex-1 p-4">
        <h1>Your Claude Code Session</h1>
        {/* Session content here */}
      </div>

      {/* Task Visualizer - positioned on the left */}
      <SessionTaskVisualizer
        tasks={tasks}
        sessionId="example-session"
        isVisible={isVisible}
        onClose={() => setIsVisible(false)}
      />
    </>
  );
};

/**
 * Styling considerations:
 * 
 * The visualizer uses fixed positioning and appears on the left side.
 * Make sure your main content has appropriate margin/padding to avoid overlap.
 * 
 * You can customize the positioning by passing a className prop:
 * ```tsx
 * <SessionTaskVisualizer
 *   className="top-16" // Adjust top position if you have a header
 *   // ... other props
 * />
 * ```
 * 
 * The component automatically handles:
 * - Z-index layering (z-50)
 * - Smooth animations
 * - Responsive collapse/expand states
 * - Dark/light theme compatibility
 */