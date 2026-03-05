// All token program IDs that can have delegations
export type TokenProgramId =
    | 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'   // SPL Token
    | 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';  // Token-2022

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TokenDelegation {
    tokenAccountAddress: string;   // The token account public key
    mint: string;                   // Token mint address
    delegate: string;               // Program/wallet that has permission
    delegatedAmount: string;        // Amount the delegate can move (as string to avoid BigInt issues)
    ownerBalance: number;           // Current token balance of the owner
    ownerBalanceRaw: string;        // Raw balance as string
    decimals: number;               // Token decimals
    tokenSymbol: string;            // Token symbol if resolvable, else "UNKNOWN"
    programId: TokenProgramId;      // Which token program owns this account
    riskLevel: RiskLevel;           // Calculated risk level
    isKnownDelegate: boolean;       // Whether delegate is in known protocol list
}

export interface EmptyTokenAccount {
    address: string;
    mint: string;
    estimatedRentLamports: number;
    programId: TokenProgramId;
}

export interface TokenHolding {
    tokenAccountAddress: string;
    mint: string;
    rawBalance: string;
    uiBalance: number;
    decimals: number;
    programId: TokenProgramId;
}

export interface ScanResult {
    walletAddress: string;
    scannedAt: Date;
    totalTokenAccounts: number;
    delegations: TokenDelegation[];
    emptyAccounts: EmptyTokenAccount[];
    tokenHoldings: TokenHolding[];
    estimatedRecoverableSOL: number;
    scanDurationMs: number;
}

export type ScanStatus =
    | 'idle'
    | 'scanning'
    | 'scan_complete'
    | 'error';

export type RevokeStatus =
    | 'idle'
    | 'awaiting_confirmation'
    | 'building_transaction'
    | 'awaiting_signature'
    | 'confirming'
    | 'complete'
    | 'error';

export interface RevokeResult {
    success: boolean;
    signature: string | null;
    revokedCount: number;
    errorMessage: string | null;
}

export interface AppError {
    code: string;
    message: string;           // User-facing message (plain English)
    technicalDetail: string;   // For logging, not shown to user
}

// ─── ENGINE 2: RENT RECLAIMER ────────────────────────────

export interface CloseableAccount {
    address: string;           // Token account public key
    mint: string;              // Token mint (for display)
    tokenSymbol: string;       // "USDC", "BONK", or "UNKNOWN"
    tokenBalance: number;      // Should be 0 — but verify
    estimatedRentLamports: number;   // Lamports locked in this account (~2039280)
    estimatedRentSOL: number;        // estimatedRentLamports / 1e9
    programId: TokenProgramId; // Which token program owns it
}

export interface ReclaimEstimate {
    totalAccounts: number;
    totalLamports: number;
    totalSOL: number;
    userReceivesSOL: number;   // After service fee
    serviceFeeSOL: number;
    networkFeeSOL: number;
}

export type ReclaimStatus =
    | 'idle'
    | 'awaiting_confirmation'
    | 'building_transaction'
    | 'awaiting_signature'
    | 'confirming'
    | 'complete'
    | 'error';

export interface ReclaimResult {
    success: boolean;
    closedCount: number;
    reclaimedSOL: number;
    signature: string | null;
    errorMessage: string | null;
}

// ─── ENGINE 3: DUST CONSOLIDATOR ─────────────────────────

export interface DustToken {
    tokenAccountAddress: string;
    mint: string;
    tokenSymbol: string;
    tokenLogoUri: string | null;
    rawBalance: string;
    uiBalance: number;
    decimals: number;
    estimatedPriceUSD: number;
    estimatedValueUSD: number;
    estimatedValueSOL: number;
    isSwappable: boolean;
    routeSource: string;
    programId: TokenProgramId;
}

export interface DustScanResult {
    dustTokens: DustToken[];
    totalEstimatedValueUSD: number;
    totalEstimatedValueSOL: number;
    swappableCount: number;
    unswappableCount: number;
}

export interface DustSwapQuote {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    outAmountSOL: number;
    priceImpactPct: number;
    routePlan: string;
    provider: 'jupiter' | 'raydium';
    rawQuote: unknown;
}

