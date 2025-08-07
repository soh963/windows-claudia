import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useMonitoringStore } from './monitoringStore';
import { useSessionStore } from './sessionStore';
import { modelHealthStore } from './modelHealthStore';
import type { Operation, MonitoringStats } from './monitoringStore';
import type { Session } from '@/lib/api';

// Data structures for visualization
export interface TimeSeriesData {
  timestamp: number;
  value: number;
  label: string;
}

export interface ChartData {
  id: string;
  name: string;
  data: TimeSeriesData[];
}

export interface PerformanceMetrics {
  totalOperations: number;
  completedOperations: number;
  failedOperations: number;
  runningOperations: number;
  averageResponseTime: number;
  successRate: number;
  operationsPerMinute: number;
  modelUsageStats: Record<string, number>;
  errorRate: number;
  peakUsageHour: number;
}

export interface TaskVisualizationData {
  progressOverTime: ChartData[];
  performanceMetrics: PerformanceMetrics;
  modelComparison: Array<{
    modelId: string;
    responseTime: number;
    successRate: number;
    totalRequests: number;
    errorCount: number;
  }>;
  operationTypeDistribution: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  sessionMetrics: Array<{
    sessionId: string;
    startTime: number;
    endTime?: number;
    operationCount: number;
    successRate: number;
  }>;
  realTimeActivity: Operation[];
  timelineEvents: Array<{
    id: string;
    timestamp: number;
    type: 'operation_start' | 'operation_complete' | 'operation_error' | 'session_start' | 'session_end';
    title: string;
    description: string;
    status: 'success' | 'error' | 'warning' | 'info';
  }>;
}

export interface VisualizationSettings {
  refreshInterval: number; // in milliseconds
  timeWindow: number; // in minutes for time series data
  maxDataPoints: number;
  enableRealTimeUpdates: boolean;
  chartAnimations: boolean;
  colorScheme: 'light' | 'dark' | 'auto';
  exportFormat: 'png' | 'svg' | 'pdf' | 'csv';
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf' | 'csv' | 'json';
  chartType: string;
  dateRange: {
    start: number;
    end: number;
  };
  includeMetadata: boolean;
}

interface VisualizationStore {
  // Data
  visualizationData: TaskVisualizationData;
  settings: VisualizationSettings;
  
  // State
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
  
  // Real-time update interval
  updateInterval: NodeJS.Timeout | null;
  
  // Actions
  updateVisualizationData: () => Promise<void>;
  setSettings: (settings: Partial<VisualizationSettings>) => void;
  startRealTimeUpdates: () => void;
  stopRealTimeUpdates: () => void;
  exportChart: (chartType: string, options: ExportOptions) => Promise<void>;
  resetData: () => void;
  
  // Getters
  getProgressOverTime: (timeWindow?: number) => ChartData[];
  getModelPerformanceComparison: () => Array<{
    modelId: string;
    responseTime: number;
    successRate: number;
    totalRequests: number;
  }>;
  getOperationDistribution: () => Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  getRecentActivity: (limit?: number) => Operation[];
  getSessionAnalytics: () => Array<{
    sessionId: string;
    startTime: number;
    duration: number;
    operationCount: number;
  }>;
}

const DEFAULT_SETTINGS: VisualizationSettings = {
  refreshInterval: 5000, // 5 seconds
  timeWindow: 60, // 60 minutes
  maxDataPoints: 100,
  enableRealTimeUpdates: true,
  chartAnimations: true,
  colorScheme: 'auto',
  exportFormat: 'png',
};

const INITIAL_VISUALIZATION_DATA: TaskVisualizationData = {
  progressOverTime: [],
  performanceMetrics: {
    totalOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    runningOperations: 0,
    averageResponseTime: 0,
    successRate: 0,
    operationsPerMinute: 0,
    modelUsageStats: {},
    errorRate: 0,
    peakUsageHour: 0,
  },
  modelComparison: [],
  operationTypeDistribution: [],
  sessionMetrics: [],
  realTimeActivity: [],
  timelineEvents: [],
};

export const useVisualizationStore = create<VisualizationStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    visualizationData: INITIAL_VISUALIZATION_DATA,
    settings: DEFAULT_SETTINGS,
    isLoading: false,
    error: null,
    lastUpdated: 0,
    updateInterval: null,
    
    // Actions
    updateVisualizationData: async () => {
      set({ isLoading: true, error: null });
      
      try {
        const monitoringStore = useMonitoringStore.getState();
        const sessionStore = useSessionStore.getState();
        
        // Get monitoring data
        const operations = Array.from(monitoringStore.operations.values())
          .filter((op): op is Operation => op !== undefined);
        const stats = monitoringStore.getStats();
        
        // Calculate performance metrics
        const performanceMetrics = calculatePerformanceMetrics(operations);
        
        // Generate progress over time data
        const progressOverTime = generateProgressOverTime(operations, get().settings.timeWindow);
        
        // Calculate model comparison data
        const modelComparison = calculateModelComparison(operations);
        
        // Calculate operation type distribution
        const operationTypeDistribution = calculateOperationDistribution(operations);
        
        // Generate session metrics
        const sessionMetrics = calculateSessionMetrics(sessionStore.sessions, operations);
        
        // Get real-time activity (last 10 operations)
        const realTimeActivity = operations
          .filter(op => op.startTime > Date.now() - (5 * 60 * 1000)) // Last 5 minutes
          .sort((a, b) => b.startTime - a.startTime)
          .slice(0, 10);
        
        // Generate timeline events
        const timelineEvents = generateTimelineEvents(operations, sessionStore.sessions);
        
        const visualizationData: TaskVisualizationData = {
          progressOverTime,
          performanceMetrics,
          modelComparison,
          operationTypeDistribution,
          sessionMetrics,
          realTimeActivity,
          timelineEvents,
        };
        
        set({
          visualizationData,
          isLoading: false,
          lastUpdated: Date.now(),
          error: null,
        });
      } catch (error) {
        console.error('Failed to update visualization data:', error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to update data',
        });
      }
    },
    
    setSettings: (newSettings) => {
      set((state) => ({
        settings: { ...state.settings, ...newSettings }
      }));
      
      // Restart real-time updates if interval changed
      if (newSettings.refreshInterval) {
        get().stopRealTimeUpdates();
        get().startRealTimeUpdates();
      }
    },
    
    startRealTimeUpdates: () => {
      const { settings, updateVisualizationData } = get();
      
      if (!settings.enableRealTimeUpdates) return;
      
      // Clear existing interval
      get().stopRealTimeUpdates();
      
      // Initial update
      updateVisualizationData();
      
      // Set up recurring updates
      const interval = setInterval(() => {
        updateVisualizationData();
      }, settings.refreshInterval);
      
      set({ updateInterval: interval });
    },
    
    stopRealTimeUpdates: () => {
      const { updateInterval } = get();
      if (updateInterval) {
        clearInterval(updateInterval);
        set({ updateInterval: null });
      }
    },
    
    exportChart: async (chartType, options) => {
      try {
        // Implementation would depend on the chart library used
        // For now, we'll prepare the data and delegate to a chart export function
        const { visualizationData } = get();
        
        let dataToExport;
        switch (chartType) {
          case 'progress-over-time':
            dataToExport = visualizationData.progressOverTime;
            break;
          case 'model-comparison':
            dataToExport = visualizationData.modelComparison;
            break;
          case 'operation-distribution':
            dataToExport = visualizationData.operationTypeDistribution;
            break;
          default:
            dataToExport = visualizationData;
        }
        
        // This would be implemented by the chart components
        console.log('Exporting chart:', { chartType, options, dataToExport });
        
        // For CSV export
        if (options.format === 'csv') {
          const csvData = convertToCSV(dataToExport);
          downloadFile(csvData, `${chartType}-${Date.now()}.csv`, 'text/csv');
        }
        
        // For JSON export
        if (options.format === 'json') {
          const jsonData = JSON.stringify(dataToExport, null, 2);
          downloadFile(jsonData, `${chartType}-${Date.now()}.json`, 'application/json');
        }
      } catch (error) {
        console.error('Failed to export chart:', error);
        throw error;
      }
    },
    
    resetData: () => {
      set({
        visualizationData: INITIAL_VISUALIZATION_DATA,
        lastUpdated: 0,
        error: null,
      });
    },
    
    // Getters
    getProgressOverTime: (timeWindow = 60) => {
      const { visualizationData } = get();
      const cutoffTime = Date.now() - (timeWindow * 60 * 1000);
      
      return visualizationData.progressOverTime.map(chart => ({
        ...chart,
        data: chart.data.filter(point => point.timestamp >= cutoffTime)
      }));
    },
    
    getModelPerformanceComparison: () => {
      return get().visualizationData.modelComparison;
    },
    
    getOperationDistribution: () => {
      return get().visualizationData.operationTypeDistribution;
    },
    
    getRecentActivity: (limit = 10) => {
      return get().visualizationData.realTimeActivity.slice(0, limit);
    },
    
    getSessionAnalytics: () => {
      return get().visualizationData.sessionMetrics.map(session => ({
        sessionId: session.sessionId,
        startTime: session.startTime,
        duration: (session.endTime || Date.now()) - session.startTime,
        operationCount: session.operationCount,
      }));
    },
  }))
);

