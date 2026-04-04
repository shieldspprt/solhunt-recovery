import { memo, useCallback } from 'react';
import { formatBalance, formatCurrency, formatSOLValue, shortenAddress } from '@/lib/formatting';
import type { DustSwapQuote, DustToken } from '@/types';

interface DustTokenRowProps {
    token: DustToken;
    quote?: DustSwapQuote;
    selected: boolean;
    onToggle: (mint: string) => void;
    onBurn?: (mints: string[]) => void;
}

export const DustTokenRow = memo(function DustTokenRow({ token, quote, selected, onToggle, onBurn }: DustTokenRowProps) {
    const estimatedSolOut = quote?.outAmountSOL ?? 0;
    const isHighValueWarning = token.estimatedValueUSD > 5;

    // Keyboard accessibility handler for the row
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (token.isSwappable) {
                onToggle(token.mint);
            }
        }
    }, [token.isSwappable, token.mint, onToggle]);

    return (
        <div
            role="button"
            tabIndex={token.isSwappable ? 0 : -1}
            aria-label={`${token.tokenSymbol} token account. Balance: ${formatBalance(token.uiBalance)}. ${token.isSwappable ? 'Swappable' : 'Burnable'}. Press Enter or Space to toggle selection.`}
            onKeyDown={handleKeyDown}
            onClick={() => token.isSwappable && onToggle(token.mint)}
            className={[
                'grid grid-cols-[auto,1fr] gap-3 rounded-xl border p-3 transition-colors',
                token.isSwappable
                    ? 'border-shield-border bg-shield-bg/40 hover:bg-shield-bg/70 cursor-pointer focus:outline-none focus:ring-2 focus:ring-shield-accent/50'
                    : 'border-shield-border/50 bg-shield-bg/20 opacity-70 cursor-default',
            ].join(' ')}
        >
            <input
                type="checkbox"
                checked={selected}
                disabled={!token.isSwappable}
                onChange={() => onToggle(token.mint)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${token.tokenSymbol} for swapping`}
                className="mt-1 h-4 w-4 rounded border-shield-border bg-shield-bg text-shield-accent focus:ring-shield-accent disabled:cursor-not-allowed"
            />

            <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-shield-text">
                            {token.tokenSymbol}
                        </span>
                        <span className="text-xs text-shield-muted">{shortenAddress(token.mint, 4)}</span>
                        <span
                            className={[
                                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                token.isSwappable
                                    ? 'border-shield-success/40 bg-shield-success/15 text-shield-success'
                                    : 'border-shield-warning/40 bg-shield-warning/15 text-shield-warning',
                            ].join(' ')}
                        >
                            {token.isSwappable ? 'Swappable' : 'Burnable'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-shield-muted">{token.routeSource}</span>
                        {!token.isSwappable && onBurn && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onBurn([token.mint]);
                                }}
                                aria-label={`Burn ${token.tokenSymbol} token account and reclaim SOL rent`}
                                className="rounded-md border border-shield-warning/40 bg-shield-warning/20 px-2 py-1 text-[11px] font-semibold text-shield-warning hover:bg-shield-warning/30 transition-colors focus:outline-none focus:ring-2 focus:ring-shield-warning/50"
                            >
                                Burn
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-1 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
                    <span className="text-shield-muted">
                        Balance: <span className="text-shield-text">{formatBalance(token.uiBalance)}</span>
                    </span>
                    <span className="text-shield-muted">
                        Value: <span className="text-shield-text">{formatCurrency(token.estimatedValueUSD)}</span>
                    </span>
                    <span className="text-shield-muted">
                        To SOL: <span className="text-shield-success">{estimatedSolOut > 0 ? formatSOLValue(estimatedSolOut) : 'Not quoted'}</span>
                    </span>
                </div>

                {!token.isSwappable && (
                    <p className="mt-1 text-xs text-shield-warning">
                        Not swappable right now (route unavailable or output too small).
                    </p>
                )}

                {isHighValueWarning && (
                    <p className="mt-1 text-xs text-shield-danger" role="alert">
                        Warning: this token is worth more than $5.
                    </p>
                )}
            </div>
        </div>
    );
});
