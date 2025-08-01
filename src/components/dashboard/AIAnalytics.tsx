import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bot,
  Zap,
  Clock,
  DollarSign,
  TrendingUp,
  Brain,
  Server,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import type { AIUsageMetric } from '@/lib/api';

interface AIAnalyticsProps {
  usage: AIUsageMetric[];
  loading?: boolean;
}

const AIAnalytics: React.FC<AIAnalyticsProps> = React.memo(({ usage, loading = false }) => {
  const analytics = useMemo(() => {
    if (usage.length === 0) return null;

    // Aggregate metrics
    const totalTokens = usage.reduce((sum, m) => sum + m.token_count, 0);
    const totalRequests = usage.reduce((sum, m) => sum + m.request_count, 0);
    const totalSuccess = usage.reduce((sum, m) => sum + m.success_count, 0);
    const totalFailures = usage.reduce((sum, m) => sum + m.failure_count, 0);
    const totalCost = usage.reduce((sum, m) => sum + (m.total_cost || 0), 0);
    
    const overallSuccessRate = totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;
    
    // Average response time (excluding null values)
    const responseTimeMetrics = usage.filter(m => m.avg_response_time);
    const avgResponseTime = responseTimeMetrics.length > 0 
      ? responseTimeMetrics.reduce((sum, m) => sum + (m.avg_response_time || 0), 0) / responseTimeMetrics.length
      : 0;

    // Model breakdown
    const modelStats = usage.reduce((acc, metric) => {
      const model = metric.model_name;
      if (!acc[model]) {
        acc[model] = {
          tokens: 0,
          requests: 0,
          cost: 0,
          success_rate: 0,
          avg_response_time: 0,
          metrics_count: 0
        };
      }
      acc[model].tokens += metric.token_count;
      acc[model].requests += metric.request_count;
      acc[model].cost += metric.total_cost || 0;
      
      if (metric.success_rate) {
        acc[model].success_rate += metric.success_rate;
        acc[model].metrics_count += 1;
      }
      
      if (metric.avg_response_time) {
        acc[model].avg_response_time += metric.avg_response_time;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages for models
    Object.keys(modelStats).forEach(model => {
      if (modelStats[model].metrics_count > 0) {
        modelStats[model].success_rate = modelStats[model].success_rate / modelStats[model].metrics_count;
        modelStats[model].avg_response_time = modelStats[model].avg_response_time / modelStats[model].metrics_count;
      }
    });

    // Agent type breakdown
    const agentStats = usage.reduce((acc, metric) => {
      const agent = metric.agent_type || 'Direct Usage';
      if (!acc[agent]) {
        acc[agent] = { tokens: 0, requests: 0, cost: 0 };
      }
      acc[agent].tokens += metric.token_count;
      acc[agent].requests += metric.request_count;
      acc[agent].cost += metric.total_cost || 0;
      return acc;
    }, {} as Record<string, any>);

    // MCP server breakdown
    const mcpStats = usage.reduce((acc, metric) => {
      const server = metric.mcp_server || 'No MCP';
      if (!acc[server]) {
        acc[server] = { tokens: 0, requests: 0, cost: 0 };
      }
      acc[server].tokens += metric.token_count;
      acc[server].requests += metric.request_count;
      acc[server].cost += metric.total_cost || 0;
      return acc;
    }, {} as Record<string, any>);

    // Daily usage trend
    const dailyUsage = usage.reduce((acc, metric) => {
      const date = metric.session_date;
      if (!acc[date]) {
        acc[date] = { tokens: 0, requests: 0, cost: 0 };
      }
      acc[date].tokens += metric.token_count;
      acc[date].requests += metric.request_count;
      acc[date].cost += metric.total_cost || 0;
      return acc;
    }, {} as Record<string, any>);

    return {
      totalTokens,
      totalRequests,
      totalSuccess,
      totalFailures,
      totalCost,
      overallSuccessRate,
      avgResponseTime,
      modelStats,
      agentStats,
      mcpStats,
      dailyUsage
    };
  }, [usage]);

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

  if (loading) {
    return (
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
    );
  }

  if (!analytics || usage.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <Bot className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground">No AI usage data available</p>
            <p className="text-xs text-muted-foreground">Start using AI features to see analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center">
              <Zap className="h-4 w-4 mr-1" />
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatTokens(analytics.totalTokens)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {analytics.totalRequests} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center">
              <CheckCircle className="h-4 w-4 mr-1" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getSuccessRateColor(analytics.overallSuccessRate)}`}>
              {analytics.overallSuccessRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalSuccess} / {analytics.totalRequests} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              Avg Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getResponseTimeColor(analytics.avgResponseTime)}`}>
              {formatResponseTime(analytics.avgResponseTime)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCost(analytics.totalCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total usage cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Model Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2" />
            Model Usage Breakdown
          </CardTitle>
          <CardDescription>Usage statistics by AI model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(analytics.modelStats)
              .sort(([,a], [,b]) => b.tokens - a.tokens)
              .map(([model, stats]) => (
                <div key={model} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{model}</h4>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {formatTokens(stats.tokens)} tokens
                      </Badge>
                      <Badge variant="outline">
                        {formatCost(stats.cost)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Requests</div>
                      <div className="font-medium">{stats.requests.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Success Rate</div>
                      <div className={`font-medium ${getSuccessRateColor(stats.success_rate)}`}>
                        {stats.success_rate.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Avg Response</div>
                      <div className={`font-medium ${getResponseTimeColor(stats.avg_response_time)}`}>
                        {formatResponseTime(stats.avg_response_time)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Agent and MCP Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="h-5 w-5 mr-2" />
              Agent Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.agentStats)
                .sort(([,a], [,b]) => b.tokens - a.tokens)
                .map(([agent, stats]) => (
                  <div key={agent} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Bot className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium">{agent}</div>
                        <div className="text-xs text-muted-foreground">
                          {stats.requests} requests
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatTokens(stats.tokens)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCost(stats.cost)}
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
            <div className="space-y-3">
              {Object.entries(analytics.mcpStats)
                .sort(([,a], [,b]) => b.tokens - a.tokens)
                .map(([server, stats]) => (
                  <div key={server} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Server className="h-4 w-4 text-purple-500" />
                      <div>
                        <div className="font-medium">{server}</div>
                        <div className="text-xs text-muted-foreground">
                          {stats.requests} requests
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatTokens(stats.tokens)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCost(stats.cost)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.overallSuccessRate < 90 && (
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Success Rate Below 90%</p>
                  <p className="text-xs text-muted-foreground">
                    Consider reviewing error patterns and improving prompt quality.
                  </p>
                </div>
              </div>
            )}
            
            {analytics.avgResponseTime > 5000 && (
              <div className="flex items-start space-x-2">
                <Clock className="h-4 w-4 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">High Average Response Time</p>
                  <p className="text-xs text-muted-foreground">
                    Response times over 5 seconds may impact user experience.
                  </p>
                </div>
              </div>
            )}
            
            {analytics.totalCost > 10 && (
              <div className="flex items-start space-x-2">
                <DollarSign className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">High Usage Cost</p>
                  <p className="text-xs text-muted-foreground">
                    Consider optimizing prompts or using more cost-effective models.
                  </p>
                </div>
              </div>
            )}
            
            {analytics.overallSuccessRate >= 95 && analytics.avgResponseTime <= 3000 && (
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Excellent Performance</p>
                  <p className="text-xs text-muted-foreground">
                    AI usage is performing optimally with high success rates and fast responses.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

AIAnalytics.displayName = 'AIAnalytics';

export default AIAnalytics;