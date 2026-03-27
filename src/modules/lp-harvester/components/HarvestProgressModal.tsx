import { CheckCircle2, ExternalLink, Loader2, X, XCircle } from 'lucide-react';
import type { HarvestResult, HarvestResultItem, LPHarvestStatus } from '../types';
import { formatLPUSD, formatLPSOL } from '../utils/formatting';

interface HarvestProgressModalProps {
    open: boolean;
    status: LPHarvestStatus;
    items: HarvestResultItem[];
    result: HarvestResult | null;
    errorMessage: string | null;
    onClose: () => void;
}

function statusText(status: LPHarvestStatus): string {
    if (status === 'harvesting') return 'Harvesting your LP fees...';
    if (status === 'compounding') return 'Compounding harvested tokens...';
    if (status === 'sending_fee') return 'Sending service fee...';
    if (status === 'complete') return 'Harvest complete';
    if (status === 'error') return 'Harvest failed';
    return 'Processing';
}

export function HarvestProgressModal({
    open,
    status,
    items,
    result,
    errorMessage,
    onClose,
}: HarvestProgressModalProps) {
    if (!open) return null;

    const processing = status === 'harvesting' || status === 'compounding' || status === 'sending_fee';

    const firstSignature = result?.items.find((item) => item.signature)?.signature
        || result?.feeSignature
        || null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-shield-bg/90 backdrop-blur-sm"
                onClick={() => {
                    if (!processing) onClose();
                }}
            />

            <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {!processing && (
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}

                <div className="p-6 sm:p-8">
                    {processing && (
                        <div className="mb-3 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-shield-accent" />
                        </div>
                    )}

                    {status === 'complete' && (
                        <div className="mb-3 flex items-center justify-center">
                            <CheckCircle2 className="h-9 w-9 text-shield-success" />
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="mb-3 flex items-center justify-center">
                            <XCircle className="h-9 w-9 text-shield-danger" />
                        </div>
                    )}

                    <h2 className="text-xl font-bold text-shield-text text-center mb-2">
                        {statusText(status)}
                    </h2>

                    <p className="text-sm text-shield-muted text-center mb-4">
                        {processing
                            ? 'Do not close this window while transactions are in progress.'
                            : 'Review the result summary below.'}
                    </p>

                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {items.map((item) => (
                            <div key={item.positionId} className="rounded-lg border border-shield-border bg-shield-bg/50 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-shield-text truncate">{item.poolName}</span>
                                    <span className={`text-xs uppercase ${item.success ? 'text-shield-success' : 'text-shield-danger'}`}>
                                        {item.success ? 'success' : 'failed'}
                                    </span>
                                </div>
                                <p className="text-xs text-shield-muted mt-1">
                                    {item.success
                                        ? `${formatLPUSD(item.harvestedValueUSD)} harvested`
                                        : item.errorMessage || 'Failed'}
                                </p>
                            </div>
                        ))}
                    </div>

                    {result && status === 'complete' && (
                        <div className="mt-4 rounded-xl border border-shield-border bg-shield-bg/60 p-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Total value:</span>
                                    <span className="text-shield-text font-mono">{formatLPUSD(result.totalValueUSD)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Service fee:</span>
                                    <span className="text-shield-accent font-mono">{formatLPSOL(result.serviceFeeSOL)}</span>
                                </div>
                                <div className="border-t border-shield-border/60 my-2" />
                                <div className="flex justify-between font-semibold">
                                    <span className="text-shield-text">Successful positions:</span>
                                    <span className="text-shield-success">{result.totalHarvested}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <p className="rounded-lg border border-shield-danger/30 bg-shield-danger/10 px-3 py-2 text-sm text-shield-danger mt-4">
                            {errorMessage || 'Harvest failed. No position parameters were modified.'}
                        </p>
                    )}

                    {!processing && (
                        <div className="mt-5 flex flex-col gap-3">
                            {firstSignature && (
                                <a
                                    href={`https://solscan.io/tx/${firstSignature}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 text-sm font-medium text-shield-accent hover:text-white transition-colors"
                                >
                                    View transaction <ExternalLink className="h-4 w-4" />
                                </a>
                            )}
                            <button
                                onClick={onClose}
                                className="w-full rounded-xl border border-shield-border px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
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
