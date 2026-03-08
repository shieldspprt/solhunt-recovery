import { logEvent as firebaseLogEvent } from 'firebase/analytics';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { analytics, db, isFirebaseConfigured } from '@/config/firebase';

/**
 * Safely logs an analytics event. No-op if Firebase is not configured.
 * Never logs wallet addresses or identifying information — per spec Section 9.
 */
function logEvent(eventName: string, params: Record<string, string | number | boolean | null>) {
    if (!isFirebaseConfigured || !analytics) return;

    try {
        firebaseLogEvent(analytics, eventName, params);
    } catch {
        // Silently fail — analytics should never break the app
    }
}

/**
 * Logs a scan event to Firestore. No-op if Firebase is not configured.
 * DO NOT store wallet address, IP address, or any identifying information.
 */
async function logScanEvent(data: {
    delegationsFound: number;
    highRiskCount: number;
    revokeAttempted: boolean;
    revokeSuccess: boolean;
}): Promise<void> {
    if (!isFirebaseConfigured || !db) return;

    try {
        await addDoc(collection(db, 'scan_events'), {
            timestamp: serverTimestamp(),
            ...data,
        });
    } catch {
        // Silently fail — logging should never break the app
    }
}

// ─── Specific Event Loggers ─────────────────────────────────────

export function logWalletConnected(): void {
    logEvent('wallet_connected', { timestamp: Date.now() });
}

export function logScanStarted(): void {
    logEvent('scan_started', { timestamp: Date.now() });
}

export function logScanComplete(data: {
    totalAccounts: number;
    delegationsFound: number;
    highRiskCount: number;
    scanDurationMs: number;
}): void {
    logEvent('scan_complete', {
        ...data,
        hadError: false,
    });

    // Also log to Firestore
    logScanEvent({
        delegationsFound: data.delegationsFound,
        highRiskCount: data.highRiskCount,
        revokeAttempted: false,
        revokeSuccess: false,
    });
}

export function logScanError(errorCode: string): void {
    logEvent('scan_error', {
        errorCode,
        timestamp: Date.now(),
    });
}

export function logRevokeInitiated(data: {
    delegationCount: number;
    feePaidSOL: number;
}): void {
    logEvent('revoke_initiated', data);
}

export function logRevokeComplete(data: {
    success: boolean;
    revokedCount: number;
    errorCode: string | null;
}): void {
    logEvent('revoke_complete', data);

    // Update Firestore
    if (data.success) {
        logScanEvent({
            delegationsFound: data.revokedCount,
            highRiskCount: 0,
            revokeAttempted: true,
            revokeSuccess: data.success,
        });
    }
}

// ─── Engine 2 Events ──────────────────────────────────────────────────
export function logReclaimInitiated(data: { accountCount: number; estimatedSOL: number }): void {
    logEvent('reclaim_initiated', data);
}

export function logReclaimComplete(data: { success: boolean; closedCount: number; reclaimedSOL: number }): void {
    logEvent('reclaim_complete', data);
}

// ─── Engine 3 Events ──────────────────────────────────────────────────
export function logDustScanComplete(data: {
    dustCount: number;
    swappableCount: number;
    estimatedValueUSD: number;
}): void {
    logEvent('dust_scan_complete', data);
}

export function logDustSwapInitiated(data: { tokenCount: number; estimatedSOL: number }): void {
    logEvent('dust_swap_initiated', data);
}

export function logDustSwapComplete(data: { success: boolean; swappedCount: number; receivedSOL: number }): void {
    logEvent('dust_swap_complete', data);
}

export function logDustBurnInitiated(data: { tokenCount: number; estimatedReclaimSOL: number }): void {
    logEvent('dust_burn_reclaim_initiated', data);
}

export function logDustBurnComplete(data: { success: boolean; burnedCount: number; reclaimedSOL: number }): void {
    logEvent('dust_burn_reclaim_complete', data);
}

// ─── Engine 4 Events ──────────────────────────────────────────────────
export function logTicketScanStarted(): void {
    logEvent('ticket_scan_started', { timestamp: Date.now() });
}

