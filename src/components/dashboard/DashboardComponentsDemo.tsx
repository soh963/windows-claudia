import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import RiskAssessment from './RiskAssessment';
import DocumentationStatus from './DocumentationStatus';
import { generateMockRisks, generateMockDocumentation } from './DashboardDemoData';

const DashboardComponentsDemo: React.FC = () => {
  const [risks, setRisks] = useState(() => generateMockRisks());
  const [documentation, setDocumentation] = useState(() => generateMockDocumentation());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('risk-assessment');

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRisks(generateMockRisks());
    setDocumentation(generateMockDocumentation());
    setLoading(false);
  };

  const handleRiskUpdate = (risk: any) => {
    console.log('Risk update requested:', risk);
    // In a real implementation, this would trigger an API call
  };

  const handleDocUpdate = (doc: any) => {
    console.log('Documentation update requested:', doc);
    // In a real implementation, this would trigger an API call
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Components Demo</h1>
            <p className="text-muted-foreground">
              Demonstration of the Risk Assessment and Documentation Status components
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Demo Data
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {risks.filter(r => r.status !== 'resolved').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Open Risks</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {risks.filter(r => r.severity === 'critical').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Critical Risks</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {documentation.filter(d => (d.completion_percentage || 0) >= 90).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Complete Docs</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(documentation.reduce((sum, doc) => sum + (doc.quality_score || 0), 0) / documentation.length)}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Quality</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Component Demos */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="risk-assessment">Risk Assessment</TabsTrigger>
            <TabsTrigger value="risk-compact">Risk (Compact)</TabsTrigger>
            <TabsTrigger value="documentation">Documentation</TabsTrigger>
            <TabsTrigger value="doc-compact">Docs (Compact)</TabsTrigger>
          </TabsList>

          <TabsContent value="risk-assessment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment Component - Full View</CardTitle>
                <CardDescription>
                  Complete risk assessment with matrix view, trends, and detailed risk information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RiskAssessment
                  risks={risks}
                  loading={loading}
                  compact={false}
                  onRiskUpdate={handleRiskUpdate}
                  onRefresh={handleRefresh}
                  realTimeUpdates={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk-compact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment Component - Compact View</CardTitle>
                <CardDescription>
                  Compact view suitable for dashboard overview sections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RiskAssessment
                  risks={risks}
                  loading={loading}
                  compact={true}
                  onRiskUpdate={handleRiskUpdate}
                  onRefresh={handleRefresh}
                  realTimeUpdates={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documentation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentation Status Component - Full View</CardTitle>
                <CardDescription>
                  Complete documentation tracking with filters, sorting, and quality metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentationStatus
                  docs={documentation}
                  loading={loading}
                  compact={false}
                  onDocUpdate={handleDocUpdate}
                  onRefresh={handleRefresh}
                  showFilters={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="doc-compact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentation Status Component - Compact View</CardTitle>
                <CardDescription>
                  Compact view suitable for dashboard overview sections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentationStatus
                  docs={documentation}
                  loading={loading}
                  compact={true}
                  onDocUpdate={handleDocUpdate}
                  onRefresh={handleRefresh}
                  showFilters={false}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Feature Highlights */}
        <Card>
          <CardHeader>
            <CardTitle>Component Features</CardTitle>
            <CardDescription>
              Key features implemented in the Risk Assessment and Documentation Status components
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                  Risk Assessment Features
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>• Risk matrix visualization (likelihood vs impact)</li>
                  <li>• Historical trend analysis with 30-day charts</li>
                  <li>• Multiple view modes (list, matrix, trends)</li>
                  <li>• Real-time monitoring and auto-refresh</li>
                  <li>• Risk scoring and severity classification</li>
                  <li>• Mitigation strategy tracking</li>
                  <li>• Category-based risk organization</li>
                  <li>• Interactive risk cards with detailed metrics</li>
                  <li>• Compact mode for dashboard integration</li>
                  <li>• Filtering and sorting capabilities</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-500" />
                  Documentation Status Features
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>• Completion percentage tracking</li>
                  <li>• Quality scoring and assessment</li>
                  <li>• Missing sections identification</li>
                  <li>• Multiple documentation types support</li>
                  <li>• Advanced filtering and sorting</li>
                  <li>• Grid and list view modes</li>
                  <li>• File path tracking and organization</li>
                  <li>• Quality insights and recommendations</li>
                  <li>• Compact mode for dashboard integration</li>
                  <li>• Interactive documentation cards</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardComponentsDemo;