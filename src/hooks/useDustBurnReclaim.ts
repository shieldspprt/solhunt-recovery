import { useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { SystemProgram, Transaction } from '@solana/web3.js';
import { useAppStore } from '@/hooks/useAppStore';
import {
    buildDustBurnReclaimTransactions,
    calculateDustBurnEstimate,
    getBurnableDustTokens,
} from '@/lib/dustBurnReclaim';
import { logDustBurnComplete, logDustBurnInitiated } from '@/lib/analytics';
import {
    DUST_BURN_RECLAIM_FEE_PERCENT,
    TOKEN_ACCOUNT_RENT_LAMPORTS,
    TREASURY_WALLET,
} from '@/config/constants';
import type { AppError, DustBurnProgressItem, DustBurnResult, DustToken } from '@/types';
import { confirmTransactionRobust } from '@/lib/withTimeout';
import { createAppError } from '@/lib/errors';

export function useDustBurnReclaim() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const {
        dustScanResult,
        dustProgress,
        dustBurnStatus,
        dustBurnResult,
        dustBurnProgress,
        dustBurnError,
        dustBurnSelectionMints,
        setDustBurnStatus,
        setDustBurnResult,
        setDustBurnProgress,
        setDustBurnError,
        setDustBurnSelectionMints,
        clearDustBurn,
    } = useAppStore();

    const unswappableTokens = useMemo(
        () => getBurnableDustTokens(dustScanResult?.dustTokens || []),
        [dustScanResult]
    );

    const failedSwapMints = useMemo(
        () => new Set(dustProgress.filter((item) => item.status === 'failed').map((item) => item.mint)),
        [dustProgress]
    );

    const failedConsolidationTokens = useMemo(
        () => (dustScanResult?.dustTokens || []).filter(
            (token) => failedSwapMints.has(token.mint) && token.uiBalance > 0
        ),
        [dustScanResult, failedSwapMints]
    );

    const availableBurnTokenByMint = useMemo(() => {
        const map = new Map<string, DustToken>();
        for (const token of unswappableTokens) {
            if (!map.has(token.mint)) {
                map.set(token.mint, token);
            }
        }
        for (const token of failedConsolidationTokens) {
            if (!map.has(token.mint)) {
                map.set(token.mint, token);
            }
        }
        return map;
    }, [unswappableTokens, failedConsolidationTokens]);

    const burnableTokens = useMemo(() => {
        if (dustBurnSelectionMints.length === 0) {
            return unswappableTokens;
        }
        return dustBurnSelectionMints
            .map((mint) => availableBurnTokenByMint.get(mint))
            .filter((token): token is DustToken => Boolean(token));
    }, [dustBurnSelectionMints, availableBurnTokenByMint, unswappableTokens]);

    const burnEstimate = useMemo(
        () => calculateDustBurnEstimate(burnableTokens),
        [burnableTokens]
    );

    const updateProgress = useCallback(
        (updates: DustBurnProgressItem[]) => {
            const current = useAppStore.getState().dustBurnProgress;
            const map = new Map(current.map((item) => [item.mint, item]));
            for (const update of updates) {
                map.set(update.mint, update);
            }
            setDustBurnProgress(Array.from(map.values()));
        },
        [setDustBurnProgress]
    );

    const startBurnForMints = useCallback((mints: string[]) => {
        if (!publicKey) {
            setDustBurnError(createAppError('WALLET_NOT_CONNECTED', 'publicKey is null'));
            return;
        }

        const normalizedMints = Array.from(new Set(mints));
        if (normalizedMints.length === 0) {
            if (unswappableTokens.length === 0) {
                setDustBurnError(createAppError('DUST_BURN_FAILED', 'No unswappable dust tokens available.'));
                return;
            }
            setDustBurnSelectionMints([]);
        } else {
            const validMints = normalizedMints.filter((mint) => availableBurnTokenByMint.has(mint));
            if (validMints.length === 0) {
                setDustBurnError(createAppError('DUST_BURN_FAILED', 'Selected token is not eligible for burn/reclaim.'));
                return;
            }
            setDustBurnSelectionMints(validMints);
        }

        setDustBurnStatus('awaiting_confirmation');
    }, [
        publicKey,
        unswappableTokens.length,
        availableBurnTokenByMint,
        setDustBurnError,
        setDustBurnSelectionMints,
        setDustBurnStatus,
    ]);

    const initiateBurnReclaim = useCallback(() => {
        startBurnForMints([]);
    }, [startBurnForMints]);

    const executeBurnReclaim = useCallback(async () => {
        if (!publicKey || !sendTransaction) {
            setDustBurnError(createAppError('WALLET_NOT_CONNECTED', 'Wallet signer unavailable.'));
            return;
        }
        if (burnableTokens.length === 0) {
            setDustBurnError(createAppError('DUST_BURN_FAILED', 'No burnable tokens found.'));
            return;
        }

        try {
            setDustBurnStatus('burning');
            setDustBurnProgress(
                burnableTokens.map((token) => ({
                    mint: token.mint,
                    tokenSymbol: token.tokenSymbol,
                    status: 'pending',
                    signature: null,
                    reclaimedSOL: 0,
                    message: 'Queued for burn + close.',
                }))
            );

            logDustBurnInitiated({
                tokenCount: burnableTokens.length,
                estimatedReclaimSOL: burnEstimate.userReceivesSOL,
            });

            const txBatches = await buildDustBurnReclaimTransactions(
                burnableTokens,
                publicKey,
                connection
            );

            const signatures: string[] = [];
            let burnedCount = 0;
            let failedCount = 0;
            let feeTransferError: string | null = null;

            for (const batch of txBatches) {
                updateProgress(
                    batch.tokens.map((token) => ({
                        mint: token.mint,
                        tokenSymbol: token.tokenSymbol,
                        status: 'burning',
                        signature: null,
                        reclaimedSOL: 0,
                        message: 'Awaiting wallet confirmation...',
                    }))
                );

                try {
                    const signature = await sendTransaction(batch.transaction, connection);
                    await confirmTransactionRobust(connection, signature, 'confirmed');
                    signatures.push(signature);
                    burnedCount += batch.tokens.length;

                    updateProgress(
                        batch.tokens.map((token) => ({
                            mint: token.mint,
                            tokenSymbol: token.tokenSymbol,
                            status: 'success',
                            signature,
                            reclaimedSOL: TOKEN_ACCOUNT_RENT_LAMPORTS / 1e9,
                            message: 'Burned and closed successfully.',
                        }))
                    );
                } catch (err: unknown) {
                    const batchDetail = err instanceof Error ? err.message : String(err);

                    // A single bad token can fail the entire batch because Solana txs are atomic.
                    // Retry each token in a single-token transaction so one failure does not block others.
                    updateProgress(
                        batch.tokens.map((token) => ({
                            mint: token.mint,
                            tokenSymbol: token.tokenSymbol,
                            status: 'burning',
                            signature: null,
                            reclaimedSOL: 0,
                            message: 'Batch failed. Retrying token individually...',
                        }))
                    );

                    for (const token of batch.tokens) {
                        try {
                            const singleBatches = await buildDustBurnReclaimTransactions(
                                [token],
                                publicKey,
                                connection
                            );
                            const single = singleBatches[0];
                            if (!single) {
                                throw new Error('Could not build single-token burn transaction.');
                            }

                            const signature = await sendTransaction(single.transaction, connection);
                            await confirmTransactionRobust(connection, signature, 'confirmed');

                            signatures.push(signature);
                            burnedCount += 1;
                            updateProgress([{
                                mint: token.mint,
                                tokenSymbol: token.tokenSymbol,
                                status: 'success',
                                signature,
                                reclaimedSOL: TOKEN_ACCOUNT_RENT_LAMPORTS / 1e9,
                                message: 'Recovered via single-token retry.',
                            }]);
                        } catch (singleErr: unknown) {
                            failedCount += 1;
                            const singleDetail = singleErr instanceof Error ? singleErr.message : String(singleErr);
                            updateProgress([{
                                mint: token.mint,
                                tokenSymbol: token.tokenSymbol,
                                status: 'failed',
                                signature: null,
                                reclaimedSOL: 0,
                                message: `Retry failed: ${singleDetail || batchDetail}`,
                            }]);
                        }
                    }
                }
            }

            if (burnedCount === 0) {
                setDustBurnError(createAppError('DUST_BURN_FAILED', 'No burn/close transaction succeeded.'));
                logDustBurnComplete({
                    success: false,
                    burnedCount: 0,
                    reclaimedSOL: 0,
                });
                return;
            }

            // Collect fee after successful closes only (fair billing on partial success)
            try {
                const recoveredLamports = burnedCount * TOKEN_ACCOUNT_RENT_LAMPORTS;
                const feeLamports = Math.floor((recoveredLamports * DUST_BURN_RECLAIM_FEE_PERCENT) / 100);
                if (feeLamports > 0) {
                    const { blockhash } = await connection.getLatestBlockhash('confirmed');
                    const feeTx = new Transaction();
                    feeTx.add(
                        SystemProgram.transfer({
                            fromPubkey: publicKey,
                            toPubkey: TREASURY_WALLET,
                            lamports: feeLamports,
                        })
                    );
                    feeTx.feePayer = publicKey;
                    feeTx.recentBlockhash = blockhash;

                    const feeSignature = await sendTransaction(feeTx, connection);
                    await confirmTransactionRobust(connection, feeSignature, 'confirmed');

                    signatures.push(feeSignature);
                }
            } catch (err: unknown) {
                feeTransferError = err instanceof Error ? err.message : String(err);
            }

            const reclaimedSOL = burnedCount * (TOKEN_ACCOUNT_RENT_LAMPORTS / 1e9);
            const result: DustBurnResult = {
                success: failedCount === 0 && !feeTransferError,
                burnedCount,
                failedCount,
                reclaimedSOL,
                signatures,
                errorMessage: feeTransferError
                    ? `Fee transfer failed: ${feeTransferError}`
                    : failedCount > 0
                        ? `${failedCount} account(s) failed.`
                        : null,
            };
            setDustBurnResult(result);
            logDustBurnComplete({
                success: result.success,
                burnedCount: result.burnedCount,
                reclaimedSOL: result.reclaimedSOL,
            });
        } catch (err: unknown) {
            const appError: AppError =
                err && typeof err === 'object' && 'code' in err
                    ? (err as AppError)
                    : createAppError('DUST_BURN_FAILED', err instanceof Error ? err.message : String(err));
            setDustBurnError(appError);
            logDustBurnComplete({
                success: false,
                burnedCount: 0,
                reclaimedSOL: 0,
            });
        }
    }, [
        publicKey,
        sendTransaction,
        burnableTokens,
        burnEstimate.userReceivesSOL,
        connection,
        setDustBurnStatus,
        setDustBurnProgress,
        setDustBurnResult,
        setDustBurnError,
        updateProgress,
    ]);

    const cancelBurnReclaim = useCallback(() => {
        clearDustBurn();
    }, [clearDustBurn]);

    return {
        unswappableTokens,
        failedConsolidationTokens,
        burnableTokens,
        burnEstimate,
        dustBurnStatus,
        dustBurnResult,
        dustBurnProgress,
        dustBurnError,
        initiateBurnReclaim,
        startBurnForMints,
        executeBurnReclaim,
        cancelBurnReclaim,
        clearDustBurn,
        isBurning: dustBurnStatus === 'burning',
    };
}
