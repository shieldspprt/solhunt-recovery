import type { Connection, PublicKey, Transaction } from '@solana/web3.js';
import type { LPPosition } from '../../types';

export async function buildRaydiumHarvestTransaction(
    positions: LPPosition[],
    _walletPublicKey: PublicKey,
    _connection: Connection
): Promise<Transaction> {
    const target = positions[0];
    if (!target) {
        throw new Error('No Raydium positions provided for harvest.');
    }

    if (target.protocol === 'raydium_amm') {
        throw new Error(
            'Raydium standard AMM fees are embedded in LP value and require liquidity withdrawal to realize.'
        );
    }

    throw new Error(
        'Raydium CLMM harvest route is temporarily unavailable with the current SDK build. Rescan and retry later.'
    );
}
