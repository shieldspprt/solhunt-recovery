/**
 * Production-safe logger.
 *
 * In development: logs to console.
 * In production: errors are forwarded to Firebase Analytics as 'app_error' events
 * via the analytics module. No-op when Firebase is not configured.
 *
 * Audit Spec §2.11 — Error Information Leakage Prevention.
 */
import { IS_PRODUCTION } from '@/config/constants';
import { logEvent } from '@/lib/analytics';

// 'app_error' is intentionally not in the AnalyticsEventName union (analytics.ts)
// because it's an internal-only event piped from logger.error. Typed here as
// a string literal so a future audit can promote it to the union if needed.
const APP_ERROR_EVENT = 'app_error';

function reportAppError(context: string, err: unknown): void {
    // Extract a stable, non-PII error code. Prefer the error's own .code
    // (matches our AppError shape); otherwise derive from the message length
    // and the context. NEVER include the original error message — it may
    // contain wallet addresses, signatures, or RPC error bodies.
    let errorCode = 'UNKNOWN';
    if (err && typeof err === 'object' && 'code' in err) {
        const candidate = (err as { code?: unknown }).code;
        if (typeof candidate === 'string') errorCode = candidate;
    } else if (err instanceof Error) {
        errorCode = err.name || 'Error';
    }
    logEvent(APP_ERROR_EVENT, { context, errorCode, timestamp: Date.now() });
}

export const logger = {
    log: (...args: unknown[]): void => {
        if (!IS_PRODUCTION) console.log(...args);
    },
    warn: (...args: unknown[]): void => {
        if (!IS_PRODUCTION) console.warn(...args);
    },
    error: (context: string, err?: unknown): void => {
        if (!IS_PRODUCTION) console.error(context, err);
        // In production: forward structured context + errorCode to Firebase
        // Analytics. No PII is included — only the context label and a
        // short error code derived from the error itself.
        if (IS_PRODUCTION) reportAppError(context, err);
    },
};
