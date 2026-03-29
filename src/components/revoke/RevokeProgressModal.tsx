import { useCallback } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { useRevoke } from '@/hooks/useRevoke';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SOLSCAN_TX_URL } from '@/config/constants';
import { CheckCircle2, XCircle, ExternalLink, RefreshCw, X } from 'lucide-react';
import type { TokenDelegation } from '@/types';

interface RevokeProgressModalProps {
    delegations: TokenDelegation[];
}

export function RevokeProgressModal({ delegations }: RevokeProgressModalProps) {
    const { revokeStatus, revokeResult, revokeError, clearRevoke } = useAppStore();
    const { revoke } = useRevoke();

    // Hide if not in active revoking flow or completed/error state
    if (
        revokeStatus === 'idle' ||
        revokeStatus === 'awaiting_confirmation'
    ) {
        return null;
    }

    // Prevent closing during transaction processing
    const isProcessing = ['building_transaction', 'awaiting_signature', 'confirming'].includes(revokeStatus);

    const handleClose = useCallback(() => {
        if (!isProcessing) {
            clearRevoke();
        }
    }, [isProcessing, clearRevoke]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-shield-bg/90 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {!isProcessing && (
                    <button
                        onClick={handleClose}
                        className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}

                <div className="p-6 sm:p-8 text-center min-h-[300px] flex flex-col items-center justify-center">

                    {/* Active Processing States */}
                    {revokeStatus === 'building_transaction' && (
                        <>
                            <LoadingSpinner size="lg" className="mb-6" />
                            <h2 className="text-xl font-bold text-shield-text mb-2">Building Transaction</h2>
                            <p className="text-shield-muted text-sm">Preparing to revoke {delegations.length} permissions...</p>
                        </>
                    )}

                    {revokeStatus === 'awaiting_signature' && (
                        <>
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-shield-accent/20 rounded-full animate-ping" />
                                <LoadingSpinner size="lg" />
                            </div>
                            <h2 className="text-xl font-bold text-shield-text mb-2">Waiting for Signature</h2>
                            <p className="text-shield-muted text-sm px-4">
                                Please check your wallet extension and approve the transaction.
                            </p>
                        </>
                    )}

                    {revokeStatus === 'confirming' && (
                        <>
                            <LoadingSpinner size="lg" className="mb-6" />
                            <h2 className="text-xl font-bold text-shield-text mb-2">Confirming on Solana</h2>
                            <p className="text-shield-muted text-sm">This usually takes a few seconds...</p>
                        </>
                    )}

                    {/* Success State */}
                    {revokeStatus === 'complete' && revokeResult?.success && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-shield-success/10">
                                <CheckCircle2 className="h-12 w-12 text-shield-success" />
                            </div>
                            <h2 className="text-2xl font-bold text-shield-text mb-2">Protected!</h2>
                            <p className="text-shield-muted mb-6">
                                Successfully revoked {revokeResult.revokedCount} permission(s).
                            </p>

                            <div className="space-y-3">
                                {revokeResult.signature && (
                                    <a
                                        href={SOLSCAN_TX_URL(revokeResult.signature)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm font-medium text-shield-accent hover:text-white transition-colors"
                                    >
                                        View on Solscan <ExternalLink className="h-4 w-4" />
                                    </a>
                                )}

                                <button
                                    onClick={clearRevoke}
                                    className="w-full rounded-xl bg-shield-card border border-shield-border px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors mt-4"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {revokeStatus === 'error' && revokeError && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500 w-full">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-danger/10">
                                <XCircle className="h-8 w-8 text-shield-danger" />
                            </div>
                            <h2 className="text-xl font-bold text-shield-text mb-2">Revocation Failed</h2>

                            <div className="rounded-lg bg-shield-danger/10 border border-shield-danger/20 p-4 mb-6 mt-4 text-left">
                                <p className="text-sm font-medium text-shield-danger mb-1">{revokeError.message}</p>
                                <p className="text-xs text-shield-danger/70 font-mono break-all line-clamp-2">
                                    Code: {revokeError.code}
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={clearRevoke}
                                    className="flex-1 rounded-xl border border-shield-border bg-transparent px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => revoke(delegations)}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Try Again
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
