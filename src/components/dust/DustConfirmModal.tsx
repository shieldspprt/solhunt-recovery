import { memo, useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import { useAppStore } from '@/hooks/useAppStore';
import { useDustConsolidator } from '@/hooks/useDustConsolidator';
import { DUST_SWAP_FEE_PERCENT } from '@/config/constants';
import { estimateUSD, formatSOLValue } from '@/lib/formatting';

export const DustConfirmModal = memo(function DustConfirmModal() {
    const { dustStatus } = useAppStore();
    const {
        selectedTokens,
        estimatedSelectionSOL,
        executeDustSwap,
        cancelDustSwap,
    } = useDustConsolidator();
    const [feeConsent, setFeeConsent] = useState(false);

    if (dustStatus !== 'awaiting_confirmation') return null;

    const serviceFeeSOL = estimatedSelectionSOL * (DUST_SWAP_FEE_PERCENT / 100);
    const receiveSOL = Math.max(estimatedSelectionSOL - serviceFeeSOL, 0);
    const previewTokens = selectedTokens.slice(0, 8);
    const hiddenCount = Math.max(selectedTokens.length - previewTokens.length, 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-shield-bg/80 backdrop-blur-sm"
                onClick={cancelDustSwap}
            />

            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={cancelDustSwap}
                    className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-6 sm:p-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-accent/10 border border-shield-accent/20">
                        <ArrowRightLeft className="h-8 w-8 text-shield-accent" />
                    </div>

                    <h2 className="text-xl font-bold text-center text-shield-text mb-4">
                        Consolidate Dust to SOL?
                    </h2>

                    <div className="rounded-xl border border-shield-border bg-shield-bg p-4 mb-4">
                        <p className="text-xs uppercase tracking-wider text-shield-muted mb-2">Selected tokens</p>
                        <div className="flex flex-wrap gap-2">
                            {previewTokens.map((token) => (
                                <span
                                    key={token.mint}
                                    className="rounded-md border border-shield-border px-2 py-1 text-xs text-shield-text"
                                >
                                    {token.tokenSymbol}
                                </span>
                            ))}
                            {hiddenCount > 0 && (
                                <span className="rounded-md border border-shield-border px-2 py-1 text-xs text-shield-muted">
                                    +{hiddenCount} more
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-shield-border bg-shield-bg p-4 mb-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Estimated swap output:</span>
                                <span className="text-shield-text font-mono">{formatSOLValue(estimatedSelectionSOL)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Service fee ({DUST_SWAP_FEE_PERCENT}%):</span>
                                <span className="text-shield-accent font-mono">-{formatSOLValue(serviceFeeSOL)}</span>
                            </div>
                            <div className="border-t border-shield-border/60 my-2" />
                            <div className="flex justify-between font-semibold">
                                <span className="text-shield-text">You receive (est):</span>
                                <span className="text-shield-success font-mono">
                                    ~{formatSOLValue(receiveSOL)} ({estimateUSD(receiveSOL)})
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-shield-warning mb-6">
                        Swap amounts are estimates. Actual SOL received may vary by up to 1% due to market
                        movement. Selected tokens will be permanently swapped and this cannot be undone.
                    </p>

                    <div className="rounded-xl border border-shield-accent/30 bg-shield-accent/5 p-4 mb-6 mt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-shield-accent mb-2 flex items-center gap-1">
                            <ArrowRightLeft className="h-3 w-3" /> Transaction Preview
                        </h3>
                        <p className="text-xs text-shield-text leading-relaxed">
                            You are about to sign <span className="font-mono text-shield-accent">1</span> transaction executing <span className="font-mono bg-shield-border/30 px-1 rounded">Jupiter Swap</span> instructions for {selectedTokens.length} tokens. Transfer authority is <strong>only</strong> granted to the exact swap routes for the specified amounts.
                        </p>
                    </div>

                    {/* Fee Disclosure & Consent */}
                    <div className="rounded-xl border border-shield-accent/30 bg-shield-accent/5 p-4 mb-6">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={feeConsent}
                                onChange={(e) => setFeeConsent(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-shield-border bg-shield-bg text-shield-accent focus:ring-shield-accent focus:ring-offset-0 cursor-pointer"
                            />
                            <span className="text-xs text-shield-text leading-relaxed">
                                I understand that a service fee of <span className="font-semibold text-shield-accent">{formatSOLValue(serviceFeeSOL)}</span> will be deducted from my wallet upon confirmation.
                            </span>
                        </label>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            onClick={cancelDustSwap}
                            className="flex-1 rounded-xl border border-shield-border bg-transparent px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={executeDustSwap}
                            disabled={!feeConsent}
                            className="flex-1 rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white shadow-lg shadow-shield-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none hover:bg-shield-accent/90"
                        >
                            Swap {selectedTokens.length} Tokens
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
