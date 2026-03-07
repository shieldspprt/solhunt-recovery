import { CheckSquare, Square, Zap, ExternalLink } from 'lucide-react';
import { formatSOLValue, estimateUSD, shortenAddress } from '@/lib/formatting';
import { SOLSCAN_ACCOUNT_URL } from '@/config/constants';
import type { MEVClaimItem } from '@/types';

interface MEVClaimRowProps {
    item: MEVClaimItem;
    isSelected: boolean;
    onToggle: () => void;
}

export function MEVClaimRow({ item, isSelected, onToggle }: MEVClaimRowProps) {
    return (
        <label
            className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${isSelected
                    ? 'border-shield-primary/50 bg-shield-primary/10'
                    : 'border-shield-border bg-shield-bg/40 hover:border-shield-primary/30'
                }`}
        >
            <input
                type="checkbox"
                className="sr-only"
                checked={isSelected}
                onChange={onToggle}
            />
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-shield-muted transition-colors hover:text-shield-primary">
                {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-shield-primary" />
                ) : (
                    <Square className="h-5 w-5" />
                )}
            </div>

            <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-shield-accent" fill="currentColor" />
                    <span className="text-sm font-semibold text-shield-text">
                        Jito MEV Reward
                    </span>
                    <span className="rounded bg-shield-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-shield-accent">
                        Epoch {item.epoch}
                    </span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-shield-muted">
                    <span>Stake AC:</span>
                    <a
                        href={SOLSCAN_ACCOUNT_URL(item.stakeAccount)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-shield-text transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {shortenAddress(item.stakeAccount, 4)}
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </div>

            <div className="text-right flex flex-col items-end justify-center">
                <p className="font-semibold text-shield-text">
                    {formatSOLValue(item.totalSOL)}
                </p>
                <p className="text-xs text-shield-muted">{estimateUSD(item.totalSOL)}</p>
            </div>
        </label>
    );
}
