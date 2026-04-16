import { useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAppStore } from '@/hooks/useAppStore';
import { scanForStakingTickets } from '@/lib/ticketScanner';
import { claimAllTickets } from '@/lib/ticketClaimer';
import { useMEVClaims } from '@/hooks/useMEVClaims';
import {
    logTicketClaimComplete,
    logTicketClaimInitiated,
    logTicketScanComplete,
    logTicketScanStarted,
} from '@/lib/analytics';
import {
    NETWORK_FEE_PER_SIGNATURE_SOL,
    TICKET_CLAIM_FEE_PERCENT,
} from '@/config/constants';
import type {
    TicketClaimEstimate,
    TicketClaimProgressItem,
} from '@/types';
import { createAppError, isAppError } from '@/lib/errors';

export function useTicketFinder() {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const {
        ticketScanStatus,
        ticketScanResult,
        ticketScanError,
        ticketClaimStatus,
        ticketClaimResult,
        ticketClaimProgress,
        ticketClaimError,
        setTicketScanStatus,
        setTicketScanResult,
        setTicketScanError,
        setTicketClaimStatus,
        setTicketClaimResult,
        setTicketClaimProgress,
        setTicketClaimError,
        clearTicketClaim,
        clearTickets,
    } = useAppStore();

    const { scanMEVClaims } = useMEVClaims();

    const claimEstimate = useMemo<TicketClaimEstimate>(() => {
        const claimableCount = ticketScanResult?.claimableTickets.length || 0;
        const totalClaimableSOL = ticketScanResult?.totalClaimableSOL || 0;
        const serviceFeeSOL = totalClaimableSOL * (TICKET_CLAIM_FEE_PERCENT / 100);
        const networkFeeSOL = claimableCount > 0
            ? (claimableCount + 1) * NETWORK_FEE_PER_SIGNATURE_SOL
            : 0;
        const userReceivesSOL = Math.max(totalClaimableSOL - serviceFeeSOL, 0);
        const userReceivesUSD = userReceivesSOL * 150;

        return {
            claimableCount,
            totalClaimableSOL,
            serviceFeeSOL,
            networkFeeSOL,
            userReceivesSOL,
            userReceivesUSD,
        };
    }, [ticketScanResult]);

    const updateProgress = useCallback((update: {
        id: string;
        status: TicketClaimProgressItem['status'];
        signature: string | null;
        claimedSOL: number;
        message: string;
    }) => {
        const current = useAppStore.getState().ticketClaimProgress;
        const index = current.findIndex((item) => item.id === update.id);
        const nextItem: TicketClaimProgressItem = index >= 0
            ? { ...current[index], ...update }
            : {
                id: update.id,
                ticketAccountAddress: update.id,
                protocol: 'unknown',
                status: update.status,
                signature: update.signature,
                claimedSOL: update.claimedSOL,
                message: update.message,
            };

        const next = index >= 0
            ? current.map((item, itemIndex) => (itemIndex === index ? nextItem : item))
            : [...current, nextItem];
        setTicketClaimProgress(next);
    }, [setTicketClaimProgress]);

    const runTicketScan = useCallback(async () => {
        if (!publicKey) {
            setTicketScanError(createAppError('WALLET_NOT_CONNECTED', 'publicKey is null'));
            return;
        }

        try {
            setTicketScanStatus('scanning');
            clearTicketClaim();
            logTicketScanStarted();

            const result = await scanForStakingTickets(publicKey.toBase58(), connection);
            setTicketScanResult(result);

            logTicketScanComplete({
                claimableCount: result.claimableTickets.length,
                pendingCount: result.pendingTickets.length,
                totalClaimableSOL: result.totalClaimableSOL,
                protocolsScanned: result.protocolsScanned.length,
                protocolsWithErrors: result.protocolsWithErrors.length,
                hadAnyTickets: result.tickets.length > 0,
            });

            // NEW — Engine 7 scan (runs in parallel, doesn't block tickets)
            scanMEVClaims().catch((err) => {
                // Background scan — non-critical, log as warn not error
                console.warn('MEV scan failed silently', err instanceof Error ? err.message : String(err));
            });
        } catch (error) {
            const appError = isAppError(error)
                ? error
                : createAppError(
                    'TICKET_SCAN_FAILED',
                    error instanceof Error ? error.message : String(error)
                );
            setTicketScanError(appError);
        }
    }, [
        publicKey,
        connection,
        clearTicketClaim,
        setTicketScanStatus,
        setTicketScanResult,
        setTicketScanError,
        scanMEVClaims,
    ]);

    const initiateClaimAll = useCallback(() => {
        if (!ticketScanResult || ticketScanResult.claimableTickets.length === 0) {
            setTicketClaimError(createAppError('TICKET_NOT_READY', 'No claimable tickets available.'));
            return;
        }
        setTicketClaimStatus('awaiting_confirmation');
    }, [ticketScanResult, setTicketClaimError, setTicketClaimStatus]);

    const executeClaimAll = useCallback(async () => {
        if (!publicKey || !sendTransaction) {
            setTicketClaimError(createAppError('WALLET_NOT_CONNECTED', 'Wallet signer unavailable.'));
            return;
        }

        if (!ticketScanResult || ticketScanResult.claimableTickets.length === 0) {
            setTicketClaimError(createAppError('TICKET_NOT_READY', 'No claimable tickets available.'));
            return;
        }

        const claimableTickets = ticketScanResult.claimableTickets;
        setTicketClaimProgress(
            claimableTickets.map((ticket) => ({
                id: ticket.id,
                ticketAccountAddress: ticket.ticketAccountAddress,
                protocol: ticket.protocol,
                status: 'pending',
                signature: null,
                claimedSOL: 0,
                message: 'Queued for claim.',
            }))
        );
        setTicketClaimStatus('building_transaction');

        logTicketClaimInitiated({
            ticketCount: claimableTickets.length,
            estimatedSOL: claimEstimate.userReceivesSOL,
            protocols: Array.from(new Set(claimableTickets.map((ticket) => ticket.protocol))),
        });

        try {
            const result = await claimAllTickets({
                tickets: claimableTickets,
                walletPublicKey: publicKey,
                sendTransaction,
                connection,
                onProgress: updateProgress,
            });

            if (result.claimedCount === 0) {
                setTicketClaimError(
                    createAppError(
                        'TICKET_CLAIM_FAILED',
                        result.errorMessage || 'No ticket claim was confirmed.'
                    )
                );
                logTicketClaimComplete({
                    success: false,
                    claimedCount: 0,
                    claimedSOL: 0,
                    failedCount: result.failedTickets.length,
                    feeSOL: 0,
                });
                return;
            }

            setTicketClaimResult(result);
            logTicketClaimComplete({
                success: result.success,
                claimedCount: result.claimedCount,
                claimedSOL: result.claimedSOL,
                failedCount: result.failedTickets.length,
                feeSOL: result.claimedSOL * (TICKET_CLAIM_FEE_PERCENT / 100),
            });
        } catch (error) {
            const appError = isAppError(error)
                ? error
                : createAppError(
                    'TICKET_CLAIM_FAILED',
                    error instanceof Error ? error.message : String(error)
                );
            setTicketClaimError(appError);
            logTicketClaimComplete({
                success: false,
                claimedCount: 0,
                claimedSOL: 0,
                failedCount: claimableTickets.length,
                feeSOL: 0,
            });
        }
    }, [
        publicKey,
        sendTransaction,
        ticketScanResult,
        claimEstimate.userReceivesSOL,
        connection,
        updateProgress,
        setTicketClaimStatus,
        setTicketClaimResult,
        setTicketClaimProgress,
        setTicketClaimError,
    ]);

    const cancelClaim = useCallback(() => {
        clearTicketClaim();
    }, [clearTicketClaim]);

    return {
        ticketScanStatus,
        ticketScanResult,
        ticketScanError,
        ticketClaimStatus,
        ticketClaimResult,
        ticketClaimProgress,
        ticketClaimError,
        claimEstimate,
        runTicketScan,
        initiateClaimAll,
        executeClaimAll,
        cancelClaim,
        clearTickets,
        hasClaimableTickets: (ticketScanResult?.claimableTickets.length || 0) > 0,
        isScanningTickets: ticketScanStatus === 'scanning',
        isClaimingTickets: ticketClaimStatus === 'building_transaction'
            || ticketClaimStatus === 'awaiting_signature'
            || ticketClaimStatus === 'confirming',
    };
}
