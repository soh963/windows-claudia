# Build Troubleshooting Guide

This document contains common build issues encountered during Claudia development and their solutions.

## Table of Contents
- [React Error #130](#react-error-130)
- [TypeScript Syntax Errors](#typescript-syntax-errors)
- [Duplicate Component Declarations](#duplicate-component-declarations)
- [Build Warnings](#build-warnings)

---

## React Error #130

### Error Description
```
Minified React error #130; visit https://reactjs.org/docs/error-decoder.html?invariant=130&args[]=undefined&args[]= for the full message
```

### Root Cause
React Error #130 occurs when a component attempts to render `undefined`. This typically happens with:
- Immediately Invoked Function Expressions (IIFE) returning empty fragments `<></>`
- Conditional rendering returning `undefined` instead of `null`

### Solution
Replace all instances of `return <></>` with `return null` in component render methods.

**Example Fix:**
```typescript
// ❌ Incorrect - causes React Error #130
if (condition) {
  return <></>;
}

// ✅ Correct
if (condition) {
  return null;
}
```

**Files Fixed:**
- `src/components/StreamMessage.tsx` - Multiple instances of `return <></>` replaced with `return null`

### Prevention
- Always return `null` for empty renders, not empty fragments
- Be especially careful with IIFE in JSX expressions
- Use ESLint rules to catch these patterns

---

## TypeScript Syntax Errors

### Error 1: Unterminated String Literal

**Error:**
```
src/components/ToolWidgets.tsx(1792,3): error TS1005: ';' expected.
src/components/ToolWidgets.tsx(1792,4): error TS1002: Unterminated string literal.
```

**Cause:**
Stray characters `'''` were inserted at line 1792, breaking the syntax.

**Solution:**
Remove the invalid characters:
```typescript
// Line 1792 had:
'''
export const ThinkingWidget...

// Fixed to:
export const ThinkingWidget...
```

### Error 2: Invalid Arrow Function Syntax

**Error:**
```
export const SystemReminderWidget: React.FC<{ message: string }> = ({ message }) => {''
```

**Cause:**
Extra `''` characters appended after the arrow function declaration.

**Solution:**
```typescript
// ❌ Incorrect
export const SystemReminderWidget: React.FC<{ message: string }> = ({ message }) => {''

// ✅ Correct
export const SystemReminderWidget: React.FC<{ message: string }> = ({ message }) => {
```

---

## Duplicate Component Declarations

### Error Description
```
src/components/ToolWidgets.tsx(1792,14): error TS2451: Cannot redeclare block-scoped variable 'ThinkingWidget'.
src/components/ToolWidgets.tsx(2310,14): error TS2451: Cannot redeclare block-scoped variable 'ThinkingWidget'.
```

### Cause
The `ThinkingWidget` component was declared twice in the same file:
1. Simple version at line 1792
2. Full-featured version with collapsible UI at line 2310

### Solution
Remove the duplicate declaration, keeping only the more complete implementation:

```typescript
// Removed simple version (lines 1792-1807)
// Kept full version with collapse functionality (lines 2310-2349)
```

### Prevention
- Use consistent naming conventions
- Regular code reviews to catch duplicates
- Consider using TypeScript's module system to organize components

---

## Build Warnings

### Rust Compilation Warnings

The following warnings appeared during Rust compilation but don't affect functionality:

1. **Unused Imports**
   ```
   warning: unused imports: `create_project_if_not_exists` and `normalize_path`
   ```
   - Location: `src/commands/dashboard.rs`
   - Impact: None - just cleanup needed

2. **Unused Variables**
   ```
   warning: variable `total_checks` is assigned to, but never used
   ```
   - Location: `src/analysis/mod.rs:131`
   - Solution: Prefix with underscore: `_total_checks`

3. **Dead Code**
   ```
   warning: constant `CREATE_NO_WINDOW` is never used
   ```
   - Multiple locations
   - These are Windows-specific constants kept for potential future use

### Frontend Build Warnings

Dynamic import warnings from Vite:
```
(!) Component is dynamically imported but also statically imported, 
dynamic import will not move module into another chunk.
```

**Affected Files:**
- `MarkdownEditor.tsx`
- `Settings.tsx`
- `CreateAgent.tsx`
- etc.

**Impact:** None - just optimization opportunity missed
**Solution:** Remove either static or dynamic imports to enable code splitting

---

## Build Process Summary

### Successful Build Output

Version 0.2.1 built successfully with:
- **MSI Installer**: `Claudia_0.2.1_x64_en-US.msi` (11.6 MB)
- **NSIS Installer**: `Claudia_0.2.1_x64-setup.exe` (7.4 MB)

### Build Time
- TypeScript + Vite: ~5 seconds
- Rust compilation: ~2 minutes 17 seconds
- Total: ~2.5 minutes

### Bundle Sizes
- Total JavaScript: ~3.5 MB
- Gzipped: ~1 MB
- Largest chunks:
  - `editor-vendor`: 1.1 MB (375 KB gzipped)
  - `index`: 650 KB (157 KB gzipped)
  - `syntax-vendor`: 603 KB (207 KB gzipped)

---

## Version Update Process

To update version for a new build:

1. **Update package.json**
   ```json
   "version": "0.2.1",
   ```

2. **Update Cargo.toml**
   ```toml
   version = "0.2.1"
   ```

3. **Update tauri.conf.json**
   ```json
   "version": "0.2.1",
   ```

4. **Build Command**
   ```bash
   bun run tauri build
   ```

---

## Common Solutions Checklist

When encountering build errors:

1. ✅ Check for syntax errors in TypeScript files
2. ✅ Look for duplicate component declarations
3. ✅ Ensure all `return <></>` are replaced with `return null`
4. ✅ Verify version numbers match across all config files
5. ✅ Run `tsc --noEmit` to check TypeScript errors before full build
6. ✅ Check for stray characters or malformed syntax

## Quick Commands

```bash
# Check TypeScript errors only
tsc --noEmit

# Clean build
rm -rf dist src-tauri/target
bun run tauri build

# Development mode
bun run dev

# Build for production
bun run tauri build
```

---

Last Updated: 2025-08-01
Version: 0.2.1