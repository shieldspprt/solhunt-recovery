import { PageWrapper } from '@/components/layout/PageWrapper';
import { useDecommissionScanner } from '../hooks/useDecommissionScanner';
import { WindingDownBanner } from './WindingDownBanner';
import { DecommissionScanPanel } from './DecommissionScanPanel';
import { DecommissionResultsList } from './DecommissionResultsList';
import { SafeToBurnSection } from './SafeToBurnSection';
import { RecoveryModal } from './RecoveryModal';
import { DEAD_PROTOCOLS } from '../registry/protocols';

export function DecommissionPage() {
    const scanner = useDecommissionScanner();
    const hasWindingDownProtocols = DEAD_PROTOCOLS.some(p => p.decommissionStatus === 'winding_down');

    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-4xl px-4 py-8 relative">
                {hasWindingDownProtocols && <WindingDownBanner />}

                {scanner.scanStatus === 'idle' && (
                    <DecommissionScanPanel startScan={scanner.startScan} />
                )}

                {scanner.scanStatus === 'scanning' && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="inline-block relative">
                            <div className="w-16 h-16 rounded-full border-4 border-shield-border/50 border-t-shield-accent animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl">🪦</span>
                            </div>
                        </div>
                        <h2 className="mt-6 text-xl font-bold text-shield-text">Scanning dead protocols...</h2>
                        {scanner.scanProgress && (
                            <p className="mt-2 text-shield-muted">
                                Checking {scanner.scanProgress.currentProtocol} ({scanner.scanProgress.processed}/{scanner.scanProgress.total})
                            </p>
                        )}
                    </div>
                )}

                {scanner.scanStatus === 'nothing_found' && (
                    <div className="glass-card rounded-2xl p-10 text-center mt-6">
                        <span className="text-5xl block mb-6">✅</span>
                        <h2 className="text-2xl font-bold text-shield-text mb-4">No dead protocol positions found</h2>
                        <p className="text-shield-muted mb-8">
                            Your wallet is clean from known decommissioned DeFi protocols. You may still have generic worthless dust tokens in Engine 3.
                        </p>
                        <button
                            onClick={scanner.startScan}
                            aria-label="Scan wallet again"
                            className="inline-flex items-center gap-2 rounded-xl bg-shield-accent px-6 py-3 font-semibold text-shield-bg hover:bg-shield-highlight transition-all"
                        >
                            Scan Again
                        </button>
                    </div>
                )}

                {scanner.scanStatus === 'error' && (
                    <div className="glass-card rounded-2xl p-10 text-center mt-6 border-red-500/30">
                        <span className="text-5xl block mb-6">❌</span>
                        <h2 className="text-2xl font-bold text-red-500 mb-4">Scan Failed</h2>
                        <p className="text-shield-muted mb-8">
                            {scanner.scanError || 'An unknown error occurred during scan.'}
                        </p>
                        <button
                            onClick={scanner.startScan}
                            aria-label="Retry scan"
                            className="inline-flex items-center gap-2 rounded-xl bg-shield-border px-6 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {scanner.scanStatus === 'scan_complete' && scanner.scanResult && (
                    <div className="space-y-6 mt-6">
                        <div className="glass-card rounded-2xl p-6 text-center border border-shield-accent/20">
                            <h2 className="text-2xl font-bold text-shield-accent">Scan Complete</h2>
                            <p className="text-shield-muted mt-2">
                                Found {scanner.scanResult.positionsFound} positions across {scanner.scanResult.protocolsChecked} dead protocols.
                            </p>
                        </div>

                        <DecommissionResultsList
                            items={scanner.scanResult.items.filter(i => i.canRecover || i.recoveryMethod === 'unknown')}
                            selectedItems={scanner.selectedItems}
                            toggleItem={scanner.toggleItem}
                        />

                        {scanner.selectedItems.length > 0 && (
                            <div className="flex justify-end p-4">
                                <button
                                    onClick={scanner.initiateRecovery}
                                    className="inline-flex items-center gap-2 rounded-xl bg-shield-accent px-8 py-4 font-bold text-lg text-shield-bg hover:bg-shield-highlight transition-all shadow-lg shadow-shield-accent/20"
                                >
                                    Recover Selected Funds →
                                </button>
                            </div>
                        )}

                        {scanner.scanResult.confirmedWorthless > 0 && <SafeToBurnSection items={scanner.scanResult.items.filter(i => i.recoveryMethod === 'none')} />}
                    </div>
                )}

                {['awaiting_confirmation', 'recovering', 'complete', 'error'].includes(scanner.recoveryStatus) && (
                    <RecoveryModal
                        status={scanner.recoveryStatus}
                        estimate={scanner.recoveryEstimate}
                        result={scanner.recoveryResult}
                        error={scanner.recoveryError}
                        executeRecovery={scanner.executeRecovery}
                        cancelRecovery={scanner.cancelRecovery}
                    />
                )}

            </div>
        </PageWrapper>
    );
}
