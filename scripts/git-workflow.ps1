# Claudia Git Workflow Automation System (PowerShell)
# Intelligent git commit orchestration with semantic versioning

param(
    [Parameter(Position=0)]
    [ValidateSet('auto', 'status', 'backup', 'init', 'commit-current')]
    [string]$Command = 'auto'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# Configuration
$Config = @{
    Categories = @{
        backend = @{
            patterns = @('src-tauri/**/*.rs', 'Cargo.toml', 'Cargo.lock')
            prefix = 'backend'
            emoji = '🔧'
        }
        frontend = @{
            patterns = @('src/**/*.tsx', 'src/**/*.ts', '!src/**/*.test.*')
            prefix = 'frontend'
            emoji = '🎨'
        }
        components = @{
            patterns = @('src/components/**/*')
            prefix = 'components'
            emoji = '🧩'
        }
        docs = @{
            patterns = @('doc/**/*', 'docs/**/*', '*.md', '!node_modules/**')
            prefix = 'docs'
            emoji = '📚'
        }
        config = @{
            patterns = @('package.json', 'tsconfig.json', 'vite.config.ts', '.gitignore')
            prefix = 'config'
            emoji = '⚙️'
        }
        test = @{
            patterns = @('**/*.test.*', '**/*.spec.*', '__tests__/**')
            prefix = 'test'
            emoji = '🧪'
        }
        monitoring = @{
            patterns = @('**/monitoring/**', '**/observability/**', '**/gemini_monitoring*')
            prefix = 'monitoring'
            emoji = '📊'
        }
        gemini = @{
            patterns = @('**/gemini*', '**/Gemini*')
            prefix = 'gemini'
            emoji = '🤖'
        }
    }
    
    BreakingPatterns = @(
        'remove', 'delete', 'breaking', 'incompatible',
        'major\s+change', 'api\s+change'
    )
    
    SensitivePatterns = @(
        'api[_-]?key', 'secret', 'password', 'token', '\.env$'
    )
}

function Get-GitStatus {
    $status = git status --porcelain
    $files = @()
    
    foreach ($line in $status -split "`n") {
        if ($line.Trim()) {
            $parts = $line.Trim() -split '\s+', 2
            $statusCode = $parts[0]
            $path = $parts[1]
            
            $files += [PSCustomObject]@{
                Status = $statusCode
                Path = $path
                IsNew = $statusCode -match '\?'
                IsModified = $statusCode -match 'M'
                IsDeleted = $statusCode -match 'D'
                IsRenamed = $statusCode -match 'R'
            }
        }
    }
    
    return $files
}

function Test-FilePattern {
    param($Path, $Pattern)
    
    # Simple glob pattern matching
    $regex = $Pattern -replace '\*\*', '.*' -replace '\*', '[^/]*' -replace '\?', '.'
    return $Path -match $regex
}

function Get-CategorizedFiles {
    param($Files)
    
    $categorized = @{}
    
    foreach ($file in $Files) {
        $category = 'misc'
        
        foreach ($cat in $Config.Categories.Keys) {
            $patterns = $Config.Categories[$cat].patterns
            foreach ($pattern in $patterns) {
                if ($pattern.StartsWith('!')) {
                    if (-not (Test-FilePattern $file.Path $pattern.Substring(1))) {
                        $category = $cat
                        break
                    }
                } else {
                    if (Test-FilePattern $file.Path $pattern) {
                        $category = $cat
                        break
                    }
                }
            }
            if ($category -ne 'misc') { break }
        }
        
        if (-not $categorized.ContainsKey($category)) {
            $categorized[$category] = @()
        }
        $categorized[$category] += $file
    }
    
    return $categorized
}

function Test-BreakingChanges {
    param($Files)
    
    foreach ($file in $Files) {
        if ($file.IsDeleted -and $file.Path -match '\.(ts|tsx|js|jsx)$') {
            return $true
        }
        
        if ($file.IsModified) {
            $filePath = Join-Path $ProjectRoot $file.Path
            if ((Test-Path $filePath) -and -not (Get-Item $filePath).PSIsContainer) {
                try {
                    $content = Get-Content $filePath -Raw -ErrorAction Stop
                    foreach ($pattern in $Config.BreakingPatterns) {
                        if ($content -match $pattern) {
                            return $true
                        }
                    }
                } catch {
                    # Skip files that can't be read
                }
            }
        }
    }
    
    return $false
}

function Test-SensitiveData {
    param($Files)
    
    $sensitive = @()
    
    foreach ($file in $Files) {
        foreach ($pattern in $Config.SensitivePatterns) {
            if ($file.Path -match $pattern) {
                $sensitive += $file
                break
            }
        }
        
        if (-not $file.IsDeleted) {
            $filePath = Join-Path $ProjectRoot $file.Path
            if ((Test-Path $filePath) -and -not (Get-Item $filePath).PSIsContainer) {
                try {
                    $content = Get-Content $filePath -Raw -ErrorAction Stop
                    foreach ($pattern in $Config.SensitivePatterns) {
                        if ($content -match $pattern) {
                            $sensitive += $file
                            break
                        }
                    }
                } catch {
                    # Skip files that can't be read
                }
            }
        }
    }
    
    return $sensitive
}

function New-Backup {
    $timestamp = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
    $backupDir = Join-Path $ProjectRoot ".git-backups\$timestamp"
    
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    # Save current state
    $branch = git branch --show-current
    $commit = git rev-parse HEAD
    
    $state = @{
        Branch = $branch
        Commit = $commit
        Timestamp = (Get-Date).ToString('o')
        Files = Get-GitStatus
    }
    
    $state | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $backupDir 'state.json')
    
    Write-Host "✅ Backup created: $backupDir" -ForegroundColor Green
    return $backupDir
}

