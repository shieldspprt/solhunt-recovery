import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
} from '@solana/web3.js';
import { TREASURY_WALLET } from '@/config/constants';
import { getOptimalPriorityFee, buildPriorityFeeIxs } from '@/lib/priorityFee';
import {
    HARVEST_COMPOUND_FEE_PERCENT,
    HARVEST_FEE_PERCENT,
} from '../constants';
import { getSOLPriceUSD } from './pricer';
import type { HarvestResult, HarvestResultItem } from '../types';

type SendTransactionFn = (
    transaction: Transaction,
    connection: Connection
) => Promise<string>;

function getSuccessfulHarvestItems(items: HarvestResultItem[]): HarvestResultItem[] {
    return items.filter((item) => item.success && item.harvestedValueUSD > 0);
}

export function calculateServiceFeeSOL(
    items: HarvestResultItem[],
    willCompound: boolean,
    solPriceUSD: number
): number {
    const harvestedUSD = getSuccessfulHarvestItems(items)
        .reduce((sum, item) => sum + item.harvestedValueUSD, 0);
    if (harvestedUSD <= 0 || solPriceUSD <= 0) return 0;

    const feePercent = willCompound ? HARVEST_COMPOUND_FEE_PERCENT : HARVEST_FEE_PERCENT;
    const feeUSD = harvestedUSD * (feePercent / 100);
    return feeUSD / solPriceUSD;
}

export function calculateServiceFeePercent(willCompound: boolean): number {
    return willCompound ? HARVEST_COMPOUND_FEE_PERCENT : HARVEST_FEE_PERCENT;
}

/**
 * Confirms a transaction with a hard timeout to prevent indefinite hangs.
 */
async function confirmWithTimeout(
    connection: Connection,
    signature: string,
    blockhash: string,
    lastValidBlockHeight: number,
    timeoutMs: number = 60_000
): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Confirmation timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed'
        ).then((result: { value: { err: unknown } }) => {
            clearTimeout(timer);
            if (result.value.err) {
                reject(new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`));
            } else {
                resolve();
            }
        }).catch((err: unknown) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

export async function collectServiceFee(params: {
    harvestResult: Omit<HarvestResult, 'feeSignature'>;
    willCompound: boolean;
    walletPublicKey: PublicKey;
    sendTransaction: SendTransactionFn;
    connection: Connection;
    prices: Map<string, number>;
}): Promise<string | null> {
    const {
        harvestResult,
        willCompound,
        walletPublicKey,
        sendTransaction,
        connection,
        prices,
    } = params;

    const solPriceUSD = getSOLPriceUSD(prices);
    const feeSOL = calculateServiceFeeSOL(harvestResult.items, willCompound, solPriceUSD);
    const feeLamports = Math.floor(feeSOL * 1e9);

    if (feeLamports <= 0) return null;

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const priorityFee = await getOptimalPriorityFee(connection);
    const tx = new Transaction();
    tx.feePayer = walletPublicKey;
    tx.recentBlockhash = blockhash;
    // Add priority fee instructions
    for (const ix of buildPriorityFeeIxs(priorityFee)) {
        tx.add(ix);
    }
    tx.add(
        SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: TREASURY_WALLET,
            lamports: feeLamports,
        })
    );

    const signature = await sendTransaction(tx, connection);
    await confirmWithTimeout(connection, signature, blockhash, lastValidBlockHeight);

    return signature;
}
