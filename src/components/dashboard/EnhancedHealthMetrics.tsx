import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Package, 
  GitBranch, 
  TrendingUp, 
  AlertTriangle,
  Activity,
  ChevronUp,
  ChevronDown,
  Minus,
  RefreshCw,
  BarChart3,
  Target,
  Zap,
  Bug,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HealthMetricsService, type EnhancedHealthMetrics } from '@/lib/healthMetricsService';

interface EnhancedHealthMetricsProps {
  projectId: string;
  projectPath: string;
  loading?: boolean;
  onRefresh?: () => void;
}

// Health score thresholds
const HEALTH_THRESHOLDS = {
  excellent: 90,
  good: 75,
  fair: 60,
  poor: 40
};

export function EnhancedHealthMetrics({ 
  projectId, 
  projectPath, 
  loading = false,
  onRefresh 
}: EnhancedHealthMetricsProps) {
  const [metrics, setMetrics] = useState<EnhancedHealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(loading);
  const [activeView, setActiveView] = useState('overview');
  const [error, setError] = useState<string | null>(null);

  const healthService = useMemo(() => HealthMetricsService.getInstance(), []);

  const fetchMetrics = async () => {
    if (!projectId || !projectPath) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const enhancedMetrics = await healthService.getEnhancedHealthMetrics(projectId, projectPath);
      setMetrics(enhancedMetrics);
    } catch (err) {
      console.error('Failed to fetch enhanced health metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [projectId, projectPath]);

  const handleRefresh = async () => {
    healthService.clearCache(projectId);
    await fetchMetrics();
    onRefresh?.();
  };

  const getHealthLevel = (score: number) => {
    if (score >= HEALTH_THRESHOLDS.excellent) return 'excellent';
    if (score >= HEALTH_THRESHOLDS.good) return 'good';
    if (score >= HEALTH_THRESHOLDS.fair) return 'fair';
    return 'poor';
  };

  const getHealthColor = (score: number) => {
    const level = getHealthLevel(score);
    switch (level) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthBgColor = (score: number) => {
    const level = getHealthLevel(score);
    switch (level) {
      case 'excellent': return 'bg-green-100 border-green-200';
      case 'good': return 'bg-blue-100 border-blue-200';
      case 'fair': return 'bg-yellow-100 border-yellow-200';
      case 'poor': return 'bg-red-100 border-red-200';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const getProgressColor = (score: number) => {
    const level = getHealthLevel(score);
    switch (level) {
      case 'excellent': return 'bg-green-600';
      case 'good': return 'bg-blue-600';
      case 'fair': return 'bg-yellow-600';
      case 'poor': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
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

  const getHealthIcon = (score: number) => {
    const level = getHealthLevel(score);
    switch (level) {
      case 'excellent': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'good': return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'fair': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'poor': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getMetricIcon = (type: string) => {
    switch (type) {
      case 'code_quality':
        return <GitBranch className="h-5 w-5" />;
      case 'test_coverage':
        return <Target className="h-5 w-5" />;
      case 'performance':
        return <Zap className="h-5 w-5" />;
      case 'security':
        return <Shield className="h-5 w-5" />;
      case 'maintainability':
        return <Package className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  if (isLoading && !metrics) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-300 rounded w-48"></div>
          <div className="h-4 bg-gray-300 rounded w-64"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-gray-300 rounded w-24"></div>
                    <div className="h-6 bg-gray-300 rounded w-12"></div>
                  </div>
                  <div className="h-2 bg-gray-300 rounded w-full"></div>
                  <div className="h-3 bg-gray-300 rounded w-32"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Health Metrics Error
          </CardTitle>
          <CardDescription>Failed to load project health metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Health Metrics</CardTitle>
          <CardDescription>No health metrics available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Run project analysis to generate health metrics
          </p>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analyze Project
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getHealthIcon(metrics.overall_health_score)}
              Project Health Metrics
            </CardTitle>
            <CardDescription>
              Comprehensive analysis of project quality and maintainability
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              {getTrendIcon(metrics.trend_direction)}
              {metrics.trend_direction}
            </Badge>
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeView} onValueChange={setActiveView}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <AnimatePresence mode="sync">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="overview" className="space-y-6">
                {/* Overall Health Score */}
                <motion.div 
                  className={`p-6 rounded-lg border-2 ${getHealthBgColor(metrics.overall_health_score)}`}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Overall Health Score</h3>
                    <span className={`text-3xl font-bold ${getHealthColor(metrics.overall_health_score)}`}>
                      {metrics.overall_health_score}
                    </span>
                  </div>
                  <Progress 
                    value={metrics.overall_health_score} 
                    className="h-3"
                    indicatorClassName={getProgressColor(metrics.overall_health_score)}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {getHealthLevel(metrics.overall_health_score).charAt(0).toUpperCase() + 
                     getHealthLevel(metrics.overall_health_score).slice(1)} project health
                  </p>
                </motion.div>

                {/* Core Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: 'code_quality_score', label: 'Code Quality', value: metrics.code_quality_score },
                    { key: 'test_coverage_score', label: 'Test Coverage', value: metrics.test_coverage_score },
                    { key: 'performance_score', label: 'Performance', value: metrics.performance_score },
                    { key: 'security_score', label: 'Security', value: metrics.security_score },
                    { key: 'maintainability_score', label: 'Maintainability', value: metrics.maintainability_score }
                  ].map((metric, index) => (
                    <motion.div
                      key={metric.key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-card border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getMetricIcon(metric.key)}
                          <span className="font-medium text-sm">{metric.label}</span>
                        </div>
                        <span className={`text-xl font-bold ${getHealthColor(metric.value)}`}>
                          {metric.value}
                        </span>
                      </div>
                      <Progress 
                        value={metric.value} 
                        className="h-2 mt-2"
                        indicatorClassName={getProgressColor(metric.value)}
                      />
                      <Badge 
                        variant="secondary" 
                        className="text-xs mt-2"
                      >
                        {getHealthLevel(metric.value)}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="detailed" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {metrics.metrics.map((metric, index) => (
                    <motion.div
                      key={`${metric.metric_type}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-card border rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getMetricIcon(metric.metric_type)}
                          <span className="font-medium capitalize">
                            {metric.metric_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${getHealthColor(metric.value)}`}>
                            {metric.value.toFixed(0)}
                            {metric.metric_type === 'test_coverage' ? '%' : ''}
                          </span>
                          {metric.trend && getTrendIcon(metric.trend as any)}
                        </div>
                      </div>
                      
                      <Progress 
                        value={metric.value} 
                        className="h-2 mb-3"
                        indicatorClassName={getProgressColor(metric.value)}
                      />
                      
                      {metric.details && (
                        <p className="text-xs text-muted-foreground">{metric.details}</p>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {getHealthLevel(metric.value)}
                        </Badge>
                        {metric.trend && (
                          <Badge variant="outline" className="text-xs">
                            {metric.trend}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4">
                <div className="space-y-3">
                  {metrics.recommendations.map((recommendation, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-3 p-4 bg-card border rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {recommendation.includes('good') || recommendation.includes('Continue') ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{recommendation}</p>
                    </motion.div>
                  ))}
                </div>

                {metrics.recommendations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No specific recommendations at this time</p>
                    <p className="text-sm">Your project health is looking good!</p>
                  </div>
                )}
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </CardContent>
    </Card>
  );
}