import { Connection, PublicKey } from '@solana/web3.js';
import {
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
    LP_PROTOCOL_INFO,
    RAYDIUM_LIQUIDITY_LIST_API,
} from '../../constants';
import type { LPPosition } from '../../types';
import { KNOWN_TOKEN_DECIMALS, KNOWN_TOKEN_SYMBOLS } from '../../utils/addresses';

interface ParsedTokenAmount {
    amount?: string;
    uiAmount?: number | null;
    decimals?: number;
}

interface ParsedTokenInfo {
    mint?: string;
    tokenAmount?: ParsedTokenAmount;
}

interface ParsedPoolInfo {
    id?: string;
    lpMint?: string;
    baseMint?: string;
    quoteMint?: string;
    name?: string;
    baseSymbol?: string;
    quoteSymbol?: string;
}

interface RaydiumLiquidityListResponse {
    official?: ParsedPoolInfo[];
    unOfficial?: ParsedPoolInfo[];
}

let cachedPools: ParsedPoolInfo[] | null = null;
let cachedPoolsAtMs = 0;

function toBase58(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'toBase58' in value) {
        const fn = value.toBase58;
        if (typeof fn === 'function') {
            try {
                return fn.call(value);
            } catch {
                return '';
            }
        }
    }
    return '';
}

function parsePositiveNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : 0;
}

function toSymbol(mint: string, fallback = 'UNKNOWN'): string {
    return KNOWN_TOKEN_SYMBOLS[mint] || fallback || `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

function toDecimals(mint: string, fallback = 6): number {
    return KNOWN_TOKEN_DECIMALS[mint] ?? fallback;
}

function normalizeUiAmount(rawAmount: string, decimals: number): number {
    const raw = Number(rawAmount);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw / 10 ** decimals;
}

function asParsedTokenInfo(data: unknown): ParsedTokenInfo | null {
    if (!data || typeof data !== 'object' || !('parsed' in data)) return null;
    const parsed = (data as { parsed?: unknown }).parsed;
    if (!parsed || typeof parsed !== 'object' || !('info' in parsed)) return null;
    const info = (parsed as { info?: unknown }).info;
    if (!info || typeof info !== 'object') return null;
    return info as ParsedTokenInfo;
}

async function fetchRaydiumPools(): Promise<ParsedPoolInfo[]> {
    const now = Date.now();
    if (cachedPools && now - cachedPoolsAtMs < 15 * 60_000) {
        return cachedPools;
    }

    const response = await fetch(RAYDIUM_LIQUIDITY_LIST_API, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Raydium liquidity list request failed (${response.status}).`);
    }

    const payload = (await response.json()) as RaydiumLiquidityListResponse | ParsedPoolInfo[];
    const pools = Array.isArray(payload)
        ? payload
        : [
            ...(payload.official || []),
            ...(payload.unOfficial || []),
        ];

    cachedPools = pools;
    cachedPoolsAtMs = now;
    return pools;
}