function Invoke-Tests {
    Write-Host "🧪 Running tests..." -ForegroundColor Cyan
    
    try {
        # Check TypeScript
        npm run check
        Write-Host "✅ TypeScript check passed" -ForegroundColor Green
        
        # Run tests if available
        try {
            npm test
            Write-Host "✅ Tests passed" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  No test suite found or tests failed" -ForegroundColor Yellow
            $proceed = Read-Host "Continue without tests? (y/N)"
            if ($proceed -ne 'y') {
                throw "Tests failed"
            }
        }
    } catch {
        throw "Pre-commit checks failed"
    }
}

function New-Commit {
    param(
        $Files,
        $Category,
        $Description,
        $IsBreaking = $false
    )
    
    $config = $Config.Categories[$Category]
    if (-not $config) {
        $config = @{ prefix = $Category; emoji = '🔄' }
    }
    
    $scope = $config.prefix
    $emoji = $config.emoji
    
    # Determine commit type
    $type = 'feat'
    if ($Description -match 'fix') { $type = 'fix' }
    if ($Category -eq 'docs') { $type = 'docs' }
    if ($Category -eq 'test') { $type = 'test' }
    if ($Category -eq 'config') { $type = 'build' }
    
    $breaking = if ($IsBreaking) { '!' } else { '' }
    $message = "$emoji $type($scope)$breaking`: $Description"
    
    # Stage files
    foreach ($file in $Files) {
        if ($file.IsDeleted) {
            git rm $file.Path 2>$null
        } else {
            git add $file.Path
        }
    }
    
    # Create commit
    git commit -m $message
    Write-Host "✅ Created commit: $message" -ForegroundColor Green
    
    return $message
}

function Invoke-AutoCommit {
    $files = Get-GitStatus
    
    if ($files.Count -eq 0) {
        Write-Host "✅ Working directory is clean" -ForegroundColor Green
        return
    }
    
    Write-Host "📊 Found $($files.Count) changed files`n" -ForegroundColor Cyan
    
    # Check for sensitive data
    $sensitive = Test-SensitiveData $files
    if ($sensitive.Count -gt 0) {
        Write-Host "⚠️  Potential sensitive data detected:" -ForegroundColor Yellow
        foreach ($file in $sensitive) {
            Write-Host "   - $($file.Path)" -ForegroundColor Yellow
        }
        $proceed = Read-Host "`nProceed anyway? (y/N)"
        if ($proceed -ne 'y') {
            Write-Host "❌ Commit cancelled" -ForegroundColor Red
            return
        }
    }
    
    # Detect breaking changes
    $hasBreaking = Test-BreakingChanges $files
    if ($hasBreaking) {
        Write-Host "⚠️  Potential breaking changes detected" -ForegroundColor Yellow
    }
    
    # Create backup
    $backup = Read-Host "Create backup before commit? (Y/n)"
    if ($backup -ne 'n') {
        New-Backup
    }
    
    # Run tests
    $runTest = Read-Host "Run tests before commit? (Y/n)"
    if ($runTest -ne 'n') {
        Invoke-Tests
    }
    
    # Categorize files
    $categorized = Get-CategorizedFiles $files
    
    Write-Host "`n📋 Categorized changes:" -ForegroundColor Cyan
    foreach ($category in $categorized.Keys) {
        $catFiles = $categorized[$category]
        $config = $Config.Categories[$category]
        if (-not $config) {
            $config = @{ emoji = '📄' }
        }
        
        Write-Host "`n$($config.emoji) $category ($($catFiles.Count) files):" -ForegroundColor White
        $catFiles | Select-Object -First 5 | ForEach-Object {
            Write-Host "   $($_.Status) $($_.Path)" -ForegroundColor Gray
        }
        if ($catFiles.Count -gt 5) {
            Write-Host "   ... and $($catFiles.Count - 5) more" -ForegroundColor Gray
        }
    }
    
    # Create commits
    Write-Host "`n🔄 Creating commits...`n" -ForegroundColor Cyan
    
    foreach ($category in $categorized.Keys) {
        $catFiles = $categorized[$category]
        if ($catFiles.Count -eq 0) { continue }
        
        $config = $Config.Categories[$category]
        if (-not $config) {
            $config = @{ emoji = '📄'; prefix = $category }
        }
        
        Write-Host "`n$($config.emoji) Processing $category..." -ForegroundColor White
        $description = Read-Host "Enter description for $category changes"
        
        if ($description.Trim()) {
            New-Commit -Files $catFiles -Category $category -Description $description -IsBreaking $hasBreaking
        } else {
            Write-Host "⏭️  Skipping $category" -ForegroundColor Gray
        }
    }
    
    Write-Host "`n✅ All commits created successfully!" -ForegroundColor Green
}

