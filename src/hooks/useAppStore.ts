import { create } from 'zustand';
import type {
    ScanStatus,
    ScanResult,
    RevokeStatus,
    RevokeResult,
    AppError,
    // Engine 2
    ReclaimStatus,
    CloseableAccount,
    ReclaimEstimate,
    ReclaimResult,
    // Engine 3
    DustScanResult,
    DustSwapQuote,
    DustStatus,
    DustResult,
    DustSwapProgressItem,
    DustBurnStatus,
    DustBurnResult,
    DustBurnProgressItem,
    // Engine 4
    TicketScanStatus,
    TicketScanResult,
    TicketClaimStatus_Action,
    TicketClaimResult,
    TicketClaimProgressItem,
    // Engine 7
    MEVScanStatus,
    MEVScanResult,
    MEVClaimStatus,
    MEVClaimResult,
} from '@/types';
import type {
    BufferScanStatus,
    BufferScanResult,
    BufferCloseStatus,
    BufferCloseResult,
} from '@/modules/buffer-recovery/types';

interface AppStore {
    // Agentic SEO
    agentWallet: string | null;

    // Scan state
    scanStatus: ScanStatus;
    scanResult: ScanResult | null;
    scanError: AppError | null;

    // Revoke state
    revokeStatus: RevokeStatus;
    revokeResult: RevokeResult | null;
    revokeError: AppError | null;

    // Engine 2: Reclaim state
    reclaimStatus: ReclaimStatus;
    closeableAccounts: CloseableAccount[];
    reclaimEstimate: ReclaimEstimate | null;
    reclaimResult: ReclaimResult | null;
    reclaimError: AppError | null;

    // Engine 3: Dust consolidator state
    dustScanResult: DustScanResult | null;
    swapQuotes: Map<string, DustSwapQuote>;
    selectedDustMints: string[];
    dustStatus: DustStatus;
    dustResult: DustResult | null;
    dustProgress: DustSwapProgressItem[];
    dustError: AppError | null;

    // Engine 3: Burn + reclaim state (for unswappable dust)
    dustBurnStatus: DustBurnStatus;
    dustBurnResult: DustBurnResult | null;
    dustBurnProgress: DustBurnProgressItem[];
    dustBurnError: AppError | null;
    dustBurnSelectionMints: string[];

    // Engine 4: Staking ticket finder state
    ticketScanStatus: TicketScanStatus;
    ticketScanResult: TicketScanResult | null;
    ticketScanError: AppError | null;
    ticketClaimStatus: TicketClaimStatus_Action;
    ticketClaimResult: TicketClaimResult | null;
    ticketClaimProgress: TicketClaimProgressItem[];
    ticketClaimError: AppError | null;

    // Engine 7: MEV claims state
    mevScanStatus: MEVScanStatus;
    mevScanResult: MEVScanResult | null;
    mevScanError: AppError | null;
    mevClaimStatus: MEVClaimStatus;
    mevClaimResult: MEVClaimResult | null;
    mevClaimError: AppError | null;
    selectedMEVIds: string[];
    mevProgressText: string;

    // Engine 9: Buffer recovery state
    bufferScanStatus: BufferScanStatus;
    bufferScanResult: BufferScanResult | null;
    bufferScanError: AppError | null;
    selectedBufferAddresses: string[];
    bufferCloseStatus: BufferCloseStatus;
    bufferCloseResult: BufferCloseResult | null;
    bufferCloseError: AppError | null;

    // Actions
    setAgentWallet: (wallet: string | null) => void;
    setScanStatus: (status: ScanStatus) => void;
    setScanResult: (result: ScanResult) => void;
    setScanError: (error: AppError) => void;
    clearScan: () => void;
    setRevokeStatus: (status: RevokeStatus) => void;
    setRevokeResult: (result: RevokeResult) => void;
    setRevokeError: (error: AppError) => void;
    clearRevoke: () => void;

    // Engine 2 Actions
    setCloseableAccounts: (accounts: CloseableAccount[]) => void;
    setReclaimStatus: (status: ReclaimStatus) => void;
    setReclaimResult: (result: ReclaimResult) => void;
    setReclaimError: (error: AppError) => void;
    clearReclaim: () => void;

    // Engine 3 Actions
    setDustScanResult: (result: DustScanResult | null) => void;
    setSwapQuotes: (quotes: Map<string, DustSwapQuote>) => void;
    toggleDustMint: (mint: string) => void;
    setAllDustMints: (mints: string[]) => void;
    setDustStatus: (status: DustStatus) => void;
    setDustResult: (result: DustResult) => void;
    setDustProgress: (progress: DustSwapProgressItem[]) => void;
    setDustError: (error: AppError) => void;
    clearDust: () => void;

