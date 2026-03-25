import { useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useAppStore } from './useAppStore';
import { fetchMEVClaims } from '@/lib/mevScanner';
import { buildMEVClaimTransactions } from '@/lib/mevClaimBuilder';
import { confirmTransactionRobust } from '@/lib/withTimeout';
import {
    logMEVScanStarted,
    logMEVScanComplete,
    logMEVClaimInitiated,
    logMEVClaimComplete,
} from '@/lib/analytics';
import {
    MEV_SERVICE_FEE_PERCENT,
    MEV_SERVICE_FEE_DENOMINATOR,
    MEV_MAX_CLAIMS_PER_TX,
} from '@/config/constants';
import { verifyTransactionSecurity } from '@/lib/transactionVerifier';
import type { MEVScanResult, MEVClaimEstimate, MEVClaimResultItem } from '@/types';
import { logger } from '@/lib/logger';

export function useMEVClaims() {
    const { publicKey, signTransaction, sendTransaction } = useWallet();
    const { connection } = useConnection();

    const mevScanStatus = useAppStore((s) => s.mevScanStatus);
    const mevScanResult = useAppStore((s) => s.mevScanResult);
    const mevClaimStatus = useAppStore((s) => s.mevClaimStatus);
    const mevClaimResult = useAppStore((s) => s.mevClaimResult);
    const selectedMEVIds = useAppStore((s) => s.selectedMEVIds);

    const setMEVScanStatus = useAppStore((s) => s.setMEVScanStatus);
    const setMEVScanResult = useAppStore((s) => s.setMEVScanResult);
    const setMEVClaimStatus = useAppStore((s) => s.setMEVClaimStatus);
    const setMEVClaimResult = useAppStore((s) => s.setMEVClaimResult);
    const setSelectedMEVIds = useAppStore((s) => s.setSelectedMEVIds);
    const setMEVClaimError = useAppStore((s) => s.setMEVClaimError);
    const setMEVProgressText = useAppStore((s) => s.setMEVProgressText);
    const resetMEVClaim = useAppStore((s) => s.resetMEVClaim);
    const toggleMEVItem = useAppStore((s) => s.toggleMEVItem);
    const selectAllMEV = useAppStore((s) => s.selectAllMEV);
    const deselectAllMEV = useAppStore((s) => s.deselectAllMEV);

    // Called by Engine 4's main scan — not directly by user
    const scanMEVClaims = useCallback(async () => {
        if (!publicKey) return;

        setMEVScanStatus('scanning');
        logMEVScanStarted();

        const items = await fetchMEVClaims(publicKey.toString());

        if (items.length === 0) {
            setMEVScanStatus('no_rewards');
            setMEVScanResult(null);
            return;
        }

        const totalClaimableSOL = items.reduce((s, i) => s + i.totalSOL, 0);

        const result: MEVScanResult = {
            scannedAt: new Date(),
            totalItems: items.length,
            totalClaimableSOL,
            totalClaimableUSD: items.reduce((s, i) => s + i.estimatedValueUSD, 0),
            items,
            epochsScanned: [...new Set(items.map((i) => i.epoch))].sort(),
            oldestEpoch: Math.min(...items.map((i) => i.epoch)),
            newestEpoch: Math.max(...items.map((i) => i.epoch)),
        };

        setMEVScanResult(result);
        setMEVScanStatus('scan_complete');
        setSelectedMEVIds(items.map((i) => `${i.stakeAccount}-${i.epoch}`));

        logMEVScanComplete({
            totalItems: result.totalItems,
            claimableSOL: result.totalClaimableSOL,
            hasErrors: false,
        });
    }, [publicKey, setMEVScanStatus, setMEVScanResult, setSelectedMEVIds]);

    const selectedItems = useMemo(() => {
        const allItems = mevScanResult?.items ?? [];
        return allItems.filter((i) =>
            selectedMEVIds.includes(`${i.stakeAccount}-${i.epoch}`)
        );
    }, [mevScanResult, selectedMEVIds]);

    const claimEstimate = useMemo((): MEVClaimEstimate | null => {
        if (selectedItems.length === 0) return null;
        const totalLamports = selectedItems.reduce((s, i) => s + i.totalLamports, 0);
        const totalSOL = totalLamports / LAMPORTS_PER_SOL;
        const serviceFeeLamports = Math.floor(
            (totalLamports * MEV_SERVICE_FEE_PERCENT) / Math.max(1, MEV_SERVICE_FEE_DENOMINATOR)
        );
        const txCount = Math.ceil(selectedItems.length / MEV_MAX_CLAIMS_PER_TX);

        return {
            selectedCount: selectedItems.length,
            totalClaimSOL: totalSOL,
            totalClaimUSD: totalSOL * 150, // Hardcoded estimate
            serviceFeeSOL: serviceFeeLamports / LAMPORTS_PER_SOL,
            serviceFeeLamports,
            networkFeeSOL: txCount * 0.000005,
            netReceivedSOL: totalSOL - serviceFeeLamports / LAMPORTS_PER_SOL,
        };
    }, [selectedItems]);

    const initiateClaim = useCallback(() => {
        if (!publicKey || selectedItems.length === 0) return;
        setMEVClaimStatus('awaiting_confirmation');
    }, [publicKey, selectedItems, setMEVClaimStatus]);

    const executeClaim = useCallback(async () => {
        if (!publicKey || !signTransaction || !sendTransaction) return;

        setMEVClaimStatus('claiming');

        if (claimEstimate) {
            logMEVClaimInitiated({
                selectedCount: claimEstimate.selectedCount,
                estimatedSOL: claimEstimate.totalClaimSOL,
            });
        }

        try {
            const transactions = await buildMEVClaimTransactions(
                selectedItems,
                publicKey,
                connection
            );

            const signatures: string[] = [];
            const resultItems: MEVClaimResultItem[] = [];
            let claimedLamports = 0;

            for (let i = 0; i < transactions.length; i++) {
                setMEVProgressText(`Claiming batch ${i + 1} of ${transactions.length}...`);

                try {
                    // Security audit: verify transaction only contains allowed instructions
                    verifyTransactionSecurity(transactions[i], publicKey);

                    const signed = await signTransaction(transactions[i]);
                    const sig = await sendTransaction(signed, connection);
                    await confirmTransactionRobust(connection, sig, 'confirmed');

                    signatures.push(sig);

                    // Mark items in this batch as claimed
                    const batchItems = selectedItems.slice(
                        i * MEV_MAX_CLAIMS_PER_TX,
                        (i + 1) * MEV_MAX_CLAIMS_PER_TX
                    );
                    batchItems.forEach((item) => {
                        resultItems.push({
                            stakeAccount: item.stakeAccount,
                            epoch: item.epoch,
                            success: true,
                            signature: sig,
                            claimedLamports: item.totalLamports,
                            errorMessage: null,
                        });
                        claimedLamports += item.totalLamports;
                    });
                } catch (txErr: any) {
                    const batchItems = selectedItems.slice(
                        i * MEV_MAX_CLAIMS_PER_TX,
                        (i + 1) * MEV_MAX_CLAIMS_PER_TX
                    );
                    batchItems.forEach((item) => {
                        resultItems.push({
                            stakeAccount: item.stakeAccount,
                            epoch: item.epoch,
                            success: false,
                            signature: null,
                            claimedLamports: 0,
                            errorMessage: txErr.message ?? 'Transaction failed',
                        });
                    });
                }
            }

            const claimed = resultItems.filter((r) => r.success).length;
            const failed = resultItems.filter((r) => !r.success).length;

            setMEVClaimResult({
                success: claimed > 0,
                claimedCount: claimed,
                failedCount: failed,
                totalClaimedLamports: claimedLamports,
                totalClaimedSOL: claimedLamports / LAMPORTS_PER_SOL,
                serviceFeeSignature: signatures[signatures.length - 1] ?? null,
                signatures,
                items: resultItems,
            });

            setMEVClaimStatus('complete');

            logMEVClaimComplete({
                successCount: claimed,
                failedCount: failed,
                totalClaimedSOL: claimedLamports / LAMPORTS_PER_SOL,
            });

        } catch (err: any) {
            logger.error('MEV executeClaim error', err);
            setMEVClaimStatus('error');
            setMEVClaimError({
                code: 'MEV_CLAIM_FAILED',
                message: 'Claim failed. Your rewards were not affected.',
                technicalDetail: err.message ?? String(err),
            });
            logMEVClaimComplete({
                successCount: 0,
                failedCount: selectedItems.length,
                totalClaimedSOL: 0,
            });
        }
    }, [
        publicKey,
        signTransaction,
        sendTransaction,
        selectedItems,
        connection,
        claimEstimate,
        setMEVClaimStatus,
        setMEVProgressText,
        setMEVClaimResult,
        setMEVClaimError,
    ]);

    return {
        // Scan
        mevScanStatus,
        mevScanResult,
        scanMEVClaims,

        // Selection
        selectedItems,
        toggleMEVItem,
        selectAllMEV,
        deselectAllMEV,

        // Claim
        claimEstimate,
        mevClaimStatus,
        mevClaimResult,
        initiateClaim,
        executeClaim,
        cancelClaim: resetMEVClaim,
    };
}
