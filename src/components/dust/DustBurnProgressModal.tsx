import { CheckCircle2, ExternalLink, Flame, RefreshCw, X, XCircle } from 'lucide-react';
import { useAppStore } from '@/hooks/useAppStore';
import { useDustBurnReclaim } from '@/hooks/useDustBurnReclaim';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SOLSCAN_TX_URL } from '@/config/constants';
import { formatSOLValue } from '@/lib/formatting';

export function DustBurnProgressModal() {
    const {
        dustBurnStatus,
        dustBurnResult,
        dustBurnProgress,
        dustBurnError,
    } = useAppStore();
    const {
        executeBurnReclaim,
        cancelBurnReclaim,
        clearDustBurn,
    } = useDustBurnReclaim();

    if (dustBurnStatus === 'idle' || dustBurnStatus === 'awaiting_confirmation') {
        return null;
    }

    const isProcessing = dustBurnStatus === 'burning';

    const handleClose = () => {
        if (!isProcessing) {
            clearDustBurn();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-shield-bg/90 backdrop-blur-sm"
                onClick={handleClose}
            />

            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {!isProcessing && (
                    <button
                        onClick={handleClose}
                        className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}

                <div className="p-6 sm:p-8 min-h-[330px]">
                    {dustBurnStatus === 'burning' && (
                        <>
                            <div className="flex items-center justify-center mb-4">
                                <LoadingSpinner size="md" />
                            </div>
                            <h2 className="text-xl font-bold text-shield-text text-center mb-2">
                                Burning Dust & Closing Accounts
                            </h2>
                            <p className="text-sm text-shield-muted text-center mb-5">
                                Do not close this window while transactions are running.
                            </p>

                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {dustBurnProgress.map((item) => (
                                    <div
                                        key={item.mint}
                                        className="rounded-lg border border-shield-border bg-shield-bg/50 p-3"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-shield-text">{item.tokenSymbol}</span>
                                            <span className="text-xs text-shield-muted uppercase">{item.status}</span>
                                        </div>
                                        <p className="text-xs text-shield-muted mt-1">{item.message}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {dustBurnStatus === 'complete' && dustBurnResult && (
                        <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-shield-success/10 border border-shield-success/20">
                                <CheckCircle2 className="h-12 w-12 text-shield-success" />
                            </div>
                            <h2 className="text-2xl font-bold text-shield-text mb-2">
                                Burn & Reclaim Complete
                            </h2>
                            <p className="text-shield-muted mb-3">
                                Processed {dustBurnResult.burnedCount} account{dustBurnResult.burnedCount === 1 ? '' : 's'} and reclaimed
                                {' '}~{formatSOLValue(dustBurnResult.reclaimedSOL)}.
                            </p>

                            {dustBurnResult.failedCount > 0 && (
                                <p className="text-sm text-shield-warning mb-4">
                                    {dustBurnResult.failedCount} account{dustBurnResult.failedCount === 1 ? '' : 's'} failed.
                                </p>
                            )}
                            {dustBurnResult.errorMessage && (
                                <p className="text-sm text-shield-warning mb-4">
                                    {dustBurnResult.errorMessage}
                                </p>
                            )}

                            {dustBurnResult.signatures.length > 0 && (
                                <a
                                    href={SOLSCAN_TX_URL(dustBurnResult.signatures[0])}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-medium text-shield-accent hover:text-white transition-colors"
                                >
                                    View first transaction <ExternalLink className="h-4 w-4" />
                                </a>
                            )}

                            <button
                                onClick={clearDustBurn}
                                className="mt-5 w-full rounded-xl bg-shield-card border border-shield-border px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    )}

                    {dustBurnStatus === 'error' && dustBurnError && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-danger/10">
                                <XCircle className="h-8 w-8 text-shield-danger" />
                            </div>
                            <h2 className="text-xl font-bold text-shield-text text-center mb-2">
                                Burn & Reclaim Failed
                            </h2>

                            <div className="rounded-lg bg-shield-danger/10 border border-shield-danger/20 p-4 mb-6 mt-4">
                                <p className="text-sm font-medium text-shield-danger mb-1">{dustBurnError.message}</p>
                                <p className="text-xs text-shield-danger/70 font-mono break-all">
                                    Code: {dustBurnError.code}
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={cancelBurnReclaim}
                                    className="flex-1 rounded-xl border border-shield-border bg-transparent px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeBurnReclaim}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Try Again
                                </button>
                            </div>
                        </div>
                    )}

                    {!isProcessing && dustBurnStatus === 'error' && !dustBurnError && (
                        <div className="text-center text-shield-muted py-10">
                            <Flame className="h-8 w-8 mx-auto mb-2" />
                            Unknown burn/reclaim error.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
