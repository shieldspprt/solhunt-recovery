import { Sparkles, ArrowRightLeft } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useDustConsolidator } from '@/hooks/useDustConsolidator';
import { useDustBurnReclaim } from '@/hooks/useDustBurnReclaim';
import { DUST_BURN_RECLAIM_FEE_PERCENT, DUST_SWAP_FEE_PERCENT } from '@/config/constants';
import { estimateUSD, formatCurrency, formatSOLValue } from '@/lib/formatting';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { DustTokenRow } from '@/components/dust/DustTokenRow';

export const DustCard = memo(function DustCard() {
    const {
        dustScanResult,
        swapQuotes,
        selectedDustMints,
        selectedTokens,
        estimatedSelectionSOL,
        dustStatus,
        dustError,
        isFetchingDust,
        isSwappingDust,
        toggleTokenSelection,
        selectAll,
        deselectAll,
        initiateDustSwap,
    } = useDustConsolidator();
    const {
        unswappableTokens,
        burnEstimate,
        isBurning,
        initiateBurnReclaim,
        startBurnForMints,
    } = useDustBurnReclaim();

    // Hooks must be called before any early returns
    const serviceFeeSOL = useMemo(
        () => estimatedSelectionSOL * (DUST_SWAP_FEE_PERCENT / 100),
        [estimatedSelectionSOL]
    );
    const receiveSOL = useMemo(
        () => Math.max(estimatedSelectionSOL - serviceFeeSOL, 0),
        [estimatedSelectionSOL, serviceFeeSOL]
    );

    if (isFetchingDust) {
        return (
            <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                        <Sparkles className="h-5 w-5 text-shield-accent" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-shield-text">Dust Consolidator</h2>
                        <p className="text-sm text-shield-muted">Scanning token balances for dust...</p>
                    </div>
                </div>
                <LoadingSpinner size="md" />
            </div>
        );
    }

    if (!dustScanResult) return null;

    if (dustScanResult.dustTokens.length === 0) {
        return (
            <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-success/10 border border-shield-success/20">
                        <Sparkles className="h-5 w-5 text-shield-success" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-shield-text">Dust Consolidator</h2>
                        <p className="text-sm text-shield-muted">No dust found. Your wallet is efficient.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                        <Sparkles className="h-5 w-5 text-shield-accent" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-shield-text">Dust Tokens Found</h2>
                        <p className="text-sm text-shield-muted">
                            {dustScanResult.swappableCount} swappable / {dustScanResult.unswappableCount} unswappable
                            {' '}({formatCurrency(dustScanResult.totalEstimatedValueUSD)} est. value)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={selectAll}
                        className="rounded-lg border border-shield-border px-3 py-1.5 text-xs text-shield-text hover:bg-shield-bg/60 transition-colors"
                    >
                        Select All
                    </button>
                    <button
                        onClick={deselectAll}
                        className="rounded-lg border border-shield-border px-3 py-1.5 text-xs text-shield-text hover:bg-shield-bg/60 transition-colors"
                    >
                        Deselect All
                    </button>
                </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {dustScanResult.dustTokens.map((token) => (
                    <DustTokenRow
                        key={token.mint}
                        token={token}
                        quote={swapQuotes.get(token.mint)}
                        selected={selectedDustMints.includes(token.mint)}
                        onToggle={toggleTokenSelection}
                        onBurn={!token.isSwappable ? startBurnForMints : undefined}
                    />
                ))}
            </div>

            {dustStatus === 'error' && dustError && (
                <div className="rounded-lg border border-shield-danger/30 bg-shield-danger/10 p-3 mt-4">
                    <p className="text-sm text-shield-danger font-medium">{dustError.message}</p>
                </div>
            )}

            <div className="rounded-xl border border-shield-border/60 bg-shield-bg/50 p-4 mt-4">
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-shield-muted">Estimated SOL from selected swaps:</span>
                        <span className="text-shield-text font-mono">{formatSOLValue(estimatedSelectionSOL)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-shield-muted">Service fee ({DUST_SWAP_FEE_PERCENT}%):</span>
                        <span className="text-shield-accent font-mono">-{formatSOLValue(serviceFeeSOL)}</span>
                    </div>
                    <div className="h-px w-full bg-shield-border/60" />
                    <div className="flex justify-between">
                        <span className="text-shield-text font-semibold">You receive:</span>
                        <span className="text-shield-success font-mono font-bold">
                            ~{formatSOLValue(receiveSOL)} ({estimateUSD(receiveSOL)})
                        </span>
                    </div>
                </div>
            </div>

            <p className="mt-3 text-xs text-shield-muted">
                Prices and output are estimates. Final SOL depends on routing and market movement.
            </p>

            <button
                onClick={initiateDustSwap}
                disabled={selectedTokens.length === 0 || isSwappingDust}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-shield-accent text-white font-semibold px-4 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-shield-accent/90 transition-colors"
            >
                <ArrowRightLeft className="h-4 w-4" />
                Consolidate {selectedTokens.length} Token{selectedTokens.length === 1 ? '' : 's'} to SOL
            </button>

            {unswappableTokens.length > 0 && (
                <div className="mt-5 rounded-xl border border-shield-warning/30 bg-shield-warning/10 p-4">
                    <h3 className="text-sm font-semibold text-shield-text mb-2">
                        {unswappableTokens.length} token account{unswappableTokens.length === 1 ? '' : 's'} cannot be swapped
                    </h3>
                    <p className="text-xs text-shield-muted mb-3">
                        You can burn these dust tokens and close their accounts to reclaim locked rent SOL.
                    </p>
                    <div className="space-y-1 text-xs mb-3">
                        <div className="flex justify-between">
                            <span className="text-shield-muted">Estimated reclaim:</span>
                            <span className="text-shield-text font-mono">{formatSOLValue(burnEstimate.totalReclaimSOL)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-shield-muted">Service fee ({DUST_BURN_RECLAIM_FEE_PERCENT}%):</span>
                            <span className="text-shield-accent font-mono">-{formatSOLValue(burnEstimate.serviceFeeSOL)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-shield-muted">You receive:</span>
                            <span className="text-shield-success font-mono">
                                ~{formatSOLValue(burnEstimate.userReceivesSOL)} ({estimateUSD(burnEstimate.userReceivesSOL)})
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={initiateBurnReclaim}
                        disabled={isBurning}
                        className="w-full rounded-xl bg-shield-warning text-shield-bg font-semibold px-4 py-3 hover:bg-shield-warning/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Burn & Reclaim {unswappableTokens.length} Account{unswappableTokens.length === 1 ? '' : 's'}
                    </button>
                </div>
            )}
        </div>
    );
});
