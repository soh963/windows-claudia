import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Build and Validation Tests', () => {
  describe('TypeScript Compilation', () => {
    it('should compile without errors', () => {
      try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
        expect(true).toBe(true);
      } catch (error: any) {
        console.error('TypeScript compilation failed:', error.stdout?.toString());
        expect(error).toBeNull();
      }
    });

    it('should have strict mode enabled', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.noUnusedLocals).toBe(true);
      expect(tsconfig.compilerOptions.noUnusedParameters).toBe(true);
      expect(tsconfig.compilerOptions.noFallthroughCasesInSwitch).toBe(true);
    });
  });

  describe('Build Process', () => {
    it('should build successfully', async () => {
      try {
        execSync('npm run build', { stdio: 'pipe' });
        
        // Check if dist directory exists
        const distPath = path.join(process.cwd(), 'dist');
        expect(fs.existsSync(distPath)).toBe(true);
        
        // Check if index.html exists
        const indexPath = path.join(distPath, 'index.html');
        expect(fs.existsSync(indexPath)).toBe(true);
      } catch (error: any) {
        console.error('Build failed:', error.stdout?.toString());
        expect(error).toBeNull();
      }
    }, 60000); // 60 second timeout for build
  });

  describe('Dependencies', () => {
    it('should have no vulnerabilities in production dependencies', () => {
      try {
        const output = execSync('npm audit --production --json', { stdio: 'pipe' });
        const audit = JSON.parse(output.toString());
        
        expect(audit.metadata.vulnerabilities.high).toBe(0);
        expect(audit.metadata.vulnerabilities.critical).toBe(0);
      } catch (error: any) {
        // npm audit returns non-zero exit code if vulnerabilities found
        const audit = JSON.parse(error.stdout?.toString() || '{}');
        
        if (audit.metadata?.vulnerabilities?.high > 0 || audit.metadata?.vulnerabilities?.critical > 0) {
          console.error('Security vulnerabilities found:', audit.metadata.vulnerabilities);
          expect(audit.metadata.vulnerabilities.high).toBe(0);
          expect(audit.metadata.vulnerabilities.critical).toBe(0);
        }
      }
    });

    it('should have all required dependencies installed', () => {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const nodeModulesPath = path.join(process.cwd(), 'node_modules');
      
      // Check critical dependencies
      const criticalDeps = [
        'react',
        'react-dom',
        'zustand',
        '@tauri-apps/api',
        'framer-motion',
        'recharts'
      ];
      
      criticalDeps.forEach(dep => {
        const depPath = path.join(nodeModulesPath, dep);
        expect(fs.existsSync(depPath)).toBe(true);
      });
    });
  });

  describe('Code Quality', () => {
    it('should not have console.log statements in production code', () => {
      const srcPath = path.join(process.cwd(), 'src');
      const files = getAllFiles(srcPath, ['.ts', '.tsx']);
      
      const filesWithConsoleLog: string[] = [];
      
      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('console.log') && !file.includes('.test.') && !file.includes('.spec.')) {
          filesWithConsoleLog.push(file);
        }
      });
      
      if (filesWithConsoleLog.length > 0) {
        console.warn('Files with console.log:', filesWithConsoleLog);
      }
      
      expect(filesWithConsoleLog.length).toBe(0);
    });

    it('should have proper error boundaries', () => {
      const errorBoundaryPath = path.join(process.cwd(), 'src/components/ErrorBoundary.tsx');
      expect(fs.existsSync(errorBoundaryPath)).toBe(true);
      
      const content = fs.readFileSync(errorBoundaryPath, 'utf-8');
      expect(content).toContain('componentDidCatch');
      expect(content).toContain('getDerivedStateFromError');
    });
  });

  describe('Performance', () => {
    it('should have reasonable bundle size', () => {
      const distPath = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(distPath)) {
        console.warn('Dist directory not found, skipping bundle size check');
        return;
      }
      
      const jsFiles = getAllFiles(distPath, ['.js']);
      let totalSize = 0;
      
      jsFiles.forEach(file => {
        const stats = fs.statSync(file);
        totalSize += stats.size;
      });
      
      const totalSizeMB = totalSize / (1024 * 1024);
      console.log(`Total JS bundle size: ${totalSizeMB.toFixed(2)} MB`);
      
      // Expect bundle to be less than 5MB
      expect(totalSizeMB).toBeLessThan(5);
    });

    it('should use code splitting', () => {
      const viteConfig = fs.readFileSync('vite.config.ts', 'utf-8');
      
      // Check if manual chunks or dynamic imports are configured
      expect(viteConfig.includes('manualChunks') || viteConfig.includes('rollupOptions')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have aria labels on interactive elements', () => {
      const componentFiles = getAllFiles(path.join(process.cwd(), 'src/components'), ['.tsx']);
      let componentsWithoutAria = 0;
      
      componentFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check for buttons without aria-label or accessible text
        if (content.includes('<button') && !content.includes('aria-label') && !content.includes('aria-labelledby')) {
          // Check if button has text content
          const buttonMatches = content.match(/<button[^>]*>([^<]*)<\/button>/g);
          if (buttonMatches?.some(match => !match.includes('>') || match.match(/>\s*</))) {
            componentsWithoutAria++;
          }
        }
      });
      
      expect(componentsWithoutAria).toBe(0);
    });

    it('should use semantic HTML elements', () => {
      const componentFiles = getAllFiles(path.join(process.cwd(), 'src/components'), ['.tsx']);
      let semanticScore = 0;
      let totalComponents = componentFiles.length;
      
      componentFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check for semantic elements
        if (content.includes('<nav') || 
            content.includes('<main') || 
            content.includes('<article') || 
            content.includes('<section') ||
            content.includes('<header') ||
            content.includes('<footer')) {
          semanticScore++;
        }
      });
      
      const semanticPercentage = (semanticScore / totalComponents) * 100;
      console.log(`Semantic HTML usage: ${semanticPercentage.toFixed(2)}%`);
      
      // Expect at least 30% of components to use semantic HTML
      expect(semanticPercentage).toBeGreaterThan(30);
    });
  });

  describe('Testing Infrastructure', () => {
    it('should have test coverage configuration', () => {
      const vitestConfig = fs.readFileSync('vitest.config.ts', 'utf-8');
      
      expect(vitestConfig).toContain('coverage');
      expect(vitestConfig).toContain('threshold');
    });

    it('should have proper test setup', () => {
      const setupPath = path.join(process.cwd(), 'src/tests/setup.ts');
      expect(fs.existsSync(setupPath)).toBe(true);
      
      const content = fs.readFileSync(setupPath, 'utf-8');
      expect(content).toContain('@testing-library/jest-dom');
      expect(content).toContain('cleanup');
    });
  });

  describe('Git Workflow', () => {
    it('should have git hooks configured', () => {
      const gitHooksPath = path.join(process.cwd(), '.git/hooks');
      const scriptsPath = path.join(process.cwd(), 'scripts');
      
      // Check if git workflow scripts exist
      expect(fs.existsSync(path.join(scriptsPath, 'git-workflow.js'))).toBe(true);
      expect(fs.existsSync(path.join(scriptsPath, 'git-workflow.ps1'))).toBe(true);
    });
  });

  describe('Documentation', () => {
    it('should have complete documentation', () => {
      const requiredDocs = [
        'README.md',
        'doc/guides/Error-Tracking-Guide.md',
        'doc/guides/Visual-Progress-Monitoring-Guide.md',
        'ERROR_TRACKING_GUIDE.md',
        'ERROR_PREVENTION_SUMMARY.md'
      ];
      
      requiredDocs.forEach(doc => {
        const docPath = path.join(process.cwd(), doc);
        expect(fs.existsSync(docPath)).toBe(true);
      });
    });

    it('should have API documentation', () => {
      const apiDocPath = path.join(process.cwd(), 'doc/technical/API-Reference.md');
      expect(fs.existsSync(apiDocPath)).toBe(true);
      
      const content = fs.readFileSync(apiDocPath, 'utf-8');
      expect(content.length).toBeGreaterThan(1000); // Should have substantial content
    });
  });
});

// Helper function to get all files with specific extensions
function getAllFiles(dirPath: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  function traverse(currentPath: string) {
    const entries = fs.readdirSync(currentPath);
    
    entries.forEach(entry => {
      const fullPath = path.join(currentPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !entry.includes('node_modules') && !entry.startsWith('.')) {
        traverse(fullPath);
      } else if (stat.isFile() && extensions.some(ext => entry.endsWith(ext))) {
        files.push(fullPath);
      }
    });
  }
  
  traverse(dirPath);
  return files;
}