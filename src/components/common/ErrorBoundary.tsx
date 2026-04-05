import { PureComponent, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional custom fallback UI. If not provided, a default error card is shown. */
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error boundary that catches JavaScript errors anywhere in the child component tree.
 * 
 * Uses PureComponent to prevent unnecessary re-renders when props haven't changed.
 * Provides accessible error messaging with ARIA roles for screen readers.
 */
export class ErrorBoundary extends PureComponent<ErrorBoundaryProps, ErrorBoundaryState> {
    static displayName = 'ErrorBoundary';

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Use production-safe logger instead of raw console.error
        logger.error('ErrorBoundary caught an error', { 
            error: error.message, 
            componentStack: errorInfo.componentStack 
        });
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Use custom fallback if provided (for per-engine error isolation)
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div 
                    className="flex min-h-[400px] items-center justify-center p-8"
                    role="alert"
                    aria-live="assertive"
                >
                    <div className="max-w-md text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-danger/10">
                            <AlertTriangle className="h-8 w-8 text-shield-danger" aria-hidden="true" />
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-shield-text">
                            Something went wrong
                        </h2>
                        <p className="mb-6 text-shield-muted">
                            An unexpected error occurred. Please refresh the page and try again.
                        </p>
                        <button
                            onClick={this.handleReset}
                            className="inline-flex items-center gap-2 rounded-xl bg-shield-accent px-6 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors focus:outline-none focus:ring-2 focus:ring-shield-accent focus:ring-offset-2"
                            type="button"
                        >
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