    // Engine 3 Burn Actions
    setDustBurnStatus: (status: DustBurnStatus) => void;
    setDustBurnResult: (result: DustBurnResult) => void;
    setDustBurnProgress: (progress: DustBurnProgressItem[]) => void;
    setDustBurnError: (error: AppError) => void;
    setDustBurnSelectionMints: (mints: string[]) => void;
    clearDustBurn: () => void;

    // Engine 4 Actions
    setTicketScanStatus: (status: TicketScanStatus) => void;
    setTicketScanResult: (result: TicketScanResult) => void;
    setTicketScanError: (error: AppError) => void;
    setTicketClaimStatus: (status: TicketClaimStatus_Action) => void;
    setTicketClaimResult: (result: TicketClaimResult) => void;
    setTicketClaimProgress: (progress: TicketClaimProgressItem[]) => void;
    setTicketClaimError: (error: AppError) => void;
    clearTicketClaim: () => void;
    clearTickets: () => void;

    // Engine 7 Actions
    setMEVScanStatus: (status: MEVScanStatus) => void;
    setMEVScanResult: (result: MEVScanResult | null) => void;
    setMEVScanError: (error: AppError | null) => void;
    setMEVClaimStatus: (status: MEVClaimStatus) => void;
    setMEVClaimResult: (result: MEVClaimResult) => void;
    setMEVClaimError: (error: AppError) => void;
    clearMEVClaim: () => void;
    setSelectedMEVIds: (ids: string[]) => void;
    toggleMEVItem: (id: string) => void;
    selectAllMEV: () => void;
    deselectAllMEV: () => void;
    setMEVProgressText: (text: string) => void;
    resetMEVClaim: () => void;

    // Engine 9 Actions
    setBufferScanStatus: (status: BufferScanStatus) => void;
    setBufferScanResult: (result: BufferScanResult | null) => void;
    setBufferScanError: (error: AppError | null) => void;
    setSelectedBufferAddresses: (addresses: string[]) => void;
    toggleBufferSelection: (address: string) => void;
    selectAllBuffers: () => void;
    deselectAllBuffers: () => void;
    setBufferCloseStatus: (status: BufferCloseStatus) => void;
    setBufferCloseResult: (result: BufferCloseResult | null) => void;
    setBufferCloseError: (error: AppError | null) => void;
    clearBuffers: () => void;

    resetAll: () => void;
}

const initialState = {
    // Agentic SEO
    agentWallet: null as string | null,

    scanStatus: 'idle' as ScanStatus,
    scanResult: null,
    scanError: null,
    revokeStatus: 'idle' as RevokeStatus,
    revokeResult: null,
    revokeError: null,

    // Engine 2
    reclaimStatus: 'idle' as ReclaimStatus,
    closeableAccounts: [],
    reclaimEstimate: null,
    reclaimResult: null,
    reclaimError: null,

    // Engine 3
    dustScanResult: null,
    swapQuotes: new Map<string, DustSwapQuote>(),
    selectedDustMints: [],
    dustStatus: 'idle' as DustStatus,
    dustResult: null,
    dustProgress: [],
    dustError: null,

    // Engine 3 Burn
    dustBurnStatus: 'idle' as DustBurnStatus,
    dustBurnResult: null,
    dustBurnProgress: [],
    dustBurnError: null,
    dustBurnSelectionMints: [],

    // Engine 4
    ticketScanStatus: 'idle' as TicketScanStatus,
    ticketScanResult: null,
    ticketScanError: null,
    ticketClaimStatus: 'idle' as TicketClaimStatus_Action,
    ticketClaimResult: null,
    ticketClaimProgress: [],
    ticketClaimError: null,

    // Engine 7
    mevScanStatus: 'idle' as MEVScanStatus,
    mevScanResult: null,
    mevScanError: null,
    mevClaimStatus: 'idle' as MEVClaimStatus,
    mevClaimResult: null,
    mevClaimError: null,
    selectedMEVIds: [],
    mevProgressText: '',

    // Engine 9
    bufferScanStatus: 'idle' as BufferScanStatus,
    bufferScanResult: null,
    bufferScanError: null,
    selectedBufferAddresses: [],
    bufferCloseStatus: 'idle' as BufferCloseStatus,
    bufferCloseResult: null,
    bufferCloseError: null,
};

