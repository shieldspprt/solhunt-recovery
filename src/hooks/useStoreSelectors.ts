/**
 * Memoized Zustand selectors for performance optimization.
 *
 * These selectors use shallow comparison to prevent unnecessary re-renders
 * when the store updates but the selected values haven't changed.
 *
 * @see https://github.com/pmndrs/zustand?tab=readme-ov-file#selecting-multiple-state-slices
 */
import { useAppStore } from '@/hooks/useAppStore';
import { useShallow } from 'zustand/react/shallow';

/**
 * Returns only the wallet connection-related state.
 * Prevents re-renders when unrelated store slices change.
 */
export const useWalletStatus = () =>
    useAppStore(useShallow((state) => ({
        agentWallet: state.agentWallet,
    })));

/**
 * Returns only the scan-related state.
 * Isolates scan state from other engine updates.
 */
export const useScanState = () =>
    useAppStore(useShallow((state) => ({
        scanStatus: state.scanStatus,
        scanResult: state.scanResult,
        scanError: state.scanError,
    })));

/**
 * Returns only the revoke-related state.
 */
export const useRevokeState = () =>
    useAppStore(useShallow((state) => ({
        revokeStatus: state.revokeStatus,
        revokeResult: state.revokeResult,
        revokeError: state.revokeError,
    })));

/**
 * Returns only the reclaim (rent) related state.
 */
export const useReclaimState = () =>
    useAppStore(useShallow((state) => ({
        reclaimStatus: state.reclaimStatus,
        closeableAccounts: state.closeableAccounts,
        reclaimEstimate: state.reclaimEstimate,
        reclaimResult: state.reclaimResult,
        reclaimError: state.reclaimError,
    })));

/**
 * Returns dust consolidator state only.
 */
export const useDustState = () =>
    useAppStore(useShallow((state) => ({
        dustScanResult: state.dustScanResult,
        swapQuotes: state.swapQuotes,
        selectedDustMints: state.selectedDustMints,
        dustStatus: state.dustStatus,
        dustResult: state.dustResult,
        dustProgress: state.dustProgress,
        dustError: state.dustError,
    })));

/**
 * Returns dust burn + reclaim state only.
 */
export const useDustBurnState = () =>
    useAppStore(useShallow((state) => ({
        dustBurnStatus: state.dustBurnStatus,
        dustBurnResult: state.dustBurnResult,
        dustBurnProgress: state.dustBurnProgress,
        dustBurnError: state.dustBurnError,
        dustBurnSelectionMints: state.dustBurnSelectionMints,
    })));

/**
 * Returns ticket finder state only.
 */
export const useTicketState = () =>
    useAppStore(useShallow((state) => ({
        ticketScanStatus: state.ticketScanStatus,
        ticketScanResult: state.ticketScanResult,
        ticketScanError: state.ticketScanError,
        ticketClaimStatus: state.ticketClaimStatus,
        ticketClaimResult: state.ticketClaimResult,
        ticketClaimProgress: state.ticketClaimProgress,
        ticketClaimError: state.ticketClaimError,
    })));

/**
 * Returns MEV claims state only.
 */
export const useMEVState = () =>
    useAppStore(useShallow((state) => ({
        mevScanStatus: state.mevScanStatus,
        mevScanResult: state.mevScanResult,
        mevScanError: state.mevScanError,
        mevClaimStatus: state.mevClaimStatus,
        mevClaimResult: state.mevClaimResult,
        mevClaimError: state.mevClaimError,
        selectedMEVIds: state.selectedMEVIds,
        mevProgressText: state.mevProgressText,
    })));

/**
 * Returns buffer recovery state only.
 */
export const useBufferState = () =>
    useAppStore(useShallow((state) => ({
        bufferScanStatus: state.bufferScanStatus,
        bufferScanResult: state.bufferScanResult,
        bufferScanError: state.bufferScanError,
        selectedBufferAddresses: state.selectedBufferAddresses,
        bufferCloseStatus: state.bufferCloseStatus,
        bufferCloseResult: state.bufferCloseResult,
        bufferCloseError: state.bufferCloseError,
    })));

/**
 * Returns all action setters only (for components that need to dispatch actions).
 * These are stable references that never change.
 * Uses useShallow to prevent unnecessary re-renders when store state changes.
 */
export const useStoreActions = () =>
    useAppStore(useShallow((state) => ({
        setAgentWallet: state.setAgentWallet,
        setScanStatus: state.setScanStatus,
        setScanResult: state.setScanResult,
        setScanError: state.setScanError,
        clearScan: state.clearScan,
        setRevokeStatus: state.setRevokeStatus,
        setRevokeResult: state.setRevokeResult,
        setRevokeError: state.setRevokeError,
        clearRevoke: state.clearRevoke,
        setCloseableAccounts: state.setCloseableAccounts,
        setReclaimStatus: state.setReclaimStatus,
        setReclaimResult: state.setReclaimResult,
        setReclaimError: state.setReclaimError,
        clearReclaim: state.clearReclaim,
        setDustScanResult: state.setDustScanResult,
        setSwapQuotes: state.setSwapQuotes,
        toggleDustMint: state.toggleDustMint,
        setAllDustMints: state.setAllDustMints,
        setDustStatus: state.setDustStatus,
        setDustResult: state.setDustResult,
        setDustProgress: state.setDustProgress,
        setDustError: state.setDustError,
        clearDust: state.clearDust,
        setDustBurnStatus: state.setDustBurnStatus,
        setDustBurnResult: state.setDustBurnResult,
        setDustBurnProgress: state.setDustBurnProgress,
        setDustBurnError: state.setDustBurnError,
        setDustBurnSelectionMints: state.setDustBurnSelectionMints,
        clearDustBurn: state.clearDustBurn,
        setTicketScanStatus: state.setTicketScanStatus,
        setTicketScanResult: state.setTicketScanResult,
        setTicketScanError: state.setTicketScanError,
        setTicketClaimStatus: state.setTicketClaimStatus,
        setTicketClaimResult: state.setTicketClaimResult,
        setTicketClaimProgress: state.setTicketClaimProgress,
        setTicketClaimError: state.setTicketClaimError,
        clearTicketClaim: state.clearTicketClaim,
        clearTickets: state.clearTickets,
        setMEVScanStatus: state.setMEVScanStatus,
        setMEVScanResult: state.setMEVScanResult,
        setMEVScanError: state.setMEVScanError,
        setMEVClaimStatus: state.setMEVClaimStatus,
        setMEVClaimResult: state.setMEVClaimResult,
        setMEVClaimError: state.setMEVClaimError,
        clearMEVClaim: state.clearMEVClaim,
        setSelectedMEVIds: state.setSelectedMEVIds,
        toggleMEVItem: state.toggleMEVItem,
        selectAllMEV: state.selectAllMEV,
        deselectAllMEV: state.deselectAllMEV,
        setMEVProgressText: state.setMEVProgressText,
        resetMEVClaim: state.resetMEVClaim,
        setBufferScanStatus: state.setBufferScanStatus,
        setBufferScanResult: state.setBufferScanResult,
        setBufferScanError: state.setBufferScanError,
        setSelectedBufferAddresses: state.setSelectedBufferAddresses,
        toggleBufferSelection: state.toggleBufferSelection,
        selectAllBuffers: state.selectAllBuffers,
        deselectAllBuffers: state.deselectAllBuffers,
        setBufferCloseStatus: state.setBufferCloseStatus,
        setBufferCloseResult: state.setBufferCloseResult,
        setBufferCloseError: state.setBufferCloseError,
        clearBuffers: state.clearBuffers,
        resetAll: state.resetAll,
    })));
