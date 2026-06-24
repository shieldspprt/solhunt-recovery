import { useId } from 'react';
import { X } from 'lucide-react';
import {
    HARVEST_COMPOUND_FEE_PERCENT,
    HARVEST_FEE_PERCENT,
    LARGE_HARVEST_WARNING_USD,
} from '../constants';
import type { HarvestEstimate, LPPosition } from '../types';
import { formatLPUSD, formatLPSOL } from '../utils/formatting';
import { useCallback, useEffect, useRef } from 'react';

interface HarvestConfirmModalProps {
    open: boolean;
    positions: LPPosition[];
    estimate: HarvestEstimate | null;
    willCompound: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export function HarvestConfirmModal({
    open,
    positions,
    estimate,
    willCompound,
    onCancel,
    onConfirm,
}: HarvestConfirmModalProps) {
    if (!open || !estimate) return null;

    const titleId = useId();
    const previewPositions = positions.slice(0, 8);
    const hiddenCount = Math.max(positions.length - previewPositions.length, 0);

    // Focus management refs
    const modalRef = useRef<HTMLDivElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    // Escape key handler
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
    }, [onCancel]);

    // Tab key trap handler
    const handleTabKey = useCallback((e: KeyboardEvent, first: HTMLElement | undefined, last: HTMLElement | undefined) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    }, []);

    // Global escape listener + focus management on mount/unmount
    useEffect(() => {
        previousActiveElement.current = document.activeElement as HTMLElement;
        document.addEventListener('keydown', handleEscape);
        const cancelBtn = cancelButtonRef.current;
        const timer = setTimeout(() => cancelBtn?.focus(), 0);
        return () => {
            document.removeEventListener('keydown', handleEscape);
            previousActiveElement.current?.focus();
            clearTimeout(timer);
        };
    }, [handleEscape]);

    // Modal-local tab trap
    useEffect(() => {
        const modal = modalRef.current;
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const handler = (e: KeyboardEvent) => handleTabKey(e, first, last);
        modal.addEventListener('keydown', handler);
        return () => modal.removeEventListener('keydown', handler);
    }, [handleTabKey]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-shield-bg/85 backdrop-blur-sm"
                onClick={onCancel}
                aria-hidden="true"
            />

            <div
                ref={modalRef}
                className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <button
                    ref={cancelButtonRef}
                    type="button"
                    onClick={onCancel}
                    aria-label="Close LP harvest confirmation modal"
                    className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="p-6 sm:p-8">
                    <h2 id={titleId} className="text-xl font-bold text-shield-text mb-2">
                        Confirm LP Harvest
                    </h2>
                    <p className="text-sm text-shield-muted mb-4">
                        You are about to harvest fees from {estimate.selectedPositions} position{estimate.selectedPositions === 1 ? '' : 's'}.
                    </p>

                    <div className="rounded-xl border border-shield-border bg-shield-bg/60 p-4 mb-4">
                        <p className="text-xs uppercase tracking-wide text-shield-muted mb-2">Positions</p>
                        <div className="space-y-1">
                            {previewPositions.map((position) => (
                                <div key={position.id} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="text-shield-text truncate">
                                        {position.poolName} ({position.protocolDisplayName})
                                    </span>
                                    <span className="text-shield-muted font-mono">{formatLPUSD(position.totalFeeValueUSD)}</span>
                                </div>
                            ))}
                            {hiddenCount > 0 && (
                                <p className="text-xs text-shield-muted mt-2">+{hiddenCount} more positions</p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-shield-border bg-shield-bg/60 p-4 mb-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Total fees:</span>
                                <span className="text-shield-text font-mono">{formatLPUSD(estimate.totalFeeValueUSD)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">
                                    Service fee ({willCompound ? HARVEST_COMPOUND_FEE_PERCENT : HARVEST_FEE_PERCENT}%):
                                </span>
                                <span className="text-shield-accent font-mono">-{formatLPSOL(estimate.serviceFeeSOL)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Network fees (est):</span>
                                <span className="text-shield-muted font-mono">{formatLPSOL(estimate.networkFeeSOL)}</span>
                            </div>
                            <div className="border-t border-shield-border/60 my-2" />
                            <div className="flex justify-between font-semibold">
                                <span className="text-shield-text">You receive (est):</span>
                                <span className="text-shield-success font-mono">{formatLPUSD(estimate.userReceivesValueUSD)}</span>
                            </div>
                        </div>
                    </div>

                    {estimate.totalFeeValueUSD > LARGE_HARVEST_WARNING_USD && (
                        <p className="rounded-lg border border-shield-warning/30 bg-shield-warning/10 px-3 py-2 text-xs text-shield-warning mb-4">
                            Large harvest detected (over $500). Verify selected positions before continuing.
                        </p>
                    )}

                    <p className="text-xs text-shield-muted mb-5">
                        {willCompound
                            ? 'Harvested fees will be reinvested into eligible in-range positions.'
                            : 'Harvested fees are sent to your wallet in the original tokens.'}
                    </p>

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            aria-label="Cancel harvest"
                            className="flex-1 rounded-xl border border-shield-border px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            aria-label="Confirm harvest fees"
                            className="flex-1 rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                        >
                            Harvest Fees
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
