#!/usr/bin/env node

/**
 * Claudia Git Workflow Automation System
 * Intelligent git commit orchestration with semantic versioning
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Configuration
const CONFIG = {
  // File patterns for categorization
  categories: {
    backend: {
      patterns: ['src-tauri/**/*.rs', 'Cargo.toml', 'Cargo.lock'],
      prefix: 'backend',
      emoji: '🔧'
    },
    frontend: {
      patterns: ['src/**/*.tsx', 'src/**/*.ts', '!src/**/*.test.*'],
      prefix: 'frontend',
      emoji: '🎨'
    },
    components: {
      patterns: ['src/components/**/*'],
      prefix: 'components',
      emoji: '🧩'
    },
    docs: {
      patterns: ['doc/**/*', 'docs/**/*', '*.md', '!node_modules/**'],
      prefix: 'docs',
      emoji: '📚'
    },
    config: {
      patterns: ['package.json', 'tsconfig.json', 'vite.config.ts', '.gitignore'],
      prefix: 'config',
      emoji: '⚙️'
    },
    test: {
      patterns: ['**/*.test.*', '**/*.spec.*', '__tests__/**'],
      prefix: 'test',
      emoji: '🧪'
    },
    monitoring: {
      patterns: ['**/monitoring/**', '**/observability/**', '**/gemini_monitoring*'],
      prefix: 'monitoring',
      emoji: '📊'
    },
    gemini: {
      patterns: ['**/gemini*', '**/Gemini*'],
      prefix: 'gemini',
      emoji: '🤖'
    }
  },
  
  // Breaking change patterns
  breakingPatterns: [
    /remove|delete|breaking|incompatible/i,
    /major\s+change/i,
    /api\s+change/i
  ],
  
  // Sensitive data patterns
  sensitivePatterns: [
    /api[_-]?key/i,
    /secret/i,
    /password/i,
    /token/i,
    /\.env$/
  ],
  
  // Commit message templates
  templates: {
    feat: 'feat({scope}): {description}',
    fix: 'fix({scope}): {description}',
    docs: 'docs({scope}): {description}',
    style: 'style({scope}): {description}',
    refactor: 'refactor({scope}): {description}',
    perf: 'perf({scope}): {description}',
    test: 'test({scope}): {description}',
    build: 'build({scope}): {description}',
    ci: 'ci({scope}): {description}',
    chore: 'chore({scope}): {description}',
    revert: 'revert({scope}): {description}'
  }
};

// Utility functions
function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      cwd: projectRoot,
      ...options 
    }).trim();
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function getGitStatus() {
  const status = exec('git status --porcelain');
  return status.split('\n').filter(line => line.trim()).map(line => {
    const [statusCode, ...pathParts] = line.trim().split(/\s+/);
    const filePath = pathParts.join(' ');
    return {
      status: statusCode,
      path: filePath,
      isNew: statusCode.includes('?'),
      isModified: statusCode.includes('M'),
      isDeleted: statusCode.includes('D'),
      isRenamed: statusCode.includes('R')
    };
  });
}

function categorizeFiles(files) {
  const categorized = {};
  
  files.forEach(file => {
    let category = 'misc';
    
    for (const [cat, config] of Object.entries(CONFIG.categories)) {
      if (config.patterns.some(pattern => {
        if (pattern.startsWith('!')) {
          return !minimatch(file.path, pattern.slice(1));
        }
        return minimatch(file.path, pattern);
      })) {
        category = cat;
        break;
      }
    }
    
    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push(file);
  });
  
  return categorized;
}

// Simple minimatch implementation for basic glob patterns
function minimatch(path, pattern) {
  // Convert glob pattern to regex
  let regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '[^/]*')
    .replace(/\*\*/g, '.*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${regex}$`).test(path);
}

function detectBreakingChanges(files) {
  for (const file of files) {
    if (file.isDeleted && file.path.match(/\.(ts|tsx|js|jsx)$/)) {
      return true;
    }
    
    // Check file content for breaking patterns
    if (file.isModified) {
      try {
        const content = fs.readFileSync(path.join(projectRoot, file.path), 'utf8');
        if (CONFIG.breakingPatterns.some(pattern => pattern.test(content))) {
          return true;
        }
      } catch (error) {
        // File might not exist or be readable
      }
    }
  }
  
  return false;
}

