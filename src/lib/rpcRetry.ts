/**
 * RPC retry utilities with exponential backoff for Solana dApp Store compliance.
 *
 * All RPC calls should use retry logic to handle transient failures.
 */
import { Connection, BlockhashWithExpiryBlockHeight } from '@solana/web3.js';
import { createAppError } from '@/lib/errors';
import { getConnection, getBackupConnection } from '@/config/solana';

/** Default retry configuration */
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an RPC call with exponential backoff retry.
 * Falls back to the backup RPC if the primary fails after all retries.
 */
export async function withRetry<T>(
    rpcCall: (connection: Connection) => Promise<T>,
    options: {
        maxRetries?: number;
        operationName?: string;
    } = {}
): Promise<T> {
    const { maxRetries = DEFAULT_MAX_RETRIES, operationName = 'RPC call' } = options;
    let lastError: Error | null = null;

    const connections = [getConnection(), getBackupConnection()];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        for (const connection of connections) {
            try {
                return await rpcCall(connection);
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                if (attempt < maxRetries) {
                    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
                    await sleep(delayMs);
                }
            }
        }
    }

    throw createAppError(
        'RPC_ERROR',
        `${operationName} failed after ${maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`
    );
}

/**
 * Fetches the latest blockhash with retry and fallback RPC support.
 * Returns { blockhash, lastValidBlockHeight } for transaction building.
 */
export async function getLatestBlockhashWithRetry(
    _connection?: Connection,
    commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
): Promise<BlockhashWithExpiryBlockHeight> {
    return withRetry(
        (conn) => conn.getLatestBlockhash(commitment),
        { operationName: 'getLatestBlockhash' }
    );
}
