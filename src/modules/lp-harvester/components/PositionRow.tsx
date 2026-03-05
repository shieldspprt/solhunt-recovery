import { CircleAlert, CircleCheck, Dot } from 'lucide-react';
import type { LPPosition } from '../types';
import {
    formatLPUSD,
    formatRangeValue,
} from '../utils/formatting';
import { PositionValueBadge } from './PositionValueBadge';

interface PositionRowProps {
    position: LPPosition;
    selected: boolean;
    onToggle: (id: string) => void;
}

function getStatusBadge(status: LPPosition['status']) {
    if (status === 'in_range') {
        return {
            label: 'In Range',
            classes: 'border-shield-success/30 bg-shield-success/10 text-shield-success',
            icon: CircleCheck,
        };
    }

    if (status === 'out_of_range') {
        return {
            label: 'Out of Range',
            classes: 'border-shield-danger/30 bg-shield-danger/10 text-shield-danger',
            icon: CircleAlert,
        };
    }

    if (status === 'full_range') {
        return {
            label: 'Full Range',
            classes: 'border-shield-accent/30 bg-shield-accent/10 text-shield-accent',
            icon: Dot,
        };
    }

    return {
        label: 'Unknown',
        classes: 'border-shield-border bg-shield-bg/60 text-shield-muted',
        icon: Dot,
    };
}

export function PositionRow({ position, selected, onToggle }: PositionRowProps) {
    const statusBadge = getStatusBadge(position.status);
    const StatusIcon = statusBadge.icon;

    const isViewOnly = position.protocol === 'raydium_amm';
    const rangeText = position.status === 'full_range'
        ? 'Full Range'
        : position.priceRangeLower !== null && position.priceRangeUpper !== null
            ? `${formatRangeValue(position.priceRangeLower)} - ${formatRangeValue(position.priceRangeUpper)}`
            : 'Range unavailable';

    return (
        <div
            className={`rounded-xl border p-3 transition-colors ${
                selected
                    ? 'border-shield-accent/40 bg-shield-accent/5'
                    : 'border-shield-border bg-shield-bg/40'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggle(position.id)}
                        disabled={isViewOnly}
                        className="mt-1 h-4 w-4 rounded border-shield-border bg-shield-bg text-shield-accent disabled:opacity-60"
                    />

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-shield-text">
                                {position.poolName}
                            </p>
                            <span className="rounded-md border border-shield-border px-2 py-0.5 text-[11px] uppercase text-shield-muted">
                                {position.protocolDisplayName}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${statusBadge.classes}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusBadge.label}
                            </span>
                        </div>

                        <p className="mt-1 text-xs text-shield-muted">
                            Range: {rangeText}
                        </p>

                        <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                            <div className="text-shield-muted">
                                {position.unclaimedFeeA.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                {' '}
                                {position.unclaimedFeeA.symbol}
                                {' '}({formatLPUSD(position.unclaimedFeeA.valueUSD)})
                            </div>
                            <div className="text-shield-muted">
                                {position.unclaimedFeeB.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                {' '}
                                {position.unclaimedFeeB.symbol}
                                {' '}({formatLPUSD(position.unclaimedFeeB.valueUSD)})
                            </div>
                        </div>

                        {isViewOnly && (
                            <p className="mt-2 text-xs text-shield-warning">
                                Standard AMM position: fees are embedded in LP token value and are realized on liquidity withdrawal.
                            </p>
                        )}
                    </div>
                </div>

                <div className="shrink-0 text-right">
                    <p className="mb-1 text-xs text-shield-muted">Total</p>
                    <PositionValueBadge valueUSD={position.totalFeeValueUSD} />
                </div>
            </div>
        </div>
    );
}
