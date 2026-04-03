import { PublicKey } from '@solana/web3.js';
import type { StakingProtocol } from '@/types';

// ─── Fee Configuration ──────────────────────────────────────────
export const SERVICE_FEE_SOL = parseFloat(import.meta.env.VITE_SERVICE_FEE_SOL || '0.01');
export const SERVICE_FEE_LAMPORTS = Math.round(SERVICE_FEE_SOL * 1e9);
export const TREASURY_WALLET = new PublicKey(
    import.meta.env.VITE_TREASURY_WALLET || 'DD4AdYKVcV6kgpmiCEeASRmJyRdKgmaRAbsjKucx8CvY'
);

// ─── Solana Constants ───────────────────────────────────────────
export const RENT_PER_TOKEN_ACCOUNT_LAMPORTS = 2039280; // ~0.00203928 SOL
export const RENT_PER_TOKEN_ACCOUNT_SOL = 0.00203928;
export const MAX_REVOKES_PER_TX = 15; // Conservative limit for safety
export const MAX_INSTRUCTIONS_PER_TX = 25;
export const NETWORK_FEE_PER_SIGNATURE_SOL = 0.000005;

// ─── Rate Limiting ──────────────────────────────────────────────
export const SCAN_COOLDOWN_MS = 10_000; // 10 seconds between scans

// ─── App Environment ────────────────────────────────────────────
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';
export const IS_PRODUCTION = APP_ENV === 'production';

// ─── Error Codes & Messages ─────────────────────────────────────
export const ERROR_CODES = {
    INVALID_ADDRESS: 'INVALID_ADDRESS',
    RPC_ERROR: 'RPC_ERROR',
    RPC_TIMEOUT: 'RPC_TIMEOUT',
    WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
    INSUFFICIENT_SOL: 'INSUFFICIENT_SOL',
    TX_BUILD_FAILED: 'TX_BUILD_FAILED',
    TX_REJECTED: 'TX_REJECTED',
    TX_FAILED: 'TX_FAILED',
    TX_TIMEOUT: 'TX_TIMEOUT',
    SCAN_FAILED: 'SCAN_FAILED',
    UNKNOWN: 'UNKNOWN',

    // Engine 2
    RECLAIM_NO_ACCOUNTS: 'RECLAIM_NO_ACCOUNTS',
    RECLAIM_TX_FAILED: 'RECLAIM_TX_FAILED',

    // Engine 3
    DUST_PRICE_FETCH_FAILED: 'DUST_PRICE_FETCH_FAILED',
    DUST_QUOTE_FAILED: 'DUST_QUOTE_FAILED',
    DUST_SWAP_FAILED: 'DUST_SWAP_FAILED',
    DUST_BURN_FAILED: 'DUST_BURN_FAILED',
    ROUTER_UNAVAILABLE: 'ROUTER_UNAVAILABLE',

    // Engine 4
    TICKET_SCAN_FAILED: 'TICKET_SCAN_FAILED',
    MARINADE_SCAN_FAILED: 'MARINADE_SCAN_FAILED',
    SANCTUM_API_FAILED: 'SANCTUM_API_FAILED',
    JITO_SCAN_FAILED: 'JITO_SCAN_FAILED',
    STAKE_SCAN_FAILED: 'STAKE_SCAN_FAILED',
    TICKET_CLAIM_FAILED: 'TICKET_CLAIM_FAILED',
    TICKET_ALREADY_CLAIMED: 'TICKET_ALREADY_CLAIMED',
    TICKET_NOT_READY: 'TICKET_NOT_READY',

    // Engine 7
    MEV_SCAN_FAILED: 'MEV_SCAN_FAILED',
    MEV_CLAIM_FAILED: 'MEV_CLAIM_FAILED',
    MEV_CLAIM_PARTIAL: 'MEV_CLAIM_PARTIAL',
    MEV_ALREADY_CLAIMED: 'MEV_ALREADY_CLAIMED',
    MEV_PROOF_INVALID: 'MEV_PROOF_INVALID',
    MEV_API_UNAVAILABLE: 'MEV_API_UNAVAILABLE',
} as const;

