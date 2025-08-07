import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Pause,
  Brain,
  Code,
  Search,
  FileText,
  Zap,
  TrendingUp,
  BarChart3,
  Filter,
  Download,
  Eye,
  EyeOff,
  Calendar,
  Timer,
  Target
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'task_start' | 'task_complete' | 'task_fail' | 'model_switch' | 'session_start' | 'session_end' | 'milestone';
  title: string;
  description: string;
  model?: string;
  duration?: number; // in seconds
  domain: string;
  metadata?: Record<string, any>;
  status: 'success' | 'error' | 'info' | 'warning';
}

interface SessionSummary {
  sessionId: string;
  startTime: Date;
  duration: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  modelsUsed: string[];
  primaryModel: string;
  totalTokens: number;
  estimatedCost: number;
  domains: string[];
  achievements: string[];
}

interface TaskMetrics {
  averageTaskTime: number;
  successRate: number;
  mostUsedModel: string;
  mostActiveDomain: string;
  productivityScore: number;
  currentStreak: number;
}

const SessionTaskTimeline: React.FC = () => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [metrics, setMetrics] = useState<TaskMetrics>({
    averageTaskTime: 0,
    successRate: 0,
    mostUsedModel: '',
    mostActiveDomain: '',
    productivityScore: 0,
    currentStreak: 0,
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  // Mock data initialization
  useEffect(() => {
    const initializeData = () => {
      const now = new Date();
      const sessionStart = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      const mockEvents: TimelineEvent[] = [
        {
          id: '1',
          timestamp: sessionStart,
          type: 'session_start',
          title: 'Session Started',
          description: 'New development session initialized',
          domain: 'system',
          status: 'info',
          metadata: { sessionId: 'sess_123', model: 'auto' }
        },
        {
          id: '2',
          timestamp: new Date(sessionStart.getTime() + 2 * 60 * 1000),
          type: 'model_switch',
          title: 'Auto Model Selection',
          description: 'Selected Claude 4.1 Opus for complex coding task',
          model: 'opus-4.1',
          domain: 'system',
          status: 'success',
          metadata: { reasoning: 'High complexity task detected', confidence: 0.98 }
        },
        {
          id: '3',
          timestamp: new Date(sessionStart.getTime() + 3 * 60 * 1000),
          type: 'task_start',
          title: 'Codebase Analysis Started',
          description: 'Analyzing project structure and dependencies',
          model: 'opus-4.1',
          domain: 'analysis',
          status: 'info',
          metadata: { complexity: 'medium', estimatedDuration: 5 }
        },
        {
          id: '4',
          timestamp: new Date(sessionStart.getTime() + 8 * 60 * 1000),
          type: 'task_complete',
          title: 'Codebase Analysis Complete',
          description: 'Successfully analyzed 45 files across 12 modules',
          model: 'opus-4.1',
          duration: 300,
          domain: 'analysis',
          status: 'success',
          metadata: { filesAnalyzed: 45, modulesFound: 12, issuesDetected: 3 }
        },
        {
          id: '5',
          timestamp: new Date(sessionStart.getTime() + 10 * 60 * 1000),
          type: 'task_start',
          title: 'Auto Smart Selection Implementation',
          description: 'Building intelligent model routing system',
          model: 'opus-4.1',
          domain: 'coding',
          status: 'info',
          metadata: { complexity: 'high', estimatedDuration: 15 }
        },
        {
          id: '6',
          timestamp: new Date(sessionStart.getTime() + 15 * 60 * 1000),
          type: 'milestone',
          title: 'Benchmark System Created',
          description: 'Successfully implemented AI model benchmarking',
          model: 'opus-4.1',
          domain: 'coding',
          status: 'success',
          metadata: { linesAdded: 350, testsCreated: 12 }
        },
        {
          id: '7',
          timestamp: new Date(sessionStart.getTime() + 20 * 60 * 1000),
          type: 'model_switch',
          title: 'Model Switch to Gemini',
          description: 'Switched to Gemini 2.5 Flash for UI component generation',
          model: 'gemini-2.5-flash',
          domain: 'frontend',
          status: 'info',
          metadata: { reasoning: 'UI generation task', confidence: 0.92 }
        },
        {
          id: '8',
          timestamp: new Date(sessionStart.getTime() + 25 * 60 * 1000),
          type: 'task_start',
          title: 'Progress Tracker UI',
          description: 'Creating visual progress tracking components',
          model: 'gemini-2.5-flash',
          domain: 'frontend',
          status: 'info',
          metadata: { complexity: 'medium', estimatedDuration: 10 }
        },
      ];

      const mockSummary: SessionSummary = {
        sessionId: 'sess_123',
        startTime: sessionStart,
        duration: 30 * 60, // 30 minutes
        totalTasks: 4,
        completedTasks: 3,
        failedTasks: 0,
        modelsUsed: ['opus-4.1', 'gemini-2.5-flash'],
        primaryModel: 'opus-4.1',
        totalTokens: 18500,
        estimatedCost: 0.67,
        domains: ['analysis', 'coding', 'frontend', 'system'],
        achievements: [
          'First successful Auto Smart Selection',
          'Implemented comprehensive benchmarking',
          'Created visual progress tracker',
          'Zero failed tasks'
        ]
      };

      const mockMetrics: TaskMetrics = {
        averageTaskTime: 420, // 7 minutes
        successRate: 100,
        mostUsedModel: 'opus-4.1',
        mostActiveDomain: 'coding',
        productivityScore: 95,
        currentStreak: 8, // consecutive successful tasks
      };

      setEvents(mockEvents);
      setSessionSummary(mockSummary);
      setMetrics(mockMetrics);
    };

    initializeData();
  }, []);

  // Auto-refresh and add new events
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new events occasionally
      if (Math.random() < 0.1) { // 10% chance every 10 seconds
        const newEvent: TimelineEvent = {
          id: `event_${Date.now()}`,
          timestamp: new Date(),
          type: 'milestone',
          title: 'Progress Update',
          description: 'Task progress milestone reached',
          domain: 'system',
          status: 'success',
          metadata: { progress: Math.floor(Math.random() * 30) + 70 }
        };
        
        setEvents(prev => [newEvent, ...prev.slice(0, 49)]); // Keep latest 50 events
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'task_start':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'task_complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'task_fail':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'model_switch':
        return <Brain className="h-4 w-4 text-purple-500" />;
      case 'milestone':
        return <Target className="h-4 w-4 text-yellow-500" />;
      case 'session_start':
        return <Zap className="h-4 w-4 text-green-600" />;
      case 'session_end':
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getDomainColor = (domain: string) => {
    const colors: Record<string, string> = {
      analysis: 'bg-purple-100 text-purple-800',
      coding: 'bg-blue-100 text-blue-800',
      frontend: 'bg-cyan-100 text-cyan-800',
      system: 'bg-gray-100 text-gray-800',
      testing: 'bg-green-100 text-green-800',
      security: 'bg-red-100 text-red-800',
    };
    return colors[domain] || 'bg-gray-100 text-gray-800';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const filteredEvents = filterType === 'all' 
    ? events 
    : events.filter(event => event.type === filterType);

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-white border-l border-gray-200 flex flex-col items-center py-4">
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
            <span className="ml-1">{sessionSummary?.completedTasks || 0}</span>
          </div>
          
          <div className="flex items-center">
            <Clock className="h-3 w-3 text-blue-500" />
            <span className="ml-1">{events.length}</span>
          </div>
          
          <div className="w-8 h-1 bg-gray-200 rounded">
            <div 
              className="h-full bg-blue-500 rounded"
              style={{ width: `${metrics.productivityScore}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-800">Session Timeline</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {/* Export functionality */}}
            >
              <Download className="h-4 w-4" />
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

        {/* Session Summary */}
        {sessionSummary && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                Session Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">{formatDuration(sessionSummary.duration)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Tasks:</span>
                <span className="font-medium">{sessionSummary.completedTasks}/{sessionSummary.totalTasks}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Primary Model:</span>
                <Badge variant="outline" className="text-xs">
                  {sessionSummary.primaryModel}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-medium text-green-600">${sessionSummary.estimatedCost.toFixed(3)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Success Rate:</span>
                <span className="font-medium text-green-600">{metrics.successRate}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Metrics */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="text-center">
                <div className="text-blue-600 font-semibold text-lg">{Math.round(metrics.averageTaskTime / 60)}</div>
                <div className="text-gray-500">Avg Task (min)</div>
              </div>
              <div className="text-center">
                <div className="text-green-600 font-semibold text-lg">{metrics.productivityScore}</div>
                <div className="text-gray-500">Productivity</div>
              </div>
              <div className="text-center">
                <div className="text-purple-600 font-semibold text-lg">{metrics.currentStreak}</div>
                <div className="text-gray-500">Success Streak</div>
              </div>
              <div className="text-center">
                <div className="text-orange-600 font-semibold text-lg">{sessionSummary?.domains.length || 0}</div>
                <div className="text-gray-500">Domains</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        {sessionSummary?.achievements && sessionSummary.achievements.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Target className="h-4 w-4 mr-2" />
                Session Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sessionSummary.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-700">{achievement}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter Controls */}
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border rounded px-2 py-1 bg-white"
          >
            <option value="all">All Events</option>
            <option value="task_start">Task Starts</option>
            <option value="task_complete">Completions</option>
            <option value="model_switch">Model Changes</option>
            <option value="milestone">Milestones</option>
          </select>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Event Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredEvents.map((event, index) => (
                  <div key={event.id}>
                    <div className={`p-3 rounded-lg border ${getStatusColor(event.status)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          {getEventIcon(event.type)}
                          <span className="ml-2 text-sm font-medium">
                            {event.title}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ${getDomainColor(event.domain)}`}>
                            {event.domain}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {event.model && (
                            <Badge variant="outline" className="text-xs">
                              {event.model}
                            </Badge>
                          )}
                          {event.duration && (
                            <span className="text-xs text-gray-500">
                              <Timer className="h-3 w-3 inline mr-1" />
                              {formatDuration(event.duration)}
                            </span>
                          )}
                        </div>
                        
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="text-xs text-gray-500">
                            {event.metadata.confidence && `${Math.round(event.metadata.confidence * 100)}% confidence`}
                            {event.metadata.linesAdded && `+${event.metadata.linesAdded} lines`}
                            {event.metadata.filesAnalyzed && `${event.metadata.filesAnalyzed} files`}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {index < filteredEvents.length - 1 && (
                      <div className="flex justify-center my-2">
                        <div className="w-px h-4 bg-gray-200"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SessionTaskTimeline;