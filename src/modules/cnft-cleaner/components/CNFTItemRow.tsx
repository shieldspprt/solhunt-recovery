import { CNFTImageThumbnail } from './CNFTImageThumbnail';
import { SpamScoreBadge } from './SpamScoreBadge';
import { formatSpamSignal, truncateName } from '../utils/formatting';
import type { CNFTItem } from '../types';

interface CNFTItemRowProps {
    item: CNFTItem;
    isSelected: boolean;
    onToggle: (id: string) => void;
    style?: React.CSSProperties;
}

export function CNFTItemRow({
    item,
    isSelected,
    onToggle,
    style,
}: CNFTItemRowProps) {
    const isDisabled = !item.isBurnable;

    return (
        <div
            style={style}
            className={`flex items-center gap-3 px-3 py-2 border-b border-shield-border/30 transition-colors ${isDisabled
                    ? 'opacity-60'
                    : 'hover:bg-shield-border/10 cursor-pointer'
                }`}
            onClick={() => !isDisabled && onToggle(item.id)}
        >
            {/* Checkbox */}
            <div className="flex-shrink-0">
                <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => onToggle(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-shield-border text-shield-accent focus:ring-shield-accent/50 bg-shield-bg disabled:opacity-40"
                />
            </div>

            {/* Thumbnail */}
            <CNFTImageThumbnail
                uri={item.imageUri}
                alt={item.name}
                size={40}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-shield-text truncate max-w-[200px]">
                        {truncateName(item.name)}
                    </span>
                    <SpamScoreBadge
                        category={item.category}
                        score={item.spamScore}
                    />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {item.spamSignals.slice(0, 3).map((signal) => (
                        <span
                            key={signal}
                            className="text-[10px] text-shield-muted bg-shield-border/30 rounded px-1.5 py-0.5"
                        >
                            {formatSpamSignal(signal)}
                        </span>
                    ))}
                    {item.spamSignals.length > 3 && (
                        <span className="text-[10px] text-shield-muted">
                            +{item.spamSignals.length - 3} more
                        </span>
                    )}
                </div>
            </div>

            {/* Value */}
            <div className="flex-shrink-0 text-right">
                <span className="text-xs text-shield-muted">
                    {item.estimatedValueSOL > 0
                        ? `~${item.estimatedValueSOL.toFixed(4)} SOL`
                        : '$0.00'}
                </span>
            </div>
        </div>
    );
}
