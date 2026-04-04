/**
 * Formatting utilities with performance optimizations.
 * 
 * Frequently-used functions (formatBalance, formatSOLValue) use a small
 * LRU cache to avoid recomputing the same formatted values in lists.
 */

// ─── Memoization Cache ───────────────────────────────────────────────────────

/** Simple LRU cache for memoizing formatting results */
class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }
}

// Caches for frequently-formatted values (cleared on page reload)
const balanceCache = new LRUCache<string, string>(100);
const solValueCache = new LRUCache<string, string>(100);

// ─── Type Guards ─────────────────────────────────────────────────────────────

/**
 * Returns true if value is a finite, non-NaN number.
 */
function isValidNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

// ─── Address Formatting ──────────────────────────────────────────────────────

/**
 * Shortens a Solana address for display: "AbCd...WxYz"
 */
export function shortenAddress(address: string, chars = 4): string {
    if (!address) return '';
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// ─── SOL Formatting ──────────────────────────────────────────────────────────

/**
 * Formats a SOL amount (not lamports) to a user-friendly string.
 * Use for displaying SOL values returned from APIs or user input.
 * For lamports, divide by 1e9 first.
 * 
 * Results are memoized for performance in large lists.
 */
export function formatSOL(sol: number): string {
    if (!isValidNumber(sol)) return '0 SOL';
    
    const cacheKey = `sol:${sol}`;
    const cached = solValueCache.get(cacheKey);
    if (cached) return cached;
    
    let result: string;
    if (sol === 0) result = '0 SOL';
    else if (sol < 0.001) result = `${sol.toFixed(6)} SOL`;
    else if (sol < 1) result = `${sol.toFixed(4)} SOL`;
    else result = `${sol.toFixed(2)} SOL`;
    
    solValueCache.set(cacheKey, result);
    return result;
}

/**
 * Formats SOL from a SOL value (not lamports).
 * Memoized for performance in lists.
 */
export function formatSOLValue(sol: number): string {
    return formatSOL(sol); // Delegates to cached version
}

// ─── Token/Balance Formatting ────────────────────────────────────────────────

/**
 * Formats a token amount with its decimals to a user-friendly string.
 */
export function formatTokenAmount(rawAmount: string, decimals: number): string {
    const amount = parseFloat(rawAmount) / Math.pow(10, decimals);
    if (amount === 0) return '0';
    if (amount < 0.001) return '< 0.001';
    if (amount < 1) return amount.toFixed(4);
    if (amount < 1000) return amount.toFixed(2);
    if (amount < 1_000_000) return `${(amount / 1000).toFixed(1)}K`;
    return `${(amount / 1_000_000).toFixed(1)}M`;
}

/**
 * Formats a human-readable token balance (already adjusted for decimals).
 * Memoized for performance in large token lists.
 */
export function formatBalance(balance: number): string {
    if (!isValidNumber(balance)) return '0';
    if (balance === 0) return '0';
    
    const cacheKey = `bal:${balance}`;
    const cached = balanceCache.get(cacheKey);
    if (cached) return cached;
    
    let result: string;
    if (balance < 0.001) result = '< 0.001';
    else if (balance < 1) result = balance.toFixed(4);
    else if (balance < 1000) result = balance.toFixed(2);
    else if (balance < 1_000_000) result = `${(balance / 1000).toFixed(1)}K`;
    else result = `${(balance / 1_000_000).toFixed(1)}M`;
    
    balanceCache.set(cacheKey, result);
    return result;
}

// ─── Number/USD Formatting ───────────────────────────────────────────────────

/**
 * Formats a number with specified decimals.
 */
export function formatNumber(value: number, decimals = 2): string {
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    });
}

/**
 * Formats a value as USD currency using the user's browser locale.
 */
export function formatUSD(value: number): string {
    if (value === 0) return '$0.00';
    if (value < 0.01) return '< $0.01';
    return new Intl.NumberFormat(navigator.language ?? 'en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
}

/**
 * Alias for formatUSD — kept for backward compatibility.
 */
export const formatCurrency = formatUSD;

/**
 * Formats SOL amount as USD estimate using an optional SOL price.
 * Defaults to $150/SOL when no price is provided.
 */
export function estimateUSD(solAmount: number, solPriceUSD = 150): string {
    return `~${formatUSD(solAmount * solPriceUSD)}`;
}

// ─── Time/Utility Formatting ─────────────────────────────────────────────────

/**
 * Formats a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
}

/**
 * Copies text to clipboard and returns success status.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
