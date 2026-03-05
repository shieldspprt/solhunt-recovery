export type LPProtocol = 'orca' | 'raydium_clmm' | 'raydium_amm' | 'meteora';

export type PositionStatus =
    | 'in_range'
    | 'out_of_range'
    | 'full_range'
    | 'unknown';

export interface TokenAmount {
    mint: string;
    symbol: string;
    logoUri: string | null;
    rawAmount: string;
    uiAmount: number;
    decimals: number;
    valueUSD: number;
}

export interface LPPosition {
    id: string;
    positionAddress: string;
    protocol: LPProtocol;
    protocolDisplayName: string;
    poolAddress: string;
    poolName: string;
    tokenA: string;
    tokenB: string;
    tokenASymbol: string;
    tokenBSymbol: string;
    unclaimedFeeA: TokenAmount;
    unclaimedFeeB: TokenAmount;
    totalFeeValueUSD: number;
    totalFeeValueSOL: number;
    status: PositionStatus;
    liquidityUSD: number;
    priceRangeLower: number | null;
    priceRangeUpper: number | null;
    currentPrice: number | null;
    lastHarvestedAt: Date | null;
    isSelected: boolean;
}

export interface LPScanResult {
    scannedAt: Date;
    positions: LPPosition[];
    totalPositions: number;
    positionsWithFees: number;
    totalFeeValueUSD: number;
    totalFeeValueSOL: number;
    protocolBreakdown: Array<{
        protocol: LPProtocol;
        positionCount: number;
        feeValueUSD: number;
    }>;
    protocolsScanned: LPProtocol[];
    protocolsWithErrors: LPProtocol[];
}

export interface HarvestEstimate {
    selectedPositions: number;
    totalFeeValueUSD: number;
    totalFeeValueSOL: number;
    serviceFeePercent: number;
    serviceFeeSOL: number;
    networkFeeSOL: number;
    userReceivesValueUSD: number;
    willCompound: boolean;
}

export interface HarvestResultItem {
    positionId: string;
    positionAddress: string;
    protocol: LPProtocol;
    poolName: string;
    success: boolean;
    harvestedFeeA: TokenAmount | null;
    harvestedFeeB: TokenAmount | null;
    harvestedValueUSD: number;
    signature: string | null;
    errorMessage: string | null;
}

export interface CompoundResult {
    success: boolean;
    tokensSwapped: number;
    solAddedToPositions: number;
    signatures: string[];
    errorMessage: string | null;
}

export interface HarvestResult {
    success: boolean;
    totalHarvested: number;
    totalFailed: number;
    totalValueUSD: number;
    totalValueSOL: number;
    serviceFeeSOL: number;
    feeSignature: string | null;
    items: HarvestResultItem[];
    compoundAttempted: boolean;
    compoundResult: CompoundResult | null;
}

export type LPScanStatus =
    | 'idle'
    | 'scanning'
    | 'scan_complete'
    | 'error';

export type LPHarvestStatus =
    | 'idle'
    | 'awaiting_confirmation'
    | 'harvesting'
    | 'compounding'
    | 'sending_fee'
    | 'complete'
    | 'error';

export interface LPStoreState {
    scanStatus: LPScanStatus;
    scanResult: LPScanResult | null;
    scanError: string | null;
    harvestStatus: LPHarvestStatus;
    harvestResult: HarvestResult | null;
    harvestError: string | null;
    willCompound: boolean;
    selectedPositionIds: string[];
    currentProgressText: string;
    completedItems: HarvestResultItem[];
}

export interface LPStoreActions {
    setScanStatus: (status: LPScanStatus) => void;
    setScanResult: (result: LPScanResult) => void;
    setScanError: (error: string | null) => void;
    setHarvestStatus: (status: LPHarvestStatus) => void;
    setHarvestResult: (result: HarvestResult | null) => void;
    setHarvestError: (error: string | null) => void;
    setCurrentProgressText: (text: string) => void;
    togglePosition: (id: string) => void;
    setWillCompound: (enabled: boolean) => void;
    addCompletedItem: (item: HarvestResultItem) => void;
    clearCompletedItems: () => void;
    resetHarvest: () => void;
    resetAll: () => void;
}