function Show-Status {
    $files = Get-GitStatus
    $categorized = Get-CategorizedFiles $files
    
    Write-Host "📊 Git Status Summary`n" -ForegroundColor Cyan
    Write-Host "Total changes: $($files.Count) files`n" -ForegroundColor White
    
    foreach ($category in $categorized.Keys) {
        $catFiles = $categorized[$category]
        $config = $Config.Categories[$category]
        if (-not $config) {
            $config = @{ emoji = '📄' }
        }
        Write-Host "$($config.emoji) ${category}: $($catFiles.Count) files" -ForegroundColor White
    }
    
    $sensitive = Test-SensitiveData $files
    if ($sensitive.Count -gt 0) {
        Write-Host "`n⚠️  Sensitive files: $($sensitive.Count)" -ForegroundColor Yellow
    }
    
    if (Test-BreakingChanges $files) {
        Write-Host "`n⚠️  Potential breaking changes detected" -ForegroundColor Yellow
    }
}

function Initialize-Workflow {
    Write-Host "🔧 Initializing Git Workflow...`n" -ForegroundColor Cyan
    
    # Create directories
    New-Item -ItemType Directory -Path (Join-Path $ProjectRoot '.git-backups') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $ProjectRoot '.git\hooks') -Force | Out-Null
    
    # Create git aliases
    $aliases = @{
        'wf' = '!powershell -File scripts/git-workflow.ps1'
        'wf-status' = '!powershell -File scripts/git-workflow.ps1 status'
        'wf-backup' = '!powershell -File scripts/git-workflow.ps1 backup'
        'wf-auto' = '!powershell -File scripts/git-workflow.ps1 auto'
    }
    
    foreach ($alias in $aliases.Keys) {
        git config alias.$alias $aliases[$alias]
        Write-Host "✅ Created alias: git $alias" -ForegroundColor Green
    }
    
    Write-Host "`n✅ Git workflow initialized!" -ForegroundColor Green
    Write-Host "`nAvailable commands:" -ForegroundColor White
    Write-Host "  git wf        - Run auto-commit workflow" -ForegroundColor Gray
    Write-Host "  git wf-status - Show categorized status" -ForegroundColor Gray
    Write-Host "  git wf-backup - Create backup" -ForegroundColor Gray
    Write-Host "  git wf-auto   - Auto-commit with prompts" -ForegroundColor Gray
}

function Invoke-CommitCurrent {
    Write-Host "🚀 Committing current monitoring system implementation...`n" -ForegroundColor Cyan
    
    $files = Get-GitStatus
    $categorized = Get-CategorizedFiles $files
    
    # Create structured commits for the monitoring system
    $commitPlan = @(
        @{
            Category = 'monitoring'
            Files = $categorized['monitoring'] + $categorized['gemini']
            Description = 'implement comprehensive monitoring and observability system'
        }
        @{
            Category = 'components'
            Files = $categorized['components'] | Where-Object { $_.Path -match 'Progress|Error|Status|Monitor' }
            Description = 'add progress monitoring and error tracking components'
        }
        @{
            Category = 'backend'
            Files = $categorized['backend'] | Where-Object { $_.Path -match 'gemini' }
            Description = 'enhance gemini integration with monitoring capabilities'
        }
        @{
            Category = 'docs'
            Files = $categorized['docs']
            Description = 'update documentation with monitoring guides and error tracking'
        }
        @{
            Category = 'frontend'
            Files = $categorized['frontend'] | Where-Object { 
                $_.Path -notmatch 'components' -and $_.Path -notmatch 'gemini'
            }
            Description = 'integrate monitoring hooks and API enhancements'
        }
    )
    
    # Create backup first
    Write-Host "📦 Creating backup..." -ForegroundColor Yellow
    New-Backup
    
    # Execute commits
    foreach ($commit in $commitPlan) {
        if ($commit.Files -and $commit.Files.Count -gt 0) {
            Write-Host "`n$($Config.Categories[$commit.Category].emoji) Committing $($commit.Category): $($commit.Files.Count) files" -ForegroundColor White
            New-Commit -Files $commit.Files -Category $commit.Category -Description $commit.Description
        }
    }
    
    Write-Host "`n✅ Monitoring system implementation committed!" -ForegroundColor Green
}

# Main execution
Write-Host "🚀 Claudia Git Workflow System`n" -ForegroundColor Cyan

# Check if we're in a git repo
try {
    git rev-parse --git-dir 2>&1 | Out-Null
} catch {
    Write-Host "❌ Not in a git repository" -ForegroundColor Red
    exit 1
}

# Set working directory
Set-Location $ProjectRoot

# Execute command
switch ($Command) {
    'auto' { Invoke-AutoCommit }
    'status' { Show-Status }
    'backup' { New-Backup }
    'init' { Initialize-Workflow }
    'commit-current' { Invoke-CommitCurrent }
}