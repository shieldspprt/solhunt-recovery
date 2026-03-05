import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createCloseAccountInstruction } from '@solana/spl-token';
import type { ScanResult, CloseableAccount, ReclaimEstimate, AppError, TokenProgramId } from '@/types';
import {
    RENT_RECLAIM_FEE_PERCENT,
    RENT_RECLAIM_MIN_ACCOUNTS,
    TOKEN_ACCOUNT_RENT_LAMPORTS,
    MAX_CLOSE_PER_TX,
    TREASURY_WALLET,
    ERROR_CODES,
    ERROR_MESSAGES,
} from '@/config/constants';

/**
 * Creates an AppError with the proper shape.
 */
function createAppError(
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
 * Maps the TokenProgramId string logic to actual Program IDs if needed
 * We store string literals in the type to avoid serialization issues in Zustand
 */
function getTokenProgramPublicKey(programId: TokenProgramId): PublicKey {
    return new PublicKey(programId);
}

/**
 * Filters ScanResult to find truly empty accounts eligible for closure.
 * This is totally client-side using data already fetched by the scanner.
 */
export function getCloseableAccounts(scanResult: ScanResult | null): CloseableAccount[] {
    if (!scanResult || !scanResult.emptyAccounts) return [];

    // Re-map the raw empty accounts into our enriched CloseableAccount type
    return scanResult.emptyAccounts.map((account) => ({
        address: account.address,
        mint: account.mint,
        tokenSymbol: 'UNKNOWN', // Would need metadata fetch to resolve actual symbol
        tokenBalance: 0,        // Guaranteed by scanner logic 
        estimatedRentLamports: TOKEN_ACCOUNT_RENT_LAMPORTS,
        estimatedRentSOL: TOKEN_ACCOUNT_RENT_LAMPORTS / 1e9,
        programId: account.programId,
    }));
}

/**
 * Calculates exactly what the user will receive after our service fee.
 */
export function calculateReclaimEstimate(accounts: CloseableAccount[]): ReclaimEstimate {
    const totalAccounts = accounts.length;
    const totalLamports = totalAccounts * TOKEN_ACCOUNT_RENT_LAMPORTS;
    const totalSOL = totalLamports / 1e9;

    // Calculate service fee using integer arithmetic (Audit §2.6)
    const serviceFeeLamports = Math.floor((totalLamports * RENT_RECLAIM_FEE_PERCENT) / 100);
    const serviceFeeSOL = serviceFeeLamports / 1e9;

    // Calculate standard network fees (0.000005 SOL per signature)
    const expectedTransactions = Math.ceil(totalAccounts / MAX_CLOSE_PER_TX);
    const networkFeeSOL = expectedTransactions * 0.000005;

    const userReceivesSOL = totalSOL - serviceFeeSOL;

    return {
        totalAccounts,
        totalLamports,
        totalSOL,
        userReceivesSOL: Math.max(0, userReceivesSOL), // NEVER show negative
        serviceFeeSOL,
        networkFeeSOL,
    };
}

/**
 * Builds batched transactions to close empty token accounts.
 * Safely adds the service fee transfer to the FIRST transaction only.
 */
export async function buildReclaimTransactions(
    accounts: CloseableAccount[],
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Transaction[]> {
    // Step 1: Safety checks (Section 4.3)
    if (!accounts || accounts.length < RENT_RECLAIM_MIN_ACCOUNTS) {
        throw createAppError(
            'RECLAIM_NO_ACCOUNTS',
            `Need at least ${RENT_RECLAIM_MIN_ACCOUNTS} accounts to reclaim, got ${accounts?.length || 0}.`
        );
    }

    // Pre-calculate fee
    const estimate = calculateReclaimEstimate(accounts);
    const serviceFeeLamports = Math.floor((estimate.totalLamports * RENT_RECLAIM_FEE_PERCENT) / 100);

    // Quick sanity check: Are we taking more fee than they are reclaiming? (Should never happen with 30%)
    if (serviceFeeLamports >= estimate.totalLamports) {
        throw createAppError(
            'TX_BUILD_FAILED',
            'Calculated fee exceeds reclaimed amount. Aborting for safety.'
        );
    }

    // Step 2: Group accounts into batches of MAX_CLOSE_PER_TX
    const batches: CloseableAccount[][] = [];
    for (let i = 0; i < accounts.length; i += MAX_CLOSE_PER_TX) {
        batches.push(accounts.slice(i, i + MAX_CLOSE_PER_TX));
    }

    // Step 3: Fetch latest blockhash
    let recentBlockhash: string;
    try {
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        recentBlockhash = blockhash;
    } catch (error) {
        throw createAppError(
            'RPC_ERROR',
            `Failed to fetch blockhash: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    // Step 4: Build transactions
    const transactions: Transaction[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const transaction = new Transaction();

        // The FIRST transaction pays the service fee
        if (batchIndex === 0 && serviceFeeLamports > 0) {
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: walletPublicKey,
                    toPubkey: TREASURY_WALLET,
                    lamports: Math.floor(serviceFeeLamports), // Ensure absolute integer
                })
            );
        }

        // Add Close Account instruction for each empty account
        for (const account of batch) {
            const accountPubkey = new PublicKey(account.address);
            const programId = getTokenProgramPublicKey(account.programId);

            transaction.add(
                createCloseAccountInstruction(
                    accountPubkey,      // account to close
                    walletPublicKey,    // destination (user gets the rent back)
                    walletPublicKey,    // authority (user owns the account)
                    [],                 // multisig signers
                    programId           // SPL Token or Token-2022
                )
            );
        }

        // Finalize transaction config
        transaction.recentBlockhash = recentBlockhash;
        transaction.feePayer = walletPublicKey;

        transactions.push(transaction);
    }

    return transactions;
}