function checkSensitiveData(files) {
  const sensitive = [];
  
  for (const file of files) {
    if (CONFIG.sensitivePatterns.some(pattern => pattern.test(file.path))) {
      sensitive.push(file);
    }
    
    // Check file content
    if (!file.isDeleted) {
      try {
        const content = fs.readFileSync(path.join(projectRoot, file.path), 'utf8');
        if (CONFIG.sensitivePatterns.some(pattern => pattern.test(content))) {
          sensitive.push(file);
        }
      } catch (error) {
        // File might not exist or be readable
      }
    }
  }
  
  return sensitive;
}

function generateCommitMessage(type, scope, description, breaking = false) {
  const template = CONFIG.templates[type] || CONFIG.templates.feat;
  let message = template
    .replace('{scope}', scope)
    .replace('{description}', description);
  
  if (breaking) {
    message = message.replace(':', '!:');
  }
  
  return message;
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(projectRoot, '.git-backups', timestamp);
  
  fs.mkdirSync(backupDir, { recursive: true });
  
  // Save current state
  exec(`git stash create`, { ignoreError: true });
  const stashSha = exec(`git rev-parse stash@{0}`, { ignoreError: true });
  
  if (stashSha) {
    fs.writeFileSync(path.join(backupDir, 'stash.sha'), stashSha);
  }
  
  // Save current branch and commit info
  const branch = exec('git branch --show-current');
  const commit = exec('git rev-parse HEAD');
  
  fs.writeFileSync(path.join(backupDir, 'state.json'), JSON.stringify({
    branch,
    commit,
    timestamp: new Date().toISOString(),
    files: getGitStatus()
  }, null, 2));
  
  console.log(`✅ Backup created: ${backupDir}`);
  return backupDir;
}

async function runTests() {
  console.log('🧪 Running tests...');
  
  try {
    // Check TypeScript
    exec('npm run check');
    console.log('✅ TypeScript check passed');
    
    // Run any test suite if exists
    try {
      exec('npm test', { stdio: 'inherit' });
      console.log('✅ Tests passed');
    } catch (error) {
      console.log('⚠️  No test suite found or tests failed');
      const proceed = await promptUser('Continue without tests? (y/N): ');
      if (proceed.toLowerCase() !== 'y') {
        throw new Error('Tests failed');
      }
    }
  } catch (error) {
    throw new Error('Pre-commit checks failed');
  }
}

async function createCommit(files, category, description, options = {}) {
  const config = CONFIG.categories[category] || { prefix: category, emoji: '🔄' };
  const scope = config.prefix;
  const emoji = config.emoji;
  
  // Determine commit type
  let type = 'feat';
  if (description.toLowerCase().includes('fix')) type = 'fix';
  if (category === 'docs') type = 'docs';
  if (category === 'test') type = 'test';
  if (category === 'config') type = 'build';
  
  const message = `${emoji} ${generateCommitMessage(type, scope, description, options.breaking)}`;
  
  // Stage files
  for (const file of files) {
    if (file.isDeleted) {
      exec(`git rm "${file.path}"`, { ignoreError: true });
    } else {
      exec(`git add "${file.path}"`);
    }
  }
  
  // Create commit
  exec(`git commit -m "${message}"`);
  console.log(`✅ Created commit: ${message}`);
  
  return message;
}

// Main workflow
async function main() {
  console.log('🚀 Claudia Git Workflow System\n');
  
  try {
    // Check if we're in a git repo
    exec('git rev-parse --git-dir');
  } catch (error) {
    console.error('❌ Not in a git repository');
    process.exit(1);
  }
  
  const args = process.argv.slice(2);
  const command = args[0] || 'auto';
  
  switch (command) {
    case 'auto':
      await autoCommit();
      break;
    case 'status':
      await showStatus();
      break;
    case 'backup':
      createBackup();
      break;
    case 'init':
      await initializeWorkflow();
      break;
    default:
      console.log('Usage: git-workflow [auto|status|backup|init]');
  }
}

