import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Target,
  CheckCircle,
  FileText,
  TestTube,
  Rocket,
  AlertTriangle
} from 'lucide-react';
import type { ProjectGoals, WorkflowStage } from '@/lib/api';

interface CompletionStatusProps {
  goals?: ProjectGoals;
  workflowStages: WorkflowStage[];
  loading?: boolean;
}

const CompletionStatus: React.FC<CompletionStatusProps> = ({ 
  goals, 
  workflowStages: _workflowStages, 
  loading = false 
}) => {

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
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
            <div className="h-8 bg-gray-300 rounded w-16 mx-auto"></div>
            <div className="h-2 bg-gray-300 rounded w-full"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-20"></div>
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

  // Calculate overall progress from goals
  const overallProgress = goals?.overall_completion || 0;
  const featuresProgress = goals?.features_completion || 0;
  const docsProgress = goals?.documentation_completion || 0;
  const testsProgress = goals?.tests_completion || 0;
  const deploymentProgress = goals?.deployment_readiness || 0;


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Project Completion
        </CardTitle>
        <CardDescription>
          {goals?.primary_goal || 'Track project completion across all areas'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="text-center">
          <div className={`text-4xl font-bold mb-2 ${getCompletionColor(overallProgress)}`}>
            {overallProgress.toFixed(1)}%
          </div>
          <div className="text-sm text-muted-foreground mb-4">Overall Completion</div>
          <Progress value={overallProgress} className="h-3 mb-2" />
          <div className="text-xs text-muted-foreground">
            Last updated: {goals ? formatDate(goals.updated_at) : 'Never'}
          </div>
        </div>

        {/* Completion Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-4 w-4 text-blue-500 mr-1" />
              <span className="text-sm font-medium">Features</span>
            </div>
            <div className={`text-xl font-bold mb-2 ${getCompletionColor(featuresProgress)}`}>
              {featuresProgress.toFixed(1)}%
            </div>
            <Progress value={featuresProgress} className="h-2" />
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <FileText className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm font-medium">Docs</span>
            </div>
            <div className={`text-xl font-bold mb-2 ${getCompletionColor(docsProgress)}`}>
              {docsProgress.toFixed(1)}%
            </div>
            <Progress value={docsProgress} className="h-2" />
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TestTube className="h-4 w-4 text-purple-500 mr-1" />
              <span className="text-sm font-medium">Tests</span>
            </div>
            <div className={`text-xl font-bold mb-2 ${getCompletionColor(testsProgress)}`}>
              {testsProgress.toFixed(1)}%
            </div>
            <Progress value={testsProgress} className="h-2" />
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Rocket className="h-4 w-4 text-orange-500 mr-1" />
              <span className="text-sm font-medium">Deploy</span>
            </div>
            <div className={`text-xl font-bold mb-2 ${getCompletionColor(deploymentProgress)}`}>
              {deploymentProgress.toFixed(1)}%
            </div>
            <Progress value={deploymentProgress} className="h-2" />
          </div>
        </div>

        {/* Quick Insights */}
        <div className="space-y-2">
          {overallProgress < 70 && (
            <div className="flex items-center text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
              Project needs attention in {featuresProgress < 70 ? 'features' : docsProgress < 60 ? 'documentation' : 'testing'}
            </div>
          )}
          {overallProgress >= 80 && (
            <div className="flex items-center text-sm text-green-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              Project is nearing completion! Great progress.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompletionStatus;