/**
 * Centralized transaction sender with Jito bundle support.
 *
 * Submits signed transactions to the Jito Block Engine first for
 * faster inclusion, then falls back to standard RPC if Jito fails.
 * Adds a small tip to a random Jito tip account.
 */
import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    VersionedTransaction,
    type TransactionInstruction,
} from '@solana/web3.js';
import { ERROR_CODES, ERROR_MESSAGES } from '@/config/constants';
import type { AppError } from '@/types';

// ─── Jito Configuration ──────────────────────────────────────

/** Jito Block Engine URL for mainnet */
export const JITO_BLOCK_ENGINE_URL = 'https://mainnet.block-engine.jito.wtf';

/** Jito tip accounts — pick one at random per session */
export const JITO_TIP_ACCOUNTS = [
    'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
    'DttWaMuVvTiDuNYK4QnkXjMXB3C43nD7LCzpkk4Gv7tM',
    'HFqU5x63VTqvQss8hp11i4bPg73ip5Q6T2EYP4LBkCPa',
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
    'ADaUMid9yfUC5Qs6A3xcoG9t1n6WLwpABywey7QyQoL3',
    'ADuUkR4vqLUMWXxW9gh6D6L8pMSgbwvN65aSzD7KCK2U',
    'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
    '3AVi9Tg9Uo68tJfuvoKvqKNWKkS5URFMYA6gT1w2ndqW',
];

/** Jito tip: ~0.00005 SOL (50,000 lamports) — modest tip for inclusion priority */
export const JITO_TIP_LAMPORTS = 50_000;

// ─── Helpers ──────────────────────────────────────────────

function getRandomTipAccount(): PublicKey {
    const index = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
    return new PublicKey(JITO_TIP_ACCOUNTS[index]);
}

/**
 * Build a Jito tip instruction to add to a transaction.
 */
export function buildJitoTipIx(
    fromPubkey: PublicKey,
    tipLamports: number = JITO_TIP_LAMPORTS
): TransactionInstruction {
    return SystemProgram.transfer({
        fromPubkey,
        toPubkey: getRandomTipAccount(),
        lamports: tipLamports,
    });
}

/**
 * Submit a signed transaction via Jito Block Engine.
 * Returns the signature string on success.
 */
async function submitToJito(
    serializedTx: Uint8Array
): Promise<string> {
    const base58Tx = Buffer.from(serializedTx).toString('base64');

    const response = await fetch(`${JITO_BLOCK_ENGINE_URL}/api/v1/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sendTransaction',
            params: [base58Tx, { encoding: 'base64' }],
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Jito submission failed (${response.status}): ${text}`);
    }

    const result = await response.json();
    if (result.error) {
        throw new Error(`Jito RPC error: ${JSON.stringify(result.error)}`);
    }

    return result.result as string;
}

/**
 * Confirms a transaction with a hard timeout, preventing indefinite hangs.
 */
function confirmWithTimeout(
    connection: Connection,
    signature: string,
    blockhash: string,
    lastValidBlockHeight: number,
    commitment: 'confirmed' | 'finalized' = 'confirmed',
    timeoutMs: number = 60_000
): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject({
                code: ERROR_CODES.TX_TIMEOUT,
                message: ERROR_MESSAGES.TX_TIMEOUT,
                technicalDetail: `Confirmation timed out after ${timeoutMs}ms for signature: ${signature}`,
            } satisfies AppError);
        }, timeoutMs);

        connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            commitment
        ).then((result) => {
            clearTimeout(timer);
            if (result.value.err) {
                reject({
                    code: ERROR_CODES.TX_FAILED,
                    message: ERROR_MESSAGES.TX_FAILED,
                    technicalDetail: JSON.stringify(result.value.err),
                } satisfies AppError);
            } else {
                resolve();
            }
        }).catch((err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

/**
 * Send a signed (legacy OR versioned) transaction with Jito-first strategy.
 *
 * 1. Try Jito Block Engine for faster block inclusion
 * 2. Fall back to standard RPC if Jito fails
 * 3. Confirm the transaction with a hard timeout
 */
export async function sendWithJito(
    signedTx: Transaction | VersionedTransaction,
    connection: Connection
): Promise<string> {
    const serialized = signedTx.serialize();
    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
    let signature: string;

    try {
        signature = await submitToJito(serialized as Uint8Array);
    } catch (jitoError) {
        // Jito failed — fall back to standard RPC with timeout
        try {
            signature = await connection.sendRawTransaction(serialized as Buffer, {
                skipPreflight: true,
                maxRetries: 3,
            });
        } catch (rpcError) {
            const appError: AppError = {
                code: ERROR_CODES.RPC_ERROR,
                message: ERROR_MESSAGES.RPC_ERROR,
                technicalDetail: `Jito failed: ${jitoError instanceof Error ? jitoError.message : String(jitoError)}. RPC fallback also failed: ${rpcError instanceof Error ? rpcError.message : String(rpcError)}`,
            };
            throw appError;
        }
    }

    await confirmWithTimeout(connection, signature, blockhash, lastValidBlockHeight);

    return signature;
}

/**
 * Send a signed transaction via standard RPC with retries and
 * skipPreflight for speed. No Jito.
 */
export async function sendWithRetry(
    signedTx: Transaction | VersionedTransaction,
    connection: Connection
): Promise<string> {
    const serialized = signedTx.serialize();

    const signature = await connection.sendRawTransaction(serialized as Buffer, {
        skipPreflight: true,
        maxRetries: 3,
    });

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

    await confirmWithTimeout(connection, signature, blockhash, lastValidBlockHeight);

    return signature;
}
