import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Package,
  GitBranch,
  Link,
  Unlink,
  AlertTriangle,
  CheckCircle,
  Code,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeatureItem } from '@/lib/api';

interface FeatureIndependenceProps {
  features: FeatureItem[];
  loading?: boolean;
}

const FeatureIndependence: React.FC<FeatureIndependenceProps> = ({ 
  features, 
  loading = false 
}) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-500 text-white';
      case 'in_progress': return 'bg-blue-500 text-white';
      case 'pending': return 'bg-yellow-500 text-black';
      case 'blocked': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getIndependenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getIndependenceLabel = (score: number) => {
    if (score >= 80) return 'Highly Independent';
    if (score >= 60) return 'Moderately Independent';
    if (score >= 40) return 'Some Dependencies';
    return 'Highly Dependent';
  };

  const getComplexityColor = (score: number) => {
    if (score <= 30) return 'text-green-600';
    if (score <= 50) return 'text-blue-600';
    if (score <= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplexityLabel = (score: number) => {
    if (score <= 30) return 'Simple';
    if (score <= 50) return 'Moderate';
    if (score <= 70) return 'Complex';
    return 'Very Complex';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
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

  if (features.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground">No features tracked</p>
            <p className="text-xs text-muted-foreground">Add features to analyze independence</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall independence score
  const avgIndependence = features.reduce((sum, f) => sum + (f.independence_score || 0), 0) / features.length;
  const avgComplexity = features.reduce((sum, f) => sum + (f.complexity_score || 0), 0) / features.length;
  
  // Count features by status
  const statusCounts = features.reduce((acc, feature) => {
    acc[feature.status] = (acc[feature.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <GitBranch className="h-5 w-5 mr-2" />
            Feature Independence Analysis
          </CardTitle>
          <CardDescription>
            Assessment of feature modularity and independence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold mb-1 ${getIndependenceColor(avgIndependence)}`}>
                {avgIndependence.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground mb-2">Avg Independence</div>
              <Progress value={avgIndependence} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {getIndependenceLabel(avgIndependence)}
              </div>
            </div>

            <div className="text-center">
              <div className={`text-2xl font-bold mb-1 ${getComplexityColor(avgComplexity)}`}>
                {avgComplexity.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground mb-2">Avg Complexity</div>
              <Progress value={avgComplexity} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {getComplexityLabel(avgComplexity)}
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold mb-1 text-blue-600">
                {features.length}
              </div>
              <div className="text-sm text-muted-foreground mb-2">Total Features</div>
              <div className="flex justify-center space-x-1">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <Badge key={status} variant="outline" className="text-xs">
                    {count} {status}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature List */}
      <div className="space-y-4">
        {features
          .sort((a, b) => (b.independence_score || 0) - (a.independence_score || 0))
          .map((feature) => {
            const independenceScore = feature.independence_score || 0;
            const complexityScore = feature.complexity_score || 0;
            const dependencies = feature.dependencies ? (() => {
              try {
                return JSON.parse(feature.dependencies);
              } catch {
                return [];
              }
            })() : [];
            const filePaths = feature.file_paths ? (() => {
              try {
                return JSON.parse(feature.file_paths);
              } catch {
                return [];
              }
            })() : [];
            
            return (
              <Card key={feature.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{feature.name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(feature.status)}>
                        {feature.status.charAt(0).toUpperCase() + feature.status.slice(1)}
                      </Badge>
                      {independenceScore >= 80 ? (
                        <Unlink className="h-4 w-4 text-green-500" />
                      ) : independenceScore < 40 ? (
                        <Link className="h-4 w-4 text-red-500" />
                      ) : (
                        <Link className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                  {feature.description && (
                    <CardDescription>{feature.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Independence and Complexity Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Independence Score</span>
                        <span className={cn('text-sm font-bold', getIndependenceColor(independenceScore))}>
                          {independenceScore.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={independenceScore} className="h-2 mb-1" />
                      <div className="text-xs text-muted-foreground">
                        {getIndependenceLabel(independenceScore)}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Complexity Score</span>
                        <span className={cn('text-sm font-bold', getComplexityColor(complexityScore))}>
                          {complexityScore.toFixed(1)}
                        </span>
                      </div>
                      <Progress value={complexityScore} className="h-2 mb-1" />
                      <div className="text-xs text-muted-foreground">
                        {getComplexityLabel(complexityScore)}
                      </div>
                    </div>
                  </div>

                  {/* Dependencies */}
                  {dependencies.length > 0 && (
                    <div>
                      <div className="flex items-center mb-2">
                        <Link className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">Dependencies ({dependencies.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {dependencies.slice(0, 5).map((dep: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                        {dependencies.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{dependencies.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Paths */}
                  {filePaths.length > 0 && (
                    <div>
                      <div className="flex items-center mb-2">
                        <Code className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">Files ({filePaths.length})</span>
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
                    <span>Created: {formatDate(feature.created_at)}</span>
                    <span>Updated: {formatDate(feature.updated_at)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Independence Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {avgIndependence < 60 && (
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Low Independence Score</p>
                  <p className="text-xs text-muted-foreground">
                    Features are highly coupled. Consider refactoring to reduce dependencies.
                  </p>
                </div>
              </div>
            )}
            
            {avgComplexity > 70 && (
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">High Complexity</p>
                  <p className="text-xs text-muted-foreground">
                    Features are complex. Consider breaking them into smaller, simpler components.
                  </p>
                </div>
              </div>
            )}
            
            {avgIndependence >= 80 && avgComplexity <= 50 && (
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Excellent Architecture</p>
                  <p className="text-xs text-muted-foreground">
                    Features are well-designed with high independence and manageable complexity.
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

export default FeatureIndependence;