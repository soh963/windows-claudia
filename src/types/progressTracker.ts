/**
 * Types for the enhanced ProgressTracker component system
 * Supporting real-time progress visualization, model performance comparison,
 * and comprehensive metrics tracking for the Claudia chat application
 */

export type ModelType = 'claude' | 'gemini';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number; // 0-100
  startTime: number;
  endTime?: number;
  estimatedDuration?: number;
  category: string;
  model?: ModelType;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface ModelPerformanceMetrics {
  responseTime: number; // Average response time in ms
  accuracy: number; // Success rate percentage (0-100)
  errorCount: number; // Total error count in current session
  successRate: number; // Success rate percentage (0-100)
  totalRequests: number; // Total requests made
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  latency: {
    min: number;
    max: number;
    avg: number;
    p95: number; // 95th percentile
  };
}

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalTasks: number;
  completedTasks: number;
  errorRate: number; // Percentage of failed tasks
  averageTaskDuration: number;
  overallProgress: number; // 0-100
}

export interface ProgressData {
  // Current state
  currentTask?: Task;
  completedTasks: Task[];
  activeTasks: Task[];
  
  // Performance metrics
  errorRate: number; // Percentage (0-100)
  targetAchievement: number; // Target progress percentage
  actualAchievement: number; // Actual progress percentage
  
  // Model comparison
  modelPerformance: {
    claude: ModelPerformanceMetrics;
    gemini: ModelPerformanceMetrics;
  };
  
  // Session data
  sessionMetrics: SessionMetrics;
  
  // Real-time metrics
  throughput: number; // Tasks per minute
  estimatedTimeRemaining?: number; // Milliseconds
  
  // Historical data for charts
  progressHistory: Array<{
    timestamp: number;
    progress: number;
    activeTasksCount: number;
    modelUsed: ModelType;
  }>;
  
  // Performance comparison over time
  performanceHistory: Array<{
    timestamp: number;
    claude: Pick<ModelPerformanceMetrics, 'responseTime' | 'successRate'>;
    gemini: Pick<ModelPerformanceMetrics, 'responseTime' | 'successRate'>;
  }>;
}

export interface ProgressTrackerConfig {
  // Display options
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxWidth: number;
  minWidth: number;
  
  // Behavior options
  autoCollapse: boolean;
  collapseDelay: number; // Milliseconds to wait before auto-collapse
  showNotifications: boolean;
  
  // Data options
  historyRetention: number; // Number of historical data points to keep
  updateInterval: number; // Milliseconds between updates
  
  // Feature toggles
  showModelComparison: boolean;
  showPerformanceGraphs: boolean;
  showSessionHistory: boolean;
  enableRealTimeUpdates: boolean;
}

export interface ProgressTrackerProps {
  className?: string;
  position?: ProgressTrackerConfig['position'];
  maxWidth?: number;
  minWidth?: number;
  onClose?: () => void;
  onModelSwitch?: (model: ModelType) => void;
  onTaskSelect?: (task: Task | null) => void;
  config?: Partial<ProgressTrackerConfig>;
  data?: ProgressData;
}

export interface ProgressTrackerState {
  isExpanded: boolean;
  selectedModel: ModelType;
  selectedTask: Task | null;
  viewMode: 'overview' | 'tasks' | 'performance' | 'history';
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
    read: boolean;
  }>;
}

// Chart data interfaces
export interface ProgressChartData {
  timestamp: number;
  progress: number;
  tasksActive: number;
  model: ModelType;
}

export interface PerformanceChartData {
  timestamp: number;
  responseTime: number;
  successRate: number;
  model: ModelType;
}

export interface ComparisonChartData {
  metric: string;
  claude: number;
  gemini: number;
  unit: string;
}

// Hook interfaces
export interface UseProgressTrackingOptions {
  updateInterval?: number;
  enableRealTime?: boolean;
  historyRetention?: number;
  autoStartSession?: boolean;
}

export interface UseProgressTrackingReturn {
  // Data
  progressData: ProgressData;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startTask: (task: Omit<Task, 'id' | 'startTime' | 'status' | 'progress'>) => string;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  completeTask: (taskId: string, success?: boolean, result?: unknown) => void;
  cancelTask: (taskId: string, reason?: string) => void;
  
  // Session management
  startSession: (sessionId?: string) => void;
  endSession: () => void;
  resetSession: () => void;
  
  // Model switching
  switchModel: (model: ModelType) => void;
  recordModelRequest: (model: ModelType, responseTime: number, success: boolean, tokenUsage?: ModelPerformanceMetrics['tokenUsage']) => void;
  
  // Data management
  clearHistory: () => void;
  exportData: () => string;
  importData: (data: string) => void;
}

// Event interfaces for real-time updates
export interface ProgressEvent {
  type: 'task_start' | 'task_update' | 'task_complete' | 'task_error' | 'model_switch' | 'session_update';
  payload: {
    taskId?: string;
    task?: Task;
    model?: ModelType;
    metrics?: Partial<ModelPerformanceMetrics>;
    session?: Partial<SessionMetrics>;
  };
  timestamp: number;
}

// Color themes for different states
export const PROGRESS_COLORS = {
  pending: 'hsl(var(--muted))',
  in_progress: 'hsl(var(--primary))',
  completed: 'hsl(var(--success))',
  error: 'hsl(var(--destructive))',
  cancelled: 'hsl(var(--muted-foreground))',
} as const;

export const MODEL_COLORS = {
  claude: 'hsl(var(--primary))',
  gemini: 'hsl(var(--secondary))',
} as const;

// Default configuration
export const DEFAULT_PROGRESS_CONFIG: ProgressTrackerConfig = {
  position: 'top-right',
  maxWidth: 300,
  minWidth: 200,
  autoCollapse: true,
  collapseDelay: 5000,
  showNotifications: true,
  historyRetention: 100,
  updateInterval: 1000,
  showModelComparison: true,
  showPerformanceGraphs: true,
  showSessionHistory: true,
  enableRealTimeUpdates: true,
};