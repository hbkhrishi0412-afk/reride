import React, { Component, ErrorInfo, ReactNode } from 'react';
import { isDevelopmentEnvironment } from '../utils/environment';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.context || 'Unknown'}]:`, error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to external service in production
    if (!isDevelopmentEnvironment()) {
      // Error tracking service integration
      // To integrate Sentry: import * as Sentry from '@sentry/react' and call Sentry.captureException(error)
      // To integrate LogRocket: import LogRocket from 'logrocket' and call LogRocket.captureException(error)
      // Example: if (window.Sentry) window.Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
      console.error('Production error:', {
        context: this.props.context,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Something went wrong
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {this.props.context ? `Error in ${this.props.context}` : 'An unexpected error occurred'}
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
              </p>
            </div>

            {isDevelopmentEnvironment() && this.state.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <h4 className="text-sm font-medium text-red-800 mb-2">Error Details (Development)</h4>
                <p className="text-xs text-red-700 font-mono">{this.state.error.message}</p>
                {this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 cursor-pointer">Stack Trace</summary>
                    <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specific error boundaries for different parts of the application
export const VehicleListErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary 
    context="Vehicle List" 
    onError={(error) => console.error('Vehicle List Error:', error)}
  >
    {children}
  </ErrorBoundary>
);

export const ChatErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary 
    context="Chat System"
    onError={(error) => console.error('Chat Error:', error)}
    fallback={
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-medium text-yellow-800">Chat temporarily unavailable</h3>
        <p className="text-sm text-yellow-700 mt-1">Please refresh the page to restore chat functionality.</p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export const DashboardErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary 
    context="Dashboard"
    onError={(error, errorInfo) => {
      // Enhanced error logging for production debugging
      const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
      console.error('Dashboard Error:', error);
      if (isProduction) {
        // Log detailed error information for production debugging
        console.error('Dashboard Error Details:', {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      }
    }}
  >
    {children}
  </ErrorBoundary>
);

export const AdminPanelErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary 
    context="Admin Panel"
    onError={(error) => console.error('Admin Panel Error:', error)}
  >
    {children}
  </ErrorBoundary>
);

export const AuthenticationErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary 
    context="Authentication"
    onError={(error) => console.error('Authentication Error:', error)}
    fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication Error</h2>
          <p className="text-gray-600 mb-6">There was a problem with the authentication system. Please try logging in again.</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export const PaymentErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary 
    context="Payment System"
    onError={(error) => console.error('Payment Error:', error)}
    fallback={
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-sm font-medium text-red-800">Payment system error</h3>
        <p className="text-sm text-red-700 mt-1">Please contact support for assistance with payments.</p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