export const ERROR_MESSAGES: Record<keyof typeof ERROR_CODES, string> = {
    INVALID_ADDRESS: "That doesn't look like a valid Solana wallet address.",
    RPC_ERROR: 'Could not connect to the Solana network. Try again in 30 seconds or switch to a different network.',
    RPC_TIMEOUT: 'The Solana network is taking too long to respond. Check your internet connection or try again when network congestion is lower.',
    WALLET_NOT_CONNECTED: 'Please connect your wallet first.',
    INSUFFICIENT_SOL: 'You need at least 0.015 SOL to cover the service fee and network fees.',
    TX_BUILD_FAILED: 'Could not build the transaction. Please try again.',
    TX_REJECTED: 'Transaction was cancelled. Your wallet was not changed.',
    TX_FAILED: 'The transaction failed on-chain. Your funds are safe — try again or contact support if the issue persists.',
    TX_TIMEOUT: 'Transaction sent but confirmation timed out. Check Solscan to see if it went through.',
    SCAN_FAILED: 'Could not complete the scan. Please try again.',
    UNKNOWN: 'Something unexpected happened. Please refresh the page and try again.',

    // Engine 2
    RECLAIM_NO_ACCOUNTS: 'Not enough empty accounts to reclaim.',
    RECLAIM_TX_FAILED: 'Could not close accounts. No changes were made.',

    // Engine 3
    DUST_PRICE_FETCH_FAILED: 'Could not fetch token prices. Please try again.',
    DUST_QUOTE_FAILED: 'Could not get swap quotes. Please try again.',
    DUST_SWAP_FAILED: 'One or more swaps failed. Check your wallet for partial results.',
    DUST_BURN_FAILED: 'Could not burn and close one or more dust accounts.',
    ROUTER_UNAVAILABLE: 'Swap router is currently unavailable. Try again later.',

    // Engine 4
    TICKET_SCAN_FAILED: 'Could not scan for staking tickets. Please try again.',
    MARINADE_SCAN_FAILED: 'Could not scan Marinade Finance. This protocol may be temporarily unavailable.',
    SANCTUM_API_FAILED: 'Sanctum API is unavailable. Your tickets may still exist. Try again later.',
    JITO_SCAN_FAILED: 'Could not scan Jito stake accounts.',
    STAKE_SCAN_FAILED: 'Could not scan native stake accounts.',
    TICKET_CLAIM_FAILED: 'Ticket claim failed. Your SOL was not affected. Please try again.',
    TICKET_ALREADY_CLAIMED: 'This ticket has already been claimed.',
    TICKET_NOT_READY: 'This ticket cannot be claimed yet. The unstaking period has not completed.',

    // Engine 7
    MEV_SCAN_FAILED: 'Could not fetch MEV rewards. This is optional — your staking tickets are unaffected.',
    MEV_CLAIM_FAILED: 'Claim transaction failed. Your unclaimed rewards are still waiting.',
    MEV_CLAIM_PARTIAL: 'Some rewards were claimed. Check details below.',
    MEV_ALREADY_CLAIMED: 'These rewards have already been claimed.',
    MEV_PROOF_INVALID: 'Reward proof is invalid or expired. This epoch may have been recalculated.',
    MEV_API_UNAVAILABLE: 'Jito rewards API is temporarily unavailable. Try again later.',
};

// ─── Known Safe Delegate Addresses ──────────────────────────────
// These are well-known protocol program addresses.
// "Known Protocol" does NOT mean "safe" — even known protocols can be exploited.
export interface KnownDelegate {
    address: string;
    name: string;
}

