import { DecommissionRecoveryEstimate, DecommissionRecoveryResult, DecommissionRecoveryStatus } from '../types';

interface Props {
    status: DecommissionRecoveryStatus;
    estimate: DecommissionRecoveryEstimate | null;
    result: DecommissionRecoveryResult | null;
    error: string | null;
    executeRecovery: () => void;
    cancelRecovery: () => void;
}

export function RecoveryModal({ status, estimate, result, error, executeRecovery, cancelRecovery }: Props) {
    const isAwaiting = status === 'awaiting_confirmation';
    const isRecovering = status === 'recovering';
    const isComplete = status === 'complete';
    const isError = status === 'error';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-modal-title"
        >
            <div className="w-full max-w-lg rounded-2xl bg-shield-bg border border-shield-border/50 shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-shield-accent/10 to-transparent opacity-20 pointer-events-none" />

                <div className="p-6 sm:p-8 relative z-10">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6 border-b border-shield-border/30 pb-4">
                        <span className="text-3xl">
                            {isAwaiting && '🪦'}
                            {isRecovering && '⏳'}
                            {isComplete && '✅'}
                            {isError && '❌'}
                        </span>
                        <h2 id="recovery-modal-title" className="text-xl font-bold text-shield-text tracking-tight uppercase">
                            {isAwaiting && 'Recover Stranded Positions'}
                            {isRecovering && 'Processing Recovery...'}
                            {isComplete && 'Recovery Complete!'}
                            {isError && 'Recovery Failed'}
                        </h2>
                    </div>

                    {/* Body */}
                    <div className="space-y-6">
                        {isAwaiting && estimate && (
                            <>
                                <p className="text-shield-muted leading-relaxed">
                                    You are about to recover assets from decommissioned protocols. They will return directly to your wallet.
                                </p>

                                <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-3">
                                    {estimate.inAppItems.length > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-emerald-400">In-app recoveries ({estimate.inAppItems.length}):</span>
                                            <span className="font-mono text-shield-text">
                                                {estimate.totalValueUSD ? `~$${estimate.totalValueUSD.toFixed(2)}` : 'Unknown'}
                                            </span>
                                        </div>
                                    )}
                                    {estimate.redirectItems.length > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-blue-400">Manual redirects ({estimate.redirectItems.length}):</span>
                                            <span className="font-mono text-shield-text">Site will open</span>
                                        </div>
                                    )}
                                </div>

                                {estimate.inAppItems.length > 0 && (
                                    <div className="bg-shield-accent/5 rounded-xl border border-shield-accent/20 p-4 space-y-2 text-sm text-shield-text font-mono">
                                        <div className="flex justify-between">
                                            <span>Estimated value:</span>
                                            <span>{estimate.totalValueUSD ? `~$${estimate.totalValueUSD.toFixed(2)}` : 'Unknown'}</span>
                                        </div>
                                        {estimate.serviceFeeUSD !== null && (
                                            <div className="flex justify-between text-shield-muted">
                                                <span>Service fee ({estimate.serviceFeePercent}%):</span>
                                                <span>~${estimate.serviceFeeUSD.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-bold text-lg text-shield-accent pt-2 border-t border-shield-border/30 mt-2">
                                            <span>You receive:</span>
                                            <span>{estimate.netValueUSD ? `~$${estimate.netValueUSD.toFixed(2)}` : 'Unknown'}</span>
                                        </div>
                                    </div>
                                )}

                                {estimate.redirectItems.length > 0 && (
                                    <p className="text-xs text-blue-400 pointer-events-none text-center">
                                        Note: Links will open in a new tab for manual recovery.
                                    </p>
                                )}
                            </>
                        )}

                        {isRecovering && (
                            <div className="flex flex-col items-center justify-center py-10 space-y-6">
                                <div className="w-16 h-16 rounded-full border-4 border-shield-border/50 border-t-shield-accent animate-spin" />
                                <p className="text-shield-muted text-center max-w-xs leading-relaxed animate-pulse">
                                    Please approve the transactions in your wallet. Do not close this window.
                                </p>
                            </div>
                        )}

                        {isComplete && result && (
                            <div className="space-y-6">
                                <p className="text-shield-muted text-center">
                                    Your assets have been recovered successfully!
                                </p>
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                                    <h3 className="text-3xl font-bold font-mono text-emerald-400 mb-1">
                                        {result.totalRecoveredUSD ? `+$${result.totalRecoveredUSD.toFixed(2)}` : `${result.recoveredCount} Pos.`}
                                    </h3>
                                    <span className="text-sm text-emerald-500/80 uppercase tracking-widest font-semibold">Net Received</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                                        <span className="block text-emerald-400 font-bold">{result.recoveredCount}</span>
                                        <span className="text-shield-muted">Recovered</span>
                                    </div>
                                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                                        <span className="block text-blue-400 font-bold">{result.redirectCount}</span>
                                        <span className="text-shield-muted">Redirected</span>
                                    </div>
                                    <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                                        <span className="block text-red-500 font-bold">{result.failedCount}</span>
                                        <span className="text-shield-muted">Failed</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isError && (
                            <p className="text-shield-muted text-center py-6">
                                {error || "An unexpected error occurred during recovery. No assets were moved without your approval."}
                            </p>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-8 flex gap-3 pt-6 border-t border-shield-border/30">
                        {isAwaiting && (
                            <>
                                <button
                                    onClick={cancelRecovery}
                                    aria-label="Cancel recovery"
                                    className="flex-1 rounded-xl bg-shield-bg border border-shield-border/50 px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/20 transition-all font-mono"
                                >
                                    [Cancel]
                                </button>
                                <button
                                    onClick={executeRecovery}
                                    aria-label="Execute recovery"
                                    className="flex-[2] rounded-xl bg-shield-accent px-4 py-3 font-bold text-shield-bg hover:bg-shield-highlight transition-all font-mono shadow-md shadow-shield-accent/20"
                                >
                                    [Recover →]
                                </button>
                            </>
                        )}
                        {(isComplete || isError) && (
                            <button
                                onClick={cancelRecovery}
                                aria-label="Close modal"
                                className="w-full rounded-xl bg-shield-accent/10 border border-shield-accent/20 px-4 py-3 font-bold text-shield-accent hover:bg-shield-accent hover:text-shield-bg transition-all font-mono"
                            >
                                [Close]
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
