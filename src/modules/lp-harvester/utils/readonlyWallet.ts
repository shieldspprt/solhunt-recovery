import type { PublicKey } from '@solana/web3.js';

/**
 * Creates a read-only wallet adapter for use with read-only SDK operations.
 * The wallet cannot sign transactions — use only with SDK methods that only read data.
 */
export function createReadonlyWallet(walletPublicKey: PublicKey) {
    return {
        publicKey: walletPublicKey,
        signTransaction: async () => {
            throw new Error('Read-only wallet cannot sign transactions.');
        },
        signAllTransactions: async () => {
            throw new Error('Read-only wallet cannot sign transactions.');
        },
    };
}

/**
 * Converts a value with a toBase58 method to a base-58 string.
 * Returns empty string if the value is not a valid object with that method.
 */
export function toBase58(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'toBase58' in value) {
        const fn = (value as { toBase58: () => unknown }).toBase58;
        if (typeof fn === 'function') {
            try {
                return fn.call(value) as string;
            } catch {
                return '';
            }
        }
    }
    return '';
}

/**
 * Converts a raw token amount string to its UI representation using decimal count.
 */
export function toUiAmount(rawAmount: string, decimals: number): number {
    const raw = Number(rawAmount);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw / 10 ** decimals;
}
