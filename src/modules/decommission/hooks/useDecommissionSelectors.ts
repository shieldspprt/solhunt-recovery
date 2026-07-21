/**
 * Memoized Zustand selectors for Decommission Scanner store.
 *
 * These selectors use shallow comparison to prevent unnecessary re-renders
 * when the store updates but the selected values haven't changed.
 *
 * @see https://github.com/pmndrs/zustand?tab=readme-ov-file#selecting-multiple-state-slices
 */
import { useDecommissionStore } from '../store/decommissionStore';
import { useShallow } from 'zustand/react/shallow';

/**
 * Returns only the scan-related state.
 * Prevents re-renders when recovery or selection state changes.
 */
export const useDecommissionScanState = () =>
    useDecommissionStore(useShallow((state) => ({
        scanStatus: state.scanStatus,
        scanResult: state.scanResult,
        scanError: state.scanError,
        scanProgress: state.scanProgress,
    })));

/**
 * Returns only the recovery execution state.
 * Isolates recovery state from scan updates.
 */
export const useDecommissionRecoveryState = () =>
    useDecommissionStore(useShallow((state) => ({
        recoveryStatus: state.recoveryStatus,
        recoveryResult: state.recoveryResult,
        recoveryError: state.recoveryError,
        recoveryProgress: state.recoveryProgress,
    })));

/**
 * Returns only the selection state.
 * Used by components that need to control which items are selected.
 */
export const useDecommissionSelectionState = () =>
    useDecommissionStore(useShallow((state) => ({
        selectedIds: state.selectedIds,
    })));

/**
 * Returns only the action setters.
 * These have stable references and never change between renders.
 */
export const useDecommissionActions = () =>
    useDecommissionStore(useShallow((state) => ({
        setScanStatus: state.setScanStatus,
        setScanResult: state.setScanResult,
        setScanError: state.setScanError,
        setScanProgress: state.setScanProgress,
        setRecoveryStatus: state.setRecoveryStatus,
        setRecoveryResult: state.setRecoveryResult,
        setRecoveryError: state.setRecoveryError,
        setRecoveryProgress: state.setRecoveryProgress,
        setSelectedIds: state.setSelectedIds,
        toggleItem: state.toggleItem,
        selectAllRecoverable: state.selectAllRecoverable,
        deselectAll: state.deselectAll,
        reset: state.reset,
    })));
