import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Info,
  Database,
  RefreshCw
} from 'lucide-react';
import AIAnalytics from './AIAnalytics';
import type { AIUsageMetric } from '@/lib/api';

interface AIAnalyticsDemoProps {
  projectId?: string;
}

/**
 * Demo component showcasing the enhanced AI Analytics Dashboard
 * This component demonstrates the comprehensive analytics capabilities
 * integrated with the existing dashboard infrastructure
 */
const AIAnalyticsDemo: React.FC<AIAnalyticsDemoProps> = ({ projectId = 'demo-project' }) => {
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Demo data generator
  const generateDemoData = (): AIUsageMetric[] => {
    const models = ['claude-sonnet-4', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gemini-2.0-flash-exp'];
    const agents = ['Code Generator', 'Architect', 'QA Agent', 'Direct Usage', 'Bug Finder'];
    const mcpServers = ['Sequential', 'Context7', 'Magic', 'No MCP'];
    const data: AIUsageMetric[] = [];

    // Generate data for last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const sessionDate = date.toISOString().split('T')[0];
      
      // Generate multiple metrics per day
      for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
        const model = models[Math.floor(Math.random() * models.length)];
        const agent = Math.random() > 0.3 ? agents[Math.floor(Math.random() * agents.length)] : null;
        const mcpServer = Math.random() > 0.4 ? mcpServers[Math.floor(Math.random() * mcpServers.length)] : null;
        
        const tokenCount = Math.floor(Math.random() * 50000) + 1000;
        const requestCount = Math.floor(Math.random() * 20) + 1;
        const successCount = Math.floor(requestCount * (0.8 + Math.random() * 0.2));
        const failureCount = requestCount - successCount;
        const avgResponseTime = Math.floor(Math.random() * 8000) + 500;
        
        // Cost calculation based on model
        const costMultiplier = model.includes('opus') ? 0.075 : 
                              model.includes('sonnet-4') ? 0.020 :
                              model.includes('sonnet') ? 0.015 :
                              model.includes('haiku') ? 0.00125 :
                              0.008; // gemini
        
        const totalCost = (tokenCount / 1000) * costMultiplier * (0.8 + Math.random() * 0.4);

        data.push({
          id: undefined,
          project_id: projectId,
          model_name: model,
          agent_type: agent,
          mcp_server: mcpServer,
          token_count: tokenCount,
          request_count: requestCount,
          success_count: successCount,
          failure_count: failureCount,
          success_rate: (successCount / requestCount) * 100,
          avg_response_time: avgResponseTime,
          total_cost: totalCost,
          session_date: sessionDate,
          timestamp: Math.floor(date.getTime() / 1000)
        });
      }
    }

    return data.sort((a, b) => b.timestamp - a.timestamp);
  };

  const [demoData, setDemoData] = useState<AIUsageMetric[]>(() => generateDemoData());

  const handleRefresh = () => {
    setLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      setDemoData(generateDemoData());
      setRefreshKey(prev => prev + 1);
      setLoading(false);
    }, 1000);
  };

  // Calculate summary stats for the demo banner
  const summaryStats = React.useMemo(() => {
    const totalTokens = demoData.reduce((sum, m) => sum + m.token_count, 0);
    const totalCost = demoData.reduce((sum, m) => sum + (m.total_cost || 0), 0);
    const totalRequests = demoData.reduce((sum, m) => sum + m.request_count, 0);
    const totalSuccess = demoData.reduce((sum, m) => sum + m.success_count, 0);
    const successRate = totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;
    const uniqueModels = new Set(demoData.map(m => m.model_name)).size;

    return {
      totalTokens,
      totalCost,
      totalRequests,
      successRate,
      uniqueModels
    };
  }, [demoData]);

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatCost = (cost: number) => {
    return cost < 0.01 ? '< $0.01' : `$${cost.toFixed(3)}`;
  };

  return (
    <div className="space-y-6">
      {/* Demo Banner */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <strong>AI Analytics Dashboard Demo</strong> - This showcase demonstrates comprehensive 
              AI usage analytics with {formatTokens(summaryStats.totalTokens)} tokens across {summaryStats.uniqueModels} models 
              and {summaryStats.totalRequests.toLocaleString()} requests.
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Generate New Data
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demo Data Points</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demoData.length}</div>
            <p className="text-xs text-muted-foreground">
              AI usage metrics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(summaryStats.totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              Across all models
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summaryStats.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall reliability
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Models Tracked</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summaryStats.uniqueModels}</div>
            <p className="text-xs text-muted-foreground">
              AI model types
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Dashboard */}
      <AIAnalytics 
        key={refreshKey}
        usage={demoData} 
        loading={loading}
        projectId={projectId}
        onRefresh={handleRefresh}
      />

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Dashboard Features
          </CardTitle>
          <CardDescription>
            Comprehensive AI analytics capabilities integrated with existing infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">📊 Usage Statistics</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Token consumption tracking</li>
                <li>• Request success/failure rates</li>
                <li>• Response time monitoring</li>
                <li>• Cost analysis and optimization</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">🤖 Model Comparison</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Performance benchmarking</li>
                <li>• Cost efficiency analysis</li>
                <li>• Reliability scoring</li>
                <li>• Usage pattern insights</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">📈 Trends & Patterns</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Time-series visualization</li>
                <li>• Usage trend analysis</li>
                <li>• Peak usage identification</li>
                <li>• Historical comparisons</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">🛠️ Agent Analytics</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Agent performance tracking</li>
                <li>• MCP server utilization</li>
                <li>• Workflow optimization</li>
                <li>• Resource allocation</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">⚡ Performance Metrics</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Real-time monitoring</li>
                <li>• SLA compliance tracking</li>
                <li>• Performance benchmarks</li>
                <li>• Optimization recommendations</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm">🎯 Optimization</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Cost reduction suggestions</li>
                <li>• Performance improvements</li>
                <li>• Reliability enhancements</li>
                <li>• Usage pattern optimization</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAnalyticsDemo;