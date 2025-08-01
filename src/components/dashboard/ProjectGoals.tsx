import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Target,
  Star,
  CheckCircle,
  Clock,
  TrendingUp,
  Flag,
  ArrowRight,
  Calendar,
  Users,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectGoals as Goals } from '@/lib/api';

interface ProjectGoalsProps {
  goals?: Goals;
  loading?: boolean;
}

const ProjectGoals: React.FC<ProjectGoalsProps> = ({ 
  goals,
  loading = false 
}) => {
  const getCompletionColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };


  const getStatusLabel = (percentage: number) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 70) return 'On Track';
    if (percentage >= 50) return 'In Progress';
    return 'Needs Attention';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
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
            <div className="h-8 bg-gray-300 rounded w-full"></div>
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-24"></div>
                  <div className="h-2 bg-gray-300 rounded w-full"></div>
                  <div className="h-3 bg-gray-300 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!goals) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <Target className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground">No project goals set</p>
            <p className="text-xs text-muted-foreground">Define goals to track progress</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate goal metrics
  const overallProgress = goals.overall_completion || 0;
  const featuresProgress = goals.features_completion || 0;
  const docsProgress = goals.documentation_completion || 0;
  const testsProgress = goals.tests_completion || 0;
  const deploymentProgress = goals.deployment_readiness || 0;

  const secondaryGoals = goals.secondary_goals ? (() => {
    try {
      return JSON.parse(goals.secondary_goals);
    } catch {
      return [];
    }
  })() : [];
  
  // Determine project health
  const projectHealth = {
    score: (overallProgress + featuresProgress + docsProgress + testsProgress + deploymentProgress) / 5,
    status: overallProgress >= 80 ? 'excellent' : overallProgress >= 60 ? 'good' : overallProgress >= 40 ? 'fair' : 'poor'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Project Goals
          </div>
          <div className="flex items-center space-x-2">
            {projectHealth.status === 'excellent' && <Star className="h-4 w-4 text-yellow-500" />}
            <Badge 
              variant={projectHealth.status === 'excellent' ? 'default' : 'outline'}
              className={cn(
                projectHealth.status === 'excellent' && 'bg-green-500 text-white',
                projectHealth.status === 'good' && 'bg-blue-500 text-white',
                projectHealth.status === 'fair' && 'bg-yellow-500 text-black',
                projectHealth.status === 'poor' && 'bg-red-500 text-white'
              )}
            >
              {getStatusLabel(projectHealth.score)}
            </Badge>
          </div>
        </CardTitle>
        <CardDescription>
          {goals.primary_goal || 'Windows-optimized Claude Code interface with enhanced functionality'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
          <div className={`text-4xl font-bold mb-2 ${getCompletionColor(overallProgress)}`}>
            {overallProgress.toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground mb-3">Overall Project Completion</div>
          <Progress value={overallProgress} className="h-3 mb-2" />
          <div className="text-xs text-muted-foreground">
            Updated {formatDate(goals.updated_at)}
          </div>
        </div>

        {/* Goal Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Features Development</span>
              </div>
              <span className={cn('text-sm font-bold', getCompletionColor(featuresProgress))}>
                {featuresProgress.toFixed(1)}%
              </span>
            </div>
            <Progress value={featuresProgress} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Core functionality and user features
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Documentation</span>
              </div>
              <span className={cn('text-sm font-bold', getCompletionColor(docsProgress))}>
                {docsProgress.toFixed(1)}%
              </span>
            </div>
            <Progress value={docsProgress} className="h-2" />
            <div className="text-xs text-muted-foreground">
              User guides and technical documentation
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Testing</span>
              </div>
              <span className={cn('text-sm font-bold', getCompletionColor(testsProgress))}>
                {testsProgress.toFixed(1)}%
              </span>
            </div>
            <Progress value={testsProgress} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Unit tests, integration tests, and QA
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Deployment</span>
              </div>
              <span className={cn('text-sm font-bold', getCompletionColor(deploymentProgress))}>
                {deploymentProgress.toFixed(1)}%
              </span>
            </div>
            <Progress value={deploymentProgress} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Production readiness and deployment setup
            </div>
          </div>
        </div>

        {/* Secondary Goals */}
        {secondaryGoals.length > 0 && (
          <div>
            <div className="flex items-center mb-3">
              <Flag className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm font-medium">Secondary Goals</span>
              <Badge variant="outline" className="ml-2 text-xs">
                {secondaryGoals.length} goals
              </Badge>
            </div>
            <div className="space-y-2">
              {secondaryGoals.slice(0, 5).map((goal: string, index: number) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span>{goal}</span>
                </div>
              ))}
              {secondaryGoals.length > 5 && (
                <div className="text-xs text-muted-foreground">
                  +{secondaryGoals.length - 5} more goals
                </div>
              )}
            </div>
          </div>
        )}

        {/* Project Insights */}
        <div className="border-t pt-4">
          <div className="flex items-center mb-3">
            <TrendingUp className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm font-medium">Project Insights</span>
          </div>
          <div className="space-y-2">
            {overallProgress >= 80 && (
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Project is nearing completion! Excellent progress across all areas.</span>
              </div>
            )}
            
            {featuresProgress < 70 && overallProgress < 80 && (
              <div className="flex items-center space-x-2 text-sm text-blue-600">
                <Clock className="h-4 w-4" />
                <span>Focus on feature development to improve overall progress.</span>
              </div>
            )}
            
            {docsProgress < 60 && overallProgress > 50 && (
              <div className="flex items-center space-x-2 text-sm text-yellow-600">
                <Users className="h-4 w-4" />
                <span>Consider improving documentation as features mature.</span>
              </div>
            )}
            
            {testsProgress < 50 && featuresProgress > 60 && (
              <div className="flex items-center space-x-2 text-sm text-purple-600">
                <Zap className="h-4 w-4" />
                <span>Testing coverage should increase as features are developed.</span>
              </div>
            )}
            
            {deploymentProgress < 40 && overallProgress > 60 && (
              <div className="flex items-center space-x-2 text-sm text-orange-600">
                <TrendingUp className="h-4 w-4" />
                <span>Start preparing deployment infrastructure as project matures.</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>Created: {formatDate(goals.created_at)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Last updated: {formatDate(goals.updated_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectGoals;