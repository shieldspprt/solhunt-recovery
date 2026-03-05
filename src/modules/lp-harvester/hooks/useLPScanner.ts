import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LP_ERROR_MESSAGES } from '../constants';
import { scanAllLPPositions } from '../lib/scanners';
import { useLPStore } from './useLPStore';
import {
    logLPScanComplete,
    logLPScanStarted,
} from '@/lib/analytics';

export function useLPScanner() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();

    const scanStatus = useLPStore((state) => state.scanStatus);
    const scanResult = useLPStore((state) => state.scanResult);
    const scanError = useLPStore((state) => state.scanError);

    const setScanStatus = useLPStore((state) => state.setScanStatus);
    const setScanResult = useLPStore((state) => state.setScanResult);
    const setScanError = useLPStore((state) => state.setScanError);

    const runScan = useCallback(async () => {
        if (!publicKey) return;

        setScanStatus('scanning');
        setScanError(null);
        logLPScanStarted();

        try {
            const result = await scanAllLPPositions(
                publicKey.toBase58(),
                connection
            );
            setScanResult(result);
            setScanStatus('scan_complete');

            const breakdown = result.protocolBreakdown.reduce(
                (acc, item) => {
                    if (item.protocol === 'orca') {
                        acc.orca += item.feeValueUSD;
                    } else if (item.protocol === 'meteora') {
                        acc.meteora += item.feeValueUSD;
                    } else {
                        acc.raydium += item.feeValueUSD;
                    }
                    return acc;
                },
                { orca: 0, raydium: 0, meteora: 0 }
            );

            logLPScanComplete({
                positionCount: result.totalPositions,
                positionsWithFees: result.positionsWithFees,
                totalFeeValueUSD: result.totalFeeValueUSD,
                protocolBreakdown: breakdown,
                protocolsWithErrors: result.protocolsWithErrors.length,
            });
        } catch {
            setScanStatus('error');
            setScanError(LP_ERROR_MESSAGES.LP_SCAN_FAILED);
        }
    }, [
        connection,
        publicKey,
        setScanError,
        setScanResult,
        setScanStatus,
    ]);

    return {
        scanStatus,
        scanResult,
        scanError,
        runScan,
    };
}
