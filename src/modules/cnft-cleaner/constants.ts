import type { SpamSignal, CNFTCategory } from './types';

// ─── PROGRAM IDS ──────────────────────────────────────────
export const BUBBLEGUM_PROGRAM_ID = 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
export const SPL_NOOP_PROGRAM_ID = 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV';
export const SPL_COMPRESSION_PROGRAM = 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';

// ─── FEES ─────────────────────────────────────────────────
export const BURN_SESSION_FEE_SOL = 0.005;
export const BURN_SESSION_FEE_LAMPORTS = 5_000_000;
export const BURN_LAMPORT_FEE_PERCENT = 20;

// ─── SOL RECOVERY ─────────────────────────────────────────
/** Approximate rent recoverable per burned cNFT */
export const CNFT_RENT_RECOVERY_SOL = 0.00089;

// ─── SCAN LIMITS ──────────────────────────────────────────
export const DAS_PAGE_SIZE = 1000;
export const DAS_MAX_PAGES = 10;

// ─── BURN LIMITS ──────────────────────────────────────────
export const MAX_BURNS_PER_TX = 1;
export const MAX_BURNS_PER_SESSION = 500;

// ─── SPAM SCORING ─────────────────────────────────────────
export const SPAM_THRESHOLD = 70;
export const LOW_VALUE_THRESHOLD = 40;

export const SPAM_SIGNAL_WEIGHTS: Record<SpamSignal, number> = {
    unverified_collection: 20,
    no_metadata: 30,
    suspicious_name: 25,
    duplicate_image: 15,
    no_creators: 20,
    zero_royalty: 10,
    suspicious_uri: 30,
    known_spam_collection: 100,
};

// ─── SUSPICIOUS NAME PATTERNS ─────────────────────────────
export const SUSPICIOUS_NAME_PATTERNS = [
    'airdrop', 'free', 'claim', 'visit', 'http', 'www.',
    '.com', '.io', '.xyz', 'reward', 'bonus', 'winner',
    'congratulation', 'whitelist', 'mint now', 'limited',
];

// ─── KNOWN SPAM COLLECTIONS ───────────────────────────────
export const KNOWN_SPAM_COLLECTIONS = new Set<string>([
    // Add known spam collection mint addresses here
]);

// ─── IPFS GATEWAYS ────────────────────────────────────────
export const IPFS_GATEWAYS = [
    'https://nftstorage.link/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
];

// ─── CATEGORIES DISPLAY ───────────────────────────────────
export const CATEGORY_INFO: Record<CNFTCategory, {
    label: string;
    color: string;
    icon: string;
    autoSelect: boolean;
}> = {
    spam: { label: 'Spam', color: '#ef4444', icon: '🚫', autoSelect: true },
    low_value: { label: 'Low Value', color: '#f59e0b', icon: '⚠️', autoSelect: true },
    potentially_valuable: { label: 'Review Before Burning', color: '#6366f1', icon: '🔍', autoSelect: false },
    verified: { label: 'Verified (Burnable)', color: '#10b981', icon: '✅', autoSelect: false },
    unknown: { label: 'Unknown', color: '#6b7280', icon: '❓', autoSelect: false },
};

// ─── ERROR MESSAGES ───────────────────────────────────────
export const CNFT_ERROR_MESSAGES = {
    CNFT_SCAN_FAILED: 'Could not scan for NFTs. Check your connection and try again.',
    CNFT_PROOF_FAILED: 'Could not fetch burn proofs for some items. They have been skipped.',
    CNFT_BURN_FAILED: 'Burn transaction failed. Your NFTs were not affected.',
    CNFT_BURN_PARTIAL: 'Some NFTs were burned successfully. Check details below.',
    CNFT_STALE_PROOF: 'Proof expired during burn. Re-fetching and retrying...',
    CNFT_VERIFIED_BLOCKED: 'Verified collection items cannot be burned with this tool.',
    CNFT_TOO_MANY: 'Your wallet has too many NFTs to fully scan. Showing first 10,000.',
} as const;

