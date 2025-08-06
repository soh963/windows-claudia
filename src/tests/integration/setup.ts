import { beforeAll, afterAll, beforeEach } from 'vitest';
import { server } from '../mocks/server';

// Start mock server
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset handlers and cleanup between tests
beforeEach(() => {
  server.resetHandlers();
});

// Clean up
afterAll(() => {
  server.close();
});