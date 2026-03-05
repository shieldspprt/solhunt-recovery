import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { BurnEstimate, CNFTScanResult } from '../types';

interface BurnConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    estimate: BurnEstimate;
    scanResult: CNFTScanResult;
    selectedSpamCount: number;
    selectedLowValueCount: number;
    selectedOtherCount: number;
}

export function BurnConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    estimate,
    selectedSpamCount,
    selectedLowValueCount,
    selectedOtherCount,
}: BurnConfirmModalProps) {
    const [secondsLeft, setSecondsLeft] = useState(3);
    const canConfirm = secondsLeft <= 0;

    // 3-second delay on confirm button
    useEffect(() => {
        if (!isOpen) {
            setSecondsLeft(3);
            return;
        }

        const interval = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md rounded-2xl border border-shield-danger/30 bg-shield-card shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-shield-muted hover:text-shield-text transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-6">
                    {/* Warning header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-shield-danger/10 flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-shield-danger" />
                        </div>
                        <h2 className="text-lg font-bold text-shield-text">
                            ⚠️ Permanently Delete{' '}
                            {estimate.selectedCount} cNFT
                            {estimate.selectedCount !== 1 ? 's' : ''}
                        </h2>
                    </div>

                    {/* Selection breakdown */}
                    <div className="rounded-lg bg-shield-bg/50 border border-shield-border/30 p-3 mb-4">
                        <p className="text-xs text-shield-muted mb-2 font-medium">
                            You have selected:
                        </p>
                        {selectedSpamCount > 0 && (
                            <p className="text-sm text-shield-text">
                                🚫 Spam: {selectedSpamCount} items
                            </p>
                        )}
                        {selectedLowValueCount > 0 && (
                            <p className="text-sm text-shield-text">
                                ⚠️ Low Value: {selectedLowValueCount} items
                            </p>
                        )}
                        {selectedOtherCount > 0 && (
                            <p className="text-sm text-shield-text">
                                🔍 Other: {selectedOtherCount} items
                            </p>
                        )}
                    </div>

                    {/* Scary warning */}
                    <div className="rounded-lg bg-shield-danger/5 border border-shield-danger/20 p-3 mb-4">
                        <p className="text-sm font-semibold text-shield-danger mb-1">
                            ⛔ THIS CANNOT BE UNDONE
                        </p>
                        <p className="text-xs text-shield-muted">
                            Burned cNFTs are permanently destroyed on-chain.
                            They cannot be recovered.
                        </p>
                    </div>

                    {/* Cost breakdown */}
                    <div className="rounded-lg bg-shield-bg/50 border border-shield-border/30 p-3 mb-6">
                        <p className="text-xs text-shield-muted font-medium mb-2">
                            COST:
                        </p>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-shield-muted">
                                    Session fee:
                                </span>
                                <span className="text-shield-text">
                                    {estimate.sessionFeeSOL} SOL
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">
                                    Network fees:
                                </span>
                                <span className="text-shield-text">
                                    ~{estimate.networkFeeSOL.toFixed(6)} SOL
                                </span>
                            </div>
                            <div className="border-t border-shield-border/30 pt-1 flex justify-between font-medium">
                                <span className="text-shield-muted">Total:</span>
                                <span className="text-shield-text">
                                    {estimate.totalCostSOL.toFixed(6)} SOL
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Large burn warning */}
                    {estimate.selectedCount > 100 && (
                        <div className="rounded-lg bg-shield-warning/10 border border-shield-warning/30 p-3 mb-4">
                            <p className="text-xs text-shield-warning font-medium">
                                ⚠️ You are about to permanently delete{' '}
                                {estimate.selectedCount} cNFTs. Take a moment
                                to review your selection.
                            </p>
                        </div>
                    )}

                    {/* Buttons - Cancel is prominent on the left */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-shield-border bg-shield-bg px-4 py-3 text-sm font-medium text-shield-text hover:bg-shield-border/50 transition-colors"
                        >
                            Cancel — Keep My cNFTs
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={!canConfirm}
                            className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all ${canConfirm
                                    ? 'bg-shield-danger text-white hover:bg-shield-danger/90 cursor-pointer'
                                    : 'bg-shield-danger/30 text-shield-danger/50 cursor-not-allowed'
                                }`}
                        >
                            {canConfirm
                                ? `Yes, Permanently Delete ${estimate.selectedCount}`
                                : `Wait ${secondsLeft}s...`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
