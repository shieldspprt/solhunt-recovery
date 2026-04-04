import { useMemo, memo } from 'react';
import { Layers3, Loader2 } from 'lucide-react';
import { useLPScanner } from '../hooks/useLPScanner';
import { useLPHarvester } from '../hooks/useLPHarvester';
import { useLPStore } from '../hooks/useLPStore';
import { HARVEST_COMPOUND_FEE_PERCENT, HARVEST_FEE_PERCENT } from '../constants';
import type { LPProtocol, LPPosition } from '../types';
import { formatLPUSD } from '../utils/formatting';
import { ProtocolSection } from './ProtocolSection';
import { CompoundToggle } from './CompoundToggle';
import { HarvestConfirmModal } from './HarvestConfirmModal';
import { HarvestProgressModal } from './HarvestProgressModal';

const PROTOCOL_ORDER: LPProtocol[] = ['orca', 'raydium_clmm', 'raydium_amm', 'meteora'];

function buildProtocolGroups(positions: LPPosition[]): Array<{ protocol: LPProtocol; positions: LPPosition[] }> {
    const groups = new Map<LPProtocol, LPPosition[]>();

    for (const protocol of PROTOCOL_ORDER) {
        groups.set(protocol, []);
    }

    for (const position of positions) {
        const existing = groups.get(position.protocol) || [];
        existing.push(position);
        groups.set(position.protocol, existing);
    }

    return PROTOCOL_ORDER
        .map((protocol) => ({ protocol, positions: groups.get(protocol) || [] }))
        .filter((entry) => entry.positions.length > 0);
}

/**
 * LP Fee Harvester Card Component
 * 
 * Displays LP positions across Orca, Raydium, and Meteora with fee harvesting capabilities.
 * Memoized to prevent unnecessary re-renders when parent updates.
 */
