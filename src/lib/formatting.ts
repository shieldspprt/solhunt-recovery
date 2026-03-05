/**
 * Shortens a Solana address for display: "AbCd...WxYz"
 */
export function shortenAddress(address: string, chars = 4): string {
    if (!address) return '';
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Formats a SOL amount to a user-friendly string with appropriate decimal places.
 */
export function formatSOL(lamports: number): string {
    const sol = lamports / 1e9;
    if (sol === 0) return '0 SOL';
    if (sol < 0.001) return `${sol.toFixed(6)} SOL`;
    if (sol < 1) return `${sol.toFixed(4)} SOL`;
    return `${sol.toFixed(2)} SOL`;
}

/**
 * Formats SOL from a SOL value (not lamports).
 */
export function formatSOLValue(sol: number): string {
    if (sol === 0) return '0 SOL';
    if (sol < 0.001) return `${sol.toFixed(6)} SOL`;
    if (sol < 1) return `${sol.toFixed(4)} SOL`;
    return `${sol.toFixed(2)} SOL`;
}

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
 */
export function formatBalance(balance: number): string {
    if (balance === 0) return '0';
    if (balance < 0.001) return '< 0.001';
    if (balance < 1) return balance.toFixed(4);
    if (balance < 1000) return balance.toFixed(2);
    if (balance < 1_000_000) return `${(balance / 1000).toFixed(1)}K`;
    return `${(balance / 1_000_000).toFixed(1)}M`;
}

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
 * Formats a value as USD currency.
 */
export function formatCurrency(value: number): string {
    if (value === 0) return '$0.00';
    if (value < 0.01) return '< $0.01';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
}

/**
 * Legacy wrapper for estimateUSD.
 */
export function estimateUSD(solAmount: number, solPriceUSD = 150): string {
    return `~${formatCurrency(solAmount * solPriceUSD)}`;
}

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
