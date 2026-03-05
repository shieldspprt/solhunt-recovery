import { AlertTriangle, Ticket, X } from 'lucide-react';
import { useTicketFinder } from '@/hooks/useTicketFinder';
import { TICKET_CLAIM_FEE_PERCENT } from '@/config/constants';
import { estimateUSD, formatSOLValue } from '@/lib/formatting';

export function ClaimConfirmModal() {
    const {
        ticketScanResult,
        ticketClaimStatus,
        claimEstimate,
        cancelClaim,
        executeClaimAll,
    } = useTicketFinder();

    if (ticketClaimStatus !== 'awaiting_confirmation' || !ticketScanResult) return null;

    const preview = ticketScanResult.claimableTickets.slice(0, 8);
    const hidden = Math.max(ticketScanResult.claimableTickets.length - preview.length, 0);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-shield-bg/80 backdrop-blur-sm"
                onClick={cancelClaim}
            />

            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={cancelClaim}
                    className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-6 sm:p-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-accent/10 border border-shield-accent/20">
                        <Ticket className="h-8 w-8 text-shield-accent" />
                    </div>

                    <h2 className="text-xl font-bold text-center text-shield-text mb-4">
                        Claim {ticketScanResult.claimableTickets.length} Staking Ticket{ticketScanResult.claimableTickets.length === 1 ? '' : 's'}?
                    </h2>

                    <div className="rounded-xl border border-shield-border bg-shield-bg p-4 mb-4">
                        <p className="text-xs uppercase tracking-wider text-shield-muted mb-2">Tickets to claim</p>
                        <div className="space-y-1">
                            {preview.map((ticket) => (
                                <div key={ticket.id} className="flex items-center justify-between text-sm">
                                    <span className="text-shield-muted">{ticket.protocolDisplayName}</span>
                                    <span className="font-mono text-shield-text">{formatSOLValue(ticket.valueSOL)}</span>
                                </div>
                            ))}
                            {hidden > 0 && (
                                <p className="text-xs text-shield-muted pt-1">+{hidden} more tickets</p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-shield-border bg-shield-bg p-4 mb-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Total claimable:</span>
                                <span className="font-mono text-shield-text">{formatSOLValue(claimEstimate.totalClaimableSOL)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Service fee ({TICKET_CLAIM_FEE_PERCENT}%):</span>
                                <span className="font-mono text-shield-accent">-{formatSOLValue(claimEstimate.serviceFeeSOL)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Network fees (est):</span>
                                <span className="font-mono text-shield-accent">~{formatSOLValue(claimEstimate.networkFeeSOL)}</span>
                            </div>
                            <div className="border-t border-shield-border/60 my-2" />
                            <div className="flex justify-between font-semibold">
                                <span className="text-shield-text">You receive:</span>
                                <span className="font-mono text-shield-success text-lg">
                                    ~{formatSOLValue(claimEstimate.userReceivesSOL)} ({estimateUSD(claimEstimate.userReceivesSOL)})
                                </span>
                            </div>
                        </div>
                    </div>

                    {claimEstimate.totalClaimableSOL > 10 && (
                        <div className="rounded-xl border border-shield-danger/30 bg-shield-danger/10 p-3 mb-4">
                            <p className="text-xs text-shield-danger font-medium flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                You are about to claim more than 10 SOL. Verify this is your wallet before proceeding.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            onClick={cancelClaim}
                            className="flex-1 rounded-xl border border-shield-border bg-transparent px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={executeClaimAll}
                            className="flex-1 rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                        >
                            Claim {formatSOLValue(claimEstimate.userReceivesSOL)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
