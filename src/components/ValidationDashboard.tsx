import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap,
  Brain,
  Target,
  TrendingUp,
  AlertTriangle,
  Play,
  RefreshCw,
  Download,
  TestTube,
  BarChart3,
  CheckCircle2
} from 'lucide-react';
import { 
  runComprehensiveModelValidation,
  runQuickValidationTest,
  benchmarkAutoSelectionAccuracy,
  testModelFunctionality,
  generateValidationSummary,
  type ComprehensiveValidationReport,
  type ModelValidationResult
} from '@/lib/validation';
import { toast } from 'sonner';

interface ValidationDashboardProps {
  onValidationComplete?: (report: ComprehensiveValidationReport) => void;
}

const ValidationDashboard: React.FC<ValidationDashboardProps> = ({ onValidationComplete }) => {
  const [report, setReport] = useState<ComprehensiveValidationReport | null>(null);
  const [quickResults, setQuickResults] = useState<ModelValidationResult[]>([]);
  const [isRunningComprehensive, setIsRunningComprehensive] = useState(false);
  const [isRunningQuick, setIsRunningQuick] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [autoSelectionAccuracy, setAutoSelectionAccuracy] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'comprehensive' | 'quick' | 'benchmark'>('overview');

  const runComprehensiveTest = async () => {
    setIsRunningComprehensive(true);
    try {
      toast.info('Starting comprehensive model validation...', {
        description: 'This may take several minutes to complete.',
      });
      
      const validationReport = await runComprehensiveModelValidation();
      setReport(validationReport);
      onValidationComplete?.(validationReport);
      
      toast.success(`Validation completed! Success rate: ${validationReport.success_rate.toFixed(1)}%`, {
        description: `Tested ${validationReport.total_tests} scenarios across all models.`,
      });
    } catch (error) {
      toast.error('Comprehensive validation failed', {
        description: error as string,
      });
      console.error('Validation error:', error);
    } finally {
      setIsRunningComprehensive(false);
    }
  };

  const runQuickTest = async () => {
    setIsRunningQuick(true);
    try {
      toast.info('Running quick validation test...');
      
      const results = await runQuickValidationTest();
      setQuickResults(results);
      
      const successRate = (results.filter(r => r.success).length / results.length) * 100;
      toast.success(`Quick test completed! Success rate: ${successRate.toFixed(1)}%`);
    } catch (error) {
      toast.error('Quick test failed', {
        description: error as string,
      });
      console.error('Quick test error:', error);
    } finally {
      setIsRunningQuick(false);
    }
  };

  const runBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      toast.info('Benchmarking auto selection accuracy...');
      
      const accuracy = await benchmarkAutoSelectionAccuracy();
      setAutoSelectionAccuracy(accuracy);
      
      toast.success(`Auto selection accuracy: ${accuracy.toFixed(1)}%`);
    } catch (error) {
      toast.error('Benchmark failed', {
        description: error as string,
      });
      console.error('Benchmark error:', error);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success 
      ? <CheckCircle className="h-4 w-4 text-green-500" />
      : <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    if (score >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const exportResults = () => {
    const data = report || { quickResults };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-validation-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Validation results exported!');
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <TestTube className="h-6 w-6 mr-2 text-blue-600" />
            Model Validation Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Test and validate AI model performance, tool compatibility, and auto selection accuracy</p>
        </div>
        
        <div className="flex items-center space-x-2">
          {(report || quickResults.length > 0) && (
            <Button variant="outline" onClick={exportResults}>
              <Download className="h-4 w-4 mr-2" />
              Export Results
            </Button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-800">Quick Test</h3>
                <p className="text-sm text-gray-600">Test all models with simple task</p>
              </div>
              <Button 
                onClick={runQuickTest} 
                disabled={isRunningQuick}
                size="sm"
              >
                {isRunningQuick ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-800">Comprehensive Test</h3>
                <p className="text-sm text-gray-600">Full validation suite</p>
              </div>
              <Button 
                onClick={runComprehensiveTest} 
                disabled={isRunningComprehensive}
                size="sm"
              >
                {isRunningComprehensive ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-800">Auto Selection Benchmark</h3>
                <p className="text-sm text-gray-600">Test intelligent routing accuracy</p>
              </div>
              <Button 
                onClick={runBenchmark} 
                disabled={isBenchmarking}
                size="sm"
              >
                {isBenchmarking ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Target className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'comprehensive', label: 'Comprehensive', icon: TestTube },
          { id: 'quick', label: 'Quick Test', icon: Zap },
          { id: 'benchmark', label: 'Benchmark', icon: Target },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Overall Success Rate</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {report ? `${report.success_rate.toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Brain className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Auto Selection</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {autoSelectionAccuracy ? `${autoSelectionAccuracy.toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Zap className="h-8 w-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Tool Compatibility</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {report ? `${report.universal_executor_performance.toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">Tests Run</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {report ? report.total_tests : quickResults.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comprehensive Test Results */}
      {activeTab === 'comprehensive' && report && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Test Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Tests:</span>
                    <span className="font-medium">{report.total_tests}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Passed:</span>
                    <span className="font-medium text-green-600">{report.passed_tests}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Failed:</span>
                    <span className="font-medium text-red-600">{report.failed_tests}</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={report.success_rate} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center">
                  <Brain className="h-4 w-4 mr-2" />
                  Intelligence Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Auto Selection:</span>
                    <span className={`font-medium ${getPerformanceColor(report.auto_selection_accuracy)}`}>
                      {report.auto_selection_accuracy.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Universal Executor:</span>
                    <span className={`font-medium ${getPerformanceColor(report.universal_executor_performance)}`}>
                      {report.universal_executor_performance.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Test Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Timestamp:</span>
                    <span className="font-medium">
                      {new Date(report.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Models Tested:</span>
                    <span className="font-medium">
                      {new Set(report.model_results.map(r => r.model_id)).size}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detailed Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {report.model_results.map((result, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${getStatusColor(result.success)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          {getStatusIcon(result.success)}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {result.provider}
                          </Badge>
                          <span className="ml-2 font-medium text-sm">{result.model_id}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatResponseTime(result.response_time_ms)}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">{result.test_name}</div>
                      
                      {result.error_message && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                          {result.error_message}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-3 text-xs">
                          <div className={`flex items-center ${result.tool_compatibility ? 'text-green-600' : 'text-red-600'}`}>
                            {result.tool_compatibility ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            Tools
                          </div>
                          <div className={`flex items-center ${result.mcp_support ? 'text-green-600' : 'text-red-600'}`}>
                            {result.mcp_support ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            MCP
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Quality: {result.response_quality_score.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Test Results */}
      {activeTab === 'quick' && quickResults.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickResults.map((result, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      {getStatusIcon(result.success)}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {result.provider}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatResponseTime(result.response_time_ms)}
                    </div>
                  </div>
                  
                  <h3 className="font-medium text-sm mb-2">{result.model_id}</h3>
                  
                  {result.error_message && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-2">
                      {result.error_message}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <Badge variant={result.tool_compatibility ? 'default' : 'destructive'} className="text-xs">
                        Tools
                      </Badge>
                      <Badge variant={result.mcp_support ? 'default' : 'destructive'} className="text-xs">
                        MCP
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      {result.response_quality_score.toFixed(1)}%
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Benchmark Results */}
      {activeTab === 'benchmark' && autoSelectionAccuracy !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Auto Selection Accuracy Benchmark
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className={`text-4xl font-bold ${getPerformanceColor(autoSelectionAccuracy)}`}>
                {autoSelectionAccuracy.toFixed(1)}%
              </div>
              <p className="text-gray-600 mt-2">
                Auto model selection accuracy across various task types
              </p>
              <Progress value={autoSelectionAccuracy} className="mt-4" />
              
              <div className="mt-6 text-left">
                <h4 className="font-medium text-sm mb-3">Benchmark Details:</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>• High complexity coding tasks → Expected Claude 4.1 Opus or Sonnet 4</div>
                  <div>• Medium complexity UI tasks → Expected Gemini 2.5 Flash or Sonnet 4</div>
                  <div>• Low complexity questions → Expected Gemini 2.5 Flash or Llama 3.3</div>
                  <div>• Performance debugging → Expected Claude 4.1 Opus or Gemini 2.5 Pro</div>
                  <div>• API design tasks → Expected Claude 4.1 Opus or Sonnet 4</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ValidationDashboard;