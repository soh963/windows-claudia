# Visual Progress Monitoring System Guide

## Overview

The Visual Progress Monitoring System provides real-time visual feedback for all tasks and operations in Claudia. This guide covers installation, configuration, usage, and customization of the monitoring system.

## Table of Contents

1. [Introduction](#introduction)
2. [Key Features](#key-features)
3. [Getting Started](#getting-started)
4. [User Interface](#user-interface)
5. [Progress Indicators](#progress-indicators)
6. [Task Management](#task-management)
7. [Notifications](#notifications)
8. [Customization](#customization)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

## Introduction

The Visual Progress Monitoring System transforms complex task execution into intuitive visual representations, helping users understand system activity at a glance.

### Benefits

- **Real-time Feedback**: See exactly what Claudia is doing
- **Progress Tracking**: Monitor task completion percentages
- **Error Detection**: Immediate visual alerts for issues
- **Performance Insights**: Understand system performance
- **Multi-task Management**: Track multiple operations simultaneously

## Key Features

### 1. Live Progress Bars
- Animated progress indicators for active tasks
- Color-coded status (green: success, yellow: warning, red: error)
- Percentage completion display
- Time estimates for long-running tasks

### 2. Task Queue Visualization
- Visual representation of pending tasks
- Drag-and-drop task prioritization
- Estimated queue processing time
- Resource usage indicators

### 3. Real-time Notifications
- Toast notifications for task completion
- Error alerts with actionable information
- Success confirmations
- Warning messages for potential issues

### 4. Historical Progress Tracking
- Timeline view of completed tasks
- Performance metrics over time
- Success/failure rate visualization
- Trend analysis graphs

## Getting Started

### Prerequisites

- Claudia Dashboard installed and running
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Minimum screen resolution: 1280x720

### Accessing the Monitor

1. Open the Claudia Dashboard
2. Navigate to the "Monitor" tab in the top navigation
3. The Visual Progress Monitor loads automatically

### Initial Configuration

```javascript
// Configure monitoring preferences
const monitorConfig = {
  updateInterval: 100,        // Update frequency in ms
  showNotifications: true,    // Enable toast notifications
  soundAlerts: false,         // Enable sound alerts
  compactMode: false,        // Use compact view
  theme: 'auto'              // 'light', 'dark', or 'auto'
};
```

## User Interface

### Main Dashboard

```
┌─────────────────────────────────────────────────────┐
│  Active Tasks                              [Filters] │
├─────────────────────────────────────────────────────┤
│  ▶ Task 1: Processing files...             75% ████ │
│  ▶ Task 2: Analyzing code...               30% ██   │
│  ⏸ Task 3: Waiting for resources...         0% ○    │
├─────────────────────────────────────────────────────┤
│  Queue (5 tasks)                    Est. time: 15m  │
│  ○ Build project                                    │
│  ○ Run tests                                        │
│  ○ Generate documentation                           │
└─────────────────────────────────────────────────────┘
```

### Interface Elements

1. **Header Bar**
   - Active task count
   - System status indicator
   - Quick actions menu
   - Settings gear icon

2. **Task List**
   - Task name and description
   - Progress bar with percentage
   - Status icon
   - Action buttons (pause, cancel, retry)

3. **Queue Panel**
   - Upcoming tasks
   - Drag handles for reordering
   - Estimated start times
   - Priority indicators

4. **Status Bar**
   - CPU usage meter
   - Memory usage meter
   - Network activity indicator
   - Time tracker

## Progress Indicators

### Progress Bar States

1. **Active** (Animated blue)
   ```
   ████████░░░░░░░░ 50% - Processing...
   ```

2. **Completed** (Solid green)
   ```
   ████████████████ 100% ✓ Complete
   ```

3. **Error** (Red with icon)
   ```
   ████████░░░░░░░░ 50% ✗ Error occurred
   ```

4. **Paused** (Yellow)
   ```
   ████████░░░░░░░░ 50% ⏸ Paused
   ```

### Status Icons

- ▶️ Running
- ⏸️ Paused
- ⏹️ Stopped
- ✅ Completed
- ❌ Failed
- ⚠️ Warning
- 🔄 Retrying

## Task Management

### Creating Tasks

Tasks are automatically created when operations start. Manual task creation:

```javascript
// Create a custom task
const task = await createTask({
  name: 'Custom Operation',
  description: 'Processing important data',
  estimatedDuration: 300000, // 5 minutes in ms
  priority: 'high'
});
```

### Task Actions

1. **Pause/Resume**
   - Click the pause button to suspend task
   - Click play to resume from where it left off

2. **Cancel**
   - Stops task execution
   - Cleans up resources
   - Marks as cancelled in history

3. **Retry**
   - Available for failed tasks
   - Restarts from beginning
   - Preserves original parameters

### Task Priorities

- **Critical**: Red indicator, processes immediately
- **High**: Orange indicator, minimal queue time
- **Normal**: Blue indicator, standard processing
- **Low**: Gray indicator, processes when idle

## Notifications

### Notification Types

1. **Success Notifications**
   ```
   ✅ Task completed successfully
   Build finished in 2m 34s
   ```

2. **Error Notifications**
   ```
   ❌ Task failed
   Error: Module not found
   [View Details] [Retry]
   ```

3. **Warning Notifications**
   ```
   ⚠️ Resource usage high
   CPU at 85% - tasks may slow down
   ```

### Notification Settings

```javascript
// Configure notifications
notificationSettings = {
  position: 'top-right',     // Notification position
  duration: 5000,            // Display duration in ms
  maxStack: 3,               // Maximum visible notifications
  sounds: {
    success: 'chime.mp3',
    error: 'alert.mp3',
    warning: 'warn.mp3'
  }
};
```

## Customization

### Theme Customization

```css
/* Custom theme variables */
:root {
  --progress-primary: #007bff;
  --progress-success: #28a745;
  --progress-error: #dc3545;
  --progress-warning: #ffc107;
  --progress-bg: #e9ecef;
  --progress-text: #212529;
}
```

### Layout Options

1. **Compact Mode**
   - Condensed task display
   - More tasks visible
   - Reduced animations

2. **Detailed Mode**
   - Full task information
   - Extended metrics
   - Resource graphs

3. **Dashboard Mode**
   - Multiple monitor widgets
   - Customizable layout
   - Drag-and-drop arrangement

### Custom Widgets

Create custom monitoring widgets:

```javascript
class CustomWidget extends MonitorWidget {
  render() {
    return `
      <div class="custom-monitor">
        <h3>${this.title}</h3>
        <div class="metric">${this.value}</div>
      </div>
    `;
  }
}
```

## API Reference

### Core Methods

```javascript
// Start monitoring a task
startMonitoring(taskId, options)

// Update task progress
updateProgress(taskId, percentage, status)

// Complete task
completeTask(taskId, result)

// Cancel task
cancelTask(taskId, reason)

// Get task status
getTaskStatus(taskId)

// List all tasks
getAllTasks(filter)
```

### Events

```javascript
// Listen for task events
monitor.on('task:started', (task) => {
  console.log(`Task ${task.name} started`);
});

monitor.on('task:progress', (task, progress) => {
  console.log(`Task ${task.name}: ${progress}%`);
});

monitor.on('task:completed', (task, result) => {
  console.log(`Task ${task.name} completed`);
});

monitor.on('task:failed', (task, error) => {
  console.error(`Task ${task.name} failed:`, error);
});
```

### WebSocket API

Real-time updates via WebSocket:

```javascript
// Connect to monitor WebSocket
const ws = new WebSocket('ws://localhost:3000/monitor');

ws.on('message', (data) => {
  const update = JSON.parse(data);
  handleProgressUpdate(update);
});
```

## Troubleshooting

### Common Issues

1. **Progress not updating**
   - Check WebSocket connection
   - Verify task is actually running
   - Check browser console for errors

2. **Notifications not appearing**
   - Check browser notification permissions
   - Verify notification settings
   - Check if notifications are blocked

3. **High CPU usage**
   - Reduce update frequency
   - Enable compact mode
   - Limit visible tasks

### Debug Mode

Enable debug mode for detailed logging:

```javascript
// Enable debug mode
window.MONITOR_DEBUG = true;

// View debug information
monitor.debug.getStats();
monitor.debug.getTaskQueue();
monitor.debug.getPerformanceMetrics();
```

### Performance Tips

1. **Optimize Update Frequency**
   - Use 100ms for smooth animations
   - Increase to 500ms for low-end devices
   - Use 1000ms for battery saving

2. **Limit Concurrent Animations**
   - Set max animated tasks to 5
   - Use CSS transforms for performance
   - Disable animations on mobile

3. **Memory Management**
   - Clear completed tasks regularly
   - Limit history retention
   - Use pagination for large task lists

## Best Practices

1. **Task Naming**
   - Use descriptive, action-oriented names
   - Include relevant identifiers
   - Keep under 50 characters

2. **Progress Updates**
   - Update at meaningful intervals
   - Avoid too frequent updates
   - Include substep information

3. **Error Handling**
   - Provide clear error messages
   - Include recovery suggestions
   - Log detailed error information

4. **User Experience**
   - Show estimated completion times
   - Allow task cancellation
   - Provide feedback for all actions

## Integration Examples

### React Integration

```jsx
import { ProgressMonitor } from '@claudia/progress-monitor';

function TaskComponent({ taskId }) {
  const { progress, status } = useProgressMonitor(taskId);
  
  return (
    <div className="task-progress">
      <ProgressBar value={progress} status={status} />
      <span>{progress}% Complete</span>
    </div>
  );
}
```

### Vue Integration

```vue
<template>
  <div class="progress-monitor">
    <progress-bar 
      :value="progress" 
      :status="status"
      @complete="onTaskComplete"
    />
  </div>
</template>

<script>
import { useProgressMonitor } from '@claudia/vue-monitor';

export default {
  setup() {
    const { progress, status } = useProgressMonitor();
    return { progress, status };
  }
}
</script>
```

## Accessibility

The Visual Progress Monitoring System is fully accessible:

- **ARIA Labels**: All progress indicators have descriptive labels
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: Announces progress updates
- **High Contrast Mode**: Supports system contrast settings
- **Motion Preferences**: Respects reduced motion settings

## Conclusion

The Visual Progress Monitoring System provides powerful, intuitive task tracking for Claudia. By following this guide, you can effectively monitor, manage, and optimize your Claudia operations.

For more information:
- [API Documentation](../technical/API-Reference.md#progress-monitor)
- [Frontend Components](../technical/Frontend-Component-Library.md#progress)
- [Integration Guide](../integration/System-Integration-Guide.md)

---
*Last updated: December 2024*