export const KNOWN_DELEGATES: KnownDelegate[] = [
    // Orca Whirlpool
    { address: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', name: 'Orca Whirlpool' },
    // Raydium AMM
    { address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', name: 'Raydium AMM V4' },
    { address: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', name: 'Raydium CLMM' },
    { address: '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h', name: 'Raydium AMM' },
    // Jupiter Aggregator
    { address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', name: 'Jupiter V6' },
    { address: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', name: 'Jupiter V4' },
    { address: 'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uN9eeh', name: 'Jupiter V2' },
    // Marinade Finance
    { address: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', name: 'Marinade Finance' },
    // Sanctum
    { address: 'SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY', name: 'Sanctum' },
    // Kamino Finance
    { address: 'KLend2g3cP87ber41GUBYKwYReAi4Vu7UGUwRKiAGYx', name: 'Kamino Lending' },
    { address: '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc', name: 'Kamino Finance' },
    // Meteora
    { address: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', name: 'Meteora DLMM' },
    { address: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB', name: 'Meteora Pools' },
];

export const KNOWN_DELEGATE_ADDRESSES = new Set(
    KNOWN_DELEGATES.map((d) => d.address)
);

export const KNOWN_DELEGATES_MAP = new Map(
    KNOWN_DELEGATES.map((d) => [d.address, d.name])
);

/**
 * Looks up a known delegate by address.
 * Returns the protocol name if found, null otherwise.
 */
export function getKnownDelegateName(address: string): string | null {
    return KNOWN_DELEGATES_MAP.get(address) || null;
}

// ─── External Links ─────────────────────────────────────────────
export const SOLSCAN_BASE_URL = 'https://solscan.io';
export const SOLSCAN_TX_URL = (signature: string): string =>
    `${SOLSCAN_BASE_URL}/tx/${signature}`;
export const SOLSCAN_ACCOUNT_URL = (address: string): string =>
    `${SOLSCAN_BASE_URL}/account/${address}`;
export const SOLSCAN_TOKEN_URL = (mint: string): string =>
    `${SOLSCAN_BASE_URL}/token/${mint}`;

// ─── ENGINE 2: RENT RECLAIMER FEES ───────────────────────

// Service fee: percentage of reclaimed SOL kept by the app
// Example: user reclaims 0.2 SOL, app keeps 30% = 0.06 SOL
export const RENT_RECLAIM_FEE_PERCENT = 30;

// Minimum accounts required to offer reclaim
// (Not worth the UX for 1-2 accounts)
export const RENT_RECLAIM_MIN_ACCOUNTS = 3;

// Solana standard token account rent (lamports)
// This is the actual on-chain minimum — verified via getMinimumBalanceForRentExemption
export const TOKEN_ACCOUNT_RENT_LAMPORTS = 2039280;

// Max accounts to close per transaction (conservative Solana tx size limit)
export const MAX_CLOSE_PER_TX = 15;

// ─── ENGINE 3: DUST CONSOLIDATOR ───────────────────────

// Service fee: percentage of SOL output from successful dust swaps
export const DUST_SWAP_FEE_PERCENT = 15;

// Service fee for burn+close rent reclaim path
export const DUST_BURN_RECLAIM_FEE_PERCENT = 15;

// "Dust" threshold in USD
export const DUST_MAX_VALUE_USD = 2;

// Hard cap for one swap session
export const DUST_MAX_TOKENS_PER_SESSION = 20;

// Keep swap output meaningful and avoid tiny dust routes
export const MIN_SWAP_OUTPUT_LAMPORTS = 10_000; // 0.00001 SOL

// Burn+close instruction pairs per transaction
export const DUST_MAX_BURN_CLOSE_PER_TX = 10;

// Safety: 1% slippage
export const DUST_SLIPPAGE_BPS = 100;

// SOL mint (wrapped SOL mint address used by routers)
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Jupiter Swap API (Metis)
export const JUPITER_API_KEY = (import.meta.env.VITE_JUP_API_KEY || '').trim();
export const JUPITER_API_BASE = 'https://api.jup.ag';
export const JUPITER_LITE_API_BASE = 'https://lite-api.jup.ag';
export const JUPITER_QUOTE_API = `${JUPITER_API_BASE}/swap/v1/quote`;
export const JUPITER_SWAP_API = `${JUPITER_API_BASE}/swap/v1/swap`;
export const JUPITER_LITE_QUOTE_API = `${JUPITER_LITE_API_BASE}/swap/v1/quote`;
export const JUPITER_LITE_SWAP_API = `${JUPITER_LITE_API_BASE}/swap/v1/swap`;

// Free API endpoints used by Engine 3
export const DEXSCREENER_TOKEN_PRICES_API = 'https://api.dexscreener.com/tokens/v1/solana';
export const RAYDIUM_QUOTE_API = 'https://transaction-v1.raydium.io/compute/swap-base-in';
export const RAYDIUM_SWAP_TX_API = 'https://transaction-v1.raydium.io/transaction/swap-base-in';
export const RAYDIUM_PRIORITY_FEE_API = 'https://api-v3.raydium.io/main/auto-fee';

// ─── ENGINE 4: STAKING TICKET FINDER ─────────────────────

// Service fee: 5% of redeemed SOL
export const TICKET_CLAIM_FEE_PERCENT = 5;

// Minimum SOL value to show a ticket in the UI
export const TICKET_MIN_VALUE_SOL = 0.01;

// Solana epoch duration in hours (approximate)
export const EPOCH_DURATION_HOURS = 54;

// Protocol program IDs
export const MARINADE_PROGRAM_ID = 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD';
export const MARINADE_STATE_ADDRESS = '8szGkuLTAux9XMgZ2vtY39jVSowEvaDA1v9YBYCrbVeA';
export const JITO_STAKE_POOL = 'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Poqu';
export const BLAZESTAKE_STAKE_POOL = 'stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov84HpwHA';

// Sanctum APIs
export const SANCTUM_TICKETS_API = 'https://sanctum-extra-api.ngrok.dev/v1/unstake-tickets';
export const SANCTUM_REDEEM_API = 'https://sanctum-extra-api.ngrok.dev/v1/redeem-ticket';

// Max u64 value — Solana uses this to indicate "not deactivating"
export const MAX_U64 = '18446744073709551615';

// Max claim instructions per transaction
export const MAX_CLAIMS_PER_TX = 5;

// Marinade claim instruction discriminator bytes from IDL
export const MARINADE_CLAIM_DISCRIMINATOR = new Uint8Array([62, 198, 214, 193, 213, 159, 108, 210]);

// Protocol display names and logos
export const PROTOCOL_INFO: Record<StakingProtocol, { displayName: string; logoUri: string | null }> = {
    marinade: { displayName: 'Marinade Finance', logoUri: '/logos/marinade.png' },
    sanctum: { displayName: 'Sanctum', logoUri: '/logos/sanctum.png' },
    jito: { displayName: 'Jito', logoUri: '/logos/jito.png' },
    blazestake: { displayName: 'BlazeStake', logoUri: '/logos/blazestake.png' },
    native_stake: { displayName: 'Native Stake', logoUri: null },
    unknown: { displayName: 'Unknown Protocol', logoUri: null },
};

// ─── ENGINE 7: MEV CLAIM CONSTANTS ────────────────────────────────────────

// Jito on-chain programs
export const TIP_DISTRIBUTION_PROGRAM_ID = '4R3gSG8BpU4t19KYj8CfnbtRpnT8gtk4dvTHxVRwc2r7';
export const TIP_PAYMENT_PROGRAM_ID = 'T1pyyaTNZsKv2WcRAB8oVnk93mLJw2XzjtVYqCsaHqt';

// Jito API
export const JITO_KOBE_API_BASE = 'https://kobe.mainnet.jito.network';
export const JITO_STAKER_REWARDS_ENDPOINT = '/api/v1/staker_rewards';

// Claim instruction discriminator
// sha256("global:claim")[0..8] — first 8 bytes
export const CLAIM_DISCRIMINATOR = new Uint8Array([62, 198, 214, 193, 213, 159, 108, 210]);

// Fees
export const MEV_SERVICE_FEE_PERCENT = 5;
export const MEV_SERVICE_FEE_DENOMINATOR = 100;

// Limits
export const MEV_MAX_CLAIMS_PER_TX = 4;   // Claims per transaction
export const MEV_API_PAGE_SIZE = 100;  // Items per API call

// Minimum claimable threshold
export const MEV_MIN_CLAIM_LAMPORTS = 5000; // 0.000005 SOL minimum

// Claim instruction seeds
export const CLAIM_STATUS_SEED = Buffer.from('claim_status');

// ─── Engine Metadata (UI) ───────────────────────────────────────
export interface EngineInfo {
    id: number;
    name: string;
    description: string;
    avgRecoverySOL: number;
    route: string;
    howItWorksRoute: string;
    status: 'live' | 'preview' | 'coming_soon';
}

export const ENGINE_METADATA: EngineInfo[] = [
    {
        id: 1,
        name: 'Revoke Permissions',
        description: 'Find & revoke risky token delegations before they drain your wallet.',
        avgRecoverySOL: 0.01,
        route: '/scan#engine-1',
        howItWorksRoute: '/how-it-works/engine/1',
        status: 'live',
    },
    {
        id: 9,
        name: 'Dead Protocol Rescue',
        description: 'Recover positions from dead DeFi protocols before they\'re gone',
        avgRecoverySOL: 1.5,
        route: '/decommission',
        howItWorksRoute: '/how-it-works/engine/9',
        status: 'live',
    },
    {
        id: 3,
        name: 'Sweep Dust',
        description: 'Swap worthless dust tokens to SOL or burn & reclaim their accounts.',
        avgRecoverySOL: 0.08,
        route: '/scan#engine-3',
        howItWorksRoute: '/how-it-works/engine/3',
        status: 'live',
    },
    {
        id: 2,
        name: 'Reclaim Rent',
        description: 'Close empty token accounts and reclaim locked-up rent SOL.',
        avgRecoverySOL: 0.15,
        route: '/scan#engine-2',
        howItWorksRoute: '/how-it-works/engine/2',
        status: 'live',
    },
    {
        id: 5,
        name: 'Harvest LP Fees',
        description: 'Collect unclaimed LP fees from Orca, Raydium, and Meteora positions.',
        avgRecoverySOL: 1.2,
        route: '/lp-fees',
        howItWorksRoute: '/how-it-works/engine/5',
        status: 'live',
    },
    {
        id: 4,
        name: 'Claim Stakes',
        description: 'Discover & claim expired staking tickets from Marinade, Sanctum, Jito, and more.',
        avgRecoverySOL: 2.5,
        route: '/tickets',
        howItWorksRoute: '/how-it-works/engine/4',
        status: 'live',
    },
    {
        id: 7,
        name: 'MEV & Priority Fees',
        description: 'Aggregate and claim your Jito MEV tips and routing priority fees instantly.',
        avgRecoverySOL: 0.25,
        route: '/tickets',
        howItWorksRoute: '/how-it-works/engine/7',
        status: 'live',
    },
    {
        id: 10,
        name: 'Recover Program Buffers',
        description: 'Close abandoned BPF Loader buffer accounts. Devs and AI agent pipelines commonly leave 1–50 SOL locked in failed deployments.',
        avgRecoverySOL: 3.0,
        route: '/buffers',
        howItWorksRoute: '/how-it-works/engine/10',
        status: 'preview',
    },
];

// ─── Platform Stats (trust signals) ─────────────────────────────
// These are reasonable estimates. Replace with Firestore-backed real stats.
export const PLATFORM_STATS = {
    totalRecoveredSOL: 12_847,
    walletsScanned: 4_213,
    totalTransactions: 31_409,
    avgRecoverySOL: 3.05,
};