async function autoCommit() {
  const files = getGitStatus();
  
  if (files.length === 0) {
    console.log('✅ Working directory is clean');
    return;
  }
  
  console.log(`📊 Found ${files.length} changed files\n`);
  
  // Check for sensitive data
  const sensitive = checkSensitiveData(files);
  if (sensitive.length > 0) {
    console.log('⚠️  Potential sensitive data detected:');
    sensitive.forEach(file => console.log(`   - ${file.path}`));
    const proceed = await promptUser('\nProceed anyway? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('❌ Commit cancelled');
      return;
    }
  }
  
  // Detect breaking changes
  const hasBreaking = detectBreakingChanges(files);
  if (hasBreaking) {
    console.log('⚠️  Potential breaking changes detected');
  }
  
  // Create backup
  const backup = await promptUser('Create backup before commit? (Y/n): ');
  if (backup.toLowerCase() !== 'n') {
    createBackup();
  }
  
  // Run tests
  const runTest = await promptUser('Run tests before commit? (Y/n): ');
  if (runTest.toLowerCase() !== 'n') {
    await runTests();
  }
  
  // Categorize files
  const categorized = categorizeFiles(files);
  
  console.log('\n📋 Categorized changes:');
  for (const [category, catFiles] of Object.entries(categorized)) {
    const config = CONFIG.categories[category] || { emoji: '📄' };
    console.log(`\n${config.emoji} ${category} (${catFiles.length} files):`);
    catFiles.slice(0, 5).forEach(file => {
      console.log(`   ${file.status} ${file.path}`);
    });
    if (catFiles.length > 5) {
      console.log(`   ... and ${catFiles.length - 5} more`);
    }
  }
  
  // Create commits
  console.log('\n🔄 Creating commits...\n');
  
  for (const [category, catFiles] of Object.entries(categorized)) {
    if (catFiles.length === 0) continue;
    
    const config = CONFIG.categories[category] || { emoji: '📄', prefix: category };
    console.log(`\n${config.emoji} Processing ${category}...`);
    
    const description = await promptUser(`Enter description for ${category} changes: `);
    if (description.trim()) {
      await createCommit(catFiles, category, description, { breaking: hasBreaking });
    } else {
      console.log(`⏭️  Skipping ${category}`);
    }
  }
  
  console.log('\n✅ All commits created successfully!');
}

async function showStatus() {
  const files = getGitStatus();
  const categorized = categorizeFiles(files);
  
  console.log('📊 Git Status Summary\n');
  console.log(`Total changes: ${files.length} files\n`);
  
  for (const [category, catFiles] of Object.entries(categorized)) {
    const config = CONFIG.categories[category] || { emoji: '📄' };
    console.log(`${config.emoji} ${category}: ${catFiles.length} files`);
  }
  
  const sensitive = checkSensitiveData(files);
  if (sensitive.length > 0) {
    console.log(`\n⚠️  Sensitive files: ${sensitive.length}`);
  }
  
  if (detectBreakingChanges(files)) {
    console.log('\n⚠️  Potential breaking changes detected');
  }
}

async function initializeWorkflow() {
  console.log('🔧 Initializing Git Workflow...\n');
  
  // Create directories
  fs.mkdirSync(path.join(projectRoot, '.git-backups'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.git', 'hooks'), { recursive: true });
  
  // Create git aliases
  const aliases = {
    'wf': '!node scripts/git-workflow.js',
    'wf-status': '!node scripts/git-workflow.js status',
    'wf-backup': '!node scripts/git-workflow.js backup',
    'wf-auto': '!node scripts/git-workflow.js auto'
  };
  
  for (const [alias, command] of Object.entries(aliases)) {
    exec(`git config alias.${alias} "${command}"`);
    console.log(`✅ Created alias: git ${alias}`);
  }
  
  console.log('\n✅ Git workflow initialized!');
  console.log('\nAvailable commands:');
  console.log('  git wf        - Run auto-commit workflow');
  console.log('  git wf-status - Show categorized status');
  console.log('  git wf-backup - Create backup');
  console.log('  git wf-auto   - Auto-commit with prompts');
}

// Run main
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});