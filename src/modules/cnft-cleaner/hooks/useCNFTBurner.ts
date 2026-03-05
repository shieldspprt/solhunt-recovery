import { useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useCNFTStore } from './useCNFTStore';
import { fetchBurnProofs } from '../lib/proofFetcher';
import { buildBurnTransactions } from '../lib/burnBuilder';
import {
    BURN_SESSION_FEE_SOL,
    MAX_BURNS_PER_TX,
} from '../constants';
import { logCNFTBurnInitiated, logCNFTBurnComplete } from '@/lib/analytics';
import type { CNFTItem, BurnEstimate } from '../types';

export function useCNFTBurner() {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const store = useCNFTStore();
    const heliusRpcUrl = import.meta.env.VITE_HELIUS_RPC_URL;
    const treasuryWallet = import.meta.env.VITE_TREASURY_WALLET;

    const selectedItems = useMemo(() => {
        const allItems = Object.values(
            store.scanResult?.categories ?? {}
        ).flat() as CNFTItem[];
        return allItems.filter(
            (item) =>
                store.selectedIds.includes(item.id) && item.isBurnable
        );
    }, [store.scanResult, store.selectedIds]);

    const burnEstimate = useMemo((): BurnEstimate | null => {
        if (selectedItems.length === 0) return null;
        const numTx = Math.ceil(selectedItems.length / MAX_BURNS_PER_TX);
        return {
            selectedCount: selectedItems.length,
            sessionFeeSOL: BURN_SESSION_FEE_SOL,
            networkFeeSOL: numTx * 0.000005,
            totalCostSOL: BURN_SESSION_FEE_SOL + numTx * 0.000005,
            estimatedRecoverableSOL: 0,
        };
    }, [selectedItems]);

    /**
     * Step 1: Fetch proofs for all selected items.
     */
    const initiateBurn = useCallback(async () => {
        if (!publicKey || selectedItems.length === 0) return;

        store.setBurnStatus('fetching_proofs');
        store.setCurrentProgressText('Fetching Merkle proofs...');

        try {
            const proofs = await fetchBurnProofs(
                selectedItems.map((i) => i.id),
                heliusRpcUrl,
                (fetched, total) => {
                    store.setCurrentProgressText(
                        `Fetching proofs... ${fetched}/${total}`
                    );
                }
            );
            store.setBurnProofs(proofs);
            store.setBurnStatus('awaiting_confirmation');

            logCNFTBurnInitiated({
                selectedCount: selectedItems.length,
                spamSelected: selectedItems.filter(
                    (i) => i.category === 'spam'
                ).length,
                lowValueSelected: selectedItems.filter(
                    (i) => i.category === 'low_value'
                ).length,
                sessionFeeSOL: BURN_SESSION_FEE_SOL,
            });
        } catch {
            store.setBurnStatus('error');
            store.setBurnError(
                'Could not fetch proofs. Please try again.'
            );
        }
    }, [publicKey, selectedItems, heliusRpcUrl, store]);

    /**
     * Execute burn after user confirms.
     */
    const executeBurn = useCallback(async () => {
        if (!publicKey || !signTransaction) return;

        store.setBurnStatus('burning');

        try {
            const transactions = await buildBurnTransactions(
                selectedItems,
                store.burnProofs,
                publicKey,
                connection,
                treasuryWallet
            );

            const signatures: string[] = [];
            let burnedCount = 0;
            let failedCount = 0;

            // Transaction[0] is the session fee — send it first
            store.setCurrentProgressText('Sending session fee...');
            try {
                const feeSigned = await signTransaction(transactions[0]);
                const feeSig = await connection.sendRawTransaction(
                    feeSigned.serialize()
                );
                await connection.confirmTransaction(feeSig, 'confirmed');
                signatures.push(feeSig);
            } catch (feeErr: unknown) {
                const errMsg =
                    feeErr instanceof Error
                        ? feeErr.message
                        : 'Fee transaction failed';
                store.setBurnStatus('error');
                store.setBurnError(`Session fee failed: ${errMsg}`);
                return;
            }

            // Transactions[1..N] are individual burns
            const burnTxs = transactions.slice(1);
            for (let i = 0; i < burnTxs.length; i++) {
                store.setCurrentProgressText(
                    `Burning NFT ${i + 1} of ${burnTxs.length}...`
                );

                // Map burn tx index back to the selected item
                const batchStart = i * MAX_BURNS_PER_TX;
                const batchEnd = Math.min(
                    batchStart + MAX_BURNS_PER_TX,
                    selectedItems.length
                );
                const batchItems = selectedItems.slice(
                    batchStart,
                    batchEnd
                );

                try {
                    const signed = await signTransaction(burnTxs[i]);
                    const sig = await connection.sendRawTransaction(
                        signed.serialize()
                    );
                    await connection.confirmTransaction(sig, 'confirmed');

                    signatures.push(sig);
                    for (const item of batchItems) {
                        store.addCompletedItem({
                            assetId: item.id,
                            name: item.name,
                            success: true,
                            signature: sig,
                            errorMessage: null,
                        });
                    }
                    burnedCount += batchItems.length;
                } catch (txErr: unknown) {
                    const errMsg =
                        txErr instanceof Error
                            ? txErr.message
                            : 'Transaction failed';
                    for (const item of batchItems) {
                        store.addCompletedItem({
                            assetId: item.id,
                            name: item.name,
                            success: false,
                            signature: null,
                            errorMessage: errMsg,
                        });
                    }
                    failedCount += batchItems.length;
                }
            }

            store.setBurnResult({
                success: burnedCount > 0,
                burnedCount,
                failedCount,
                signatures,
                sessionFeeSignature: signatures[0] ?? null,
                items: useCNFTStore.getState().completedItems,
            });
            store.setBurnStatus('complete');

            logCNFTBurnComplete({
                success: burnedCount > 0,
                burnedCount,
                failedCount,
                transactionCount: transactions.length,
            });
        } catch {
            store.setBurnStatus('error');
            store.setBurnError('Burn failed. Please try again.');
        }
    }, [
        publicKey,
        signTransaction,
        selectedItems,
        store,
        connection,
        treasuryWallet,
    ]);

    return {
        selectedItems,
        selectedIds: store.selectedIds,
        burnEstimate,
        burnStatus: store.burnStatus,
        burnResult: store.burnResult,
        burnError: store.burnError,
        completedItems: store.completedItems,
        currentProgressText: store.currentProgressText,
        toggleItem: store.toggleItem,
        selectCategory: store.selectCategory,
        deselectCategory: store.deselectCategory,
        initiateBurn,
        executeBurn,
        cancelBurn: () => store.resetBurn(),
    };
}
