import { CATEGORY_INFO } from '../constants';
import type { CNFTCategory } from '../types';

interface SpamScoreBadgeProps {
    category: CNFTCategory;
    score: number;
}

export function SpamScoreBadge({ category, score }: SpamScoreBadgeProps) {
    const info = CATEGORY_INFO[category];

    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
            style={{
                backgroundColor: `${info.color}18`,
                color: info.color,
                border: `1px solid ${info.color}30`,
            }}
        >
            <span className="text-[10px]">{info.icon}</span>
            <span>{info.label}</span>
            {category !== 'verified' && (
                <span className="opacity-60">({score})</span>
            )}
        </span>
    );
}
