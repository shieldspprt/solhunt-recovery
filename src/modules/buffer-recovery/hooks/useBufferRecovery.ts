import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { useAppStore } from '@/hooks/useAppStore';
import { scanForBuffers } from '../lib/bufferScanner';
import { createCloseBufferInstructions } from '../lib/bufferCloser';
import { verifyTransactionSecurity } from '@/lib/transactionVerifier';
import { confirmTransactionRobust } from '@/lib/withTimeout';
import { createAppError } from '@/lib/errors';
import {
    logBufferScanComplete,
    logBufferCloseInitiated,
    logBufferCloseComplete
} from '@/lib/analytics';
import { RECENT_BUFFER_THRESHOLD_MS } from '../constants';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';

export function useBufferRecovery() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const {
        agentWallet,
        bufferScanStatus,
        bufferScanResult,
        bufferScanError,
        selectedBufferAddresses,
        bufferCloseStatus,
        setBufferScanStatus,
        setBufferScanResult,
        setBufferScanError,
        toggleBufferSelection,
        selectAllBuffers,
        deselectAllBuffers,
        setBufferCloseStatus,
        setBufferCloseResult,
        setBufferCloseError,
        clearBuffers
    } = useAppStore();

    const targetWallet = publicKey?.toBase58() || agentWallet;

    const runScan = useCallback(async () => {
        if (!targetWallet) return;

        try {
            setBufferScanStatus('scanning');
            const buffers = await scanForBuffers(targetWallet);

            const closeable = buffers.filter(b => b.status === 'closeable');
            const totalLocked = buffers.reduce((acc, b) => acc + b.lamports, 0);
            const totalRecoverable = closeable.reduce((acc, b) => acc + b.recoverableSOL, 0);

            const result = {
                scannedAt: Date.now(),
                buffers,
                closeableBuffers: closeable,
                totalLockedSOL: totalLocked / 1e9,
                totalRecoverableSOL: totalRecoverable
            };

            setBufferScanResult(result);
            logBufferScanComplete({
                totalBuffers: buffers.length,
                closeableCount: closeable.length,
                totalLockedSOL: result.totalLockedSOL,
                hasRecentBuffers: buffers.some(b => Date.now() - b.createdAt < RECENT_BUFFER_THRESHOLD_MS)
            });
        } catch (error: unknown) {
            // logger.error (not logger.warn) so the failure reaches Firebase
            // Analytics as an `app_error` event in production. logger.warn is
            // dev-only — production users' buffer-scan failures were silently
            // invisible until users reported them manually. The error code
            // (BUFFER_SCAN_FAILED) matches what createAppError below uses, so
            // a single string in the Firebase dashboard groups scan-side
            // crashes by root cause.
            logger.error('BUFFER_SCAN_FAILED', error);
            const technicalDetail = error instanceof Error ? error.toString() : String(error);
            setBufferScanError(createAppError('BUFFER_SCAN_FAILED', technicalDetail));
        }
    }, [targetWallet, setBufferScanStatus, setBufferScanResult, setBufferScanError]);

    const performClose = useCallback(async () => {
        if (!publicKey || selectedBufferAddresses.length === 0 || !bufferScanResult) return;

        try {
            setBufferCloseStatus('closing');

            const selectedBuffers = bufferScanResult.closeableBuffers.filter(b =>
                selectedBufferAddresses.includes(b.address)
            );
            const totalSOL = selectedBuffers.reduce((acc, b) => acc + b.recoverableSOL, 0);
            const serviceFee = selectedBuffers.reduce((acc, b) => acc + (b.lamports / 1e9 - b.recoverableSOL), 0);

            logBufferCloseInitiated({
                selectedCount: selectedBufferAddresses.length,
                totalSOL,
                serviceFeeSOL: serviceFee,
                hadRecentBufferWarning: selectedBuffers.some(b => Date.now() - b.createdAt < RECENT_BUFFER_THRESHOLD_MS)
            });

            const instructions = createCloseBufferInstructions(
                publicKey.toBase58(),
                selectedBuffers.map(b => ({ address: b.address, lamports: b.lamports })),
                selectedBuffers.reduce((acc, b) => acc + b.lamports, 0)
            );

            const transaction = new Transaction().add(...instructions);
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            verifyTransactionSecurity(transaction, publicKey);

            const signature = await sendTransaction(transaction, connection);
            await confirmTransactionRobust(connection, signature, 'confirmed');

            const result = {
                success: true,
                closedCount: selectedBufferAddresses.length,
                failedCount: 0,
                reclaimedSOL: totalSOL,
                signatures: [signature],
                errorMessage: null
            };

            setBufferCloseResult(result);
            logBufferCloseComplete(result);
            toast.success(`Successfully reclaimed ${totalSOL.toFixed(3)} SOL!`);

            await runScan();
        } catch (error: unknown) {
            // logger.error (not logger.warn) so the close-time failure reaches
            // Firebase Analytics in production. Buffer-close runs after the
            // user has signed and the transaction is on-chain — silent failure
            // here would leave the user's wallet debited but the recovery
            // result store showing no error, which is the exact "did my SOL
            // get reclaimed?" support incident the prior warn-only logging
            // caused. Error code matches createAppError below for dashboard
            // consistency with the scan path.
            logger.error('BUFFER_CLOSE_FAILED', error);
            const technicalDetail = error instanceof Error ? error.toString() : String(error);
            setBufferCloseError(createAppError('BUFFER_CLOSE_FAILED', technicalDetail));
            logBufferCloseComplete({
                success: false,
                closedCount: 0,
                failedCount: selectedBufferAddresses.length,
                reclaimedSOL: 0
            });
            toast.error('Transaction failed. Check console for details.');
        }
    }, [publicKey, connection, selectedBufferAddresses, bufferScanResult, sendTransaction, setBufferCloseStatus, setBufferCloseResult, setBufferCloseError, runScan]);

    const isScanning = bufferScanStatus === 'scanning';
    const isClosing = bufferCloseStatus === 'closing';

    return {
        isScanning,
        isClosing,
        bufferScanResult,
        bufferScanError,
        selectedBufferAddresses,
        bufferCloseStatus,
        runScan,
        performClose,
        toggleBufferSelection,
        selectAllBuffers,
        deselectAllBuffers,
        clearBuffers
    };
}
