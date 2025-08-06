# Claudia Monitoring System Test Suite

This directory contains comprehensive tests for the Claudia monitoring system, ensuring all features work correctly and maintain high quality standards.

## Test Structure

```
src/tests/
├── unit/                    # Unit tests for individual components
│   ├── stores/             # Store tests (monitoring, error tracking)
│   └── components/         # React component tests
├── integration/            # Integration tests
│   └── monitoring-system.integration.test.ts
├── e2e/                    # End-to-end tests with Playwright
│   └── monitoring.spec.ts
├── performance/            # Performance benchmarks
│   └── benchmark.test.ts
├── validation/             # Build and validation tests
│   └── validation.test.ts
├── fixtures/               # Test data and helpers
│   └── monitoring.fixtures.ts
├── mocks/                  # API mocks with MSW
│   ├── handlers.ts
│   └── server.ts
├── utils/                  # Test utilities
│   └── test-utils.tsx
└── setup.ts               # Test environment setup
```

## Running Tests

### All Tests
```bash
npm run test:all
```

### Unit Tests
```bash
npm test                    # Run in watch mode
npm run test:run           # Run once
npm run test:coverage      # Run with coverage report
```

### Integration Tests
```bash
npm run test:integration
```

### End-to-End Tests
```bash
npm run test:e2e           # Run E2E tests
npm run test:e2e:ui        # Run with Playwright UI
```

### Performance Tests
```bash
npm test performance
```

### Validation Tests
```bash
npm test validation
```

## Test Coverage

We maintain strict coverage requirements:
- **Lines**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Statements**: 80%

View coverage report:
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

## Writing Tests

### Unit Tests

Example component test:
```typescript
import { render, screen, fireEvent } from '@/tests/utils/test-utils';
import { ProgressTracker } from '@/components/ProgressTracker';

describe('ProgressTracker', () => {
  it('should display operations', () => {
    render(<ProgressTracker />);
    expect(screen.getByText(/operations/i)).toBeInTheDocument();
  });
});
```

Example store test:
```typescript
import { renderHook, act } from '@testing-library/react';
import { useMonitoringStore } from '@/stores/monitoringStore';

describe('MonitoringStore', () => {
  it('should start operation', () => {
    const { result } = renderHook(() => useMonitoringStore());
    
    act(() => {
      const id = result.current.startOperation({
        type: 'api_call',
        name: 'Test',
      });
    });
    
    expect(result.current.operations.size).toBe(1);
  });
});
```

### Integration Tests

Test multiple components working together:
```typescript
describe('Monitoring System Integration', () => {
  it('should track operations and errors together', async () => {
    // Test store interactions
  });
});
```

### E2E Tests

Test complete user workflows:
```typescript
test('should show progress for operations', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Start Operation")');
  await expect(page.locator('[data-testid="progress-tracker"]')).toBeVisible();
});
```

## Test Fixtures

Use provided fixtures for consistent test data:
```typescript
import { mockOperations, mockErrors, createOperationWithProgress } from '@/tests/fixtures/monitoring.fixtures';

const operation = createOperationWithProgress(mockOperations.apiCall, 50);
```

## Mocking

### API Mocking with MSW

Handlers are defined in `mocks/handlers.ts`:
```typescript
http.post('/api/gemini/generate', async ({ request }) => {
  return HttpResponse.json({
    response: 'Mock response',
    usage: { tokens: 100 }
  });
});
```

### Tauri API Mocking

Tauri APIs are automatically mocked in `setup.ts`:
```typescript
(window as any).__TAURI__ = {
  invoke: vi.fn(),
  // ... other APIs
};
```

## Performance Testing

Monitor performance metrics:
```typescript
const startTime = performance.now();
// ... operation
const duration = performance.now() - startTime;
expect(duration).toBeLessThan(100); // ms
```

## Validation Testing

Ensure build quality:
- TypeScript compilation
- Bundle size limits
- Dependency security
- Code quality checks
- Accessibility standards

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Pre-deployment

GitHub Actions workflow:
```yaml
- name: Run tests
  run: npm run test:ci
```

## Debugging Tests

### Visual Debugging
```bash
npm run test:ui        # Vitest UI
npm run test:e2e:ui    # Playwright UI
```

### Debug in VSCode
Use the provided launch configurations in `.vscode/launch.json`

### Troubleshooting

1. **Test timeouts**: Increase timeout in test
   ```typescript
   test('slow test', { timeout: 30000 }, async () => {
     // ...
   });
   ```

2. **Flaky tests**: Use `waitFor` for async operations
   ```typescript
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument();
   });
   ```

3. **State leakage**: Ensure proper cleanup
   ```typescript
   beforeEach(() => {
     // Reset store state
   });
   ```

## Best Practices

1. **Test behavior, not implementation**
   - Focus on user-visible behavior
   - Don't test internal state directly

2. **Use semantic queries**
   - Prefer `getByRole`, `getByLabelText`
   - Avoid `getByTestId` unless necessary

3. **Keep tests isolated**
   - Each test should be independent
   - Use `beforeEach` for setup

4. **Write descriptive test names**
   - Use `should` or `when` format
   - Be specific about expected behavior

5. **Test edge cases**
   - Empty states
   - Error conditions
   - Loading states
   - Large datasets

## Continuous Improvement

- Review test coverage regularly
- Update tests when features change
- Add tests for bug fixes
- Monitor test performance
- Keep dependencies updated