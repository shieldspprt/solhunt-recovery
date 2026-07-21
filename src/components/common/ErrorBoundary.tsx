import { Component, type ReactNode, type ErrorInfo } from 'react';
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

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Use production-safe logger instead of raw console.error
        logger.error('ErrorBoundary caught an error', { error: error.message, componentStack: errorInfo.componentStack });
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
                <div className="flex min-h-[400px] items-center justify-center p-8">
                    <div className="max-w-md text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-danger/10">
                            <AlertTriangle className="h-8 w-8 text-shield-danger" />
                        </div>
                        <h2 className="mb-2 text-xl font-semibold text-shield-text">
                            Something went wrong
                        </h2>
                        <p className="mb-6 text-shield-muted">
                            An unexpected error occurred. Please refresh the page and try again.
                        </p>
                        {this.state.error && import.meta.env.DEV && (
                            <div className="mb-6 rounded-lg border border-shield-border bg-shield-bg/50 p-4 text-left font-mono text-xs text-shield-danger max-h-40 overflow-auto">
                                <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                                <p className="mt-2 text-shield-muted/70 whitespace-pre-wrap">{this.state.error.stack}</p>
                            </div>
                        )}
                        <button
                            onClick={this.handleReset}
                            className="inline-flex items-center gap-2 rounded-xl bg-shield-accent px-6 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
