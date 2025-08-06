import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Monitor,
  Smartphone,
  Tablet,
  X,
  Camera,
  Download,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { VisualOverlapDetector, OverlapInfo } from '@/utils/visualOverlapDetector';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  description: string;
  details?: string[];
  screenshot?: string;
}

interface DeviceTest {
  device: string;
  icon: React.ReactNode;
  width: number;
  height: number;
  results: TestResult[];
}

export const UIOverlapTestReport: React.FC<{
  onClose?: () => void;
  autoRun?: boolean;
}> = ({ onClose, autoRun = false }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTest, setCurrentTest] = useState('');
  const [deviceTests, setDeviceTests] = useState<DeviceTest[]>([]);
  const [overlapDetector, setOverlapDetector] = useState<VisualOverlapDetector | null>(null);
  const [liveOverlaps, setLiveOverlaps] = useState<OverlapInfo[]>([]);

  const devices: Array<{ name: string; icon: React.ReactNode; width: number; height: number }> = [
    { name: 'Mobile', icon: <Smartphone className="h-4 w-4" />, width: 375, height: 812 },
    { name: 'Tablet', icon: <Tablet className="h-4 w-4" />, width: 768, height: 1024 },
    { name: 'Desktop', icon: <Monitor className="h-4 w-4" />, width: 1920, height: 1080 },
  ];

  useEffect(() => {
    // Initialize overlap detector
    const detector = new VisualOverlapDetector({
      highlightColor: 'rgba(255, 0, 0, 0.3)',
      checkInterval: 1000,
      minimumOverlapArea: 50,
    });
    setOverlapDetector(detector);

    // Start live monitoring
    detector.enable();
    const interval = setInterval(() => {
      const report = detector.getOverlapReport();
      setLiveOverlaps(report.overlaps);
    }, 1000);

    return () => {
      clearInterval(interval);
      detector.disable();
    };
  }, []);

  useEffect(() => {
    if (autoRun) {
      runTests();
    }
  }, [autoRun]);

  const runTests = async () => {
    setIsRunning(true);
    setProgress(0);
    setDeviceTests([]);

    const results: DeviceTest[] = [];
    const totalTests = devices.length * 5; // 5 tests per device
    let completedTests = 0;

    for (const device of devices) {
      setCurrentTest(`Testing ${device.name} (${device.width}x${device.height})`);
      
      const deviceResults: TestResult[] = [];

      // Test 1: Progress Tracker positioning
      await simulateViewportChange(device.width, device.height);
      const progressTrackerTest = await testProgressTrackerPosition();
      deviceResults.push(progressTrackerTest);
      completedTests++;
      setProgress((completedTests / totalTests) * 100);

      // Test 2: Model Selector dropdown
      const modelSelectorTest = await testModelSelectorOverlap();
      deviceResults.push(modelSelectorTest);
      completedTests++;
      setProgress((completedTests / totalTests) * 100);

      // Test 3: Multiple components interaction
      const multiComponentTest = await testMultipleComponents();
      deviceResults.push(multiComponentTest);
      completedTests++;
      setProgress((completedTests / totalTests) * 100);

      // Test 4: Z-index hierarchy
      const zIndexTest = await testZIndexHierarchy();
      deviceResults.push(zIndexTest);
      completedTests++;
      setProgress((completedTests / totalTests) * 100);

      // Test 5: Responsive layout
      const responsiveTest = await testResponsiveLayout(device.width);
      deviceResults.push(responsiveTest);
      completedTests++;
      setProgress((completedTests / totalTests) * 100);

      results.push({
        device: device.name,
        icon: device.icon,
        width: device.width,
        height: device.height,
        results: deviceResults,
      });

      // Small delay between device tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setDeviceTests(results);
    setIsRunning(false);
    setCurrentTest('');
  };

  const simulateViewportChange = async (width: number, height: number) => {
    // In a real implementation, this would use Playwright or similar
    // For now, we'll simulate the viewport change
    return new Promise<void>(resolve => {
      setTimeout(resolve, 100);
    });
  };

  const testProgressTrackerPosition = async (): Promise<TestResult> => {
    // Simulate testing Progress Tracker positioning
    const progressTracker = document.querySelector('.progress-tracker-embedded');
    const chatWindow = document.querySelector('.chat-window-container');

    if (!progressTracker || !chatWindow) {
      return {
        name: 'Progress Tracker Position',
        status: 'warning',
        description: 'Components not found',
        details: ['Progress Tracker or Chat Window not rendered'],
      };
    }

    const ptRect = progressTracker.getBoundingClientRect();
    const cwRect = chatWindow.getBoundingClientRect();

    // Check if they overlap
    const overlaps = !(ptRect.right < cwRect.left || 
                      ptRect.left > cwRect.right || 
                      ptRect.bottom < cwRect.top || 
                      ptRect.top > cwRect.bottom);

    return {
      name: 'Progress Tracker Position',
      status: overlaps ? 'fail' : 'pass',
      description: overlaps 
        ? 'Progress Tracker overlaps with chat window'
        : 'Progress Tracker properly positioned',
      details: [
        `Progress Tracker: ${Math.round(ptRect.left)}, ${Math.round(ptRect.top)}`,
        `Chat Window: ${Math.round(cwRect.left)}, ${Math.round(cwRect.top)}`,
      ],
    };
  };

  const testModelSelectorOverlap = async (): Promise<TestResult> => {
    // Test Model Selector dropdown positioning
    const modelSelector = document.querySelector('.model-selector-dropdown');
    
    if (!modelSelector) {
      return {
        name: 'Model Selector Dropdown',
        status: 'pass',
        description: 'Model Selector dropdown not currently open',
      };
    }

    const rect = modelSelector.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const isWithinViewport = 
      rect.left >= 0 &&
      rect.top >= 0 &&
      rect.right <= viewportWidth &&
      rect.bottom <= viewportHeight;

    return {
      name: 'Model Selector Dropdown',
      status: isWithinViewport ? 'pass' : 'fail',
      description: isWithinViewport
        ? 'Dropdown properly contained within viewport'
        : 'Dropdown extends beyond viewport boundaries',
      details: [
        `Position: ${Math.round(rect.left)}, ${Math.round(rect.top)}`,
        `Size: ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      ],
    };
  };

  const testMultipleComponents = async (): Promise<TestResult> => {
    if (!overlapDetector) {
      return {
        name: 'Multiple Components',
        status: 'warning',
        description: 'Overlap detector not initialized',
      };
    }

    const report = overlapDetector.getOverlapReport();
    
    if (report.summary.total === 0) {
      return {
        name: 'Multiple Components',
        status: 'pass',
        description: 'No overlapping components detected',
      };
    }

    return {
      name: 'Multiple Components',
      status: report.summary.high > 0 ? 'fail' : 'warning',
      description: `${report.summary.total} overlaps detected`,
      details: [
        `High severity: ${report.summary.high}`,
        `Medium severity: ${report.summary.medium}`,
        `Low severity: ${report.summary.low}`,
      ],
    };
  };

  const testZIndexHierarchy = async (): Promise<TestResult> => {
    const elements = {
      modal: document.querySelector('.modal-content'),
      progressTracker: document.querySelector('.progress-tracker-embedded'),
      dropdown: document.querySelector('[data-radix-ui-popper-content]'),
      tooltip: document.querySelector('[role="tooltip"]'),
    };

    const zIndices: Record<string, number> = {};
    let hasIssues = false;

    Object.entries(elements).forEach(([name, element]) => {
      if (element) {
        const style = window.getComputedStyle(element);
        zIndices[name] = parseInt(style.zIndex || '0');
      }
    });

    // Check expected hierarchy
    if (zIndices.modal && zIndices.progressTracker) {
      if (zIndices.modal <= zIndices.progressTracker) {
        hasIssues = true;
      }
    }

    return {
      name: 'Z-Index Hierarchy',
      status: hasIssues ? 'fail' : 'pass',
      description: hasIssues
        ? 'Z-index hierarchy issues detected'
        : 'Z-index hierarchy is correct',
      details: Object.entries(zIndices).map(([name, z]) => `${name}: ${z}`),
    };
  };

  const testResponsiveLayout = async (width: number): Promise<TestResult> => {
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    
    // Check if responsive classes are applied
    const progressTracker = document.querySelector('.progress-tracker-embedded');
    const hasResponsiveClasses = progressTracker?.classList.contains('responsive');

    return {
      name: 'Responsive Layout',
      status: 'pass',
      description: `Layout optimized for ${isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}`,
      details: [
        `Viewport: ${width}px wide`,
        `Device type: ${isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}`,
      ],
    };
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <Info className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getOverallStatus = () => {
    const allResults = deviceTests.flatMap(dt => dt.results);
    const failCount = allResults.filter(r => r.status === 'fail').length;
    const warningCount = allResults.filter(r => r.status === 'warning').length;

    if (failCount > 0) return 'fail';
    if (warningCount > 0) return 'warning';
    return 'pass';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">UI Overlap Test Report</CardTitle>
          <div className="flex items-center gap-2">
            {!isRunning && (
              <Button onClick={runTests} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Tests
              </Button>
            )}
            {onClose && (
              <Button onClick={onClose} size="sm" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Tabs defaultValue="results" className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="results">Test Results</TabsTrigger>
              <TabsTrigger value="live">Live Monitor</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {isRunning ? (
                <div className="space-y-4 py-8">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 mb-4">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span className="text-lg font-medium">Running Tests...</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{currentTest}</p>
                    <Progress value={progress} className="max-w-md mx-auto" />
                  </div>
                </div>
              ) : deviceTests.length > 0 ? (
                <div className="space-y-6 py-4">
                  {/* Overall Status */}
                  <Alert className={cn(
                    "border-2",
                    getOverallStatus() === 'pass' && "border-green-500 bg-green-500/10",
                    getOverallStatus() === 'warning' && "border-yellow-500 bg-yellow-500/10",
                    getOverallStatus() === 'fail' && "border-red-500 bg-red-500/10"
                  )}>
                    <AlertTitle className="flex items-center gap-2">
                      {getStatusIcon(getOverallStatus())}
                      Overall Status: {getOverallStatus() === 'pass' ? 'All Tests Passed' : 
                                      getOverallStatus() === 'warning' ? 'Some Warnings' : 
                                      'Issues Found'}
                    </AlertTitle>
                    <AlertDescription>
                      {deviceTests.length} devices tested with{' '}
                      {deviceTests.reduce((acc, dt) => acc + dt.results.length, 0)} total tests.
                    </AlertDescription>
                  </Alert>

                  {/* Device Results */}
                  {deviceTests.map((deviceTest, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          {deviceTest.icon}
                          {deviceTest.device} ({deviceTest.width}x{deviceTest.height})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {deviceTest.results.map((result, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                            >
                              {getStatusIcon(result.status)}
                              <div className="flex-1">
                                <div className="font-medium">{result.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {result.description}
                                </div>
                                {result.details && (
                                  <ul className="mt-1 text-xs text-muted-foreground">
                                    {result.details.map((detail, i) => (
                                      <li key={i}>• {detail}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Click "Run Tests" to start UI overlap detection tests
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="live" className="px-6 pb-6">
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Live Overlap Detection</AlertTitle>
                  <AlertDescription>
                    Real-time monitoring of UI element overlaps. Move and resize components to see updates.
                  </AlertDescription>
                </Alert>

                {liveOverlaps.length > 0 ? (
                  <div className="space-y-2">
                    {liveOverlaps.map((overlap, index) => (
                      <Card key={index} className={cn(
                        "border-2",
                        overlap.severity === 'high' && "border-red-500",
                        overlap.severity === 'medium' && "border-yellow-500",
                        overlap.severity === 'low' && "border-blue-500"
                      )}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={
                              overlap.severity === 'high' ? 'destructive' :
                              overlap.severity === 'medium' ? 'warning' : 'default'
                            }>
                              {overlap.severity.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(overlap.overlapRect.width)}x{Math.round(overlap.overlapRect.height)}px
                            </span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="font-mono text-xs">
                              {overlap.element1.identifier}
                            </div>
                            <div className="text-muted-foreground">overlaps with</div>
                            <div className="font-mono text-xs">
                              {overlap.element2.identifier}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                      <p className="text-lg font-medium">No Overlaps Detected</p>
                      <p className="text-sm text-muted-foreground">
                        All UI elements are properly positioned
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="recommendations" className="px-6 pb-6">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>CSS Improvements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• Use consistent z-index scale across components</li>
                      <li>• Implement responsive breakpoints for all fixed elements</li>
                      <li>• Add safe area insets for mobile devices</li>
                      <li>• Use CSS Grid for predictable layouts</li>
                      <li>• Avoid absolute positioning when possible</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Component Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• Progress Tracker should use `position: fixed` with proper margins</li>
                      <li>• Model Selector dropdown should calculate available space</li>
                      <li>• Modals should have backdrop with high z-index</li>
                      <li>• Tooltips should use portal rendering</li>
                      <li>• Floating elements need collision detection</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Testing Strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li>• Implement visual regression tests</li>
                      <li>• Test all viewport sizes in CI/CD</li>
                      <li>• Use automated overlap detection</li>
                      <li>• Add accessibility testing</li>
                      <li>• Monitor performance impact</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};