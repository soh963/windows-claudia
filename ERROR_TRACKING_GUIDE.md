# Claudia Error Tracking & Monitoring System

## Overview

The Claudia application now features a comprehensive error tracking and monitoring system that captures, analyzes, and helps resolve errors across the entire application stack. This system integrates seamlessly with the existing `MonitoringStore` and `ProgressTracker` components.

## Key Features

### 1. **Enhanced Error Capture System**
- Automatic error detection for API failures, tool errors, and runtime issues
- Error boundary wrappers for React components
- Global error handlers for unhandled rejections and errors
- Context-aware error capture with detailed metadata

### 2. **Error Classification and Analysis**
- **Categories**: API, Tool, Runtime, UI, Build, Database, Filesystem, Network, Permission, Validation, Authentication, Configuration
- **Severity Levels**: Critical, High, Medium, Low
- **Error Sources**: Gemini API, Claude API, Tauri Backend, React Components, Tool Execution, MCP Servers, etc.
- **Pattern Detection**: Identifies recurring error patterns for prevention

### 3. **Advanced Error Monitoring Components**
- **Error Dashboard**: Visual analytics with charts and statistics
- **Error Details Modal**: Deep dive into individual errors with stack traces
- **Error Status Bar**: Real-time error notifications and summary
- **Error Trends**: Historical analysis and pattern recognition

### 4. **Backend Error Integration**
- Captures Rust/Tauri errors from backend operations
- Monitors Gemini/Claude API error responses
- Tracks database operation failures
- Logs file system and permission errors

### 5. **Error Recovery and Prevention**
- Automatic retry mechanisms with exponential backoff
- Error prevention suggestions based on patterns
- Learning system to prevent recurrence
- Resolution tracking and metrics

## Quick Start Guide

### 1. Basic Setup

Add the error tracking setup to your main App component:

```tsx
import { ErrorTrackingSetup } from '@/components/ErrorTrackingSetup';

function App() {
  return (
    <ErrorTrackingSetup>
      {/* Your app content */}
    </ErrorTrackingSetup>
  );
}
```

### 2. Wrap Components with Error Boundaries

```tsx
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundaryWrapper';

export const MyComponent = () => {
  return (
    <ErrorBoundaryWrapper componentName="MyComponent">
      {/* Component content */}
    </ErrorBoundaryWrapper>
  );
};
```

### 3. Capture Errors Manually

```tsx
import { useErrorCapture } from '@/stores/errorTrackingStore';

function MyComponent() {
  const { captureWithContext } = useErrorCapture();
  
  const handleOperation = async () => {
    try {
      // Your operation
    } catch (error) {
      captureWithContext(error, {
        component: 'MyComponent',
        operation: 'handleOperation'
      });
    }
  };
}
```

### 4. Wrap API Calls

```tsx
import { invokeWithErrorTracking } from '@/utils/errorWrappedApi';

const result = await invokeWithErrorTracking('command_name', 
  { arg1: 'value' },
  {
    retryable: true,
    maxRetries: 3,
    context: { component: 'MyComponent' }
  }
);
```

## Component Reference

### ErrorTrackingStore

The main store that manages all error data and operations.

```tsx
// Key methods
captureError(error) // Capture a generic error
captureErrorBoundary(error, errorInfo, component) // Capture React errors
captureTauriError(error, operation) // Capture Tauri backend errors
captureApiError(source, error, endpoint) // Capture API errors
resolveError(errorId, resolution) // Mark error as resolved
retryError(errorId) // Retry a failed operation
```

### Error Dashboard

Access the dashboard programmatically:

```tsx
import { useErrorTracking } from '@/components/ErrorTrackingSetup';

function MyComponent() {
  const { openDashboard, errorCount } = useErrorTracking();
  
  return (
    <button onClick={openDashboard}>
      View {errorCount} errors
    </button>
  );
}
```

### Error Status Bar

Automatically appears when there are unresolved errors. Features:
- Real-time error count by severity
- Error rate monitoring
- Quick access to recent errors
- One-click dashboard access

## Error Categories

