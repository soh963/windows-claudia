# Error Tracking System Documentation

## Overview
The Claudia Error Tracking System is a comprehensive solution for capturing, categorizing, analyzing, and auto-resolving errors in the application. It provides real-time monitoring, pattern recognition, and intelligent auto-resolution capabilities.

## Architecture

### Backend (Rust/Tauri)
- **Location**: `src-tauri/src/commands/error_tracker.rs`
- **Database**: SQLite with multiple tables for errors, patterns, and resolution history
- **Event System**: Real-time event emission for error tracking and resolution

### Frontend (TypeScript/Svelte)
- **Store**: `src/lib/stores/errorTrackerStore.ts`
- **Components**: `src/components/ErrorTracker/`
- **Integration**: `src/lib/utils/errorIntegration.ts`

## Key Features

### 1. Automatic Error Capture
- Global error handlers for unhandled errors
- Promise rejection tracking
- Console error interception
- API error tracking
- Session error monitoring

### 2. Error Categorization
Categories include:
- **SessionManagement**: Session-related errors
- **ModelIntegration**: AI model integration issues
- **FileSystem**: File and path errors
- **Network**: API and network issues
- **Authentication**: Auth and credential problems
- **Database**: Database operations
- **UI**: Rendering and display issues
- **Performance**: Performance bottlenecks
- **Configuration**: Config and settings errors

### 3. Severity Levels
- **Critical**: System-breaking errors requiring immediate attention
- **High**: Major functionality impaired
- **Medium**: Feature-specific issues
- **Low**: Minor issues or warnings

### 4. Auto-Resolution Strategies

#### Pattern-Based Detection
The system includes pre-configured patterns for common errors:
- Session not found → Session recovery
- API quota exceeded → Exponential backoff retry
- Authentication failure → Token refresh
- UI duplication → Element cleanup
- Network timeout → Retry with increased timeout

#### Resolution Types
- **SessionRecovery**: Create new session or recover existing
- **ApiRetry**: Retry with exponential backoff
- **AuthRefresh**: Refresh authentication tokens
- **UiCleanup**: Clear caches and reset listeners
- **NetworkRetry**: Retry with timeout adjustment
- **CacheClear**: Clear application caches
- **ConfigReload**: Reload configuration
- **Custom**: Custom resolution logic

### 5. Dashboard & Analytics

#### Metrics Dashboard
- Total errors in time range
- Resolution rate
- Auto-resolution rate
- Recurring errors count
- Error distribution by category/severity
- Top errors by occurrence

#### Error Management
- Search and filter capabilities
- Detailed error views
- Manual resolution workflow
- Root cause documentation
- Prevention strategy tracking

## Database Schema

### error_knowledge Table
```sql
CREATE TABLE error_knowledge (
    id TEXT PRIMARY KEY,
    error_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    resolved_at INTEGER,
    status TEXT NOT NULL,
    root_cause TEXT,
    resolution_steps TEXT,
    prevention_strategies TEXT,
    occurrences INTEGER DEFAULT 1,
    last_occurrence INTEGER NOT NULL,
    context TEXT,
    stack_trace TEXT,
    session_id TEXT,
    auto_resolved BOOLEAN DEFAULT 0,
    pattern_id TEXT
)
```

### error_patterns Table
```sql
CREATE TABLE error_patterns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pattern_regex TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    auto_resolution TEXT,
    keywords TEXT,
    enabled BOOLEAN DEFAULT 1,
    success_count INTEGER DEFAULT 0,
    attempt_count INTEGER DEFAULT 0
)
```

### resolution_history Table
```sql
CREATE TABLE resolution_history (
    id TEXT PRIMARY KEY,
    error_id TEXT NOT NULL,
    strategy_type TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    success BOOLEAN,
    notes TEXT,
    FOREIGN KEY (error_id) REFERENCES error_knowledge(id)
)
```

## API Reference

### Rust Commands

#### track_error
```rust
track_error(
    app_handle: AppHandle,
    error_message: String,
    component: String,
    category: Option<String>,
    severity: Option<String>,
    stack_trace: Option<String>,
    context: Option<HashMap<String, String>>,
    session_id: Option<String>
) -> Result<String, String>
```

#### get_error_metrics
```rust
get_error_metrics(
    time_range_hours: Option<i32>
) -> Result<ErrorMetrics, String>
```

#### search_errors
```rust
search_errors(
    category: Option<String>,
    severity: Option<String>,
    status: Option<String>,
    search_text: Option<String>,
    session_id: Option<String>,
    limit: Option<u32>
) -> Result<Vec<ErrorEntry>, String>
```

#### resolve_error
```rust
resolve_error(
    error_id: String,
    status: String,
    root_cause: Option<String>,
    resolution_steps: Vec<String>,
    prevention_strategies: Vec<String>
) -> Result<(), String>
```

### TypeScript/Frontend API

#### Store Methods
```typescript
// Track a new error
errorTrackerStore.trackError(
    errorMessage: string,
    component: string,
    options?: {
        category?: ErrorCategory;
        severity?: ErrorSeverity;
        stackTrace?: string;
        context?: Record<string, string>;
        sessionId?: string;
    }
): Promise<string | null>

// Load errors with filters
errorTrackerStore.loadErrors(filters?: ErrorFilter): Promise<void>

// Get error metrics
errorTrackerStore.loadMetrics(timeRangeHours?: number): Promise<void>

// Resolve an error
errorTrackerStore.resolveError(
    errorId: string,
    status: ErrorStatus,
    rootCause?: string,
    resolutionSteps?: string[],
    preventionStrategies?: string[]
): Promise<void>
```

