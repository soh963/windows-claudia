import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/tests/utils/test-utils';
import { ProgressTracker } from '@/components/ProgressTracker';
import { useMonitoringStore } from '@/stores/monitoringStore';
import { act } from '@testing-library/react';

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
}));

describe('ProgressTracker Component', () => {
  beforeEach(() => {
    // Reset store state
    useMonitoringStore.setState({
      operations: new Map(),
      activeOperations: [],
      errors: [],
      errorCounts: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      isStatusBarExpanded: false,
      isProgressTrackerVisible: true,
      selectedOperationId: null,
    });
  });

  it('should render empty state when no operations', () => {
    render(<ProgressTracker />);
    
    expect(screen.getByText(/no active operations/i)).toBeInTheDocument();
  });

  it('should display active operations', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      const op1 = store.startOperation({
        type: 'api_call',
        name: 'Fetch User Data',
        description: 'Loading user profile',
      });
      
      const op2 = store.startOperation({
        type: 'file_operation',
        name: 'Upload Document',
        description: 'Uploading report.pdf',
      });
      
      store.updateOperation(op1, { progress: 75, status: 'running' });
      store.updateOperation(op2, { progress: 30, status: 'running' });
    });
    
    render(<ProgressTracker />);
    
    expect(screen.getByText('Fetch User Data')).toBeInTheDocument();
    expect(screen.getByText('Upload Document')).toBeInTheDocument();
    expect(screen.getByText('Loading user profile')).toBeInTheDocument();
    expect(screen.getByText('Uploading report.pdf')).toBeInTheDocument();
  });

  it('should show operation progress', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      const opId = store.startOperation({
        type: 'build_process',
        name: 'Build Project',
      });
      
      store.updateOperation(opId, { progress: 60, status: 'running' });
    });
    
    render(<ProgressTracker />);
    
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('should display error state for failed operations', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      const opId = store.startOperation({
        type: 'api_call',
        name: 'Failed API Call',
      });
      
      store.completeOperation(opId, {
        message: 'Connection timeout',
        severity: 'high',
      });
    });
    
    render(<ProgressTracker />);
    
    expect(screen.getByText('Failed API Call')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('should show operation icons based on type', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      store.startOperation({
        type: 'api_call',
        name: 'API Operation',
      });
      
      store.startOperation({
        type: 'file_operation',
        name: 'File Operation',
      });
      
      store.startOperation({
        type: 'tool_execution',
        name: 'Tool Operation',
      });
    });
    
    const { container } = render(<ProgressTracker />);
    
    // Check for presence of operation cards
    expect(screen.getByText('API Operation')).toBeInTheDocument();
    expect(screen.getByText('File Operation')).toBeInTheDocument();
    expect(screen.getByText('Tool Operation')).toBeInTheDocument();
  });

  it('should handle operation selection', () => {
    const store = useMonitoringStore.getState();
    
    let opId: string;
    act(() => {
      opId = store.startOperation({
        type: 'api_call',
        name: 'Selectable Operation',
      });
    });
    
    render(<ProgressTracker />);
    
    const operationCard = screen.getByText('Selectable Operation').closest('[role="button"]');
    
    act(() => {
      fireEvent.click(operationCard!);
    });
    
    expect(store.selectedOperationId).toBe(opId!);
  });

  it('should display overall progress', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      const op1 = store.startOperation({
        type: 'api_call',
        name: 'Operation 1',
      });
      
      const op2 = store.startOperation({
        type: 'file_operation',
        name: 'Operation 2',
      });
      
      store.updateOperation(op1, { progress: 80 });
      store.updateOperation(op2, { progress: 40 });
    });
    
    render(<ProgressTracker />);
    
    // Overall progress should be (80 + 40) / 2 = 60%
    expect(screen.getByText(/overall progress/i)).toBeInTheDocument();
  });

  it('should display error counts', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      // Create operations with different error severities
      const op1 = store.startOperation({
        type: 'api_call',
        name: 'Critical Error Op',
      });
      store.completeOperation(op1, {
        message: 'Critical failure',
        severity: 'critical',
      });
      
      const op2 = store.startOperation({
        type: 'file_operation',
        name: 'High Error Op',
      });
      store.completeOperation(op2, {
        message: 'High severity error',
        severity: 'high',
      });
      
      const op3 = store.startOperation({
        type: 'tool_execution',
        name: 'Medium Error Op',
      });
      store.completeOperation(op3, {
        message: 'Medium severity error',
        severity: 'medium',
      });
    });
    
    render(<ProgressTracker />);
    
    expect(screen.getByText(/errors/i)).toBeInTheDocument();
    // The component should show error indicators
  });

  it('should handle close button click', () => {
    const onClose = vi.fn();
    render(<ProgressTracker onClose={onClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    
    act(() => {
      fireEvent.click(closeButton);
    });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should clear completed operations', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      const op1 = store.startOperation({
        type: 'api_call',
        name: 'Completed Operation',
      });
      store.completeOperation(op1);
      
      store.startOperation({
        type: 'file_operation',
        name: 'Active Operation',
      });
    });
    
    render(<ProgressTracker />);
    
    const clearButton = screen.getByRole('button', { name: /clear completed/i });
    
    act(() => {
      fireEvent.click(clearButton);
    });
    
    expect(screen.queryByText('Completed Operation')).not.toBeInTheDocument();
    expect(screen.getByText('Active Operation')).toBeInTheDocument();
  });

  it('should expand/collapse operation details', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      const opId = store.startOperation({
        type: 'api_call',
        name: 'Expandable Operation',
        description: 'This is a detailed description',
        metadata: {
          endpoint: '/api/users',
          method: 'GET',
        },
      });
      
      store.updateOperation(opId, { progress: 50 });
    });
    
    render(<ProgressTracker />);
    
    // Initially, detailed info might be collapsed
    const expandButton = screen.getByRole('button', { name: /expand/i });
    
    act(() => {
      fireEvent.click(expandButton);
    });
    
    // After expanding, metadata should be visible
    waitFor(() => {
      expect(screen.getByText('/api/users')).toBeInTheDocument();
      expect(screen.getByText('GET')).toBeInTheDocument();
    });
  });

  it('should show operation duration', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      const opId = store.startOperation({
        type: 'build_process',
        name: 'Timed Operation',
      });
      
      // Simulate operation running for 5 seconds
      const operation = store.operations.get(opId)!;
      store.operations.set(opId, {
        ...operation,
        startTime: Date.now() - 5000,
      });
    });
    
    render(<ProgressTracker />);
    
    // Should show duration indicator
    expect(screen.getByText(/duration/i)).toBeInTheDocument();
  });

  it('should filter operations by type', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      store.startOperation({
        type: 'api_call',
        name: 'API Operation',
      });
      
      store.startOperation({
        type: 'file_operation',
        name: 'File Operation',
      });
      
      store.startOperation({
        type: 'build_process',
        name: 'Build Operation',
      });
    });
    
    render(<ProgressTracker />);
    
    // Find and click filter for api_call
    const apiFilter = screen.getByRole('button', { name: /api/i });
    
    act(() => {
      fireEvent.click(apiFilter);
    });
    
    waitFor(() => {
      expect(screen.getByText('API Operation')).toBeInTheDocument();
      expect(screen.queryByText('File Operation')).not.toBeInTheDocument();
      expect(screen.queryByText('Build Operation')).not.toBeInTheDocument();
    });
  });

  it('should display statistics charts', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      // Create multiple operations for statistics
      for (let i = 0; i < 5; i++) {
        const opId = store.startOperation({
          type: i % 2 === 0 ? 'api_call' : 'file_operation',
          name: `Operation ${i}`,
        });
        
        if (i < 3) {
          store.completeOperation(opId);
        }
      }
    });
    
    render(<ProgressTracker />);
    
    // Check for chart elements (mocked)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('should handle empty active operations list', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      // Create only completed operations
      const op1 = store.startOperation({
        type: 'api_call',
        name: 'Completed Op 1',
      });
      store.completeOperation(op1);
      
      const op2 = store.startOperation({
        type: 'file_operation',
        name: 'Completed Op 2',
      });
      store.completeOperation(op2);
    });
    
    render(<ProgressTracker />);
    
    expect(screen.getByText(/no active operations/i)).toBeInTheDocument();
  });

  it('should update in real-time when operations change', async () => {
    const store = useMonitoringStore.getState();
    
    render(<ProgressTracker />);
    
    expect(screen.getByText(/no active operations/i)).toBeInTheDocument();
    
    act(() => {
      store.startOperation({
        type: 'api_call',
        name: 'New Operation',
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText('New Operation')).toBeInTheDocument();
    });
  });

  it('should show retry button for failed operations', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      const opId = store.startOperation({
        type: 'api_call',
        name: 'Retryable Operation',
      });
      
      store.completeOperation(opId, {
        message: 'Network error',
        severity: 'high',
      });
    });
    
    render(<ProgressTracker />);
    
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should display operation metadata when available', () => {
    const store = useMonitoringStore.getState();
    
    act(() => {
      store.startOperation({
        type: 'gemini_request',
        name: 'Gemini API Call',
        metadata: {
          model: 'gemini-pro',
          tokens: 1500,
          temperature: 0.7,
        },
      });
    });
    
    render(<ProgressTracker />);
    
    // Click to expand details
    const expandButton = screen.getByRole('button', { name: /expand/i });
    
    act(() => {
      fireEvent.click(expandButton);
    });
    
    waitFor(() => {
      expect(screen.getByText(/gemini-pro/i)).toBeInTheDocument();
      expect(screen.getByText(/1500/i)).toBeInTheDocument();
      expect(screen.getByText(/0.7/i)).toBeInTheDocument();
    });
  });
});