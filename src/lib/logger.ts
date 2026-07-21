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

/**
 * Optional structured metadata attached to a logger.error report.
 * Values are forwarded to Firebase Analytics as event parameters, so the
 * primitive type set matches logEvent's EventParams — strings, numbers,
 * booleans, null, or undefined. Reject objects/functions to keep the
 * analytics payload flat and serialisable.
 *
 * `undefined` is permitted for fields whose underlying type is optional
 * (e.g. React's `ErrorInfo.componentStack: string | null | undefined`).
 * At merge time, `undefined` values are stripped — Firebase Analytics's
 * `logEvent` rejects undefined params and would otherwise throw a
 * TypeError that masks the original report.
 */
export type ErrorMetadata = Record<string, string | number | boolean | null | undefined>;

/**
 * Build the analytics event payload from a logger.error call.
 * Drops `undefined` metadata values because Firebase Analytics' `logEvent`
 * rejects undefined params and would otherwise throw a TypeError that masks
 * the original error report. `null` is preserved — it's a valid value
 * (`logEvent` accepts null) and lets callers explicitly mark "no value".
 */
function buildEventPayload(
    context: string,
    errorCode: string,
    metadata: ErrorMetadata,
): Record<string, string | number | boolean | null> {
    const payload: Record<string, string | number | boolean | null> = {
        context,
        errorCode,
        timestamp: Date.now(),
    };
    for (const [key, value] of Object.entries(metadata)) {
        if (value === undefined) continue;
        payload[key] = value;
    }
    return payload;
}

function reportAppError(context: string, err: unknown, metadata: ErrorMetadata = {}): void {
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
    // Merge caller-supplied metadata AFTER the canonical fields so a stray
    // `context` / `errorCode` / `timestamp` key in metadata cannot clobber
    // them. `buildEventPayload` handles the `undefined`-filter so callers
    // can pass optional fields (e.g. `ErrorInfo.componentStack`) without a
    // pre-strip step.
    logEvent(APP_ERROR_EVENT, buildEventPayload(context, errorCode, metadata));
}

export const logger = {
    log: (...args: unknown[]): void => {
        if (!IS_PRODUCTION) console.log(...args);
    },
    warn: (...args: unknown[]): void => {
        if (!IS_PRODUCTION) console.warn(...args);
    },
    error: (context: string, err?: unknown, metadata: ErrorMetadata = {}): void => {
        if (!IS_PRODUCTION) {
            // Keep the dev console signal visible without marking every
            // recoverable app error as a red-stack error in the browser.
            // Production still forwards the structured payload to analytics.
            if (Object.keys(metadata).length > 0) {
                console.warn(context, err, metadata);
            } else {
                console.warn(context, err);
            }
        }
        // In production: forward structured context + errorCode to Firebase
        // Analytics. No PII is included — only the context label, a short
        // error code derived from the error itself, and any caller-supplied
        // metadata (componentStack, engineId, etc.).
        if (IS_PRODUCTION) reportAppError(context, err, metadata);
    },
};
