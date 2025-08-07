import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    css: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/*.e2e.*',
      '**/*.spec.*'
    ],
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
      'global': 'globalThis',
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tauri-apps/api': path.resolve(__dirname, './src/tests/mocks/tauri.ts'),
    },
  },
});