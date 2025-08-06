# Claudia Git Workflow System

An intelligent, automated git commit workflow system designed specifically for the Claudia project. This system categorizes changes, validates commits, and ensures consistent commit messages across the project.

## Features

- **Intelligent File Categorization**: Automatically groups files by domain (backend, frontend, components, etc.)
- **Semantic Commit Messages**: Enforces conventional commit format with emojis
- **Breaking Change Detection**: Identifies potential breaking changes
- **Sensitive Data Protection**: Warns about potential secrets in commits
- **Automated Testing**: Runs tests before commits
- **Backup System**: Creates restore points before major operations
- **Cross-Platform**: Works on Windows (PowerShell) and Unix systems (Node.js)

## Installation

1. Initialize the workflow system:
```bash
# Unix/Mac/Linux
node scripts/git-workflow.js init

# Windows PowerShell
powershell -File scripts/git-workflow.ps1 init
```

2. Make hooks executable (Unix only):
```bash
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/commit-msg
```

3. Configure git to use the commit template:
```bash
git config commit.template .gitmessage
```

## Usage

### Basic Commands

```bash
# Run auto-commit workflow (interactive)
git wf

# Show categorized status
git wf-status

# Create backup
git wf-backup

# Auto-commit with prompts
git wf-auto

# Commit current monitoring system (one-time use)
powershell -File scripts/git-workflow.ps1 commit-current
```

### Categories

The system automatically categorizes files into:

- 🔧 **backend**: Rust/Tauri backend files
- 🎨 **frontend**: TypeScript/React frontend files
- 🧩 **components**: React components
- 📚 **docs**: Documentation files
- ⚙️ **config**: Configuration files
- 🧪 **test**: Test files
- 📊 **monitoring**: Monitoring and observability
- 🤖 **gemini**: Gemini integration files
- 🚨 **error-handling**: Error handling components

### Commit Message Format

```
<emoji> <type>(<scope>): <description>

[optional body]

[optional footer]
```

Examples:
- `🎨 feat(frontend): add dark mode toggle`
- `🔧 fix(backend): resolve memory leak in gemini handler`
- `📚 docs(readme): update installation instructions`

### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Test additions/changes
- **build**: Build system changes
- **ci**: CI/CD changes
- **chore**: Maintenance tasks
- **revert**: Revert previous commit

## Configuration

Edit `.git-workflow.json` to customize:

- File categorization patterns
- Commit message templates
- Sensitive data patterns
- Breaking change detection
- Automation settings

## Current State Handling

For the current state with many new files, run:

```bash
# Windows PowerShell (recommended)
powershell -File scripts/git-workflow.ps1 commit-current

# This will:
# 1. Create a backup
# 2. Categorize all changes
# 3. Create logical commits:
#    - Monitoring system implementation
#    - Component additions
#    - Backend enhancements
#    - Documentation updates
#    - Frontend integrations
```

## Safety Features

1. **Pre-commit Validation**
   - TypeScript checking
   - Sensitive data detection
   - Code formatting validation

2. **Commit Message Validation**
   - Format enforcement
   - Type validation
   - Breaking change detection

3. **Backup System**
   - Automatic backups before major operations
   - Timestamped backup directories
   - State preservation

4. **Rollback Capability**
   - Restore from backups
   - Undo last commit: `git reset --soft HEAD~1`
   - Recovery from `.git-backups/`

## Troubleshooting

### Permission Issues (Unix)
```bash
chmod +x scripts/git-workflow.js
chmod +x .git/hooks/*
```

### PowerShell Execution Policy (Windows)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Hook Not Running
Ensure hooks are in `.git/hooks/` (not `.git/hooks.sample/`)

### Sensitive Data Warning
Review files and either:
- Remove sensitive data
- Add to `.gitignore`
- Proceed with caution

## Best Practices

1. **Review Before Commit**: Always review staged changes
2. **Descriptive Messages**: Write clear, concise commit descriptions
3. **Regular Backups**: Create backups before major changes
4. **Test First**: Run tests before committing
5. **Small Commits**: Keep commits focused and atomic

## Advanced Usage

### Custom Categories
Add to `.git-workflow.json`:
```json
{
  "categories": {
    "custom": {
      "patterns": ["src/custom/**/*"],
      "prefix": "custom",
      "emoji": "🎯",
      "defaultType": "feat"
    }
  }
}
```

### Batch Operations
```bash
# Stage all frontend changes
git add src/**/*.tsx

# Commit with specific type
git commit -m "🎨 refactor(frontend): reorganize component structure"
```

### Integration with CI/CD
The workflow system generates consistent commit messages that can trigger CI/CD pipelines based on commit types and scopes.

## Future Enhancements

- [ ] Automatic changelog generation
- [ ] Integration with issue tracking
- [ ] Commit signing automation
- [ ] PR description generation
- [ ] Semantic version bumping
- [ ] Git flow integration