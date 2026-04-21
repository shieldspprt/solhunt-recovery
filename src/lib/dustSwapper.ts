/**
 * Dust swap execution module.
 *
 * Orchestrates the full dust-to-SOL swap workflow:
 * 1. Fetches serialized swap transactions from Jupiter or Raydium
 * 2. Validates fee payer on each transaction
 * 3. Sends transactions sequentially and confirms each
 * 4. Transfers the service fee to the treasury
 *
 * All swaps are sent as VersionedTransactions (for Raydium) or
 * legacy Transactions (for Jupiter), confirmed via polling.
 */
import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    VersionedTransaction,
} from '@solana/web3.js';
import type {
    DustResult,
    DustSwapItemStatus,
    DustSwapQuote,
    DustToken,
} from '@/types';
import {
    DUST_SWAP_FEE_PERCENT,
    JUPITER_API_KEY,
    JUPITER_LITE_SWAP_API,
    JUPITER_SWAP_API,
    RAYDIUM_SWAP_TX_API,
    TREASURY_WALLET,
} from '@/config/constants';
import { getOptimalPriorityFee, buildPriorityFeeIxs } from '@/lib/priorityFee';
import { confirmTransactionRobust } from '@/lib/withTimeout';
import { createAppError } from '@/lib/errors';

/** Disassembled base64 transaction strings returned by the Raydium API. */
interface RaydiumSerializedTx {
    transaction?: string;
}

/** Raydium compute-swap transaction endpoint response shape. */
interface RaydiumSwapTxResponse {
    success?: boolean;
    data?: RaydiumSerializedTx[];
    msg?: string;
}

/** Jupiter swap endpoint response shape. */
interface JupiterSwapResponse {
    swapTransaction?: string;
}

/** Type alias for the wallet adapter's sendTransaction signature. */
type SendTransactionFn = (
    transaction: Transaction | VersionedTransaction,
    connection: Connection
) => Promise<string>;

/** Parameters for executeDustSwaps(). */
interface ExecuteDustSwapsParams {
    tokens: DustToken[];
    quotes: Map<string, DustSwapQuote>;
    walletPublicKey: PublicKey;
    connection: Connection;
    sendTransaction: SendTransactionFn;
    onProgress?: (update: { mint: string; tokenSymbol: string; status: DustSwapItemStatus; signature: string | null; receivedSOL: number; message: string }) => void;
}

/**
 * Converts a base64-encoded transaction string into a Uint8Array
 * suitable for VersionedTransaction.deserialize().
 *
 * @throws {AppError} If the base64 string is malformed
 */
