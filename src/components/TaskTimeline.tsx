/**
 * Task Timeline Component (Right Panel)
 * Session summary, task analytics, and achievement tracking
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Brain,
  Code,
  FileText,
  TrendingUp,
  Award,
  Calendar,
  BarChart3,
  Download,
  Filter,
  X
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { cn } from '@/lib/utils';

export interface TaskSummary {
  id: string;
  title: string;
  model_used: string;
  duration: number;
  status: 'completed' | 'failed' | 'partial';
  complexity: 'low' | 'medium' | 'high';
  tokens_used: number;
  timestamp: Date;
  achievements: string[];
}

export interface SessionSummary {
  session_id: string;
  timestamp: Date;
  duration: number;
  primary_model: string;
  supporting_models: string[];
  tasks_completed: number;
  tasks_failed: number;
  code_generated: number;
  documents_analyzed: number;
  success_rate: number;
  average_response_time: number;
  user_satisfaction: number;
  major_completions: string[];
  issues_resolved: string[];
  new_features_added: string[];
  tasks: TaskSummary[];
}

export interface ProductivityMetric {
  date: string;
  tasks_completed: number;
  success_rate: number;
  avg_response_time: number;
  models_used: number;
}

interface TaskTimelineProps {
  className?: string;
  onClose?: () => void;
}

const TaskTimeline: React.FC<TaskTimelineProps> = ({ className, onClose }) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'completed' | 'failed'>('all');
  const [productivityData, setProductivityData] = useState<ProductivityMetric[]>([]);

  // Mock data - replace with real data from your store/API
  useEffect(() => {
    const mockSessions: SessionSummary[] = [
      {
        session_id: 'session-001',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        duration: 45 * 60 * 1000, // 45 minutes
        primary_model: 'claude-4.1-opus',
        supporting_models: ['gemini-2.5-pro', 'llama3.3:latest'],
        tasks_completed: 8,
        tasks_failed: 1,
        code_generated: 450,
        documents_analyzed: 3,
        success_rate: 88.9,
        average_response_time: 2200,
        user_satisfaction: 92,
        major_completions: [
          'Implemented user authentication system',
          'Created responsive dashboard layout',
          'Fixed critical performance bug'
        ],
        issues_resolved: [
          'Memory leak in React components',
          'API rate limiting issues'
        ],
        new_features_added: [
          'Dark mode toggle',
          'Export functionality'
        ],
        tasks: [
          {
            id: 'task-001',
            title: 'Create authentication system',
            model_used: 'claude-4.1-opus',
            duration: 12 * 60 * 1000,
            status: 'completed',
            complexity: 'high',
            tokens_used: 15420,
            timestamp: new Date(Date.now() - 3000000),
            achievements: ['Security Best Practice', 'Clean Code']
          },
          {
            id: 'task-002',
            title: 'Design responsive layout',
            model_used: 'gemini-2.5-pro',
            duration: 8 * 60 * 1000,
            status: 'completed',
            complexity: 'medium',
            tokens_used: 8750,
            timestamp: new Date(Date.now() - 2400000),
            achievements: ['UI Excellence', 'Mobile First']
          },
          {
            id: 'task-003',
            title: 'Optimize database queries',
            model_used: 'llama3.3:latest',
            duration: 15 * 60 * 1000,
            status: 'failed',
            complexity: 'high',
            tokens_used: 12340,
            timestamp: new Date(Date.now() - 1800000),
            achievements: []
          }
        ]
      },
      {
        session_id: 'session-002',
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        duration: 32 * 60 * 1000, // 32 minutes
        primary_model: 'gemini-2.5-flash',
        supporting_models: ['claude-3.7-sonnet'],
        tasks_completed: 5,
        tasks_failed: 0,
        code_generated: 280,
        documents_analyzed: 8,
        success_rate: 100,
        average_response_time: 1500,
        user_satisfaction: 98,
        major_completions: [
          'Analyzed large dataset',
          'Generated comprehensive report',
          'Created data visualization'
        ],
        issues_resolved: [],
        new_features_added: [
          'Advanced filtering',
          'Export to CSV'
        ],
        tasks: [
          {
            id: 'task-004',
            title: 'Data analysis and visualization',
            model_used: 'gemini-2.5-flash',
            duration: 18 * 60 * 1000,
            status: 'completed',
            complexity: 'medium',
            tokens_used: 45680,
            timestamp: new Date(Date.now() - 6600000),
            achievements: ['Data Insight', 'Visualization Expert']
          }
        ]
      }
    ];

    const mockProductivityData: ProductivityMetric[] = [
      { date: '09:00', tasks_completed: 12, success_rate: 92, avg_response_time: 1800, models_used: 3 },
      { date: '10:00', tasks_completed: 18, success_rate: 94, avg_response_time: 1650, models_used: 4 },
      { date: '11:00', tasks_completed: 15, success_rate: 88, avg_response_time: 2100, models_used: 3 },
      { date: '12:00', tasks_completed: 22, success_rate: 96, avg_response_time: 1420, models_used: 5 },
      { date: '13:00', tasks_completed: 19, success_rate: 91, avg_response_time: 1750, models_used: 4 },
      { date: '14:00', tasks_completed: 25, success_rate: 97, avg_response_time: 1380, models_used: 6 }
    ];

    setSessions(mockSessions);
    setProductivityData(mockProductivityData);
  }, []);

  const filteredSessions = sessions.filter(session => {
    const now = new Date();
    const sessionDate = session.timestamp;
    
    // Time range filter
    let withinTimeRange = true;
    switch (selectedTimeRange) {
      case 'today':
        withinTimeRange = sessionDate.toDateString() === now.toDateString();
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        withinTimeRange = sessionDate >= weekAgo;
        break;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        withinTimeRange = sessionDate >= monthAgo;
        break;
    }

    return withinTimeRange;
  });

  const overallStats = {
    totalSessions: filteredSessions.length,
    totalTasks: filteredSessions.reduce((sum, session) => sum + session.tasks_completed + session.tasks_failed, 0),
    successRate: filteredSessions.length > 0 
      ? (filteredSessions.reduce((sum, session) => sum + session.success_rate, 0) / filteredSessions.length)
      : 0,
    avgResponseTime: filteredSessions.length > 0
      ? (filteredSessions.reduce((sum, session) => sum + session.average_response_time, 0) / filteredSessions.length)
      : 0,
    totalCodeGenerated: filteredSessions.reduce((sum, session) => sum + session.code_generated, 0),
    uniqueModelsUsed: new Set(filteredSessions.flatMap(s => [s.primary_model, ...s.supporting_models])).size
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={cn("flex flex-col h-full p-4 space-y-4 overflow-y-auto bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Task Timeline
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant={selectedTimeRange === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeRange('today')}
          >
            Today
          </Button>
          <Button
            variant={selectedTimeRange === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeRange('week')}
          >
            Week
          </Button>
          <Button
            variant={selectedTimeRange === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTimeRange('month')}
          >
            Month
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Overview Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Session Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{overallStats.totalSessions}</div>
              <div className="text-muted-foreground">Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{overallStats.totalTasks}</div>
              <div className="text-muted-foreground">Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{overallStats.successRate.toFixed(1)}%</div>
              <div className="text-muted-foreground">Success Rate</div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Response Time</span>
              <span className="font-medium">{overallStats.avgResponseTime.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code Generated</span>
              <span className="font-medium">{overallStats.totalCodeGenerated} lines</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Models Used</span>
              <span className="font-medium">{overallStats.uniqueModelsUsed} unique</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Session Time</span>
              <span className="font-medium">
                {filteredSessions.length > 0 
                  ? formatDuration(filteredSessions.reduce((sum, s) => sum + s.duration, 0) / filteredSessions.length)
                  : '0m 0s'
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Productivity Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Productivity Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productivityData}>
                <defs>
                  <linearGradient id="productivityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  fontSize={10}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  fontSize={10}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tasks_completed"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#productivityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Session List */}
      <div className="space-y-3">
        {filteredSessions.map((session, index) => (
          <motion.div
            key={session.session_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Brain className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{formatTime(session.timestamp)}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {session.primary_model.split('-')[0]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDuration(session.duration)}</span>
                    <span>•</span>
                    <span>{session.success_rate.toFixed(0)}% success</span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Session Stats */}
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-green-600">{session.tasks_completed}</div>
                    <div className="text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-red-600">{session.tasks_failed}</div>
                    <div className="text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">{session.code_generated}</div>
                    <div className="text-muted-foreground">Lines Code</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-purple-600">{session.documents_analyzed}</div>
                    <div className="text-muted-foreground">Docs</div>
                  </div>
                </div>

                {/* Major Achievements */}
                {session.major_completions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      Major Completions
                    </h4>
                    <div className="space-y-1">
                      {session.major_completions.map((completion, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>{completion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Tasks */}
                {session.tasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium">Task Breakdown</h4>
                    <div className="space-y-2">
                      {session.tasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="flex items-center gap-2 p-2 border rounded text-xs">
                          {getStatusIcon(task.status)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{task.title}</div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>{task.model_used.split('-')[0]}</span>
                              <span>•</span>
                              <span>{formatDuration(task.duration)}</span>
                              <span>•</span>
                              <div className={`w-2 h-2 rounded-full ${getComplexityColor(task.complexity)}`} />
                              <span>{task.complexity}</span>
                            </div>
                          </div>
                          {task.achievements.length > 0 && (
                            <div className="flex gap-1">
                              {task.achievements.slice(0, 2).map((achievement, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs px-1">
                                  {achievement}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {session.tasks.length > 3 && (
                        <div className="text-center text-xs text-muted-foreground">
                          +{session.tasks.length - 3} more tasks
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Models Used */}
                {session.supporting_models.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium">Models Used</h4>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="default" className="text-xs">
                        {session.primary_model} (Primary)
                      </Badge>
                      {session.supporting_models.map((model, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredSessions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No sessions found for the selected time range.</p>
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <Download className="h-3 w-3 mr-1" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <FileText className="h-3 w-3 mr-1" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskTimeline;