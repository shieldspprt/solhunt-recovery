/**
 * Production-safe logger.
 *
 * In development: logs to console.
 * In production: silences console output to prevent data leakage
 * (wallet addresses, balances, transaction details).
 *
 * Audit Spec §2.11 — Error Information Leakage Prevention.
 */
import { IS_PRODUCTION } from '@/config/constants';

export const logger = {
    log: (...args: unknown[]): void => {
        if (!IS_PRODUCTION) console.log(...args);
    },
    warn: (...args: unknown[]): void => {
        if (!IS_PRODUCTION) console.warn(...args);
    },
    error: (context: string, err?: unknown): void => {
        if (!IS_PRODUCTION) console.error(context, err);
        // In production: errors are sent to Firebase Analytics
        // via the existing logScanError / logEvent system.
    },
};
