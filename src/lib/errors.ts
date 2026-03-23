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
