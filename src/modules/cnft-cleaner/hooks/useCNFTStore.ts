import { create } from 'zustand';
import type {
    BurnProof,
    BurnResult,
    BurnResultItem,
    CNFTBurnStatus,
    CNFTCategory,
    CNFTScanResult,
    CNFTScanStatus,
    CNFTStoreActions,
    CNFTStoreState,
} from '../types';

interface CNFTStore extends CNFTStoreState, CNFTStoreActions { }

const initialState: CNFTStoreState = {
    scanStatus: 'idle',
    scanResult: null,
    scanError: null,
    burnStatus: 'idle',
    burnResult: null,
    burnError: null,
    selectedIds: [],
    currentProgressText: '',
    completedItems: [],
    burnProofs: new Map(),
};

export const useCNFTStore = create<CNFTStore>((set) => ({
    ...initialState,

    setScanStatus: (status: CNFTScanStatus) => set({ scanStatus: status }),

    setScanResult: (result: CNFTScanResult) =>
        set({
            scanResult: result,
            scanStatus: 'scan_complete',
            scanError: null,
            // Auto-select spam and low_value categories
            selectedIds: [
                ...result.categories.spam,
                ...result.categories.low_value,
            ]
                .filter((item) => item.isBurnable)
                .map((item) => item.id),
        }),

    setScanError: (error: string | null) =>
        set((state) => ({
            scanError: error,
            scanStatus: error ? 'error' : state.scanStatus,
        })),

    setBurnStatus: (status: CNFTBurnStatus) => set({ burnStatus: status }),

    setBurnResult: (result: BurnResult | null) =>
        set({
            burnResult: result,
            burnStatus: result ? 'complete' : 'idle',
            burnError: null,
        }),

    setBurnError: (error: string | null) =>
        set((state) => ({
            burnError: error,
            burnStatus: error ? 'error' : state.burnStatus,
        })),

    setCurrentProgressText: (text: string) =>
        set({ currentProgressText: text }),

    setBurnProofs: (proofs: Map<string, BurnProof>) =>
        set({ burnProofs: proofs }),

    toggleItem: (id: string) =>
        set((state) => ({
            selectedIds: state.selectedIds.includes(id)
                ? state.selectedIds.filter((x) => x !== id)
                : [...state.selectedIds, id],
        })),

    selectCategory: (category: CNFTCategory) =>
        set((state) => ({
            selectedIds: [
                ...new Set([
                    ...state.selectedIds,
                    ...(state.scanResult?.categories[category] ?? [])
                        .filter((i) => i.isBurnable)
                        .map((i) => i.id),
                ]),
            ],
        })),

    deselectCategory: (category: CNFTCategory) =>
        set((state) => {
            const categoryIds = new Set(
                (state.scanResult?.categories[category] ?? []).map((i) => i.id)
            );
            return {
                selectedIds: state.selectedIds.filter(
                    (id) => !categoryIds.has(id)
                ),
            };
        }),

    addCompletedItem: (item: BurnResultItem) =>
        set((state) => ({
            completedItems: [...state.completedItems, item],
        })),

    resetBurn: () =>
        set({
            burnStatus: 'idle',
            burnResult: null,
            burnError: null,
            currentProgressText: '',
            completedItems: [],
            burnProofs: new Map(),
        }),

    resetAll: () => set({ ...initialState }),
}));
