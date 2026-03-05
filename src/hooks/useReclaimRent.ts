import { useCallback, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAppStore } from '@/hooks/useAppStore';
import {
    getCloseableAccounts,
    calculateReclaimEstimate,
    buildReclaimTransactions,
} from '@/lib/reclaimRent';
import { logReclaimInitiated, logReclaimComplete } from '@/lib/analytics';
import { ERROR_CODES, ERROR_MESSAGES } from '@/config/constants';
import type { AppError, ReclaimResult } from '@/types';

/**
 * Hook that wraps the rent reclaimer logic with wallet adapter integration
 * and global state management.
 */
export function useReclaimRent() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const {
        scanResult,
        closeableAccounts,
        setCloseableAccounts,

        reclaimStatus,
        reclaimResult,
        reclaimError,

        setReclaimStatus,
        setReclaimResult,
        setReclaimError,
        clearReclaim,
    } = useAppStore();

    // 1. React to ScanResult changes and extract closeable accounts
    useEffect(() => {
        if (scanResult) {
            const accounts = getCloseableAccounts(scanResult);
            setCloseableAccounts(accounts);
        }
    }, [scanResult, setCloseableAccounts]);

    // 2. Derive the estimate based on current closeable accounts
    // We do this dynamically so the UI always has the latest math
    const estimate = closeableAccounts.length > 0
        ? calculateReclaimEstimate(closeableAccounts)
        : null;

    /**
     * Opens the confirmation modal
     */
    const initiateReclaim = useCallback(() => {
        if (!publicKey) {
            setReclaimError({
                code: ERROR_CODES.WALLET_NOT_CONNECTED,
                message: ERROR_MESSAGES.WALLET_NOT_CONNECTED,
                technicalDetail: 'publicKey is null',
            });
            return;
        }
        setReclaimStatus('awaiting_confirmation');
    }, [publicKey, setReclaimStatus, setReclaimError]);

    /**
     * Executes the actual reclaim flow after user clicks Confirm
     */
    const executeReclaim = useCallback(async () => {
        if (!publicKey || !estimate) {
            setReclaimError({
                code: ERROR_CODES.WALLET_NOT_CONNECTED,
                message: ERROR_MESSAGES.WALLET_NOT_CONNECTED,
                technicalDetail: 'publicKey or estimate is null in execute',
            });
            return;
        }

        try {
            setReclaimStatus('building_transaction');

            logReclaimInitiated({
                accountCount: closeableAccounts.length,
                estimatedSOL: estimate.userReceivesSOL,
            });

            // Re-verify we meet the minimum requirement
            const transactions = await buildReclaimTransactions(
                closeableAccounts,
                publicKey,
                connection
            );

            setReclaimStatus('awaiting_signature');

            let lastSignature: string | null = null;
            let totalClosed = 0;

            // Sequential processing, similar to useRevoke
            for (const tx of transactions) {
                try {
                    const signature = await sendTransaction(tx, connection);
                    lastSignature = signature;

                    setReclaimStatus('confirming');

                    const confirmation = await connection.confirmTransaction(
                        signature,
                        'confirmed'
                    );

                    if (confirmation.value.err) {
                        throw new Error(
                            `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`
                        );
                    }

                    // Count closed accounts in this batch
                    // If this is the FIRST tx, it has an extra fee transfer instruction
                    const isFirstTx = tx === transactions[0] && estimate.serviceFeeSOL > 0;
                    const closedAccountsInTx = isFirstTx
                        ? tx.instructions.length - 1
                        : tx.instructions.length;

                    totalClosed += closedAccountsInTx;

                } catch (txError) {
                    const errorMessage = txError instanceof Error ? txError.message : String(txError);

                    // User Cancelled
                    if (
                        errorMessage.includes('User rejected') ||
                        errorMessage.includes('rejected the request') ||
                        errorMessage.includes('cancelled')
                    ) {
                        setReclaimError({
                            code: ERROR_CODES.TX_REJECTED,
                            message: ERROR_MESSAGES.TX_REJECTED,
                            technicalDetail: errorMessage,
                        });
                        logReclaimComplete({
                            success: false,
                            closedCount: totalClosed,
                            reclaimedSOL: 0,
                        });
                        return;
                    }

                    // Timeout
                    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
                        setReclaimError({
                            code: ERROR_CODES.TX_TIMEOUT,
                            message: ERROR_MESSAGES.TX_TIMEOUT,
                            technicalDetail: errorMessage,
                        });
                        logReclaimComplete({
                            success: false,
                            closedCount: totalClosed,
                            reclaimedSOL: 0,
                        });
                        return;
                    }

                    throw txError;
                }
            }

            // Success
            const approxReclaimedSOL = totalClosed * (2039280 / 1e9); // Accurate based on what succeeded

            const result: ReclaimResult = {
                success: true,
                signature: lastSignature,
                closedCount: totalClosed,
                reclaimedSOL: approxReclaimedSOL,
                errorMessage: null,
            };

            setReclaimResult(result);
            logReclaimComplete({
                success: true,
                closedCount: totalClosed,
                reclaimedSOL: approxReclaimedSOL,
            });

        } catch (error) {
            const appError: AppError =
                error && typeof error === 'object' && 'code' in error
                    ? (error as AppError)
                    : {
                        code: ERROR_CODES.TX_FAILED,
                        message: ERROR_CODES.RECLAIM_TX_FAILED,
                        technicalDetail: error instanceof Error ? error.message : String(error),
                    };

            setReclaimError(appError);
            logReclaimComplete({
                success: false,
                closedCount: 0,
                reclaimedSOL: 0,
            });
        }
    }, [
        publicKey,
        estimate,
        closeableAccounts,
        connection,
        sendTransaction,
        setReclaimStatus,
        setReclaimResult,
        setReclaimError,
    ]);

    const cancelReclaim = useCallback(() => {
        clearReclaim();
    }, [clearReclaim]);

    return {
        closeableAccounts,
        reclaimEstimate: estimate,
        reclaimStatus,
        reclaimResult,
        reclaimError,

        initiateReclaim,
        executeReclaim,
        cancelReclaim,
        clearReclaim,

        isReclaiming:
            reclaimStatus === 'building_transaction' ||
            reclaimStatus === 'awaiting_signature' ||
            reclaimStatus === 'confirming',
        isComplete: reclaimStatus === 'complete',
        hasError: reclaimStatus === 'error',
    };
}
