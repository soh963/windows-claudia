import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  X,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Search,
  ChevronRight,
  Bug,
  Lightbulb,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Zap,
  Shield,
  Database,
  Globe,
  Code,
  Layers,
  FileText,
  Settings,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useErrorTrackingStore,
  type ErrorEntry,
  type ErrorCategory,
  type ErrorSeverity,
} from '@/stores/errorTrackingStore';
import { cn } from '@/lib/utils';
import { ErrorDetailsModal } from './ErrorDetailsModal';

interface ErrorDashboardProps {
  className?: string;
  onClose?: () => void;
}

const CHART_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const CATEGORY_ICONS: Record<ErrorCategory, React.ReactNode> = {
  api: <Zap className="h-4 w-4" />,
  tool: <Code className="h-4 w-4" />,
  runtime: <Activity className="h-4 w-4" />,
  ui: <Layers className="h-4 w-4" />,
  build: <Package className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  filesystem: <FileText className="h-4 w-4" />,
  network: <Globe className="h-4 w-4" />,
  permission: <Shield className="h-4 w-4" />,
  validation: <AlertCircle className="h-4 w-4" />,
  authentication: <Shield className="h-4 w-4" />,
  configuration: <Settings className="h-4 w-4" />,
};

export const ErrorDashboard: React.FC<ErrorDashboardProps> = ({ className, onClose }) => {
  const {
    errors,
    statistics,
    filters,
    selectedErrorId,
    isErrorDetailsModalOpen,
    setFilters,
    selectError,
    toggleErrorDetailsModal,
    clearResolvedErrors,
    exportErrors,
    updateStatistics,
    getErrorTrends,
    getResolutionMetrics,
    generatePreventionReport,
  } = useErrorTrackingStore();

  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Update statistics on mount and periodically
  useEffect(() => {
    updateStatistics();
    const interval = setInterval(updateStatistics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [updateStatistics]);

  // Filter errors based on current filters
  const filteredErrors = useMemo(() => {
    let filtered = Array.from(errors.values());

    // Apply filters
    if (filters.categories?.length) {
      filtered = filtered.filter((e) => filters.categories!.includes(e.category));
    }
    if (filters.sources?.length) {
      filtered = filtered.filter((e) => filters.sources!.includes(e.source));
    }
    if (filters.severities?.length) {
      filtered = filtered.filter((e) => filters.severities!.includes(e.severity));
    }
    if (filters.resolved !== undefined) {
      filtered = filtered.filter((e) => e.resolved === filters.resolved);
    }
    if (filters.dateRange) {
      filtered = filtered.filter(
        (e) => e.timestamp >= filters.dateRange!.start && e.timestamp <= filters.dateRange!.end
      );
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.message.toLowerCase().includes(term) ||
          e.code?.toLowerCase().includes(term) ||
          e.context.component?.toLowerCase().includes(term) ||
          e.tags?.some((tag) => tag.toLowerCase().includes(term))
      );
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [errors, filters, searchTerm]);

  // Get time-based error trends
  const timeRangeMs = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }[selectedTimeRange] || 24 * 60 * 60 * 1000;

  const errorTrends = getErrorTrends(timeRangeMs);
  const resolutionMetrics = getResolutionMetrics();
  const preventionReport = generatePreventionReport();

  // Severity distribution for pie chart
  const severityData = Object.entries(statistics.errorsBySeverity).map(([severity, count]) => ({
    name: severity.charAt(0).toUpperCase() + severity.slice(1),
    value: count,
    color: CHART_COLORS[severity as ErrorSeverity],
  }));

  // Category distribution for bar chart
  const categoryData = Object.entries(statistics.errorsByCategory).map(([category, count]) => ({
    category: category.charAt(0).toUpperCase() + category.slice(1),
    count,
  }));

  const handleExport = (format: 'json' | 'csv') => {
    const data = exportErrors(format);
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${format}-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'fixed inset-4 bg-background rounded-lg shadow-2xl border flex flex-col z-50',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Bug className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">Error Tracking Dashboard</h2>
            <Badge variant="secondary" className="ml-2">
              {statistics.totalErrors} Total Errors
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="prevention">Prevention</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 p-6 overflow-auto">
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Error Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">
                        {statistics.errorRate.toFixed(1)}/min
                      </span>
                      {statistics.errorRate > 1 ? (
                        <TrendingUp className="h-5 w-5 text-destructive" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Resolution Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <span className="text-2xl font-bold">
                        {statistics.resolutionRate.toFixed(0)}%
                      </span>
                      <Progress value={statistics.resolutionRate} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Avg Resolution Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="text-2xl font-bold">
                        {(statistics.averageResolutionTime / 1000 / 60).toFixed(1)}m
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Critical Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <span className="text-2xl font-bold text-destructive">
                        {statistics.errorsBySeverity.critical || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Error Trends Chart */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Error Trends</CardTitle>
                    <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">Last Hour</SelectItem>
                        <SelectItem value="24h">Last 24 Hours</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={errorTrends}>
                        <defs>
                          <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                          labelFormatter={(value) => format(new Date(value), 'PPp')}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#ef4444"
                          fillOpacity={1}
                          fill="url(#errorGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                {/* Severity Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Error Severity Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={severityData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {severityData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Errors */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {statistics.topErrors.slice(0, 5).map((error, index) => (
                          <div
                            key={index}
                            className="flex items-start justify-between gap-2 p-2 rounded hover:bg-muted/50"
                          >
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium line-clamp-2">{error.message}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="secondary">{error.count} occurrences</Badge>
                                <span>
                                  Last: {formatDistanceToNow(error.lastOccurrence, { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="flex-1 p-6 overflow-hidden">
            <div className="flex flex-col h-full gap-4">
              {/* Filters */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search errors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={filters.severities?.[0] || 'all'}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      severities: value === 'all' ? undefined : [value as ErrorSeverity],
                    })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.categories?.[0] || 'all'}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      categories: value === 'all' ? undefined : [value as ErrorCategory],
                    })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.keys(CATEGORY_ICONS).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({})}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Clear Filters
                </Button>
              </div>

              {/* Error List */}
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="divide-y">
                  {filteredErrors.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No errors found matching the current filters.
                    </div>
                  ) : (
                    filteredErrors.map((error) => (
                      <ErrorListItem
                        key={error.id}
                        error={error}
                        isSelected={selectedErrorId === error.id}
                        onClick={() => {
                          selectError(error.id);
                          toggleErrorDetailsModal();
                        }}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('json')}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('csv')}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearResolvedErrors}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Resolved
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="flex-1 p-6 overflow-auto">
            <div className="space-y-6">
              {/* Category Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Errors by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="category"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Resolution Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Resolution Methods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(resolutionMetrics.byMethod).map(([method, count]) => (
                        <div key={method} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{method}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="text-3xl font-bold">
                          {resolutionMetrics.successRate.toFixed(0)}%
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Errors Resolved
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Average Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="text-3xl font-bold">
                          {(resolutionMetrics.averageTime / 1000 / 60).toFixed(1)}m
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          To Resolution
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Error Sources */}
              <Card>
                <CardHeader>
                  <CardTitle>Error Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(statistics.errorsBySource).map(([source, count]) => {
                      const percentage = (count / statistics.totalErrors) * 100;
                      return (
                        <div key={source} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{source.replace('-', ' ')}</span>
                            <span className="text-muted-foreground">{count} errors</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="prevention" className="flex-1 p-6 overflow-auto">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Prevention Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {preventionReport.length === 0 ? (
                      <p className="text-muted-foreground">
                        Not enough error data to generate prevention recommendations yet.
                      </p>
                    ) : (
                      preventionReport.map((recommendation, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">Pattern: {recommendation.pattern}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {recommendation.suggestedPrevention}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {recommendation.occurrences} occurrences
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              Estimated impact reduction:
                            </span>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={recommendation.estimatedImpactReduction}
                                className="w-24 h-2"
                              />
                              <span className="font-medium">
                                {recommendation.estimatedImpactReduction}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Error Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle>Recurring Error Patterns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from(useErrorTrackingStore.getState().errorPatterns.values())
                      .sort((a, b) => b.occurrences - a.occurrences)
                      .slice(0, 10)
                      .map((pattern) => (
                        <div
                          key={pattern.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              {CATEGORY_ICONS[pattern.category]}
                              <span className="font-medium capitalize">
                                {pattern.category} Error
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {pattern.pattern}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                First seen:{' '}
                                {formatDistanceToNow(pattern.firstSeen, { addSuffix: true })}
                              </span>
                              <span>
                                Last seen:{' '}
                                {formatDistanceToNow(pattern.lastSeen, { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">{pattern.occurrences}</div>
                            <p className="text-xs text-muted-foreground">occurrences</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Error Details Modal */}
      {isErrorDetailsModalOpen && selectedErrorId && (
        <ErrorDetailsModal
          errorId={selectedErrorId}
          onClose={() => {
            toggleErrorDetailsModal();
            selectError(null);
          }}
        />
      )}
    </>
  );
};

interface ErrorListItemProps {
  error: ErrorEntry;
  isSelected: boolean;
  onClick: () => void;
}

const ErrorListItem: React.FC<ErrorListItemProps> = ({ error, isSelected, onClick }) => {
  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div
      className={cn(
        'p-4 hover:bg-muted/50 cursor-pointer transition-colors',
        isSelected && 'bg-muted/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {getSeverityIcon(error.severity)}
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            {CATEGORY_ICONS[error.category]}
            <span className="font-medium">{error.message}</span>
            {error.resolved && <CheckCircle className="h-4 w-4 text-green-500" />}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{formatDistanceToNow(error.timestamp, { addSuffix: true })}</span>
            {error.context.component && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>{error.context.component}</span>
              </>
            )}
            {error.retryCount && error.retryCount > 0 && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>Retried {error.retryCount} times</span>
              </>
            )}
          </div>
          {error.tags && error.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {error.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
};