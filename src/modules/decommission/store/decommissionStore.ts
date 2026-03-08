import { create } from 'zustand';
import {
    DecommissionScanStatus,
    DecommissionScanResult,
    DecommissionScanProgress,
    DecommissionRecoveryStatus,
    DecommissionRecoveryResult
} from '../types';

interface DecommissionStoreState {
    scanStatus: DecommissionScanStatus;
    scanResult: DecommissionScanResult | null;
    scanError: string | null;
    scanProgress: DecommissionScanProgress | null;
    recoveryStatus: DecommissionRecoveryStatus;
    recoveryResult: DecommissionRecoveryResult | null;
    recoveryError: string | null;
    recoveryProgress: string;
    selectedIds: string[]; // tokenAccountAddress values

    setScanStatus: (s: DecommissionScanStatus) => void;
    setScanResult: (r: DecommissionScanResult | null) => void;
    setScanError: (e: string | null) => void;
    setScanProgress: (p: DecommissionScanProgress | null) => void;
    setRecoveryStatus: (s: DecommissionRecoveryStatus) => void;
    setRecoveryResult: (r: DecommissionRecoveryResult | null) => void;
    setRecoveryError: (e: string | null) => void;
    setRecoveryProgress: (t: string) => void;
    setSelectedIds: (ids: string[]) => void;
    toggleItem: (id: string) => void;
    selectAllRecoverable: () => void;
    deselectAll: () => void;
    reset: () => void;
}

export const useDecommissionStore = create<DecommissionStoreState>((set, get) => ({
    scanStatus: 'idle',
    scanResult: null,
    scanError: null,
    scanProgress: null,
    recoveryStatus: 'idle',
    recoveryResult: null,
    recoveryError: null,
    recoveryProgress: '',
    selectedIds: [],

    setScanStatus: (s) => set({ scanStatus: s }),
    setScanResult: (r) => set({ scanResult: r }),
    setScanError: (e) => set({ scanError: e }),
    setScanProgress: (p) => set({ scanProgress: p }),
    setRecoveryStatus: (s) => set({ recoveryStatus: s }),
    setRecoveryResult: (r) => set({ recoveryResult: r }),
    setRecoveryError: (e) => set({ recoveryError: e }),
    setRecoveryProgress: (t) => set({ recoveryProgress: t }),
    setSelectedIds: (ids) => set({ selectedIds: ids }),
    toggleItem: (id) => {
        const { selectedIds } = get();
        if (selectedIds.includes(id)) {
            set({ selectedIds: selectedIds.filter(x => x !== id) });
        } else {
            set({ selectedIds: [...selectedIds, id] });
        }
    },
    selectAllRecoverable: () => {
        const { scanResult } = get();
        if (!scanResult) return;
        const recoverableIds = scanResult.items.filter(i => i.canRecover).map(i => i.tokenAccountAddress);
        set({ selectedIds: recoverableIds });
    },
    deselectAll: () => set({ selectedIds: [] }),
    reset: () => set({
        scanStatus: 'idle',
        scanResult: null,
        scanError: null,
        scanProgress: null,
        recoveryStatus: 'idle',
        recoveryResult: null,
        recoveryError: null,
        recoveryProgress: '',
        selectedIds: []
    })
}));