| Category | Description | Common Sources |
|----------|-------------|----------------|
| `api` | API request failures | Gemini, Claude, external APIs |
| `tool` | Tool execution errors | MCP tools, built-in tools |
| `runtime` | JavaScript runtime errors | Unhandled exceptions, async errors |
| `ui` | React component errors | Render errors, state issues |
| `build` | Build process errors | Compilation, bundling |
| `database` | Database operation errors | Query failures, connection issues |
| `filesystem` | File system errors | Read/write failures, permissions |
| `network` | Network connectivity | Timeouts, connection failures |
| `permission` | Permission denied errors | Access control, auth failures |
| `validation` | Input validation errors | Schema validation, type errors |

## Error Severity Levels

| Level | Description | Auto-Resolution | User Impact |
|-------|-------------|-----------------|-------------|
| `critical` | System-breaking errors | No | Blocking |
| `high` | Major functionality impaired | No | Major |
| `medium` | Partial functionality affected | No | Minor |
| `low` | Minor issues, warnings | Yes (5 min) | None |

## Advanced Features

### Pattern Detection

The system automatically detects recurring error patterns:

```tsx
const preventionReport = useErrorTrackingStore.getState().generatePreventionReport();
// Returns suggestions for preventing common errors
```

### Error Correlation

Related errors are automatically linked:

```tsx
// Errors with the same correlation ID are grouped
correlateErrors([errorId1, errorId2, errorId3]);
```

### Learning System

Add learning notes to errors for future prevention:

```tsx
addLearningNote(errorId, "Use input validation to prevent this error");
```

### Export/Import

Export error data for analysis:

```tsx
const jsonData = exportErrors('json');
const csvData = exportErrors('csv');
```

## Best Practices

1. **Always wrap critical components** with `ErrorBoundaryWrapper`
2. **Use context parameters** to provide meaningful error context
3. **Enable retry for transient errors** (network, rate limits)
4. **Add tags** to categorize and search errors effectively
5. **Document resolutions** to build a knowledge base
6. **Monitor error patterns** to implement preventive measures

## Configuration

Customize error tracking behavior:

```tsx
// In errorTrackingStore.ts
settings: {
  autoResolveTimeout: 300000, // Auto-resolve low severity after 5 min
  maxErrorsStored: 1000,      // Maximum errors to keep in memory
  enableAutoRetry: true,       // Enable automatic retries
  retryDelays: [1000, 2000, 5000, 10000], // Exponential backoff
  enableErrorGrouping: true,   // Group similar errors
  enablePreventionSuggestions: true, // AI-powered suggestions
}
```

## Integration Examples

### With Gemini API

```tsx
try {
  const response = await callGeminiAPI(prompt);
} catch (error) {
  captureApiError('gemini-api', error, '/v1/models/gemini-pro');
}
```

### With Tool Execution

```tsx
const tracker = useOperationTracker();
await tracker.track(
  {
    type: 'tool_execution',
    name: 'analyze-code',
    description: 'Analyzing codebase',
  },
  async (updateProgress) => {
    // Tool execution with progress updates
  }
);
```

### With File Operations

```tsx
import { invokeWithErrorTracking } from '@/utils/errorWrappedApi';

const files = await invokeWithErrorTracking('read_directory', 
  { path: '/some/path' },
  {
    retryable: false,
    context: { 
      component: 'FileExplorer',
      operation: 'list-files'
    }
  }
);
```

## Troubleshooting

### Errors not being captured
1. Ensure `ErrorTrackingSetup` wraps your app
2. Check that global handlers are initialized
3. Verify error capture is called in catch blocks

### Dashboard not showing
1. Check `isErrorDashboardOpen` state
2. Ensure no z-index conflicts
3. Verify AnimatePresence is working

### Performance issues
1. Reduce `maxErrorsStored` if memory is high
2. Clear resolved errors periodically
3. Disable pattern detection for high-volume errors

## Future Enhancements

- [ ] Error replay functionality
- [ ] Team collaboration features
- [ ] AI-powered root cause analysis
- [ ] Integration with external monitoring services
- [ ] Custom error workflows and automation
- [ ] Performance impact analysis
- [ ] Error budget tracking