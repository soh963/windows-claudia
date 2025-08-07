# CRUSH.md - Critical Requirements & Updates for Session Health

## 🚨 CRITICAL ISSUES TO RESOLVE

### Original Guidelines
This file contains both critical implementation requirements AND the original project guidelines for AI agents. Both sections are essential for maintaining project quality and resolving critical issues.

## Build Commands

*   **Frontend (TypeScript/React):**
    *   `bun build` - Builds the frontend application.
*   **Backend (Rust/Tauri):**
    *   `cargo build` - Builds the Rust backend.

## Linting & Type Checking

*   **Frontend (TypeScript):**
    *   `bun run check` - Runs TypeScript type checking.
*   **Backend (Rust):**
    *   `cargo clippy` - Performs Rust linting.

## Test Commands

*   **Frontend (TypeScript/React):**
    *   `bun test` - Runs all frontend tests.
    *   `bun test <path/to/specific.test.tsx>` - Runs a single frontend test file.
*   **Backend (Rust):**
    *   `cargo test` - Runs all Rust tests.
    *   `cargo test <test_name>` - Runs a single Rust test function.

## Code Style Guidelines

*   **General:** Adhere to existing project conventions. Prioritize clarity and maintainability.
*   **TypeScript/React:**
    *   **Imports:** Use ES module imports. Group imports logically (e.g., external, internal, relative).
    *   **Formatting:** Follow Prettier-like formatting. Maintain consistent indentation (2 spaces).
    *   **Types:** Utilize TypeScript interfaces and types for strong typing. Ensure all new code is type-safe.
    *   **Naming Conventions:** Use `PascalCase` for React components, `camelCase` for variables, functions, and hooks.
    *   **Components:** Prefer functional components and React hooks.
    *   **Error Handling:** Use `try...catch` blocks for asynchronous operations and API calls.
*   **Rust:**
    *   **Formatting:** Use `cargo fmt` to auto-format code.
    *   **Linting:** Use `cargo clippy` to catch common mistakes and improve code.
    *   **Error Handling:** Employ idiomatic Rust error handling, leveraging the `anyhow` crate for simplified error propagation.
*   **Comments:** Add comments sparingly, focusing on _why_ a particular approach was taken for complex logic, rather than _what_ the code does. Do not use comments to communicate with the user.

## 🔥 CRITICAL IMPLEMENTATION REQUIREMENTS

### 1. Session Contamination Prevention
**SEVERITY: CRITICAL**
**STATUS: IN PROGRESS**

#### Problem
- Sessions are mixing content between different instances
- Duplicate responses appearing in output
- Session IDs not properly isolated

#### Solution Architecture
```typescript
// MUST IMPLEMENT: Strong session isolation
class SessionIsolationManager {
    private sessionBoundaries: Map<string, SessionBoundary> = new Map();
    
    createIsolatedSession(modelType: string): string {
        const sessionId = this.generateSecureId();
        const boundary = new SessionBoundary({
            id: sessionId,
            memorySpace: new IsolatedMemory(),
            eventChannel: new IsolatedEventChannel(sessionId),
            fileSystem: new SandboxedFileSystem(sessionId),
            networkSpace: new IsolatedNetwork(sessionId)
        });
        
        this.sessionBoundaries.set(sessionId, boundary);
        return sessionId;
    }
    
    private generateSecureId(): string {
        // UUID v4 + timestamp + random salt
        const uuid = crypto.randomUUID();
        const timestamp = Date.now();
        const salt = crypto.randomBytes(16).toString('hex');
        return `${uuid}-${timestamp}-${salt}`;
    }
}
```

### 2. Dynamic Model Detection System
**SEVERITY: HIGH**
**STATUS: PENDING**

#### Requirements
- Query all AI providers on startup
- Cache available models
- Implement hot-reload mechanism
- Create fallback chains

### 3. Universal Feature Matrix
**SEVERITY: HIGH**
**STATUS: PENDING**

| Feature | Claude | Gemini | Ollama | Implementation |
|---------|--------|--------|--------|----------------|
| Agents | ✅ | ⚠️ | ❌ | Need unified interface |
| MCP | ✅ | ❌ | ❌ | Extend to all models |
| Slash Commands | ✅ | ⚠️ | ❌ | Create adapter layer |
| Checkpoints | ✅ | ⚠️ | ⚠️ | Standardize format |

### 4. Comprehensive Debugging System
**SEVERITY: MEDIUM**
**STATUS: PENDING**

- Implement multi-level logging (TRACE to CRITICAL)
- Add operation tracing with call stacks
- Create dependency validation system
- Add performance profiling

### 5. Documentation Requirements
**SEVERITY: HIGH**
**STATUS: IN PROGRESS**

```
doc/
├── QUICKSTART.md
├── ARCHITECTURE.md
├── API_REFERENCE.md
├── TROUBLESHOOTING.md
├── development/
│   ├── dev-list.md
│   ├── setup.md
│   └── testing.md
└── features/
    ├── sessions.md
    ├── models.md
    └── debugging.md
```

### 6. Error Knowledge Base
**SEVERITY: MEDIUM**
**STATUS: PENDING**

- Automatic error capture and fingerprinting
- Resolution tracking and auto-fix capabilities
- Pattern analysis and prevention strategies

### 7. Visual Progress Tracker (Left Panel)
**SEVERITY: LOW**
**STATUS: PENDING**

- Goals list with status tracking
- Metrics display (completion %, velocity)
- Charts (burndown, velocity trend)

### 8. Task Timeline (Right Panel)
**SEVERITY: LOW**
**STATUS: PENDING**

- Session summaries with task details
- Success/failure visualization
- Analytics and trends

## 🎯 IMMEDIATE ACTION ITEMS

### Today (Priority 1)
1. [ ] Fix session isolation to prevent mixing
2. [ ] Implement deduplication for responses
3. [ ] Add session validation before operations

### This Week (Priority 2)
1. [ ] Complete model detection system
2. [ ] Create unified model interface
3. [ ] Set up error knowledge base
4. [ ] Document critical paths

### Next Week (Priority 3)
1. [ ] Implement debugging system
2. [ ] Create visual progress tracker
3. [ ] Build task timeline
4. [ ] Complete test coverage

## 📊 Success Metrics

- **Session Integrity**: 0% contamination rate
- **Response Accuracy**: 100% unique responses
- **Model Availability**: 99.9% uptime
- **Error Resolution**: <5 min average
- **Test Coverage**: >80%

## 🚧 Known Blockers

1. **Session Mixing**: Critical - affecting user experience
2. **MCP Integration**: Gemini/Ollama don't fully support MCP
3. **Performance**: Large sessions causing memory issues
4. **Documentation**: Incomplete API documentation

## 📝 Notes for Next Session

When continuing development:
1. Check this file first for critical issues
2. Review CLAUDE.md for implementation checklist
3. Check CLAUDIA.md for technical details
4. Update progress in all tracking files
5. Test session isolation thoroughly
6. Document any new issues discovered

---

**CRITICAL**: This document contains both project guidelines AND critical issues that MUST be resolved.

**Last Updated**: August 2025
**Version**: 1.1.0
**Status**: ACTIVE CRITICAL DEVELOPMENT
