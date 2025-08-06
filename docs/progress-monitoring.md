# Progress Monitoring System for Claudia

A comprehensive visual progress tracking system that provides real-time visibility into ongoing operations, API calls, and system activities.

## Overview

The Progress Monitoring System consists of three main components:

1. **StatusBar** - A bottom status bar showing active operations and error counts
2. **ProgressTracker** - A left sidebar panel with detailed progress visualization
3. **MonitoringStore** - Zustand state management for all monitoring data

## Features

### StatusBar Component
- **Minimal Design**: 24px height to avoid UI disruption
- **Real-time Updates**: Shows active operations with progress indicators
- **Error Summary**: Displays error counts by severity (critical, high, medium, low)
- **Expandable View**: Click to expand for detailed operation and error views
- **Smooth Animations**: Framer Motion powered transitions

### ProgressTracker Component
- **Visual Charts**: 
  - Activity timeline (area chart)
  - Operation type distribution (pie chart)
  - Overall progress metrics
- **Operation Grouping**: Groups by status (active) and type
- **Detailed Statistics**:
  - Total operations
  - Success rate
  - Average duration
  - Active operation count
- **Collapsible Categories**: Organize operations by type
- **Operation Details**: Click operations to see full details including errors

### MonitoringStore
- **Operation Lifecycle**: Tracks pending → running → completed/error states
- **Progress Tracking**: Real-time progress updates (0-100%)
- **Error Management**: Categorized error logging with severity levels
- **Performance Optimized**: Efficient state updates and cleanup
- **Utility Functions**: Duration calculation, overall progress computation

## Integration

### Basic Usage

```tsx
import { ProgressMonitor } from '@/components/ProgressMonitor';

// Add to your app root
function App() {
  return (
    <>
      {/* Your app content */}
      <ProgressMonitor />
    </>
  );
}
```

### Manual Operation Tracking

```tsx
import { useOperationTracker } from '@/stores/monitoringStore';

const tracker = useOperationTracker();

// Track any async operation
await tracker.track(
  {
    type: 'api_call',
    name: 'Fetch User Data',
    description: 'Loading user profile',
  },
  async (updateProgress) => {
    updateProgress(20);
    const data = await fetchData();
    updateProgress(60);
    const processed = await processData(data);
    updateProgress(100);
    return processed;
  }
);
```

### AI Request Tracking

```tsx
import { useAIRequestTracking } from '@/hooks/useMonitoringIntegration';

const { trackGeminiRequest, trackClaudeRequest } = useAIRequestTracking();

// Track Gemini requests
const result = await trackGeminiRequest(
  'gemini-1.5-pro',
  'Analyze this code',
  async () => await geminiApi.generate(prompt)
);

// Track Claude requests
const result = await trackClaudeRequest(
  sessionId,
  'Write a function',
  async () => await claudeApi.send(prompt)
);
```

### Error Logging

```tsx
import { useMonitoringStore } from '@/stores/monitoringStore';

const { logError } = useMonitoringStore();

logError({
  category: 'API Error',
  message: 'Failed to fetch data',
  severity: 'high',
  details: { endpoint: '/api/users', status: 500 }
});
```

## Operation Types

- `api_call` - API requests and responses
- `file_operation` - File read/write/edit operations
- `tool_execution` - Tool and command executions
- `build_process` - Build and compilation processes
- `gemini_request` - Gemini AI model requests
- `claude_request` - Claude AI model requests

## Error Severity Levels

- `critical` - System failures requiring immediate attention
- `high` - Significant errors affecting functionality
- `medium` - Errors that may impact user experience
- `low` - Minor issues or warnings

## Customization

### Styling
All components use Tailwind CSS and follow the existing design system. Colors adapt to the current theme (light/dark).

### Configuration
The monitoring system can be configured through the `MonitoringStore`:

```tsx
// Clear completed operations
useMonitoringStore.getState().clearCompletedOperations();

// Toggle UI elements
useMonitoringStore.getState().toggleStatusBar();
useMonitoringStore.getState().toggleProgressTracker();
```

## Demo

A demo component is available to test the progress monitoring system:

```tsx
import { ProgressMonitorDemo } from '@/components/ProgressMonitorDemo';

// Add to a test page
<ProgressMonitorDemo />
```

The demo includes buttons to simulate various operations, errors, and concurrent activities.

## Performance Considerations

- Operations are automatically cleaned up after completion
- Maximum of 100 errors are retained in memory
- Charts use virtualization for large datasets
- State updates are batched for optimal performance

## Future Enhancements

- Export operation logs
- Custom operation type definitions
- Webhook integration for external monitoring
- Performance metrics dashboard
- Operation history persistence