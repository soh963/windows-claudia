import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle,
  Shield,
  XCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Code,
  Database,
  Server,
  Lock,
  Activity,
  BarChart3,
  Filter,
  Target,
  Zap,
  Globe,
  Users,
  DollarSign,
  Gauge,
  RefreshCw,
  Eye,
  Edit,
  Archive,
  History,
  LineChart,
  PieChart,
  Calendar,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskItem } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

// Extended risk categories with enhanced metadata
interface ExtendedRiskCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  priority: number;
}

// Risk trend data for historical analysis
interface RiskTrend {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
}

// Risk matrix cell data
interface RiskMatrixCell {
  likelihood: number;
  impact: number;
  count: number;
  risks: RiskItem[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Filter options
interface RiskFilters {
  category?: string;
  severity?: string;
  status?: string;
  dateRange?: string;
}

interface RiskAssessmentProps {
  risks: RiskItem[];
  compact?: boolean;
  loading?: boolean;
  onRiskUpdate?: (risk: RiskItem) => void;
  onRefresh?: () => void;
  realTimeUpdates?: boolean;
}

const RiskAssessment: React.FC<RiskAssessmentProps> = ({ 
  risks = [],
  compact = false,
  loading = false,
  onRiskUpdate,
  onRefresh,
  realTimeUpdates = false
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<RiskFilters>({});
  const [selectedRisk, setSelectedRisk] = useState<RiskItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'matrix' | 'trends'>('list');
  const [autoRefresh, setAutoRefresh] = useState(realTimeUpdates);

  // Enhanced risk categories
  const riskCategories: ExtendedRiskCategory[] = [
    { id: 'security', name: 'Security', icon: Lock, color: 'red', description: 'Security vulnerabilities and threats', priority: 1 },
    { id: 'performance', name: 'Performance', icon: Zap, color: 'orange', description: 'Performance bottlenecks and optimization', priority: 2 },
    { id: 'reliability', name: 'Reliability', icon: Shield, color: 'blue', description: 'System reliability and uptime', priority: 3 },
    { id: 'technical', name: 'Technical Debt', icon: Code, color: 'yellow', description: 'Technical debt and code quality', priority: 4 },
    { id: 'data', name: 'Data Integrity', icon: Database, color: 'purple', description: 'Data consistency and integrity', priority: 5 },
    { id: 'infrastructure', name: 'Infrastructure', icon: Server, color: 'green', description: 'Infrastructure and deployment', priority: 6 },
    { id: 'business', name: 'Business Impact', icon: DollarSign, color: 'indigo', description: 'Business continuity and impact', priority: 7 },
    { id: 'compliance', name: 'Compliance', icon: Globe, color: 'teal', description: 'Regulatory and compliance risks', priority: 8 },
    { id: 'operational', name: 'Operational', icon: Activity, color: 'pink', description: 'Operational and process risks', priority: 9 },
    { id: 'external', name: 'External Dependencies', icon: Users, color: 'gray', description: 'Third-party and external risks', priority: 10 }
  ];

  // Generate mock trend data (in production, this would come from the API)
  const generateTrendData = (): RiskTrend[] => {
    const trends: RiskTrend[] = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Generate realistic trend data based on current risks
      const total = Math.max(0, risks.length + Math.floor(Math.random() * 10) - 5);
      const critical = Math.floor(total * 0.1);
      const high = Math.floor(total * 0.2);
      const medium = Math.floor(total * 0.4);
      const low = total - critical - high - medium;
      const resolved = Math.floor(Math.random() * 5);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        total,
        critical,
        high,
        medium,
        low,
        resolved
      });
    }
    
    return trends;
  };

  const [trendData] = useState<RiskTrend[]>(() => generateTrendData());

  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;
    
