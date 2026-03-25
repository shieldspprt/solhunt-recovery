import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { useAppStore } from '@/hooks/useAppStore';
import { scanForBuffers } from '../lib/bufferScanner';
import { createCloseBufferInstructions } from '../lib/bufferCloser';
import { verifyTransactionSecurity } from '@/lib/transactionVerifier';
import { confirmTransactionRobust } from '@/lib/withTimeout';
import {
    logBufferScanComplete,
    logBufferCloseInitiated,
    logBufferCloseComplete
} from '@/lib/analytics';
import { RECENT_BUFFER_THRESHOLD_MS } from '../constants';
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
            const buffers = await scanForBuffers(targetWallet, connection);

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
        } catch (error: any) {
            console.error('Buffer scan failed:', error);
            setBufferScanError({
                code: 'BUFFER_SCAN_FAILED',
                message: error.message || 'Failed to scan for program buffers',
                technicalDetail: error.toString()
            });
        }
    }, [targetWallet, connection, setBufferScanStatus, setBufferScanResult, setBufferScanError]);

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
                selectedBufferAddresses,
                totalSOL + serviceFee
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
        } catch (error: any) {
            console.error('Buffer close failed:', error);
            const appError = {
                code: 'BUFFER_CLOSE_FAILED',
                message: error.message || 'Failed to close buffer accounts',
                technicalDetail: error.toString()
            };
            setBufferCloseError(appError);
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
