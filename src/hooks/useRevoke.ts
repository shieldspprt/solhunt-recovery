import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAppStore } from '@/hooks/useAppStore';
import { buildRevokeTransaction } from '@/lib/revoke';
import {
    logRevokeInitiated,
    logRevokeComplete,
} from '@/lib/analytics';
import {
    SERVICE_FEE_SOL,
    ERROR_CODES,
    ERROR_MESSAGES,
} from '@/config/constants';
import { verifyTransactionSecurity } from '@/lib/transactionVerifier';
import { confirmTransactionRobust } from '@/lib/withTimeout';
import type { TokenDelegation, AppError, RevokeResult } from '@/types';

/**
 * Hook that wraps the revoke logic with wallet adapter integration
 * and state management.
 */
export function useRevoke() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const {
        revokeStatus,
        revokeResult,
        revokeError,
        setRevokeStatus,
        setRevokeResult,
        setRevokeError,
        clearRevoke,
    } = useAppStore();

    /**
     * Initiates the revoke flow:
     * 1. Builds transactions
     * 2. Sends each to wallet for signing
     * 3. Confirms on-chain
     */
    const revoke = useCallback(
        async (delegations: TokenDelegation[]) => {
            if (!publicKey) {
                setRevokeError({
                    code: ERROR_CODES.WALLET_NOT_CONNECTED,
                    message: ERROR_MESSAGES.WALLET_NOT_CONNECTED,
                    technicalDetail: 'publicKey is null',
                });
                return;
            }

            try {
                // Building transaction
                setRevokeStatus('building_transaction');

                logRevokeInitiated({
                    delegationCount: delegations.length,
                    feePaidSOL: SERVICE_FEE_SOL,
                });

                const transactions = await buildRevokeTransaction(
                    delegations,
                    publicKey,
                    connection
                );

                // Awaiting signature(s)
                setRevokeStatus('awaiting_signature');

                let lastSignature: string | null = null;
                let totalRevoked = 0;

                for (const revokeTx of transactions) {
                    try {
                        // Security audit: verify transaction only contains allowed instructions
                        verifyTransactionSecurity(revokeTx.transaction, publicKey);

                        const signature = await sendTransaction(revokeTx.transaction, connection);
                        lastSignature = signature;

                        // Confirming on-chain (robust polling to avoid WebSocket failures)
                        setRevokeStatus('confirming');
                        await confirmTransactionRobust(connection, signature, 'confirmed');

                        // Accumulate the revoke count from the batch metadata
                        totalRevoked += revokeTx.revokeCount;
                    } catch (txError) {
                        // Check if user rejected the transaction
                        const errorMessage =
                            txError instanceof Error ? txError.message : String(txError);
                        if (
                            errorMessage.includes('User rejected') ||
                            errorMessage.includes('rejected the request') ||
                            errorMessage.includes('cancelled')
                        ) {
                            setRevokeError({
                                code: ERROR_CODES.TX_REJECTED,
                                message: ERROR_MESSAGES.TX_REJECTED,
                                technicalDetail: errorMessage,
                            });
                            logRevokeComplete({
                                success: false,
                                revokedCount: totalRevoked,
                                errorCode: ERROR_CODES.TX_REJECTED,
                            });
                            return;
                        }

                        // Check for timeout
                        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
                            setRevokeError({
                                code: ERROR_CODES.TX_TIMEOUT,
                                message: ERROR_MESSAGES.TX_TIMEOUT,
                                technicalDetail: errorMessage,
                            });
                            logRevokeComplete({
                                success: false,
                                revokedCount: totalRevoked,
                                errorCode: ERROR_CODES.TX_TIMEOUT,
                            });
                            return;
                        }

                        // Check for insufficient funds
                        if (
                            errorMessage.includes('insufficient lamports') ||
                            errorMessage.includes('insufficient funds') ||
                            errorMessage.includes('0x1') // Solana custom program error 1 often means insufficient funds
                        ) {
                            setRevokeError({
                                code: ERROR_CODES.INSUFFICIENT_SOL,
                                message: ERROR_MESSAGES.INSUFFICIENT_SOL,
                                technicalDetail: errorMessage,
                            });
                            logRevokeComplete({
                                success: false,
                                revokedCount: totalRevoked,
                                errorCode: ERROR_CODES.INSUFFICIENT_SOL,
                            });
                            return;
                        }

                        // General transaction failure
                        throw txError;
                    }
                }

                // All transactions confirmed
                const result: RevokeResult = {
                    success: true,
                    signature: lastSignature,
                    revokedCount: totalRevoked,
                    errorMessage: null,
                };

                setRevokeResult(result);
                logRevokeComplete({
                    success: true,
                    revokedCount: totalRevoked,
                    errorCode: null,
                });
            } catch (error) {
                const appError: AppError =
                    error && typeof error === 'object' && 'code' in error
                        ? (error as AppError)
                        : {
                            code: ERROR_CODES.TX_FAILED,
                            message: ERROR_MESSAGES.TX_FAILED,
                            technicalDetail:
                                error instanceof Error ? error.message : String(error),
                        };

                setRevokeError(appError);
                logRevokeComplete({
                    success: false,
                    revokedCount: 0,
                    errorCode: appError.code,
                });
            }
        },
        [
            publicKey,
            connection,
            sendTransaction,
            setRevokeStatus,
            setRevokeResult,
            setRevokeError,
        ]
    );

    /**
     * Opens the confirmation modal (sets status to awaiting_confirmation).
     */
    const requestConfirmation = useCallback(() => {
        setRevokeStatus('awaiting_confirmation');
    }, [setRevokeStatus]);

    return {
        revoke,
        requestConfirmation,
        revokeStatus,
        revokeResult,
        revokeError,
        clearRevoke,
        isRevoking:
            revokeStatus === 'building_transaction' ||
            revokeStatus === 'awaiting_signature' ||
            revokeStatus === 'confirming',
        isComplete: revokeStatus === 'complete',
        hasError: revokeStatus === 'error',
    };
}
