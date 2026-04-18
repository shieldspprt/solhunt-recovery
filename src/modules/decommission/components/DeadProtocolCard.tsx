import { memo } from 'react';
import { DecommissionPositionItem } from '../types';

interface Props {
    item: DecommissionPositionItem;
    isSelected?: boolean;
    onToggle?: (id: string) => void;
}

export const DeadProtocolCard = memo(function DeadProtocolCard({ item, isSelected, onToggle }: Props) {
    const { protocol, tokenDef, estimatedValueUSD, uiBalance, urgency, recoveryMethod } = item;

    const isWindingDown = urgency === 'critical';
    const isRecoverable = recoveryMethod === 'in_app' || recoveryMethod === 'redirect';

    return (
        <div className={`
      relative overflow-hidden rounded-2xl border transition-all duration-300
      ${isSelected ? 'border-shield-accent bg-shield-accent/5' : 'border-shield-border/30 bg-shield-bg/50 hover:border-shield-border/60'}
      ${isWindingDown ? 'border-red-500/50 hover:border-red-500/80 bg-red-900/10' : ''}
    `}>
            {/* Click layer */}
            {isRecoverable && onToggle && (
                <div
                    className="absolute inset-0 z-0 cursor-pointer"
                    onClick={() => onToggle(item.tokenAccountAddress)}
                    role="button"
                    aria-label={`Select ${protocol.name} position for recovery`}
                    aria-pressed={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggle(item.tokenAccountAddress);
                        }
                    }}
                />
            )}

            <div className="relative z-10 p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {isWindingDown && <span className="text-xl animate-pulse" aria-hidden="true">🚨</span>}
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10">
                            {protocol.logoUri ? (
                                <img src={protocol.logoUri} alt={protocol.name || 'Protocol logo'} className="h-6 w-6 object-cover" />
                            ) : (
                                <span className="text-xl" aria-hidden="true">🪦</span>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-shield-text">{protocol.name}</h3>
                            <p className="text-xs text-shield-muted/70">
                                {protocol.decommissionStatus === 'winding_down' ? 'Wind-down announced' : 'UI Shut Down'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {recoveryMethod === 'in_app' && (
                            <span className="inline-flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                                ⬆ RECOVER
                            </span>
                        )}
                        {recoveryMethod === 'redirect' && (
                            <span className="inline-flex items-center text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md">
                                ↗ REDIRECT
                            </span>
                        )}
                        {urgency === 'critical' && (
                            <span className="inline-flex items-center text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md uppercase">
                                URGENT — WITHDRAW
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-white/5 mb-4 pointer-events-none">
                    <div>
                        <span className="text-shield-muted text-xs block mb-1">Position Found</span>
                        <div className="font-mono text-sm text-shield-text">
                            {uiBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {tokenDef.symbol}
                        </div>
                    </div>
                    <div>
                        <span className="text-shield-muted text-xs block mb-1">Estimated Value</span>
                        <div className={`font-mono font-bold text-lg ${estimatedValueUSD ? 'text-shield-accent' : 'text-shield-muted'}`}>
                            {estimatedValueUSD ? `~$${estimatedValueUSD.toFixed(2)}` : 'Unknown'}
                        </div>
                    </div>
                </div>

                {/* Content specific text */}
                <p className="text-sm text-shield-muted leading-relaxed mb-4 pointer-events-none">
                    {urgency === 'critical' && 'This protocol is actively shutting down. Recovery becomes harder or impossible after wind-down.'}
                    {recoveryMethod === 'in_app' && `${protocol.name} UI is inactive but the on-chain contracts still hold your liquidity. SolHunt builds the tx.`}
                    {recoveryMethod === 'redirect' && `${protocol.name}'s protocol is still on-chain. Recovery may be possible via their official recovery tool.`}
                </p>

                {/* Action Area */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-shield-border/30">
                    <p className="text-xs text-orange-400 flex items-center gap-1.5 pointer-events-none">
                        ⚠️ DO NOT burn this token in Engine 3.
                    </p>

                    {recoveryMethod === 'redirect' && protocol.recoveryUrl && (
                        <a
                            href={protocol.recoveryUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="relative z-20 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 bg-blue-400/10 hover:bg-blue-400/20 px-3 py-1.5 rounded-lg transition-colors"
                            aria-label={`Open ${protocol.name} recovery site in new tab`}
                        >
                            Open Recovery Site <span aria-hidden="true">→</span>
                        </a>
                    )}

                    {recoveryMethod === 'in_app' && isRecoverable && onToggle && (
                        <button
                            className={`relative z-20 flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${isSelected
                                    ? 'border-shield-accent bg-shield-accent text-shield-bg shadow-sm shadow-shield-accent/20 hover:bg-shield-highlight'
                                    : 'border-shield-border/50 bg-shield-bg/50 text-shield-text hover:border-shield-accent/50 hover:bg-shield-accent/10 hover:text-shield-accent'
                                }`}
                            onClick={() => onToggle(item.tokenAccountAddress)}
                            aria-pressed={isSelected}
                            aria-label={isSelected ? `Deselect ${protocol.name} position` : `Select ${protocol.name} position for recovery`}
                        >
                            <div className={`flex h-4 w-4 items-center justify-center rounded text-[10px] ${isSelected ? 'bg-shield-bg/30 text-shield-bg' : 'border border-shield-muted/50 text-transparent'}`} aria-hidden="true">
                                {isSelected && '✓'}
                            </div>
                            {isSelected ? 'Include in Recovery' : 'Select for Recovery'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});