export function logTicketScanComplete(data: {
    claimableCount: number;
    pendingCount: number;
    totalClaimableSOL: number;
    protocolsScanned: number;
    protocolsWithErrors: number;
    hadAnyTickets: boolean;
}): void {
    logEvent('ticket_scan_complete', data);
}

export function logTicketClaimInitiated(data: {
    ticketCount: number;
    estimatedSOL: number;
    protocols: string[];
}): void {
    logEvent('ticket_claim_initiated', {
        ticketCount: data.ticketCount,
        estimatedSOL: data.estimatedSOL,
        protocols: data.protocols.join(','),
    });
}

export function logTicketClaimComplete(data: {
    success: boolean;
    claimedCount: number;
    claimedSOL: number;
    failedCount: number;
    feeSOL: number;
}): void {
    logEvent('ticket_claim_complete', data);
}

// ─── Engine 5 Events ──────────────────────────────────────────────────
export function logLPScanStarted(): void {
    logEvent('lp_scan_started', { timestamp: Date.now() });
}

export function logLPScanComplete(data: {
    positionCount: number;
    positionsWithFees: number;
    totalFeeValueUSD: number;
    protocolBreakdown: { orca: number; raydium: number; meteora: number };
    protocolsWithErrors: number;
}): void {
    logEvent('lp_scan_complete', {
        positionCount: data.positionCount,
        positionsWithFees: data.positionsWithFees,
        totalFeeValueUSD: data.totalFeeValueUSD,
        protocolOrcaUSD: data.protocolBreakdown.orca,
        protocolRaydiumUSD: data.protocolBreakdown.raydium,
        protocolMeteoraUSD: data.protocolBreakdown.meteora,
        protocolsWithErrors: data.protocolsWithErrors,
    });
}

export function logLPHarvestInitiated(data: {
    positionCount: number;
    totalFeeValueUSD: number;
    willCompound: boolean;
}): void {
    logEvent('lp_harvest_initiated', data);
}

export function logLPHarvestComplete(data: {
    success: boolean;
    harvestedCount: number;
    failedCount: number;
    totalValueUSD: number;
    compoundAttempted: boolean;
    compoundSuccess: boolean;
    feeSOL: number;
}): void {
    logEvent('lp_harvest_complete', data);
}

// ─── Engine 6 Events ──────────────────────────────────────────────────
export function logCNFTScanStarted(): void {
    logEvent('cnft_scan_started', { timestamp: Date.now() });
}

export function logCNFTScanComplete(data: {
    totalCNFTs: number;
    spamCount: number;
    lowValueCount: number;
    potentiallyValuableCount: number;
    verifiedCount: number;
    fullyScanned: boolean;
}): void {
    logEvent('cnft_scan_complete', data);
}

export function logCNFTBurnInitiated(data: {
    selectedCount: number;
    spamSelected: number;
    lowValueSelected: number;
    sessionFeeSOL: number;
}): void {
    logEvent('cnft_burn_initiated', data);
}

export function logCNFTBurnComplete(data: {
    success: boolean;
    burnedCount: number;
    failedCount: number;
    transactionCount: number;
}): void {
    logEvent('cnft_burn_complete', data);
}

// ─── Engine 7: MEV Claims Analytics ──────────────────────────────────────

export function logMEVScanStarted(): void {
    logEvent('mev_scan_started', { timestamp: Date.now() });
}

export function logMEVScanComplete(data: {
    totalItems: number;
    claimableSOL: number;
    hasErrors: boolean;
}): void {
    logEvent('mev_scan_complete', data);
}

export function logMEVClaimInitiated(data: {
    selectedCount: number;
    estimatedSOL: number;
}): void {
    logEvent('mev_claim_initiated', data);
}

export function logMEVClaimComplete(data: {
    successCount: number;
    failedCount: number;
    totalClaimedSOL: number;
}): void {
    logEvent('mev_claim_complete', data);
}
