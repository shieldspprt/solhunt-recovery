import { ERROR_CODES, ERROR_MESSAGES } from '@/config/constants';
import type { AppError } from '@/types';

/**
 * Creates a typed AppError for consistent error handling across the app.
 * Prefer this over throwing raw Error objects when the error crosses
 * wallet-adapter boundaries or is displayed to the user.
 */
export function createAppError(
    code: keyof typeof ERROR_CODES,
    technicalDetail: string
): AppError {
    return {
        code: ERROR_CODES[code],
        message: ERROR_MESSAGES[code],
        technicalDetail,
    };
}

/**
 * Type guard to check if an error is an AppError.
 * Use this to safely narrow `unknown` or `Error` types to AppError.
 *
 * @example
 * if (isAppError(error)) {
 *   // error is now typed as AppError
 *   console.log(error.code, error.message);
 * }
 */
export function isAppError(error: unknown): error is AppError {
    return (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        typeof (error as Record<string, unknown>).code === 'string' &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string' &&
        'technicalDetail' in error &&
        typeof (error as Record<string, unknown>).technicalDetail === 'string'
    );
}

/**
 * Safely extracts an AppError from an unknown error value.
 * Falls back to creating a new AppError if the error is not already an AppError.
 */
export function toAppError(error: unknown, fallbackCode: keyof typeof ERROR_CODES = 'UNKNOWN'): AppError {
    if (isAppError(error)) {
        return error;
    }
    
    return createAppError(
        fallbackCode,
        error instanceof Error ? error.message : String(error ?? 'Unknown error')
    );
}
