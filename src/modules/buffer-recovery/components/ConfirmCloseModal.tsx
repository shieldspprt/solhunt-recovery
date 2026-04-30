import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatSOL } from '@/lib/formatting';
import type { BufferCloseEstimate } from '../types';

interface ConfirmCloseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isClosing: boolean;
    /** Pre-computed estimate from estimateBufferClose(). Preferred over manual count/sum. */
    estimate: BufferCloseEstimate;
}

export function ConfirmCloseModal({
    isOpen,
    onClose,
    onConfirm,
    isClosing,
    estimate,
}: ConfirmCloseModalProps) {
    if (!isOpen) return null;

    const { selectedCount, totalSOL, serviceFeeSOL, userReceivesSOL } = estimate;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-shield-border/50 shadow-2xl animate-scale-in">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-shield-warning/10 border border-shield-warning/20 mb-4 mx-auto">
                    <AlertTriangle className="h-6 w-6 text-shield-warning" />
                </div>

                <h2 className="text-xl font-bold text-center text-shield-text mb-2">Destructive Action</h2>
                <p className="text-center text-shield-muted text-sm mb-6 leading-relaxed">
                    You are about to close <strong>{selectedCount} program buffer{selectedCount === 1 ? '' : 's'}</strong>.
                    This will permanently destroy the stored bytecode.
                </p>

                <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                        <span className="text-shield-muted">Total Recoverable</span>
                        <span className="text-shield-text font-medium">{formatSOL(totalSOL)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-shield-muted">Service Fee (10%)</span>
                        <span className="text-shield-text font-medium">− {formatSOL(serviceFeeSOL)}</span>
                    </div>
                    <div className="border-t border-shield-border/50 pt-3 flex justify-between">
                        <span className="text-shield-muted font-medium">You Receive</span>
                        <span className="text-shield-accent font-bold">{formatSOL(userReceivesSOL)}</span>
                    </div>
                </div>

                <div className="bg-shield-warning/5 rounded-xl border border-shield-warning/20 p-4 mb-6">
                    <p className="text-xs text-shield-warning font-medium leading-relaxed">
                        ⚠️ Only close buffers from deployments that are fully complete or abandoned.
                        If you are mid-deployment and close an active buffer, your deployment will fail.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isClosing}
                        aria-label="Cancel and close modal"
                        className="flex-1 px-4 py-3 rounded-xl border border-shield-border font-semibold text-shield-muted hover:text-shield-text hover:bg-shield-card transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isClosing}
                        aria-label={isClosing ? 'Closing buffers, please wait' : 'Confirm and close selected buffers'}
                        className="flex-1 px-4 py-3 rounded-xl bg-shield-danger font-semibold text-white hover:bg-shield-danger/90 transition-all shadow-lg shadow-shield-danger/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isClosing && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isClosing ? 'Closing...' : 'Close Buffers'}
                    </button>
                </div>
            </div>
        </div>
    );
}
