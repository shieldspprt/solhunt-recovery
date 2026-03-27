import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { WhirlpoolContext, buildWhirlpoolClient } from '@orca-so/whirlpools-sdk';
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '../../constants';
import type { LPPosition } from '../../types';
import { createReadonlyWallet } from '../../utils/readonlyWallet';

export async function buildOrcaHarvestTransaction(
    positions: LPPosition[],
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Transaction> {
    const target = positions[0];
    if (!target) {
        throw new Error('No Orca positions provided for harvest.');
    }

    const ctx = WhirlpoolContext.from(
        connection,
        createReadonlyWallet(walletPublicKey) as never,
        new PublicKey(ORCA_WHIRLPOOL_PROGRAM_ID)
    );
    const client = buildWhirlpoolClient(ctx);

    const position = await client.getPosition(target.positionAddress);
    const builder = await position.collectFees(
        true,
        undefined,
        walletPublicKey,
        walletPublicKey,
        walletPublicKey
    );

    const payload = await builder.build({
        maxSupportedTransactionVersion: 'legacy',
        blockhashCommitment: 'confirmed',
    });

    if (!('instructions' in payload.transaction)) {
        throw new Error('Orca harvest returned a versioned transaction. Legacy transaction is required.');
    }

    const transaction = payload.transaction;
    transaction.feePayer = walletPublicKey;
    return transaction;
}
