import { useState, useMemo, memo } from 'react';
import { useBufferRecovery } from '../hooks/useBufferRecovery';
import { BufferRow } from './BufferRow';
import { ConfirmCloseModal } from './ConfirmCloseModal';
import { Search, Code2, TrendingUp, Info } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { estimateBufferClose } from '../lib/bufferCloser';

export const BufferRecoveryCard = memo(function BufferRecoveryCard() {
    const {
        isScanning,
        isClosing,
        bufferScanResult,
        bufferScanError,
        selectedBufferAddresses,
        runScan,
        performClose,
        toggleBufferSelection,
        selectAllBuffers,
        deselectAllBuffers,
        clearBuffers
    } = useBufferRecovery();

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    const closeEstimate = useMemo(() => {
        if (!bufferScanResult) return null;
        const selectedBuffers = bufferScanResult.closeableBuffers.filter(
            b => selectedBufferAddresses.includes(b.address)
        );
        return estimateBufferClose(selectedBuffers);
    }, [bufferScanResult, selectedBufferAddresses]);

    const handleInitialScan = () => {
        runScan();
    };

    const handleConfirmClose = async () => {
        await performClose();
        setIsConfirmModalOpen(false);
    };

    if (!bufferScanResult && !isScanning) {
        return (
            <div className="mx-auto w-full max-w-4xl">
                <div className="glass-card rounded-2xl p-8 text-center border border-shield-border/30">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-shield-accent/10 border border-shield-accent/20 mb-6 mx-auto">
                        <Code2 className="h-8 w-8 text-shield-accent" />
                    </div>
                    <h2 className="text-2xl font-bold text-shield-text mb-3">Scan for Forgotten Buffers</h2>
                    <p className="text-shield-muted mb-8 max-w-lg mx-auto leading-relaxed">
                        Every program deployment creates a temporary buffer account holding 1–5 SOL in rent.
                        If your deployment failed or you iterated quickly, these SOL are still sitting on-chain.
                    </p>
                    <button
                        onClick={handleInitialScan}
                        data-agent-target="scan-buffers-btn"
                        className="inline-flex items-center gap-2 rounded-xl bg-shield-accent hover:bg-shield-accent/90 text-white font-bold px-8 py-4 text-lg shadow-lg shadow-shield-accent/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Search className="h-5 w-5" />
                        Scan Wallet for Buffers
                    </button>
                    <p className="mt-4 text-xs text-shield-muted">
                        Checks BPFLoaderUpgradeable · Takes ~5 seconds
                    </p>
                </div>
            </div>
        );
    }

    if (isScanning) {
        return (
            <div className="glass-card rounded-2xl p-12 text-center border border-shield-border/30">
                <LoadingSpinner size="lg" message="Searching for program buffers..." />
                <p className="mt-4 text-sm text-shield-muted">Interrogating BPF Loader programs...</p>
            </div>
        );
    }

    if (bufferScanError) {
        return (
            <div className="glass-card rounded-2xl p-8 text-center border border-shield-danger/20 bg-shield-danger/5">
                <h3 className="text-lg font-bold text-shield-danger mb-2">Scan Failed</h3>
                <p className="text-shield-muted mb-6">{bufferScanError.message}</p>
                <button
                    onClick={runScan}
                    aria-label="Retry buffer scan"
                    className="px-6 py-2 rounded-xl bg-shield-card border border-shield-border hover:bg-shield-border/20 transition-all font-semibold"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const { buffers, closeableBuffers, totalRecoverableSOL } = bufferScanResult!;
    const selectedCount = selectedBufferAddresses.length;
    const selectedSOL = closeableBuffers
        .filter(b => selectedBufferAddresses.includes(b.address))
        .reduce((acc, b) => acc + b.recoverableSOL, 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card rounded-2xl p-6 border border-shield-border/30 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-shield-accent/10 flex items-center justify-center">
                        <Code2 className="h-6 w-6 text-shield-accent" />
                    </div>
                    <div>
                        <p className="text-xs text-shield-muted uppercase tracking-wider font-medium">Buffers Found</p>
                        <p className="text-2xl font-bold text-shield-text">{buffers.length}</p>
                    </div>
                </div>
                <div className="glass-card rounded-2xl p-6 border border-shield-accent/20 bg-shield-accent/5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-shield-accent/20 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-shield-accent" />
                    </div>
                    <div>
                        <p className="text-xs text-shield-muted uppercase tracking-wider font-medium">Reclaimable</p>
                        <p className="text-2xl font-bold text-shield-accent">{totalRecoverableSOL.toFixed(2)} SOL</p>
                    </div>
                </div>
            </div>

            {buffers.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center border border-shield-border/30">
                    <p className="text-shield-muted">No abandoned buffers found in this wallet. 🛡️</p>
                    <button
                        onClick={clearBuffers}
                        className="mt-4 text-sm text-shield-accent hover:underline"
                    >
                        Back to start
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={selectAllBuffers}
                                className="text-xs font-bold text-shield-accent hover:text-shield-accent/80 transition-colors"
                            >
                                Select All
                            </button>
                            <button
                                onClick={deselectAllBuffers}
                                className="text-xs font-bold text-shield-muted hover:text-shield-text transition-colors"
                            >
                                Deselect All
                            </button>
                        </div>
                        <p className="text-xs text-shield-muted">
                            {selectedCount} / {closeableBuffers.length} selected
                        </p>
                    </div>

                    <div className="space-y-3">
                        {buffers.map((buffer) => (
                            <BufferRow
                                key={buffer.address}
                                buffer={buffer}
                                isSelected={selectedBufferAddresses.includes(buffer.address)}
                                onToggle={toggleBufferSelection}
                            />
                        ))}
                    </div>

                    <div className="sticky bottom-6 glass-card rounded-2xl p-6 border border-shield-accent/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 animate-fade-in-up">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-shield-accent/10 flex items-center justify-center">
                                <Info className="h-5 w-5 text-shield-accent" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-shield-text">
                                    {selectedCount} Buffers Selected
                                </p>
                                <p className="text-xs text-shield-muted">
                                    You will reclaim <span className="text-shield-accent font-bold">{selectedSOL.toFixed(3)} SOL</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsConfirmModalOpen(true)}
                            disabled={selectedCount === 0 || isClosing}
                            data-agent-target="close-buffers-btn"
                            className="w-full sm:w-auto px-10 py-4 rounded-xl bg-shield-accent hover:bg-shield-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg shadow-lg shadow-shield-accent/25 transition-all"
                        >
                            Close and Reclaim SOL
                        </button>
                    </div>
                </div>
            )}

            {closeEstimate && (
                <ConfirmCloseModal
                    isOpen={isConfirmModalOpen}
                    onClose={() => setIsConfirmModalOpen(false)}
                    onConfirm={handleConfirmClose}
                    isClosing={isClosing}
                    estimate={closeEstimate}
                />
            )}
        </div>
    );
});

// Add display name for better debugging
BufferRecoveryCard.displayName = 'BufferRecoveryCard';
