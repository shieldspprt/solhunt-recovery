import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createBurnInstruction, createCloseAccountInstruction } from '@solana/spl-token';
import type { AppError, DustBurnEstimate, DustToken, TokenProgramId } from '@/types';
import {
    DUST_BURN_RECLAIM_FEE_PERCENT,
    DUST_MAX_BURN_CLOSE_PER_TX,
    ERROR_CODES,
    ERROR_MESSAGES,
    NETWORK_FEE_PER_SIGNATURE_SOL,
    TOKEN_ACCOUNT_RENT_LAMPORTS,
} from '@/config/constants';

export interface DustBurnBatch {
    transaction: Transaction;
    tokens: DustToken[];
}

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

function getTokenProgramPublicKey(programId: TokenProgramId): PublicKey {
    return new PublicKey(programId);
}

function chunk<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        batches.push(items.slice(index, index + size));
    }
    return batches;
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

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const tokenBatches = chunk(tokens, DUST_MAX_BURN_CLOSE_PER_TX);
    const txBatches: DustBurnBatch[] = [];

    for (let batchIndex = 0; batchIndex < tokenBatches.length; batchIndex += 1) {
        const batch = tokenBatches[batchIndex];
        const tx = new Transaction();

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
            const programId = getTokenProgramPublicKey(token.programId);

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
        txBatches.push({ transaction: tx, tokens: validTokens });
    }

    if (txBatches.length === 0) {
        throw createAppError('DUST_BURN_FAILED', 'No valid burn/close instructions could be built.');
    }

    return txBatches;
}
