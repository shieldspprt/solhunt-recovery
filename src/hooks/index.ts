/**
 * Hooks barrel file — centralized exports for all application hooks.
 *
 * This provides a clean import surface:
 *   import { useWalletScanner, useStoreSelectors } from '@/hooks';
 *
 * Instead of deep imports:
 *   import { useWalletScanner } from '@/hooks/useWalletScanner';
 */

// Core state management
export { useAppStore } from './useAppStore';

// Memoized selectors (prevents unnecessary re-renders)
export {
    useWalletStatus,
    useScanState,
    useRevokeState,
    useReclaimState,
    useDustState,
    useDustBurnState,
    useTicketState,
    useMEVState,
    useBufferState,
    useStoreActions,
} from './useStoreSelectors';

// Engine hooks
export { useWalletScanner } from './useWalletScanner';
export { useRevoke } from './useRevoke';
export { useReclaimRent } from './useReclaimRent';
export { useDustConsolidator } from './useDustConsolidator';
export { useDustBurnReclaim } from './useDustBurnReclaim';
export { useTicketFinder } from './useTicketFinder';
export { useMEVClaims } from './useMEVClaims';
