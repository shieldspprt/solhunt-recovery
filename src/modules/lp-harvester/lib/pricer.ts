import { DEXSCREENER_SOLANA_TOKENS_API } from '../constants';
import type { DexScreenerPair } from '../../../types';
import { chunk } from '@/lib/arrayUtils';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumberish(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function getPairLiquidityUSD(pair: DexScreenerPair): number {
    return parseNumberish(pair.liquidity?.usd);
}

function getPairPriceUSDForMint(pair: DexScreenerPair, mint: string): number {
    const baseMint = pair.baseToken?.address ?? '';
    if (baseMint !== mint) return 0;

    return parseNumberish(pair.priceUsd);
}

function chooseBestPairForMint(mint: string, pairs: DexScreenerPair[]): DexScreenerPair | null {
    const matching = pairs.filter((pair) => {
        const baseMint = pair.baseToken?.address ?? '';
        const quoteMint = pair.quoteToken?.address ?? '';
        return baseMint === mint || quoteMint === mint;
    });

    if (matching.length === 0) return null;

    const baseAsToken = matching.filter((pair) => (pair.baseToken?.address ?? '') === mint);
    const candidates = baseAsToken.length > 0 ? baseAsToken : matching;

    candidates.sort((left, right) => getPairLiquidityUSD(right) - getPairLiquidityUSD(left));
    return candidates[0] ?? null;
}

async function fetchDexScreenerPrices(mints: string[]): Promise<Map<string, number>> {
    const priceMap = new Map<string, number>();
    const uniqueMints = Array.from(new Set(mints.filter((mint) => mint.length > 0)));
    if (uniqueMints.length === 0) return priceMap;

    const batches = chunk(uniqueMints, 30);
    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];

        try {
            const response = await fetch(
                `${DEXSCREENER_SOLANA_TOKENS_API}/${batch.join(',')}`,
                { cache: 'no-store' }
            );

            if (response.ok) {
                const payload = (await response.json()) as DexScreenerPair[];
                for (const mint of batch) {
                    const pair = chooseBestPairForMint(mint, payload);
                    const price = pair ? getPairPriceUSDForMint(pair, mint) : 0;
                    priceMap.set(mint, price > 0 ? price : 0);
                }
            } else {
                for (const mint of batch) {
                    if (!priceMap.has(mint)) priceMap.set(mint, 0);
                }
            }
        } catch (_e: unknown) {
            for (const mint of batch) {
                if (!priceMap.has(mint)) priceMap.set(mint, 0);
            }
        }

        if (index < batches.length - 1) {
            await sleep(150);
        }
    }

    return priceMap;
}

export async function fetchTokenPrices(
    mints: string[]
): Promise<Map<string, number>> {
    const unique = Array.from(new Set(mints.filter((mint) => mint.length > 0)));
    if (unique.length === 0) return new Map<string, number>();

    return fetchDexScreenerPrices(unique);
}

export function calculateUSDValue(
    uiAmount: number,
    mint: string,
    prices: Map<string, number>
): number {
    const price = prices.get(mint) ?? 0;
    return uiAmount * price;
}

export function getSOLPriceUSD(prices: Map<string, number>): number {
    return prices.get('So11111111111111111111111111111111111111112') ?? 0;
}
