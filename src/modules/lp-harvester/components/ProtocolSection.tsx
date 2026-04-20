import { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LPPosition, LPProtocol } from '../types';
import { LP_PROTOCOL_INFO } from '../constants';
import { formatLPUSD } from '../utils/formatting';
import { PositionRow } from './PositionRow';

interface ProtocolSectionProps {
    protocol: LPProtocol;
    positions: LPPosition[];
    selectedIds: string[];
    onTogglePosition: (id: string) => void;
}

export const ProtocolSection = memo(function ProtocolSection({
    protocol,
    positions,
    selectedIds,
    onTogglePosition,
}: ProtocolSectionProps) {
    const totalValueUSD = useMemo(
        () => positions.reduce((sum, position) => sum + position.totalFeeValueUSD, 0),
        [positions]
    );

    const [collapsed, setCollapsed] = useState(totalValueUSD <= 0);
    const info = LP_PROTOCOL_INFO[protocol];

    return (
        <div className="rounded-xl border border-shield-border bg-shield-bg/30">
            <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? `Expand ${info.displayName} section` : `Collapse ${info.displayName} section`}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
                <div className="flex items-center gap-2">
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4 text-shield-muted" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-shield-muted" />
                    )}
                    <span className="text-sm font-semibold text-shield-text">
                        {info.displayName.toUpperCase()}
                    </span>
                    <span className="text-xs text-shield-muted">
                        ({positions.length} position{positions.length === 1 ? '' : 's'})
                    </span>
                </div>
                <span className="text-xs font-medium text-shield-muted">
                    {formatLPUSD(totalValueUSD)}
                </span>
            </button>

            {!collapsed && (
                <div className="space-y-2 border-t border-shield-border p-3">
                    {positions.map((position) => (
                        <PositionRow
                            key={position.id}
                            position={position}
                            selected={selectedIds.includes(position.id)}
                            onToggle={onTogglePosition}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});