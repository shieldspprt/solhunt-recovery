import { Connection, ConnectionConfig } from '@solana/web3.js';

/**
 * RPC connection configuration.
 * Primary: Helius (from env var)
 * Fallback: Public mainnet-beta (rate-limited)
 */
const PRIMARY_RPC_URL =
    import.meta.env.VITE_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const FALLBACK_RPC_URL =
    import.meta.env.VITE_SOLANA_FALLBACK_RPC || 'https://api.mainnet-beta.solana.com';

const CONNECTION_CONFIG: ConnectionConfig = {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30_000,
};

/**
 * Primary RPC connection (Helius or configured provider).
 */
export const primaryConnection = new Connection(
    PRIMARY_RPC_URL,
    CONNECTION_CONFIG
);

/**
 * Fallback RPC connection (public mainnet-beta).
 * Used when the primary connection fails.
 */
export const fallbackConnection = new Connection(
    FALLBACK_RPC_URL,
    CONNECTION_CONFIG
);

/**
 * Returns the primary connection. If a request to primary fails,
 * consumers should catch the error and retry with getBackupConnection().
 */
export function getConnection(): Connection {
    return primaryConnection;
}

/**
 * Returns the fallback connection for retry scenarios.
 */
export function getBackupConnection(): Connection {
    return fallbackConnection;
}

/**
 * Network configuration
 */
export const NETWORK = 'mainnet-beta' as const;