async function fetchWalletTokenBalances(
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Map<string, { rawAmount: string; uiAmount: number; decimals: number }>> {
    const programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
    const mintBalances = new Map<string, { rawAmount: string; uiAmount: number; decimals: number }>();

    for (const programId of programs) {
        const accounts = await connection.getParsedTokenAccountsByOwner(
            walletPublicKey,
            { programId },
            'confirmed'
        );

        for (const account of accounts.value) {
            const parsed = asParsedTokenInfo(account.account.data);
            const mint = parsed?.mint || '';
            if (!mint) continue;

            const tokenAmount = parsed?.tokenAmount;
            const rawAmount = String(tokenAmount?.amount || '0');
            const decimals = tokenAmount?.decimals ?? toDecimals(mint);
            const uiAmount = tokenAmount?.uiAmount ?? normalizeUiAmount(rawAmount, decimals);

            const existing = mintBalances.get(mint);
            if (existing) {
                mintBalances.set(mint, {
                    rawAmount: String(Number(existing.rawAmount) + Number(rawAmount)),
                    uiAmount: existing.uiAmount + uiAmount,
                    decimals,
                });
            } else {
                mintBalances.set(mint, { rawAmount, uiAmount, decimals });
            }
        }
    }

    return mintBalances;
}

async function scanRaydiumAmmPositions(
    walletAddress: string,
    connection: Connection
): Promise<LPPosition[]> {
    if (typeof window !== 'undefined') {
        // Raydium liquidity list endpoint currently blocks browser CORS in local/dev environments.
        // Keep AMM scanning disabled client-side to prevent noisy console/network failures.
        return [];
    }

    const walletPublicKey = new PublicKey(walletAddress);
    const [pools, balances] = await Promise.all([
        fetchRaydiumPools(),
        fetchWalletTokenBalances(walletPublicKey, connection),
    ]);

    const positions: LPPosition[] = [];

    for (const pool of pools) {
        const lpMint = pool.lpMint || '';
        if (!lpMint || !balances.has(lpMint)) continue;

        const balance = balances.get(lpMint);
        if (!balance || balance.uiAmount <= 0) continue;

        const tokenA = pool.baseMint || '';
        const tokenB = pool.quoteMint || '';
        const tokenASymbol = tokenA ? toSymbol(tokenA, pool.baseSymbol || 'UNKNOWN') : pool.baseSymbol || 'UNKNOWN';
        const tokenBSymbol = tokenB ? toSymbol(tokenB, pool.quoteSymbol || 'UNKNOWN') : pool.quoteSymbol || 'UNKNOWN';
        const poolName = pool.name || `${tokenASymbol}/${tokenBSymbol}`;

        positions.push({
            id: `raydium_amm:${lpMint}`,
            positionAddress: lpMint,
            protocol: 'raydium_amm',
            protocolDisplayName: LP_PROTOCOL_INFO.raydium_amm.displayName,
            poolAddress: pool.id || lpMint,
            poolName,
            tokenA,
            tokenB,
            tokenASymbol,
            tokenBSymbol,
            unclaimedFeeA: {
                mint: tokenA,
                symbol: tokenASymbol,
                logoUri: null,
                rawAmount: '0',
                uiAmount: 0,
                decimals: toDecimals(tokenA),
                valueUSD: 0,
            },
            unclaimedFeeB: {
                mint: tokenB,
                symbol: tokenBSymbol,
                logoUri: null,
                rawAmount: '0',
                uiAmount: 0,
                decimals: toDecimals(tokenB),
                valueUSD: 0,
            },
            totalFeeValueUSD: 0,
            totalFeeValueSOL: 0,
            status: 'full_range',
            liquidityUSD: 0,
            priceRangeLower: null,
            priceRangeUpper: null,
            currentPrice: null,
            lastHarvestedAt: null,
            // AMM fee collection requires liquidity withdrawal; keep unselected by default.
            isSelected: false,
        });
    }

    return positions;
}

async function scanRaydiumClmmPositions(
    walletAddress: string,
    connection: Connection
): Promise<LPPosition[]> {
    try {
        const module = await import('@raydium-io/raydium-sdk-v2');
        const RaydiumCtor = (
            module as unknown as { Raydium?: { load: (config: unknown) => Promise<unknown> } }
        ).Raydium;
        if (!RaydiumCtor?.load) {
            return [];
        }

        const raydium = await RaydiumCtor.load({
            connection,
            owner: new PublicKey(walletAddress),
            disableFeatureCheck: true,
            preloadTokenPrice: false,
        });

        const clmm = (raydium as { clmm?: Record<string, unknown> }).clmm;
        if (!clmm || typeof clmm !== 'object') return [];

        const maybeMethods = [
            'getOwnerPositionInfo',
            'getOwnerPositionInfos',
            'getOwnerPositions',
            'fetchOwnerPositions',
        ];

        let rawPositions: unknown = null;
        for (const methodName of maybeMethods) {
            const candidate = clmm[methodName];
            if (typeof candidate !== 'function') continue;

            try {
                rawPositions = await (candidate as (args?: Record<string, unknown>) => Promise<unknown>).call(clmm, {
                    owner: new PublicKey(walletAddress),
                });
                break;
            } catch {
                // Try next method shape.
            }
        }

        if (!rawPositions) return [];

        const asArray = Array.isArray(rawPositions)
            ? rawPositions
            : typeof rawPositions === 'object' && rawPositions !== null && 'positions' in rawPositions
                ? ((rawPositions as { positions?: unknown[] }).positions || [])
                : [];

        const positions: LPPosition[] = [];

        for (const entry of asArray) {
            const data = entry as Record<string, unknown>;

            const positionAddress =
                toBase58(data.positionAddress)
                || toBase58(data.personalPosition)
                || toBase58(data.nftMint)
                || toBase58(data.id);
            const poolAddress =
                toBase58(data.poolId)
                || toBase58(data.poolAddress)
                || toBase58(data.ammPoolId)
                || '';
            if (!positionAddress || !poolAddress) continue;

            const tokenA =
                toBase58(data.tokenMintA)
                || toBase58(data.mintA)
                || toBase58((data.poolInfo as Record<string, unknown> | undefined)?.mintA)
                || '';
            const tokenB =
                toBase58(data.tokenMintB)
                || toBase58(data.mintB)
                || toBase58((data.poolInfo as Record<string, unknown> | undefined)?.mintB)
                || '';

            const decimalsA = parsePositiveNumber(data.decimalsA) || toDecimals(tokenA);
            const decimalsB = parsePositiveNumber(data.decimalsB) || toDecimals(tokenB);

            const feeARaw = String(data.tokenFeeAmountA || data.feeA || '0');
            const feeBRaw = String(data.tokenFeeAmountB || data.feeB || '0');
            const feeAUI = normalizeUiAmount(feeARaw, decimalsA);
            const feeBUI = normalizeUiAmount(feeBRaw, decimalsB);

            const tokenASymbol = toSymbol(tokenA, String(data.symbolA || 'UNKNOWN'));
            const tokenBSymbol = toSymbol(tokenB, String(data.symbolB || 'UNKNOWN'));

            const inRange = typeof data.inRange === 'boolean'
                ? data.inRange
                : true;

            positions.push({
                id: `raydium_clmm:${positionAddress}`,
                positionAddress,
                protocol: 'raydium_clmm',
                protocolDisplayName: LP_PROTOCOL_INFO.raydium_clmm.displayName,
                poolAddress,
                poolName: `${tokenASymbol}/${tokenBSymbol}`,
                tokenA,
                tokenB,
                tokenASymbol,
                tokenBSymbol,
                unclaimedFeeA: {
                    mint: tokenA,
                    symbol: tokenASymbol,
                    logoUri: null,
                    rawAmount: feeARaw,
                    uiAmount: feeAUI,
                    decimals: decimalsA,
                    valueUSD: 0,
                },
                unclaimedFeeB: {
                    mint: tokenB,
                    symbol: tokenBSymbol,
                    logoUri: null,
                    rawAmount: feeBRaw,
                    uiAmount: feeBUI,
                    decimals: decimalsB,
                    valueUSD: 0,
                },
                totalFeeValueUSD: 0,
                totalFeeValueSOL: 0,
                status: inRange ? 'in_range' : 'out_of_range',
                liquidityUSD: 0,
                priceRangeLower: null,
                priceRangeUpper: null,
                currentPrice: null,
                lastHarvestedAt: null,
                isSelected: true,
            });
        }

        return positions;
    } catch {
        return [];
    }
}

export async function scanRaydiumPositions(
    walletAddress: string,
    connection: Connection
): Promise<LPPosition[]> {
    const [clmmResult, ammResult] = await Promise.allSettled([
        scanRaydiumClmmPositions(walletAddress, connection),
        scanRaydiumAmmPositions(walletAddress, connection),
    ]);

    const clmmPositions = clmmResult.status === 'fulfilled' ? clmmResult.value : [];
    const ammPositions = ammResult.status === 'fulfilled' ? ammResult.value : [];

    if (clmmResult.status === 'rejected' && ammResult.status === 'rejected') {
        throw new Error('Raydium scanners failed.');
    }

    return [...clmmPositions, ...ammPositions];
}
