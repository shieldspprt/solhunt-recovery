export interface TokenDefinition {
    mint: string;
    symbol: string;
    decimals: number;
}

export type DecommissionStatus =
    | 'winding_down'  // Active warning, UI still up but closing
    | 'ui_dead'       // UI offline, contracts active
    | 'partially_dead'// UI offline, some contracts paused
    | 'fully_dead';   // Protocol emptied, tokens are worthless

export type RecoveryMethodType =
    | 'direct_program_call' // We build the tx
    | 'redirect'            // We send them to an official recovery site
    | 'unknown'             // We know it's dead but haven't mapped recovery
    | 'no_recovery';        // It's impossible (e.g., rug pull, drained)

export interface WithdrawalMethod {
    type: RecoveryMethodType;
    instructions?: string[];
}

export interface PositionTokenDefinition extends TokenDefinition {
    positionType: 'lp_token' | 'vault_share' | 'lending_receipt' | 'staked_token' | 'governance' | 'other';
    poolOrVaultAddress?: string;
    underlyingTokenA?: string;
    underlyingTokenB?: string;
}

export interface DeadProtocol {
    id: string;
    name: string;
    logoUri: string | null;
    programId: string;
    decommissionStatus: DecommissionStatus;
    isRecoverable: boolean;
    recoveryUrl: string | null;
    withdrawalMethod: WithdrawalMethod;
    positionTokenMints: PositionTokenDefinition[];
}

export interface DecommissionPositionItem {
    tokenAccountAddress: string;
    tokenDef: PositionTokenDefinition;
    protocol: DeadProtocol;
    rawBalance: string;
    uiBalance: number;
    estimatedValueUSD: number | null;
    canRecover: boolean;
    recoveryMethod: 'in_app' | 'redirect' | 'none' | 'unknown';
    redirectUrl: string | null;
    urgency: 'critical' | 'high' | 'normal' | 'none';
    isSelected: boolean;
}

export interface DecommissionScanResult {
    scannedAt: Date;
    walletAddress: string;
    protocolsChecked: number;
    positionsFound: number;
    recoverableCount: number;
    redirectCount: number;
    unknownCount: number;
    confirmedWorthless: number;
    totalRecoverableUSD: number | null;
    windingDownCount: number;
    items: DecommissionPositionItem[];
}

export type DecommissionScanStatus = 'idle' | 'scanning' | 'scan_complete' | 'nothing_found' | 'error';

export interface DecommissionScanProgress {
    currentProtocol: string;
    processed: number;
    total: number;
}

export interface DecommissionRecoveryItemResult {
    protocolId: string;
    protocolName: string;
    tokenSymbol: string;
    success: boolean;
    signature: string | null;
    recoveredValueUSD: number | null;
    errorMessage: string | null;
    redirectUrl: string | null;
}

export interface DecommissionRecoveryResult {
    recoveredCount: number;
    redirectCount: number;
    failedCount: number;
    totalRecoveredUSD: number | null;
    serviceFeeSignature: string | null;
    items: DecommissionRecoveryItemResult[];
}

export type DecommissionRecoveryStatus = 'idle' | 'awaiting_confirmation' | 'recovering' | 'complete' | 'error';

export interface DecommissionRecoveryEstimate {
    selectedItems: DecommissionPositionItem[];
    inAppItems: DecommissionPositionItem[];
    redirectItems: DecommissionPositionItem[];
    totalValueUSD: number | null;
    serviceFeePercent: number;
    serviceFeeUSD: number | null;
    serviceFeeLamports: number;
    netValueUSD: number | null;
    txCount: number;
}
