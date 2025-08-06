import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Tauri API
beforeAll(() => {
  // Mock window.__TAURI__
  (window as any).__TAURI__ = {
    invoke: vi.fn(),
    event: {
      emit: vi.fn(),
      listen: vi.fn(),
      once: vi.fn(),
      unlisten: vi.fn()
    },
    path: {
      appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
      appConfigDir: vi.fn().mockResolvedValue('/mock/app/config'),
      appCacheDir: vi.fn().mockResolvedValue('/mock/app/cache')
    },
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exists: vi.fn(),
      createDir: vi.fn(),
      removeFile: vi.fn()
    }
  };

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Suppress console errors in tests
  const originalError = console.error;
  console.error = (...args: any[]) => {
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
  vi.restoreAllMocks();
});