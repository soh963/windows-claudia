import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Package, 
  GitBranch, 
  TrendingUp, 
  AlertTriangle,
  Activity,
  ChevronUp,
  ChevronDown,
  Minus
} from 'lucide-react';
import type { ProjectHealthMetric } from '@/lib/api';

interface HealthMetricsProps {
  metrics: ProjectHealthMetric[];
  loading?: boolean;
}

export function HealthMetrics({ metrics, loading = false }: HealthMetricsProps) {
  const getMetricIcon = (type: string) => {
    switch (type) {
      case 'security':
        return <Shield className="h-5 w-5" />;
      case 'dependencies':
        return <Package className="h-5 w-5" />;
      case 'complexity':
        return <GitBranch className="h-5 w-5" />;
      case 'scalability':
        return <TrendingUp className="h-5 w-5" />;
      case 'error_rate':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getMetricColor = (value: number, type: string) => {
    // For error_rate, lower is better
    if (type === 'error_rate') {
      if (value <= 5) return 'text-green-600';
      if (value <= 10) return 'text-yellow-600';
      return 'text-red-600';
    }
    
    // For other metrics, higher is better
    if (value >= 90) return 'text-green-600';
    if (value >= 70) return 'text-blue-600';
    if (value >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (value: number, type: string) => {
    // For error_rate, lower is better
    if (type === 'error_rate') {
      if (value <= 5) return 'bg-green-600';
      if (value <= 10) return 'bg-yellow-600';
      return 'bg-red-600';
    }
    
    // For other metrics, higher is better
    if (value >= 90) return 'bg-green-600';
    if (value >= 70) return 'bg-blue-600';
    if (value >= 50) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'improving':
        return <ChevronUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <ChevronDown className="h-4 w-4 text-red-600" />;
      case 'stable':
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatMetricName = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-300 rounded w-32"></div>
          <div className="h-4 bg-gray-300 rounded w-48"></div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-300 rounded w-24"></div>
                  <div className="h-4 bg-gray-300 rounded w-12"></div>
                </div>
                <div className="h-2 bg-gray-300 rounded w-full"></div>
                <div className="h-3 bg-gray-300 rounded w-32"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Health</CardTitle>
        <CardDescription>
          Key metrics indicating the overall health of your project
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.map((metric, index) => (
            <div key={`${metric.metric_type}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getMetricIcon(metric.metric_type)}
                  <span className="font-medium">{formatMetricName(metric.metric_type)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${getMetricColor(metric.value, metric.metric_type)}`}>
                    {metric.value.toFixed(0)}
                    {metric.metric_type === 'error_rate' ? '%' : ''}
                  </span>
                  {getTrendIcon(metric.trend)}
                </div>
              </div>
              
              <Progress 
                value={metric.metric_type === 'error_rate' ? (100 - metric.value) : metric.value} 
                className="h-2"
                indicatorClassName={getProgressColor(metric.value, metric.metric_type)}
              />
              
              {metric.details && (
                <p className="text-xs text-muted-foreground">{metric.details}</p>
              )}
              
              {metric.trend && (
                <Badge variant="secondary" className="text-xs">
                  {metric.trend}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {metrics.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No health metrics available</p>
            <p className="text-sm">Run project analysis to generate metrics</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}