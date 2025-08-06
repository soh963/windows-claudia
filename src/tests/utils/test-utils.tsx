import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TabProvider } from '@/contexts/TabContext';

// Custom render function that includes all providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: 'light' | 'dark';
  initialTabs?: any[];
}

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <TabProvider>
        {children}
      </TabProvider>
    </ThemeProvider>
  );
};

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => <AllTheProviders>{children}</AllTheProviders>,
    ...renderOptions,
  });
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Helper to wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Helper to create mock functions with proper typing
export function createMockFunction<T extends (...args: any[]) => any>(): jest.Mock<T> {
  return jest.fn() as unknown as jest.Mock<T>;
}

// Helper to generate test IDs
export const testIds = {
  // Monitoring
  progressTracker: 'progress-tracker',
  errorDashboard: 'error-dashboard',
  statusBar: 'status-bar',
  
  // Operations
  operationCard: (id: string) => `operation-${id}`,
  operationProgress: (id: string) => `operation-progress-${id}`,
  
  // Errors
  errorEntry: (id: string) => `error-${id}`,
  errorSeverity: (severity: string) => `error-severity-${severity}`,
} as const;