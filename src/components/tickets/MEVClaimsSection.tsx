import { memo, useMemo } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { useMEVClaims } from '@/hooks/useMEVClaims';
import { MEVClaimRow } from '@/components/tickets/MEVClaimRow';
import { MEV_SERVICE_FEE_PERCENT } from '@/config/constants';
import { estimateUSD, formatSOLValue } from '@/lib/formatting';

export const MEVClaimsSection = memo(function MEVClaimsSection() {
    const {
        mevScanStatus,
        mevScanResult,
        selectedItems,
        toggleMEVItem,
        selectAllMEV,
        deselectAllMEV,
        claimEstimate,
        initiateClaim,
    } = useMEVClaims();

    // Memoize derived calculations to prevent re-computation on unrelated re-renders
    const hasSelection = useMemo(() => selectedItems.length > 0, [selectedItems.length]);
    const allSelected = useMemo(
        () => mevScanResult ? selectedItems.length === mevScanResult.items.length : false,
        [selectedItems.length, mevScanResult]
    );

    if (mevScanStatus === 'idle' || mevScanStatus === 'no_rewards') {
        return null;
    }

    if (mevScanStatus === 'scanning') {
        return (
            <div className="mt-8 border-t border-shield-border pt-6">
                <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-shield-accent animate-spin" />
                    <span className="text-sm font-medium text-shield-muted">Checking Jito MEV and Priority Fee Rewards...</span>
                </div>
            </div>
        );
    }

    if (mevScanStatus === 'error') {
        return (
            <div className="mt-8 border-t border-shield-border pt-6">
                <p className="text-xs text-shield-warning">Could not fetch MEV rewards at this time.</p>
            </div>
        );
    }

    if (mevScanStatus === 'scan_complete' && mevScanResult && mevScanResult.items.length > 0) {
        return (
            <div className="mt-8 border-t border-shield-border pt-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-shield-accent" fill="currentColor" />
                        <h3 className="text-sm font-bold text-shield-text">Claimable MEV & Priority Fees</h3>
                    </div>
                    {mevScanResult.items.length > 1 && (
                        <button
                            onClick={allSelected ? deselectAllMEV : selectAllMEV}
                            className="text-xs text-shield-accent hover:underline"
                            aria-label={allSelected ? 'Deselect all MEV rewards' : 'Select all MEV rewards'}
                        >
                            {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                    {mevScanResult.items.map((item) => {
                        const id = `${item.stakeAccount}-${item.epoch}`;
                        const isSelected = selectedItems.some(
                            (s) => s.stakeAccount === item.stakeAccount && s.epoch === item.epoch
                        );
                        return (
                            <MEVClaimRow
                                key={id}
                                item={item}
                                isSelected={isSelected}
                                onToggle={() => toggleMEVItem(id)}
                            />
                        );
                    })}
                </div>

                {hasSelection && claimEstimate && (
                    <>
                        <div 
                            className="rounded-xl border border-shield-border/60 bg-shield-bg/50 p-4"
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Total claimable:</span>
                                    <span className="font-mono text-shield-text">{formatSOLValue(claimEstimate.totalClaimSOL)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Service fee ({MEV_SERVICE_FEE_PERCENT}%):</span>
                                    <span className="font-mono text-shield-accent">-{formatSOLValue(claimEstimate.serviceFeeSOL)}</span>
                                </div>
                                <div className="border-t border-shield-border/60 my-2" />
                                <div className="flex justify-between font-semibold">
                                    <span className="text-shield-text">Net to you:</span>
                                    <span className="font-mono text-shield-success">
                                        ~{formatSOLValue(claimEstimate.netReceivedSOL)} ({estimateUSD(claimEstimate.netReceivedSOL)})
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={initiateClaim}
                            type="button"
                            aria-label={`Claim ${selectedItems.length} MEV reward${selectedItems.length === 1 ? '' : 's'}`}
                            className="w-full rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                        >
                            Claim {selectedItems.length} MEV Reward{selectedItems.length === 1 ? '' : 's'}
                        </button>
                    </>
                )}
            </div>
        );
    }

    return null;
});