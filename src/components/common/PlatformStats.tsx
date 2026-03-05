import { TrendingUp, Users, Zap, Shield } from 'lucide-react';
import { PLATFORM_STATS } from '@/config/constants';

interface StatItem {
    label: string;
    value: string;
    icon: typeof TrendingUp;
}

const stats: StatItem[] = [
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
];

interface PlatformStatsProps {
    compact?: boolean;
}

export function PlatformStats({ compact = false }: PlatformStatsProps) {
    if (compact) {
        return (
            <div className="flex items-center gap-4 text-xs text-shield-muted">
                <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-shield-accent" />
                    <span className="font-semibold text-shield-accent">{PLATFORM_STATS.totalRecoveredSOL.toLocaleString()}</span> SOL recovered
                </span>
                <span className="hidden sm:inline text-shield-border">•</span>
                <span className="hidden sm:flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {PLATFORM_STATS.walletsScanned.toLocaleString()}+ wallets
                </span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={stat.label}
                        className="glass-card rounded-xl px-4 py-3 text-center"
                    >
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                            <Icon className="h-3.5 w-3.5 text-shield-accent" />
                            <span className="text-lg font-bold text-shield-text">{stat.value}</span>
                        </div>
                        <span className="text-xs text-shield-muted">{stat.label}</span>
                    </div>
                );
            })}
        </div>
    );
}
