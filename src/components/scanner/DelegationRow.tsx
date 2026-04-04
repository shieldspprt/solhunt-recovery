import { memo, useMemo } from 'react';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import { RiskBadge } from '@/components/common/RiskBadge';
import { shortenAddress, formatTokenAmount, formatBalance } from '@/lib/formatting';
import { getKnownDelegateName, SOLSCAN_ACCOUNT_URL, SOLSCAN_TOKEN_URL } from '@/config/constants';
import type { TokenDelegation } from '@/types';

interface DelegationRowProps {
    delegation: TokenDelegation;
}

export const DelegationRow = memo(function DelegationRow({ delegation }: DelegationRowProps) {
    // Memoize the known delegate lookup to avoid repeated Map lookups on every render
    const knownName = useMemo(
        () => getKnownDelegateName(delegation.delegate),
        [delegation.delegate]
    );
    const formattedDelegatedAmount = formatTokenAmount(
        delegation.delegatedAmount,
        delegation.decimals
    );

    return (
        <>
            {/* Desktop row */}
            <tr className="hidden sm:table-row border-b border-shield-border/50 hover:bg-shield-border/20 transition-colors">
                {/* Risk badge */}
                <td className="py-4 px-4">
                    <RiskBadge level={delegation.riskLevel} />
                </td>

                {/* Token */}
                <td className="py-4 px-4">
                    <div className="flex flex-col">
                        <span className="font-medium text-shield-text">
                            {delegation.tokenSymbol}
                        </span>
                        <a
                            href={SOLSCAN_TOKEN_URL(delegation.mint)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-shield-muted hover:text-shield-accent inline-flex items-center gap-1 transition-colors"
                        >
                            {shortenAddress(delegation.mint, 4)}
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </td>

                {/* Your balance */}
                <td className="py-4 px-4">
                    <span className="text-shield-text">
                        {formatBalance(delegation.ownerBalance)}
                    </span>
                </td>

                {/* Delegate */}
                <td className="py-4 px-4">
                    <div className="flex flex-col">
                        {knownName ? (
                            <span className="inline-flex items-center gap-1.5 text-shield-success text-sm font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {knownName}
                            </span>
                        ) : null}
                        <a
                            href={SOLSCAN_ACCOUNT_URL(delegation.delegate)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-shield-muted hover:text-shield-accent inline-flex items-center gap-1 transition-colors"
                        >
                            {shortenAddress(delegation.delegate, 4)}
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </td>

                {/* Permission level */}
                <td className="py-4 px-4">
                    <span className="text-shield-warning text-sm">
                        Can move up to {formattedDelegatedAmount} tokens
                    </span>
                </td>
            </tr>

            {/* Mobile card */}
            <tr className="sm:hidden">
                <td colSpan={5} className="p-0">
                    <div className="border-b border-shield-border/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <RiskBadge level={delegation.riskLevel} />
                            <span className="text-sm font-medium text-shield-text">
                                {delegation.tokenSymbol}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <p className="text-xs text-shield-muted">Your Balance</p>
                                <p className="text-shield-text">{formatBalance(delegation.ownerBalance)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-shield-muted">Permission</p>
                                <p className="text-shield-warning">Up to {formattedDelegatedAmount}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs text-shield-muted mb-1">Delegate</p>
                            <div className="flex items-center gap-2">
                                {knownName && (
                                    <span className="inline-flex items-center gap-1 text-shield-success text-xs font-medium">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {knownName}
                                    </span>
                                )}
                                <a
                                    href={SOLSCAN_ACCOUNT_URL(delegation.delegate)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-mono text-shield-muted hover:text-shield-accent inline-flex items-center gap-1"
                                >
                                    {shortenAddress(delegation.delegate, 4)}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </div>

                        <a
                            href={SOLSCAN_TOKEN_URL(delegation.mint)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-shield-muted hover:text-shield-accent inline-flex items-center gap-1"
                        >
                            Mint: {shortenAddress(delegation.mint, 4)}
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </td>
            </tr>
        </>
    );
});
