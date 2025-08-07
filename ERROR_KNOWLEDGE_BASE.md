# Error Knowledge Base - Claudia Chat Application

## Overview
This document serves as a comprehensive knowledge base for critical errors encountered in the Claudia chat application. Each entry includes root cause analysis, resolution steps, prevention strategies, and diagnostic techniques.

---

## ERROR #001: Claude Session Management Failure

### Error Details
- **Error ID**: CLAUDE-SESSION-001
- **Timestamp**: 2025-08-06
- **Severity**: CRITICAL ✅ **RESOLVED**
- **Impact**: Users unable to resume Claude Code sessions
- **Affected Components**: Claude session management, CLI integration
- **User Impact**: 100% failure rate for session resume operations
- **Resolution Date**: 2025-08-06
- **Resolution Status**: ✅ **IMPLEMENTED** - Session validation with discovery across project directories

### Error Message
```
No conversation found with session ID: 6ead47ca-06a8-4694-9857-8a31de2b754f
```

### Root Cause Analysis

#### Chain of Events
1. User attempts to resume a Claude session using `--resume {session_id}` command
2. The `resume_claude_code` function attempts to locate the session file
3. Session file lookup fails in expected location: `~/.claude/projects/{project_id}/{session_id}.jsonl`
4. No graceful fallback or validation was in place
5. Error propagates to user without helpful context

#### Technical Root Cause
- **Primary Cause**: Missing session existence validation before attempting file operations
- **Secondary Cause**: Lack of error handling for missing session files
- **Contributing Factor**: No session discovery mechanism to help users find valid sessions
- **Design Flaw**: Assumption that session files always exist in expected location

### Resolution Process

#### Step 1: Pre-validation Implementation
```python
def validate_session_exists(session_id: str, project_id: str) -> bool:
    """Validate that a session file exists before attempting to resume."""
    session_path = Path.home() / ".claude" / "projects" / project_id / f"{session_id}.jsonl"
    return session_path.exists()
```

#### Step 2: Enhanced Session Loader
```python
def resume_claude_code(session_id: str, project_path: str = None):
    """Resume a Claude Code session with proper validation."""
    # Determine project path
    if not project_path:
        project_path = os.getcwd()
    
    # Get project ID
    project_id = get_project_id(project_path)
    
    # Validate session exists
    if not validate_session_exists(session_id, project_id):
        # Attempt session discovery
        available_sessions = discover_sessions(project_id)
        if available_sessions:
            print(f"Session {session_id} not found. Available sessions:")
            for session in available_sessions:
                print(f"  - {session['id']}: {session['created_at']}")
        else:
            print(f"No sessions found for project {project_id}")
        return False
    
    # Continue with session resume...
```

#### Step 3: Session Discovery Helper
```python
def discover_sessions(project_id: str) -> List[Dict]:
    """Discover all available sessions for a project."""
    sessions_dir = Path.home() / ".claude" / "projects" / project_id
    sessions = []
    
    if sessions_dir.exists():
        for session_file in sessions_dir.glob("*.jsonl"):
            session_id = session_file.stem
            # Parse first line to get session metadata
            with open(session_file, 'r') as f:
                first_line = f.readline()
                if first_line:
                    metadata = json.loads(first_line)
                    sessions.append({
                        'id': session_id,
                        'created_at': metadata.get('timestamp', 'Unknown'),
                        'model': metadata.get('model', 'Unknown')
                    })
    
    return sorted(sessions, key=lambda x: x['created_at'], reverse=True)
```

#### Step 4: Graceful Error Handling
```python
try:
    resume_claude_code(args.resume, args.path)
except SessionNotFoundError as e:
    logger.error(f"Session error: {e}")
    suggest_alternatives(e.session_id, e.project_id)
except Exception as e:
    logger.error(f"Unexpected error resuming session: {e}")
    sys.exit(1)
```

### Prevention Strategies

1. **Session Registry**: Maintain a central registry of active sessions
2. **Session Validation**: Always validate session existence before operations
3. **Auto-Discovery**: Implement session discovery for better UX
4. **Graceful Degradation**: Provide helpful alternatives when sessions are missing
5. **Session Metadata**: Store session metadata for easier discovery and validation
6. **Logging**: Comprehensive logging of session operations for debugging

