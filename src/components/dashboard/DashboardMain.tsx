import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  TrendingUp,
  Target
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Types matching the Rust backend
interface ProjectHealthMetric {
  id?: number;
  project_id: string;
  metric_type: string;
  value: number;
  timestamp: number;
  details?: string;
  trend?: string;
}

interface FeatureItem {
  id?: number;
  project_id: string;
  name: string;
  description?: string;
  status: string;
  independence_score?: number;
  dependencies?: string;
  file_paths?: string;
  complexity_score?: number;
  created_at: number;
  updated_at: number;
}

interface RiskItem {
  id?: number;
  project_id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  mitigation?: string;
  status: string;
  impact_score?: number;
  probability?: number;
  detected_at: number;
  resolved_at?: number;
  file_paths?: string;
}

interface DocumentationStatus {
  id?: number;
  project_id: string;
  doc_type: string;
  completion_percentage?: number;
  total_sections?: number;
  completed_sections?: number;
  missing_sections?: string;
  file_paths?: string;
  last_updated: number;
  quality_score?: number;
}

interface AIUsageMetric {
  id?: number;
  project_id: string;
  model_name: string;
  agent_type?: string;
  mcp_server?: string;
  token_count: number;
  request_count: number;
  success_count: number;
  failure_count: number;
  success_rate?: number;
  avg_response_time?: number;
  total_cost?: number;
  session_date: string;
  timestamp: number;
}

interface WorkflowStage {
  id?: number;
  project_id: string;
  stage_name: string;
  stage_order: number;
  status: string;
  start_date?: number;
  end_date?: number;
  duration_days?: number;
  efficiency_score?: number;
  bottlenecks?: string;
  updated_at: number;
}

interface ProjectGoals {
  id?: number;
  project_id: string;
  primary_goal?: string;
  secondary_goals?: string;
  overall_completion?: number;
  features_completion?: number;
  documentation_completion?: number;
  tests_completion?: number;
  deployment_readiness?: number;
  created_at: number;
  updated_at: number;
}

interface DashboardConfig {
  id?: number;
  project_id: string;
  config_version?: string;
  refresh_interval?: number;
  cache_duration?: number;
  enabled_widgets?: string;
  custom_metrics?: string;
  created_at: number;
  updated_at: number;
}

interface DashboardSummary {
  project_id: string;
  health_metrics: ProjectHealthMetric[];
  feature_status: FeatureItem[];
  risk_items: RiskItem[];
  documentation_status: DocumentationStatus[];
  ai_usage: AIUsageMetric[];
  workflow_stages: WorkflowStage[];
  project_goals?: ProjectGoals;
  config?: DashboardConfig;
}

