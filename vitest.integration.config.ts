import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/integration/setup.ts'],
    include: ['src/**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/src-tauri/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/integration-results.json'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});