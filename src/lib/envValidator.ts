/**
 * Environment variable validation.
 *
 * Runs at app startup to ensure all required environment variables
 * are present and valid. Fails visibly rather than silently.
 *
 * Audit Spec §2.1 (env var safety) and §2.7 (treasury validation).
 */
import { PublicKey, SystemProgram } from '@solana/web3.js';

export interface EnvValidationResult {
    valid: boolean;
    errors: string[];
    treasuryPubkey: PublicKey | null;
}

/**
 * Validates all required environment variables at startup.
 * Returns errors instead of throwing so the app can display them.
 */
export function validateEnvironment(): EnvValidationResult {
    const errors: string[] = [];
    let treasuryPubkey: PublicKey | null = null;

    // VITE_HELIUS_RPC_URL — required for DAS API and primary RPC
    const rpcUrl = import.meta.env.VITE_HELIUS_RPC_URL;
    if (!rpcUrl || typeof rpcUrl !== 'string' || rpcUrl.trim().length === 0) {
        errors.push('VITE_HELIUS_RPC_URL is not configured. The app requires a Helius RPC endpoint.');
    }

    // VITE_TREASURY_WALLET — required for service fees
    const treasuryAddress = import.meta.env.VITE_TREASURY_WALLET;
    if (!treasuryAddress || typeof treasuryAddress !== 'string' || treasuryAddress.trim().length === 0) {
        errors.push('VITE_TREASURY_WALLET is not configured. Cannot process service fees.');
    } else {
        try {
            treasuryPubkey = new PublicKey(treasuryAddress.trim());

            // Verify it's not the system program or other known-bad addresses
            if (treasuryPubkey.equals(SystemProgram.programId)) {
                errors.push('VITE_TREASURY_WALLET cannot be the system program address.');
                treasuryPubkey = null;
            }

            // Verify it's not the null key (all zeros)
            if (treasuryPubkey && treasuryPubkey.equals(PublicKey.default)) {
                errors.push('VITE_TREASURY_WALLET cannot be the default/null public key.');
                treasuryPubkey = null;
            }
        } catch {
            errors.push(`VITE_TREASURY_WALLET is not a valid Solana public key: ${treasuryAddress.substring(0, 10)}...`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        treasuryPubkey,
    };
}
