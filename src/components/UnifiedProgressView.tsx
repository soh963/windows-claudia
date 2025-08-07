/**
 * UnifiedProgressView Component
 * Consolidates ProgressTracker, TaskTimeline, SessionSummary, and TaskProgress
 * into a single, non-duplicating interface
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  FileText,
  Code,
  Brain,
  Zap,
  TrendingUp,
  Award,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { useMonitoringStore } from '@/stores/monitoringStore';

// Types
export interface TaskData {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  startTime: Date;
  endTime?: Date;
  model?: string;
  tokens?: number;
  type?: string;
  error?: string;
}

export interface SessionData {
  id: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  tasks: TaskData[];
  totalTokens: number;
  modelsUsed: string[];
  completionRate: number;
  achievements?: string[];
}

export interface ProgressMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  totalTokensUsed: number;
  averageCompletionTime: number;
  successRate: number;
  modelUsageDistribution: Record<string, number>;
}

interface UnifiedProgressViewProps {
  className?: string;
  position?: 'left' | 'right' | 'floating';
  defaultView?: 'current' | 'timeline' | 'analytics' | 'summary';
  onClose?: () => void;
}

export const UnifiedProgressView: React.FC<UnifiedProgressViewProps> = ({
  className,
  position = 'left',
  defaultView = 'current',
  onClose
}) => {
  const [activeView, setActiveView] = useState(defaultView);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [filterModel, setFilterModel] = useState<string>('all');
  const [showDetails, setShowDetails] = useState(true);
  
  const { operations, sessions, metrics } = useMonitoringStore();
  
  // Process and deduplicate data
  const processedData = useMemo(() => {
    const uniqueTasks = new Map<string, TaskData>();
    const uniqueSessions = new Map<string, SessionData>();
    
    // Process operations into tasks
    operations.forEach(op => {
      if (!uniqueTasks.has(op.id)) {
        uniqueTasks.set(op.id, {
          id: op.id,
          name: op.name,
          status: op.status === 'active' ? 'running' : op.status as any,
          progress: op.progress,
          startTime: op.startTime,
          endTime: op.endTime,
          model: op.metadata?.model,
          tokens: op.metrics?.tokens,
          type: op.type,
          error: op.error
        });
      }
    });
    
    // Process sessions
    sessions?.forEach(session => {
      if (!uniqueSessions.has(session.id)) {
        const sessionTasks = Array.from(uniqueTasks.values()).filter(
          task => task.startTime >= session.startTime && 
                  (!session.endTime || task.startTime <= session.endTime)
        );
        
        uniqueSessions.set(session.id, {
          id: session.id,
          title: session.title || `Session ${session.id.slice(0, 8)}`,
          startTime: session.startTime,
          endTime: session.endTime,
          tasks: sessionTasks,
          totalTokens: sessionTasks.reduce((sum, task) => sum + (task.tokens || 0), 0),
          modelsUsed: [...new Set(sessionTasks.map(t => t.model).filter(Boolean))],
          completionRate: sessionTasks.length > 0 
            ? (sessionTasks.filter(t => t.status === 'completed').length / sessionTasks.length) * 100
            : 0,
          achievements: session.achievements
        });
      }
    });
    
    return {
      tasks: Array.from(uniqueTasks.values()),
      sessions: Array.from(uniqueSessions.values()),
      currentTasks: Array.from(uniqueTasks.values()).filter(t => 
        t.status === 'running' || t.status === 'pending'
      ),
      completedTasks: Array.from(uniqueTasks.values()).filter(t => 
        t.status === 'completed' || t.status === 'failed'
      )
    };
  }, [operations, sessions]);
  
  // Calculate metrics
  const calculatedMetrics: ProgressMetrics = useMemo(() => {
    const tasks = processedData.tasks;
    const completed = tasks.filter(t => t.status === 'completed');
    const inProgress = tasks.filter(t => t.status === 'running');
    const failed = tasks.filter(t => t.status === 'failed');
    
    const modelUsage: Record<string, number> = {};
    tasks.forEach(task => {
      if (task.model) {
        modelUsage[task.model] = (modelUsage[task.model] || 0) + 1;
      }
    });
    
    const avgTime = completed.length > 0
      ? completed.reduce((sum, task) => {
          const duration = task.endTime 
            ? task.endTime.getTime() - task.startTime.getTime()
            : 0;
          return sum + duration;
        }, 0) / completed.length
      : 0;
    
    return {
      tasksCompleted: completed.length,
      tasksInProgress: inProgress.length,
      tasksFailed: failed.length,
      totalTokensUsed: tasks.reduce((sum, t) => sum + (t.tokens || 0), 0),
      averageCompletionTime: avgTime,
      successRate: tasks.length > 0 
        ? (completed.length / (completed.length + failed.length)) * 100
        : 0,
      modelUsageDistribution: modelUsage
    };
  }, [processedData]);
  
  // Filter tasks based on model
  const filteredTasks = useMemo(() => {
    if (filterModel === 'all') return processedData.tasks;
    return processedData.tasks.filter(task => task.model === filterModel);
  }, [processedData.tasks, filterModel]);
  
  // Chart data preparation
  const timelineChartData = useMemo(() => {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyData: Record<string, { hour: string; tasks: number; tokens: number }> = {};
    
    processedData.tasks
      .filter(task => task.startTime >= last24Hours)
      .forEach(task => {
        const hour = format(task.startTime, 'HH:00');
        if (!hourlyData[hour]) {
          hourlyData[hour] = { hour, tasks: 0, tokens: 0 };
        }
        hourlyData[hour].tasks++;
        hourlyData[hour].tokens += task.tokens || 0;
      });
    
    return Object.values(hourlyData).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [processedData.tasks]);
  
  const modelDistributionData = useMemo(() => {
    return Object.entries(calculatedMetrics.modelUsageDistribution).map(([model, count]) => ({
      name: model,
      value: count,
      percentage: ((count / processedData.tasks.length) * 100).toFixed(1)
    }));
  }, [calculatedMetrics.modelUsageDistribution, processedData.tasks.length]);
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  
  // Render functions for different views
  const renderCurrentTasksView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Current Task Execution</h3>
        <Badge variant="default">
          {processedData.currentTasks.length} Active
        </Badge>
      </div>
      
      {processedData.currentTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active tasks</p>
        </div>
      ) : (
        <div className={cn("space-y-2", viewMode === 'grid' && "grid grid-cols-2 gap-2 space-y-0")}>
          {processedData.currentTasks.map(task => (
            <Card key={task.id} className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {task.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">{task.name}</span>
                </div>
                {task.model && (
                  <Badge variant="outline" className="text-xs">
                    {task.model}
                  </Badge>
                )}
              </div>
              
              {task.progress !== undefined && (
                <Progress value={task.progress} className="h-1.5 mb-2" />
              )}
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formatDistanceToNow(task.startTime, { addSuffix: true })}</span>
                {task.tokens && (
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {task.tokens}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
  
  const renderTimelineView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Task Timeline</h3>
        <Select value={filterModel} onValueChange={setFilterModel}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            {Object.keys(calculatedMetrics.modelUsageDistribution).map(model => (
              <SelectItem key={model} value={model}>{model}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Card className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={timelineChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Area 
              type="monotone" 
              dataKey="tasks" 
              stroke="#3b82f6" 
              fill="#3b82f6" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      
      <ScrollArea className="h-64">
        <div className="space-y-2">
          {filteredTasks.slice(0, 20).map(task => (
            <div key={task.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
              <div className="flex items-center gap-2">
                {task.status === 'completed' ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : task.status === 'failed' ? (
                  <XCircle className="h-3 w-3 text-red-500" />
                ) : task.status === 'running' ? (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                ) : (
                  <Clock className="h-3 w-3 text-gray-400" />
                )}
                <span className="text-xs">{task.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(task.startTime, 'HH:mm')}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
  
  const renderAnalyticsView = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold mb-4">Performance Analytics</h3>
      
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-2xl font-bold">{calculatedMetrics.tasksCompleted}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Completed</p>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-2xl font-bold">
              {calculatedMetrics.successRate.toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Success Rate</p>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <Hash className="h-4 w-4 text-purple-500" />
            <span className="text-lg font-bold">
              {(calculatedMetrics.totalTokensUsed / 1000).toFixed(1)}k
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Tokens Used</p>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-lg font-bold">
              {(calculatedMetrics.averageCompletionTime / 1000).toFixed(0)}s
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Avg Time</p>
        </Card>
      </div>
      
      {modelDistributionData.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold mb-3">Model Usage Distribution</h4>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={modelDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {modelDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1">
            {modelDistributionData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span>{entry.name}</span>
                </div>
                <span className="text-muted-foreground">{entry.percentage}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
  
  const renderSessionSummaryView = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold mb-4">Session Overview</h3>
      
      {processedData.sessions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No completed sessions</p>
        </div>
      ) : (
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {processedData.sessions.map(session => (
              <Card key={session.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium">{session.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {format(session.startTime, 'MMM d, HH:mm')}
                    </p>
                  </div>
                  <Badge variant={session.completionRate >= 80 ? "default" : "secondary"}>
                    {session.completionRate.toFixed(0)}% Complete
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Tasks</p>
                    <p className="font-medium">{session.tasks.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tokens</p>
                    <p className="font-medium">{(session.totalTokens / 1000).toFixed(1)}k</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Models</p>
                    <p className="font-medium">{session.modelsUsed.length}</p>
                  </div>
                </div>
                
                {session.achievements && session.achievements.length > 0 && (
                  <div className="flex items-center gap-1 mt-3">
                    {session.achievements.map((achievement, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        <Award className="h-3 w-3 mr-1" />
                        {achievement}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
  
  const positionClasses = {
    left: "fixed left-4 top-20 bottom-20 w-80",
    right: "fixed right-4 top-20 bottom-20 w-80",
    floating: "fixed bottom-4 right-4 w-96"
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: position === 'left' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: position === 'left' ? -20 : 20 }}
      className={cn(positionClasses[position], "z-40", className)}
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Progress Monitor
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              >
                {viewMode === 'list' ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
              </Button>
              {onClose && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={onClose}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden">
          <Tabs value={activeView} onValueChange={setActiveView} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="current" className="text-xs">Current</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
              <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto mt-4">
              <TabsContent value="current" className="mt-0">
                {renderCurrentTasksView()}
              </TabsContent>
              
              <TabsContent value="timeline" className="mt-0">
                {renderTimelineView()}
              </TabsContent>
              
              <TabsContent value="analytics" className="mt-0">
                {renderAnalyticsView()}
              </TabsContent>
              
              <TabsContent value="summary" className="mt-0">
                {renderSessionSummaryView()}
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default UnifiedProgressView;