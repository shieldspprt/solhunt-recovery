import { useCallback, useRef, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAppStore } from '@/hooks/useAppStore';
import { scanWalletForDelegations } from '@/lib/scanner';
import { logScanStarted, logScanComplete, logScanError } from '@/lib/analytics';
import { SCAN_COOLDOWN_MS, ERROR_CODES, ERROR_MESSAGES } from '@/config/constants';
import { isAppError, toAppError } from '@/lib/errors';

/**
 * Hook that wraps the scanner logic with wallet adapter integration,
 * rate limiting, and state management.
 */
export function useWalletScanner() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const lastScanTimeRef = useRef<number>(0);

    const {
        agentWallet,
        scanStatus,
        scanResult,
        scanError,
        setScanStatus,
        setScanResult,
        setScanError,
        clearScan,
    } = useAppStore();

    const scan = useCallback(async () => {
        const targetWallet = publicKey?.toBase58() || agentWallet;

        // Check wallet connection
        if (!targetWallet) {
            setScanError({
                code: ERROR_CODES.WALLET_NOT_CONNECTED,
                message: ERROR_MESSAGES.WALLET_NOT_CONNECTED,
                technicalDetail: 'publicKey and agentWallet are both null',
            });
            return;
        }

        // Rate limiting: minimum 10 seconds between scans (Section 10.5)
        const now = Date.now();
        const timeSinceLastScan = now - lastScanTimeRef.current;
        if (timeSinceLastScan < SCAN_COOLDOWN_MS) {
            const remainingSeconds = Math.ceil(
                (SCAN_COOLDOWN_MS - timeSinceLastScan) / 1000
            );
            setScanError({
                code: ERROR_CODES.UNKNOWN,
                message: `Please wait ${remainingSeconds} seconds before scanning again.`,
                technicalDetail: `Rate limited: ${timeSinceLastScan}ms since last scan (cooldown: ${SCAN_COOLDOWN_MS}ms)`,
            });
            return;
        }

        try {
            setScanStatus('scanning');
            logScanStarted();

            const result = await scanWalletForDelegations(
                targetWallet,
                connection
            );

            setScanResult(result);
            lastScanTimeRef.current = Date.now();

            logScanComplete({
                totalAccounts: result.totalTokenAccounts,
                delegationsFound: result.delegations.length,
                highRiskCount: result.delegations.filter((d) => d.riskLevel === 'HIGH')
                    .length,
                scanDurationMs: result.scanDurationMs,
            });
        } catch (error) {
            // Use type guard for safer, cleaner error handling
            const appError = isAppError(error) 
                ? error 
                : toAppError(error, 'SCAN_FAILED');

            setScanError(appError);
            logScanError(appError.code);
        }
    }, [publicKey, agentWallet, connection, setScanStatus, setScanResult, setScanError]);

    // isOnCooldown is a simple function - no need for useCallback
    // since it only accesses the ref, not React state
    const isOnCooldown = () => {
        return Date.now() - lastScanTimeRef.current < SCAN_COOLDOWN_MS;
    };

    // Memoize derived boolean states to prevent unnecessary re-renders
    const isScanning = useMemo(() => scanStatus === 'scanning', [scanStatus]);
    const hasResults = useMemo(() => scanStatus === 'scan_complete', [scanStatus]);
    const hasError = useMemo(() => scanStatus === 'error', [scanStatus]);

    return {
        scan,
        scanStatus,
        scanResult,
        scanError,
        clearScan,
        isOnCooldown,
        isScanning,
        hasResults,
        hasError,
    };
}