export type DustStatus =
    | 'idle'
    | 'fetching_prices'
    | 'awaiting_confirmation'
    | 'swapping'
    | 'complete'
    | 'error';

export type DustSwapItemStatus = 'pending' | 'swapping' | 'success' | 'failed' | 'skipped';

export interface DustSwapProgressItem {
    mint: string;
    tokenSymbol: string;
    status: DustSwapItemStatus;
    signature: string | null;
    receivedSOL: number;
    message: string;
}

export interface DustResult {
    success: boolean;
    swappedCount: number;
    failedCount: number;
    receivedSOL: number;
    signatures: string[];
    errorMessage: string | null;
}

export type DustBurnStatus =
    | 'idle'
    | 'awaiting_confirmation'
    | 'burning'
    | 'complete'
    | 'error';

export interface DustBurnEstimate {
    totalAccounts: number;
    totalReclaimSOL: number;
    serviceFeeSOL: number;
    networkFeeSOL: number;
    userReceivesSOL: number;
}

export type DustBurnItemStatus = 'pending' | 'burning' | 'success' | 'failed' | 'skipped';

export interface DustBurnProgressItem {
    mint: string;
    tokenSymbol: string;
    status: DustBurnItemStatus;
    signature: string | null;
    reclaimedSOL: number;
    message: string;
}

export interface DustBurnResult {
    success: boolean;
    burnedCount: number;
    failedCount: number;
    reclaimedSOL: number;
    signatures: string[];
    errorMessage: string | null;
}

// ─── ENGINE 4: STAKING TICKET FINDER ─────────────────────

export type StakingProtocol =
    | 'marinade'
    | 'sanctum'
    | 'jito'
    | 'blazestake'
    | 'native_stake'
    | 'unknown';

export type TicketClaimStatus =
    | 'claimable'
    | 'pending'
    | 'unknown';

export interface StakingTicket {
    id: string;
    ticketAccountAddress: string;
    protocol: StakingProtocol;
    protocolDisplayName: string;
    protocolLogoUri: string | null;
    valueSOL: number;
    valueLamports: string;
    claimStatus: TicketClaimStatus;
    createdEpoch: number | null;
    claimableAfterEpoch: number | null;
    currentEpoch: number;
    epochsRemaining: number | null;
    estimatedTimeRemainingHours: number | null;
    isNativeStake: boolean;
    validatorVoteAccount: string | null;
}

export interface TicketScanResult {
    scannedAt: Date;
    currentEpoch: number;
    tickets: StakingTicket[];
    claimableTickets: StakingTicket[];
    pendingTickets: StakingTicket[];
    totalClaimableSOL: number;
    totalPendingSOL: number;
    totalValueSOL: number;
    protocolsScanned: StakingProtocol[];
    protocolsWithErrors: StakingProtocol[];
}

export interface TicketClaimEstimate {
    claimableCount: number;
    totalClaimableSOL: number;
    serviceFeeSOL: number;
    networkFeeSOL: number;
    userReceivesSOL: number;
    userReceivesUSD: number;
}

export type TicketScanStatus =
    | 'idle'
    | 'scanning'
    | 'scan_complete'
    | 'error';

export type TicketClaimStatus_Action =
    | 'idle'
    | 'awaiting_confirmation'
    | 'building_transaction'
    | 'awaiting_signature'
    | 'confirming'
    | 'complete'
    | 'error';

export interface TicketClaimResult {
    success: boolean;
    claimedCount: number;
    claimedSOL: number;
    signatures: string[];
    failedTickets: string[];
    errorMessage: string | null;
}

export type TicketProgressStatus =
    | 'pending'
    | 'building'
    | 'awaiting_signature'
    | 'confirming'
    | 'success'
    | 'failed'
    | 'skipped';

export interface TicketClaimProgressItem {
    id: string;
    ticketAccountAddress: string;
    protocol: StakingProtocol;
    status: TicketProgressStatus;
    signature: string | null;
    claimedSOL: number;
    message: string;
}