## Integration Guide

### 1. Initialize Error Tracking
```typescript
import { initializeErrorTracking } from '$lib/utils/errorIntegration';

// In your app initialization
onMount(() => {
    initializeErrorTracking();
});
```

### 2. Track Custom Errors
```typescript
import { errorTrackerStore, ErrorCategory, ErrorSeverity } from '$lib/stores/errorTrackerStore';

// Track a custom error
try {
    // Your code
} catch (error) {
    await errorTrackerStore.trackError(
        error.message,
        'MyComponent',
        {
            category: ErrorCategory.UI,
            severity: ErrorSeverity.Medium,
            stackTrace: error.stack,
            context: { userId: currentUser.id }
        }
    );
}
```

### 3. Use Error Tracking Wrapper
```typescript
import { withErrorTracking } from '$lib/utils/errorIntegration';

// Wrap async functions
const safeFunction = withErrorTracking(
    async (param1, param2) => {
        // Your async code
    },
    'ComponentName',
    { category: ErrorCategory.Network }
);
```

### 4. Add Dashboard to UI
```svelte
<script>
import ErrorDashboard from '$components/ErrorTracker/ErrorDashboard.svelte';
</script>

<ErrorDashboard />
```

## Event System

### Events Emitted

#### error-tracked
Emitted when a new error is tracked
```json
{
    "error_id": "ERR-123456789ABCDEF0",
    "error_code": "ERR-123456789ABCDEF0",
    "category": "Network",
    "severity": "High"
}
```

#### error-auto-resolved
Emitted when an error is automatically resolved
```json
{
    "error_id": "ERR-123456789ABCDEF0",
    "error_code": "ERR-123456789ABCDEF0",
    "strategy": "ApiRetry"
}
```

#### ui-cleanup-required
Emitted when UI cleanup is needed
```json
{
    "error_code": "ERR-123456789ABCDEF0",
    "clear_cache": true,
    "reset_listeners": true
}
```

## Default Error Patterns

### Session Not Found
- **Pattern**: `(?i)session.*not.*found|no.*session|session.*missing`
- **Auto-Resolution**: Create new session with retry
- **Category**: SessionManagement
- **Severity**: High

### API Quota Exceeded
- **Pattern**: `(?i)quota.*exceed|rate.*limit|429|too.*many.*request`
- **Auto-Resolution**: Exponential backoff retry
- **Category**: Network
- **Severity**: High

### Authentication Failure
- **Pattern**: `(?i)auth.*fail|invalid.*credential|unauthorized|401`
- **Auto-Resolution**: Token refresh with fallback
- **Category**: Authentication
- **Severity**: Critical

### UI Duplication
- **Pattern**: `(?i)duplicate.*render|multiple.*instance|repeated.*element`
- **Auto-Resolution**: Cache clear and listener reset
- **Category**: UI
- **Severity**: Medium

### Network Timeout
- **Pattern**: `(?i)timeout|timed.*out|connection.*timeout`
- **Auto-Resolution**: Retry with increased timeout
- **Category**: Network
- **Severity**: Medium

## Performance Considerations

### Caching
- Error patterns are cached in memory
- Metrics are calculated on-demand with time-based filtering
- Resolution strategies are evaluated once per error

### Database Optimization
- Indexed columns for fast queries
- Automatic cleanup of old resolved errors (configurable)
- Batch operations for multiple error updates

### Real-time Updates
- Event-driven architecture for instant updates
- Optional auto-refresh (30-second intervals)
- Debounced UI updates to prevent flashing

## Best Practices

### 1. Error Message Quality
- Use descriptive, actionable error messages
- Include relevant context without sensitive data
- Follow consistent naming conventions

### 2. Resolution Documentation
- Always document root causes when resolving
- List specific steps taken to resolve
- Include prevention strategies for future

### 3. Pattern Management
- Review and update patterns regularly
- Monitor auto-resolution success rates
- Disable patterns with low success rates

### 4. Security Considerations
- Never log sensitive data (passwords, tokens)
- Sanitize user input in error messages
- Limit stack trace exposure in production

## Troubleshooting

### Common Issues

#### Errors Not Being Tracked
1. Check if error tracking is initialized
2. Verify database tables are created
3. Check console for tracking errors
4. Ensure proper error categorization

#### Auto-Resolution Not Working
1. Verify pattern matches error message
2. Check if pattern is enabled
3. Review resolution strategy configuration
4. Check resolution history for failures

#### Dashboard Not Updating
1. Check if real-time updates are enabled
2. Verify event listeners are connected
3. Check browser console for errors
4. Ensure proper WebSocket connection

## Future Enhancements

### Planned Features
- [ ] Machine learning for pattern detection
- [ ] Predictive error prevention
- [ ] Team collaboration features
- [ ] External alerting (email, Slack)
- [ ] Error replay and debugging tools
- [ ] Performance impact analysis
- [ ] A/B testing for resolution strategies
- [ ] Export/import error knowledge base

### API Improvements
- GraphQL endpoint for complex queries
- Webhook support for external integrations
- Batch error tracking API
- Real-time streaming API

## Version History

### v1.0.0 (Current)
- Initial implementation
- Basic error tracking and categorization
- Pattern-based auto-resolution
- Dashboard and analytics
- Session and API error integration

---

**Last Updated**: August 2025
**Maintainer**: Claudia Development Team