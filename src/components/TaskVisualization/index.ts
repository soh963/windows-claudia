export { default as TaskVisualizationDashboard } from './TaskVisualizationDashboard';
export { default as IntegratedProgressDashboard } from './IntegratedProgressDashboard';

// Re-export charts for convenience
export * from '../charts';

// Export hooks and utilities
export { useRealTimeVisualization } from '@/hooks/useRealTimeVisualization';
export { ChartExporter, useChartExport } from '@/utils/chartExport';