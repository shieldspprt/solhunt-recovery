import { ExternalLink } from 'lucide-react';
import { ProtocolBadge } from '@/components/tickets/ProtocolBadge';
import { estimateUSD, formatSOLValue, shortenAddress } from '@/lib/formatting';
import { SOLSCAN_ACCOUNT_URL } from '@/config/constants';
import type { StakingTicket } from '@/types';

interface PendingTicketRowProps {
    ticket: StakingTicket;
}

function getPendingLabel(ticket: StakingTicket): string {
    if (ticket.epochsRemaining !== null) {
        if (ticket.epochsRemaining <= 1) return '~1 epoch remaining';
        return `~${ticket.epochsRemaining} epochs remaining`;
    }

    if (ticket.estimatedTimeRemainingHours !== null) {
        const days = Math.max(Math.round(ticket.estimatedTimeRemainingHours / 24), 1);
        return `~${days} day${days === 1 ? '' : 's'} remaining`;
    }

    return 'Still in unstaking period';
}

export function PendingTicketRow({ ticket }: PendingTicketRowProps) {
    return (
        <div className="rounded-xl border border-shield-warning/30 bg-shield-warning/5 p-3 opacity-90">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <ProtocolBadge protocol={ticket.protocol} />
                <span className="rounded-md border border-shield-warning/40 bg-shield-warning/15 px-2 py-1 text-[11px] font-semibold text-shield-warning">
                    Pending
                </span>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-shield-muted">
                <a
                    href={SOLSCAN_ACCOUNT_URL(ticket.ticketAccountAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-shield-text transition-colors"
                >
                    {shortenAddress(ticket.ticketAccountAddress, 5)}
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            <div className="mt-2 flex items-end justify-between">
                <div>
                    <p className="text-lg font-semibold text-shield-text">
                        {formatSOLValue(ticket.valueSOL)}
                    </p>
                    <p className="text-xs text-shield-muted">{estimateUSD(ticket.valueSOL)}</p>
                </div>
                <p className="text-[11px] text-shield-warning text-right">{getPendingLabel(ticket)}</p>
            </div>
        </div>
    );
}
