import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Brain, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Zap,
  TrendingUp,
  BarChart3,
  Eye,
  EyeOff 
} from 'lucide-react';

interface TaskProgress {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  domain: string;
  estimatedDuration: number;
  startTime?: Date;
  complexity: 'low' | 'medium' | 'high' | 'critical';
}

interface ModelPerformance {
  model_id: string;
  provider: string;
  response_time: number;
  success_rate: number;
  active_sessions: number;
  intelligence_score: number;
  cost_efficiency: number;
}

interface ProgressMetrics {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  failedTasks: number;
  averageTaskTime: number;
  currentModel: string;
  sessionDuration: number;
  tokenUsage: number;
  estimatedCost: number;
}

const VisualProgressTracker: React.FC = () => {
  const [tasks, setTasks] = useState<TaskProgress[]>([]);
  const [models, setModels] = useState<ModelPerformance[]>([]);
  const [metrics, setMetrics] = useState<ProgressMetrics>({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    failedTasks: 0,
    averageTaskTime: 0,
    currentModel: 'auto',
    sessionDuration: 0,
    tokenUsage: 0,
    estimatedCost: 0,
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock data initialization (replace with real data from backend)
  useEffect(() => {
    const initializeMockData = () => {
      const mockTasks: TaskProgress[] = [
        {
          id: '1',
          title: 'Analyze codebase structure',
          status: 'completed',
          progress: 100,
          domain: 'analysis',
          estimatedDuration: 5,
          startTime: new Date(Date.now() - 300000),
          complexity: 'medium',
        },
        {
          id: '2',
          title: 'Implement Auto Smart Selection',
          status: 'in_progress',
          progress: 75,
          domain: 'coding',
          estimatedDuration: 15,
          startTime: new Date(Date.now() - 600000),
          complexity: 'high',
        },
        {
          id: '3',
          title: 'Create visual progress components',
          status: 'in_progress',
          progress: 45,
          domain: 'frontend',
          estimatedDuration: 10,
          startTime: new Date(Date.now() - 180000),
          complexity: 'medium',
        },
        {
          id: '4',
          title: 'Test model integrations',
          status: 'pending',
          progress: 0,
          domain: 'testing',
          estimatedDuration: 8,
          complexity: 'high',
        },
      ];

      const mockModels: ModelPerformance[] = [
        {
          model_id: 'opus-4.1',
          provider: 'claude',
          response_time: 2500,
          success_rate: 99.9,
          active_sessions: 1,
          intelligence_score: 100,
          cost_efficiency: 85,
        },
        {
          model_id: 'gemini-2.5-flash',
          provider: 'gemini',
          response_time: 1200,
          success_rate: 97.0,
          active_sessions: 0,
          intelligence_score: 85,
          cost_efficiency: 95,
        },
        {
          model_id: 'llama3.3:latest',
          provider: 'ollama',
          response_time: 800,
          success_rate: 95.0,
          active_sessions: 0,
          intelligence_score: 85,
          cost_efficiency: 100,
        },
      ];

      setTasks(mockTasks);
      setModels(mockModels);

      // Calculate metrics
      const completedCount = mockTasks.filter(t => t.status === 'completed').length;
      const activeCount = mockTasks.filter(t => t.status === 'in_progress').length;
      const failedCount = mockTasks.filter(t => t.status === 'failed').length;

      setMetrics({
        totalTasks: mockTasks.length,
        completedTasks: completedCount,
        activeTasks: activeCount,
        failedTasks: failedCount,
        averageTaskTime: 450, // seconds
        currentModel: 'opus-4.1',
        sessionDuration: 1800, // 30 minutes
        tokenUsage: 12500,
        estimatedCost: 0.45,
      });
    };

    initializeMockData();
  }, []);

  // Auto-refresh data
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Update progress for in-progress tasks
      setTasks(prevTasks => prevTasks.map(task => {
        if (task.status === 'in_progress' && task.progress < 100) {
          const increment = Math.random() * 5; // Random progress increment
          const newProgress = Math.min(100, task.progress + increment);
          
          if (newProgress >= 100) {
            return { ...task, progress: 100, status: 'completed' as const };
          }
          
          return { ...task, progress: newProgress };
        }
        return task;
      }));

      // Update session duration and token usage
      setMetrics(prevMetrics => ({
        ...prevMetrics,
        sessionDuration: prevMetrics.sessionDuration + 5,
        tokenUsage: prevMetrics.tokenUsage + Math.floor(Math.random() * 50),
        estimatedCost: prevMetrics.estimatedCost + 0.001,
      }));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusIcon = (status: TaskProgress['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getComplexityColor = (complexity: TaskProgress['complexity']) => {
    switch (complexity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getDomainColor = (domain: string) => {
    const colors: Record<string, string> = {
      analysis: 'bg-purple-100 text-purple-800',
      coding: 'bg-blue-100 text-blue-800',
      frontend: 'bg-cyan-100 text-cyan-800',
      testing: 'bg-gray-100 text-gray-800',
      security: 'bg-red-100 text-red-800',
      performance: 'bg-green-100 text-green-800',
    };
    return colors[domain] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(false)}
          className="mb-4"
        >
          <Eye className="h-4 w-4" />
        </Button>
        
        <div className="flex flex-col items-center space-y-2 text-xs text-gray-500">
          <div className="flex items-center">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="ml-1">{metrics.completedTasks}</span>
          </div>
          
          <div className="flex items-center">
            <Activity className="h-3 w-3 text-blue-500" />
            <span className="ml-1">{metrics.activeTasks}</span>
          </div>
          
          <div className="w-8 h-1 bg-gray-200 rounded">
            <div 
              className="h-full bg-green-500 rounded"
              style={{ width: `${(metrics.completedTasks / metrics.totalTasks) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Progress Tracker</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'text-green-600' : 'text-gray-400'}
            >
              <Zap className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(true)}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Session Overview */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Session Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{formatDuration(metrics.sessionDuration)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Current Model:</span>
              <Badge variant="outline" className="text-xs">
                {metrics.currentModel}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Tokens Used:</span>
              <span className="font-medium">{metrics.tokenUsage.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Est. Cost:</span>
              <span className="font-medium text-green-600">${metrics.estimatedCost.toFixed(3)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Task Progress Overview */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{Math.round((metrics.completedTasks / metrics.totalTasks) * 100)}%</span>
              </div>
              <Progress 
                value={(metrics.completedTasks / metrics.totalTasks) * 100} 
                className="h-2"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-green-600 font-semibold">{metrics.completedTasks}</div>
                <div className="text-gray-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-blue-600 font-semibold">{metrics.activeTasks}</div>
                <div className="text-gray-500">Active</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 font-semibold">{metrics.totalTasks - metrics.completedTasks - metrics.activeTasks}</div>
                <div className="text-gray-500">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Tasks */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {getStatusIcon(task.status)}
                      <span className="ml-2 text-sm font-medium truncate">
                        {task.title}
                      </span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getComplexityColor(task.complexity)}`}
                    >
                      {task.complexity}
                    </Badge>
                  </div>
                  
                  {task.status === 'in_progress' && (
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(task.progress)}%</span>
                      </div>
                      <Progress value={task.progress} className="h-1" />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <Badge className={`text-xs ${getDomainColor(task.domain)}`}>
                      {task.domain}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      ~{task.estimatedDuration}min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Model Performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Brain className="h-4 w-4 mr-2" />
              Model Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {models.map((model) => (
                <div key={model.model_id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-xs mr-2">
                        {model.provider}
                      </Badge>
                      <span className="text-sm font-medium">
                        {model.model_id}
                      </span>
                    </div>
                    {model.active_sessions > 0 && (
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Response Time:</span>
                      <span>{model.response_time}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Success Rate:</span>
                      <span className="text-green-600">{model.success_rate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Intelligence:</span>
                      <span>{model.intelligence_score}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost Efficiency:</span>
                      <span className="text-blue-600">{model.cost_efficiency}/100</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VisualProgressTracker;