export const useAppStore = create<AppStore>((set) => ({
    ...initialState,

    setAgentWallet: (wallet) => set({ agentWallet: wallet }),
    setScanStatus: (status) => set({ scanStatus: status }),
    setScanResult: (result) =>
        set({ scanResult: result, scanStatus: 'scan_complete', scanError: null }),
    setScanError: (error) =>
        set({ scanError: error, scanStatus: 'error' }),
    clearScan: () =>
        set({
            scanStatus: 'idle',
            scanResult: null,
            scanError: null,
            // Engine 2 reset
            reclaimStatus: 'idle',
            closeableAccounts: [],
            reclaimEstimate: null,
            reclaimResult: null,
            reclaimError: null,
            // Engine 3 reset
            dustScanResult: null,
            swapQuotes: new Map<string, DustSwapQuote>(),
            selectedDustMints: [],
            dustStatus: 'idle',
            dustResult: null,
            dustProgress: [],
            dustError: null,
            dustBurnStatus: 'idle',
            dustBurnResult: null,
            dustBurnProgress: [],
            dustBurnError: null,
            dustBurnSelectionMints: [],
            // Engine 4 reset
            ticketScanStatus: 'idle',
            ticketScanResult: null,
            ticketScanError: null,
            ticketClaimStatus: 'idle',
            ticketClaimResult: null,
            ticketClaimProgress: [],
            ticketClaimError: null,
            // Engine 7 reset
            mevScanStatus: 'idle',
            mevScanResult: null,
            mevScanError: null,
            mevClaimStatus: 'idle',
            mevClaimResult: null,
            mevClaimError: null,
            selectedMEVIds: [],
            mevProgressText: '',
            // Engine 9 reset
            bufferScanStatus: 'idle',
            bufferScanResult: null,
            bufferScanError: null,
            selectedBufferAddresses: [],
            bufferCloseStatus: 'idle',
            bufferCloseResult: null,
            bufferCloseError: null,
        }),

    setRevokeStatus: (status) => set({ revokeStatus: status }),
    setRevokeResult: (result) =>
        set({ revokeResult: result, revokeStatus: 'complete', revokeError: null }),
    setRevokeError: (error) =>
        set({ revokeError: error, revokeStatus: 'error' }),
    clearRevoke: () =>
        set({
            revokeStatus: 'idle',
            revokeResult: null,
            revokeError: null,
        }),

    // Engine 2: Reclaim
    setCloseableAccounts: (accounts) => set({ closeableAccounts: accounts }),
    setReclaimStatus: (status) => set({ reclaimStatus: status }),
    setReclaimResult: (result) =>
        set({ reclaimResult: result, reclaimStatus: 'complete', reclaimError: null }),
    setReclaimError: (error) =>
        set({ reclaimError: error, reclaimStatus: 'error' }),
    clearReclaim: () =>
        set({
            reclaimStatus: 'idle',
            reclaimResult: null,
            reclaimError: null,
            // We intentionally do not clear closeableAccounts here, it persists from the scan
        }),

    // Engine 3: Dust consolidator
    setDustScanResult: (result) => set({ dustScanResult: result }),
    setSwapQuotes: (quotes) => set({ swapQuotes: quotes }),
    toggleDustMint: (mint) =>
        set((state) => ({
            selectedDustMints: state.selectedDustMints.includes(mint)
                ? state.selectedDustMints.filter((existingMint) => existingMint !== mint)
                : [...state.selectedDustMints, mint],
        })),
    setAllDustMints: (mints) => set({ selectedDustMints: mints }),
    setDustStatus: (status) => set({ dustStatus: status }),
    setDustResult: (result) =>
        set({ dustResult: result, dustStatus: 'complete', dustError: null }),
    setDustProgress: (progress) => set({ dustProgress: progress }),
    setDustError: (error) =>
        set({ dustError: error, dustStatus: 'error' }),
    clearDust: () =>
        set({
            dustStatus: 'idle',
            dustResult: null,
            dustProgress: [],
            dustError: null,
        }),

    // Engine 3: Burn + reclaim
    setDustBurnStatus: (status) => set({ dustBurnStatus: status }),
    setDustBurnResult: (result) =>
        set({ dustBurnResult: result, dustBurnStatus: 'complete', dustBurnError: null }),
    setDustBurnProgress: (progress) => set({ dustBurnProgress: progress }),
    setDustBurnError: (error) =>
        set({ dustBurnError: error, dustBurnStatus: 'error' }),
    setDustBurnSelectionMints: (mints) => set({ dustBurnSelectionMints: mints }),
    clearDustBurn: () =>
        set({
            dustBurnStatus: 'idle',
            dustBurnResult: null,
            dustBurnProgress: [],
            dustBurnError: null,
            dustBurnSelectionMints: [],
        }),

    // Engine 4: Staking tickets
    setTicketScanStatus: (status) => set({ ticketScanStatus: status }),
    setTicketScanResult: (result) =>
        set({ ticketScanResult: result, ticketScanStatus: 'scan_complete', ticketScanError: null }),
    setTicketScanError: (error) =>
        set({ ticketScanError: error, ticketScanStatus: 'error' }),
    setTicketClaimStatus: (status) => set({ ticketClaimStatus: status }),
    setTicketClaimResult: (result) =>
        set({ ticketClaimResult: result, ticketClaimStatus: 'complete', ticketClaimError: null }),
    setTicketClaimProgress: (progress) => set({ ticketClaimProgress: progress }),
    setTicketClaimError: (error) =>
        set({ ticketClaimError: error, ticketClaimStatus: 'error' }),
    clearTicketClaim: () =>
        set({
            ticketClaimStatus: 'idle',
            ticketClaimResult: null,
            ticketClaimProgress: [],
            ticketClaimError: null,
        }),
    clearTickets: () =>
        set({
            ticketScanStatus: 'idle',
            ticketScanResult: null,
            ticketScanError: null,
            ticketClaimStatus: 'idle',
            ticketClaimResult: null,
            ticketClaimProgress: [],
            ticketClaimError: null,
            // Engine 7 reset
            mevScanStatus: 'idle',
            mevScanResult: null,
            mevScanError: null,
            mevClaimStatus: 'idle',
            mevClaimResult: null,
            mevClaimError: null,
            selectedMEVIds: [],
            mevProgressText: '',
        }),

    // Engine 7 Actions
    setMEVScanStatus: (status) => set({ mevScanStatus: status }),
    setMEVScanResult: (result) => set({ mevScanResult: result }),
    setMEVScanError: (error) => set({ mevScanError: error, mevScanStatus: 'error' }),
    setMEVClaimStatus: (status) => set({ mevClaimStatus: status }),
    setMEVClaimResult: (result) => set({ mevClaimResult: result, mevClaimStatus: 'complete', mevClaimError: null }),
    setMEVClaimError: (error) => set({ mevClaimError: error, mevClaimStatus: 'error' }),
    clearMEVClaim: () =>
        set({
            mevClaimStatus: 'idle',
            mevClaimResult: null,
            mevClaimError: null,
            mevProgressText: '',
            selectedMEVIds: [],
        }),
    setSelectedMEVIds: (ids) => set({ selectedMEVIds: ids }),
    toggleMEVItem: (id) =>
        set((state) => ({
            selectedMEVIds: state.selectedMEVIds.includes(id)
                ? state.selectedMEVIds.filter((idx) => idx !== id)
                : [...state.selectedMEVIds, id],
        })),
    selectAllMEV: () =>
        set((state) => ({
            selectedMEVIds: state.mevScanResult ? state.mevScanResult.items.map(i => `${i.stakeAccount}-${i.epoch}`) : [],
        })),
    deselectAllMEV: () => set({ selectedMEVIds: [] }),
    setMEVProgressText: (text) => set({ mevProgressText: text }),
    resetMEVClaim: () =>
        set({
            mevClaimStatus: 'idle',
            mevClaimResult: null,
            mevClaimError: null,
            mevProgressText: '',
        }),

    // Engine 9 Actions
    setBufferScanStatus: (status) => set({ bufferScanStatus: status }),
    setBufferScanResult: (result) =>
        set({ bufferScanResult: result, bufferScanStatus: 'scan_complete', bufferScanError: null }),
    setBufferScanError: (error) =>
        set({ bufferScanError: error, bufferScanStatus: 'error' }),
    setSelectedBufferAddresses: (addresses) => set({ selectedBufferAddresses: addresses }),
    toggleBufferSelection: (address) =>
        set((state) => ({
            selectedBufferAddresses: state.selectedBufferAddresses.includes(address)
                ? state.selectedBufferAddresses.filter((a) => a !== address)
                : [...state.selectedBufferAddresses, address],
        })),
    selectAllBuffers: () =>
        set((state) => ({
            selectedBufferAddresses: state.bufferScanResult?.closeableBuffers.map((b) => b.address) || [],
        })),
    deselectAllBuffers: () => set({ selectedBufferAddresses: [] }),
    setBufferCloseStatus: (status) => set({ bufferCloseStatus: status }),
    setBufferCloseResult: (result) =>
        set({ bufferCloseResult: result, bufferCloseStatus: 'complete', bufferCloseError: null }),
    setBufferCloseError: (error) =>
        set({ bufferCloseError: error, bufferCloseStatus: 'error' }),
    clearBuffers: () =>
        set({
            bufferScanStatus: 'idle',
            bufferScanResult: null,
            bufferScanError: null,
            selectedBufferAddresses: [],
            bufferCloseStatus: 'idle',
            bufferCloseResult: null,
            bufferCloseError: null,
        }),

    resetAll: () => set((state) => ({
        ...initialState,
        swapQuotes: new Map<string, DustSwapQuote>(),
        agentWallet: state.agentWallet || null, // Preserve agent wallet through reset
    })),
}));
