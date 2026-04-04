import { memo } from 'react';
import clsx from 'clsx';
import type { RiskLevel } from '@/types';

interface RiskBadgeProps {
    level: RiskLevel;
    className?: string;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; bgClass: string; textClass: string }> = {
    HIGH: {
        label: 'HIGH RISK',
        bgClass: 'bg-shield-danger/15',
        textClass: 'text-shield-danger',
    },
    MEDIUM: {
        label: 'MEDIUM',
        bgClass: 'bg-shield-warning/15',
        textClass: 'text-shield-warning',
    },
    LOW: {
        label: 'LOW',
        bgClass: 'bg-shield-muted/15',
        textClass: 'text-shield-muted',
    },
};

export const RiskBadge = memo(function RiskBadge({ level, className }: RiskBadgeProps) {
    const config = RISK_CONFIG[level];

    return (
        <span
            className={clsx(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                config.bgClass,
                config.textClass,
                className
            )}
        >
            {config.label}
        </span>
    );
});

// Display name for React DevTools debugging
RiskBadge.displayName = 'RiskBadge';
