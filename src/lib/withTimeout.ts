/**
 * Timeout wrapper for async operations (RPC calls, API fetches).
 *
 * Prevents the app from hanging indefinitely when RPC or external
 * services are unresponsive.
 *
 * Audit Spec §5.3 — Network Failure Scenarios.
 */
import { ERROR_CODES, ERROR_MESSAGES } from '@/config/constants';
import type { AppError } from '@/types';

/**
 * Wraps a promise with a timeout.
 * Rejects with an AppError if the promise doesn't resolve within timeoutMs.
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorCode: keyof typeof ERROR_CODES = 'RPC_TIMEOUT'
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
            const appError: AppError = {
                code: ERROR_CODES[errorCode],
                message: ERROR_MESSAGES[errorCode],
                technicalDetail: `Operation timed out after ${timeoutMs}ms`,
            };
            reject(appError);
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId!);
        return result;
    } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
    }
}

/**
 * Robust transaction confirmation using getSignatureStatus polling.
 *
 * The standard `connection.confirmTransaction()` can fail silently
 * if the WebSocket connection drops. This polls with HTTP instead.
 *
 * Audit Spec §5.4 — Transaction Confirmation Robustness.
 */
export async function confirmTransactionRobust(
    connection: { getSignatureStatus: (sig: string) => Promise<{ value: { err: unknown; confirmationStatus: string | null } | null }> },
    signature: string,
    commitment: 'confirmed' | 'finalized' = 'confirmed',
    maxTimeoutMs: number = 60_000
): Promise<boolean> {
    const start = Date.now();
    const POLL_INTERVAL_MS = 2_000;

    while (Date.now() - start < maxTimeoutMs) {
        try {
            const result = await connection.getSignatureStatus(signature);
            const status = result.value;

            if (status === null) {
                // Transaction not found yet — wait and retry
                await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
                continue;
            }

            if (status.err) {
                // Transaction found but failed on-chain
                throw {
                    code: 'TX_FAILED',
                    message: ERROR_MESSAGES.TX_FAILED,
                    technicalDetail: JSON.stringify(status.err),
                } satisfies AppError;
            }

            if (
                status.confirmationStatus === commitment ||
                status.confirmationStatus === 'finalized'
            ) {
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (err) {
            // If it's our own AppError, re-throw
            if (err && typeof err === 'object' && 'code' in err) throw err;
            // Otherwise, it's a network error — retry
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }

    // Timeout — transaction may or may not have gone through
    throw {
        code: 'TX_TIMEOUT',
        message: ERROR_MESSAGES.TX_TIMEOUT,
        technicalDetail: `Confirmation timed out after ${maxTimeoutMs}ms for signature: ${signature}`,
    } satisfies AppError;
}