function base64ToBytes(base64: string): Uint8Array {
    let binary: string;
    try {
        binary = atob(base64);
    } catch (err: unknown) {
        throw createAppError('DUST_SWAP_FAILED', `Invalid base64 in serialized transaction: ${err instanceof Error ? err.message : String(err)}`);
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

/**
 * Validates that the first account key (fee payer) on a VersionedTransaction
 * matches the connected wallet.
 *
 * @throws {AppError} If fee payer is missing or mismatched, or if recentBlockhash is absent
 */
function ensureWalletIsFeePayer(
    transaction: VersionedTransaction,
    walletPublicKey: PublicKey
): void {
    const feePayer = transaction.message.staticAccountKeys[0];
    if (!feePayer || !feePayer.equals(walletPublicKey)) {
        throw createAppError(
            'DUST_SWAP_FAILED',
            `Swap transaction fee payer mismatch. Expected ${walletPublicKey.toBase58()}.`
        );
    }

    if (!transaction.message.recentBlockhash) {
        throw createAppError('DUST_SWAP_FAILED', 'Swap transaction missing blockhash.');
    }
}

/**
 * Fetches fully-signed serialized transaction bytes from the Raydium API.
 * Converts them into VersionedTransaction objects ready to send.
 *
 * @throws {AppError} On HTTP failure or when the API returns no transactions
 */
async function fetchSerializedRaydiumTransactions(
    token: DustToken,
    quote: DustSwapQuote,
    walletAddress: string,
    priorityFeeMicroLamports: number
): Promise<VersionedTransaction[]> {
    if (!quote.rawQuote || typeof quote.rawQuote !== 'object') {
        throw createAppError(
            'DUST_SWAP_FAILED',
            `Missing quote payload for mint ${token.mint}.`
        );
    }

    const payload = {
        txVersion: 'V0',
        wallet: walletAddress,
        computeUnitPriceMicroLamports: String(priorityFeeMicroLamports),
        swapResponse: quote.rawQuote,
        wrapSol: false,
        unwrapSol: true,
        inputAccount: token.tokenAccountAddress,
    };

    const response = await fetch(RAYDIUM_SWAP_TX_API, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw createAppError(
            'ROUTER_UNAVAILABLE',
            `Raydium swap transaction request failed (${response.status}) for ${token.mint}.`
        );
    }

    const body = (await response.json()) as RaydiumSwapTxResponse;
    if (!body.success || !body.data || body.data.length === 0) {
        throw createAppError(
            'DUST_SWAP_FAILED',
            `Raydium swap payload invalid for ${token.mint}: ${body.msg || 'No transactions returned.'}`
        );
    }

    return body.data
        .map((entry) => entry.transaction || '')
        .filter((base64) => base64.length > 0)
        .map((base64) => VersionedTransaction.deserialize(base64ToBytes(base64)));
}

/**
 * Awaits confirmation of a signature using the robust poller.
 * Wraps confirmTransactionRobust for caller ergonomics.
 */
async function confirmSignature(connection: Connection, signature: string): Promise<void> {
    await confirmTransactionRobust(connection, signature, 'confirmed');
}

/**
 * Transfers the service fee to the treasury wallet after all swaps complete.
 * Calculates DUST_SWAP_FEE_PERCENT of the total lamports received.
 *
 * @returns The signature of the fee transfer, or null if the fee amount is zero
 */
async function sendFeeTransfer(
    walletPublicKey: PublicKey,
    connection: Connection,
    sendTransaction: SendTransactionFn,
    totalReceivedLamports: number
): Promise<string | null> {
    const feeLamports = Math.floor((totalReceivedLamports * DUST_SWAP_FEE_PERCENT) / 100);
    if (feeLamports <= 0) {
        return null;
    }

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const priorityFee = await getOptimalPriorityFee(connection);
    const feeTx = new Transaction();
    for (const ix of buildPriorityFeeIxs(priorityFee)) {
        feeTx.add(ix);
    }
    feeTx.add(
        SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: TREASURY_WALLET,
            lamports: feeLamports,
        })
    );
    feeTx.feePayer = walletPublicKey;
    feeTx.recentBlockhash = blockhash;

    const feeSignature = await sendTransaction(feeTx, connection);
    await confirmSignature(connection, feeSignature);
    return feeSignature;
}

/**
 * Returns a human-readable label for a dust token.
 * Uses the resolved symbol when available, falls back to the first 6 chars of the mint.
 */
function tokenLabel(token: DustToken): string {
    return token.tokenSymbol !== 'UNKNOWN' ? token.tokenSymbol : token.mint.slice(0, 6);
}

/** API source descriptor used to iterate Jupiter swap endpoints. */
interface ApiSource {
    url: string;
    headers?: Record<string, string>;
}

/**
 * Returns the available Jupiter swap API sources in priority order.
 * The API-keyed endpoint is tried first; the public lite endpoint is the fallback.
 */
function getJupiterSwapSources(): ApiSource[] {
    const sources: ApiSource[] = [];
    if (JUPITER_API_KEY) {
        sources.push({
            url: JUPITER_SWAP_API,
            headers: { 'x-api-key': JUPITER_API_KEY },
        });
    }
    sources.push({ url: JUPITER_LITE_SWAP_API });
    return sources;
}

/**
 * Fetches a signed transaction from the Jupiter swap API.
 * Tries all available sources (paid + free) until one succeeds.
 *
 * @throws {AppError} When all sources fail or return no transaction
 */
async function fetchSerializedJupiterTransactions(
    quote: DustSwapQuote,
    walletAddress: string
): Promise<VersionedTransaction[]> {
    if (!quote.rawQuote || typeof quote.rawQuote !== 'object') {
        throw createAppError(
            'DUST_SWAP_FAILED',
            `Missing Jupiter quote payload for mint ${quote.inputMint}.`
        );
    }

    const body = {
        quoteResponse: quote.rawQuote,
        userPublicKey: walletAddress,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
    };

    for (const source of getJupiterSwapSources()) {
        let response = await fetch(source.url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(source.headers || {}),
            },
            body: JSON.stringify(body),
        });

        if (response.status === 429) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            response = await fetch(source.url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    ...(source.headers || {}),
                },
                body: JSON.stringify(body),
            });
        }

        if (!response.ok) {
            continue;
        }

        const payload = (await response.json()) as JupiterSwapResponse;
        if (!payload.swapTransaction) {
            continue;
        }

        return [VersionedTransaction.deserialize(base64ToBytes(payload.swapTransaction))];
    }

    throw createAppError('ROUTER_UNAVAILABLE', 'Jupiter swap transaction endpoint unavailable.');
}

