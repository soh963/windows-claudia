import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle,
  Shield,
  XCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertCircle,
  Code,
  Database,
  Server,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskItem } from '@/lib/api';

interface RiskAssessmentProps {
  risks: RiskItem[];
  compact?: boolean;
  loading?: boolean;
}

const RiskAssessment: React.FC<RiskAssessmentProps> = ({ 
  risks,
  compact = false,
  loading = false 
}) => {
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved': return 'bg-green-500 text-white';
      case 'mitigating': return 'bg-blue-500 text-white';
      case 'acknowledged': return 'bg-yellow-500 text-black';
      case 'open': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'mitigating': return <Clock className="h-4 w-4" />;
      case 'acknowledged': return <AlertCircle className="h-4 w-4" />;
      case 'open': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'security': return <Lock className="h-4 w-4" />;
      case 'performance': return <TrendingUp className="h-4 w-4" />;
      case 'reliability': return <Shield className="h-4 w-4" />;
      case 'technical': return <Code className="h-4 w-4" />;
      case 'data': return <Database className="h-4 w-4" />;
      case 'infrastructure': return <Server className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getRiskScore = (risk: RiskItem) => {
    const impactScore = risk.impact_score || 50;
    const probability = risk.probability || 0.5;
    return impactScore * probability;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(compact ? 2 : 4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-5 bg-gray-300 rounded w-32"></div>
              <div className="h-4 bg-gray-300 rounded w-48"></div>
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (risks.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <Shield className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">No risks identified</p>
            <p className="text-xs text-muted-foreground">Your project looks secure</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate risk statistics
  const risksBySeverity = risks.reduce((acc, risk) => {
    acc[risk.severity] = (acc[risk.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const risksByCategory = risks.reduce((acc, risk) => {
    acc[risk.category] = (acc[risk.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const openRisks = risks.filter(r => r.status !== 'resolved');
  const criticalRisks = risks.filter(r => r.severity === 'critical');
  const highRisks = risks.filter(r => r.severity === 'high');
  
  const averageRiskScore = risks.length > 0 
    ? risks.reduce((sum, risk) => sum + getRiskScore(risk), 0) / risks.length 
    : 0;

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{openRisks.length}</div>
            <div className="text-sm text-muted-foreground">Open Risks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{criticalRisks.length}</div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{highRisks.length}</div>
            <div className="text-sm text-muted-foreground">High</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{averageRiskScore.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg Score</div>
          </div>
        </div>

        {/* Top Risks */}
        <div className="space-y-2">
          {risks
            .filter(risk => risk.status !== 'resolved')
            .sort((a, b) => getRiskScore(b) - getRiskScore(a))
            .slice(0, 3)
            .map((risk) => (
              <div key={risk.id} className="flex items-center space-x-3 p-3 border rounded">
                <div className="flex-shrink-0">
                  {getCategoryIcon(risk.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium truncate">{risk.title}</h4>
                    <Badge className={getSeverityColor(risk.severity)}>
                      {risk.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{risk.description}</p>
                </div>
                <div className="flex-shrink-0">
                  <Badge className={getStatusColor(risk.status)}>
                    {getStatusIcon(risk.status)}
                  </Badge>
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Risk Assessment Overview
          </CardTitle>
          <CardDescription>
            Current project risks and mitigation status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 mb-1">{openRisks.length}</div>
              <div className="text-sm text-muted-foreground mb-2">Open Risks</div>
              <Progress 
                value={openRisks.length > 0 ? (openRisks.length / risks.length) * 100 : 0} 
                className="h-2" 
              />
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-1">{criticalRisks.length}</div>
              <div className="text-sm text-muted-foreground mb-2">Critical</div>
              <Progress 
                value={criticalRisks.length > 0 ? (criticalRisks.length / risks.length) * 100 : 0} 
                className="h-2" 
              />
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">{averageRiskScore.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground mb-2">Avg Risk Score</div>
              <Progress value={averageRiskScore} className="h-2" />
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {risks.filter(r => r.status === 'resolved').length}
              </div>
              <div className="text-sm text-muted-foreground mb-2">Resolved</div>
              <Progress 
                value={risks.length > 0 ? (risks.filter(r => r.status === 'resolved').length / risks.length) * 100 : 0} 
                className="h-2" 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>By Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(risksBySeverity)
                .sort(([,a], [,b]) => b - a)
                .map(([severity, count]) => (
                  <div key={severity} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge className={getSeverityColor(severity)}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={cn('font-medium', getSeverityTextColor(severity))}>
                        {count}
                      </span>
                      <div className="w-20">
                        <Progress value={(count / risks.length) * 100} className="h-2" />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(risksByCategory)
                .sort(([,a], [,b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(category)}
                      <span className="font-medium">
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{count}</span>
                      <div className="w-20">
                        <Progress value={(count / risks.length) * 100} className="h-2" />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk List */}
      <div className="space-y-4">
        {risks
          .sort((a, b) => {
            // Sort by status (open first), then by risk score
            if (a.status !== b.status) {
              if (a.status === 'open') return -1;
              if (b.status === 'open') return 1;
            }
            return getRiskScore(b) - getRiskScore(a);
          })
          .map((risk) => {
            const riskScore = getRiskScore(risk);
            const filePaths = risk.file_paths ? JSON.parse(risk.file_paths) : [];
            
            return (
              <Card key={risk.id} className={cn(
                "hover:shadow-md transition-shadow",
                risk.severity === 'critical' && "border-red-200",
                risk.severity === 'high' && "border-orange-200"
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {getCategoryIcon(risk.category)}
                      <div>
                        <CardTitle className="text-lg">{risk.title}</CardTitle>
                        <CardDescription>{risk.category} • Risk Score: {riskScore.toFixed(1)}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getSeverityColor(risk.severity)}>
                        {risk.severity}
                      </Badge>
                      <Badge className={getStatusColor(risk.status)}>
                        {getStatusIcon(risk.status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{risk.description}</p>

                  {/* Risk Metrics */}
                  {(risk.impact_score || risk.probability) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {risk.impact_score && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Impact Score</span>
                            <span className="text-sm font-bold">{risk.impact_score}</span>
                          </div>
                          <Progress value={risk.impact_score} className="h-2" />
                        </div>
                      )}
                      {risk.probability && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Probability</span>
                            <span className="text-sm font-bold">{(risk.probability * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={risk.probability * 100} className="h-2" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mitigation */}
                  {risk.mitigation && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Shield className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="text-sm font-medium">Mitigation Strategy</span>
                      </div>
                      <p className="text-sm text-blue-700">{risk.mitigation}</p>
                    </div>
                  )}

                  {/* File Paths */}
                  {filePaths.length > 0 && (
                    <div>
                      <div className="flex items-center mb-2">
                        <Code className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">Affected Files</span>
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
                    <span>Detected: {formatDate(risk.detected_at)}</span>
                    {risk.resolved_at && (
                      <span>Resolved: {formatDate(risk.resolved_at)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
};

export default RiskAssessment;