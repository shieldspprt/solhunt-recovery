import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createBurnInstruction, createCloseAccountInstruction } from '@solana/spl-token';
import type { DustBurnEstimate, DustToken } from '@/types';
import {
    DUST_BURN_RECLAIM_FEE_PERCENT,
    DUST_MAX_BURN_CLOSE_PER_TX,
    NETWORK_FEE_PER_SIGNATURE_SOL,
    TOKEN_ACCOUNT_RENT_LAMPORTS,
} from '@/config/constants';
import { getOptimalPriorityFee, buildPriorityFeeIxs } from '@/lib/priorityFee';
import { createAppError } from '@/lib/errors';
import { verifyTransactionSecurity } from '@/lib/transactionVerifier';
import { toTokenProgramPublicKey } from '@/lib/tokenProgram';
import { chunk } from '@/lib/arrayUtils';
import { getLatestBlockhashWithRetry } from '@/lib/rpcRetry';

export interface DustBurnBatch {
    transaction: Transaction;
    tokens: DustToken[];
}

export function getBurnableDustTokens(dustTokens: DustToken[]): DustToken[] {
    return dustTokens.filter((token) => !token.isSwappable && token.uiBalance > 0);
}

export function calculateDustBurnEstimate(tokens: DustToken[]): DustBurnEstimate {
    const totalAccounts = tokens.length;
    const totalReclaimLamports = totalAccounts * TOKEN_ACCOUNT_RENT_LAMPORTS;
    const serviceFeeLamports = Math.floor((totalReclaimLamports * DUST_BURN_RECLAIM_FEE_PERCENT) / 100);
    const totalReclaimSOL = totalReclaimLamports / 1e9;
    const serviceFeeSOL = serviceFeeLamports / 1e9;
    const networkFeeSOL = Math.ceil(totalAccounts / DUST_MAX_BURN_CLOSE_PER_TX) * NETWORK_FEE_PER_SIGNATURE_SOL;
    const userReceivesSOL = Math.max(totalReclaimSOL - serviceFeeSOL, 0);

    return {
        totalAccounts,
        totalReclaimSOL,
        serviceFeeSOL,
        networkFeeSOL,
        userReceivesSOL,
    };
}

export async function buildDustBurnReclaimTransactions(
    tokens: DustToken[],
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<DustBurnBatch[]> {
    if (!tokens || tokens.length === 0) {
        throw createAppError('DUST_BURN_FAILED', 'No unswappable dust tokens available for burn/close.');
    }

    const { blockhash } = await getLatestBlockhashWithRetry(connection, 'confirmed');
    const priorityFee = await getOptimalPriorityFee(connection);
    const tokenBatches = chunk(tokens, DUST_MAX_BURN_CLOSE_PER_TX);
    const txBatches: DustBurnBatch[] = [];

    for (let batchIndex = 0; batchIndex < tokenBatches.length; batchIndex += 1) {
        const batch = tokenBatches[batchIndex];
        const tx = new Transaction();

        // Prepend priority fee instructions for faster inclusion
        for (const ix of buildPriorityFeeIxs(priorityFee)) {
            tx.add(ix);
        }

        const validTokens: DustToken[] = [];
        for (const token of batch) {
            let burnAmount: bigint;
            try {
                burnAmount = BigInt(token.rawBalance);
            } catch {
                continue;
            }

            if (burnAmount <= 0n) continue;

            const tokenAccount = new PublicKey(token.tokenAccountAddress);
            const mint = new PublicKey(token.mint);
            const programId = toTokenProgramPublicKey(token.programId);

            tx.add(
                createBurnInstruction(
                    tokenAccount,
                    mint,
                    walletPublicKey,
                    burnAmount,
                    [],
                    programId
                )
            );
            tx.add(
                createCloseAccountInstruction(
                    tokenAccount,
                    walletPublicKey,
                    walletPublicKey,
                    [],
                    programId
                )
            );
            validTokens.push(token);
        }

        if (validTokens.length === 0) {
            continue;
        }

        tx.feePayer = walletPublicKey;
        tx.recentBlockhash = blockhash;

        // Security audit: verify transaction only contains allowed instructions
        verifyTransactionSecurity(tx, walletPublicKey);

        txBatches.push({ transaction: tx, tokens: validTokens });
    }

    if (txBatches.length === 0) {
        throw createAppError('DUST_BURN_FAILED', 'No valid burn/close instructions could be built.');
    }

    return txBatches;
}