const DashboardMain = () => {
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = 'claudia-main'; // Default project ID

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoke<DashboardSummary>('dashboard_get_summary', {
        projectId
      });
      setDashboardData(data);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'active': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'planned': return 'bg-gray-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining': return <TrendingUp className="h-4 w-4 text-red-500 transform rotate-180" />;
      case 'stable': return <Activity className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load dashboard: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!dashboardData) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No dashboard data available
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Dashboard</h1>
          <p className="text-muted-foreground">
            {dashboardData.project_goals?.primary_goal || 'Windows-optimized Claude Code UI'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={loadDashboardData}
            className="flex items-center px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button 
            onClick={async () => {
              try {
                await invoke('dashboard_seed_data');
                await loadDashboardData();
              } catch (err) {
                console.error('Failed to seed data:', err);
              }
            }}
            className="flex items-center px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600"
          >
            Seed Data
          </button>
        </div>
      </div>

      {/* Project Goals Overview */}
      {dashboardData.project_goals && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Project Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Overall</p>
                <div className="flex items-center space-x-2">
                  <Progress value={dashboardData.project_goals.overall_completion || 0} className="flex-1" />
                  <span className="text-sm font-medium">
                    {dashboardData.project_goals.overall_completion?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Features</p>
                <div className="flex items-center space-x-2">
                  <Progress value={dashboardData.project_goals.features_completion || 0} className="flex-1" />
                  <span className="text-sm font-medium">
                    {dashboardData.project_goals.features_completion?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documentation</p>
                <div className="flex items-center space-x-2">
                  <Progress value={dashboardData.project_goals.documentation_completion || 0} className="flex-1" />
                  <span className="text-sm font-medium">
                    {dashboardData.project_goals.documentation_completion?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deployment</p>
                <div className="flex items-center space-x-2">
                  <Progress value={dashboardData.project_goals.deployment_readiness || 0} className="flex-1" />
                  <span className="text-sm font-medium">
                    {dashboardData.project_goals.deployment_readiness?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value="overview" onValueChange={() => {}} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="documentation">Docs</TabsTrigger>
          <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Health Metrics Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Health Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.health_metrics.length > 0 
                    ? Math.round(dashboardData.health_metrics.reduce((acc, m) => acc + m.value, 0) / dashboardData.health_metrics.length)
                    : 'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Average across {dashboardData.health_metrics.length} metrics
                </p>
              </CardContent>
            </Card>

            {/* Active Risks */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Active Risks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {dashboardData.risk_items.filter(r => r.status === 'open').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.risk_items.filter(r => r.severity === 'critical').length} critical
                </p>
              </CardContent>
            </Card>

            {/* Feature Progress */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.feature_status.filter(f => f.status === 'completed').length}/
                  {dashboardData.feature_status.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {Math.round((dashboardData.feature_status.filter(f => f.status === 'completed').length / Math.max(dashboardData.feature_status.length, 1)) * 100)}% complete
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Workflow Stages */}
          {dashboardData.workflow_stages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Workflow Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboardData.workflow_stages
                    .sort((a, b) => a.stage_order - b.stage_order)
                    .map((stage) => (
                      <div key={stage.id} className="flex items-center space-x-3">
                        <Badge className={getStatusColor(stage.status)}>
                          {stage.status}
                        </Badge>
                        <span className="flex-1">{stage.stage_name}</span>
                        {stage.efficiency_score && (
                          <span className="text-sm text-muted-foreground">
                            {stage.efficiency_score.toFixed(1)}% efficiency
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboardData.health_metrics.map((metric) => (
              <Card key={metric.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="capitalize">{metric.metric_type.replace('_', ' ')}</span>
                    {getTrendIcon(metric.trend)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold">{metric.value.toFixed(1)}</div>
                    <div className="text-sm text-muted-foreground">/ 100</div>
                  </div>
                  <Progress value={metric.value} className="mt-2" />
                  {metric.details && (
                    <p className="text-xs text-muted-foreground mt-2">{metric.details}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="space-y-2">
            {dashboardData.feature_status.map((feature) => (
              <Card key={feature.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium">{feature.name}</h3>
                        <Badge className={getStatusColor(feature.status)}>
                          {feature.status.replace('_', ' ')}
                        </Badge>
                        {feature.independence_score && (
                          <Badge variant="outline">
                            {feature.independence_score.toFixed(0)}% independent
                          </Badge>
                        )}
                      </div>
                      {feature.description && (
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      )}
                    </div>
                    {feature.complexity_score && (
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Complexity</div>
                        <div className="font-medium">{feature.complexity_score.toFixed(1)}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <div className="space-y-2">
            {dashboardData.risk_items.map((risk) => (
              <Card key={risk.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium">{risk.title}</h3>
                        <Badge className={getSeverityColor(risk.severity)}>
                          {risk.severity}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {risk.category.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{risk.description}</p>
                      {risk.mitigation && (
                        <p className="text-xs text-blue-600">
                          <strong>Mitigation:</strong> {risk.mitigation}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {risk.impact_score && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Impact:</span> {risk.impact_score}/10
                        </div>
                      )}
                      {risk.probability && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Probability:</span> {Math.round(risk.probability * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documentation" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboardData.documentation_status.map((doc) => (
              <Card key={doc.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize">
                    {doc.doc_type.replace('_', ' ')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Completion</span>
                      <span className="text-sm font-medium">
                        {doc.completion_percentage?.toFixed(1) || 0}%
                      </span>
                    </div>
                    <Progress value={doc.completion_percentage || 0} />
                    {doc.completed_sections && doc.total_sections && (
                      <div className="text-xs text-muted-foreground">
                        {doc.completed_sections} of {doc.total_sections} sections
                      </div>
                    )}
                    {doc.quality_score && (
                      <div className="text-xs text-muted-foreground">
                        Quality score: {doc.quality_score.toFixed(1)}/100
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ai-usage" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboardData.ai_usage.slice(0, 6).map((usage) => (
              <Card key={usage.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{usage.model_name}</CardTitle>
                  <CardDescription>
                    {usage.agent_type && <span>{usage.agent_type} • </span>}
                    {usage.session_date}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tokens:</span>
                      <span className="font-medium">{usage.token_count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Requests:</span>
                      <span className="font-medium">{usage.request_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Success Rate:</span>
                      <span className="font-medium">
                        {usage.success_rate ? `${Math.round(usage.success_rate * 100)}%` : 'N/A'}
                      </span>
                    </div>
                    {usage.total_cost && (
                      <div className="flex justify-between text-sm">
                        <span>Cost:</span>
                        <span className="font-medium">${usage.total_cost.toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardMain;