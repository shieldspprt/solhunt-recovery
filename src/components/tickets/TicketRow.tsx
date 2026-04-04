import { memo, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { ProtocolBadge } from '@/components/tickets/ProtocolBadge';
import { estimateUSD, formatSOLValue, shortenAddress } from '@/lib/formatting';
import { SOLSCAN_ACCOUNT_URL } from '@/config/constants';
import type { StakingTicket } from '@/types';

interface TicketRowProps {
    ticket: StakingTicket;
}

export const TicketRow = memo(function TicketRow({ ticket }: TicketRowProps) {
    // Memoize formatted values to prevent recalculation on parent re-renders
    const formattedValues = useMemo(() => ({
        solValue: formatSOLValue(ticket.valueSOL),
        usdEstimate: estimateUSD(ticket.valueSOL),
        shortAddress: shortenAddress(ticket.ticketAccountAddress, 5),
        shortValidator: ticket.validatorVoteAccount 
            ? shortenAddress(ticket.validatorVoteAccount, 4) 
            : null,
    }), [ticket.valueSOL, ticket.ticketAccountAddress, ticket.validatorVoteAccount]);

    return (
        <div className="rounded-xl border border-shield-border bg-shield-bg/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <ProtocolBadge protocol={ticket.protocol} />
                <span className="rounded-md border border-shield-success/40 bg-shield-success/15 px-2 py-1 text-[11px] font-semibold text-shield-success">
                    Ready to Claim
                </span>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-shield-muted">
                <a
                    href={SOLSCAN_ACCOUNT_URL(ticket.ticketAccountAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-shield-text transition-colors"
                >
                    {formattedValues.shortAddress}
                    <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            <div className="mt-2 flex items-end justify-between">
                <div>
                    <p className="text-lg font-semibold text-shield-text">
                        {formattedValues.solValue}
                    </p>
                    <p className="text-xs text-shield-muted">{formattedValues.usdEstimate}</p>
                </div>
                {formattedValues.shortValidator && (
                    <p className="text-[11px] text-shield-muted text-right">
                        Validator: {formattedValues.shortValidator}
                    </p>
                )}
            </div>
        </div>
    );
});