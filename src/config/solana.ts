import { Connection, ConnectionConfig } from '@solana/web3.js';

/**
 * RPC connection configuration.
 * Both endpoints must come from environment variables; no public fallback URLs
 * are baked into the bundle.
 */
function getRpcUrl(envKey: 'VITE_HELIUS_RPC_URL' | 'VITE_SOLANA_FALLBACK_RPC'): string {
    const value = import.meta.env[envKey];
    return typeof value === 'string' ? value.trim() : '';
}

const PRIMARY_RPC_URL = getRpcUrl('VITE_HELIUS_RPC_URL');
const FALLBACK_RPC_URL = getRpcUrl('VITE_SOLANA_FALLBACK_RPC');

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
 * Fallback RPC connection (configured provider only).
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
