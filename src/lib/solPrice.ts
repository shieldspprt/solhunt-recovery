import { JUPITER_PRICE_API } from '@/modules/lp-harvester/constants';
import { withTimeout } from './withTimeout';

/**
 * Fallback SOL price in USD when Jupiter price API is unavailable.
 * Exported so callers can use the same constant in their own fallback paths.
 */
export const FALLBACK_SOL_PRICE_USD = 150;

/**
 * Fetch the current SOL price in USD from Jupiter's price API.
 * Returns FALLBACK_SOL_PRICE_USD on any error (network, non-200, parse failure,
 * non-positive price). Centralized here so every module that needs USD<->SOL
 * conversion (decommission, MEV claims, etc.) uses the same source and the
 * same fallback instead of hardcoded magic numbers.
 */
export async function fetchSOLPriceUSD(): Promise<number> {
    try {
        const res = await withTimeout(
            fetch(`${JUPITER_PRICE_API}?ids=SOL`),
            5_000,
            'RPC_TIMEOUT'
        );
        if (!res.ok) return FALLBACK_SOL_PRICE_USD;
        const json = await res.json() as { prices?: Array<{ price?: number }> };
        const price = json?.prices?.[0]?.price;
        return typeof price === 'number' && price > 0 ? price : FALLBACK_SOL_PRICE_USD;
    } catch (_err: unknown) {
        return FALLBACK_SOL_PRICE_USD;
    }
}
