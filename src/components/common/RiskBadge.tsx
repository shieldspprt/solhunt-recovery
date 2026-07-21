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

    // Accessibility: High risk announcements should be immediate
    const ariaLive = level === 'HIGH' ? 'polite' : undefined;
    // Descriptive label for screen readers
    const ariaLabel = `Risk level: ${config.label}. ${
        level === 'HIGH' 
            ? 'Warning: This approval allows full token access.' 
            : level === 'MEDIUM' 
                ? 'Caution: Review this approval periodically.' 
                : 'Generally safe: Known protocol.'
    }`;

    return (
        <span
            className={clsx(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                config.bgClass,
                config.textClass,
                className
            )}
            role="status"
            aria-label={ariaLabel}
            aria-live={ariaLive}
        >
            {config.label}
        </span>
    );
});

// Display name for React DevTools debugging
RiskBadge.displayName = 'RiskBadge';
