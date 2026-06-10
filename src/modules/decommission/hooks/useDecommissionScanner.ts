import { useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

import { useDecommissionStore } from '../store/decommissionStore';
import { scanForDeadProtocolPositions } from '../lib/decommissionScanner';
import { buildWithdrawalTransactions } from '../lib/withdrawalBuilder';
import { DecommissionRecoveryEstimate, DecommissionRecoveryItemResult } from '../types';
import { createAppError } from '@/lib/errors';
import { confirmTransactionRobust } from '@/lib/withTimeout';
import { verifyTransactionSecurity } from '@/lib/transactionVerifier';
import { DECOMMISSION_SERVICE_FEE_PERCENT, DECOMMISSION_FEE_SOL_MIN } from '../constants';
import { logger } from '@/lib/logger';
import {
    logDecommissionScanStarted,
    logDecommissionScanComplete,
    logDecommissionScanFailed,
    logDecommissionRecoveryComplete,
    logDecommissionRecoveryFailed,
} from '@/lib/analytics';

export function useDecommissionScanner() {
    const { publicKey, signTransaction, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const store = useDecommissionStore();

    const startScan = useCallback(async () => {
        if (!publicKey) return;
        store.reset();
        store.setScanStatus('scanning');

        logDecommissionScanStarted();

        try {
            const result = await scanForDeadProtocolPositions(
                publicKey.toString(),
                connection,
                (progress) => store.setScanProgress(progress)
            );

            store.setScanResult(result);
            store.setScanStatus(result.positionsFound > 0 ? 'scan_complete' : 'nothing_found');

            store.setSelectedIds(
                result.items.filter(i => i.canRecover).map(i => i.tokenAccountAddress)
            );

            logDecommissionScanComplete({
                positionsFound: result.positionsFound,
                recoverableCount: result.recoverableCount,
                totalRecoverableUSD: result.totalRecoverableUSD,
                windingDownCount: result.windingDownCount,
            });

        } catch (err: unknown) {
            // Forward structured error to production monitoring (PII-safe, no wallet details).
            // The analytics event captures the error code; logger.error also pipes to console
            // in dev. Matches the pattern used by the per-transaction handler below.
            logger.error('DecommissionScanFailed', err);
            const appError = createAppError('SCAN_FAILED', err instanceof Error ? err.message : String(err));
            store.setScanStatus('error');
            store.setScanError(appError.message);
            logDecommissionScanFailed(appError.code);
        }
    }, [publicKey, connection, store]);

    const selectedItems = useMemo(() => {
        return (store.scanResult?.items ?? []).filter(i => store.selectedIds.includes(i.tokenAccountAddress));
    }, [store.scanResult, store.selectedIds]);

    const recoveryEstimate = useMemo((): DecommissionRecoveryEstimate | null => {
        if (selectedItems.length === 0) return null;

        const inAppItems = selectedItems.filter(i => i.recoveryMethod === 'in_app');
        const redirectItems = selectedItems.filter(i => i.recoveryMethod === 'redirect');

        const totalValueUSD = selectedItems
            .filter(i => i.estimatedValueUSD !== null)
            .reduce((sum, i) => sum + (i.estimatedValueUSD ?? 0), 0);

        const serviceFeeUSD = totalValueUSD * (DECOMMISSION_SERVICE_FEE_PERCENT / 100);
        const solPrice = 150;
        const serviceFeeSOL = Math.max(
            serviceFeeUSD / (solPrice || 140),
            DECOMMISSION_FEE_SOL_MIN
        );

        return {
            selectedItems,
            inAppItems,
            redirectItems,
            totalValueUSD: totalValueUSD > 0 ? totalValueUSD : null,
            serviceFeePercent: DECOMMISSION_SERVICE_FEE_PERCENT,
            serviceFeeUSD: serviceFeeUSD > 0 ? serviceFeeUSD : null,
            serviceFeeLamports: Math.floor(serviceFeeSOL * 1e9),
            netValueUSD: totalValueUSD > 0 ? totalValueUSD - serviceFeeUSD : null,
            txCount: inAppItems.length,
        };
    }, [selectedItems]);

    const initiateRecovery = useCallback(() => {
        if (selectedItems.length === 0) return;
        store.setRecoveryStatus('awaiting_confirmation');
    }, [selectedItems, store]);

    const executeRecovery = useCallback(async () => {
        if (!publicKey || !signTransaction || !sendTransaction) return;

        store.setRecoveryStatus('recovering');
        const resultItems: DecommissionRecoveryItemResult[] = [];

        try {
            const redirectItems = selectedItems.filter(i => i.recoveryMethod === 'redirect');
            for (const item of redirectItems) {
                if (item.redirectUrl) {
                    window.open(item.redirectUrl, '_blank', 'noopener');
                }
                resultItems.push({
                    protocolId: item.protocol.id,
                    protocolName: item.protocol.name,
                    tokenSymbol: item.tokenDef.symbol,
                    success: false,
                    signature: null,
                    recoveredValueUSD: null,
                    errorMessage: null,
                    redirectUrl: item.redirectUrl,
                });
            }

            const inAppItems = selectedItems.filter(i => i.recoveryMethod === 'in_app');
            if (inAppItems.length > 0) {
                const transactions = await buildWithdrawalTransactions(inAppItems, publicKey, connection);

                for (let i = 0; i < transactions.length; i++) {
                    const item = inAppItems[i];
                    store.setRecoveryProgress(`Recovering ${item.protocol.name}... (${i + 1}/${transactions.length})`);

                    try {
                        // SECURITY: Verify transaction before signing — program whitelist check
                        verifyTransactionSecurity(transactions[i], publicKey);

                        const signed = await signTransaction(transactions[i]);
                        // If it's empty because of stub, it'll fail or not be broadcast if 0 ixs. Let's guard this:
                        if (transactions[i].instructions.length === 0) {
                            throw new Error("Withdrawal instruction not implemented for " + item.protocol.name);
                        }
                        const sig = await sendTransaction(signed, connection);
                        await confirmTransactionRobust(connection, sig, 'confirmed');

                        resultItems.push({
                            protocolId: item.protocol.id,
                            protocolName: item.protocol.name,
                            tokenSymbol: item.tokenDef.symbol,
                            success: true,
                            signature: sig,
                            recoveredValueUSD: item.estimatedValueUSD,
                            errorMessage: null,
                            redirectUrl: null,
                        });

                    } catch (txErr: unknown) {
                        // Log error for debugging before translating to user-friendly message
                        // (warn since error is handled gracefully and surfaced to user)
                        logger.warn('Transaction failed:', txErr instanceof Error ? txErr.message : String(txErr));
                        const appTxError = createAppError('TX_FAILED', txErr instanceof Error ? txErr.message : String(txErr));
                        resultItems.push({
                            protocolId: item.protocol.id,
                            protocolName: item.protocol.name,
                            tokenSymbol: item.tokenDef.symbol,
                            success: false,
                            signature: null,
                            recoveredValueUSD: null,
                            errorMessage: appTxError.message,
                            redirectUrl: item.protocol.recoveryUrl,
                        });
                    }
                }
            }

            store.setRecoveryResult({
                recoveredCount: resultItems.filter(r => r.success).length,
                redirectCount: resultItems.filter(r => r.redirectUrl && !r.success).length,
                failedCount: resultItems.filter(r => !r.success && !r.redirectUrl).length,
                totalRecoveredUSD: resultItems
                    .filter(r => r.success && r.recoveredValueUSD)
                    .reduce((s, r) => s + (r.recoveredValueUSD ?? 0), 0) || null,
                serviceFeeSignature: null,
                items: resultItems,
            });

            store.setRecoveryStatus('complete');

            logDecommissionRecoveryComplete({
                recoveredCount: resultItems.filter(r => r.success).length,
                redirectCount: resultItems.filter(r => r.redirectUrl && !r.success).length,
                failedCount: resultItems.filter(r => !r.success && !r.redirectUrl).length,
            });

        } catch (err: unknown) {
            // Forward structured error to production monitoring (PII-safe, no wallet details).
            // Inner per-transaction errors are already logged at the loop level — this
            // catches higher-level failures (e.g. buildWithdrawalTransactions throwing).
            logger.error('DecommissionRecoveryFailed', err);
            // Translate to user-facing error — avoid double-logging since inner txErr
            // is already logged at the per-transaction level (line ~163)
            const appError = createAppError('DECOMMISSION_RECOVERY_FAILED', err instanceof Error ? err.message : String(err));
            store.setRecoveryStatus('error');
            store.setRecoveryError(`${appError.message}${appError.technicalDetail ? `: ${appError.technicalDetail}` : ''}`);
            logDecommissionRecoveryFailed(appError.code);
        }
    }, [publicKey, signTransaction, sendTransaction, selectedItems, connection, store]);

    return {
        scanStatus: store.scanStatus,
        scanResult: store.scanResult,
        scanProgress: store.scanProgress,
        scanError: store.scanError,
        startScan,
        selectedItems,
        recoveryEstimate,
        toggleItem: store.toggleItem,
        selectAllRecoverable: store.selectAllRecoverable,
        deselectAll: store.deselectAll,
        recoveryStatus: store.recoveryStatus,
        recoveryResult: store.recoveryResult,
        recoveryError: store.recoveryError,
        initiateRecovery,
        executeRecovery,
        cancelRecovery: () => store.setRecoveryStatus('idle'),
    };
}
