import type { LPPosition } from '../types';

export interface PositionValidationResult {
    isValid: boolean;
    reason: string | null;
}

export function validatePositionStillHarvestable(
    scannedPosition: LPPosition,
    currentPosition: LPPosition
): PositionValidationResult {
    const scanned = scannedPosition.totalFeeValueUSD;
    const current = currentPosition.totalFeeValueUSD;

    if (scanned <= 0 && current <= 0) {
        return { isValid: true, reason: null };
    }

    const baseline = Math.max(scanned, 0.01);
    const deltaPct = Math.abs(current - scanned) / baseline;
    if (deltaPct > 0.05) {
        return {
            isValid: false,
            reason: 'Position fee value changed by more than 5% since scan.',
        };
    }

    return { isValid: true, reason: null };
}

export function isCompoundAllowed(position: LPPosition): PositionValidationResult {
    if (position.status === 'out_of_range') {
        return {
            isValid: false,
            reason: 'Out-of-range positions are not eligible for compound.',
        };
    }

    return { isValid: true, reason: null };
}
