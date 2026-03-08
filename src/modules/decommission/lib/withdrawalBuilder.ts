import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { DecommissionPositionItem } from '../types';
import { DECOMMISSION_SERVICE_FEE_PERCENT, DECOMMISSION_FEE_SOL_MIN } from '../constants';
import { logger } from '@/lib/logger';

export async function buildWithdrawalTransactions(
    items: DecommissionPositionItem[],
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Transaction[]> {
    const inAppItems = items.filter(i => i.recoveryMethod === 'in_app');
    if (inAppItems.length === 0) return [];

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const transactions: Transaction[] = [];

    const totalValueUSD = inAppItems
        .filter(i => i.estimatedValueUSD !== null)
        .reduce((sum, i) => sum + (i.estimatedValueUSD ?? 0), 0);

    const solPrice = 150;
    const serviceFeeUSD = totalValueUSD * (DECOMMISSION_SERVICE_FEE_PERCENT / 100);
    const serviceFeeLamports = Math.max(
        Math.floor((serviceFeeUSD / (solPrice || 140)) * 1e9),
        Math.floor(DECOMMISSION_FEE_SOL_MIN * 1e9)
    );

    for (let i = 0; i < inAppItems.length; i++) {
        const item = inAppItems[i];
        const tx = new Transaction();
        tx.feePayer = walletPublicKey;
        tx.recentBlockhash = blockhash;

        const withdrawIx = await buildWithdrawInstruction(item);

        if (!withdrawIx) {
            logger.warn('Could not build withdrawal for', item.protocol.id);
            continue;
        }

        tx.add(withdrawIx);

        if (i === inAppItems.length - 1 && serviceFeeLamports > 0 && import.meta.env.VITE_TREASURY_WALLET) {
            try {
                tx.add(SystemProgram.transfer({
                    fromPubkey: walletPublicKey,
                    toPubkey: new PublicKey(import.meta.env.VITE_TREASURY_WALLET),
                    lamports: serviceFeeLamports,
                }));
            } catch (e) {
                logger.warn('Failed to add fee transfer', e);
            }
        }

        transactions.push(tx);
    }

    return transactions;
}

async function buildWithdrawInstruction(
    item: DecommissionPositionItem
): Promise<TransactionInstruction | null> {
    switch (item.protocol.id) {
        case 'saber_amm':
            return buildSaberWithdrawInstruction(item);
        case 'friktion_volts':
            return buildFriktionWithdrawInstruction(item);
        default:
            logger.warn('No withdrawal builder for protocol:', item.protocol.id);
            return null;
    }
}

async function buildSaberWithdrawInstruction(
    _item: DecommissionPositionItem
): Promise<TransactionInstruction | null> {
    logger.warn('Saber withdrawal instruction builder: STUB — implement from IDL');
    return null;
}

async function buildFriktionWithdrawInstruction(
    _item: DecommissionPositionItem
): Promise<TransactionInstruction | null> {
    logger.warn('Friktion withdrawal instruction builder: STUB — implement from IDL');
    return null;
}
