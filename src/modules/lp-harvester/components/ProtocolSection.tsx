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
    // Stable, deterministic ID for the collapsible panel so the toggle button
    // can reference it via aria-controls. Using the protocol value (e.g.
    // "orca", "raydium_clmm") instead of a random id keeps it stable across
    // re-renders, so screen readers can announce the same panel identity
    // even when the position list refreshes from a re-scan.
    const panelId = `lp-protocol-panel-${protocol.replace(/[^a-z0-9]/gi, '-')}`;

    return (
        <div className="rounded-xl border border-shield-border bg-shield-bg/30">
            <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                // aria-expanded tells screen readers whether the controlled
                // region is currently visible. Without it, SR users only hear
                // the button's accessible name ("Expand Orca section") and
                // have no way to know whether the section is already open
                // after they navigate past it.
                aria-expanded={!collapsed}
                aria-controls={panelId}
                aria-label={collapsed ? `Expand ${info.displayName} section` : `Collapse ${info.displayName} section`}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
                <div className="flex items-center gap-2">
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4 text-shield-muted" aria-hidden="true" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-shield-muted" aria-hidden="true" />
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
                <div
                    id={panelId}
                    // role="region" + aria-labelledby (via the button above)
                    // lets SR users jump straight to this section using the
                    // landmark shortcut, and identifies it as the controlled
                    // region of the accordion toggle.
                    role="region"
                    aria-label={`${info.displayName} positions`}
                    className="space-y-2 border-t border-shield-border p-3"
                >
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