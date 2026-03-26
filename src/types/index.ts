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
    /** Which swap provider to use. Only set when isSwappable is true and a quote has been obtained */
    provider?: 'jupiter' | 'raydium';
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
    /** Raw quote from the swap provider for debugging and replay */
    rawQuote: JupiterQuoteResponse | RaydiumQuoteData;
}

/** Raw Jupiter quote response shape */
interface JupiterQuoteResponse {
    inputMint?: string;
    outputMint?: string;
    inAmount?: string;
    outAmount?: string;
    priceImpactPct?: string;
    routePlan?: JupiterRoutePlan[];
}

/** Raw Raydium quote response shape */
interface RaydiumQuoteData {
    inputMint?: string;
    outputMint?: string;
    inputAmount?: string;
    outputAmount?: string;
    priceImpactPct?: number | string;
    routePlan?: RaydiumRoutePlan[];
}

interface JupiterRoutePlan {
    swapInfo?: {
        label?: string;
    };
}

interface RaydiumRoutePlan {
    poolId?: string;
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

// ─── ENGINE 7: MEV & PRIORITY FEE CLAIMS ─────────────────

export interface MEVClaimItem {
    // Identity
    stakeAccount: string;           // Stake account pubkey
    voteAccount: string;            // Validator vote account
    validatorName: string | null;   // Human readable (from Jito API or null)
    epoch: number;                  // Epoch this reward is from

    // Amounts
    mevLamports: number;            // Claimable MEV tip rewards
    priorityFeeLamports: number;    // Claimable priority fee rewards
    totalLamports: number;          // mevLamports + priorityFeeLamports
    totalSOL: number;               // totalLamports / LAMPORTS_PER_SOL
    estimatedValueUSD: number;      // totalSOL * solPrice

    // Commission (shown for transparency)
    mevCommissionBps: number;       // Validator's MEV commission
    priorityFeeCommissionBps: number;

    // Claim data (needed to build transaction)
    tipDistributionAccount: string;
    claimStatusAccount: string;
    merkleProof: string[];          // Base58 encoded proof nodes
    merkleRoot: string;

    // State
    isClaimed: boolean;             // Already claimed — should be filtered out
    isSelected: boolean;            // User selection for batch claim
}

export interface MEVScanResult {
    scannedAt: Date;
    totalItems: number;
    totalClaimableSOL: number;
    totalClaimableUSD: number;
    items: MEVClaimItem[];
    epochsScanned: number[];        // Which epochs had claimable rewards
    oldestEpoch: number | null;     // Oldest unclaimed epoch found
    newestEpoch: number | null;     // Most recent unclaimed epoch found
}

export interface MEVClaimEstimate {
    selectedCount: number;
    totalClaimSOL: number;
    totalClaimUSD: number;
    serviceFeeSOL: number;          // 5% of totalClaimSOL
    serviceFeeLamports: number;
    networkFeeSOL: number;          // ~0.000005 * tx count
    netReceivedSOL: number;         // totalClaimSOL - serviceFeeSOL
}

export interface MEVClaimResultItem {
    stakeAccount: string;
    epoch: number;
    success: boolean;
    signature: string | null;
    claimedLamports: number;
    errorMessage: string | null;
}

export interface MEVClaimResult {
    success: boolean;
    claimedCount: number;
    failedCount: number;
    totalClaimedLamports: number;
    totalClaimedSOL: number;
    serviceFeeSignature: string | null;
    signatures: string[];
    items: MEVClaimResultItem[];
}

export type MEVScanStatus =
    | 'idle'
    | 'scanning'
    | 'scan_complete'
    | 'no_rewards'
    | 'error';

export type MEVClaimStatus =
    | 'idle'
    | 'awaiting_confirmation'
    | 'claiming'
    | 'sending_fee'
    | 'complete'
    | 'error';

// ─── HOME WALLET SCANNER ────────────────────────────────

/**
 * API response type for wallet scan endpoint.
 * Uses snake_case to match the API response structure.
 */
export interface WalletScanResponse {
    address: string;
    health_score: number;
    grade: string;
    health_label: string;
    closeable_accounts: number;
    dust_tokens: number;
    recoverable_sol: number;
    estimated_tx_cost_sol: number;
    net_recoverable_sol: number;
    worth_cleaning: boolean;
    scanned_at: string;
}