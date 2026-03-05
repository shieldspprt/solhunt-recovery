import { useCallback, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAppStore } from '@/hooks/useAppStore';
import { scanWalletForDelegations } from '@/lib/scanner';
import { logScanStarted, logScanComplete, logScanError } from '@/lib/analytics';
import { SCAN_COOLDOWN_MS, ERROR_CODES, ERROR_MESSAGES } from '@/config/constants';
import type { AppError } from '@/types';

/**
 * Hook that wraps the scanner logic with wallet adapter integration,
 * rate limiting, and state management.
 */
export function useWalletScanner() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const lastScanTimeRef = useRef<number>(0);

    const {
        scanStatus,
        scanResult,
        scanError,
        setScanStatus,
        setScanResult,
        setScanError,
        clearScan,
    } = useAppStore();

    const scan = useCallback(async () => {
        // Check wallet connection
        if (!publicKey) {
            setScanError({
                code: ERROR_CODES.WALLET_NOT_CONNECTED,
                message: ERROR_MESSAGES.WALLET_NOT_CONNECTED,
                technicalDetail: 'publicKey is null',
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
                code: 'RATE_LIMITED',
                message: `Please wait ${remainingSeconds} seconds before scanning again.`,
                technicalDetail: `Rate limited: ${timeSinceLastScan}ms since last scan`,
            });
            return;
        }

        try {
            setScanStatus('scanning');
            logScanStarted();

            const result = await scanWalletForDelegations(
                publicKey.toBase58(),
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
            const appError: AppError =
                error && typeof error === 'object' && 'code' in error
                    ? (error as AppError)
                    : {
                        code: ERROR_CODES.UNKNOWN,
                        message: ERROR_MESSAGES.UNKNOWN,
                        technicalDetail:
                            error instanceof Error ? error.message : String(error),
                    };

            setScanError(appError);
            logScanError(appError.code);
        }
    }, [publicKey, connection, setScanStatus, setScanResult, setScanError]);

    const isOnCooldown = useCallback(() => {
        return Date.now() - lastScanTimeRef.current < SCAN_COOLDOWN_MS;
    }, []);

    return {
        scan,
        scanStatus,
        scanResult,
        scanError,
        clearScan,
        isOnCooldown,
        isScanning: scanStatus === 'scanning',
        hasResults: scanStatus === 'scan_complete',
        hasError: scanStatus === 'error',
    };
}
