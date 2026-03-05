import { useMemo } from 'react';
import { Flame, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCNFTScanner } from '../hooks/useCNFTScanner';
import { useCNFTBurner } from '../hooks/useCNFTBurner';
import { useCNFTStore } from '../hooks/useCNFTStore';
import { CNFTCategorySection } from './CNFTCategorySection';
import { BurnConfirmModal } from './BurnConfirmModal';
import { BurnProgressModal } from './BurnProgressModal';
import { CNFT_ERROR_MESSAGES, MAX_BURNS_PER_TX } from '../constants';
import type { CNFTCategory } from '../types';

const CATEGORY_ORDER: CNFTCategory[] = [
    'spam',
    'low_value',
    'potentially_valuable',
    'verified',
    'unknown',
];

export function CNFTCleanerCard() {
    const {
        scanStatus,
        scanResult,
        scanError,
        currentProgressText: scanProgressText,
        runScan,
    } = useCNFTScanner();

    const {
        selectedItems,
        selectedIds,
        burnEstimate,
        burnStatus,
        burnResult,
        burnError,
        completedItems,
        currentProgressText: burnProgressText,
        toggleItem,
        selectCategory,
        deselectCategory,
        initiateBurn,
        executeBurn,
        cancelBurn,
    } = useCNFTBurner();

    const store = useCNFTStore();

    const isIdle = scanStatus === 'idle';
    const isScanning = scanStatus === 'scanning';
    const isScanComplete = scanStatus === 'scan_complete';
    const isScanError = scanStatus === 'error';

    const isEmpty =
        isScanComplete && scanResult && scanResult.totalCNFTs === 0;
    const isClean =
        isScanComplete &&
        scanResult &&
        scanResult.spamCount === 0 &&
        scanResult.lowValueCount === 0;
    const hasResults =
        isScanComplete && scanResult && scanResult.totalCNFTs > 0 && !isClean;

    // Burn modal states
    const showConfirmModal = burnStatus === 'awaiting_confirmation';
    const showProgressModal =
        burnStatus === 'burning' || burnStatus === 'complete' || (burnStatus === 'error' && completedItems.length > 0);

    const totalBatches = useMemo(
        () => Math.ceil(selectedItems.length / MAX_BURNS_PER_TX),
        [selectedItems.length]
    );

    // Selected counts per category for the confirm modal
    const selectedSpamCount = useMemo(
        () =>
            selectedItems.filter((i) => i.category === 'spam').length,
        [selectedItems]
    );
    const selectedLowValueCount = useMemo(
        () =>
            selectedItems.filter((i) => i.category === 'low_value').length,
        [selectedItems]
    );
    const selectedOtherCount = useMemo(
        () =>
            selectedItems.filter(
                (i) =>
                    i.category !== 'spam' && i.category !== 'low_value'
            ).length,
        [selectedItems]
    );

    return (
        <>
            <div className="rounded-2xl border border-shield-border bg-shield-card overflow-hidden">
                {/* ─── IDLE STATE ─────────────────────────────────── */}
                {isIdle && (
                    <div className="p-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-shield-accent/20 bg-shield-accent/10">
                            <Flame className="h-7 w-7 text-shield-accent" />
                        </div>
                        <h2 className="text-xl font-bold text-shield-text mb-2">
                            🗑️ cNFT Spam Cleaner
                        </h2>
                        <p className="text-sm text-shield-muted mb-6 max-w-md mx-auto">
                            Scan for spam and worthless compressed NFTs
                            cluttering your wallet.
                        </p>
                        <button
                            onClick={runScan}
                            className="inline-flex items-center gap-2 rounded-xl bg-shield-accent px-6 py-3 font-medium text-white hover:bg-shield-accent/90 transition-colors shadow-lg shadow-shield-accent/20"
                        >
                            <Flame className="h-4 w-4" />
                            Scan for cNFT Spam
                        </button>
                        <p className="text-xs text-shield-muted mt-4">
                            Uses Helius DAS · Checks metadata, collections &amp;
                            spam signals
                        </p>
                    </div>
                )}

                {/* ─── SCANNING STATE ────────────────────────────── */}
                {isScanning && (
                    <div className="p-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-shield-accent/20 bg-shield-accent/10">
                            <Loader2 className="h-7 w-7 text-shield-accent animate-spin" />
                        </div>
                        <h2 className="text-xl font-bold text-shield-text mb-2">
                            🗑️ Scanning your cNFTs...
                        </h2>
                        <p className="text-sm text-shield-muted mb-4">
                            {scanProgressText || 'Fetching assets...'}
                        </p>
                        {/* Simple progress animation */}
                        <div className="w-48 mx-auto h-1 bg-shield-border rounded-full overflow-hidden">
                            <div className="h-full bg-shield-accent rounded-full animate-pulse w-2/3" />
                        </div>
                    </div>
                )}

                {/* ─── ERROR STATE ───────────────────────────────── */}
                {isScanError && (
                    <div className="p-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-shield-danger/20 bg-shield-danger/10">
                            <AlertTriangle className="h-7 w-7 text-shield-danger" />
                        </div>
                        <h2 className="text-xl font-bold text-shield-text mb-2">
                            Scan Failed
                        </h2>
                        <p className="text-sm text-shield-muted mb-4">
                            {scanError || CNFT_ERROR_MESSAGES.CNFT_SCAN_FAILED}
                        </p>
                        <button
                            onClick={runScan}
                            className="inline-flex items-center gap-2 rounded-xl bg-shield-accent px-6 py-3 font-medium text-white hover:bg-shield-accent/90 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* ─── EMPTY / CLEAN STATE ───────────────────────── */}
                {(isEmpty || isClean) && scanResult && (
                    <div className="p-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-shield-success/20 bg-shield-success/10">
                            <CheckCircle2 className="h-7 w-7 text-shield-success" />
                        </div>
                        <h2 className="text-xl font-bold text-shield-text mb-2">
                            🗑️ Wallet Looks Clean
                        </h2>
                        <p className="text-sm text-shield-muted mb-2">
                            {scanResult.totalCNFTs === 0
                                ? 'No cNFTs found in your wallet.'
                                : 'No spam cNFTs found.'}
                        </p>
                        {scanResult.verifiedCount > 0 && (
                            <p className="text-sm text-shield-muted">
                                ✅ {scanResult.verifiedCount} verified
                                collection item
                                {scanResult.verifiedCount !== 1
                                    ? 's'
                                    : ''}{' '}
                                kept safe.
                            </p>
                        )}
                        <button
                            onClick={() => store.resetAll()}
                            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-shield-border px-4 py-2 text-sm text-shield-muted hover:text-shield-text hover:bg-shield-border/30 transition-colors"
                        >
                            Scan Again
                        </button>
                    </div>
                )}

                {/* ─── RESULTS STATE ─────────────────────────────── */}
                {hasResults && scanResult && (
                    <div>
                        {/* Header */}
                        <div className="px-4 py-4 border-b border-shield-border/50">
                            <h2 className="text-lg font-bold text-shield-text">
                                🗑️ cNFT Scan Complete
                            </h2>
                            <p className="text-xs text-shield-muted mt-1">
                                Found {scanResult.totalCNFTs} cNFTs ·{' '}
                                {scanResult.spamCount} spam ·{' '}
                                {scanResult.lowValueCount} low value
                                {!scanResult.fullyScanned && (
                                    <span className="text-shield-warning ml-1">
                                        (wallet too large — showing first
                                        10,000)
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* Category sections */}
                        <div className="p-4 space-y-3">
                            {CATEGORY_ORDER.map((cat) => (
                                <CNFTCategorySection
                                    key={cat}
                                    category={cat}
                                    items={scanResult.categories[cat]}
                                    selectedIds={selectedIds}
                                    onToggle={toggleItem}
                                    onSelectAll={selectCategory}
                                    onDeselectAll={deselectCategory}
                                    defaultExpanded={
                                        cat === 'spam' ||
                                        cat === 'low_value'
                                    }
                                />
                            ))}
                        </div>

                        {/* Footer with burn summary */}
                        {burnEstimate && (
                            <div className="px-4 py-4 border-t border-shield-border/50 bg-shield-bg/30">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-shield-text">
                                            Selected:{' '}
                                            {burnEstimate.selectedCount}{' '}
                                            cNFTs for burning
                                        </p>
                                        <div className="text-xs text-shield-muted mt-1 space-y-0.5">
                                            <p>
                                                Session fee:{' '}
                                                {burnEstimate.sessionFeeSOL}{' '}
                                                SOL
                                            </p>
                                            <p>
                                                Network fees: ~
                                                {burnEstimate.networkFeeSOL.toFixed(
                                                    6
                                                )}{' '}
                                                SOL
                                            </p>
                                            <p className="font-medium text-shield-text">
                                                Total:{' '}
                                                {burnEstimate.totalCostSOL.toFixed(
                                                    6
                                                )}{' '}
                                                SOL
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={initiateBurn}
                                        disabled={
                                            burnStatus === 'fetching_proofs'
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl bg-shield-danger px-6 py-3 font-medium text-white hover:bg-shield-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-shield-danger/20"
                                    >
                                        {burnStatus === 'fetching_proofs' ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Fetching proofs...
                                            </>
                                        ) : (
                                            <>
                                                <Flame className="h-4 w-4" />
                                                Burn{' '}
                                                {burnEstimate.selectedCount}{' '}
                                                Spam cNFTs →
                                            </>
                                        )}
                                    </button>
                                </div>

                                {burnError && (
                                    <p className="text-xs text-shield-danger mt-2">
                                        {burnError}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* No selection */}
                        {!burnEstimate && (
                            <div className="px-4 py-3 border-t border-shield-border/50 bg-shield-bg/30">
                                <p className="text-sm text-shield-muted text-center">
                                    Select cNFTs above to burn them.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── MODALS ─────────────────────────────────────── */}
            {showConfirmModal && burnEstimate && scanResult && (
                <BurnConfirmModal
                    isOpen={showConfirmModal}
                    onClose={cancelBurn}
                    onConfirm={executeBurn}
                    estimate={burnEstimate}
                    scanResult={scanResult}
                    selectedSpamCount={selectedSpamCount}
                    selectedLowValueCount={selectedLowValueCount}
                    selectedOtherCount={selectedOtherCount}
                />
            )}

            <BurnProgressModal
                isOpen={showProgressModal}
                onClose={() => {
                    cancelBurn();
                    if (burnResult && burnResult.burnedCount > 0) {
                        // Re-scan after successful burns
                        store.resetAll();
                    }
                }}
                burnStatus={
                    burnStatus === 'burning'
                        ? 'burning'
                        : burnStatus === 'complete'
                            ? 'complete'
                            : 'error'
                }
                currentProgressText={burnProgressText}
                completedItems={completedItems}
                burnResult={burnResult}
                totalBatches={totalBatches}
            />
        </>
    );
}
