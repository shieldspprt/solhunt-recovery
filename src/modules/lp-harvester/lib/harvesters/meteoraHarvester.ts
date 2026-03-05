import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import type { LPPosition } from '../../types';

interface MeteoraSdk {
    create: (connection: Connection, pool: PublicKey) => Promise<MeteoraPool>;
}

interface MeteoraPool {
    getPosition: (positionPublicKey: PublicKey) => Promise<unknown>;
    claimAllRewardsByPosition?: (args: {
        owner: PublicKey;
        position: unknown;
    }) => Promise<Transaction[]>;
    claimSwapFee?: (args: {
        owner: PublicKey;
        position: unknown;
    }) => Promise<Transaction[]>;
}

export async function buildMeteoraHarvestTransaction(
    position: LPPosition,
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Transaction> {
    const module = await import('@meteora-ag/dlmm');
    const DlmmCtor = (module as { default?: unknown }).default;

    if (!DlmmCtor || typeof DlmmCtor !== 'object' || !('create' in DlmmCtor)) {
        throw new Error('Meteora SDK is unavailable in this environment.');
    }

    const meteoraSdk = DlmmCtor as MeteoraSdk;
    const pool = await meteoraSdk.create(connection, new PublicKey(position.poolAddress));
    const lbPosition = await pool.getPosition(new PublicKey(position.positionAddress));

    let txs: Transaction[] = [];
    if (typeof pool.claimAllRewardsByPosition === 'function') {
        txs = await pool.claimAllRewardsByPosition({
            owner: walletPublicKey,
            position: lbPosition,
        });
    }

    if (txs.length === 0 && typeof pool.claimSwapFee === 'function') {
        txs = await pool.claimSwapFee({
            owner: walletPublicKey,
            position: lbPosition,
        });
    }

    const transaction = txs[0];
    if (!transaction) {
        throw new Error('Meteora did not return a claim transaction for this position.');
    }

    if (!transaction.feePayer) {
        transaction.feePayer = walletPublicKey;
    }

    if (!transaction.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
    }

    return transaction;
}
