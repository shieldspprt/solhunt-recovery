// ─── Engine 6: cNFT Spam Cleaner Types ─────────────────────────────

export type CNFTCategory =
    | 'spam'
    | 'low_value'
    | 'potentially_valuable'
    | 'verified'
    | 'unknown';

export type SpamSignal =
    | 'unverified_collection'
    | 'no_metadata'
    | 'suspicious_name'
    | 'duplicate_image'
    | 'no_creators'
    | 'zero_royalty'
    | 'suspicious_uri'
    | 'known_spam_collection';

export interface CNFTItem {
    id: string;
    name: string;
    symbol: string;
    description: string;
    imageUri: string | null;
    metadataUri: string | null;
    collection: string | null;
    collectionName: string | null;
    isVerifiedCollection: boolean;
    floorPriceSOL: number | null;
    estimatedValueSOL: number;
    category: CNFTCategory;
    spamScore: number;
    spamSignals: SpamSignal[];
    treeAddress: string;
    leafIndex: number;
    dataHash: string;
    creatorHash: string;
    isSelected: boolean;
    isBurnable: boolean;
}

export interface CNFTScanResult {
    scannedAt: Date;
    totalCNFTs: number;
    categories: {
        spam: CNFTItem[];
        low_value: CNFTItem[];
        potentially_valuable: CNFTItem[];
        verified: CNFTItem[];
        unknown: CNFTItem[];
    };
    spamCount: number;
    lowValueCount: number;
    potentiallyValuableCount: number;
    verifiedCount: number;
    estimatedRecoverableSOL: number;
    totalPages: number;
    fullyScanned: boolean;
}

export interface BurnEstimate {
    selectedCount: number;
    sessionFeeSOL: number;
    networkFeeSOL: number;
    totalCostSOL: number;
    estimatedRecoverableSOL: number;
}

export interface BurnProof {
    assetId: string;
    root: string;
    proof: string[];
    nodeIndex: number;
    leaf: string;
    treeId: string;
    /** Timestamp when proof was fetched — for staleness detection (Audit §2.8) */
    fetchedAt: number;
}

export interface BurnResultItem {
    assetId: string;
    name: string;
    success: boolean;
    signature: string | null;
    errorMessage: string | null;
}

export interface BurnResult {
    success: boolean;
    burnedCount: number;
    failedCount: number;
    signatures: string[];
    sessionFeeSignature: string | null;
    items: BurnResultItem[];
}

export type CNFTScanStatus =
    | 'idle'
    | 'scanning'
    | 'scan_complete'
    | 'error';

export type CNFTBurnStatus =
    | 'idle'
    | 'fetching_proofs'
    | 'awaiting_confirmation'
    | 'burning'
    | 'sending_fee'
    | 'complete'
    | 'error';

export interface CNFTStoreState {
    scanStatus: CNFTScanStatus;
    scanResult: CNFTScanResult | null;
    scanError: string | null;
    burnStatus: CNFTBurnStatus;
    burnResult: BurnResult | null;
    burnError: string | null;
    selectedIds: string[];
    currentProgressText: string;
    completedItems: BurnResultItem[];
    burnProofs: Map<string, BurnProof>;
}

export interface CNFTStoreActions {
    setScanStatus: (status: CNFTScanStatus) => void;
    setScanResult: (result: CNFTScanResult) => void;
    setScanError: (error: string | null) => void;
    setBurnStatus: (status: CNFTBurnStatus) => void;
    setBurnResult: (result: BurnResult | null) => void;
    setBurnError: (error: string | null) => void;
    setCurrentProgressText: (text: string) => void;
    setBurnProofs: (proofs: Map<string, BurnProof>) => void;
    toggleItem: (id: string) => void;
    selectCategory: (category: CNFTCategory) => void;
    deselectCategory: (category: CNFTCategory) => void;
    addCompletedItem: (item: BurnResultItem) => void;
    resetBurn: () => void;
    resetAll: () => void;
}

// ─── DAS API response shape (used internally) ──────────────────────

export interface DASAsset {
    id: string;
    interface: string;
    compression: {
        eligible: boolean;
        compressed: boolean;
        data_hash: string;
        creator_hash: string;
        asset_hash: string;
        tree: string;
        seq: number;
        leaf_id: number;
    };
    grouping: Array<{
        group_key: string;
        group_value: string;
        verified: boolean;
    }>;
    content: {
        $schema: string;
        json_uri: string;
        metadata: {
            name: string;
            symbol: string;
            description: string;
        };
        files: Array<{ uri: string; mime: string }>;
        links: { image: string | null };
    };
    authorities: Array<{ address: string; scopes: string[] }>;
    creators: Array<{ address: string; share: number; verified: boolean }>;
    royalty: { basis_points: number; primary_sale_happened: boolean };
    supply: { print_max_supply: number; print_current_supply: number };
    mutable: boolean;
    burnt: boolean;
}
