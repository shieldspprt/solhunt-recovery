import { PureComponent, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

interface EngineErrorBoundaryProps {
    children: ReactNode;
    engineId: string;
    onReset?: () => void;
}

interface EngineErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Per-engine error boundary that isolates Engine 1 (Revoke) errors
 * from the rest of the ScanResults UI.
 * 
 * If Engine 1 throws unexpectedly, only that section shows an error
 * while Engines 2, 3, etc. remain interactive.
 * 
 * This prevents the "Something went wrong" blank screen when the scan
 * actually succeeds in the background.
 */
export class EngineErrorBoundary extends PureComponent<EngineErrorBoundaryProps, EngineErrorBoundaryState> {
    constructor(props: EngineErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): EngineErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Pass the raw Error so logger can extract a real errorCode
        // (Error.name, or .code on AppError-shaped errors) — the previous
        // `{ error: error.message, componentStack }` object literal had no
        // .name and no .code, so reportAppError always classified these as
        // 'UNKNOWN' in production and the mcp-logs / Firebase dashboard
        // couldn't tell an engine crash from a top-level boundary crash,
        // nor which engine it came from. The errorContext string
        // (e.g. "[EngineErrorBoundary:1] Engine threw unexpectedly") and
        // the engineId parameter are both forwarded as metadata so the
        // dashboard can group by engine and the dev console shows the
        // same shape in both environments.
        logger.error(
            `[EngineErrorBoundary:${this.props.engineId}] Engine threw unexpectedly`,
            error,
            {
                engineId: this.props.engineId,
                componentStack: errorInfo.componentStack,
            }
        );
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div
                    className="rounded-2xl border border-shield-danger/30 bg-shield-danger/5 p-6 text-center"
                    role="alert"
                    aria-live="polite"
                >
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-shield-danger/10">
                        <AlertTriangle className="h-6 w-6 text-shield-danger" aria-hidden="true" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-shield-text">
                        Engine {this.props.engineId} encountered an error
                    </h3>
                    <p className="mb-4 text-sm text-shield-muted">
                        The scan completed successfully, but this section had an issue displaying results.
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="inline-flex items-center gap-2 rounded-xl bg-shield-accent px-6 py-2.5 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                        type="button"
                        aria-label={`Retry Engine ${this.props.engineId}`}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
