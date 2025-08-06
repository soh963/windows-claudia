import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  Code,
  Users,
  Globe,
  Star,
  TrendingUp,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Search,
  Calendar,
  BarChart3,
  Target,
  ArrowUpDown,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentationStatus as DocStatus } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentationStatusProps {
  docs: DocStatus[];
  loading?: boolean;
  compact?: boolean;
  onDocUpdate?: (doc: DocStatus) => void;
  onRefresh?: () => void;
  showFilters?: boolean;
}

// Filter and sort options
interface DocFilters {
  docType?: string;
  completionRange?: string;
  qualityRange?: string;
}

type SortOption = 'completion-desc' | 'completion-asc' | 'quality-desc' | 'quality-asc' | 'updated-desc' | 'updated-asc';

const DocumentationStatus: React.FC<DocumentationStatusProps> = ({ 
  docs = [],
  loading = false,
  compact = false,
  onDocUpdate,
  onRefresh,
  showFilters = true
}) => {
  const [filters, setFilters] = useState<DocFilters>({});
  const [sortBy, setSortBy] = useState<SortOption>('completion-desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const getCompletionColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 55) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Fair';
    return 'Needs Work';
  };

  const getDocTypeIcon = (docType: string) => {
    switch (docType.toLowerCase()) {
      case 'readme': return <BookOpen className="h-4 w-4" />;
      case 'api': return <Code className="h-4 w-4" />;
      case 'user_guide': return <Users className="h-4 w-4" />;
      case 'developer': return <Code className="h-4 w-4" />;
      case 'deployment': return <Globe className="h-4 w-4" />;
      case 'changelog': return <TrendingUp className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getDocTypeColor = (docType: string) => {
    switch (docType.toLowerCase()) {
      case 'readme': return 'text-blue-500';
      case 'api': return 'text-purple-500';
      case 'user_guide': return 'text-green-500';
      case 'developer': return 'text-orange-500';
      case 'deployment': return 'text-red-500';
      case 'changelog': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-300 rounded w-32"></div>
              <div className="h-4 bg-gray-300 rounded w-48"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 bg-gray-300 rounded w-24"></div>
                <div className="h-2 bg-gray-300 rounded w-full"></div>
                <div className="h-4 bg-gray-300 rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Filter and sort documents
  const filteredAndSortedDocs = useMemo(() => {
    let filtered = docs.filter(doc => {
      if (filters.docType && doc.doc_type !== filters.docType) return false;
      if (filters.completionRange) {
        const completion = doc.completion_percentage || 0;
        switch (filters.completionRange) {
          case 'high': return completion >= 80;
          case 'medium': return completion >= 50 && completion < 80;
          case 'low': return completion < 50;
        }
      }
      if (filters.qualityRange) {
        const quality = doc.quality_score || 0;
        switch (filters.qualityRange) {
          case 'excellent': return quality >= 85;
          case 'good': return quality >= 70 && quality < 85;
          case 'fair': return quality >= 55 && quality < 70;
          case 'poor': return quality < 55;
        }
      }
      return true;
    });

    // Sort documents
    filtered.sort((a, b) => {
      const aCompletion = a.completion_percentage || 0;
      const bCompletion = b.completion_percentage || 0;
      const aQuality = a.quality_score || 0;
      const bQuality = b.quality_score || 0;
      const aUpdated = a.last_updated;
      const bUpdated = b.last_updated;

      switch (sortBy) {
        case 'completion-desc': return bCompletion - aCompletion;
        case 'completion-asc': return aCompletion - bCompletion;
        case 'quality-desc': return bQuality - aQuality;
        case 'quality-asc': return aQuality - bQuality;
        case 'updated-desc': return bUpdated - aUpdated;
        case 'updated-asc': return aUpdated - bUpdated;
        default: return bCompletion - aCompletion;
      }
    });

    return filtered;
  }, [docs, filters, sortBy]);

  if (docs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground">No documentation tracked</p>
            <p className="text-xs text-muted-foreground">Start documenting your project</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall documentation metrics
  const totalSections = docs.reduce((sum, doc) => sum + (doc.total_sections || 0), 0);
  const completedSections = docs.reduce((sum, doc) => sum + (doc.completed_sections || 0), 0);
  const overallCompletion = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;
  const averageQuality = docs.length > 0 
    ? docs.reduce((sum, doc) => sum + (doc.quality_score || 0), 0) / docs.length 
    : 0;

  // Group docs by completion status
  const completeDocsCount = docs.filter(doc => (doc.completion_percentage || 0) >= 90).length;
  const incompleteDocsCount = docs.filter(doc => (doc.completion_percentage || 0) < 90).length;
  const poorQualityDocsCount = docs.filter(doc => (doc.quality_score || 0) < 70).length;

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Compact Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div 
            className="text-center p-3 bg-blue-50 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="text-2xl font-bold text-blue-600">{overallCompletion.toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Overall Completion</div>
          </motion.div>
          <motion.div 
            className="text-center p-3 bg-green-50 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="text-2xl font-bold text-green-600">{averageQuality.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg Quality</div>
          </motion.div>
          <motion.div 
            className="text-center p-3 bg-purple-50 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="text-2xl font-bold text-purple-600">{completeDocsCount}</div>
            <div className="text-sm text-muted-foreground">Complete Docs</div>
          </motion.div>
          <motion.div 
            className="text-center p-3 bg-red-50 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="text-2xl font-bold text-red-600">{incompleteDocsCount}</div>
            <div className="text-sm text-muted-foreground">Need Attention</div>
          </motion.div>
        </div>

        {/* Top Documentation Issues */}
        <div className="space-y-2">
          <AnimatePresence>
            {filteredAndSortedDocs
              .filter(doc => (doc.completion_percentage || 0) < 90 || (doc.quality_score || 0) < 70)
              .slice(0, 3)
              .map((doc, index) => {
                const completionPercentage = doc.completion_percentage || 0;
                const qualityScore = doc.quality_score || 0;
                const priority = completionPercentage < 50 || qualityScore < 55 ? 'high' : 'medium';
                
                return (
                  <motion.div 
                    key={doc.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:shadow-md transition-all cursor-pointer"
                    onClick={() => onDocUpdate?.(doc)}
                  >
                    <div className="flex-shrink-0">
                      <div className={cn(
                        "p-2 rounded-full",
                        getDocTypeColor(doc.doc_type).replace('text-', 'bg-') + '-100'
                      )}>
                        {getDocTypeIcon(doc.doc_type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium truncate">
                          {doc.doc_type.charAt(0).toUpperCase() + 
                           doc.doc_type.slice(1).replace('_', ' ')} Documentation
                        </h4>
                        <Badge variant={priority === 'high' ? 'destructive' : 'secondary'}>
                          {priority === 'high' ? 'Urgent' : 'Review'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>Completion: {completionPercentage.toFixed(1)}%</span>
                        <span>Quality: {qualityScore.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {completionPercentage >= 90 && qualityScore >= 85 ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : completionPercentage >= 50 ? (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setViewMode('list')}>
            <Eye className="h-4 w-4 mr-2" />
            View All
          </Button>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <FileText className="h-6 w-6 mr-2" />
            Documentation Status
          </h2>
          <p className="text-muted-foreground">
            Track documentation completeness and quality across your project
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {showFilters && (
            <>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-40">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completion-desc">Completion ↓</SelectItem>
                  <SelectItem value="completion-asc">Completion ↑</SelectItem>
                  <SelectItem value="quality-desc">Quality ↓</SelectItem>
                  <SelectItem value="quality-asc">Quality ↑</SelectItem>
                  <SelectItem value="updated-desc">Recently Updated</SelectItem>
                  <SelectItem value="updated-asc">Oldest Updated</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                {viewMode === 'grid' ? 'List' : 'Grid'}
              </Button>
            </>
          )}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <Select value={filters.docType || ''} onValueChange={(value) => setFilters(prev => ({ ...prev, docType: value || undefined }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="readme">README</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="user_guide">User Guide</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="deployment">Deployment</SelectItem>
                  <SelectItem value="changelog">Changelog</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.completionRange || ''} onValueChange={(value) => setFilters(prev => ({ ...prev, completionRange: value || undefined }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Completion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Levels</SelectItem>
                  <SelectItem value="high">80-100%</SelectItem>
                  <SelectItem value="medium">50-79%</SelectItem>
                  <SelectItem value="low">&lt;50%</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.qualityRange || ''} onValueChange={(value) => setFilters(prev => ({ ...prev, qualityRange: value || undefined }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Quality</SelectItem>
                  <SelectItem value="excellent">Excellent (85+)</SelectItem>
                  <SelectItem value="good">Good (70-84)</SelectItem>
                  <SelectItem value="fair">Fair (55-69)</SelectItem>
                  <SelectItem value="poor">Poor (&lt;55)</SelectItem>
                </SelectContent>
              </Select>
              {(filters.docType || filters.completionRange || filters.qualityRange) && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Documentation Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Documentation Status Overview
          </CardTitle>
          <CardDescription>
            Comprehensive view of project documentation health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-3xl font-bold mb-1 ${getCompletionColor(overallCompletion)}`}>
                {overallCompletion.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground mb-2">Overall Completion</div>
              <Progress value={overallCompletion} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {completedSections} / {totalSections} sections
              </div>
            </div>

            <div className="text-center">
              <div className={`text-3xl font-bold mb-1 ${getQualityColor(averageQuality)}`}>
                {averageQuality.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground mb-2">Avg Quality</div>
              <Progress value={averageQuality} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {getQualityLabel(averageQuality)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold mb-1 text-green-600">{completeDocsCount}</div>
              <div className="text-sm text-muted-foreground mb-2">Complete Docs</div>
              <Progress value={docs.length > 0 ? (completeDocsCount / docs.length) * 100 : 0} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                ≥90% complete
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold mb-1 text-red-600">{incompleteDocsCount}</div>
              <div className="text-sm text-muted-foreground mb-2">Need Attention</div>
              <Progress value={docs.length > 0 ? (incompleteDocsCount / docs.length) * 100 : 0} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                &lt;90% complete
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation List */}
      <div className={cn(
        "space-y-4",
        viewMode === 'grid' && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 space-y-0"
      )}>
        <AnimatePresence>
          {filteredAndSortedDocs.map((doc, index) => {
            const completionPercentage = doc.completion_percentage || 0;
            const qualityScore = doc.quality_score || 0;
            const missingSections = doc.missing_sections ? 
              (typeof doc.missing_sections === 'string' ? 
                (() => {
                  try {
                    return JSON.parse(doc.missing_sections);
                  } catch {
                    return doc.missing_sections.split(',').map(s => s.trim());
                  }
                })() : 
                doc.missing_sections
              ) : [];
            const filePaths = doc.file_paths ? 
              (typeof doc.file_paths === 'string' ? 
                (() => {
                  try {
                    return JSON.parse(doc.file_paths);
                  } catch {
                    return doc.file_paths.split(',').map(s => s.trim());
                  }
                })() : 
                doc.file_paths
              ) : [];
            
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  viewMode === 'grid' ? "" : "w-full"
                )}
              >
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={getDocTypeColor(doc.doc_type)}>
                          {getDocTypeIcon(doc.doc_type)}
                        </div>
                        <div>
                          <CardTitle className={cn(
                            viewMode === 'grid' ? "text-base" : "text-lg"
                          )}>
                            {doc.doc_type.charAt(0).toUpperCase() + 
                             doc.doc_type.slice(1).replace('_', ' ')} Documentation
                          </CardTitle>
                          <CardDescription>
                            {doc.completed_sections || 0} of {doc.total_sections || 0} sections complete
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {completionPercentage >= 90 ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : completionPercentage >= 50 ? (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        {onDocUpdate && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => onDocUpdate(doc)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                <CardContent className="space-y-4">
                  {/* Completion and Quality Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Completion</span>
                        <span className={cn('text-sm font-bold', getCompletionColor(completionPercentage))}>
                          {completionPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={completionPercentage} className="h-2 mb-1" />
                      <div className="text-xs text-muted-foreground">
                        {doc.completed_sections || 0} / {doc.total_sections || 0} sections
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Quality Score</span>
                        <span className={cn('text-sm font-bold', getQualityColor(qualityScore))}>
                          {qualityScore.toFixed(1)}
                        </span>
                      </div>
                      <Progress value={qualityScore} className="h-2 mb-1" />
                      <div className="text-xs text-muted-foreground">
                        {getQualityLabel(qualityScore)}
                      </div>
                    </div>
                  </div>

                  {/* Missing Sections */}
                  {missingSections.length > 0 && (
                    <div>
                      <div className="flex items-center mb-2">
                        <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />
                        <span className="text-sm font-medium">Missing Sections ({missingSections.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {missingSections.slice(0, 5).map((section: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {section}
                          </Badge>
                        ))}
                        {missingSections.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{missingSections.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Paths */}
                  {filePaths.length > 0 && (
                    <div>
                      <div className="flex items-center mb-2">
                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">Documentation Files ({filePaths.length})</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {filePaths.slice(0, 3).map((path: string, idx: number) => (
                          <div key={idx} className="font-mono">{path}</div>
                        ))}
                        {filePaths.length > 3 && (
                          <div className="text-muted-foreground">+{filePaths.length - 3} more files</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-3 w-3" />
                      <span>Updated: {formatDate(doc.last_updated)}</span>
                    </div>
                    {qualityScore >= 85 && completionPercentage >= 90 && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <Star className="h-3 w-3" />
                        <span>Excellent</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Documentation Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Documentation Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {overallCompletion < 70 && (
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Documentation Incomplete</p>
                  <p className="text-xs text-muted-foreground">
                    Overall completion is {overallCompletion.toFixed(1)}%. Focus on completing core documentation first.
                  </p>
                </div>
              </div>
            )}
            
            {poorQualityDocsCount > 0 && (
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Quality Needs Improvement</p>
                  <p className="text-xs text-muted-foreground">
                    {poorQualityDocsCount} document(s) have quality scores below 70. Consider reviewing and enhancing them.
                  </p>
                </div>
              </div>
            )}
            
            {averageQuality >= 80 && overallCompletion >= 85 && (
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Excellent Documentation</p>
                  <p className="text-xs text-muted-foreground">
                    Your documentation is comprehensive and high-quality. Great work!
                  </p>
                </div>
              </div>
            )}
            
            {docs.filter(d => d.doc_type === 'readme').length === 0 && (
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Missing README</p>
                  <p className="text-xs text-muted-foreground">
                    Consider creating a README file to help users understand your project.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentationStatus;