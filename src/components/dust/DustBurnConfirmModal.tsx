import { AlertTriangle, Flame, X } from 'lucide-react';
import { useAppStore } from '@/hooks/useAppStore';
import { useDustBurnReclaim } from '@/hooks/useDustBurnReclaim';
import { DUST_BURN_RECLAIM_FEE_PERCENT } from '@/config/constants';
import { estimateUSD, formatSOLValue } from '@/lib/formatting';
import { useState } from 'react';

export function DustBurnConfirmModal() {
    const { dustBurnStatus } = useAppStore();
    const {
        burnableTokens,
        burnEstimate,
        executeBurnReclaim,
        cancelBurnReclaim,
    } = useDustBurnReclaim();
    const [feeConsent, setFeeConsent] = useState(false);

    if (dustBurnStatus !== 'awaiting_confirmation') return null;

    const previewTokens = burnableTokens.slice(0, 12);
    const hiddenCount = Math.max(burnableTokens.length - previewTokens.length, 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-shield-bg/80 backdrop-blur-sm"
                onClick={cancelBurnReclaim}
            />

            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={cancelBurnReclaim}
                    className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                    aria-label="Close dialog"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-6 sm:p-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-warning/20 border border-shield-warning/30">
                        <Flame className="h-8 w-8 text-shield-warning" />
                    </div>

                    <h2 className="text-xl font-bold text-center text-shield-text mb-4">
                        Burn Dust Tokens & Reclaim Rent?
                    </h2>

                    <div className="rounded-xl border border-shield-border bg-shield-bg p-4 mb-4">
                        <p className="text-xs uppercase tracking-wider text-shield-muted mb-2">Tokens to burn</p>
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
                                <span className="text-shield-muted">Rent to reclaim:</span>
                                <span className="text-shield-text font-mono">{formatSOLValue(burnEstimate.totalReclaimSOL)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Service fee ({DUST_BURN_RECLAIM_FEE_PERCENT}%):</span>
                                <span className="text-shield-accent font-mono">-{formatSOLValue(burnEstimate.serviceFeeSOL)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Network fees (est):</span>
                                <span className="text-shield-accent font-mono">~{formatSOLValue(burnEstimate.networkFeeSOL)}</span>
                            </div>
                            <div className="border-t border-shield-border/60 my-2" />
                            <div className="flex justify-between font-semibold">
                                <span className="text-shield-text">You receive (est):</span>
                                <span className="text-shield-success font-mono">
                                    ~{formatSOLValue(burnEstimate.userReceivesSOL)} ({estimateUSD(burnEstimate.userReceivesSOL)})
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-shield-danger/30 bg-shield-danger/10 p-3 mb-6">
                        <p className="text-xs text-shield-danger font-medium flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            These tokens will be permanently destroyed, and account closure cannot be undone.
                        </p>
                    </div>

                    <div className="rounded-xl border border-shield-warning/30 bg-shield-warning/5 p-4 mb-6 mt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-shield-warning mb-2 flex items-center gap-1">
                            <Flame className="h-3 w-3" /> Transaction Preview
                        </h3>
                        <p className="text-xs text-shield-text leading-relaxed">
                            You are about to sign <span className="font-mono text-shield-warning">1</span> transaction containing <span className="font-mono text-shield-warning">{burnableTokens.length}</span> <span className="font-mono bg-shield-border/30 px-1 rounded">burn</span> and <span className="font-mono bg-shield-border/30 px-1 rounded">closeAccount</span> instructions. No transfer authority is granted to any third-party app.
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
                                I understand that a service fee of <span className="font-semibold text-shield-accent">{formatSOLValue(burnEstimate.serviceFeeSOL)}</span> and network fees of approximately <span className="font-semibold text-shield-accent">{formatSOLValue(burnEstimate.networkFeeSOL)}</span> will be deducted from my wallet upon confirmation.
                            </span>
                        </label>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            onClick={cancelBurnReclaim}
                            className="flex-1 rounded-xl border border-shield-border bg-transparent px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={executeBurnReclaim}
                            disabled={!feeConsent}
                            className="flex-1 rounded-xl bg-shield-warning text-shield-bg px-4 py-3 font-semibold hover:bg-shield-warning/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-shield-warning/20 disabled:shadow-none"
                        >
                            Burn & Reclaim
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
