import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  PlayCircle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  Activity,
  TrendingUp,
  AlertTriangle,
  Zap,
  Timer,
  GitBranch,
  Code,
  TestTube,
  Rocket,
  Bug,
  RefreshCw,
  Eye,
  Settings,
  Plus,
  Pause,
  Play,
  RotateCcw,
  Layout,
  Network
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowStage } from '@/lib/api';

// Workflow templates
export type WorkflowTemplate = 'feature' | 'bugfix' | 'refactor' | 'release' | 'custom';

export interface WorkflowNode {
  id: string;
  name: string;
  type: 'planning' | 'coding' | 'testing' | 'deployment' | 'review' | 'integration';
  status: 'pending' | 'active' | 'completed' | 'blocked' | 'skipped';
  dependencies?: string[];
  duration?: number;
  assignee?: string;
  description?: string;
  progress?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowConnection {
  source: string;
  target: string;
  type?: 'sequential' | 'parallel' | 'conditional';
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  template: WorkflowTemplate;
  description?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  metadata?: Record<string, any>;
}

interface WorkflowVisualizationProps {
  stages: WorkflowStage[];
  loading?: boolean;
  onStageClick?: (stage: WorkflowStage) => void;
  onTemplateChange?: (template: WorkflowTemplate) => void;
  activeTemplate?: WorkflowTemplate;
  realTimeUpdates?: boolean;
}

const WorkflowVisualization: React.FC<WorkflowVisualizationProps> = ({ 
  stages,
  loading = false,
  onStageClick,
  onTemplateChange,
  activeTemplate = 'feature',
  realTimeUpdates = true
}) => {
  // State for view mode and filtering
  const [viewMode, setViewMode] = useState<'timeline' | 'diagram' | 'kanban'>('timeline');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<WorkflowStage | null>(null);

  // Workflow templates definitions
  const workflowTemplates: Record<WorkflowTemplate, WorkflowDefinition> = useMemo(() => ({
    feature: {
      id: 'feature-dev',
      name: 'Feature Development',
      template: 'feature',
      description: 'Standard feature development workflow',
      nodes: [
        { id: 'planning', name: 'Planning & Design', type: 'planning', status: 'pending' },
        { id: 'coding', name: 'Development', type: 'coding', status: 'pending', dependencies: ['planning'] },
        { id: 'review', name: 'Code Review', type: 'review', status: 'pending', dependencies: ['coding'] },
        { id: 'testing', name: 'Testing', type: 'testing', status: 'pending', dependencies: ['review'] },
        { id: 'integration', name: 'Integration', type: 'integration', status: 'pending', dependencies: ['testing'] },
        { id: 'deployment', name: 'Deployment', type: 'deployment', status: 'pending', dependencies: ['integration'] }
      ],
      connections: [
        { source: 'planning', target: 'coding', type: 'sequential' },
        { source: 'coding', target: 'review', type: 'sequential' },
        { source: 'review', target: 'testing', type: 'sequential' },
        { source: 'testing', target: 'integration', type: 'sequential' },
        { source: 'integration', target: 'deployment', type: 'sequential' }
      ]
    },
    bugfix: {
      id: 'bug-fix',
      name: 'Bug Fix Workflow',
      template: 'bugfix',
      description: 'Streamlined bug fix process',
      nodes: [
        { id: 'investigation', name: 'Bug Investigation', type: 'planning', status: 'pending' },
        { id: 'fix', name: 'Implement Fix', type: 'coding', status: 'pending', dependencies: ['investigation'] },
        { id: 'testing', name: 'Testing & Validation', type: 'testing', status: 'pending', dependencies: ['fix'] },
        { id: 'deployment', name: 'Deploy Fix', type: 'deployment', status: 'pending', dependencies: ['testing'] }
      ],
      connections: [
        { source: 'investigation', target: 'fix', type: 'sequential' },
        { source: 'fix', target: 'testing', type: 'sequential' },
        { source: 'testing', target: 'deployment', type: 'sequential' }
      ]
    },
    refactor: {
      id: 'refactor',
      name: 'Code Refactoring',
      template: 'refactor',
      description: 'Code quality improvement workflow',
      nodes: [
        { id: 'analysis', name: 'Code Analysis', type: 'planning', status: 'pending' },
        { id: 'refactoring', name: 'Refactoring', type: 'coding', status: 'pending', dependencies: ['analysis'] },
        { id: 'testing', name: 'Regression Testing', type: 'testing', status: 'pending', dependencies: ['refactoring'] },
        { id: 'review', name: 'Quality Review', type: 'review', status: 'pending', dependencies: ['testing'] },
        { id: 'deployment', name: 'Deploy Changes', type: 'deployment', status: 'pending', dependencies: ['review'] }
      ],
      connections: [
        { source: 'analysis', target: 'refactoring', type: 'sequential' },
        { source: 'refactoring', target: 'testing', type: 'sequential' },
        { source: 'testing', target: 'review', type: 'sequential' },
        { source: 'review', target: 'deployment', type: 'sequential' }
      ]
    },
    release: {
      id: 'release',
      name: 'Release Workflow',
      template: 'release',
      description: 'Production release process',
      nodes: [
        { id: 'preparation', name: 'Release Preparation', type: 'planning', status: 'pending' },
        { id: 'build', name: 'Build & Package', type: 'integration', status: 'pending', dependencies: ['preparation'] },
        { id: 'staging', name: 'Staging Deployment', type: 'deployment', status: 'pending', dependencies: ['build'] },
        { id: 'testing', name: 'UAT Testing', type: 'testing', status: 'pending', dependencies: ['staging'] },
        { id: 'production', name: 'Production Deployment', type: 'deployment', status: 'pending', dependencies: ['testing'] },
        { id: 'monitoring', name: 'Post-Release Monitoring', type: 'review', status: 'pending', dependencies: ['production'] }
      ],
      connections: [
        { source: 'preparation', target: 'build', type: 'sequential' },
        { source: 'build', target: 'staging', type: 'sequential' },
        { source: 'staging', target: 'testing', type: 'sequential' },
        { source: 'testing', target: 'production', type: 'sequential' },
        { source: 'production', target: 'monitoring', type: 'sequential' }
      ]
    },
    custom: {
      id: 'custom',
      name: 'Custom Workflow',
      template: 'custom',
      description: 'Customizable workflow template',
      nodes: [],
      connections: []
    }
  }), []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-500 text-white';
      case 'active': return 'bg-blue-500 text-white';
      case 'in_progress': return 'bg-blue-500 text-white';
      case 'pending': return 'bg-yellow-500 text-black';
      case 'blocked': return 'bg-red-500 text-white';
      case 'skipped': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'active': return <PlayCircle className="h-4 w-4" />;
      case 'in_progress': return <Activity className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'blocked': return <XCircle className="h-4 w-4" />;
      case 'skipped': return <ArrowRight className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'planning': return <GitBranch className="h-4 w-4" />;
      case 'coding': return <Code className="h-4 w-4" />;
      case 'testing': return <TestTube className="h-4 w-4" />;
      case 'deployment': return <Rocket className="h-4 w-4" />;
      case 'review': return <Eye className="h-4 w-4" />;
      case 'integration': return <Network className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getTemplateIcon = (template: WorkflowTemplate) => {
    switch (template) {
      case 'feature': return <Code className="h-4 w-4" />;
      case 'bugfix': return <Bug className="h-4 w-4" />;
      case 'refactor': return <RefreshCw className="h-4 w-4" />;
      case 'release': return <Rocket className="h-4 w-4" />;
      case 'custom': return <Settings className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getEfficiencyColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatDuration = (days: number) => {
    if (days < 1) return `${Math.round(days * 24)}h`;
    return `${Math.round(days)}d`;
  };

  // Filter stages based on current filter
  const filteredStages = useMemo(() => {
    if (filterStatus === 'all') return stages;
    return stages.filter(stage => stage.status === filterStatus);
  }, [stages, filterStatus]);

  // Handle stage interactions
  const handleStageClick = useCallback((stage: WorkflowStage) => {
    setSelectedStage(stage);
    onStageClick?.(stage);
  }, [onStageClick]);

  const handleTemplateChange = useCallback((template: string) => {
    const templateType = template as WorkflowTemplate;
    onTemplateChange?.(templateType);
  }, [onTemplateChange]);

  // Stage action handlers
  const handleStageAction = useCallback((stageId: string, action: 'start' | 'pause' | 'complete' | 'reset') => {
    // This would typically trigger an API call to update stage status
    console.log(`Stage ${stageId} action: ${action}`);
  }, []);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-300 rounded w-48"></div>
          <div className="h-4 bg-gray-300 rounded w-32"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-gray-300 rounded w-24"></div>
            <div className="h-2 bg-gray-300 rounded w-full"></div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3 p-3 border rounded">
                  <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Workflow Progress
          </CardTitle>
          <CardDescription>
            Development workflow stages and efficiency tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">No Workflow Stages</p>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by selecting a workflow template or creating custom stages
            </p>
            <div className="flex flex-col space-y-2">
              <Select onValueChange={handleTemplateChange}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a workflow template" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(workflowTemplates).map(([key, template]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center space-x-2">
                        {getTemplateIcon(key as WorkflowTemplate)}
                        <span>{template.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Custom Workflow
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort stages by order
  const sortedStages = [...filteredStages].sort((a, b) => a.stage_order - b.stage_order);
  
  // Calculate workflow metrics
  const completedStages = sortedStages.filter(s => s.status === 'completed').length;
  const totalStages = sortedStages.length;
  const workflowProgress = totalStages > 0 ? (completedStages / totalStages) * 100 : 0;
  
  const averageEfficiency = sortedStages.length > 0 
    ? sortedStages.reduce((sum, stage) => sum + (stage.efficiency_score || 0), 0) / sortedStages.length 
    : 0;
  
  const totalDuration = sortedStages.reduce((sum, stage) => sum + (stage.duration_days || 0), 0);
  const activeStages = sortedStages.filter(s => s.status === 'active' || s.status === 'in_progress');
  const blockedStages = sortedStages.filter(s => s.status === 'blocked');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Workflow Progress
        </CardTitle>
        <CardDescription>
          Development workflow stages and efficiency tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Workflow Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <Select value={activeTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select workflow template" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(workflowTemplates).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center space-x-2">
                      {getTemplateIcon(key as WorkflowTemplate)}
                      <span>{template.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeline">
                  <div className="flex items-center space-x-2">
                    <Layout className="h-4 w-4" />
                    <span>Timeline</span>
                  </div>
                </SelectItem>
                <SelectItem value="diagram">
                  <div className="flex items-center space-x-2">
                    <Network className="h-4 w-4" />
                    <span>Diagram</span>
                  </div>
                </SelectItem>
                <SelectItem value="kanban">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4" />
                    <span>Kanban</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 ml-auto">
            <Badge variant={realTimeUpdates ? "default" : "secondary"} className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              {realTimeUpdates ? 'Live' : 'Static'}
            </Badge>
          </div>
        </div>

        {/* Workflow Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {workflowProgress.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground mb-2">Progress</div>
            <Progress value={workflowProgress} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              {completedStages} / {totalStages} stages
            </div>
          </div>

          <div className="text-center">
            <div className={`text-2xl font-bold mb-1 ${getEfficiencyColor(averageEfficiency)}`}>
              {averageEfficiency.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground mb-2">Avg Efficiency</div>
            <Progress value={averageEfficiency} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Workflow efficiency
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {activeStages.length}
            </div>
            <div className="text-sm text-muted-foreground mb-2">Active</div>
            <div className="text-xs text-muted-foreground mt-1">
              Currently running
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {formatDuration(totalDuration)}
            </div>
            <div className="text-sm text-muted-foreground mb-2">Duration</div>
            <div className="text-xs text-muted-foreground mt-1">
              Total time spent
            </div>
          </div>
        </div>

        {/* Workflow Visualization */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            <TabsTrigger value="diagram">Flow Diagram</TabsTrigger>
            <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Workflow Timeline</h4>
              <div className="flex items-center space-x-2">
                {blockedStages.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {blockedStages.length} blocked
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {completedStages}/{totalStages} complete
                </Badge>
              </div>
            </div>

            <div className="relative">
              {/* Progress Line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div 
                className="absolute left-8 top-0 w-0.5 bg-blue-500 transition-all duration-500"
                style={{ height: `${(workflowProgress / 100) * (sortedStages.length * 80)}px` }}
              ></div>

              {/* Stages */}
              <div className="space-y-4">
                {sortedStages.map((stage) => {
                  const isCompleted = stage.status === 'completed';
                  const isActive = stage.status === 'active' || stage.status === 'in_progress';
                  const isBlocked = stage.status === 'blocked';
                  
                  return (
                    <TooltipProvider key={stage.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className={cn(
                              "relative flex items-start space-x-4 p-2 rounded-lg transition-all cursor-pointer",
                              "hover:bg-gray-50 hover:shadow-sm",
                              selectedStage?.id === stage.id && "bg-blue-50 border border-blue-200"
                            )}
                            onClick={() => handleStageClick(stage)}
                          >
                            {/* Stage Indicator */}
                            <div className={cn(
                              "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2",
                              isCompleted && "bg-green-500 border-green-500 text-white",
                              isActive && "bg-blue-500 border-blue-500 text-white animate-pulse",
                              isBlocked && "bg-red-500 border-red-500 text-white",
                              !isCompleted && !isActive && !isBlocked && "bg-gray-200 border-gray-300 text-gray-500"
                            )}>
                              {getStatusIcon(stage.status)}
                            </div>

                            {/* Stage Content */}
                            <div className="flex-1 min-w-0 pb-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-sm">{stage.stage_name}</h5>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <Badge className={getStatusColor(stage.status)}>
                                      {stage.status.charAt(0).toUpperCase() + stage.status.slice(1).replace('_', ' ')}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Stage {stage.stage_order}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {/* Stage Actions */}
                                  <div className="flex items-center space-x-1">
                                    {!isCompleted && !isBlocked && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStageAction(stage.id?.toString() || '', isActive ? 'pause' : 'start');
                                        }}
                                      >
                                        {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                      </Button>
                                    )}
                                    {!isCompleted && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStageAction(stage.id?.toString() || '', 'reset');
                                        }}
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                    {stage.efficiency_score && (
                                      <div className="flex items-center space-x-1">
                                        <Zap className="h-3 w-3" />
                                        <span className={getEfficiencyColor(stage.efficiency_score)}>
                                          {stage.efficiency_score.toFixed(1)}%
                                        </span>
                                      </div>
                                    )}
                                    {stage.duration_days && (
                                      <div className="flex items-center space-x-1">
                                        <Timer className="h-3 w-3" />
                                        <span>{formatDuration(stage.duration_days)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Bottlenecks */}
                              {stage.bottlenecks && (
                                <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                                  <div className="flex items-center space-x-1 text-yellow-700">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span className="font-medium">Bottlenecks:</span>
                                  </div>
                                  <p className="text-yellow-600 mt-1">{stage.bottlenecks}</p>
                                </div>
                              )}

                              {/* Timeline */}
                              <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                                {stage.start_date && (
                                  <span>Started: {formatDate(stage.start_date)}</span>
                                )}
                                {stage.end_date && (
                                  <span>Ended: {formatDate(stage.end_date)}</span>
                                )}
                                {!stage.end_date && stage.start_date && isActive && (
                                  <span className="text-blue-600">In progress</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Click to view stage details</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="diagram" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Workflow Flow Diagram</h4>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {workflowTemplates[activeTemplate].name}
                </Badge>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 min-h-[400px] relative overflow-auto">
              <div className="flex flex-wrap gap-4 justify-center">
                {workflowTemplates[activeTemplate].nodes.map((node, index) => {
                  const matchingStage = stages.find(s => s.stage_name.toLowerCase().includes(node.name.toLowerCase()));
                  const status = matchingStage?.status || node.status;
                  const isCompleted = status === 'completed';
                  const isActive = status === 'active' || status === 'in_progress';
                  const isBlocked = status === 'blocked';
                  
                  return (
                    <div key={node.id} className="flex flex-col items-center space-y-2">
                      {/* Node */}
                      <div 
                        className={cn(
                          "flex flex-col items-center justify-center w-24 h-24 rounded-lg border-2 cursor-pointer transition-all",
                          "hover:shadow-md",
                          isCompleted && "bg-green-100 border-green-500 text-green-700",
                          isActive && "bg-blue-100 border-blue-500 text-blue-700 animate-pulse",
                          isBlocked && "bg-red-100 border-red-500 text-red-700",
                          !isCompleted && !isActive && !isBlocked && "bg-gray-100 border-gray-300 text-gray-600"
                        )}
                        onClick={() => matchingStage && handleStageClick(matchingStage)}
                      >
                        <div className="mb-1">
                          {getNodeTypeIcon(node.type)}
                        </div>
                        <div className="text-xs font-medium text-center px-1">
                          {node.name.split(' ')[0]}
                        </div>
                        <div className="text-xs opacity-75">
                          {getStatusIcon(status)}
                        </div>
                      </div>
                      
                      {/* Node Label */}
                      <div className="text-xs text-center max-w-20">
                        {node.name}
                      </div>
                      
                      {/* Connection Arrow */}
                      {index < workflowTemplates[activeTemplate].nodes.length - 1 && (
                        <div className="flex items-center mt-2">
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Connection Lines - Simplified for now */}
              <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                {workflowTemplates[activeTemplate].connections.map((connection, index) => (
                  <line
                    key={index}
                    x1="10%"
                    y1="50%"
                    x2="90%"
                    y2="50%"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeDasharray={connection.type === 'conditional' ? '5,5' : undefined}
                  />
                ))}
              </svg>
            </div>
          </TabsContent>

          <TabsContent value="kanban" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Kanban Board</h4>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Stage
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['pending', 'active', 'completed', 'blocked'].map((status) => {
                const statusStages = sortedStages.filter(stage => 
                  status === 'active' ? (stage.status === 'active' || stage.status === 'in_progress') : stage.status === status
                );
                
                return (
                  <div key={status} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          status === 'pending' && "bg-yellow-500",
                          status === 'active' && "bg-blue-500",
                          status === 'completed' && "bg-green-500",
                          status === 'blocked' && "bg-red-500"
                        )}></div>
                        <h5 className="font-medium capitalize">{status}</h5>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {statusStages.length}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 min-h-[200px]">
                      {statusStages.map((stage) => (
                        <div 
                          key={stage.id}
                          className="bg-white p-3 rounded border cursor-pointer hover:shadow-sm transition-shadow"
                          onClick={() => handleStageClick(stage)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h6 className="font-medium text-sm">{stage.stage_name}</h6>
                            {getStatusIcon(stage.status)}
                          </div>
                          
                          {stage.efficiency_score && (
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Zap className="h-3 w-3" />
                              <span className={getEfficiencyColor(stage.efficiency_score)}>
                                {stage.efficiency_score.toFixed(1)}%
                              </span>
                            </div>
                          )}
                          
                          {stage.bottlenecks && (
                            <div className="mt-2 text-xs text-yellow-600">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              Bottleneck detected
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Workflow Insights */}
        {(blockedStages.length > 0 || averageEfficiency < 70) && (
          <div className="border-t pt-4 mt-6">
            <h4 className="font-medium mb-3">Workflow Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {blockedStages.length > 0 && (
                <div className="flex items-start space-x-2 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700">Blocked Stages Detected</p>
                    <p className="text-xs text-red-600 mt-1">
                      {blockedStages.length} stage(s) are blocked. Review bottlenecks and resolve blockers.
                    </p>
                    <div className="mt-2">
                      {blockedStages.slice(0, 3).map(stage => (
                        <Badge key={stage.id} variant="destructive" className="text-xs mr-1 mb-1">
                          {stage.stage_name}
                        </Badge>
                      ))}
                      {blockedStages.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{blockedStages.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {averageEfficiency < 70 && (
                <div className="flex items-start space-x-2 p-3 bg-yellow-50 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700">Low Workflow Efficiency</p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Average efficiency is {averageEfficiency.toFixed(1)}%. Consider optimizing processes.
                    </p>
                    <Button size="sm" variant="outline" className="mt-2 text-xs">
                      View Optimization Tips
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Stage Details */}
        {selectedStage && (
          <div className="border-t pt-4 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Stage Details</h4>
              <Button size="sm" variant="ghost" onClick={() => setSelectedStage(null)}>
                ✕
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <h5 className="font-medium mb-2">{selectedStage.stage_name}</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(selectedStage.status)}>
                      {selectedStage.status.charAt(0).toUpperCase() + selectedStage.status.slice(1).replace('_', ' ')}
                    </Badge>
                    <span className="text-muted-foreground">Order: {selectedStage.stage_order}</span>
                  </div>
                  {selectedStage.efficiency_score && (
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4" />
                      <span>Efficiency: </span>
                      <span className={getEfficiencyColor(selectedStage.efficiency_score)}>
                        {selectedStage.efficiency_score.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {selectedStage.duration_days && (
                    <div className="flex items-center space-x-2">
                      <Timer className="h-4 w-4" />
                      <span>Duration: {formatDuration(selectedStage.duration_days)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="space-y-2 text-sm">
                  {selectedStage.start_date && (
                    <div>Started: {formatDate(selectedStage.start_date)}</div>
                  )}
                  {selectedStage.end_date && (
                    <div>Ended: {formatDate(selectedStage.end_date)}</div>
                  )}
                  {selectedStage.bottlenecks && (
                    <div className="mt-2">
                      <div className="font-medium text-yellow-700 mb-1">Bottlenecks:</div>
                      <div className="text-yellow-600">{selectedStage.bottlenecks}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowVisualization;
export type { 
  WorkflowVisualizationProps, 
  WorkflowTemplate, 
  WorkflowNode, 
  WorkflowConnection, 
  WorkflowDefinition 
};