// Helper functions
function calculatePerformanceMetrics(operations: Operation[]): PerformanceMetrics {
  const total = operations.length;
  const completed = operations.filter(op => op.status === 'completed').length;
  const failed = operations.filter(op => op.status === 'failed').length;
  const running = operations.filter(op => op.status === 'running').length;
  
  const completedOps = operations.filter(op => op.status === 'completed' && op.duration);
  const averageResponseTime = completedOps.length > 0
    ? completedOps.reduce((sum, op) => sum + (op.duration || 0), 0) / completedOps.length
    : 0;
  
  const successRate = total > 0 ? (completed / total) * 100 : 0;
  const errorRate = total > 0 ? (failed / total) * 100 : 0;
  
  // Calculate operations per minute
  const recentOps = operations.filter(op => op.startTime > Date.now() - (60 * 1000));
  const operationsPerMinute = recentOps.length;
  
  // Calculate model usage stats
  const modelUsageStats: Record<string, number> = {};
  operations.forEach(op => {
    if (op.metadata.model) {
      modelUsageStats[op.metadata.model] = (modelUsageStats[op.metadata.model] || 0) + 1;
    }
  });
  
  // Find peak usage hour (simplified to current hour)
  const currentHour = new Date().getHours();
  const peakUsageHour = currentHour;
  
  return {
    totalOperations: total,
    completedOperations: completed,
    failedOperations: failed,
    runningOperations: running,
    averageResponseTime,
    successRate,
    operationsPerMinute,
    modelUsageStats,
    errorRate,
    peakUsageHour,
  };
}

function generateProgressOverTime(operations: Operation[], timeWindowMinutes: number): ChartData[] {
  const timeWindow = timeWindowMinutes * 60 * 1000; // Convert to milliseconds
  const now = Date.now();
  const startTime = now - timeWindow;
  const interval = Math.max(1000, timeWindow / 100); // At least 1 second intervals
  
  const progressData: TimeSeriesData[] = [];
  const completionData: TimeSeriesData[] = [];
  const errorData: TimeSeriesData[] = [];
  
  for (let time = startTime; time <= now; time += interval) {
    // Count operations at this time point
    let totalProgress = 0;
    let operationCount = 0;
    let completions = 0;
    let errors = 0;
    
    operations.forEach(op => {
      if (op.startTime <= time && (!op.endTime || op.endTime >= time)) {
        operationCount++;
        
        if (op.endTime && op.endTime <= time) {
          if (op.status === 'completed') {
            completions++;
            totalProgress += 100;
          } else if (op.status === 'failed') {
            errors++;
            totalProgress += op.progress || 0;
          }
        } else if (op.status === 'running') {
          const elapsed = time - op.startTime;
          // Estimate progress based on elapsed time (rough estimate)
          const estimatedProgress = Math.min(90, (elapsed / 30000) * 100); // Assume 30s average
          totalProgress += estimatedProgress;
        }
      }
    });
    
    const averageProgress = operationCount > 0 ? totalProgress / operationCount : 0;
    
    progressData.push({
      timestamp: time,
      value: averageProgress,
      label: new Date(time).toLocaleTimeString(),
    });
    
    completionData.push({
      timestamp: time,
      value: completions,
      label: new Date(time).toLocaleTimeString(),
    });
    
    errorData.push({
      timestamp: time,
      value: errors,
      label: new Date(time).toLocaleTimeString(),
    });
  }
  
  return [
    { id: 'progress', name: 'Average Progress', data: progressData },
    { id: 'completions', name: 'Completions', data: completionData },
    { id: 'errors', name: 'Errors', data: errorData },
  ];
}

function calculateModelComparison(operations: Operation[]) {
  const modelStats: Record<string, {
    totalRequests: number;
    completedRequests: number;
    errorCount: number;
    totalResponseTime: number;
  }> = {};
  
  operations.forEach(op => {
    const model = op.metadata.model || 'unknown';
    if (!modelStats[model]) {
      modelStats[model] = {
        totalRequests: 0,
        completedRequests: 0,
        errorCount: 0,
        totalResponseTime: 0,
      };
    }
    
    const stats = modelStats[model];
    stats.totalRequests++;
    
    if (op.status === 'completed') {
      stats.completedRequests++;
      if (op.duration) {
        stats.totalResponseTime += op.duration;
      }
    } else if (op.status === 'failed') {
      stats.errorCount++;
    }
  });
  
  return Object.entries(modelStats).map(([modelId, stats]) => ({
    modelId,
    responseTime: stats.completedRequests > 0 
      ? stats.totalResponseTime / stats.completedRequests 
      : 0,
    successRate: stats.totalRequests > 0 
      ? (stats.completedRequests / stats.totalRequests) * 100 
      : 0,
    totalRequests: stats.totalRequests,
    errorCount: stats.errorCount,
  }));
}

function calculateOperationDistribution(operations: Operation[]) {
  const typeCounts: Record<string, number> = {};
  
  operations.forEach(op => {
    typeCounts[op.type] = (typeCounts[op.type] || 0) + 1;
  });
  
  const total = operations.length;
  
  return Object.entries(typeCounts).map(([type, count]) => ({
    type,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }));
}

function calculateSessionMetrics(sessions: Session[], operations: Operation[]) {
  return sessions.map(session => {
    const sessionOps = operations.filter(op => op.metadata.sessionId === session.id);
    const completedOps = sessionOps.filter(op => op.status === 'completed');
    const successRate = sessionOps.length > 0 
      ? (completedOps.length / sessionOps.length) * 100 
      : 0;
    
    return {
      sessionId: session.id,
      startTime: new Date(session.created_at).getTime(),
      endTime: session.ended_at ? new Date(session.ended_at).getTime() : undefined,
      operationCount: sessionOps.length,
      successRate,
    };
  });
}

function generateTimelineEvents(operations: Operation[], sessions: Session[]) {
  const events: TaskVisualizationData['timelineEvents'] = [];
  
  // Add session events
  sessions.forEach(session => {
    events.push({
      id: `session-start-${session.id}`,
      timestamp: new Date(session.created_at).getTime(),
      type: 'session_start',
      title: 'Session Started',
      description: `New session created with ${session.model || 'unknown'} model`,
      status: 'info',
    });
    
    if (session.ended_at) {
      events.push({
        id: `session-end-${session.id}`,
        timestamp: new Date(session.ended_at).getTime(),
        type: 'session_end',
        title: 'Session Ended',
        description: `Session ${session.id} completed`,
        status: 'info',
      });
    }
  });
  
  // Add operation events
  operations.forEach(op => {
    events.push({
      id: `op-start-${op.id}`,
      timestamp: op.startTime,
      type: 'operation_start',
      title: `${op.name} Started`,
      description: op.description || `${op.type} operation started`,
      status: 'info',
    });
    
    if (op.endTime) {
      events.push({
        id: `op-end-${op.id}`,
        timestamp: op.endTime,
        type: op.status === 'completed' ? 'operation_complete' : 'operation_error',
        title: `${op.name} ${op.status === 'completed' ? 'Completed' : 'Failed'}`,
        description: op.error?.message || `${op.type} operation ${op.status}`,
        status: op.status === 'completed' ? 'success' : 'error',
      });
    }
  });
  
  // Sort by timestamp (newest first) and limit to last 100 events
  return events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);
}

// Utility functions for export
function convertToCSV(data: any): string {
  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }
  return '';
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export store instance for direct access
export const visualizationStore = useVisualizationStore.getState();

// Export types
export type {
  TaskVisualizationData,
  PerformanceMetrics,
  ChartData,
  TimeSeriesData,
  VisualizationSettings,
  ExportOptions,
};