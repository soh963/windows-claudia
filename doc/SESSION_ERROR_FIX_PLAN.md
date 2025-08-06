# Session Error Fix Plan: "No conversation found with session ID"

## Problem Analysis

The error "No conversation found with session ID" is occurring due to session file lookup failures in the Rust backend.

## Root Causes Identified

1. **File Path Mismatch**
   - Frontend expects: `~/.claude/projects/{project_id}/{session_id}.jsonl`
   - Actual location may differ due to project_id encoding differences

2. **Timing Issues**
   - Session file may not exist yet when UI tries to load it
   - Race condition between session creation and file system write

3. **Windows Path Issues**
   - Path separator differences between Windows and Unix
   - Special character handling in project paths

## Immediate Fix Implementation

### 1. Enhanced Error Logging

Add detailed logging to identify exact failure points:

```rust
// In load_session_history function
log::info!("Looking for session file at: {}", session_path.display());
if !session_path.exists() {
    log::error!("Session file not found. Expected path: {}", session_path.display());
    log::info!("Checking if parent directory exists: {}", session_path.parent().unwrap().display());
    
    // List all files in the directory for debugging
    if let Ok(entries) = fs::read_dir(session_path.parent().unwrap()) {
        for entry in entries {
            if let Ok(entry) = entry {
                log::debug!("Found file: {}", entry.path().display());
            }
        }
    }
}
```

### 2. Session Recovery Mechanism

Implement a more robust session discovery:

```rust
pub async fn find_session_file(session_id: &str) -> Result<PathBuf, String> {
    let claude_dir = get_claude_dir()?;
    let projects_dir = claude_dir.join("projects");
    
    // Search all project directories
    for entry in fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            let session_file = entry.path().join(format!("{}.jsonl", session_id));
            if session_file.exists() {
                return Ok(session_file);
            }
        }
    }
    
    Err(format!("Session file not found for ID: {}", session_id))
}
```

### 3. Frontend Retry Logic

Add retry mechanism with exponential backoff:

```typescript
async loadSessionHistory(sessionId: string, projectId: string, maxRetries = 3): Promise<any[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await invoke("load_session_history", { sessionId, projectId });
    } catch (error) {
      lastError = error as Error;
      console.warn(`Session load attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 500ms, 1s, 2s
        const delay = Math.pow(2, attempt) * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If all retries failed, try recovery
  console.error("All session load attempts failed, attempting recovery...");
  return await invoke("recover_session", { sessionId });
}
```

### 4. Session Validation

Add pre-flight checks before attempting to load:

```rust
#[tauri::command]
pub async fn validate_session_exists(
    session_id: String,
    project_id: String,
) -> Result<bool, String> {
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let session_path = claude_dir
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));
    
    Ok(session_path.exists())
}
```

### 5. Project ID Normalization

Ensure consistent project ID encoding:

```typescript
function normalizeProjectId(projectPath: string): string {
  // Ensure consistent encoding for project IDs
  return projectPath
    .replace(/[\\\/]/g, '-')  // Replace path separators
    .replace(/[^a-zA-Z0-9-]/g, '-')  // Replace special chars
    .replace(/-+/g, '-')  // Collapse multiple dashes
    .toLowerCase();
}
```

## Testing Strategy

1. **Unit Tests**
   - Test session file discovery with various path formats
   - Test retry logic with simulated failures
   - Test project ID normalization

2. **Integration Tests**
   - Test full session loading flow
   - Test recovery mechanisms
   - Test cross-platform path handling

3. **Manual Testing**
   - Create sessions with special characters in paths
   - Test on Windows with various drive letters
   - Test network drives and long paths

## Rollout Plan

1. **Phase 1**: Deploy enhanced logging (immediate)
2. **Phase 2**: Implement retry logic (24 hours)
3. **Phase 3**: Add recovery mechanism (48 hours)
4. **Phase 4**: Full testing and validation (72 hours)

## Monitoring

- Track session load success rate
- Monitor retry attempts and failures
- Log recovery mechanism usage
- Alert on high failure rates

## Success Criteria

- Session load success rate > 99.9%
- Average load time < 500ms
- Zero unrecoverable session errors
- Clear error messages for actual failures