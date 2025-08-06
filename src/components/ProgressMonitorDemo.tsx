import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMonitoringStore, useOperationTracker } from '@/stores/monitoringStore';
import { 
  Zap, 
  FileText, 
  Package, 
  Brain, 
  AlertTriangle,
  Play,
  Shuffle
} from 'lucide-react';

export const ProgressMonitorDemo: React.FC = () => {
  const { startOperation, updateOperation, completeOperation, logError } = useMonitoringStore();
  const tracker = useOperationTracker();

  // Simulate API call
  const simulateApiCall = async () => {
    await tracker.track(
      {
        type: 'api_call',
        name: 'API: fetchUserData',
        description: 'Fetching user profile and preferences',
      },
      async (updateProgress) => {
        updateProgress(20);
        await new Promise((resolve) => setTimeout(resolve, 500));
        updateProgress(60);
        await new Promise((resolve) => setTimeout(resolve, 800));
        updateProgress(100);
      }
    );
  };

  // Simulate file operation
  const simulateFileOperation = async () => {
    await tracker.track(
      {
        type: 'file_operation',
        name: 'File: write config.json',
        description: 'Saving configuration changes',
      },
      async (updateProgress) => {
        for (let i = 0; i <= 100; i += 10) {
          updateProgress(i);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    );
  };

  // Simulate build process
  const simulateBuildProcess = async () => {
    await tracker.track(
      {
        type: 'build_process',
        name: 'Build: TypeScript Compilation',
        description: 'Compiling TypeScript files to JavaScript',
      },
      async (updateProgress) => {
        updateProgress(10);
        await new Promise((resolve) => setTimeout(resolve, 500));
        updateProgress(30);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        updateProgress(70);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        updateProgress(100);
      }
    );
  };

  // Simulate Gemini request
  const simulateGeminiRequest = async () => {
    const opId = startOperation({
      type: 'gemini_request',
      name: 'Gemini: gemini-1.5-pro',
      description: 'Analyzing code structure and suggesting improvements',
    });

    // Simulate streaming response
    for (let i = 0; i <= 100; i += 5) {
      updateOperation(opId, { progress: i });
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    completeOperation(opId);
  };

  // Simulate operation with error
  const simulateError = async () => {
    try {
      await tracker.track(
        {
          type: 'tool_execution',
          name: 'Tool: code-analysis',
          description: 'Running static code analysis',
        },
        async (updateProgress) => {
          updateProgress(20);
          await new Promise((resolve) => setTimeout(resolve, 500));
          updateProgress(50);
          await new Promise((resolve) => setTimeout(resolve, 500));
          // Simulate error
          throw new Error('Code analysis failed: Invalid syntax detected');
        }
      );
    } catch (error) {
      // Error is automatically tracked by the tracker
    }
  };

  // Log various errors
  const logSampleErrors = () => {
    logError({
      category: 'Network Error',
      message: 'Failed to connect to API server',
      severity: 'high',
    });

    logError({
      category: 'Validation Error',
      message: 'Invalid input format in form submission',
      severity: 'medium',
    });

    logError({
      category: 'Permission Error',
      message: 'User does not have access to this resource',
      severity: 'low',
    });

    logError({
      category: 'System Error',
      message: 'Critical system failure: Out of memory',
      severity: 'critical',
    });
  };

  // Simulate multiple concurrent operations
  const simulateConcurrentOperations = async () => {
    await Promise.all([
      simulateApiCall(),
      simulateFileOperation(),
      simulateBuildProcess(),
      simulateGeminiRequest(),
    ]);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Progress Monitor Demo</CardTitle>
        <CardDescription>
          Test the progress tracking system with simulated operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="justify-start"
            onClick={simulateApiCall}
          >
            <Zap className="mr-2 h-4 w-4" />
            Simulate API Call
          </Button>
          
          <Button
            variant="outline"
            className="justify-start"
            onClick={simulateFileOperation}
          >
            <FileText className="mr-2 h-4 w-4" />
            Simulate File Operation
          </Button>
          
          <Button
            variant="outline"
            className="justify-start"
            onClick={simulateBuildProcess}
          >
            <Package className="mr-2 h-4 w-4" />
            Simulate Build Process
          </Button>
          
          <Button
            variant="outline"
            className="justify-start"
            onClick={simulateGeminiRequest}
          >
            <Brain className="mr-2 h-4 w-4" />
            Simulate Gemini Request
          </Button>
          
          <Button
            variant="outline"
            className="justify-start"
            onClick={simulateError}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Simulate Error
          </Button>
          
          <Button
            variant="outline"
            className="justify-start"
            onClick={logSampleErrors}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Log Sample Errors
          </Button>
        </div>
        
        <div className="pt-4 border-t">
          <Button
            className="w-full"
            onClick={simulateConcurrentOperations}
          >
            <Shuffle className="mr-2 h-4 w-4" />
            Run Concurrent Operations
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Click the chart icon in the bottom-left to open the Progress Tracker</p>
          <p>• The Status Bar at the bottom shows active operations and errors</p>
          <p>• Click the Status Bar to expand it and see more details</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressMonitorDemo;