import { formatCurrency, formatSOLValue } from '@/lib/formatting';

export function formatLPUSD(value: number): string {
    return formatCurrency(value);
}

export function formatLPSOL(value: number): string {
    return formatSOLValue(value);
}

export function formatRangeValue(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return 'N/A';
    if (value < 0.001) return value.toFixed(6);
    if (value < 1) return value.toFixed(4);
    if (value < 1_000) return value.toFixed(2);
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