### Diagnostic Techniques

1. **Session File Verification**:
   ```bash
   ls -la ~/.claude/projects/*/  # List all project sessions
   find ~/.claude -name "*.jsonl" -type f  # Find all session files
   ```

2. **Session Content Inspection**:
   ```bash
   head -n 1 ~/.claude/projects/{project_id}/{session_id}.jsonl | jq .
   ```

3. **Debug Logging**:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   logger = logging.getLogger(__name__)
   logger.debug(f"Looking for session: {session_id} in {session_path}")
   ```

### Testing Approach

1. **Unit Tests**:
   ```python
   def test_session_validation():
       # Test with non-existent session
       assert not validate_session_exists("fake-session", "test-project")
       
       # Test with valid session
       # Create mock session file
       mock_session_path.touch()
       assert validate_session_exists("valid-session", "test-project")
   ```

2. **Integration Tests**:
   - Test session resume with valid session
   - Test session resume with invalid session
   - Test session discovery functionality
   - Test error handling and user feedback

### Vulnerable Integration Points

1. **File System Dependencies**: Relies on specific directory structure
2. **Project ID Generation**: Depends on consistent project ID algorithm
3. **Session File Format**: Assumes JSONL format with specific structure
4. **CLI Arguments**: Vulnerable to malformed input
5. **Path Resolution**: OS-specific path handling issues

---

## ERROR #002: Gemini Chat Non-Responsiveness

### Error Details
- **Error ID**: GEMINI-CHAT-001
- **Timestamp**: 2025-08-06
- **Severity**: CRITICAL ✅ **RESOLVED**
- **Impact**: Chat appears to send but no response received
- **Affected Components**: Gemini backend, Event emission system, Frontend listeners
- **User Impact**: 100% failure rate for Gemini chat responses
- **Resolution Date**: 2025-08-06
- **Resolution Status**: ✅ **IMPLEMENTED** - Dual event emission pattern (generic + session-specific)

### Error Message
```
(No visible error - silent failure)
Chat message sent but no response received in UI
```

### Root Cause Analysis

#### Chain of Events
1. User sends a message through Gemini chat interface
2. Backend successfully processes the request and calls Gemini API
3. Gemini API returns valid response
4. Backend attempts to emit events to frontend
5. Events are emitted but not received by frontend listeners
6. User sees no response despite successful backend processing

#### Technical Root Cause
- **Primary Cause**: Event emission pattern mismatch between backend and frontend
- **Secondary Cause**: Missing session-specific event channels
- **Contributing Factor**: Lack of event emission debugging tools
- **Design Flaw**: No acknowledgment mechanism for event delivery

### Resolution Process

#### Step 1: Dual Event Emission Pattern
```rust
// Emit both generic and session-specific events
app_handle.emit("claude-output", serde_json::to_string(&message).unwrap())
    .map_err(|e| format!("Failed to emit message: {}", e))?;
    
app_handle.emit(&format!("claude-output:{}", session_id), 
    serde_json::to_string(&message).unwrap())
    .map_err(|e| format!("Failed to emit session-specific message: {}", e))?;
