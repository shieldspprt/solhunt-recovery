import { memo, useMemo } from 'react';
import { TrendingUp, Users, Zap, Shield } from 'lucide-react';
import { PLATFORM_STATS } from '@/config/constants';

interface StatItem {
    label: string;
    value: string;
    icon: typeof TrendingUp;
}

interface PlatformStatsProps {
    compact?: boolean;
}

export const PlatformStats = memo(function PlatformStats({ compact = false }: PlatformStatsProps) {
    // Memoize stats array to prevent re-creation on every render
    const stats: StatItem[] = useMemo(() => [
        {
            label: 'SOL Recovered',
            value: PLATFORM_STATS.totalRecoveredSOL.toLocaleString(),
            icon: TrendingUp,
        },
        {
            label: 'Wallets Scanned',
            value: PLATFORM_STATS.walletsScanned.toLocaleString() + '+',
            icon: Users,
        },
        {
            label: 'Transactions',
            value: PLATFORM_STATS.totalTransactions.toLocaleString(),
            icon: Zap,
        },
        {
            label: 'Audited',
            value: 'March 2026',
            icon: Shield,
        },
    ], []);

    if (compact) {
        return (
            <div 
                className="flex items-center gap-4 text-xs text-shield-muted"
                aria-live="polite"
                aria-label="Platform statistics summary"
            >
                <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-shield-accent" aria-hidden="true" />
                    <span className="font-semibold text-shield-accent">{PLATFORM_STATS.totalRecoveredSOL.toLocaleString()}</span> SOL recovered
                </span>
                <span className="hidden sm:inline text-shield-border">•</span>
                <span className="hidden sm:flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {PLATFORM_STATS.walletsScanned.toLocaleString()}+ wallets
                </span>
            </div>
        );
    }

    return (
        <div 
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            aria-live="polite"
            aria-label="Platform statistics"
        >
            {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={stat.label}
                        className="glass-card rounded-xl px-4 py-3 text-center"
                    >
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                            <Icon className="h-3.5 w-3.5 text-shield-accent" aria-hidden="true" />
                            <span className="text-lg font-bold text-shield-text">{stat.value}</span>
                        </div>
                        <span className="text-xs text-shield-muted">{stat.label}</span>
                    </div>
                );
            })}
        </div>
    );
});
