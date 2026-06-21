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
import { fetchSOLPriceUSD, FALLBACK_SOL_PRICE_USD } from '@/lib/solPrice';
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
            // Fetch live SOL price in parallel with the scan so the recovery
            // estimate and the actual on-chain service fee both use a real
            // USD/SOL rate. Previously both fell back to a hardcoded 150,
            // which produced wrong fee quotes when SOL moved materially.
            // The helper itself falls back to FALLBACK_SOL_PRICE_USD on
            // Jupiter failure, so the UX is identical when the price API
            // is unavailable.
            const [result, solPriceUSD] = await Promise.all([
                scanForDeadProtocolPositions(
                    publicKey.toString(),
                    connection,
                    (progress) => store.setScanProgress(progress)
                ),
                fetchSOLPriceUSD(),
            ]);

            store.setSolPriceUSD(solPriceUSD);

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
        // Use the live SOL price fetched at scan start. Fall back to the
        // documented constant only if the price fetch returned 0 (e.g.
        // Jupiter returned a non-positive number).
        const solPrice = store.solPriceUSD > 0 ? store.solPriceUSD : FALLBACK_SOL_PRICE_USD;
        const serviceFeeSOL = Math.max(
            serviceFeeUSD / solPrice,
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
    }, [selectedItems, store.solPriceUSD]);

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
                // SECURITY: Only follow HTTPS recovery URLs. The URL comes from
                // a hardcoded protocol registry, but validating here defends
                // against future registry drift (a misconfigured or malicious
                // entry with http://, javascript:, or data: would otherwise
                // execute in the context of this PWA tab).
                // 'noopener,noreferrer' is the standard hardening for target=_blank
                // — noopener blocks window.opener access from the new tab, and
                // noreferrer suppresses the Referer header so the destination
                // does not learn the page URL the user came from.
                if (item.redirectUrl && item.redirectUrl.startsWith('https://')) {
                    window.open(item.redirectUrl, '_blank', 'noopener,noreferrer');
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
                // Pass the live SOL price from the store so the on-chain
                // service fee matches the estimate shown in the UI. Falls
                // back to the documented constant inside the builder if 0.
                const solPriceUSD = store.solPriceUSD > 0 ? store.solPriceUSD : FALLBACK_SOL_PRICE_USD;
                const transactions = await buildWithdrawalTransactions(inAppItems, publicKey, connection, solPriceUSD);

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

            // If every in-app transaction failed (no successes, but failures
            // present), the recovery was a complete failure — surface it via
            // the 'error' modal so the user sees a clear failure message
            // instead of a celebratory "Recovery Complete!" card with $0.00
            // recovered. The per-tx errors are already logged inside the
            // loop; we synthesise a top-level message for the modal from the
            // first failed item. Redirect-only outcomes (no in-app failures)
            // still legitimately count as 'complete' even when recoveredCount
            // is 0 — the user will be guided to the external recovery site.
            const recoveredCount = resultItems.filter(r => r.success).length;
            const failedCount = resultItems.filter(r => !r.success && !r.redirectUrl).length;
            const firstFailedItem = resultItems.find(r => !r.success && !r.redirectUrl && r.errorMessage);
            if (recoveredCount === 0 && failedCount > 0 && firstFailedItem) {
                const appError = createAppError('DECOMMISSION_RECOVERY_FAILED', firstFailedItem.errorMessage || 'All recovery transactions failed.');
                store.setRecoveryStatus('error');
                store.setRecoveryError(appError.message);
                logDecommissionRecoveryFailed(appError.code);
            } else {
                store.setRecoveryStatus('complete');

                logDecommissionRecoveryComplete({
                    recoveredCount,
                    redirectCount: resultItems.filter(r => r.redirectUrl && !r.success).length,
                    failedCount,
                });
            }

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
        // Clear recoveryError/recoveryResult/recoveryProgress alongside the
        // status reset so a stale error from a previous attempt isn't shown
        // on the next recovery flow. Without this, dismissing the error
        // modal then immediately re-running recovery leaves the old error
        // text in the store until executeRecovery overwrites it, which
        // surfaces in the UI as a flash of the previous failure message.
        cancelRecovery: () => {
            store.setRecoveryStatus('idle');
            store.setRecoveryError(null);
            store.setRecoveryResult(null);
            store.setRecoveryProgress('');
        },
    };
}