    const interval = setInterval(() => {
      onRefresh();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  // Calculate risk statistics
  const riskStats = useMemo(() => {
    return {
      open: risks.filter(r => r.status !== 'resolved').length,
      resolved: risks.filter(r => r.status === 'resolved').length,
      critical: risks.filter(r => r.severity === 'critical').length,
      high: risks.filter(r => r.severity === 'high').length,
      medium: risks.filter(r => r.severity === 'medium').length,
      low: risks.filter(r => r.severity === 'low').length
    };
  }, [risks]);

  // Filter risks based on current filters
  const filteredRisks = useMemo(() => {
    return risks.filter(risk => {
      if (filters.category && risk.category !== filters.category) return false;
      if (filters.severity && risk.severity !== filters.severity) return false;
      if (filters.status && risk.status !== filters.status) return false;
      return true;
    });
  }, [risks, filters]);

  // Generate risk matrix data
  const riskMatrix = useMemo(() => {
    const matrix: RiskMatrixCell[][] = [];
    
    // Create 5x5 matrix (likelihood vs impact)
    for (let likelihood = 5; likelihood >= 1; likelihood--) {
      const row: RiskMatrixCell[] = [];
      for (let impact = 1; impact <= 5; impact++) {
        const cellRisks = risks.filter(risk => {
          const riskLikelihood = Math.ceil((risk.probability || 0.5) * 5);
          const riskImpact = Math.ceil((risk.impact_score || 50) / 20);
          return riskLikelihood === likelihood && riskImpact === impact;
        });
        
        // Determine severity based on likelihood * impact
        const score = likelihood * impact;
        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (score >= 20) severity = 'critical';
        else if (score >= 15) severity = 'high';
        else if (score >= 8) severity = 'medium';
        else severity = 'low';
        
        row.push({
          likelihood,
          impact,
          count: cellRisks.length,
          risks: cellRisks,
          severity
        });
      }
      matrix.push(row);
    }
    
    return matrix;
  }, [risks]);

  // Helper function to get category color
  const getCategoryColor = (category: string) => {
    const categoryData = riskCategories.find(cat => cat.id === category.toLowerCase());
    return categoryData?.color || 'gray';
  };

  // Helper function to format relative date
  const formatDateRelative = (timestamp: number) => {
    const now = Date.now();
    const diff = now - (timestamp * 1000);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

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

  // Render Risk Matrix Component
  const renderRiskMatrix = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Risk Matrix - Likelihood vs Impact
        </CardTitle>
        <CardDescription>
          Visual representation of risks plotted by probability and impact
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Matrix Labels */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Impact →</span>
            <div className="flex space-x-8">
              <span>Very Low</span>
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Very High</span>
            </div>
          </div>
          
          {/* Risk Matrix Grid */}
          <div className="grid grid-cols-6 gap-1">
            {/* Y-axis label */}
            <div className="flex flex-col items-center justify-center text-sm text-muted-foreground">
              <span className="transform -rotate-90 whitespace-nowrap">Likelihood</span>
            </div>
            
            {/* Matrix cells */}
            {riskMatrix.map((row, rowIndex) => (
              <React.Fragment key={rowIndex}>
                {row.map((cell, colIndex) => {
                  const bgColor = {
                    low: 'bg-green-100 hover:bg-green-200 border-green-300',
                    medium: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300',
                    high: 'bg-orange-100 hover:bg-orange-200 border-orange-300',
                    critical: 'bg-red-100 hover:bg-red-200 border-red-300'
                  }[cell.severity];
                  
                  return (
                    <motion.div
                      key={`${rowIndex}-${colIndex}`}
                      className={cn(
                        "aspect-square border-2 rounded-lg flex items-center justify-center cursor-pointer transition-all",
                        bgColor,
                        cell.count > 0 && "shadow-sm"
                      )}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title={`${cell.count} risks - Likelihood: ${cell.likelihood}/5, Impact: ${cell.impact}/5`}
                      onClick={() => {
                        if (cell.count > 0 && cell.risks.length > 0) {
                          setSelectedRisk(cell.risks[0]);
                        }
                      }}
                    >
                      <div className="text-center">
                        {cell.count > 0 && (
                          <>
                            <div className="text-lg font-bold">{cell.count}</div>
                            <div className="text-xs opacity-75">risks</div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-200 border border-green-300 rounded"></div>
              <span>Low Risk</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-200 border border-yellow-300 rounded"></div>
              <span>Medium Risk</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-200 border border-orange-300 rounded"></div>
              <span>High Risk</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-200 border border-red-300 rounded"></div>
              <span>Critical Risk</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render Trends Component
  const renderTrends = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <LineChart className="h-5 w-5 mr-2" />
          Risk Trends - Last 30 Days
        </CardTitle>
        <CardDescription>
          Historical risk analysis and trend patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Trend Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-800">
                {trendData[trendData.length - 1]?.total || 0}
              </div>
              <div className="text-sm text-muted-foreground">Current Total</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {trendData[trendData.length - 1]?.critical || 0}
              </div>
              <div className="text-sm text-muted-foreground">Critical Now</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {trendData.reduce((sum, day) => sum + day.resolved, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Resolved (30d)</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(trendData.reduce((sum, day) => sum + day.total, 0) / trendData.length)}
              </div>
              <div className="text-sm text-muted-foreground">Daily Average</div>
            </div>
          </div>
          
          {/* Simple trend visualization */}
          <div className="h-64 flex items-end space-x-1 bg-gray-50 p-4 rounded-lg">
            {trendData.slice(-14).map((day, index) => {
              const maxHeight = Math.max(...trendData.map(d => d.total));
              const height = maxHeight > 0 ? (day.total / maxHeight) * 200 : 0;
              
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center"
                >
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                    style={{ height: `${height}px` }}
                    title={`${day.date}: ${day.total} risks`}
                  ></div>
                  <div className="text-xs text-muted-foreground mt-1 transform -rotate-45">
                    {new Date(day.date).getDate()}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Trend insights */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Trend Insights
            </h4>
            <div className="text-sm space-y-1">
              <p>• Average daily risk count: {Math.round(trendData.reduce((sum, day) => sum + day.total, 0) / trendData.length)}</p>
              <p>• Peak risk day: {trendData.reduce((max, day) => day.total > max.total ? day : max, trendData[0])?.date}</p>
              <p>• Total resolved in 30 days: {trendData.reduce((sum, day) => sum + day.resolved, 0)}</p>
              <p>• Current critical risk trend: {trendData[trendData.length - 1]?.critical > trendData[trendData.length - 7]?.critical ? 'Increasing' : 'Stable/Decreasing'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Enhanced Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div 
            className="text-center p-3 bg-red-50 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="text-2xl font-bold text-red-600">{riskStats.open}</div>
            <div className="text-sm text-muted-foreground">Open Risks</div>
            <div className="flex items-center justify-center mt-1">
              {riskStats.open > riskStats.resolved ? (
                <TrendingUp className="h-3 w-3 text-red-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-green-500" />
              )}
            </div>
          </motion.div>
          <motion.div 
            className="text-center p-3 bg-orange-50 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="text-2xl font-bold text-orange-600">{riskStats.critical}</div>
            <div className="text-sm text-muted-foreground">Critical</div>
            <div className="text-xs text-orange-600 mt-1">Immediate Action</div>
          </motion.div>
          <motion.div 
            className="text-center p-3 bg-yellow-50 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="text-2xl font-bold text-yellow-600">{riskStats.high}</div>
            <div className="text-sm text-muted-foreground">High Priority</div>
            <div className="text-xs text-yellow-600 mt-1">Review Soon</div>
          </motion.div>
          <motion.div 
            className="text-center p-3 bg-blue-50 rounded-lg"
            whileHover={{ scale: 1.02 }}
          >
            <div className="text-2xl font-bold text-blue-600">{averageRiskScore.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Avg Score</div>
            <div className="flex items-center justify-center mt-1">
              <Gauge className="h-3 w-3 text-blue-500" />
            </div>
          </motion.div>
        </div>

        {/* Top Risks with Enhanced UI */}
        <div className="space-y-2">
          <AnimatePresence>
            {filteredRisks
              .filter(risk => risk.status !== 'resolved')
              .sort((a, b) => getRiskScore(b) - getRiskScore(a))
              .slice(0, 3)
              .map((risk, index) => (
                <motion.div 
                  key={risk.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedRisk(risk)}
                >
                  <div className="flex-shrink-0">
                    <div className={cn(
                      "p-2 rounded-full",
                      `bg-${getCategoryColor(risk.category)}-100`
                    )}>
                      {getCategoryIcon(risk.category)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium truncate">{risk.title}</h4>
                      <Badge className={getSeverityColor(risk.severity)}>
                        {risk.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{risk.description}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      Risk Score: {getRiskScore(risk).toFixed(1)} • {formatDateRelative(risk.detected_at)}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center space-x-2">
                    <Badge className={getStatusColor(risk.status)}>
                      {getStatusIcon(risk.status)}
                    </Badge>
                    {realTimeUpdates && (
                      <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" title="Live updates" />
                    )}
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setViewMode('matrix')}>
            <Target className="h-4 w-4 mr-2" />
            View Matrix
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewMode('trends')}>
            <LineChart className="h-4 w-4 mr-2" />
            View Trends
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <AlertTriangle className="h-6 w-6 mr-2" />
            Risk Assessment
          </h2>
          <p className="text-muted-foreground">
            Comprehensive risk analysis and mitigation tracking
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">List View</SelectItem>
              <SelectItem value="matrix">Risk Matrix</SelectItem>
              <SelectItem value="trends">Trends</SelectItem>
            </SelectContent>
          </Select>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
        </div>
      </div>

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

      {/* View Mode Content */}
      {viewMode === 'matrix' && renderRiskMatrix()}
      {viewMode === 'trends' && renderTrends()}
      
      {viewMode === 'list' && (
        <>
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
                const filePaths = risk.file_paths ? (() => {
                  try {
                    return JSON.parse(risk.file_paths);
                  } catch {
                    return [];
                  }
                })() : [];
                
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
        </>
      )}
    </div>
  );
};

export default RiskAssessment;