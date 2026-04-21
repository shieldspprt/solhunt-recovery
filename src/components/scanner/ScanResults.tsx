import { memo, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { DelegationRow } from '@/components/scanner/DelegationRow';
import { RevokeButton } from '@/components/revoke/RevokeButton';
import { ReclaimCard } from '@/components/reclaim/ReclaimCard';
import { ReclaimConfirmModal } from '@/components/reclaim/ReclaimConfirmModal';
import { ReclaimProgressModal } from '@/components/reclaim/ReclaimProgressModal';
import { DustCard } from '@/components/dust/DustCard';
import { DustConfirmModal } from '@/components/dust/DustConfirmModal';
import { DustProgressModal } from '@/components/dust/DustProgressModal';
import { DustBurnConfirmModal } from '@/components/dust/DustBurnConfirmModal';
import { DustBurnProgressModal } from '@/components/dust/DustBurnProgressModal';
import { formatDuration } from '@/lib/formatting';
import type { ScanResult } from '@/types';
import { EngineErrorBoundary } from '@/components/common/EngineErrorBoundary';

interface ScanResultsProps {
    result: ScanResult;
    onScanAgain: () => void;
}

export const ScanResults = memo(function ScanResults({ result, onScanAgain }: ScanResultsProps) {
    const { delegations, totalTokenAccounts, scanDurationMs } = result;
    
    // Memoize derived calculations to prevent unnecessary recomputation
    const { highRiskCount, mediumRiskCount, hasDelegations } = useMemo(() => ({
        highRiskCount: delegations.filter((d) => d.riskLevel === 'HIGH').length,
        mediumRiskCount: delegations.filter((d) => d.riskLevel === 'MEDIUM').length,
        hasDelegations: delegations.length > 0,
    }), [delegations]);

    return (
        <div id="engine-1" className="w-full max-w-4xl mx-auto space-y-6">
            {/* Clean state */}
            {!hasDelegations && (
                <div className="rounded-2xl border border-shield-success/30 bg-shield-success/5 p-8 sm:p-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-success/10">
                        <CheckCircle2 className="h-10 w-10 text-shield-success" />
                    </div>
                    <h2 className="text-2xl font-bold text-shield-text mb-2">
                        ✅ Your wallet is clean!
                    </h2>
                    <p className="text-shield-muted mb-1">
                        No dangerous permissions found.
                    </p>
                    <p className="text-sm text-shield-muted mb-6">
                        Scanned {totalTokenAccounts} token accounts in {formatDuration(scanDurationMs)}
                    </p>
                    <button
                        type="button"
                        onClick={onScanAgain}
                        className="inline-flex items-center gap-2 rounded-xl bg-shield-card border border-shield-border px-6 py-3 font-medium text-shield-text hover:bg-shield-border/50 transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Scan Again
                    </button>
                </div>
            )}

            {/* Issues found */}
            {hasDelegations && (
                <>
                    {/* Warning header */}
                    <div className="rounded-2xl border border-shield-danger/30 bg-shield-danger/5 p-6 sm:p-8">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-shield-danger/10 flex-shrink-0">
                                <AlertTriangle className="h-6 w-6 text-shield-danger" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-shield-text mb-3">
                                    ⚠️ {delegations.length} Dangerous Permission{delegations.length !== 1 ? 's' : ''} Found
                                </h2>

                                {/* Risk summary */}
                                <div className="flex flex-wrap gap-3">
                                    {highRiskCount > 0 && (
                                        <div className="flex items-center gap-2 rounded-lg bg-shield-danger/10 px-3 py-2">
                                            <span className="text-sm">🔴</span>
                                            <span className="text-sm text-shield-danger font-medium">
                                                High Risk: {highRiskCount} account{highRiskCount !== 1 ? 's' : ''}
                                            </span>
                                            <span className="text-xs text-shield-muted">(tokens can be drained)</span>
                                        </div>
                                    )}
                                    {mediumRiskCount > 0 && (
                                        <div className="flex items-center gap-2 rounded-lg bg-shield-warning/10 px-3 py-2">
                                            <span className="text-sm">🟡</span>
                                            <span className="text-sm text-shield-warning font-medium">
                                                Medium Risk: {mediumRiskCount} account{mediumRiskCount !== 1 ? 's' : ''}
                                            </span>
                                            <span className="text-xs text-shield-muted">(empty but permission exists)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 text-xs text-shield-muted">
                            <Search className="h-3 w-3 inline mr-1" />
                            Scanned {totalTokenAccounts} token accounts in {formatDuration(scanDurationMs)}
                        </div>
                    </div>

                    {/* Results table — wrapped in per-engine error boundary */}
                    <EngineErrorBoundary engineId="1">
                        <div className="rounded-2xl border border-shield-border bg-shield-card overflow-hidden">
                            <table className="w-full">
                                <thead className="hidden sm:table-header-group">
                                    <tr className="border-b border-shield-border bg-shield-bg/50">
                                        <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-shield-muted uppercase tracking-wider">Risk</th>
                                        <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-shield-muted uppercase tracking-wider">Token</th>
                                        <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-shield-muted uppercase tracking-wider">Your Balance</th>
                                        <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-shield-muted uppercase tracking-wider">Delegate</th>
                                        <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-shield-muted uppercase tracking-wider">Permission</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {delegations.map((delegation) => (
                                        <DelegationRow
                                            key={delegation.tokenAccountAddress}
                                            delegation={delegation}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Sticky revoke bar */}
                        <div className="sticky bottom-0 z-40 -mx-4 sm:mx-0 px-4 sm:px-0 py-4 bg-gradient-to-t from-shield-bg via-shield-bg to-transparent">
                            <RevokeButton delegations={delegations} />
                        </div>
                    </EngineErrorBoundary>
                </>
            )}

            {/* Engine 2: Rent Reclaimer */}
            <div id="engine-2">
                <ReclaimCard />
            </div>
            <ReclaimConfirmModal />
            <ReclaimProgressModal />

            {/* Engine 3: Dust Consolidator */}
            <div id="engine-3">
                <DustCard />
            </div>
            <DustConfirmModal />
            <DustProgressModal />
            <DustBurnConfirmModal />
            <DustBurnProgressModal />

            {/* Scan again button (for issues found state) */}
            {hasDelegations && (
                <div className="text-center">
                    <button
                        onClick={onScanAgain}
                        className="inline-flex items-center gap-2 text-sm text-shield-muted hover:text-shield-text transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Scan Again
                    </button>
                </div>
            )}
        </div>
    );
});