```

#### Step 2: Comprehensive Event Logging
```rust
log::info!("Starting Gemini execution - model: {}, project: {}", model, project_path);
log::info!("Sending request to Gemini API for session: {}", session_id);
log::info!("Gemini API response status: {} for session: {}", status, session_id);
log::info!("Gemini execution completed successfully for session: {}", session_id);
```

#### Step 3: Test Event Emission Command
```rust
#[tauri::command]
pub async fn test_gemini_events(
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    log::info!("Testing Gemini event emission");
    
    let test_session_id = format!("gemini-test-{}", 
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis());
    
    // Emit test init message
    let init_message = serde_json::json!({
        "type": "system",
        "subtype": "init",
        "session_id": test_session_id,
        "model": "gemini-test",
        "cwd": "/test/path",
        "tools": [],
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });
    
    // Emit both event types
    app_handle.emit("claude-output", 
        serde_json::to_string(&init_message).unwrap())?;
    app_handle.emit(&format!("claude-output:{}", test_session_id), 
        serde_json::to_string(&init_message).unwrap())?;
    
    Ok(())
}
```

#### Step 4: Frontend Event Listener Enhancement
```typescript
// Listen for both generic and session-specific events
useEffect(() => {
    const unsubscribeGeneric = listen('claude-output', (event) => {
        handleChatMessage(event.payload);
    });
    
    const unsubscribeSession = listen(`claude-output:${sessionId}`, (event) => {
        handleChatMessage(event.payload);
    });
    
    return () => {
        unsubscribeGeneric();
        unsubscribeSession();
    };
}, [sessionId]);
```

### Prevention Strategies

1. **Event Contract Testing**: Test event emission/reception during CI/CD
2. **Event Debugging Tools**: Built-in test commands for event verification
3. **Event Acknowledgment**: Implement acknowledgment pattern for critical events
4. **Comprehensive Logging**: Log all event emissions with session context
5. **Event Schema Validation**: Validate event payloads match expected schema
6. **Fallback Mechanisms**: Polling fallback if events fail

### Diagnostic Techniques

1. **Event Emission Testing**:
   ```bash
   # Test event emission from backend
   curl -X POST http://localhost:1420/test_gemini_events
   ```

2. **Frontend Event Monitoring**:
   ```javascript
   // Add to browser console
   window.__TAURI__.event.listen('claude-output', console.log);
   window.__TAURI__.event.listen('claude-error', console.log);
   ```

3. **Backend Log Analysis**:
   ```bash
   # Check Tauri logs for event emission
   tail -f ~/.config/{app-name}/logs/tauri.log | grep "event"
   ```

4. **Event Channel Inspection**:
   ```rust
   // Add debug endpoint to list active event channels
   #[tauri::command]
   pub async fn debug_event_channels() -> Vec<String> {
       // Return list of active event channels
   }
   ```

### Testing Approach

1. **Unit Tests**:
   ```rust
   #[test]
   fn test_event_emission() {
       let mock_handle = create_mock_app_handle();
       let result = emit_chat_event(&mock_handle, "test", "message");
       assert!(result.is_ok());
   }
   ```

2. **Integration Tests**:
   ```typescript
   it('should receive Gemini chat responses', async () => {
       const mockListener = jest.fn();
       await listen('claude-output', mockListener);
       
       await invoke('execute_gemini_code', {
           prompt: 'Test prompt',
           model: 'gemini-2.0-flash-exp',
           projectPath: '/test'
       });
       
       expect(mockListener).toHaveBeenCalled();
   });
   ```

3. **E2E Tests**:
   - Send chat message through UI
   - Verify response appears in chat window
   - Test with different models and prompts
   - Test error scenarios

### Vulnerable Integration Points

1. **Event Channel Names**: Must match exactly between backend/frontend
2. **Session ID Generation**: Consistent format required
3. **Event Payload Structure**: Frontend expects specific JSON structure
4. **Timing Issues**: Race conditions between event emission and listener setup
5. **Memory Leaks**: Unsubscribed event listeners
6. **Cross-Platform**: Event behavior may vary across OS

### Lessons Learned

1. **Always Emit Dual Events**: Support both generic and session-specific listeners
2. **Test Event Flow**: Don't assume events work - test explicitly
3. **Comprehensive Logging**: Log at every critical point
4. **Debugging Tools**: Build diagnostic tools before you need them
5. **Event Documentation**: Document event contracts clearly
6. **Graceful Degradation**: Have fallbacks for event failures

---

## Best Practices for Future Development

### Error Prevention Checklist
- [ ] Validate all inputs and preconditions
- [ ] Implement comprehensive error handling
- [ ] Add diagnostic and debugging tools
- [ ] Test integration points explicitly
- [ ] Document event contracts and APIs
- [ ] Log at appropriate levels
- [ ] Provide helpful error messages
- [ ] Build recovery mechanisms

### Monitoring and Alerting
1. Track error rates for critical operations
2. Monitor event emission success rates
3. Alert on repeated failures
4. Collect user feedback on errors
5. Analyze error patterns for systemic issues

### Documentation Standards
1. Document all error codes and meanings
2. Maintain runbooks for common issues
3. Keep integration documentation current
4. Document debugging procedures
5. Share knowledge across team

---

*Last Updated: 2025-08-06*
*Version: 1.0.0*