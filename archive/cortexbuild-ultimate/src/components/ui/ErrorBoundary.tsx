/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import { agentDebugLog } from '@/lib/agentDebugLog';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: undefined,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // #region agent log
    agentDebugLog({
      hypothesisId: 'H5',
      location: 'ErrorBoundary.tsx:componentDidCatch',
      message: 'error boundary caught',
      data: {
        errName: error.name,
        errMessage: error.message?.slice(0, 200),
        stackHead: error.stack?.split('\n').slice(0, 3).join(' | ')?.slice(0, 300),
      },
    });
    // #endregion
    this.props.onError?.(error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="card bg-slate-900 border border-slate-700 max-w-md w-full">
            <div className="card-body text-center">
              {/* Error Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-display-md text-center">
                Oops! Something went wrong
              </h2>

              {/* Error message */}
              {this.state.error && (
                <div className="text-left bg-slate-800 rounded-lg p-4 my-4 max-h-40 overflow-auto">
                  <code className="text-xs text-red-400 font-mono">
                    {this.state.error.message}
                  </code>
                </div>
              )}

              {/* Description */}
              <p className="text-slate-400 text-sm">
                We're sorry for the inconvenience. Please try refreshing the page.
                If the problem persists, contact support.
              </p>

              {/* Actions */}
              <div className="card-actions justify-center mt-4">
                <button onClick={this.handleReset} className="btn btn-primary gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `Error: ${this.state.error?.message}\n\nStack: ${this.state.error?.stack}`
                    );
                  }}
                  className="btn btn-ghost gap-2"
                >
                  <Bug className="w-4 h-4" />
                  Copy Error
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error Boundary Hook
 * Functional component wrapper for error boundaries
 */
import { useState, useCallback } from 'react';

interface UseErrorBoundaryReturn {
  hasError: boolean;
  error?: Error;
  clearError: () => void;
  handleError: (error: Error) => void;
}

export function useErrorBoundary(): UseErrorBoundaryReturn {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const handleError = useCallback((error: Error) => {
    console.error('Error caught by hook:', error);
    setError(error);
    setHasError(true);
  }, []);

  const clearError = useCallback(() => {
    setError(undefined);
    setHasError(false);
  }, []);

  return { hasError, error, clearError, handleError };
}

export default ErrorBoundary;
