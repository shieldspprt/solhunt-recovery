/**
 * DexScreener token price and pair data fetcher.
 *
 * Polls the DexScreener REST API in batches of up to 30 mints per request
 * (matching DexScreener's endpoint limit). Results are cached in a module-level
 * Set to avoid redundant API calls for unsupported mints.
 */
import type {
    DexScreenerPair,
    DustScanResult,
    DustSwapQuote,
    DustToken,
    JupiterQuoteResponse,
    RaydiumQuoteData,
    RaydiumQuoteResponse,
    ScanResult,
} from '@/types';
import {
    DEXSCREENER_TOKEN_PRICES_API,
    DUST_MAX_TOKENS_PER_SESSION,
    DUST_MAX_VALUE_USD,
    DUST_SLIPPAGE_BPS,
    JUPITER_API_KEY,
    JUPITER_LITE_QUOTE_API,
    JUPITER_QUOTE_API,
    MIN_SWAP_OUTPUT_LAMPORTS,
    RAYDIUM_QUOTE_API,
    SOL_MINT,
} from '@/config/constants';
import { createAppError } from '@/lib/errors';
import { DEAD_PROTOCOLS } from '@/modules/decommission/registry/protocols';
import type { DeadProtocol } from '@/modules/decommission/types';

const PROTECTED_MINTS = new Set<string>(
    DEAD_PROTOCOLS
        .filter((p: DeadProtocol) => p.isRecoverable)
        .flatMap((p: DeadProtocol) => p.positionTokenMints.map((t) => t.mint))
);

const jupiterUnsupportedMints = new Set<string>();
const raydiumUnsupportedMints = new Set<string>();

