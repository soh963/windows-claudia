import { vi } from 'vitest';

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
};