/**
 * Executes dust token swaps for a batch of tokens with obtained swap quotes.
 *
 * Process:
 * 1. Iterates each selected token with a valid quote
 * 2. Fetches serialized swap transactions from Jupiter or Raydium
 * 3. Validates fee payer, sends, and confirms each transaction
 * 4. Transfers service fee to treasury on success
 *
 * @param params.tokens - Dust tokens selected for swapping
 * @param params.quotes - Pre-fetched swap quotes keyed by mint address
 * @param params.walletPublicKey - Connected wallet public key
 * @param params.connection - Solana RPC connection
 * @param params.sendTransaction - Wallet adapter sendTransaction function
 * @param params.onProgress - Optional callback to report per-token progress
 * @returns DustResult summarising swapped count, failures, and lamports received
 */
export async function executeDustSwaps(params: ExecuteDustSwapsParams): Promise<DustResult> {
    const {
        tokens,
        quotes,
        walletPublicKey,
        connection,
        sendTransaction,
        onProgress,
    } = params;

    const signatures: string[] = [];
    let swappedCount = 0;
    let failedCount = 0;
    let receivedLamports = 0;
    let sessionErrorMessage: string | null = null;

    const priorityFeeMicroLamports = await getOptimalPriorityFee(connection);

    for (const token of tokens) {
        const quote = quotes.get(token.mint);
        const label = tokenLabel(token);

        if (!quote) {
            failedCount += 1;
            onProgress?.({
                mint: token.mint,
                tokenSymbol: label,
                status: 'skipped',
                signature: null,
                receivedSOL: 0,
                message: 'No swap quote available.',
            });
            continue;
        }

        onProgress?.({
            mint: token.mint,
            tokenSymbol: label,
            status: 'swapping',
            signature: null,
            receivedSOL: 0,
            message: 'Preparing swap transaction...',
        });

        try {
            const transactions = quote.provider === 'jupiter'
                ? await fetchSerializedJupiterTransactions(quote, walletPublicKey.toBase58())
                : await fetchSerializedRaydiumTransactions(
                    token,
                    quote,
                    walletPublicKey.toBase58(),
                    priorityFeeMicroLamports
                );

            let lastSignature: string | null = null;
            for (const tx of transactions) {
                ensureWalletIsFeePayer(tx, walletPublicKey);
                const signature = await sendTransaction(tx, connection);
                await confirmTransactionRobust(connection, signature);
                signatures.push(signature);
                lastSignature = signature;
            }

            swappedCount += 1;
            receivedLamports += Number.parseInt(quote.outAmount, 10);
            onProgress?.({
                mint: token.mint,
                tokenSymbol: label,
                status: 'success',
                signature: lastSignature,
                receivedSOL: quote.outAmountSOL,
                message: `Swapped for ~${quote.outAmountSOL.toFixed(6)} SOL.`,
            });
        } catch (err: unknown) {
            failedCount += 1;
            const detail = err instanceof Error ? err.message : String(err);
            sessionErrorMessage = detail;
            onProgress?.({
                mint: token.mint,
                tokenSymbol: label,
                status: 'failed',
                signature: null,
                receivedSOL: 0,
                message: detail,
            });
        }
    }

    try {
        const feeSignature = await sendFeeTransfer(
            walletPublicKey,
            connection,
            sendTransaction,
            receivedLamports
        );
        if (feeSignature) {
            signatures.push(feeSignature);
        }
    } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : String(err);
        sessionErrorMessage = sessionErrorMessage
            ? `${sessionErrorMessage} | Fee transfer failed: ${detail}`
            : `Fee transfer failed: ${detail}`;
    }

    const receivedSOL = receivedLamports / 1e9;
    const success = swappedCount > 0 && failedCount === 0 && !sessionErrorMessage;

    return {
        success,
        swappedCount,
        failedCount,
        receivedSOL,
        signatures,
        errorMessage: sessionErrorMessage,
    };
}