export const LPHarvesterCard = memo(function LPHarvesterCard() {
    const {
        scanStatus,
        scanResult,
        scanError,
        runScan,
    } = useLPScanner();

    const {
        selectedPositions,
        harvestEstimate,
        harvestStatus,
        harvestResult,
        harvestError,
        willCompound,
        completedItems,
        togglePosition,
        setWillCompound,
        initiateHarvest,
        executeHarvest,
        cancelHarvest,
        dismissHarvest,
    } = useLPHarvester();

    const selectedPositionIds = useLPStore((state) => state.selectedPositionIds);

    const protocolGroups = useMemo(
        () => buildProtocolGroups(scanResult?.positions || []),
        [scanResult?.positions]
    );

    const selectedUSD = useMemo(
        () => selectedPositions.reduce((sum, position) => sum + position.totalFeeValueUSD, 0),
        [selectedPositions]
    );

    const feePercent = useMemo(
        () => (willCompound ? HARVEST_COMPOUND_FEE_PERCENT : HARVEST_FEE_PERCENT),
        [willCompound]
    );
    const serviceFeeUSD = useMemo(
        () => selectedUSD * (feePercent / 100),
        [selectedUSD, feePercent]
    );

    if (scanStatus === 'idle') {
        return (
            <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full">
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                        <Layers3 className="h-5 w-5 text-shield-accent" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-shield-text">LP Fee Harvester</h2>
                        <p className="text-sm text-shield-muted">
                            Scan Orca, Raydium, and Meteora LP positions to harvest unclaimed fees.
                        </p>
                    </div>
                </div>

                <button
                    onClick={runScan}
                    className="mt-3 w-full rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                >
                    Scan LP Positions
                </button>

                <p className="mt-3 text-xs text-shield-muted">Checks 3 DEXes · Takes 10-30 seconds</p>
            </div>
        );
    }

    if (scanStatus === 'scanning') {
        return (
            <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                        <Loader2 className="h-5 w-5 text-shield-accent animate-spin" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-shield-text">Scanning LP Positions...</h2>
                        <p className="text-sm text-shield-muted">Querying Orca, Raydium, and Meteora in parallel.</p>
                    </div>
                </div>

                <div className="space-y-2 text-sm text-shield-muted">
                    <p>⏳ Orca Whirlpools</p>
                    <p>⏳ Raydium (CLMM + AMM)</p>
                    <p>⏳ Meteora DLMM</p>
                </div>
            </div>
        );
    }

    if (scanStatus === 'error') {
        return (
            <div className="rounded-2xl border border-shield-danger/30 bg-shield-danger/10 p-6 shadow-xl w-full">
                <h2 className="text-lg font-bold text-shield-text mb-2">LP scan failed</h2>
                <p className="text-sm text-shield-danger mb-4">{scanError || 'Could not scan LP positions.'}</p>
                <button
                    onClick={runScan}
                    className="rounded-xl bg-shield-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-shield-accent/90 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!scanResult) return null;

    const noPositions = scanResult.positions.length === 0;
    const noFees = scanResult.positionsWithFees === 0;

    return (
        <>
            <div className="rounded-2xl border border-shield-border bg-shield-card p-6 shadow-xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                            <Layers3 className="h-5 w-5 text-shield-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-shield-text">LP Fee Harvester</h2>
                            <p className="text-sm text-shield-muted">
                                {scanResult.totalPositions} positions · {scanResult.positionsWithFees} with fees
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={runScan}
                        className="rounded-lg border border-shield-border px-3 py-1.5 text-xs text-shield-text hover:bg-shield-bg/60 transition-colors"
                    >
                        Rescan
                    </button>
                </div>

                {noPositions && (
                    <div className="rounded-xl border border-shield-success/30 bg-shield-success/10 p-4">
                        <p className="text-sm text-shield-success font-medium">No LP positions found across Orca, Raydium, and Meteora.</p>
                    </div>
                )}

                {!noPositions && noFees && (
                    <div className="rounded-xl border border-shield-warning/30 bg-shield-warning/10 p-4">
                        <p className="text-sm text-shield-warning font-medium mb-1">
                            LP positions found, but no unclaimed fees above display threshold.
                        </p>
                        <p className="text-xs text-shield-muted">You can rescan later as fees accrue over time.</p>
                    </div>
                )}

                {!noPositions && (
                    <div className="space-y-3">
                        {protocolGroups.map((group) => (
                            <ProtocolSection
                                key={group.protocol}
                                protocol={group.protocol}
                                positions={group.positions}
                                selectedIds={selectedPositionIds}
                                onTogglePosition={togglePosition}
                            />
                        ))}
                    </div>
                )}

                {!noPositions && (
                    <div className="mt-4 space-y-3">
                        <CompoundToggle
                            enabled={willCompound}
                            onChange={setWillCompound}
                        />

                        <div className="rounded-xl border border-shield-border/60 bg-shield-bg/50 p-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Selected positions:</span>
                                    <span className="text-shield-text">{selectedPositions.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Total selected value:</span>
                                    <span className="text-shield-text font-mono">{formatLPUSD(selectedUSD)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-shield-muted">Service fee ({feePercent}%):</span>
                                    <span className="text-shield-accent font-mono">-{formatLPUSD(serviceFeeUSD)}</span>
                                </div>
                                <div className="border-t border-shield-border/60 my-2" />
                                <div className="flex justify-between font-semibold">
                                    <span className="text-shield-text">You receive (est):</span>
                                    <span className="text-shield-success font-mono">{formatLPUSD(Math.max(selectedUSD - serviceFeeUSD, 0))}</span>
                                </div>
                            </div>
                        </div>

                        {scanResult.protocolsWithErrors.length > 0 && (
                            <p className="text-xs text-shield-warning">
                                Some protocol scans failed: {scanResult.protocolsWithErrors.join(', ')}.
                            </p>
                        )}

                        <button
                            onClick={initiateHarvest}
                            disabled={selectedPositions.length === 0}
                            className="w-full rounded-xl bg-shield-accent px-4 py-3 font-semibold text-white hover:bg-shield-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Harvest {selectedPositions.length} Position{selectedPositions.length === 1 ? '' : 's'}
                        </button>
                    </div>
                )}
            </div>

            <HarvestConfirmModal
                open={harvestStatus === 'awaiting_confirmation'}
                positions={selectedPositions}
                estimate={harvestEstimate}
                willCompound={willCompound}
                onCancel={cancelHarvest}
                onConfirm={executeHarvest}
            />

            <HarvestProgressModal
                open={[
                    'harvesting',
                    'compounding',
                    'sending_fee',
                    'complete',
                    'error',
                ].includes(harvestStatus)}
                status={harvestStatus}
                items={completedItems}
                result={harvestResult}
                errorMessage={harvestError}
                onClose={dismissHarvest}
            />
        </>
    );
});