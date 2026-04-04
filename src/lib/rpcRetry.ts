/**
 * RPC retry utilities with exponential backoff and circuit breaker pattern.
 * 
 * Features:
 * - Exponential backoff retry with fallback RPC
 * - Circuit breaker to prevent cascading failures during outages
 * 
 * All RPC calls should use retry logic to handle transient failures.
 */
import { Connection, BlockhashWithExpiryBlockHeight } from '@solana/web3.js';
import { createAppError } from '@/lib/errors';
import { getConnection, getBackupConnection } from '@/config/solana';

/** Default retry configuration */
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 5000; // Cap at 5 seconds

/** Circuit breaker configuration */
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT_MS = 30000; // 30 seconds

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with full jitter to prevent thundering herd.
 * Returns a random value between 0 and the calculated exponential delay.
 * 
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
function getJitteredDelay(attempt: number): number {
    const exponentialDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
    // Full jitter: random value between 0 and exponential delay
    return Math.floor(Math.random() * exponentialDelay);
}

/**
 * Circuit breaker states
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is open, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker implementation for RPC calls.
 * Prevents cascading failures by failing fast when a service is down.
 */
class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private nextAttempt: number = 0;

    /**
     * Execute a function with circuit breaker protection.
     * @throws AppError with code 'CIRCUIT_OPEN' if circuit is open
     */
    async execute<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw createAppError(
                    'CIRCUIT_OPEN',
                    `${operationName} temporarily unavailable. Please try again in ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s.`
                );
            }
            // Transition to half-open to test recovery
            this.state = 'HALF_OPEN';
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    private onFailure(): void {
        this.failureCount++;

        if (this.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + CIRCUIT_RESET_TIMEOUT_MS;
        }
    }

    /**
     * Get current circuit state for monitoring/debugging
     */
    getState(): { state: CircuitState; failureCount: number; nextAttempt: number | null } {
        return {
            state: this.state,
            failureCount: this.failureCount,
            nextAttempt: this.state === 'OPEN' ? this.nextAttempt : null,
        };
    }

    /**
     * Reset the circuit breaker to CLOSED state
     */
    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.nextAttempt = 0;
    }
}

/** Global circuit breaker instance for RPC calls */
export const rpcCircuitBreaker = new CircuitBreaker();

/**
 * Check if the circuit breaker is currently open (failing fast).
 * Use this to show UI warnings or skip non-essential RPC calls.
 */
export function isCircuitOpen(): boolean {
    return rpcCircuitBreaker.getState().state === 'OPEN';
}

/**
 * Executes an RPC call with circuit breaker protection and exponential backoff retry.
 * Falls back to the backup RPC if the primary fails after all retries.
 * Uses jitter to prevent thundering herd when services are under load.
 * 
 * @param rpcCall - Function that performs the RPC call
 * @param options - Retry and circuit breaker options
 * @returns Result of the RPC call
 * @throws AppError if all retries fail or circuit is open
 */
export async function withRetry<T>(
    rpcCall: (connection: Connection) => Promise<T>,
    options: {
        maxRetries?: number;
        operationName?: string;
        useCircuitBreaker?: boolean;
    } = {}
): Promise<T> {
    const { 
        maxRetries = DEFAULT_MAX_RETRIES, 
        operationName = 'RPC call',
        useCircuitBreaker = true 
    } = options;
    
    let lastError: Error | null = null;

    const executeWithRetry = async (): Promise<T> => {
        const connections = [getConnection(), getBackupConnection()];

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            for (const connection of connections) {
                try {
                    return await rpcCall(connection);
                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));
                    if (attempt < maxRetries) {
                        const delayMs = getJitteredDelay(attempt);
                        await sleep(delayMs);
                    }
                }
            }
        }

        throw createAppError(
            'RPC_ERROR',
            `${operationName} failed after ${maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`
        );
    };

    if (useCircuitBreaker) {
        return rpcCircuitBreaker.execute(executeWithRetry, operationName);
    }

    return executeWithRetry();
}

/**
 * Fetches the latest blockhash with retry, fallback RPC, and circuit breaker support.
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

/**
 * Execute an RPC call with circuit breaker but without retry logic.
 * Use this for one-shot calls where you want fast failure protection.
 */
export async function withCircuitBreaker<T>(
    fn: () => Promise<T>,
    operationName: string
): Promise<T> {
    return rpcCircuitBreaker.execute(fn, operationName);
}
