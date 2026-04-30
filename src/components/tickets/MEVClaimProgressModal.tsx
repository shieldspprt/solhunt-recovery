import { memo } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';
import { useMEVClaims } from '@/hooks/useMEVClaims';
import { useAppStore } from '@/hooks/useAppStore';
import { SOLSCAN_TX_URL, MEV_SERVICE_FEE_PERCENT } from '@/config/constants';
import { estimateUSD, formatSOLValue, shortenAddress } from '@/lib/formatting';

function ProgressIcon({ status }: { status: string }) {
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-shield-success" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-shield-danger" />;
    if (status === 'pending') return <Clock3 className="h-4 w-4 text-shield-muted" />;
    return <Loader2 className="h-4 w-4 text-shield-accent animate-spin" />;
}

export const MEVClaimProgressModal = memo(() => {
    const {
        mevClaimStatus,
        mevClaimResult,
        cancelClaim,
    } = useMEVClaims();

    const mevClaimError = useAppStore((s) => s.mevClaimError);
    const mevProgressText = useAppStore((s) => s.mevProgressText);

    if (mevClaimStatus === 'idle' || mevClaimStatus === 'awaiting_confirmation') return null;

    const isComplete = mevClaimStatus === 'complete';
    const isError = mevClaimStatus === 'error';

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-shield-bg/85 backdrop-blur-sm" />

            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 sm:p-8">
                    {!isComplete && !isError && (
                        <>
                            <h2 className="text-xl font-bold text-shield-text mb-2">Claiming MEV Rewards...</h2>
                            <p className="text-sm text-shield-muted mb-4">{mevProgressText || 'Do not close this window.'}</p>
                        </>
                    )}

                    {isComplete && mevClaimResult && (
                        <>
                            <h2 className="text-xl font-bold text-shield-success mb-4">
                                {mevClaimResult.failedCount === 0 ? 'All rewards claimed' : 'Partial success'}
                            </h2>
                            <div className="rounded-xl border border-shield-border bg-shield-bg p-4 mb-4">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-shield-muted">Claimed SOL:</span>
                                        <span className="font-mono text-shield-text">{formatSOLValue(mevClaimResult.totalClaimedSOL)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-shield-muted">Service fee ({MEV_SERVICE_FEE_PERCENT}%):</span>
                                        <span className="font-mono text-shield-accent">{formatSOLValue(mevClaimResult.totalClaimedSOL * (MEV_SERVICE_FEE_PERCENT / 100))}</span>
                                    </div>
                                    <div className="flex justify-between font-semibold">
                                        <span className="text-shield-text">Net to you:</span>
                                        <span className="font-mono text-shield-success">
                                            ~{formatSOLValue(mevClaimResult.totalClaimedSOL * (1 - MEV_SERVICE_FEE_PERCENT / 100))}
                                            {' '}({estimateUSD(mevClaimResult.totalClaimedSOL * (1 - MEV_SERVICE_FEE_PERCENT / 100))})
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {isError && mevClaimError && (
                        <div className="rounded-xl border border-shield-danger/30 bg-shield-danger/10 p-4 mb-4">
                            <p className="text-sm text-shield-danger font-medium flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                {mevClaimError.message}
                            </p>
                        </div>
                    )}

                    {mevClaimResult && (
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                            {mevClaimResult.items.map((item) => (
                                <div
                                    key={`${item.stakeAccount}-${item.epoch}`}
                                    className="rounded-lg border border-shield-border/70 bg-shield-bg/40 p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-shield-text">
                                                Epoch {item.epoch}
                                            </p>
                                            <p className="text-xs text-shield-muted">
                                                Stake: {shortenAddress(item.stakeAccount, 6)}
                                            </p>
                                            {item.errorMessage && (
                                                <p className="text-xs text-shield-danger mt-1">{item.errorMessage}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.signature && (
                                                <a
                                                    href={SOLSCAN_TX_URL(item.signature)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-shield-accent hover:underline"
                                                >
                                                    View
                                                </a>
                                            )}
                                            <ProgressIcon status={item.success ? 'success' : 'failed'} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {(isComplete || isError) && (
                        <button
                            type="button"
                            onClick={cancelClaim}
                            aria-label="Close the MEV claim progress modal"
                            className="mt-5 w-full rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});
