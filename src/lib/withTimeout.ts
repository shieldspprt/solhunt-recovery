/**
 * Timeout wrapper for async operations (RPC calls, API fetches).
 *
 * Prevents the app from hanging indefinitely when RPC or external
 * services are unresponsive.
 *
 * Audit Spec §5.3 — Network Failure Scenarios.
 */
import { Connection } from '@solana/web3.js';
import { ERROR_MESSAGES } from '@/config/constants';
import { createAppError } from '@/lib/errors';
import type { AppError } from '@/types';

/**
 * Wraps a promise with a timeout.
 * Rejects with an AppError if the promise doesn't resolve within timeoutMs.
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorCode: 'RPC_TIMEOUT' | 'TX_TIMEOUT' = 'RPC_TIMEOUT'
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
            const appError: AppError = {
                code: errorCode,
                message: ERROR_MESSAGES[errorCode],
                technicalDetail: `Operation timed out after ${timeoutMs}ms`,
            };
            reject(appError);
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        return result;
    } catch (err: unknown) {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        throw err;
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
    connection: Connection,
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
                await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
                continue;
            }

            if (status.err) {
                throw createAppError(
                    'TX_FAILED',
                    JSON.stringify(status.err)
                );
            }

            if (
                status.confirmationStatus === commitment ||
                status.confirmationStatus === 'finalized'
            ) {
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (err: unknown) {
            // Re-throw if already an AppError, otherwise wrap it
            if (err && typeof err === 'object' && 'code' in err) throw err;
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }

    throw createAppError(
        'TX_TIMEOUT',
        `Confirmation timed out after ${maxTimeoutMs}ms for signature: ${signature}`
    );
}
