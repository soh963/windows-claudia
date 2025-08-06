import React, { Component, ReactNode } from 'react';
import { AlertCircle, Bug, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useErrorTrackingStore } from '@/stores/errorTrackingStore';
import { cn } from '@/lib/utils';

interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  componentName: string;
  fallback?: (error: Error, reset: () => void, errorId: string) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void;
  className?: string;
}

interface ErrorBoundaryWrapperState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  errorCount: number;
  showDetails: boolean;
  copied: boolean;
}

/**
 * Enhanced Error Boundary component with error tracking integration
 */
export class ErrorBoundaryWrapper extends Component<ErrorBoundaryWrapperProps, ErrorBoundaryWrapperState> {
  constructor(props: ErrorBoundaryWrapperProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      errorCount: 0,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryWrapperState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Capture error to tracking store
    const { captureErrorBoundary } = useErrorTrackingStore.getState();
    const errorId = `err_boundary_${Date.now()}`;
    
    captureErrorBoundary(error, errorInfo, this.props.componentName);
    
    this.setState((prevState) => ({
      errorId,
      errorCount: prevState.errorCount + 1,
    }));
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo, errorId);
    
    // Log to console for debugging
    console.error(`Error in ${this.props.componentName}:`, error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      showDetails: false,
      copied: false,
    });
  };

  copyError = () => {
    if (!this.state.error) return;
    
    const errorInfo = {
      component: this.props.componentName,
      message: this.state.error.message,
      stack: this.state.error.stack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
    };
    
    navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2));
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset, this.state.errorId || '');
      }

      // Default error UI
      return (
        <div className={cn("flex items-center justify-center min-h-[200px] p-4", this.props.className)}>
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
                  <div>
                    <CardTitle className="text-xl">Component Error</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      An error occurred in {this.props.componentName}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive" className="ml-4">
                  Error #{this.state.errorCount}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Alert>
                <Bug className="h-4 w-4" />
                <AlertDescription>
                  {this.state.error.message}
                </AlertDescription>
              </Alert>
              
              {this.state.errorId && (
                <div className="text-xs text-muted-foreground">
                  Error ID: <code className="font-mono">{this.state.errorId}</code>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Button onClick={this.reset} size="sm" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="gap-2"
                >
                  {this.state.showDetails ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show Details
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.copyError}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {this.state.copied ? 'Copied!' : 'Copy Error'}
                </Button>
              </div>
              
              {this.state.showDetails && this.state.error.stack && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Stack Trace:</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 font-mono">
                    {this.state.error.stack}
                  </pre>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                This error has been automatically reported and logged for analysis.
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  options?: {
    fallback?: (error: Error, reset: () => void, errorId: string) => ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void;
  }
) {
  return React.forwardRef<any, P>((props, ref) => (
    <ErrorBoundaryWrapper
      componentName={componentName}
      fallback={options?.fallback}
      onError={options?.onError}
    >
      <Component {...(props as P)} ref={ref} />
    </ErrorBoundaryWrapper>
  ));
}

/**
 * Error boundary provider for the entire app
 */
export const AppErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundaryWrapper
      componentName="App"
      fallback={(error, reset) => (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                Application Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A critical error has occurred in the application.
              </p>
              <Alert>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button onClick={reset} className="flex-1">
                  Reload Application
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="flex-1"
                >
                  Go to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
};