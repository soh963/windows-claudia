import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Download, Upload, Zap } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { ProgressTrackerEmbedded } from './ProgressTrackerEmbedded';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { ModelType, Task } from '@/types/progressTracker';

/**
 * ProgressTrackerDemo - Comprehensive demo showcasing all features of the ProgressTracker system
 * 
 * Features demonstrated:
 * 1. Real-time progress visualization
 * 2. Model performance comparison
 * 3. Task lifecycle management
 * 4. Configuration options
 * 5. Data export/import
 * 6. Multiple positioning options
 */
export const ProgressTrackerDemo: React.FC = () => {
  const {
    progressData,
    startTask,
    updateTask,
    completeTask,
    recordModelRequest,
    switchModel,
    resetSession,
    exportData,
    importData,
    clearHistory,
  } = useProgressTracking({
    enableRealTime: true,
    updateInterval: 500,
    autoStartSession: true,
  });

  // Demo state
  const [isRunning, setIsRunning] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('claude');
  const [position, setPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
  const [showTracker, setShowTracker] = useState(true);
  const [autoCollapse, setAutoCollapse] = useState(true);
  const [showModelComparison, setShowModelComparison] = useState(true);
  const [showPerformanceGraphs, setShowPerformanceGraphs] = useState(true);
  const [importExportData, setImportExportData] = useState('');

  // Demo tasks
  const demoTasks = [
    { name: 'Analyze code structure', category: 'analysis', duration: 3000 },
    { name: 'Generate documentation', category: 'documentation', duration: 5000 },
    { name: 'Run tests', category: 'testing', duration: 2000 },
    { name: 'Build application', category: 'build', duration: 8000 },
    { name: 'Deploy to staging', category: 'deployment', duration: 4000 },
  ];

  // Simulate task execution
  const simulateTask = async (taskData: typeof demoTasks[0], model: ModelType) => {
    const taskId = startTask({
      name: taskData.name,
      description: `Processing ${taskData.name.toLowerCase()} with ${model}`,
      priority: 'medium',
      category: taskData.category,
      model: model,
      estimatedDuration: taskData.duration,
    });

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      const currentTask = progressData.activeTasks.find(t => t.id === taskId);
      if (currentTask && currentTask.progress < 100) {
        const increment = Math.random() * 15 + 5; // 5-20% increments
        const newProgress = Math.min(100, currentTask.progress + increment);
        updateTask(taskId, { progress: newProgress });
      }
    }, 300);

    // Complete task after estimated duration
    setTimeout(() => {
      clearInterval(progressInterval);
      const success = Math.random() > 0.15; // 85% success rate
      completeTask(taskId, success);
      
      // Record model performance
      const responseTime = taskData.duration + (Math.random() * 1000 - 500); // Add some variance
      recordModelRequest(model, responseTime, success, {
        input: Math.floor(Math.random() * 1000 + 500),
        output: Math.floor(Math.random() * 1500 + 800),
        total: Math.floor(Math.random() * 2500 + 1300),
      });
    }, taskData.duration + Math.random() * 1000);
  };

  // Start demo
  const startDemo = async () => {
    setIsRunning(true);
    
    for (const task of demoTasks) {
      if (!isRunning) break;
      
      // Randomly select model for variety
      const model = Math.random() > 0.5 ? 'claude' : 'gemini';
      await simulateTask(task, model);
      
      // Wait a bit between tasks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setIsRunning(false);
  };

  const stopDemo = () => {
    setIsRunning(false);
  };

  const handleModelSwitch = (model: ModelType) => {
    setSelectedModel(model);
    switchModel(model);
  };

  const handleExportData = () => {
    const data = exportData();
    setImportExportData(data);
  };

  const handleImportData = () => {
    if (importExportData.trim()) {
      try {
        importData(importExportData);
        setImportExportData('');
      } catch (error) {
        console.error('Failed to import data:', error);
      }
    }
  };

  return (
    <div className="h-screen bg-background p-4 relative overflow-hidden">
      {/* Demo Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-bold tracking-tight">Progress Tracker Demo</h1>
        <p className="text-muted-foreground">
          Comprehensive real-time progress visualization for Claudia chat application
        </p>
      </motion.div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Demo Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Demo Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Button
                onClick={startDemo}
                disabled={isRunning}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Demo
              </Button>
              <Button
                onClick={stopDemo}
                disabled={!isRunning}
                variant="outline"
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
            <Button
              onClick={resetSession}
              variant="outline"
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Session
            </Button>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={position} onValueChange={(value: any) => setPosition(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="show-tracker"
                checked={showTracker}
                onCheckedChange={setShowTracker}
              />
              <Label htmlFor="show-tracker">Show Tracker</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-collapse"
                checked={autoCollapse}
                onCheckedChange={setAutoCollapse}
              />
              <Label htmlFor="auto-collapse">Auto Collapse</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="model-comparison"
                checked={showModelComparison}
                onCheckedChange={setShowModelComparison}
              />
              <Label htmlFor="model-comparison">Model Comparison</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="performance-graphs"
                checked={showPerformanceGraphs}
                onCheckedChange={setShowPerformanceGraphs}
              />
              <Label htmlFor="performance-graphs">Performance Graphs</Label>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Live Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground">Total Tasks</div>
                <div className="font-semibold">{progressData.sessionMetrics.totalTasks}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Completed</div>
                <div className="font-semibold text-green-600">{progressData.completedTasks.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Active</div>
                <div className="font-semibold text-blue-600">{progressData.activeTasks.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Error Rate</div>
                <div className="font-semibold text-red-600">{progressData.errorRate.toFixed(1)}%</div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Model Performance</div>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Claude</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="h-5 px-1.5">
                      {progressData.modelPerformance.claude.responseTime.toFixed(0)}ms
                    </Badge>
                    <Badge variant="outline" className="h-5 px-1.5 text-green-600">
                      {progressData.modelPerformance.claude.successRate.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Gemini</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="h-5 px-1.5">
                      {progressData.modelPerformance.gemini.responseTime.toFixed(0)}ms
                    </Badge>
                    <Badge variant="outline" className="h-5 px-1.5 text-green-600">
                      {progressData.modelPerformance.gemini.successRate.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Export/Import */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Button onClick={handleExportData} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button onClick={handleImportData} variant="outline" className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              Import Data
            </Button>
            <Button onClick={clearHistory} variant="outline" className="flex-1">
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear History
            </Button>
          </div>
          <Textarea
            placeholder="Exported/imported data will appear here..."
            value={importExportData}
            onChange={(e) => setImportExportData(e.target.value)}
            className="min-h-[100px] text-xs"
          />
        </CardContent>
      </Card>

      {/* Active Tasks Display */}
      {progressData.activeTasks.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Zap className="h-5 w-5 mr-2 text-primary" />
              Active Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {progressData.activeTasks.map((task) => (
                <div key={task.id} className="flex items-center space-x-3 p-2 rounded bg-muted/30">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{task.name}</div>
                    <div className="text-xs text-muted-foreground">{task.description}</div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(task.progress)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Tracker - Embedded */}
      {showTracker && (
        <ProgressTrackerEmbedded
          position={position}
          maxWidth={300}
          minWidth={200}
          data={progressData}
          onModelSwitch={handleModelSwitch}
          config={{
            autoCollapse: autoCollapse,
            collapseDelay: 5000,
            showNotifications: true,
            enableRealTimeUpdates: true,
            showModelComparison: showModelComparison,
            showPerformanceGraphs: showPerformanceGraphs,
          }}
        />
      )}

      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 opacity-5">
        <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:60px_60px]" />
      </div>
    </div>
  );
};

export default ProgressTrackerDemo;