import type { WalletContextState } from '@solana/wallet-adapter-react';
import {
    Connection,
    PublicKey,
    Transaction,
    VersionedTransaction,
} from '@solana/web3.js';
import { LP_ERROR_MESSAGES } from '../../constants';
import { getOptimalPriorityFee, buildPriorityFeeIxs } from '@/lib/priorityFee';
import { fetchTokenPrices } from '../pricer';
import { calculateServiceFeeSOL, collectServiceFee } from '../feeCalculator';
import { isCompoundAllowed } from '../validator';
import { buildOrcaHarvestTransaction } from './orcaHarvester';
import { buildRaydiumHarvestTransaction } from './raydiumHarvester';
import { buildMeteoraHarvestTransaction } from './meteoraHarvester';
import { confirmTransactionRobust } from '@/lib/withTimeout';
import { verifyTransactionSecurity } from '@/lib/transactionVerifier';
import type {
    CompoundResult,
    HarvestResult,
    HarvestResultItem,
    LPPosition,
} from '../../types';

interface HarvestRunnerParams {
    positions: LPPosition[];
    willCompound: boolean;
    walletPublicKey: PublicKey;
    signTransaction: WalletContextState['signTransaction'];
    sendTransaction: WalletContextState['sendTransaction'];
    connection: Connection;
    onProgress: (item: HarvestResultItem) => void;
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error || 'Unknown error');
}

function cloneTokenAmount(position: LPPosition, side: 'A' | 'B') {
    return side === 'A'
        ? { ...position.unclaimedFeeA }
        : { ...position.unclaimedFeeB };
}

function buildSuccessItem(position: LPPosition, signature: string): HarvestResultItem {
    return {
        positionId: position.id,
        positionAddress: position.positionAddress,
        protocol: position.protocol,
        poolName: position.poolName,
        success: true,
        harvestedFeeA: cloneTokenAmount(position, 'A'),
        harvestedFeeB: cloneTokenAmount(position, 'B'),
        harvestedValueUSD: position.totalFeeValueUSD,
        signature,
        errorMessage: null,
    };
}

function buildFailureItem(position: LPPosition, errorMessage: string): HarvestResultItem {
    return {
        positionId: position.id,
        positionAddress: position.positionAddress,
        protocol: position.protocol,
        poolName: position.poolName,
        success: false,
        harvestedFeeA: null,
        harvestedFeeB: null,
        harvestedValueUSD: 0,
        signature: null,
        errorMessage,
    };
}

async function compoundHarvestedFees(
    positions: LPPosition[],
    harvestItems: HarvestResultItem[],
    walletPublicKey: PublicKey,
    signTransaction: WalletContextState['signTransaction'],
    connection: Connection
): Promise<CompoundResult> {
    void walletPublicKey;
    void signTransaction;
    void connection;

    const successfulPositionIds = new Set(
        harvestItems
            .filter((item) => item.success)
            .map((item) => item.positionId)
    );
    const inRange = positions
        .filter((position) => successfulPositionIds.has(position.id))
        .filter((position) => isCompoundAllowed(position).isValid);

    if (inRange.length === 0) {
        return {
            success: true,
            tokensSwapped: 0,
            solAddedToPositions: 0,
            signatures: [],
            errorMessage: null,
        };
    }

    return {
        success: false,
        tokensSwapped: 0,
        solAddedToPositions: 0,
        signatures: [],
        errorMessage: LP_ERROR_MESSAGES.LP_COMPOUND_FAILED,
    };
}

