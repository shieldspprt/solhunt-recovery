/**
 * Memoized Zustand selectors for LP Harvester store.
 *
 * These selectors use shallow comparison to prevent unnecessary re-renders
 * when the store updates but the selected values haven't changed.
 *
 * @see https://github.com/pmndrs/zustand?tab=readme-ov-file#selecting-multiple-state-slices
 */
import { useLPStore } from './useLPStore';
import { useShallow } from 'zustand/react/shallow';

/**
 * Returns only the scan-related state.
 * Prevents re-renders when harvest or selection state changes.
 */
export const useLPScanState = () =>
    useLPStore(useShallow((state) => ({
        scanStatus: state.scanStatus,
        scanResult: state.scanResult,
        scanError: state.scanError,
    })));

/**
 * Returns only the harvest execution state.
 * Isolates harvest state from scan updates.
 */
export const useLPHarvestState = () =>
    useLPStore(useShallow((state) => ({
        harvestStatus: state.harvestStatus,
        harvestResult: state.harvestResult,
        harvestError: state.harvestError,
        currentProgressText: state.currentProgressText,
        completedItems: state.completedItems,
    })));

/**
 * Returns only the selection and configuration state.
 * Used by components that need to control which positions are selected.
 */
export const useLPSelectionState = () =>
    useLPStore(useShallow((state) => ({
        selectedPositionIds: state.selectedPositionIds,
        willCompound: state.willCompound,
    })));

/**
 * Returns only the action setters.
 * These have stable references and never change between renders.
 */
export const useLPActions = () =>
    useLPStore(useShallow((state) => ({
        setScanStatus: state.setScanStatus,
        setScanResult: state.setScanResult,
        setScanError: state.setScanError,
        setHarvestStatus: state.setHarvestStatus,
        setHarvestResult: state.setHarvestResult,
        setHarvestError: state.setHarvestError,
        setCurrentProgressText: state.setCurrentProgressText,
        togglePosition: state.togglePosition,
        setWillCompound: state.setWillCompound,
        addCompletedItem: state.addCompletedItem,
        clearCompletedItems: state.clearCompletedItems,
        resetHarvest: state.resetHarvest,
        resetAll: state.resetAll,
    })));
