import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowStage } from '@/lib/api';

interface WorkflowVisualizationProps {
  stages: WorkflowStage[];
  loading?: boolean;
}

const WorkflowVisualization: React.FC<WorkflowVisualizationProps> = ({ 
  stages,
  loading = false 
}) => {
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
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground">No workflow stages defined</p>
            <p className="text-xs text-muted-foreground">Define stages to track progress</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort stages by order
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);
  
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
        {/* Workflow Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Workflow Stages</h4>
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
                  <div key={stage.id} className="relative flex items-start space-x-4">
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
                );
              })}
            </div>
          </div>
        </div>

        {/* Workflow Insights */}
        {(blockedStages.length > 0 || averageEfficiency < 70) && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Workflow Insights</h4>
            <div className="space-y-2">
              {blockedStages.length > 0 && (
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Blocked Stages Detected</p>
                    <p className="text-xs text-muted-foreground">
                      {blockedStages.length} stage(s) are blocked. Review bottlenecks and resolve blockers.
                    </p>
                  </div>
                </div>
              )}
              
              {averageEfficiency < 70 && (
                <div className="flex items-start space-x-2">
                  <TrendingUp className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Low Workflow Efficiency</p>
                    <p className="text-xs text-muted-foreground">
                      Average efficiency is {averageEfficiency.toFixed(1)}%. Consider optimizing processes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowVisualization;