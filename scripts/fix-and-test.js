#!/usr/bin/env node

/**
 * Automated Fix and Test Script for Claudia
 * Addresses immediate test infrastructure issues
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class TestFixer {
  constructor() {
    this.fixes = [];
    this.results = {
      timestamp: new Date().toISOString(),
      fixesApplied: [],
      testsRun: [],
      errors: [],
      warnings: [],
    };
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  logSection(title) {
    console.log('\n' + '='.repeat(60));
    this.log(title, colors.bright + colors.cyan);
    console.log('='.repeat(60));
  }

  async run() {
    this.logSection('🔧 Claudia Test Infrastructure Fix');
    
    // Step 1: Fix Vitest Configuration
    await this.fixVitestConfig();
    
    // Step 2: Fix Test Environment
    await this.fixTestEnvironment();
    
    // Step 3: Fix TypeScript Errors
    await this.fixTypeScriptErrors();
    
    // Step 4: Run Tests
    await this.runTests();
    
    // Step 5: Generate Report
    await this.generateReport();
  }

  async fixVitestConfig() {
    this.logSection('Fixing Vitest Configuration');
    
    const vitestConfigPath = path.join(__dirname, '..', 'vitest.config.ts');
    
    try {
      const config = `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '*.config.*',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
    // Fix for React production build issue
    mode: 'test', // Use test mode instead of production
    define: {
      'process.env.NODE_ENV': '"test"', // Ensure test environment
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tauri-apps/api': path.resolve(__dirname, './src/tests/mocks/tauri.ts'),
    },
  },
});`;

      fs.writeFileSync(vitestConfigPath, config);
      this.log('✅ Vitest configuration fixed', colors.green);
      this.results.fixesApplied.push('Vitest configuration updated for test mode');
    } catch (error) {
      this.log(`❌ Failed to fix Vitest config: ${error.message}`, colors.red);
      this.results.errors.push(`Vitest config fix failed: ${error.message}`);
    }
  }

  async fixTestEnvironment() {
    this.logSection('Fixing Test Environment');
    
    const setupPath = path.join(__dirname, '..', 'src', 'tests', 'setup.ts');
    
    try {
      // Ensure tests directory exists
      const testsDir = path.dirname(setupPath);
      if (!fs.existsSync(testsDir)) {
        fs.mkdirSync(testsDir, { recursive: true });
      }

      const setupContent = `import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  transformCallback: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn(),
  once: vi.fn(),
  unlisten: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(() => Promise.resolve('/app/data')),
  appConfigDir: vi.fn(() => Promise.resolve('/app/config')),
  appCacheDir: vi.fn(() => Promise.resolve('/app/cache')),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});`;

      fs.writeFileSync(setupPath, setupContent);
      this.log('✅ Test environment setup fixed', colors.green);
      this.results.fixesApplied.push('Test environment setup configured');

      // Create Tauri mock
      const tauriMockPath = path.join(__dirname, '..', 'src', 'tests', 'mocks', 'tauri.ts');
      const mockDir = path.dirname(tauriMockPath);
      if (!fs.existsSync(mockDir)) {
        fs.mkdirSync(mockDir, { recursive: true });
      }

      const tauriMock = `import { vi } from 'vitest';

export const invoke = vi.fn((cmd: string, args?: any) => {
  // Mock responses for different commands
  switch (cmd) {
    case 'get_all_models':
      return Promise.resolve({
        claude: [],
        gemini: [],
        ollama: [],
      });
    case 'get_active_operations':
      return Promise.resolve([]);
    case 'get_session_tasks':
      return Promise.resolve([]);
    case 'get_session_summary':
      return Promise.resolve({
        duration: 0,
        messages: 0,
        tasks_completed: 0,
        models_used: [],
      });
    default:
      return Promise.resolve({});
  }
});

export const transformCallback = vi.fn();

export default {
  invoke,
  transformCallback,
};`;

      fs.writeFileSync(tauriMockPath, tauriMock);
      this.log('✅ Tauri mocks created', colors.green);
      this.results.fixesApplied.push('Tauri API mocks configured');

    } catch (error) {
      this.log(`❌ Failed to fix test environment: ${error.message}`, colors.red);
      this.results.errors.push(`Test environment fix failed: ${error.message}`);
    }
  }

  async fixTypeScriptErrors() {
    this.logSection('Analyzing TypeScript Errors');
    
    try {
      // Run TypeScript check to identify errors
      let tsErrors = [];
      try {
        execSync('npx tsc --noEmit', { encoding: 'utf8' });
        this.log('✅ No TypeScript errors found', colors.green);
      } catch (error) {
        const output = error.stdout || '';
        const lines = output.split('\n');
        tsErrors = lines.filter(line => line.includes('error TS'));
        
        this.log(`⚠️ Found ${tsErrors.length} TypeScript errors`, colors.yellow);
        this.results.warnings.push(`${tsErrors.length} TypeScript errors need manual fixing`);
        
        // Log first 5 errors for visibility
        tsErrors.slice(0, 5).forEach(error => {
          this.log(`  ${error}`, colors.yellow);
        });
        
        if (tsErrors.length > 5) {
          this.log(`  ... and ${tsErrors.length - 5} more`, colors.yellow);
        }
      }
    } catch (error) {
      this.log(`❌ TypeScript check failed: ${error.message}`, colors.red);
      this.results.errors.push(`TypeScript check failed: ${error.message}`);
    }
  }

  async runTests() {
    this.logSection('Running Test Suites');
    
    // Test 1: Unit Tests
    this.log('\n📝 Running Unit Tests...', colors.blue);
    try {
      const output = execSync('npm run test:run -- --reporter=verbose', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Parse results
      const passMatch = output.match(/(\d+) passed/);
      const failMatch = output.match(/(\d+) failed/);
      
      if (passMatch) {
        const passed = parseInt(passMatch[1]);
        this.log(`✅ ${passed} unit tests passed`, colors.green);
        this.results.testsRun.push({ type: 'unit', passed, failed: 0 });
      }
      
      if (failMatch) {
        const failed = parseInt(failMatch[1]);
        this.log(`❌ ${failed} unit tests failed`, colors.red);
        this.results.testsRun.push({ type: 'unit', passed: 0, failed });
      }
    } catch (error) {
      this.log('❌ Unit tests failed to run', colors.red);
      this.results.errors.push('Unit tests execution failed');
    }

    // Test 2: Integration Tests
    this.log('\n🔗 Running Integration Tests...', colors.blue);
    try {
      execSync('npm run test:integration', { encoding: 'utf8', stdio: 'pipe' });
      this.log('✅ Integration tests passed', colors.green);
      this.results.testsRun.push({ type: 'integration', passed: 'all', failed: 0 });
    } catch (error) {
      this.log('⚠️ Integration tests not configured or failed', colors.yellow);
      this.results.warnings.push('Integration tests need configuration');
    }

    // Test 3: Build Test
    this.log('\n🏗️ Testing Build Process...', colors.blue);
    try {
      execSync('npm run build', { stdio: 'pipe' });
      this.log('✅ Build process successful', colors.green);
      this.results.testsRun.push({ type: 'build', passed: true, failed: false });
    } catch (error) {
      this.log('❌ Build process failed', colors.red);
      this.results.errors.push('Build process failed');
    }
  }

  async generateReport() {
    this.logSection('📊 Test Fix Report');
    
    const reportPath = path.join(__dirname, '..', 'test-fix-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    // Display summary
    this.log('\n📈 Summary:', colors.bright);
    this.log(`Fixes Applied: ${this.results.fixesApplied.length}`, colors.green);
    this.log(`Tests Run: ${this.results.testsRun.length}`, colors.blue);
    this.log(`Errors: ${this.results.errors.length}`, colors.red);
    this.log(`Warnings: ${this.results.warnings.length}`, colors.yellow);
    
    if (this.results.fixesApplied.length > 0) {
      this.log('\n✅ Fixes Applied:', colors.green);
      this.results.fixesApplied.forEach(fix => {
        this.log(`  • ${fix}`, colors.green);
      });
    }
    
    if (this.results.errors.length > 0) {
      this.log('\n❌ Errors Encountered:', colors.red);
      this.results.errors.forEach(error => {
        this.log(`  • ${error}`, colors.red);
      });
    }
    
    if (this.results.warnings.length > 0) {
      this.log('\n⚠️ Warnings:', colors.yellow);
      this.results.warnings.forEach(warning => {
        this.log(`  • ${warning}`, colors.yellow);
      });
    }
    
    this.log(`\nReport saved to: ${reportPath}`, colors.blue);
    
    // Provide next steps
    this.log('\n📋 Next Steps:', colors.cyan);
    if (this.results.errors.length > 0) {
      this.log('1. Address the errors listed above', colors.yellow);
      this.log('2. Fix TypeScript compilation errors manually', colors.yellow);
      this.log('3. Re-run validation: npm run validate', colors.yellow);
    } else {
      this.log('1. Run full validation: node scripts/run-validation.js', colors.green);
      this.log('2. Check test coverage: npm run test:coverage', colors.green);
      this.log('3. Deploy to staging for final testing', colors.green);
    }
  }
}

// Run the fixer
const fixer = new TestFixer();
fixer.run().catch(error => {
  console.error('Test fix failed:', error);
  process.exit(1);
});