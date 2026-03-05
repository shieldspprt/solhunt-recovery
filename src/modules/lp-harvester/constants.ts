import type { LPProtocol } from './types';

// ─── PROGRAM IDS ──────────────────────────────────────────
export const ORCA_WHIRLPOOL_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
export const RAYDIUM_CLMM_PROGRAM_ID = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
export const RAYDIUM_AMM_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
export const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

// ─── FEE STRUCTURE ────────────────────────────────────────
export const HARVEST_FEE_PERCENT = 8;
export const HARVEST_COMPOUND_FEE_PERCENT = 10;
export const MIN_HARVEST_VALUE_USD = 0.5;
export const MIN_DISPLAY_VALUE_USD = 0.01;
export const MAX_HARVEST_PER_TX = 3;

// ─── DISPLAY / UX ─────────────────────────────────────────
export const RECOMMENDED_HARVEST_DAYS = 7;
export const LARGE_HARVEST_WARNING_USD = 500;
export const MAX_SCAN_RETRY = 1;

// ─── APIS ─────────────────────────────────────────────────
export const JUPITER_PRICE_API = 'https://price.jup.ag/v2/price';
export const RAYDIUM_LIQUIDITY_LIST_API = 'https://api.raydium.io/v2/sdk/liquidity/mainnet.json';
export const METEORA_POSITION_API = 'https://dlmm-api.meteora.ag/position';
export const DEXSCREENER_SOLANA_TOKENS_API = 'https://api.dexscreener.com/tokens/v1/solana';

export const LP_PROTOCOL_INFO: Record<LPProtocol, { displayName: string; color: string; logoUri: string | null }> = {
    orca: { displayName: 'Orca', color: '#00C9A7', logoUri: '/logos/orca.png' },
    raydium_clmm: { displayName: 'Raydium', color: '#C200FB', logoUri: '/logos/raydium.png' },
    raydium_amm: { displayName: 'Raydium', color: '#C200FB', logoUri: '/logos/raydium.png' },
    meteora: { displayName: 'Meteora', color: '#00A3FF', logoUri: '/logos/meteora.png' },
};

export const STABLE_MINTS = new Set([
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX', // USDH
]);

export const LP_ERROR_MESSAGES = {
    LP_SCAN_FAILED: 'Could not scan LP positions. Please try again.',
    ORCA_SCAN_FAILED: 'Orca positions could not be loaded. Other DEXes were still scanned.',
    RAYDIUM_SCAN_FAILED: 'Raydium positions could not be loaded.',
    METEORA_SCAN_FAILED: 'Meteora positions could not be loaded.',
    LP_HARVEST_FAILED: 'Harvest failed. Your positions were not affected.',
    LP_HARVEST_PARTIAL: 'Some positions were harvested. Check details below.',
    LP_COMPOUND_FAILED: 'Fees were harvested but compounding failed. Your fees are in your wallet.',
    LP_POSITION_CHANGED: 'Position changed since last scan. Please re-scan before harvesting.',
    LP_OUT_OF_RANGE: 'This position is out of range and cannot be compounded.',
} as const;
