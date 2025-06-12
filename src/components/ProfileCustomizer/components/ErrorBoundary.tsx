// src/components/ProfileCustomizer/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export class ProfileCustomizerErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 Profile Customizer Error:', error, errorInfo);
    
    // Enhanced error logging
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      retryCount: this.retryCount,
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    };
    
    this.setState({
      error,
      errorInfo: errorDetails
    });
    
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error tracking service
      console.error('Profile Customizer Error in Production:', errorDetails);
      
      // You can integrate with services like Sentry here:
      // if (typeof window !== 'undefined' && window.Sentry) {
      //   window.Sentry.captureException(error, {
      //     tags: { component: 'ProfileCustomizer' },
      //     contexts: { errorDetails }
      //   });
      // }
    }
  }

  handleReset = () => {
    this.retryCount++;
    if (this.retryCount > this.maxRetries) {
      console.warn('Max retries exceeded for ProfileCustomizer');
      return;
    }
    
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleForceRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.retryCount < this.maxRetries;

      // Enhanced error UI
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8 bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-6xl mb-4">🚨</div>
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
              Profile Customizer Error
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Something went wrong with the profile customizer. 
              {canRetry 
                ? ' You can try again or refresh the page.' 
                : ' Please refresh the page to continue.'}
            </p>
            
            {/* Error type hint */}
            {this.state.error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                <div className="text-sm text-red-700 dark:text-red-300">
                  <strong>Error Type:</strong> {this.state.error.name || 'Unknown'}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {this.state.error.message.length > 100 
                    ? `${this.state.error.message.substring(0, 100)}...` 
                    : this.state.error.message}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {canRetry && (
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Try Again ({this.maxRetries - this.retryCount} attempts left)
                </button>
              )}
              <button
                onClick={this.handleForceRefresh}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Refresh Page
              </button>
            </div>

            {/* Quick tips */}
            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Quick Tips:</strong>
                <ul className="mt-2 text-left text-xs space-y-1">
                  <li>• Try refreshing the page</li>
                  <li>• Clear your browser cache</li>
                  <li>• Check your internet connection</li>
                  <li>• Disable browser extensions temporarily</li>
                </ul>
              </div>
            </div>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  🔧 Error Details (Development Only)
                </summary>
                <div className="mt-3 p-4 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto max-h-60">
                  <div className="space-y-3">
                    <div>
                      <div className="font-bold mb-1 text-red-600 dark:text-red-400">Error Message:</div>
                      <div className="text-red-700 dark:text-red-300 font-mono">{this.state.error.message}</div>
                    </div>
                    
                    <div>
                      <div className="font-bold mb-1">Stack Trace:</div>
                      <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono text-xs overflow-x-auto">
                        {this.state.error.stack}
                      </pre>
                    </div>
                    
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <div className="font-bold mb-1">Component Stack:</div>
                        <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono text-xs overflow-x-auto">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    {this.state.errorInfo && (
                      <div>
                        <div className="font-bold mb-1">Debug Info:</div>
                        <div className="text-gray-600 dark:text-gray-400 space-y-1">
                          <div><strong>Timestamp:</strong> {this.state.errorInfo.timestamp}</div>
                          <div><strong>Retry Count:</strong> {this.state.errorInfo.retryCount}</div>
                          <div><strong>URL:</strong> {this.state.errorInfo.url}</div>
                          <div><strong>User Agent:</strong> {this.state.errorInfo.userAgent}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  const WrappedComponent = (props: P) => (
    <ProfileCustomizerErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ProfileCustomizerErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Hook for error boundary functionality in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    console.error('🚨 Profile Customizer Hook Error:', error);
    setError(error);
  }, []);

  // Reset error when component unmounts
  React.useEffect(() => {
    return () => setError(null);
  }, []);

  // Throw error to be caught by error boundary
  if (error) {
    throw error;
  }

  return { captureError, resetError };
};