async function buildProtocolHarvestTransaction(
    position: LPPosition,
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Transaction | VersionedTransaction> {
    let tx: Transaction | VersionedTransaction;

    if (position.protocol === 'orca') {
        tx = await buildOrcaHarvestTransaction([position], walletPublicKey, connection);
    } else if (position.protocol === 'meteora') {
        tx = await buildMeteoraHarvestTransaction(position, walletPublicKey, connection);
    } else {
        tx = await buildRaydiumHarvestTransaction([position], walletPublicKey, connection);
    }

    // Ensure recentBlockhash is set before adding priority fees and sending.
    // Individual harvesters may not set it (e.g. orca builder leaves it to caller).
    if (tx instanceof Transaction && !tx.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
    }

    // Add priority fee instructions to legacy transactions (prepended)
    if (tx instanceof Transaction) {
        const priorityFee = await getOptimalPriorityFee(connection);
        const priorityIxs = buildPriorityFeeIxs(priorityFee);
        tx.instructions = [...priorityIxs, ...tx.instructions];
    }

    return tx;
}

export async function harvestAllPositions(
    positions: HarvestRunnerParams['positions'],
    willCompound: HarvestRunnerParams['willCompound'],
    walletPublicKey: HarvestRunnerParams['walletPublicKey'],
    signTransaction: HarvestRunnerParams['signTransaction'],
    sendTransaction: HarvestRunnerParams['sendTransaction'],
    connection: HarvestRunnerParams['connection'],
    onProgress: HarvestRunnerParams['onProgress']
): Promise<HarvestResult> {
    if (!positions || positions.length === 0) {
        return {
            success: false,
            totalHarvested: 0,
            totalFailed: 0,
            totalValueUSD: 0,
            totalValueSOL: 0,
            serviceFeeSOL: 0,
            feeSignature: null,
            items: [],
            compoundAttempted: willCompound,
            compoundResult: null,
        };
    }

    const items: HarvestResultItem[] = [];

    for (const position of positions) {
        try {
            const transaction = await buildProtocolHarvestTransaction(
                position,
                walletPublicKey,
                connection
            );

            // Security audit: verify transaction only contains allowed instructions before signing
            verifyTransactionSecurity(transaction, walletPublicKey);

            const signature = await sendTransaction(transaction, connection);
            await confirmTransactionRobust(connection, signature);

            const successItem = buildSuccessItem(position, signature);
            items.push(successItem);
            onProgress(successItem);
        } catch (error: unknown) {
            const failedItem = buildFailureItem(position, toErrorMessage(error));
            items.push(failedItem);
            onProgress(failedItem);
        }
    }

    const successfulItems = items.filter((item) => item.success);
    const totalValueUSD = successfulItems.reduce((sum, item) => sum + item.harvestedValueUSD, 0);

    const prices = await fetchTokenPrices(['So11111111111111111111111111111111111111112']);
    const solPriceUSD = prices.get('So11111111111111111111111111111111111111112') || 0;
    const totalValueSOL = solPriceUSD > 0 ? totalValueUSD / solPriceUSD : 0;

    let feeSignature: string | null = null;
    if (successfulItems.length > 0) {
        try {
            feeSignature = await collectServiceFee({
                harvestResult: {
                    success: true,
                    totalHarvested: successfulItems.length,
                    totalFailed: 0,
                    totalValueUSD,
                    totalValueSOL,
                    serviceFeeSOL: 0,
                    items,
                    compoundAttempted: willCompound,
                    compoundResult: null,
                },
                willCompound,
                walletPublicKey,
                sendTransaction,
                connection,
                prices,
            });
        } catch {
            // Do not fail whole harvest if service-fee transfer fails.
        }
    }

    let compoundResult: CompoundResult | null = null;
    if (willCompound && successfulItems.length > 0) {
        compoundResult = await compoundHarvestedFees(
            positions,
            items,
            walletPublicKey,
            signTransaction,
            connection
        );
    }

    const totalFailed = items.length - successfulItems.length;

    return {
        success: totalFailed === 0 && (!willCompound || !!compoundResult?.success),
        totalHarvested: successfulItems.length,
        totalFailed,
        totalValueUSD,
        totalValueSOL,
        serviceFeeSOL: calculateServiceFeeSOL(items, willCompound, solPriceUSD),
        feeSignature,
        items,
        compoundAttempted: willCompound,
        compoundResult,
    };
}
