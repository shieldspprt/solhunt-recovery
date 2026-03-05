import { CheckCircle2, XCircle, Loader2, ExternalLink, X } from 'lucide-react';
import { MAX_BURNS_PER_TX } from '../constants';
import type { BurnResult, BurnResultItem } from '../types';

interface BurnProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRetryFailed?: () => void;
    burnStatus: 'burning' | 'complete' | 'error';
    currentProgressText: string;
    completedItems: BurnResultItem[];
    burnResult: BurnResult | null;
    totalBatches: number;
}

export function BurnProgressModal({
    isOpen,
    onClose,
    onRetryFailed,
    burnStatus,
    currentProgressText,
    completedItems,
    burnResult,
    totalBatches,
}: BurnProgressModalProps) {
    if (!isOpen) return null;

    const isDone = burnStatus === 'complete' || burnStatus === 'error';

    // Group completed items into batches for display
    const batchStatuses: Array<{
        index: number;
        items: BurnResultItem[];
        allSuccess: boolean;
        signature: string | null;
    }> = [];

    for (let i = 0; i < totalBatches; i++) {
        const start = i * MAX_BURNS_PER_TX;
        const end = start + MAX_BURNS_PER_TX;
        const batchItems = completedItems.slice(start, end);
        const allSuccess =
            batchItems.length > 0 && batchItems.every((item) => item.success);
        batchStatuses.push({
            index: i,
            items: batchItems,
            allSuccess,
            signature: batchItems.find((b) => b.signature)?.signature ?? null,
        });
    }

    const currentBatchIndex = batchStatuses.findIndex(
        (b) => b.items.length === 0
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div className="relative w-full max-w-md rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                {isDone && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-shield-muted hover:text-shield-text transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}

                <div className="p-6">
                    {/* Header */}
                    {!isDone && (
                        <div className="flex items-center gap-3 mb-4">
                            <Loader2 className="h-5 w-5 text-shield-accent animate-spin" />
                            <h2 className="text-lg font-bold text-shield-text">
                                🗑️ Burning spam cNFTs...
                            </h2>
                        </div>
                    )}

                    {burnResult && burnResult.failedCount === 0 && (
                        <div className="flex items-center gap-3 mb-4">
                            <CheckCircle2 className="h-6 w-6 text-shield-success" />
                            <div>
                                <h2 className="text-lg font-bold text-shield-text">
                                    ✅ Done — Wallet Cleaned
                                </h2>
                                <p className="text-sm text-shield-muted">
                                    Permanently deleted {burnResult.burnedCount}{' '}
                                    spam cNFT
                                    {burnResult.burnedCount !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                    )}

                    {burnResult &&
                        burnResult.failedCount > 0 &&
                        burnResult.burnedCount > 0 && (
                            <div className="flex items-center gap-3 mb-4">
                                <XCircle className="h-6 w-6 text-shield-warning" />
                                <div>
                                    <h2 className="text-lg font-bold text-shield-text">
                                        ⚠️ Partial Success
                                    </h2>
                                    <p className="text-sm text-shield-muted">
                                        ✅ Deleted:{' '}
                                        {burnResult.burnedCount} cNFTs · ❌
                                        Failed: {burnResult.failedCount}
                                    </p>
                                </div>
                            </div>
                        )}

                    {burnStatus === 'error' &&
                        (!burnResult || burnResult.burnedCount === 0) && (
                            <div className="flex items-center gap-3 mb-4">
                                <XCircle className="h-6 w-6 text-shield-danger" />
                                <h2 className="text-lg font-bold text-shield-text">
                                    ❌ Burn Failed
                                </h2>
                            </div>
                        )}

                    {/* Batch progress */}
                    <div className="space-y-2 mb-4">
                        {batchStatuses.map((batch) => (
                            <div
                                key={batch.index}
                                className="flex items-center gap-3 rounded-lg bg-shield-bg/50 border border-shield-border/30 px-3 py-2"
                            >
                                {batch.items.length > 0 ? (
                                    batch.allSuccess ? (
                                        <CheckCircle2 className="h-4 w-4 text-shield-success flex-shrink-0" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-shield-danger flex-shrink-0" />
                                    )
                                ) : batch.index === currentBatchIndex &&
                                    !isDone ? (
                                    <Loader2 className="h-4 w-4 text-shield-accent animate-spin flex-shrink-0" />
                                ) : (
                                    <div className="h-4 w-4 rounded-full border border-shield-border/50 flex-shrink-0" />
                                )}

                                <span className="text-sm text-shield-text flex-1">
                                    Batch {batch.index + 1}/{totalBatches}
                                    {batch.items.length > 0 &&
                                        `: ${batch.allSuccess
                                            ? `${batch.items.length} burned`
                                            : 'failed'
                                        }`}
                                    {batch.index === currentBatchIndex &&
                                        !isDone &&
                                        batch.items.length === 0 &&
                                        ' — awaiting signature'}
                                </span>

                                {batch.signature && (
                                    <a
                                        href={`https://solscan.io/tx/${batch.signature}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-shield-accent hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Progress text */}
                    {!isDone && (
                        <p className="text-xs text-shield-muted text-center mb-4">
                            {currentProgressText || 'Processing...'}
                            <br />
                            Do not close this window.
                        </p>
                    )}

                    {/* Action buttons */}
                    {isDone && (
                        <div className="flex gap-3">
                            {burnResult &&
                                burnResult.failedCount > 0 &&
                                onRetryFailed && (
                                    <button
                                        onClick={onRetryFailed}
                                        className="flex-1 rounded-xl border border-shield-border bg-shield-bg px-4 py-3 text-sm font-medium text-shield-text hover:bg-shield-border/50 transition-colors"
                                    >
                                        Retry Failed
                                    </button>
                                )}
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-xl bg-shield-accent px-4 py-3 text-sm font-medium text-white hover:bg-shield-accent/90 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