interface ApiSource {
    url: string;
    headers?: Record<string, string>;
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function safeParseFloat(value: string | number | undefined): number {
    if (value === undefined) return 0;
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getPairLiquidityUSD(pair: DexScreenerPair): number {
    const liquidity = pair.liquidity?.usd;
    return typeof liquidity === 'number' && Number.isFinite(liquidity) ? liquidity : 0;
}

function getPairPriceUSDForMint(pair: DexScreenerPair, mint: string): number {
    const baseMint = pair.baseToken?.address ?? '';
    const quoteMint = pair.quoteToken?.address ?? '';
    const basePriceUSD = safeParseFloat(pair.priceUsd);

    if (!basePriceUSD) return 0;

    // DexScreener priceUsd is for the base token.
    if (baseMint === mint) return basePriceUSD;

    // We avoid inferring quote token price via inversion because quote/base
    // ratio is not guaranteed in this payload for every market.
    if (quoteMint === mint) return 0;

    return 0;
}

function chooseBestPairForMint(mint: string, pairs: DexScreenerPair[]): DexScreenerPair | null {
    const matchingPairs = pairs.filter((pair) => {
        const baseMint = pair.baseToken?.address ?? '';
        const quoteMint = pair.quoteToken?.address ?? '';
        return baseMint === mint || quoteMint === mint;
    });

    if (matchingPairs.length === 0) return null;

    const withBasePricing = matchingPairs.filter((pair) => (pair.baseToken?.address ?? '') === mint);
    const candidates = withBasePricing.length > 0 ? withBasePricing : matchingPairs;

    candidates.sort((left, right) => getPairLiquidityUSD(right) - getPairLiquidityUSD(left));
    return candidates[0] ?? null;
}

async function fetchDexScreenerPairs(mints: string[]): Promise<Map<string, DexScreenerPair>> {
    const result = new Map<string, DexScreenerPair>();
    if (mints.length === 0) return result;

    // DexScreener tokens endpoint supports up to 30 addresses per request.
    const mintBatches = chunk([...new Set(mints)], 30);

    for (const mintBatch of mintBatches) {
        const url = `${DEXSCREENER_TOKEN_PRICES_API}/${mintBatch.join(',')}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw createAppError(
                'DUST_PRICE_FETCH_FAILED',
                `DexScreener request failed (${response.status}) for ${mintBatch.length} mints`
            );
        }

        const payload = (await response.json()) as DexScreenerPair[];

        for (const mint of mintBatch) {
            const bestPair = chooseBestPairForMint(mint, payload);
            if (bestPair) {
                result.set(mint, bestPair);
            }
        }
    }

    return result;
}

function resolveTokenSymbol(mint: string, pair: DexScreenerPair | null): string {
    if (!pair) return 'UNKNOWN';
    if ((pair.baseToken?.address ?? '') === mint) {
        return pair.baseToken?.symbol || 'UNKNOWN';
    }
    if ((pair.quoteToken?.address ?? '') === mint) {
        return pair.quoteToken?.symbol || 'UNKNOWN';
    }
    return 'UNKNOWN';
}

function resolveRouteSource(pair: DexScreenerPair | null): string {
    const dex = pair?.dexId?.trim();
    if (!dex) return 'Unknown';
    return dex;
}

function estimateSolPriceUSD(solPair: DexScreenerPair | null): number {
    if (!solPair) return 0;
    const price = getPairPriceUSDForMint(solPair, SOL_MINT);
    return price > 0 ? price : 0;
}

export async function scanForDust(scanResult: ScanResult): Promise<DustScanResult> {
    const holdings = scanResult.tokenHoldings.filter((holding) => holding.uiBalance > 0);
    if (holdings.length === 0) {
        return {
            dustTokens: [],
            totalEstimatedValueUSD: 0,
            totalEstimatedValueSOL: 0,
            swappableCount: 0,
            unswappableCount: 0,
        };
    }

    const mintList = [...new Set(holdings.map((holding) => holding.mint))];
    const pairByMint = await fetchDexScreenerPairs([...mintList, SOL_MINT]);
    const solPriceUSD = estimateSolPriceUSD(pairByMint.get(SOL_MINT) ?? null);

    const dustTokens: DustToken[] = [];

    for (const holding of holdings) {
        const pair = pairByMint.get(holding.mint) ?? null;
        const estimatedPriceUSD = getPairPriceUSDForMint(pair ?? {}, holding.mint);
        const estimatedValueUSD = estimatedPriceUSD > 0
            ? holding.uiBalance * estimatedPriceUSD
            : 0;
        const estimatedValueSOL = estimatedValueUSD > 0 && solPriceUSD > 0
            ? estimatedValueUSD / solPriceUSD
            : 0;

        const isDustByValue = estimatedValueUSD > 0 && estimatedValueUSD <= DUST_MAX_VALUE_USD;
        const isDustUnknownPrice = estimatedValueUSD === 0 && holding.uiBalance < 1000;
        if (!isDustByValue && !isDustUnknownPrice) {
            continue;
        }

        if (PROTECTED_MINTS.has(holding.mint)) {
            continue;
        }

        dustTokens.push({
            tokenAccountAddress: holding.tokenAccountAddress,
            mint: holding.mint,
            tokenSymbol: resolveTokenSymbol(holding.mint, pair),
            tokenLogoUri: pair?.info?.imageUrl ?? null,
            rawBalance: holding.rawBalance,
            uiBalance: holding.uiBalance,
            decimals: holding.decimals,
            estimatedPriceUSD,
            estimatedValueUSD,
            estimatedValueSOL,
            isSwappable: false,
            routeSource: resolveRouteSource(pair),
            programId: holding.programId,
        });
    }

    dustTokens.sort((left, right) => right.estimatedValueUSD - left.estimatedValueUSD);

    const totalEstimatedValueUSD = dustTokens.reduce((sum, token) => sum + token.estimatedValueUSD, 0);
    const totalEstimatedValueSOL = solPriceUSD > 0
        ? totalEstimatedValueUSD / solPriceUSD
        : dustTokens.reduce((sum, token) => sum + token.estimatedValueSOL, 0);

    return {
        dustTokens,
        totalEstimatedValueUSD,
        totalEstimatedValueSOL,
        swappableCount: 0,
        unswappableCount: dustTokens.length,
    };
}

async function fetchRaydiumQuote(
    inputMint: string,
    inAmountRaw: string
): Promise<RaydiumQuoteData | null> {
    if (raydiumUnsupportedMints.has(inputMint)) {
        return null;
    }

    const params = new URLSearchParams({
        inputMint,
        outputMint: SOL_MINT,
        amount: inAmountRaw,
        slippageBps: String(DUST_SLIPPAGE_BPS),
        txVersion: 'V0',
    });

    const url = `${RAYDIUM_QUOTE_API}?${params.toString()}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

    let response = await fetch(proxyUrl, { cache: 'no-store' });
    if (response.status === 429) {
        await delay(1000);
        response = await fetch(proxyUrl, { cache: 'no-store' });
    }

    if (!response.ok) {
        if (response.status === 400 || response.status === 404) {
            raydiumUnsupportedMints.add(inputMint);
        }
        return null;
    }

    const payload = (await response.json()) as RaydiumQuoteResponse;
    if (!payload.success || !payload.data) {
        return null;
    }

    return payload.data;
}

function getJupiterQuoteSources(): ApiSource[] {
    const sources: ApiSource[] = [];
    if (JUPITER_API_KEY) {
        sources.push({
            url: JUPITER_QUOTE_API,
            headers: { 'x-api-key': JUPITER_API_KEY },
        });
    }
    sources.push({ url: JUPITER_LITE_QUOTE_API });
    return sources;
}

async function fetchJupiterQuote(
    inputMint: string,
    inAmountRaw: string
): Promise<JupiterQuoteResponse | null> {
    if (jupiterUnsupportedMints.has(inputMint)) {
        return null;
    }

    const params = new URLSearchParams({
        inputMint,
        outputMint: SOL_MINT,
        amount: inAmountRaw,
        slippageBps: String(DUST_SLIPPAGE_BPS),
        restrictIntermediateTokens: 'true',
    });

    for (const source of getJupiterQuoteSources()) {
        const url = `${source.url}?${params.toString()}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

        let response = await fetch(proxyUrl, {
            headers: source.headers,
            cache: 'no-store',
        });

        if (response.status === 429) {
            await delay(1000);
            response = await fetch(proxyUrl, {
                headers: source.headers,
                cache: 'no-store',
            });
        }

        if (!response.ok) {
            if (response.status === 400 || response.status === 404) {
                jupiterUnsupportedMints.add(inputMint);
            }
            continue;
        }

        const payload = (await response.json()) as JupiterQuoteResponse;
        if (!payload.outAmount) {
            continue;
        }

        return payload;
    }

    return null;
}

function summariseRaydiumRoute(quote: RaydiumQuoteData): string {
    const legs = quote.routePlan?.length ?? 0;
    if (legs > 1) return `Raydium router (${legs} hops)`;
    if (legs === 1) return 'Raydium router';
    return 'Raydium';
}

function summariseJupiterRoute(quote: JupiterQuoteResponse): string {
    const labels = (quote.routePlan || [])
        .map((route) => route.swapInfo?.label?.trim() || '')
        .filter((label) => label.length > 0);
    const uniqueLabels = Array.from(new Set(labels));
    if (uniqueLabels.length === 0) return 'Jupiter';
    if (uniqueLabels.length === 1) return `Jupiter via ${uniqueLabels[0]}`;
    return `Jupiter via ${uniqueLabels.slice(0, 2).join(', ')}`;
}

export async function getSwapQuotes(dustTokens: DustToken[]): Promise<Map<string, DustSwapQuote>> {
    const quotes = new Map<string, DustSwapQuote>();

    const candidates = dustTokens
        .filter((token) => token.uiBalance > 0)
        .slice(0, DUST_MAX_TOKENS_PER_SESSION);

    const batches = chunk(candidates, 5);
    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        const settled = await Promise.allSettled(
            batch.map(async (token) => {
                const jupiterQuote = await fetchJupiterQuote(token.mint, token.rawBalance);
                if (jupiterQuote) {
                    const outAmount = jupiterQuote.outAmount ?? '0';
                    const outLamports = Number.parseInt(outAmount, 10);
                    if (Number.isFinite(outLamports) && outLamports >= MIN_SWAP_OUTPUT_LAMPORTS) {
                        return {
                            mint: token.mint,
                            quote: {
                                inputMint: token.mint,
                                outputMint: SOL_MINT,
                                inAmount: jupiterQuote.inAmount ?? token.rawBalance,
                                outAmount,
                                outAmountSOL: outLamports / 1e9,
                                priceImpactPct: safeParseFloat(jupiterQuote.priceImpactPct),
                                routePlan: summariseJupiterRoute(jupiterQuote),
                                provider: 'jupiter' as const,
                                rawQuote: jupiterQuote,
                            },
                        };
                    }
                }

                const raydiumQuote = await fetchRaydiumQuote(token.mint, token.rawBalance);
                if (!raydiumQuote) {
                    return null;
                }

                const outAmount = raydiumQuote.outputAmount ?? '0';
                const outLamports = Number.parseInt(outAmount, 10);
                if (!Number.isFinite(outLamports) || outLamports < MIN_SWAP_OUTPUT_LAMPORTS) {
                    return null;
                }

                const outAmountSOL = outLamports / 1e9;
                const priceImpactPct = safeParseFloat(raydiumQuote.priceImpactPct);

                return {
                    mint: token.mint,
                    quote: {
                        inputMint: token.mint,
                        outputMint: SOL_MINT,
                        inAmount: raydiumQuote.inputAmount ?? token.rawBalance,
                        outAmount,
                        outAmountSOL,
                        priceImpactPct,
                        routePlan: summariseRaydiumRoute(raydiumQuote),
                        provider: 'raydium' as const,
                        rawQuote: raydiumQuote,
                    },
                };
            })
        );

        for (const entry of settled) {
            if (entry.status === 'fulfilled' && entry.value) {
                quotes.set(entry.value.mint, entry.value.quote);
            }
        }

        // Free API guardrails.
        if (index < batches.length - 1) {
            await delay(200);
        }
    }

    return quotes;
}
