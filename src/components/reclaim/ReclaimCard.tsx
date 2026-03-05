import { useReclaimRent } from '@/hooks/useReclaimRent';
import { RENT_RECLAIM_MIN_ACCOUNTS } from '@/config/constants';
import { formatSOLValue } from '@/lib/formatting';
import { Coins, ArrowRight, Zap } from 'lucide-react';

export function ReclaimCard() {
    const {
        closeableAccounts,
        reclaimEstimate,
        initiateReclaim,
    } = useReclaimRent();

    // If we don't meet the minimum threshold, show nothing. Don't clutter the UI.
    if (closeableAccounts.length < RENT_RECLAIM_MIN_ACCOUNTS) {
        return null;
    }

    return (
        <div className="rounded-auth border border-shield-border bg-shield-card p-6 shadow-xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-success/10 border border-shield-success/20">
                    <Coins className="h-5 w-5 text-shield-success" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-shield-text">Locked SOL Found</h2>
                    <p className="text-sm text-shield-muted">
                        You have {closeableAccounts.length} empty token accounts with SOL locked inside for rent.
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-shield-border/50 bg-shield-bg/50 p-4 mb-6">
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-shield-muted">Estimated recovery:</span>
                        <span className="text-shield-text font-mono">{formatSOLValue(reclaimEstimate?.totalSOL || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <span className="text-shield-muted">Service fee:</span>
                        <span className="text-shield-accent font-mono">-{formatSOLValue(reclaimEstimate?.serviceFeeSOL || 0)}</span>
                    </div>

                    <div className="h-px w-full bg-shield-border" />

                    <div className="flex justify-between items-center">
                        <span className="text-shield-text font-medium">You receive:</span>
                        <span className="text-shield-success font-bold font-mono text-lg flex items-center gap-1.5">
                            <Zap className="h-4 w-4" />
                            {formatSOLValue(reclaimEstimate?.userReceivesSOL || 0)}
                        </span>
                    </div>
                </div>
            </div>

            <button
                onClick={initiateReclaim}
                className="w-full relative overflow-hidden group rounded-xl bg-shield-success/10 border border-shield-success/30 px-4 py-3.5 text-shield-success font-semibold shadow-lg shadow-shield-success/5 transition-all duration-200 hover:bg-shield-success/20 hover:border-shield-success/50"
            >
                <div className="relative z-10 hidden sm:flex items-center justify-center gap-2">
                    Reclaim My SOL
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="relative z-10 flex sm:hidden items-center justify-center gap-2">
                    Reclaim SOL
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
            </button>

            <p className="mt-4 text-xs text-center text-shield-muted px-4">
                Note: This closes empty accounts only. Accounts with token balances are not affected.
            </p>
        </div>
    );
}
