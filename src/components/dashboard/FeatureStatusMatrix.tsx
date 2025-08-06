import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { 
  Grid3X3,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Code,
  Users,
  Calendar,
  ArrowUpDown,
  Eye,
  MoreHorizontal,
  Package,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeatureItem } from '@/lib/api';
import { dashboardVariants } from '@/lib/animations';

interface FeatureStatusMatrixProps {
  features: FeatureItem[];
  loading?: boolean;
  onFeatureClick?: (feature: FeatureItem) => void;
  onFeatureUpdate?: (feature: FeatureItem) => void;
}

// Define status types and their properties
const STATUS_CONFIG = {
  planned: {
    label: 'Planned',
    color: 'bg-gray-500 text-white',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: Clock,
    progress: 0
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-500 text-white',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: TrendingUp,
    progress: 50
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-500 text-white',
    bgColor: 'bg-green-50 border-green-200',
    icon: CheckCircle,
    progress: 100
  },
  blocked: {
    label: 'Blocked',
    color: 'bg-red-500 text-white',
    bgColor: 'bg-red-50 border-red-200',
    icon: XCircle,
    progress: 25
  },
  pending: {
    label: 'Pending',
    color: 'bg-yellow-500 text-black',
    bgColor: 'bg-yellow-50 border-yellow-200',
    icon: AlertCircle,
    progress: 10
  }
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

const FeatureStatusMatrix: React.FC<FeatureStatusMatrixProps> = ({ 
  features, 
  loading = false,
  onFeatureClick,
  onFeatureUpdate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'complexity' | 'independence' | 'updated'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter and sort features
  const filteredAndSortedFeatures = useMemo(() => {
    let filtered = features.filter(feature => {
      const matchesSearch = feature.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (feature.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || feature.status === statusFilter;
      
      const complexityScore = feature.complexity_score || 0;
      const matchesComplexity = complexityFilter === 'all' ||
        (complexityFilter === 'low' && complexityScore <= 30) ||
        (complexityFilter === 'medium' && complexityScore > 30 && complexityScore <= 70) ||
        (complexityFilter === 'high' && complexityScore > 70);
      
      return matchesSearch && matchesStatus && matchesComplexity;
    });

    // Sort features
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'complexity':
          aValue = a.complexity_score || 0;
          bValue = b.complexity_score || 0;
          break;
        case 'independence':
          aValue = a.independence_score || 0;
          bValue = b.independence_score || 0;
          break;
        case 'updated':
          aValue = a.updated_at;
          bValue = b.updated_at;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [features, searchTerm, statusFilter, complexityFilter, sortBy, sortOrder]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const total = features.length;
    const statusCounts = features.reduce((acc, feature) => {
      acc[feature.status] = (acc[feature.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgComplexity = features.reduce((sum, f) => sum + (f.complexity_score || 0), 0) / total || 0;
    const avgIndependence = features.reduce((sum, f) => sum + (f.independence_score || 0), 0) / total || 0;
    
    const completionRate = ((statusCounts.completed || 0) / total) * 100 || 0;
    const blockedRate = ((statusCounts.blocked || 0) / total) * 100 || 0;

    return {
      total,
      statusCounts,
      avgComplexity,
      avgIndependence,
      completionRate,
      blockedRate
    };
  }, [features]);

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as StatusKey] || STATUS_CONFIG.pending;
  };

  const getComplexityLabel = (score: number) => {
    if (score <= 30) return 'Low';
    if (score <= 70) return 'Medium';
    return 'High';
  };

  const getComplexityColor = (score: number) => {
    if (score <= 30) return 'text-green-600';
    if (score <= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getIndependenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 bg-gray-300 rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-gray-300 rounded w-64 mt-2 animate-pulse"></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-32 bg-gray-300 rounded animate-pulse"></div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <motion.div 
        className="space-y-6"
        variants={dashboardVariants.container}
        initial="hidden"
        animate="show"
      >
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Grid3X3 className="h-5 w-5 mr-2" />
                Feature Status Matrix
              </CardTitle>
              <CardDescription>
                Comprehensive view of all features and their implementation status
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <Layers className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Features</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completionRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Completion Rate</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getComplexityColor(stats.avgComplexity)}`}>
                {stats.avgComplexity.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">Avg Complexity</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getIndependenceColor(stats.avgIndependence)}`}>
                {stats.avgIndependence.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Independence</div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search features..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={complexityFilter} onValueChange={setComplexityFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Complexity</SelectItem>
                <SelectItem value="low">Low (≤30)</SelectItem>
                <SelectItem value="medium">Medium (31-70)</SelectItem>
                <SelectItem value="high">High ({'>'}70)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              Showing {filteredAndSortedFeatures.length} of {features.length} features
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              {(['name', 'status', 'complexity', 'independence', 'updated'] as const).map((option) => (
                <Button
                  key={option}
                  variant={sortBy === option ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleSort(option)}
                  className="capitalize"
                >
                  {option}
                  {sortBy === option && (
                    <ArrowUpDown className={cn(
                      "h-3 w-3 ml-1",
                      sortOrder === 'desc' && "rotate-180"
                    )} />
                  )}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Matrix */}
      <AnimatePresence mode="wait">
        {filteredAndSortedFeatures.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2">No features found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' || complexityFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Add features to track their implementation progress'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="matrix"
            className={cn(
              "space-y-4",
              viewMode === 'grid' && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            )}
            variants={dashboardVariants.container}
            initial="hidden"
            animate="show"
          >
            {filteredAndSortedFeatures.map((feature, index) => {
              const statusConfig = getStatusConfig(feature.status);
              const StatusIcon = statusConfig.icon;
              const complexityScore = feature.complexity_score || 0;
              const independenceScore = feature.independence_score || 0;

              return (
                <motion.div
                  key={feature.id || index}
                  variants={dashboardVariants.item}
                  layout
                >
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-md",
                      statusConfig.bgColor
                    )}
                    onClick={() => onFeatureClick?.(feature)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{feature.name}</CardTitle>
                          {feature.description && (
                            <CardDescription className="line-clamp-2">
                              {feature.description}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Progress</span>
                          <span className="text-sm text-muted-foreground">
                            {statusConfig.progress}%
                          </span>
                        </div>
                        <Progress value={statusConfig.progress} className="h-2" />
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="text-center">
                                <div className={cn('text-lg font-bold', getComplexityColor(complexityScore))}>
                                  {complexityScore.toFixed(0)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {getComplexityLabel(complexityScore)}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Complexity Score: {complexityScore.toFixed(1)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="text-center">
                                <div className={cn('text-lg font-bold', getIndependenceColor(independenceScore))}>
                                  {independenceScore.toFixed(0)}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Independence
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Independence Score: {independenceScore.toFixed(1)}%</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Dependencies Info */}
                      {feature.dependencies && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Dependencies:</div>
                          <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                            {JSON.parse(feature.dependencies).slice(0, 2).join(', ')}
                            {JSON.parse(feature.dependencies).length > 2 && ' ...'}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(feature.updated_at)}
                        </div>
                        {feature.file_paths && (
                          <div className="flex items-center">
                            <Code className="h-3 w-3 mr-1" />
                            {JSON.parse(feature.file_paths).length} files
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
              const count = stats.statusCounts[key] || 0;
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const StatusIcon = config.icon;

              return (
                <div key={key} className="text-center">
                  <div className={cn('p-4 rounded-lg border-2', config.bgColor)}>
                    <StatusIcon className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">{config.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </TooltipProvider>
  );
};

export default FeatureStatusMatrix;