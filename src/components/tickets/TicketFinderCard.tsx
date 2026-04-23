import { useCallback, useMemo, memo } from 'react';
import { Loader2, Ticket } from 'lucide-react';
import { ClaimConfirmModal } from '@/components/tickets/ClaimConfirmModal';
import { ClaimProgressModal } from '@/components/tickets/ClaimProgressModal';
import { MEVClaimConfirmModal } from '@/components/tickets/MEVClaimConfirmModal';
import { MEVClaimProgressModal } from '@/components/tickets/MEVClaimProgressModal';
import { MEVClaimsSection } from '@/components/tickets/MEVClaimsSection';
import { PendingTicketRow } from '@/components/tickets/PendingTicketRow';
import { TicketRow } from '@/components/tickets/TicketRow';
import { useTicketFinder } from '@/hooks/useTicketFinder';
import { TICKET_CLAIM_FEE_PERCENT } from '@/config/constants';
import { estimateUSD, formatSOLValue } from '@/lib/formatting';

const PROTOCOL_LABELS = [
    'Marinade Finance',
    'Sanctum',
    'Jito',
    'BlazeStake',
    'Native Stake',
];

// Wrap the component export with memo to prevent unnecessary re-renders
export const TicketFinderCard = memo(function TicketFinderCard() {
    const {
        ticketScanStatus,
        ticketScanResult,
        ticketScanError,
        claimEstimate,
        runTicketScan,
        initiateClaimAll,
    } = useTicketFinder();

    // Memoize render functions to prevent recreation on every render
    const renderIdle = useCallback(() => (
        <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full">
            <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                    <Ticket className="h-5 w-5 text-shield-accent" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-shield-text">Staking Ticket Finder</h2>
                    <p className="text-sm text-shield-muted">
                        Scan for forgotten unstaked SOL from Marinade, Sanctum, Jito, BlazeStake, and native stake accounts.
                    </p>
                </div>
            </div>

            <button
                data-agent-target="start-scan-tickets-btn"
                onClick={runTicketScan}
                type="button"
                aria-label="Scan for Staking Tickets"
                className="mt-3 w-full rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
            >
                Scan for Staking Tickets
            </button>

            <p className="mt-3 text-xs text-shield-muted">
                Checks 5 protocols · Takes 5-20 seconds
            </p>
        </div>
    ), [runTicketScan]);

    const renderScanning = useCallback(() => (
        <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                    <Loader2 className="h-5 w-5 text-shield-accent animate-spin" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-shield-text">Scanning Protocols...</h2>
                    <p className="text-sm text-shield-muted">This may take a few seconds.</p>
                </div>
            </div>

            <div className="space-y-2">
                {PROTOCOL_LABELS.map((protocol, index) => (
                    <div key={protocol} className="flex items-center gap-2 text-sm">
                        {index === 0 ? (
                            <Loader2 className="h-3.5 w-3.5 text-shield-accent animate-spin" />
                        ) : (
                            <span className="h-2 w-2 rounded-full bg-shield-muted/50" />
                        )}
                        <span className="text-shield-muted">{protocol}</span>
                    </div>
                ))}
            </div>
        </div>
    ), []);

    const renderError = useCallback(() => (
        <div className="rounded-2xl border border-shield-danger/30 bg-shield-danger/10 p-6 shadow-xl w-full">
            <h2 className="text-lg font-bold text-shield-text mb-2">Ticket scan failed</h2>
            <p className="text-sm text-shield-danger mb-4">
                {ticketScanError?.message || 'Could not scan staking tickets right now.'}
            </p>
            <button
                onClick={runTicketScan}
                aria-label="Try Again"
                className="rounded-xl bg-shield-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-shield-accent/90 transition-colors"
            >
                Try Again
            </button>
        </div>
    ), [ticketScanError, runTicketScan]);

    const renderComplete = useCallback(() => {
        if (!ticketScanResult) return null;

        const hasTickets = ticketScanResult.tickets.length > 0;
        const hasClaimable = ticketScanResult.claimableTickets.length > 0;
        const hasPending = ticketScanResult.pendingTickets.length > 0;

        return (
            <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                            <Ticket className="h-5 w-5 text-shield-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-shield-text">Staking Ticket Finder</h2>
                            <p className="text-sm text-shield-muted">
                                {hasTickets
                                    ? `${ticketScanResult.claimableTickets.length} claimable / ${ticketScanResult.pendingTickets.length} pending`
                                    : 'No unredeemed staking tickets found.'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={runTicketScan}
                        aria-label="Rescan"
                        className="rounded-lg border border-shield-border px-3 py-1.5 text-xs text-shield-text hover:bg-shield-bg/60 transition-colors"
                    >
                        Rescan
                    </button>
                </div>

                {!hasTickets && (
                    <div className="rounded-xl border border-shield-success/30 bg-shield-success/10 p-4">
                        <p className="text-sm text-shield-success font-medium mb-1">
                            All 5 protocols scanned. No unredeemed tickets.
                        </p>
                        <p className="text-xs text-shield-muted">
                            Your staked SOL is fully active or already claimed.
                        </p>
                    </div>
                )}

                {hasClaimable && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-shield-success">
                            Ready to Claim
                        </h3>
                        <div className="space-y-2">
                            {ticketScanResult.claimableTickets.map((ticket) => (
                                <TicketRow key={ticket.id} ticket={ticket} />
                            ))}
                        </div>

                        <div className="rounded-xl border border-shield-border/60 bg-shield-bg/50 p-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Total claimable:</span>
                                    <span className="font-mono text-shield-text">{formatSOLValue(claimEstimate.totalClaimableSOL)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Service fee ({TICKET_CLAIM_FEE_PERCENT}%):</span>
                                    <span className="font-mono text-shield-accent">-{formatSOLValue(claimEstimate.serviceFeeSOL)}</span>
                                </div>
                                <div className="border-t border-shield-border/60 my-2" />
                                <div className="flex justify-between font-semibold">
                                    <span className="text-shield-text">You receive:</span>
                                    <span className="font-mono text-shield-success">
                                        ~{formatSOLValue(claimEstimate.userReceivesSOL)} ({estimateUSD(claimEstimate.userReceivesSOL)})
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={initiateClaimAll}
                            type="button"
                            aria-label={`Claim All ${ticketScanResult.claimableTickets.length} Tickets`}
                            className="w-full rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                        >
                            Claim All {ticketScanResult.claimableTickets.length} Ticket{ticketScanResult.claimableTickets.length === 1 ? '' : 's'}
                        </button>
                    </div>
                )}

                {hasPending && (
                    <div className="mt-5 space-y-3">
                        <h3 className="text-sm font-semibold text-shield-warning">Still Unstaking</h3>
                        <div className="space-y-2">
                            {ticketScanResult.pendingTickets.map((ticket) => (
                                <PendingTicketRow key={ticket.id} ticket={ticket} />
                            ))}
                        </div>
                    </div>
                )}

                {ticketScanResult.protocolsWithErrors.length > 0 && (
                    <p className="mt-4 text-xs text-shield-warning">
                        Note: {ticketScanResult.protocolsWithErrors.join(', ')} could not be scanned. Try again later.
                    </p>
                )}

                <MEVClaimsSection />
            </div>
        );
    }, [ticketScanResult, claimEstimate, initiateClaimAll, runTicketScan]);

    // Memoize the content based on scan status to prevent recalculation
    const content = useMemo(() => {
        switch (ticketScanStatus) {
            case 'idle': return renderIdle();
            case 'scanning': return renderScanning();
            case 'error': return renderError();
            case 'scan_complete': return renderComplete();
            default: return null;
        }
    }, [ticketScanStatus, renderIdle, renderScanning, renderError, renderComplete]);

    return (
        <div aria-live="polite" aria-busy={ticketScanStatus === 'scanning'}>
            {content}

            <ClaimConfirmModal />
            <ClaimProgressModal />
            <MEVClaimConfirmModal />
            <MEVClaimProgressModal />
        </div>
    );
});