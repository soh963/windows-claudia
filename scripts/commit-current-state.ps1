# Claudia - Commit Current State Script
# Handles the current monitoring system implementation

Write-Host "🚀 Committing Claudia Monitoring System Implementation" -ForegroundColor Cyan
Write-Host ""

# Create backup first
$timestamp = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
$backupDir = ".git-backups\$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Save current branch and commit
$branch = git branch --show-current
$commit = git rev-parse HEAD
@{
    Branch = $branch
    Commit = $commit
    Timestamp = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content "$backupDir\state.json"

Write-Host "✅ Backup created: $backupDir" -ForegroundColor Green
Write-Host ""

# Function to stage and commit files
function Create-Commit {
    param($Pattern, $Message)
    
    $files = git status --porcelain | Where-Object { $_ -match $Pattern }
    if ($files) {
        Write-Host "📦 Staging files matching: $Pattern" -ForegroundColor Yellow
        $files | ForEach-Object {
            $file = ($_ -split '\s+', 2)[1]
            if ($_ -match '^\s*D\s') {
                git rm $file 2>$null
            } else {
                git add $file
            }
        }
        
        git commit -m $Message
        Write-Host "✅ Created commit: $Message" -ForegroundColor Green
        Write-Host ""
    }
}

# Commit 1: Backend Gemini implementation
Create-Commit "src-tauri.*gemini" "🔧 feat(backend): implement gemini integration with monitoring capabilities"

# Commit 2: Monitoring components
Create-Commit "(Monitor|Progress|Error.*\.tsx)" "📊 feat(monitoring): add progress monitoring and error tracking components"

# Commit 3: Frontend hooks and utilities
Create-Commit "src/(hooks|lib|stores)" "🎨 feat(frontend): add monitoring hooks and state management"

# Commit 4: Component updates
Create-Commit "src/components/.*\.tsx" "🧩 refactor(components): integrate monitoring into existing components"

# Commit 5: Documentation
Create-Commit "\.(md|MD)$" "📚 docs: update documentation with monitoring guides and error tracking"

# Commit 6: Backend core updates
Create-Commit "src-tauri" "🔧 feat(backend): enhance core Tauri integration for monitoring"

# Commit 7: Configuration updates
Create-Commit "(package.*json|\.gitignore|Cargo\.(toml|lock))" "⚙️ build: update dependencies and configuration"

# Commit 8: Remaining frontend files
Create-Commit "src/.*\.(ts|tsx|css)" "🎨 feat(frontend): complete monitoring system integration"

# Commit 9: Any remaining files
$remaining = git status --porcelain
if ($remaining) {
    Write-Host "📦 Staging remaining files..." -ForegroundColor Yellow
    git add -A
    git commit -m "🔄 chore: add remaining monitoring system files"
    Write-Host "✅ Created final commit" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Monitoring system implementation committed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
git log --oneline -10