import { useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    HARVEST_COMPOUND_FEE_PERCENT,
    HARVEST_FEE_PERCENT,
    LP_ERROR_MESSAGES,
} from '../constants';
import { harvestAllPositions } from '../lib/harvesters';
import { useLPStore } from './useLPStore';
import type { HarvestEstimate, LPPosition } from '../types';
import {
    logLPHarvestComplete,
    logLPHarvestInitiated,
} from '@/lib/analytics';
import { logger } from '@/lib/logger';

function estimateNetworkFee(selectedPositions: LPPosition[]): number {
    // LP harvest transactions are larger than simple transfers; use conservative estimate.
    return selectedPositions.length * 0.00002;
}

function buildEstimate(
    selectedPositions: LPPosition[],
    willCompound: boolean
): HarvestEstimate | null {
    if (selectedPositions.length === 0) return null;

    const totalFeeValueUSD = selectedPositions.reduce((sum, position) => sum + position.totalFeeValueUSD, 0);
    const totalFeeValueSOL = selectedPositions.reduce((sum, position) => sum + position.totalFeeValueSOL, 0);

    const serviceFeePercent = willCompound ? HARVEST_COMPOUND_FEE_PERCENT : HARVEST_FEE_PERCENT;
    const serviceFeeSOL = totalFeeValueSOL * (serviceFeePercent / 100);
    const networkFeeSOL = estimateNetworkFee(selectedPositions);

    return {
        selectedPositions: selectedPositions.length,
        totalFeeValueUSD,
        totalFeeValueSOL,
        serviceFeePercent,
        serviceFeeSOL,
        networkFeeSOL,
        userReceivesValueUSD: totalFeeValueUSD * (1 - serviceFeePercent / 100),
        willCompound,
    };
}

export function useLPHarvester() {
    const { connection } = useConnection();
    const { publicKey, signTransaction, sendTransaction } = useWallet();

    const scanResult = useLPStore((state) => state.scanResult);
    const selectedPositionIds = useLPStore((state) => state.selectedPositionIds);
    const willCompound = useLPStore((state) => state.willCompound);
    const harvestStatus = useLPStore((state) => state.harvestStatus);
    const harvestResult = useLPStore((state) => state.harvestResult);
    const harvestError = useLPStore((state) => state.harvestError);
    const completedItems = useLPStore((state) => state.completedItems);

    const setHarvestStatus = useLPStore((state) => state.setHarvestStatus);
    const setHarvestResult = useLPStore((state) => state.setHarvestResult);
    const setHarvestError = useLPStore((state) => state.setHarvestError);
    const clearCompletedItems = useLPStore((state) => state.clearCompletedItems);
    const addCompletedItem = useLPStore((state) => state.addCompletedItem);
    const togglePosition = useLPStore((state) => state.togglePosition);
    const setWillCompound = useLPStore((state) => state.setWillCompound);
    const resetHarvest = useLPStore((state) => state.resetHarvest);

    const selectedPositions = useMemo(() => {
        const positions = scanResult?.positions || [];
        return positions.filter((position) => selectedPositionIds.includes(position.id));
    }, [scanResult?.positions, selectedPositionIds]);

    const harvestEstimate = useMemo(
        () => buildEstimate(selectedPositions, willCompound),
        [selectedPositions, willCompound]
    );

    const initiateHarvest = useCallback(() => {
        if (selectedPositions.length === 0) return;
        setHarvestError(null);
        setHarvestStatus('awaiting_confirmation');
    }, [selectedPositions.length, setHarvestError, setHarvestStatus]);

    const executeHarvest = useCallback(async () => {
        if (!publicKey || !sendTransaction || !signTransaction) {
            setHarvestStatus('error');
            setHarvestError(LP_ERROR_MESSAGES.LP_HARVEST_FAILED);
            return;
        }

        if (selectedPositions.length === 0) {
            setHarvestStatus('error');
            setHarvestError(LP_ERROR_MESSAGES.LP_HARVEST_FAILED);
            return;
        }

        setHarvestStatus('harvesting');
        setHarvestError(null);
        clearCompletedItems();

        logLPHarvestInitiated({
            positionCount: selectedPositions.length,
            totalFeeValueUSD: selectedPositions.reduce((sum, position) => sum + position.totalFeeValueUSD, 0),
            willCompound,
        });

        try {
            const result = await harvestAllPositions(
                selectedPositions,
                willCompound,
                publicKey,
                signTransaction,
                sendTransaction,
                connection,
                (item) => {
                    addCompletedItem(item);
                }
            );

            setHarvestResult(result);
            setHarvestStatus('complete');

            logLPHarvestComplete({
                success: result.success,
                harvestedCount: result.totalHarvested,
                failedCount: result.totalFailed,
                totalValueUSD: result.totalValueUSD,
                compoundAttempted: result.compoundAttempted,
                compoundSuccess: result.compoundResult?.success ?? false,
                feeSOL: result.serviceFeeSOL,
            });
        } catch (err: unknown) {
            setHarvestStatus('error');
            setHarvestError(LP_ERROR_MESSAGES.LP_HARVEST_FAILED);

            // Log the actual error for debugging (warn since error is handled gracefully)
            logger.warn('LP harvest failed:', err instanceof Error ? err.message : String(err));

            logLPHarvestComplete({
                success: false,
                harvestedCount: 0,
                failedCount: selectedPositions.length,
                totalValueUSD: 0,
                compoundAttempted: willCompound,
                compoundSuccess: false,
                feeSOL: 0,
            });
        }
    }, [
        addCompletedItem,
        clearCompletedItems,
        connection,
        publicKey,
        selectedPositions,
        sendTransaction,
        setHarvestError,
        setHarvestResult,
        setHarvestStatus,
        signTransaction,
        willCompound,
    ]);

    const cancelHarvest = useCallback(() => {
        setHarvestStatus('idle');
    }, [setHarvestStatus]);

    const dismissHarvest = useCallback(() => {
        resetHarvest();
    }, [resetHarvest]);

    return {
        selectedPositions,
        harvestEstimate,
        harvestStatus,
        harvestResult,
        harvestError,
        willCompound,
        completedItems,
        togglePosition,
        setWillCompound,
        initiateHarvest,
        executeHarvest,
        cancelHarvest,
        dismissHarvest,
    };
}
