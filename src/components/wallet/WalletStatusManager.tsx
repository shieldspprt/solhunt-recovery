/**
 * WalletStatusManager - Reliable wallet connection/disconnect handling
 * 
 * Solana dApp Store Compliance: Wallet connect and disconnect must work reliably
 * - Handles connection errors gracefully
 * - Provides retry logic for failed disconnects
 * - Clears all app state on disconnect
 * - Shows user-friendly error messages
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/hooks/useAppStore';

interface WalletError {
    message: string;
    code?: string;
}

export function WalletStatusManager() {
    const { connected, disconnecting, publicKey } = useWallet();
    const previousConnected = useRef(connected);

    // Handle connection state changes
    useEffect(() => {
        // Clear any previous errors on successful connection
        if (connected && publicKey) {
            previousConnected.current = true;
        }

        // Detect unexpected disconnections (not user-initiated)
        if (!connected && previousConnected.current && !disconnecting) {
            // Wallet disconnected unexpectedly - could be extension error
            console.warn('[WalletStatusManager] Unexpected wallet disconnection detected');
        }

        previousConnected.current = connected;
    }, [connected, publicKey, disconnecting]);

    return null;
}

const DISCONNECT_RETRY_ATTEMPTS = 3;
const DISCONNECT_RETRY_DELAY_MS = 500;

interface UseReliableDisconnectReturn {
    disconnect: () => Promise<void>;
    isDisconnecting: boolean;
    error: WalletError | null;
}

export function useReliableDisconnect(): UseReliableDisconnectReturn {
    const { disconnect: rawDisconnect, disconnecting } = useWallet();
    const resetAll = useAppStore((s) => s.resetAll);
    const [error, setError] = useState<WalletError | null>(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const disconnect = useCallback(async () => {
        setError(null);
        setIsDisconnecting(true);

        let lastError: Error | null = null;

        // Retry logic for disconnect
        for (let attempt = 1; attempt <= DISCONNECT_RETRY_ATTEMPTS; attempt++) {
            try {
                // Clear all app state first (idempotent)
                resetAll();
                
                // Attempt wallet disconnect
                await rawDisconnect();
                
                // Show success toast
                toast.success('Wallet disconnected');
                setIsDisconnecting(false);
                return;
            } catch (err: unknown) {
                lastError = err instanceof Error ? err : new Error(String(err));
                console.warn(`[WalletStatusManager] Disconnect attempt ${attempt} failed:`, lastError.message);

                // Wait before retry (exponential backoff)
                if (attempt < DISCONNECT_RETRY_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, DISCONNECT_RETRY_DELAY_MS * attempt));
                }
            }
        }

        // All retries failed
        const walletError: WalletError = {
            code: 'DISCONNECT_FAILED',
            message: lastError?.message || 'Failed to disconnect wallet after multiple attempts',
        };
        setError(walletError);
        setIsDisconnecting(false);
        
        // Show error toast but still clear app state
        toast.error('Wallet disconnect failed. Please refresh the page if issues persist.');
        
        // Force reset app state even if wallet disconnect failed
        resetAll();
    }, [rawDisconnect, resetAll]);

    return {
        disconnect,
        isDisconnecting: isDisconnecting || disconnecting,
        error,
    };
}
