import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Bot,
  Zap,
  Clock,
  DollarSign,
  TrendingUp,
  Brain,
  Server,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  LineChart,
  Calendar,
  Filter,
  Target,
  Cpu,
  Database,
  Activity,
  Gauge,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Download,
  Settings,
  Info,
  TrendingDown
} from 'lucide-react';
import type { AIUsageMetric } from '@/lib/api';

interface AIAnalyticsProps {
  usage: AIUsageMetric[];
  loading?: boolean;
  projectId?: string;
  onRefresh?: () => void;
}

interface TimeSeriesDataPoint {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
  successRate: number;
}

interface ModelComparison {
  model: string;
  tokens: number;
  cost: number;
  requests: number;
  successRate: number;
  avgResponseTime: number;
  efficiency: number; // tokens per dollar
  reliability: number; // success rate + uptime
}

interface OptimizationRecommendation {
  type: 'cost' | 'performance' | 'reliability' | 'usage';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings?: number;
  implementation: string;
}

const AIAnalytics: React.FC<AIAnalyticsProps> = React.memo(({ usage, loading = false, projectId, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const analytics = useMemo(() => {
    if (usage.length === 0) return null;

    // Filter by time range
    const now = new Date();
    const daysToFilter = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365;
    const filterDate = new Date(now.getTime() - daysToFilter * 24 * 60 * 60 * 1000);
    
    const filteredUsage = usage.filter(m => {
      const metricDate = new Date(m.timestamp * 1000);
      return metricDate >= filterDate;
    });

    // Aggregate metrics
    const totalTokens = filteredUsage.reduce((sum, m) => sum + m.token_count, 0);
    const totalRequests = filteredUsage.reduce((sum, m) => sum + m.request_count, 0);
    const totalSuccess = filteredUsage.reduce((sum, m) => sum + m.success_count, 0);
    const totalFailures = filteredUsage.reduce((sum, m) => sum + m.failure_count, 0);
    const totalCost = filteredUsage.reduce((sum, m) => sum + (m.total_cost || 0), 0);
    
    const overallSuccessRate = totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;
    
    // Average response time (excluding null values)
    const responseTimeMetrics = filteredUsage.filter(m => m.avg_response_time);
    const avgResponseTime = responseTimeMetrics.length > 0 
      ? responseTimeMetrics.reduce((sum, m) => sum + (m.avg_response_time || 0), 0) / responseTimeMetrics.length
      : 0;

    // Model breakdown with enhanced metrics
    const modelStats = filteredUsage.reduce((acc, metric) => {
      const model = metric.model_name;
      if (!acc[model]) {
        acc[model] = {
          tokens: 0,
          requests: 0,
          cost: 0,
          success_rate: 0,
          avg_response_time: 0,
          metrics_count: 0,
          efficiency: 0,
          reliability: 0
        };
      }
      acc[model].tokens += metric.token_count;
      acc[model].requests += metric.request_count;
      acc[model].cost += metric.total_cost || 0;
      
      if (metric.success_rate !== null && metric.success_rate !== undefined) {
        acc[model].success_rate += metric.success_rate;
        acc[model].metrics_count += 1;
      }
      
      if (metric.avg_response_time) {
        acc[model].avg_response_time += metric.avg_response_time;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate model comparisons
    const modelComparisons: ModelComparison[] = Object.entries(modelStats).map(([model, stats]) => {
      const avgSuccessRate = stats.metrics_count > 0 ? stats.success_rate / stats.metrics_count : 0;
      const avgResponseTime = stats.metrics_count > 0 ? stats.avg_response_time / stats.metrics_count : 0;
      const efficiency = stats.cost > 0 ? stats.tokens / stats.cost : 0; // tokens per dollar
      const reliability = avgSuccessRate; // simplified reliability metric
      
      return {
        model,
        tokens: stats.tokens,
        cost: stats.cost,
        requests: stats.requests,
        successRate: avgSuccessRate,
        avgResponseTime,
        efficiency,
        reliability
      };
    }).sort((a, b) => b.cost - a.cost);

    // Time series data for trends
    const timeSeriesData: TimeSeriesDataPoint[] = Object.entries(
      filteredUsage.reduce((acc, metric) => {
        const date = metric.session_date;
        if (!acc[date]) {
          acc[date] = { tokens: 0, requests: 0, cost: 0, success: 0, total: 0 };
        }
        acc[date].tokens += metric.token_count;
        acc[date].requests += metric.request_count;
        acc[date].cost += metric.total_cost || 0;
        acc[date].success += metric.success_count;
        acc[date].total += metric.request_count;
        return acc;
      }, {} as Record<string, any>)
    ).map(([date, data]) => ({
      date,
      tokens: data.tokens,
      cost: data.cost,
      requests: data.requests,
      successRate: data.total > 0 ? (data.success / data.total) * 100 : 0
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Agent type breakdown
    const agentStats = filteredUsage.reduce((acc, metric) => {
      const agent = metric.agent_type || 'Direct Usage';
      if (!acc[agent]) {
        acc[agent] = { tokens: 0, requests: 0, cost: 0, success_rate: 0, response_time: 0, count: 0 };
      }
      acc[agent].tokens += metric.token_count;
      acc[agent].requests += metric.request_count;
      acc[agent].cost += metric.total_cost || 0;
      if (metric.success_rate !== null && metric.success_rate !== undefined) {
        acc[agent].success_rate += metric.success_rate;
        acc[agent].count += 1;
      }
      if (metric.avg_response_time) {
        acc[agent].response_time += metric.avg_response_time;
      }
      return acc;
    }, {} as Record<string, any>);

    // Calculate average success rates for agents
    Object.keys(agentStats).forEach(agent => {
      if (agentStats[agent].count > 0) {
        agentStats[agent].success_rate = agentStats[agent].success_rate / agentStats[agent].count;
        agentStats[agent].response_time = agentStats[agent].response_time / agentStats[agent].count;
      }
    });

    // MCP server breakdown
    const mcpStats = filteredUsage.reduce((acc, metric) => {
      const server = metric.mcp_server || 'No MCP';
      if (!acc[server]) {
        acc[server] = { tokens: 0, requests: 0, cost: 0, success_rate: 0, count: 0 };
      }
      acc[server].tokens += metric.token_count;
      acc[server].requests += metric.request_count;
      acc[server].cost += metric.total_cost || 0;
      if (metric.success_rate !== null && metric.success_rate !== undefined) {
        acc[server].success_rate += metric.success_rate;
        acc[server].count += 1;
      }
      return acc;
    }, {} as Record<string, any>);

    // Calculate average success rates for MCP
    Object.keys(mcpStats).forEach(server => {
      if (mcpStats[server].count > 0) {
        mcpStats[server].success_rate = mcpStats[server].success_rate / mcpStats[server].count;
      }
    });

    // Generate optimization recommendations
    const recommendations: OptimizationRecommendation[] = [];
    
    // Cost optimization
    if (totalCost > 50) {
      const mostExpensiveModel = modelComparisons[0];
      if (mostExpensiveModel && mostExpensiveModel.efficiency < 1000) {
        recommendations.push({
          type: 'cost',
          severity: 'high',
          title: 'High Cost Model Usage',
          description: `${mostExpensiveModel.model} accounts for significant costs. Consider using more efficient models for routine tasks.`,
          potentialSavings: mostExpensiveModel.cost * 0.3,
          implementation: 'Switch to lighter models for simple tasks, reserve premium models for complex operations.'
        });
      }
    }

    // Performance optimization
    if (avgResponseTime > 5000) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        title: 'High Response Times',
        description: 'Average response time exceeds 5 seconds, impacting user experience.',
        implementation: 'Optimize prompts, use streaming responses, or implement caching for common requests.'
      });
    }

    // Reliability issues
    if (overallSuccessRate < 90) {
      recommendations.push({
        type: 'reliability',
        severity: 'high',
        title: 'Low Success Rate',
        description: `Success rate is ${overallSuccessRate.toFixed(1)}%, indicating potential reliability issues.`,
        implementation: 'Review error patterns, implement retry logic, and improve prompt engineering.'
      });
    }

    // Usage pattern optimization
    const peakUsageDays = timeSeriesData.filter(d => d.requests > totalRequests / timeSeriesData.length * 2);
    if (peakUsageDays.length > 0) {
      recommendations.push({
        type: 'usage',
        severity: 'low',
        title: 'Uneven Usage Patterns',
        description: 'Usage shows significant spikes. Consider load balancing or rate limiting.',
        implementation: 'Implement request queuing and better distribute workload across time periods.'
      });
    }

    return {
      totalTokens,
      totalRequests,
      totalSuccess,
      totalFailures,
      totalCost,
      overallSuccessRate,
      avgResponseTime,
      modelStats,
      modelComparisons,
      agentStats,
      mcpStats,
      timeSeriesData,
      recommendations,
      trends: {
        costTrend: timeSeriesData.length > 1 ? 
          (timeSeriesData[timeSeriesData.length - 1].cost - timeSeriesData[0].cost) / timeSeriesData[0].cost * 100 : 0,
        tokenTrend: timeSeriesData.length > 1 ? 
          (timeSeriesData[timeSeriesData.length - 1].tokens - timeSeriesData[0].tokens) / timeSeriesData[0].tokens * 100 : 0,
        successRateTrend: timeSeriesData.length > 1 ? 
          timeSeriesData[timeSeriesData.length - 1].successRate - timeSeriesData[0].successRate : 0
      }
    };
  }, [usage, timeRange]);

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-blue-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getResponseTimeColor = (time: number) => {
    if (time <= 1000) return 'text-green-600';
    if (time <= 3000) return 'text-blue-600';
    if (time <= 5000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 5) return 'text-red-500';
    if (trend > 0) return 'text-yellow-500';
    if (trend < -5) return 'text-green-500';
    return 'text-gray-500';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return ArrowUp;
    if (trend > 0) return ArrowUp;
    if (trend < -5) return ArrowDown;
    if (trend < 0) return ArrowDown;
    return Minus;
  };

  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-500 bg-blue-50 border-blue-200';
    }
  };

  const formatCost = (cost: number) => {
    return cost < 0.01 ? '< $0.01' : `$${cost.toFixed(3)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatResponseTime = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms.toFixed(0)}ms`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatEfficiency = (efficiency: number) => {
    if (efficiency >= 1000) return `${(efficiency / 1000).toFixed(1)}K`;
    return efficiency.toFixed(0);
  };

  const exportData = () => {
    if (!analytics) return;
    
    const exportData = {
      summary: {
        totalTokens: analytics.totalTokens,
        totalRequests: analytics.totalRequests,
        totalCost: analytics.totalCost,
        successRate: analytics.overallSuccessRate,
        avgResponseTime: analytics.avgResponseTime
      },
      modelComparisons: analytics.modelComparisons,
      timeSeriesData: analytics.timeSeriesData,
      recommendations: analytics.recommendations,
      generatedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-analytics-${projectId || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-300 rounded w-20"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!analytics || usage.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No AI Usage Data</h3>
            <p className="text-sm text-muted-foreground mb-4">Start using AI features to see comprehensive analytics</p>
            <Button onClick={onRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive insights into AI model usage and performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(analytics.totalCost)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {(() => {
                const TrendIcon = getTrendIcon(analytics.trends.costTrend);
                return (
                  <>
                    <TrendIcon className={`h-3 w-3 mr-1 ${getTrendColor(analytics.trends.costTrend)}`} />
                    <span className={getTrendColor(analytics.trends.costTrend)}>
                      {formatPercent(Math.abs(analytics.trends.costTrend))}
                    </span>
                    <span className="ml-1">vs previous period</span>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(analytics.totalTokens)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {(() => {
                const TrendIcon = getTrendIcon(analytics.trends.tokenTrend);
                return (
                  <>
                    <TrendIcon className={`h-3 w-3 mr-1 ${getTrendColor(analytics.trends.tokenTrend)}`} />
                    <span className={getTrendColor(analytics.trends.tokenTrend)}>
                      {formatPercent(Math.abs(analytics.trends.tokenTrend))}
                    </span>
                    <span className="ml-1">vs previous period</span>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getSuccessRateColor(analytics.overallSuccessRate)}`}>
              {formatPercent(analytics.overallSuccessRate)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {(() => {
                const trend = analytics.trends.successRateTrend;
                const TrendIcon = getTrendIcon(trend);
                return (
                  <>
                    <TrendIcon className={`h-3 w-3 mr-1 ${getTrendColor(trend)}`} />
                    <span className={getTrendColor(trend)}>
                      {Math.abs(trend).toFixed(1)}pp
                    </span>
                    <span className="ml-1">vs previous period</span>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getResponseTimeColor(analytics.avgResponseTime)}`}>
              {formatResponseTime(analytics.avgResponseTime)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalRequests.toLocaleString()} total requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="recommendations">Optimize</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Token Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Usage Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between space-x-2">
                  {analytics.timeSeriesData.slice(-7).map((point, index) => {
                    const maxTokens = Math.max(...analytics.timeSeriesData.map(p => p.tokens));
                    const height = maxTokens > 0 ? (point.tokens / maxTokens) * 200 : 0;
                    
                    return (
                      <div key={point.date} className="flex-1 flex flex-col items-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          {formatTokens(point.tokens)}
                        </div>
                        <div 
                          className="w-full bg-blue-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                          style={{ height: `${height}px` }}
                          title={`${point.date}: ${formatTokens(point.tokens)} tokens, ${formatCost(point.cost)}`}
                        />
                        <div className="text-xs text-muted-foreground mt-1 rotate-45 origin-top-left">
                          {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Top Models */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="h-5 w-5 mr-2" />
                  Top Models by Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.modelComparisons.slice(0, 5).map((model, index) => (
                    <div key={model.model} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{model.model}</div>
                          <div className="text-xs text-muted-foreground">
                            {model.requests.toLocaleString()} requests
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCost(model.cost)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTokens(model.tokens)} tokens
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="h-5 w-5 mr-2" />
                Model Performance Comparison
              </CardTitle>
              <CardDescription>
                Compare AI models across cost, performance, and reliability metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.modelComparisons.map((model) => (
                  <div key={model.model} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-lg">{model.model}</h4>
                      <Badge variant="outline" className="text-sm">
                        {formatEfficiency(model.efficiency)} tokens/$
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Total Cost</div>
                        <div className="text-xl font-bold">{formatCost(model.cost)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Success Rate</div>
                        <div className={`text-xl font-bold ${getSuccessRateColor(model.successRate)}`}>
                          {formatPercent(model.successRate)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Avg Response</div>
                        <div className={`text-xl font-bold ${getResponseTimeColor(model.avgResponseTime)}`}>
                          {formatResponseTime(model.avgResponseTime)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Requests</div>
                        <div className="text-xl font-bold">{model.requests.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Efficiency Score</span>
                        <span>{Math.min(100, (model.efficiency / 10)).toFixed(0)}%</span>
                      </div>
                      <Progress value={Math.min(100, (model.efficiency / 10))} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LineChart className="h-5 w-5 mr-2" />
                Usage Trends Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {analytics.timeSeriesData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Cost Trend */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Daily Cost</h4>
                      <div className="flex items-end space-x-1 h-20">
                        {analytics.timeSeriesData.map((point, index) => {
                          const maxCost = Math.max(...analytics.timeSeriesData.map(p => p.cost));
                          const height = maxCost > 0 ? (point.cost / maxCost) * 60 : 0;
                          
                          return (
                            <div
                              key={`cost-${point.date}`}
                              className="flex-1 bg-green-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                              style={{ height: `${height}px` }}
                              title={`${point.date}: ${formatCost(point.cost)}`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Token Trend */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Daily Tokens</h4>
                      <div className="flex items-end space-x-1 h-20">
                        {analytics.timeSeriesData.map((point, index) => {
                          const maxTokens = Math.max(...analytics.timeSeriesData.map(p => p.tokens));
                          const height = maxTokens > 0 ? (point.tokens / maxTokens) * 60 : 0;
                          
                          return (
                            <div
                              key={`tokens-${point.date}`}
                              className="flex-1 bg-blue-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                              style={{ height: `${height}px` }}
                              title={`${point.date}: ${formatTokens(point.tokens)} tokens`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Success Rate Trend */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Daily Success Rate</h4>
                      <div className="flex items-end space-x-1 h-20">
                        {analytics.timeSeriesData.map((point, index) => {
                          const height = (point.successRate / 100) * 60;
                          
                          return (
                            <div
                              key={`success-${point.date}`}
                              className="flex-1 bg-purple-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                              style={{ height: `${height}px` }}
                              title={`${point.date}: ${formatPercent(point.successRate)} success rate`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trend data available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="h-5 w-5 mr-2" />
                  Agent Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.agentStats)
                    .sort(([,a], [,b]) => b.tokens - a.tokens)
                    .map(([agent, stats]) => (
                      <div key={agent} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          <Bot className="h-5 w-5 text-blue-500" />
                          <div>
                            <div className="font-medium">{agent}</div>
                            <div className="text-sm text-muted-foreground">
                              {stats.requests.toLocaleString()} requests • {formatPercent(stats.success_rate)} success
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCost(stats.cost)}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatTokens(stats.tokens)} tokens
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="h-5 w-5 mr-2" />
                  MCP Server Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.mcpStats)
                    .sort(([,a], [,b]) => b.tokens - a.tokens)
                    .map(([server, stats]) => (
                      <div key={server} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          <Server className="h-5 w-5 text-purple-500" />
                          <div>
                            <div className="font-medium">{server}</div>
                            <div className="text-sm text-muted-foreground">
                              {stats.requests.toLocaleString()} requests • {formatPercent(stats.success_rate)} success
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCost(stats.cost)}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatTokens(stats.tokens)} tokens
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Gauge className="h-5 w-5 mr-2" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Success Rate</span>
                    <span>{formatPercent(analytics.overallSuccessRate)}</span>
                  </div>
                  <Progress value={analytics.overallSuccessRate} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Average Response Time</span>
                    <span>{formatResponseTime(analytics.avgResponseTime)}</span>
                  </div>
                  <Progress 
                    value={Math.max(0, 100 - (analytics.avgResponseTime / 100))} 
                    className="h-2" 
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Cost Efficiency</span>
                    <span>
                      {analytics.totalCost > 0 ? formatEfficiency(analytics.totalTokens / analytics.totalCost) : 0} tokens/$
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, (analytics.totalTokens / analytics.totalCost) / 100)} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Key Performance Indicators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Requests</span>
                    <Badge variant="outline">{analytics.totalRequests.toLocaleString()}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Failed Requests</span>
                    <Badge variant={analytics.totalFailures > 0 ? 'destructive' : 'outline'}>
                      {analytics.totalFailures.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Most Used Model</span>
                    <Badge variant="outline">
                      {analytics.modelComparisons[0]?.model || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Peak Usage Day</span>
                    <Badge variant="outline">
                      {analytics.timeSeriesData.reduce((peak, curr) => 
                        curr.tokens > peak.tokens ? curr : peak, 
                        analytics.timeSeriesData[0] || { date: 'N/A', tokens: 0 }
                      ).date}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Optimization Recommendations
              </CardTitle>
              <CardDescription>
                AI-generated recommendations to improve cost, performance, and reliability
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.recommendations.length > 0 ? (
                <div className="space-y-4">
                  {analytics.recommendations.map((rec, index) => (
                    <div key={index} className={`p-4 border rounded-lg ${getSeverityColor(rec.severity)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="capitalize">
                            {rec.type}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {rec.severity}
                          </Badge>
                        </div>
                        {rec.potentialSavings && (
                          <div className="text-sm font-medium text-green-600">
                            Save {formatCost(rec.potentialSavings)}
                          </div>
                        )}
                      </div>
                      <h4 className="font-semibold mb-2">{rec.title}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                      <div className="bg-background/50 p-3 rounded border">
                        <div className="text-sm font-medium mb-1">Implementation:</div>
                        <div className="text-sm">{rec.implementation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-medium mb-2">Great Performance!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your AI usage is optimized. No recommendations at this time.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});

AIAnalytics.displayName = 'AIAnalytics';

export default AIAnalytics;