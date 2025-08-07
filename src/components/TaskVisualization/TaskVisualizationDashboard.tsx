import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  Settings,
  RefreshCw,
  Download,
  Grid,
  List,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

import { LineChart, BarChart, PieChart, Timeline } from '../charts';
import type { TimelineEvent } from '../charts/Timeline';
import { useVisualizationStore } from '@/lib/stores/visualizationStore';
import { cn } from '@/lib/utils';

interface TaskVisualizationDashboardProps {
  className?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const TaskVisualizationDashboard: React.FC<TaskVisualizationDashboardProps> = ({
  className,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const {
    visualizationData,
    settings,
    isLoading,
    error,
    lastUpdated,
    updateVisualizationData,
    setSettings,
    startRealTimeUpdates,
    stopRealTimeUpdates,
    exportChart,
  } = useVisualizationStore();

  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(
    new Set(['overview', 'progress', 'models', 'operations', 'timeline'])
  );

  // Initialize and start real-time updates
  useEffect(() => {
    updateVisualizationData();
    startRealTimeUpdates();
    
    return () => {
      stopRealTimeUpdates();
    };
  }, [updateVisualizationData, startRealTimeUpdates, stopRealTimeUpdates]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const { 
      progressOverTime, 
      performanceMetrics, 
      modelComparison, 
      operationTypeDistribution,
      timelineEvents 
    } = visualizationData;

    return {
      progress: progressOverTime,
      models: modelComparison.map(model => ({
        name: model.modelId,
        value: model.responseTime,
        successRate: model.successRate,
        totalRequests: model.totalRequests,
      })),
      operations: operationTypeDistribution.map(op => ({
        name: op.type.replace('_', ' '),
        value: op.count,
        percentage: op.percentage,
      })),
      timeline: timelineEvents as TimelineEvent[],
      metrics: performanceMetrics,
    };
  }, [visualizationData]);

  // Handle manual refresh
  const handleRefresh = async () => {
    await updateVisualizationData();
  };

  // Handle chart visibility toggle
  const toggleChart = (chartId: string) => {
    setSelectedCharts(prev => {
      const next = new Set(prev);
      if (next.has(chartId)) {
        next.delete(chartId);
      } else {
        next.add(chartId);
      }
      return next;
    });
  };

  // Handle export all
  const handleExportAll = async (format: string) => {
    for (const chartId of selectedCharts) {
      await exportChart(chartId, {
        format: format as any,
        chartType: chartId,
        dateRange: {
          start: Date.now() - (24 * 60 * 60 * 1000),
          end: Date.now(),
        },
        includeMetadata: true,
      });
    }
  };

  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <XCircle className="h-8 w-8 mb-2 mx-auto text-destructive" />
            <div className="text-sm font-medium mb-1">Failed to load dashboard</div>
            <div className="text-xs mb-3">{error}</div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('w-full h-full flex flex-col', className)}>
      {/* Header */}
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Task Visualization Dashboard</h1>
            </div>
            {lastUpdated > 0 && (
              <Badge variant="secondary" className="text-xs">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </Badge>
            )}
            {isLoading && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Updating...
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Layout Toggle */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={layout === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setLayout('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={layout === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setLayout('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Settings Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-3">
                  <h4 className="text-sm font-medium mb-3">Dashboard Settings</h4>
                  
                  {/* Real-time Updates */}
                  <div className="flex items-center justify-between mb-3">
                    <Label htmlFor="real-time" className="text-sm">
                      Real-time Updates
                    </Label>
                    <Switch
                      id="real-time"
                      checked={settings.enableRealTimeUpdates}
                      onCheckedChange={(enabled) => {
                        setSettings({ enableRealTimeUpdates: enabled });
                        if (enabled) {
                          startRealTimeUpdates();
                        } else {
                          stopRealTimeUpdates();
                        }
                      }}
                    />
                  </div>
                  
                  {/* Refresh Interval */}
                  <div className="mb-3">
                    <Label className="text-sm mb-2 block">
                      Refresh Interval: {settings.refreshInterval / 1000}s
                    </Label>
                    <Slider
                      value={[settings.refreshInterval / 1000]}
                      onValueChange={([value]) => 
                        setSettings({ refreshInterval: value * 1000 })
                      }
                      min={1}
                      max={60}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Chart Animations */}
                  <div className="flex items-center justify-between mb-3">
                    <Label htmlFor="animations" className="text-sm">
                      Chart Animations
                    </Label>
                    <Switch
                      id="animations"
                      checked={settings.chartAnimations}
                      onCheckedChange={(enabled) => 
                        setSettings({ chartAnimations: enabled })
                      }
                    />
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Chart Visibility */}
                  <div className="mt-3">
                    <Label className="text-sm mb-2 block">Visible Charts</Label>
                    <div className="space-y-1">
                      {[
                        { id: 'overview', label: 'Overview Metrics' },
                        { id: 'progress', label: 'Progress Over Time' },
                        { id: 'models', label: 'Model Comparison' },
                        { id: 'operations', label: 'Operation Distribution' },
                        { id: 'timeline', label: 'Activity Timeline' },
                      ].map(({ id, label }) => (
                        <DropdownMenuCheckboxItem
                          key={id}
                          checked={selectedCharts.has(id)}
                          onCheckedChange={() => toggleChart(id)}
                        >
                          {label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Export Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportAll('png')}>
                  Export All as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportAll('csv')}>
                  Export Data as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportAll('json')}>
                  Export Data as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
            
            {onToggleFullscreen && (
              <Button variant="ghost" size="sm" onClick={onToggleFullscreen}>
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="dashboard" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-4 w-fit">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="flex-1 m-0 p-4">
            <ScrollArea className="h-full">
              <div className={cn(
                'gap-4',
                layout === 'grid' 
                  ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' 
                  : 'flex flex-col'
              )}>
                {/* Overview Metrics */}
                {selectedCharts.has('overview') && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={layout === 'list' ? 'lg:col-span-full' : 'xl:col-span-3'}
                  >
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Performance Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary mb-1">
                              {chartData.metrics.totalOperations}
                            </div>
                            <div className="text-xs text-muted-foreground">Total Operations</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-500 mb-1">
                              {chartData.metrics.successRate.toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">Success Rate</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-500 mb-1">
                              {(chartData.metrics.averageResponseTime / 1000).toFixed(1)}s
                            </div>
                            <div className="text-xs text-muted-foreground">Avg Response</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-500 mb-1">
                              {chartData.metrics.operationsPerMinute}
                            </div>
                            <div className="text-xs text-muted-foreground">Ops/Min</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Progress Over Time */}
                {selectedCharts.has('progress') && chartData.progress.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={layout === 'list' ? 'lg:col-span-full' : 'lg:col-span-2'}
                  >
                    <LineChart
                      data={chartData.progress}
                      title="Task Progress Over Time"
                      height={300}
                      animated={settings.chartAnimations}
                      yAxisLabel="Progress %"
                      onExport={exportChart}
                      loading={isLoading}
                    />
                  </motion.div>
                )}

                {/* Model Comparison */}
                {selectedCharts.has('models') && chartData.models.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <BarChart
                      data={chartData.models}
                      title="Model Performance Comparison"
                      height={300}
                      layout="horizontal"
                      yAxisLabel="Response Time (ms)"
                      animated={settings.chartAnimations}
                      showValues
                      onExport={exportChart}
                      loading={isLoading}
                    />
                  </motion.div>
                )}

                {/* Operation Distribution */}
                {selectedCharts.has('operations') && chartData.operations.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <PieChart
                      data={chartData.operations}
                      title="Operation Type Distribution"
                      height={300}
                      donut
                      showPercentages
                      animated={settings.chartAnimations}
                      onExport={exportChart}
                      loading={isLoading}
                    />
                  </motion.div>
                )}

                {/* Activity Timeline */}
                {selectedCharts.has('timeline') && chartData.timeline.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className={layout === 'list' ? 'lg:col-span-full' : 'xl:col-span-2'}
                  >
                    <Timeline
                      data={chartData.timeline}
                      title="Recent Activity"
                      height={400}
                      maxEvents={50}
                      groupBy="day"
                      onExport={exportChart}
                      loading={isLoading}
                    />
                  </motion.div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="analytics" className="flex-1 m-0 p-4">
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Advanced Analytics</h3>
                <p className="text-sm">Detailed analytics views coming soon</p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="performance" className="flex-1 m-0 p-4">
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Performance Monitoring</h3>
                <p className="text-sm">Performance insights coming soon</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TaskVisualizationDashboard;