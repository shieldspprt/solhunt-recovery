import { useCallback, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAppStore } from '@/hooks/useAppStore';
import { scanForDust, getSwapQuotes } from '@/lib/dustScanner';
import { executeDustSwaps } from '@/lib/dustSwapper';
import {
    logDustScanComplete,
    logDustSwapComplete,
    logDustSwapInitiated,
} from '@/lib/analytics';
import { DUST_MAX_TOKENS_PER_SESSION } from '@/config/constants';
import type { AppError, DustScanResult, DustSwapProgressItem, DustToken } from '@/types';
import { createAppError } from '@/lib/errors';

let lastFetchedScanKey: string | null = null;

function buildDustScanResult(tokens: DustToken[]): DustScanResult {
    const swappableCount = tokens.filter((token) => token.isSwappable).length;
    const unswappableCount = tokens.length - swappableCount;

    return {
        dustTokens: tokens,
        totalEstimatedValueUSD: tokens.reduce((sum, token) => sum + token.estimatedValueUSD, 0),
        totalEstimatedValueSOL: tokens
            .filter((token) => token.isSwappable)
            .reduce((sum, token) => sum + token.estimatedValueSOL, 0),
        swappableCount,
        unswappableCount,
    };
}

export function useDustConsolidator() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const {
        scanResult,
        dustScanResult,
        swapQuotes,
        selectedDustMints,
        dustStatus,
        dustResult,
        dustProgress,
        dustError,
        setDustScanResult,
        setSwapQuotes,
        toggleDustMint,
        setAllDustMints,
        setDustStatus,
        setDustResult,
        setDustProgress,
        setDustError,
        clearDust,
    } = useAppStore();

    const updateProgress = useCallback(
        (item: DustSwapProgressItem) => {
            const existing = useAppStore.getState().dustProgress;
            const index = existing.findIndex((entry) => entry.mint === item.mint);
            const next = index >= 0
                ? existing.map((entry, entryIndex) => (entryIndex === index ? item : entry))
                : [...existing, item];
            setDustProgress(next);
        },
        [setDustProgress]
    );

    const fetchDustData = useCallback(async () => {
        if (!scanResult) return;

        try {
            clearDust();
            setDustStatus('fetching_prices');

            const baseDust = await scanForDust(scanResult);
            if (baseDust.dustTokens.length === 0) {
                setDustScanResult(baseDust);
                setSwapQuotes(new Map());
                setAllDustMints([]);
                setDustStatus('idle');
                logDustScanComplete({
                    dustCount: 0,
                    swappableCount: 0,
                    estimatedValueUSD: 0,
                });
                return;
            }

            const quotes = await getSwapQuotes(baseDust.dustTokens);
            const hydratedTokens = baseDust.dustTokens.map((token) => {
                const quote = quotes.get(token.mint);
                if (!quote) {
                    return {
                        ...token,
                        isSwappable: false,
                    };
                }
                return {
                    ...token,
                    isSwappable: true,
                    estimatedValueSOL: quote.outAmountSOL,
                    routeSource: quote.routePlan,
                };
            });

            const hydratedResult = buildDustScanResult(hydratedTokens);
            setDustScanResult(hydratedResult);
            setSwapQuotes(quotes);
            setAllDustMints(
                Array.from(
                    new Set(
                        hydratedTokens
                            .filter((token) => token.isSwappable)
                            .slice(0, DUST_MAX_TOKENS_PER_SESSION)
                            .map((token) => token.mint)
                    )
                )
            );
            setDustStatus('idle');

            logDustScanComplete({
                dustCount: hydratedResult.dustTokens.length,
                swappableCount: hydratedResult.swappableCount,
                estimatedValueUSD: hydratedResult.totalEstimatedValueUSD,
            });
        } catch (error) {
            const appError: AppError =
                error && typeof error === 'object' && 'code' in error
                    ? (error as AppError)
                    : createAppError(
                        'DUST_PRICE_FETCH_FAILED',
                        error instanceof Error ? error.message : String(error)
                    );
            setDustError(appError);
        }
    }, [
        scanResult,
        clearDust,
        setDustStatus,
        setDustScanResult,
        setSwapQuotes,
        setAllDustMints,
        setDustError,
    ]);

    const scanKey = useMemo(() => {
        if (!scanResult) return null;
        const scannedAt = new Date(scanResult.scannedAt).getTime();
        return `${scanResult.walletAddress}:${scanResult.totalTokenAccounts}:${scannedAt}`;
    }, [scanResult]);

    useEffect(() => {
        if (!scanKey) {
            lastFetchedScanKey = null;
            return;
        }
        if (lastFetchedScanKey === scanKey) return;
        lastFetchedScanKey = scanKey;
        void fetchDustData();
    }, [scanKey, fetchDustData]);

    const swappableDustTokens = useMemo(
        () => (dustScanResult?.dustTokens || []).filter((token) => token.isSwappable),
        [dustScanResult]
    );

    const selectedTokens = useMemo(
        () => swappableDustTokens.filter((token) => selectedDustMints.includes(token.mint)),
        [swappableDustTokens, selectedDustMints]
    );

    const estimatedSelectionSOL = useMemo(
        () => selectedTokens.reduce((sum, token) => sum + token.estimatedValueSOL, 0),
        [selectedTokens]
    );

    const initiateDustSwap = useCallback(() => {
        if (!publicKey) {
            setDustError(createAppError('WALLET_NOT_CONNECTED', 'publicKey is null'));
            return;
        }
        if (selectedTokens.length === 0) {
            setDustError(createAppError('DUST_QUOTE_FAILED', 'No swappable token selected.'));
            return;
        }
        setDustStatus('awaiting_confirmation');
    }, [publicKey, selectedTokens.length, setDustError, setDustStatus]);

    const executeDustSwap = useCallback(async () => {
        if (!publicKey || !sendTransaction) {
            setDustError(createAppError('WALLET_NOT_CONNECTED', 'Wallet signer unavailable.'));
            return;
        }

        if (selectedTokens.length === 0) {
            setDustError(createAppError('DUST_QUOTE_FAILED', 'No tokens selected for swapping.'));
            return;
        }

        try {
            setDustStatus('swapping');
            setDustProgress(
                selectedTokens.map((token) => ({
                    mint: token.mint,
                    tokenSymbol: token.tokenSymbol,
                    status: 'pending',
                    signature: null,
                    receivedSOL: 0,
                    message: 'Queued for swap.',
                }))
            );

            logDustSwapInitiated({
                tokenCount: selectedTokens.length,
                estimatedSOL: estimatedSelectionSOL,
            });

            const result = await executeDustSwaps({
                tokens: selectedTokens,
                quotes: swapQuotes,
                walletPublicKey: publicKey,
                connection,
                sendTransaction,
                onProgress: updateProgress,
            });

            if (result.swappedCount === 0) {
                setDustError(
                    createAppError(
                        'DUST_SWAP_FAILED',
                        result.errorMessage || 'No swap completed successfully.'
                    )
                );
                logDustSwapComplete({
                    success: false,
                    swappedCount: result.swappedCount,
                    receivedSOL: result.receivedSOL,
                });
                return;
            }

            setDustResult(result);
            logDustSwapComplete({
                success: result.success,
                swappedCount: result.swappedCount,
                receivedSOL: result.receivedSOL,
            });
        } catch (error) {
            const appError: AppError =
                error && typeof error === 'object' && 'code' in error
                    ? (error as AppError)
                    : createAppError(
                        'DUST_SWAP_FAILED',
                        error instanceof Error ? error.message : String(error)
                    );
            setDustError(appError);
            logDustSwapComplete({
                success: false,
                swappedCount: 0,
                receivedSOL: 0,
            });
        }
    }, [
        publicKey,
        sendTransaction,
        selectedTokens,
        estimatedSelectionSOL,
        swapQuotes,
        connection,
        setDustError,
        setDustProgress,
        setDustStatus,
        setDustResult,
        updateProgress,
    ]);

    const cancelDustSwap = useCallback(() => {
        clearDust();
        setDustStatus('idle');
    }, [clearDust, setDustStatus]);

    const selectAll = useCallback(() => {
        setAllDustMints(
            Array.from(
                new Set(
                    swappableDustTokens
                        .slice(0, DUST_MAX_TOKENS_PER_SESSION)
                        .map((token) => token.mint)
                )
            )
        );
    }, [setAllDustMints, swappableDustTokens]);

    const deselectAll = useCallback(() => {
        setAllDustMints([]);
    }, [setAllDustMints]);

    return {
        dustScanResult,
        swapQuotes,
        selectedDustMints,
        selectedTokens,
        dustStatus,
        dustResult,
        dustProgress,
        dustError,
        estimatedSelectionSOL,
        fetchDustData,
        toggleTokenSelection: toggleDustMint,
        selectAll,
        deselectAll,
        initiateDustSwap,
        executeDustSwap,
        cancelDustSwap,
        clearDust,
        isFetchingDust: dustStatus === 'fetching_prices',
        isSwappingDust: dustStatus === 'swapping',
    };
}
