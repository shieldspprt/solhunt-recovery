import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
} from '@solana/web3.js';
import { createRevokeInstruction, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import type { TokenDelegation, AppError } from '@/types';
import {
    TREASURY_WALLET,
    SERVICE_FEE_SOL,
    SERVICE_FEE_LAMPORTS,
    MAX_REVOKES_PER_TX,
    NETWORK_FEE_PER_SIGNATURE_SOL,
    ERROR_CODES,
    ERROR_MESSAGES,
} from '@/config/constants';
import { getOptimalPriorityFee, buildPriorityFeeIxs } from '@/lib/priorityFee';

/**
 * Maps our TokenProgramId string to the actual PublicKey.
 */
function getTokenProgramPublicKey(programId: string): PublicKey {
    if (programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
        return TOKEN_2022_PROGRAM_ID;
    }
    return TOKEN_PROGRAM_ID;
}

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
 * Builds revoke transactions for the given delegations.
 *
 * Returns an ARRAY of transactions because Solana transactions have a size limit.
 * Each transaction contains up to MAX_REVOKES_PER_TX (15) revoke instructions.
 * The service fee transfer is added to the FIRST transaction only.
 *
 * If user signs tx 1, they pay the fee. Tx 2+ are free.
 * This is honest and intentional per spec Section 6.2.
 */
export async function buildRevokeTransaction(
    delegations: TokenDelegation[],
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Transaction[]> {
    // Step 1: Validate inputs
    if (!delegations || delegations.length === 0) {
        throw createAppError(
            'TX_BUILD_FAILED',
            'No delegations provided to revoke'
        );
    }

    // Step 2: Group delegations into batches
    const batches: TokenDelegation[][] = [];
    for (let i = 0; i < delegations.length; i += MAX_REVOKES_PER_TX) {
        batches.push(delegations.slice(i, i + MAX_REVOKES_PER_TX));
    }

    // Step 6: Fetch recent blockhash (do this once for all transactions)
    let recentBlockhash: string;
    try {
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        recentBlockhash = blockhash;
    } catch (error) {
        throw createAppError(
            'TX_BUILD_FAILED',
            `Failed to fetch blockhash: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    // Step 3–5: Build transactions
    const transactions: Transaction[] = [];
    const priorityFee = await getOptimalPriorityFee(connection);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const transaction = new Transaction();

        // Prepend priority fee instructions for faster inclusion
        for (const ix of buildPriorityFeeIxs(priorityFee)) {
            transaction.add(ix);
        }

        // Step 5: Add service fee to the FIRST transaction only
        if (batchIndex === 0) {
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: walletPublicKey,
                    toPubkey: TREASURY_WALLET,
                    lamports: SERVICE_FEE_LAMPORTS,
                })
            );
        }

        // Step 4: Add revoke instructions for each delegation in the batch
        for (const delegation of batch) {
            const tokenAccountPubkey = new PublicKey(delegation.tokenAccountAddress);
            const programId = getTokenProgramPublicKey(delegation.programId);

            transaction.add(
                createRevokeInstruction(
                    tokenAccountPubkey,
                    walletPublicKey,
                    [],
                    programId
                )
            );
        }

        // Step 6: Set blockhash and fee payer
        transaction.recentBlockhash = recentBlockhash;
        transaction.feePayer = walletPublicKey;

        transactions.push(transaction);
    }

    // Validation: verify all transactions before returning (Section 10.3)
    for (const tx of transactions) {
        if (!tx.recentBlockhash) {
            throw createAppError('TX_BUILD_FAILED', 'Transaction missing recentBlockhash');
        }
        if (!tx.feePayer) {
            throw createAppError('TX_BUILD_FAILED', 'Transaction missing feePayer');
        }
        if (tx.instructions.length > 25) {
            throw createAppError(
                'TX_BUILD_FAILED',
                `Transaction has ${tx.instructions.length} instructions, exceeds limit of 25`
            );
        }
    }

    return transactions;
}

/**
 * Estimates the total cost of a revocation session.
 * This breakdown is shown to the user in the confirm modal before signing.
 */
export function estimateTransactionCost(delegationCount: number): {
    serviceFeeSOL: number;
    networkFeeSOL: number;
    totalSOL: number;
} {
    // Number of transactions needed
    const txCount = Math.ceil(delegationCount / MAX_REVOKES_PER_TX);

    // Network fee: ~0.000005 SOL per signature
    const networkFeeSOL = txCount * NETWORK_FEE_PER_SIGNATURE_SOL;

    return {
        serviceFeeSOL: SERVICE_FEE_SOL,
        networkFeeSOL,
        totalSOL: SERVICE_FEE_SOL + networkFeeSOL,
    };
}
