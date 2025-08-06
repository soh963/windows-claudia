import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundaryWrapper';
import { useErrorCapture } from '@/stores/errorTrackingStore';
import { useApiErrorCapture } from '@/hooks/useErrorIntegration';
import { invokeWithErrorTracking, withErrorTracking } from '@/utils/errorWrappedApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Code, AlertCircle, Bug, Zap } from 'lucide-react';

/**
 * Example component demonstrating error tracking integration
 */
const ErrorProneComponent: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { captureError, captureWithContext } = useErrorCapture();
  const { captureGeminiError, captureClaudeError, captureTauriError } = useApiErrorCapture();

  // Example 1: Manual error capture
  const handleManualError = () => {
    try {
      // Simulate some operation that might fail
      throw new Error('This is a manually triggered error for demonstration');
    } catch (error: any) {
      captureWithContext(error, {
        component: 'ErrorProneComponent',
        operation: 'handleManualError',
      });
    }
  };

  // Example 2: API error with retry
  const handleApiError = async () => {
    setLoading(true);
    try {
      // Using the wrapped invoke function with automatic error tracking and retry
      const result = await invokeWithErrorTracking('non_existent_command', 
        { test: 'data' },
        {
          retryable: true,
          maxRetries: 2,
          context: { 
            component: 'ErrorProneComponent',
            action: 'API Test'
          }
        }
      );
    } catch (error) {
      // Error is automatically captured by invokeWithErrorTracking
      console.log('API call failed after retries');
    } finally {
      setLoading(false);
    }
  };

  // Example 3: Simulated Gemini API error
  const handleGeminiError = () => {
    const geminiError = {
      code: 'RATE_LIMITED',
      message: 'API quota exceeded. Please try again later.',
      status: 429,
      retryAfter: 60,
    };
    
    captureGeminiError(geminiError, '/v1/models/gemini-pro:generateContent');
  };

  // Example 4: Component render error
  const [shouldThrow, setShouldThrow] = useState(false);
  
  if (shouldThrow) {
    throw new Error('Component render error triggered intentionally');
  }

  // Example 5: Wrapped async function with error tracking
  const processDataWithTracking = withErrorTracking(
    async (data: string) => {
      // Simulate processing that might fail
      if (data === 'fail') {
        throw new Error('Data processing failed');
      }
      return `Processed: ${data}`;
    },
    {
      name: 'processData',
      category: 'runtime',
      source: 'react-component',
      retryable: true,
      maxRetries: 2,
      context: { component: 'ErrorProneComponent' }
    }
  );

  const handleProcessData = async () => {
    try {
      await processDataWithTracking('fail');
    } catch (error) {
      console.log('Processing failed after retries');
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Bug className="h-4 w-4" />
        <AlertDescription>
          This component demonstrates various error tracking scenarios. Click the buttons below to trigger different types of errors.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Code className="h-4 w-4" />
              Manual Error Capture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Demonstrates manual error capture with context
            </p>
            <Button onClick={handleManualError} variant="destructive">
              Trigger Manual Error
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              API Error with Retry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Demonstrates API error with automatic retry
            </p>
            <Button 
              onClick={handleApiError} 
              variant="destructive"
              disabled={loading}
            >
              {loading ? 'Retrying...' : 'Trigger API Error'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Gemini API Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Simulates a Gemini API rate limit error
            </p>
            <Button onClick={handleGeminiError} variant="destructive">
              Trigger Gemini Error
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Render Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Triggers a component render error (caught by ErrorBoundary)
            </p>
            <Button 
              onClick={() => setShouldThrow(true)} 
              variant="destructive"
            >
              Trigger Render Error
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Code className="h-4 w-4" />
              Wrapped Function Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Demonstrates error tracking wrapper for async functions
            </p>
            <Button onClick={handleProcessData} variant="destructive">
              Trigger Processing Error
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">How to Use Error Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">1. Wrap Components with ErrorBoundary</h4>
            <pre className="text-xs bg-muted p-2 rounded">
{`<ErrorBoundaryWrapper componentName="MyComponent">
  <MyComponent />
</ErrorBoundaryWrapper>`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-2">2. Use Error Capture Hook</h4>
            <pre className="text-xs bg-muted p-2 rounded">
{`const { captureError, captureWithContext } = useErrorCapture();

try {
  // Your code
} catch (error) {
  captureWithContext(error, {
    component: 'MyComponent',
    operation: 'myOperation'
  });
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium mb-2">3. Wrap API Calls</h4>
            <pre className="text-xs bg-muted p-2 rounded">
{`const result = await invokeWithErrorTracking('command', args, {
  retryable: true,
  maxRetries: 3,
  context: { component: 'MyComponent' }
});`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Example showing how to use the error tracking system
 */
export const ErrorTrackingExample: React.FC = () => {
  return (
    <ErrorBoundaryWrapper componentName="ErrorTrackingExample">
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Error Tracking System Demo</h1>
        <ErrorProneComponent />
      </div>
    </ErrorBoundaryWrapper>
  );
};