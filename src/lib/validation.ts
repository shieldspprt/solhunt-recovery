import { PublicKey } from '@solana/web3.js';

/**
 * Validates whether a string is a valid Solana public key (base58 encoded, 32 bytes).
 */
export function isValidSolanaPublicKey(address: string): boolean {
    try {
        const key = new PublicKey(address);
        // Ensure it's on the ed25519 curve (valid base58 + correct length)
        return PublicKey.isOnCurve(key.toBytes());
    } catch {
        return false;
    }
}

/**
 * Validates and returns a PublicKey, or throws a user-friendly error.
 */
export function toValidPublicKey(address: string): PublicKey {
    if (!address || typeof address !== 'string') {
        throw new Error('Address must be a non-empty string');
    }

    const trimmed = address.trim();

    try {
        return new PublicKey(trimmed);
    } catch {
        throw new Error(`Invalid Solana address: ${trimmed.substring(0, 10)}...`);
    }
}

/**
 * Validates that a number is a positive finite value.
 */
export function isValidAmount(amount: number): boolean {
    return Number.isFinite(amount) && amount >= 0;
}

/**
 * Validates that a string can be parsed as a valid non-negative number.
 */
export function isValidAmountString(amount: string): boolean {
    const parsed = parseFloat(amount);
    return !isNaN(parsed) && parsed >= 0;
}
