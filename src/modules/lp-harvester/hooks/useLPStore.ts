import { create } from 'zustand';
import { MIN_HARVEST_VALUE_USD } from '../constants';
import type {
    HarvestResultItem,
    LPStoreActions,
    LPStoreState,
    LPScanResult,
} from '../types';

interface LPStore extends LPStoreState, LPStoreActions {}

function getDefaultSelection(result: LPScanResult): string[] {
    return result.positions
        .filter((position) => position.totalFeeValueUSD >= MIN_HARVEST_VALUE_USD)
        .filter((position) => position.protocol !== 'raydium_amm')
        .map((position) => position.id);
}

const initialState: LPStoreState = {
    scanStatus: 'idle',
    scanResult: null,
    scanError: null,
    harvestStatus: 'idle',
    harvestResult: null,
    harvestError: null,
    willCompound: false,
    selectedPositionIds: [],
    currentProgressText: '',
    completedItems: [],
};

function setCompletedItems(item: HarvestResultItem, existing: HarvestResultItem[]): HarvestResultItem[] {
    const index = existing.findIndex((entry) => entry.positionId === item.positionId);
    if (index === -1) return [...existing, item];

    return existing.map((entry, entryIndex) => (entryIndex === index ? item : entry));
}

export const useLPStore = create<LPStore>((set) => ({
    ...initialState,

    setScanStatus: (status) => set({ scanStatus: status }),
    setScanResult: (result) => set({
        scanResult: result,
        scanStatus: 'scan_complete',
        scanError: null,
        selectedPositionIds: getDefaultSelection(result),
    }),
    setScanError: (error) => set((state) => ({
        scanError: error,
        scanStatus: error ? 'error' : state.scanStatus,
    })),

    setHarvestStatus: (status) => set({ harvestStatus: status }),
    setHarvestResult: (result) => set({
        harvestResult: result,
        harvestStatus: result ? 'complete' : 'idle',
        harvestError: null,
    }),
    setHarvestError: (error) => set((state) => ({
        harvestError: error,
        harvestStatus: error ? 'error' : state.harvestStatus,
    })),

    setCurrentProgressText: (text) => set({ currentProgressText: text }),

    togglePosition: (id) => set((state) => ({
        selectedPositionIds: state.selectedPositionIds.includes(id)
            ? state.selectedPositionIds.filter((existingId) => existingId !== id)
            : [...state.selectedPositionIds, id],
    })),

    setWillCompound: (enabled) => set({ willCompound: enabled }),

    addCompletedItem: (item) => set((state) => ({
        completedItems: setCompletedItems(item, state.completedItems),
    })),

    clearCompletedItems: () => set({ completedItems: [] }),

    resetHarvest: () => set({
        harvestStatus: 'idle',
        harvestResult: null,
        harvestError: null,
        currentProgressText: '',
        completedItems: [],
    }),

    resetAll: () => set({ ...initialState }),
}));
