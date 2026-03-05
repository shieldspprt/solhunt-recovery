import { useAppStore } from '@/hooks/useAppStore';
import { useReclaimRent } from '@/hooks/useReclaimRent';
import { formatSOLValue, estimateUSD } from '@/lib/formatting';
import { Coins, X, Zap } from 'lucide-react';

export function ReclaimConfirmModal() {
    const { reclaimStatus, clearReclaim } = useAppStore();
    const { closeableAccounts, reclaimEstimate, executeReclaim } = useReclaimRent();

    // Only show when state is awaiting_confirmation
    if (reclaimStatus !== 'awaiting_confirmation' || !reclaimEstimate) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-shield-bg/80 backdrop-blur-sm"
                onClick={clearReclaim}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={clearReclaim}
                    className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-6 sm:p-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-success/10 border border-shield-success/20">
                        <Coins className="h-8 w-8 text-shield-success" />
                    </div>

                    <h2 className="text-xl font-bold text-center text-shield-text mb-6">
                        Reclaim Rent SOL?
                    </h2>

                    <div className="space-y-3 mb-6 text-sm">
                        <p className="text-shield-muted text-center mb-4">This transaction will:</p>
                        <ul className="space-y-2 text-shield-text">
                            <li className="flex items-start gap-2">
                                <span className="text-shield-success">✅</span>
                                Close {closeableAccounts.length} empty token accounts
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-shield-success">✅</span>
                                Return their locked SOL to your balance
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-shield-success">✅</span>
                                Only close accounts with 0 balance
                            </li>
                        </ul>
                    </div>

                    <div className="rounded-xl border border-shield-border bg-shield-bg p-4 mb-6">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-shield-muted mb-3">
                            Estimate Breakdown
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Total Unlocked:</span>
                                <span className="text-shield-text font-mono">
                                    {formatSOLValue(reclaimEstimate.totalSOL)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Service fee:</span>
                                <span className="text-shield-accent font-mono">
                                    -{formatSOLValue(reclaimEstimate.serviceFeeSOL)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Network fees (est):</span>
                                <span className="text-shield-accent font-mono">
                                    ~{formatSOLValue(reclaimEstimate.networkFeeSOL)}
                                </span>
                            </div>
                            <div className="my-2 border-t border-shield-border/50" />
                            <div className="flex justify-between items-center font-bold">
                                <span className="text-shield-text">You Receive:</span>
                                <span className="text-shield-success font-mono flex items-center gap-1 text-lg">
                                    <Zap className="h-4 w-4" />
                                    ~{formatSOLValue(reclaimEstimate.userReceivesSOL)}
                                    <span className="text-shield-muted font-sans text-xs ml-1 font-normal">
                                        ({estimateUSD(reclaimEstimate.userReceivesSOL)})
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            onClick={clearReclaim}
                            className="flex-1 rounded-xl border border-shield-border bg-transparent px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={executeReclaim}
                            className="flex-1 rounded-xl bg-shield-success px-4 py-3 font-semibold text-white hover:bg-shield-success/90 shadow-lg shadow-shield-success/20 transition-colors flex justify-center items-center gap-2"
                        >
                            <Coins className="h-5 w-5" />
                            Confirm Reclaim
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
