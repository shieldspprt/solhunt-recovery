import { formatLPUSD } from '../utils/formatting';

interface PositionValueBadgeProps {
    valueUSD: number;
}

export function PositionValueBadge({ valueUSD }: PositionValueBadgeProps) {
    const classes = valueUSD >= 50
        ? 'border-shield-success/40 bg-shield-success/10 text-shield-success'
        : valueUSD >= 5
            ? 'border-shield-accent/40 bg-shield-accent/10 text-shield-accent'
            : valueUSD > 0
                ? 'border-shield-warning/40 bg-shield-warning/10 text-shield-warning'
                : 'border-shield-border bg-shield-bg/60 text-shield-muted';

    return (
        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classes}`}>
            {formatLPUSD(valueUSD)}
        </span>
    );
}
