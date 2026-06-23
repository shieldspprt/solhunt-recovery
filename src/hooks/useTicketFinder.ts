import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { logger } from '@/lib/logger';
import { fetchSOLPriceUSD, FALLBACK_SOL_PRICE_USD } from '@/lib/solPrice';

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

    // Live SOL/USD price for accurate claim estimate. Falls back to
    // FALLBACK_SOL_PRICE_USD if the Jupiter price API is unavailable
    // or returns a non-positive number. Mirrors the pattern in
    // useDecommissionScanner.ts — previously the USD figure in the
    // claim modal was hardcoded to 150, so a 2x move in SOL produced
    // a misleading ~50% wrong "you'll receive" preview.
    const [solPriceUSD, setSolPriceUSD] = useState<number>(FALLBACK_SOL_PRICE_USD);
    useEffect(() => {
        let cancelled = false;
        fetchSOLPriceUSD()
            .then((price) => {
                if (!cancelled && price > 0) setSolPriceUSD(price);
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    logger.warn(
                        'Ticket SOL price fetch failed:',
                        err instanceof Error ? err.message : String(err)
                    );
                }
            });
        return () => { cancelled = true; };
    }, []);

    const claimEstimate = useMemo<TicketClaimEstimate>(() => {
        const claimableCount = ticketScanResult?.claimableTickets.length || 0;
        const totalClaimableSOL = ticketScanResult?.totalClaimableSOL || 0;
        const serviceFeeSOL = totalClaimableSOL * (TICKET_CLAIM_FEE_PERCENT / 100);
        const networkFeeSOL = claimableCount > 0
            ? (claimableCount + 1) * NETWORK_FEE_PER_SIGNATURE_SOL
            : 0;
        const userReceivesSOL = Math.max(totalClaimableSOL - serviceFeeSOL, 0);
        // Use the live SOL price; fall back to the documented constant
        // if the fetch never resolved (solPriceUSD stays at the initial
        // FALLBACK_SOL_PRICE_USD value).
        const userReceivesUSD = userReceivesSOL * solPriceUSD;

        return {
            claimableCount,
            totalClaimableSOL,
            serviceFeeSOL,
            networkFeeSOL,
            userReceivesSOL,
            userReceivesUSD,
        };
    }, [ticketScanResult, solPriceUSD]);

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

            const result = await scanForStakingTickets(publicKey.toBase58());
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
            scanMEVClaims().catch((err: unknown) => {
                // Background scan — non-critical, log as warn not error
                logger.warn('MEV scan failed silently', err instanceof Error ? err.message : String(err));
            });
        } catch (err: unknown) {
            const appError = isAppError(err)
                ? err
                : createAppError(
                    'TICKET_SCAN_FAILED',
                    err instanceof Error ? err.message : String(err)
                );
            setTicketScanError(appError);
        }
    }, [
        publicKey,
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
        } catch (err: unknown) {
            const appError = isAppError(err)
                ? err
                : createAppError(
                    'TICKET_CLAIM_FAILED',
                    err instanceof Error ? err.message : String(err)
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
