import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
} from '@solana/web3.js';
import { TREASURY_WALLET } from '@/config/constants';
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

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.feePayer = walletPublicKey;
    tx.recentBlockhash = blockhash;
    tx.add(
        SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: TREASURY_WALLET,
            lamports: feeLamports,
        })
    );

    const signature = await sendTransaction(tx, connection);
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
        throw new Error(`Fee transfer failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
}
