import { PublicKey } from '@solana/web3.js';

/**
 * Validates whether a string is a valid Solana public key for a keypair-based address
 * (wallet, token account, stake account, vote account).
 *
 * Uses PublicKey.isOnCurve() to verify the 32-byte value is a valid ed25519 curve point.
 * This correctly rejects program IDs (which are not ed25519 points) since those
 * are checked via a separate mechanism in the transaction verifier allowlist.
 *
 * For input fields where users paste wallet addresses, this is the right check.
 * Do NOT use this to validate program IDs — use bs58 decoding + length check instead.
 */
export function isValidSolanaPublicKey(address: string): boolean {
    try {
        const key = new PublicKey(address);
        return PublicKey.isOnCurve(key.toBytes());
    } catch {
        return false;
    }
}

/**
 * Validates whether a string is a structurally valid Solana address.
 * Unlike isValidSolanaPublicKey, this does NOT check the ed25519 curve —
 * it only verifies the string is valid base58-encoded 32 bytes.
 *
 * Use this when you need to accept program IDs or any 32-byte Solana Pubkey.
 * For wallet/token address input validation, prefer isValidSolanaPublicKey
 * since it additionally confirms the key is a valid ed25519 point.
 */
export function isValidSolanaAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const trimmed = address.trim();
    // Valid Solana addresses are 32–44 base58 characters
    if (trimmed.length < 32 || trimmed.length > 44) return false;
    try {
        const key = new PublicKey(trimmed);
        return key.toBytes().length === 32;
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

    if (trimmed.length < 32 || trimmed.length > 44) {
        throw new Error(`Address must be 32–44 base58 characters, got ${trimmed.length}`);
    }

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
