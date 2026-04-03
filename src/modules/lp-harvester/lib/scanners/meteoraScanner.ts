import { Connection, PublicKey } from '@solana/web3.js';
import {
    LP_PROTOCOL_INFO,
    METEORA_POSITION_API,
} from '../../constants';
import type { LPPosition } from '../../types';
import { KNOWN_TOKEN_DECIMALS, KNOWN_TOKEN_SYMBOLS } from '../../utils/addresses';
import { withRetry } from '@/lib/rpcRetry';
import { toValidPublicKey } from '@/lib/validation';

interface MeteoraApiPosition {
    position?: string;
    positionAddress?: string;
    positionPubkey?: string;
    lbPair?: string;
    lbPairAddress?: string;
    poolAddress?: string;
    tokenXMint?: string;
    tokenYMint?: string;
    tokenXSymbol?: string;
    tokenYSymbol?: string;
    feeX?: string | number;
    feeY?: string | number;
    decimalsX?: number;
    decimalsY?: number;
}

interface MeteoraApiResponse {
    positions?: MeteoraApiPosition[];
}

let meteoraApiSkipUntilMs = 0;

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

function parseNumberish(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function toUiAmount(rawAmount: string, decimals: number): number {
    const raw = Number(rawAmount);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw / 10 ** decimals;
}

function resolveSymbol(mint: string, fallback = 'UNKNOWN'): string {
    if (!mint) return fallback;
    return KNOWN_TOKEN_SYMBOLS[mint] || fallback || `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

function resolveDecimals(mint: string, fallback = 6): number {
    if (!mint) return fallback;
    return KNOWN_TOKEN_DECIMALS[mint] ?? fallback;
}

async function parseApiPositions(
    walletAddress: string,
    connection: Connection
): Promise<LPPosition[]> {
    if (Date.now() < meteoraApiSkipUntilMs) {
        return [];
    }

    const endpoint = `${METEORA_POSITION_API}/${encodeURIComponent(walletAddress)}`;
    const response = await fetch(endpoint, { cache: 'no-store' });

    if (!response.ok) {
        if (response.status === 404) {
            // Wallet has no Meteora tickets or endpoint path changed; avoid noisy repeated 404 calls.
            meteoraApiSkipUntilMs = Date.now() + 15 * 60_000;
            return [];
        }
        throw new Error(`Meteora API failed (${response.status}).`);
    }

    const payload = (await response.json()) as MeteoraApiResponse | MeteoraApiPosition[];
    const entries = Array.isArray(payload)
        ? payload
        : payload.positions || [];

    if (entries.length === 0) return [];

    const positions: LPPosition[] = [];

    for (const entry of entries) {
        const positionAddress =
            entry.positionAddress
            || entry.positionPubkey
            || entry.position
            || '';
        const poolAddress = entry.lbPairAddress || entry.lbPair || entry.poolAddress || '';
        if (!positionAddress || !poolAddress) continue;

        // Verify position still exists on-chain before surfacing.
        const exists = await withRetry(() => connection.getAccountInfo(new PublicKey(positionAddress), 'confirmed'));
        if (!exists) continue;

        const tokenA = entry.tokenXMint || '';
        const tokenB = entry.tokenYMint || '';
        const decimalsA = entry.decimalsX ?? resolveDecimals(tokenA);
        const decimalsB = entry.decimalsY ?? resolveDecimals(tokenB);

        const feeARaw = String(entry.feeX || '0');
        const feeBRaw = String(entry.feeY || '0');
        const feeAUI = toUiAmount(feeARaw, decimalsA);
        const feeBUI = toUiAmount(feeBRaw, decimalsB);

        const tokenASymbol = resolveSymbol(tokenA, entry.tokenXSymbol || 'UNKNOWN');
        const tokenBSymbol = resolveSymbol(tokenB, entry.tokenYSymbol || 'UNKNOWN');

        positions.push({
            id: `meteora:${positionAddress}`,
            positionAddress,
            protocol: 'meteora',
            protocolDisplayName: LP_PROTOCOL_INFO.meteora.displayName,
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
            status: 'unknown',
            liquidityUSD: 0,
            priceRangeLower: null,
            priceRangeUpper: null,
            currentPrice: null,
            lastHarvestedAt: null,
            isSelected: true,
        });
    }

    return positions;
}

async function parseSdkPositions(
    walletAddress: string,
    connection: Connection
): Promise<LPPosition[]> {
    const module = await import('@meteora-ag/dlmm');
    const DlmmCtor = (module as unknown as { default?: unknown }).default;
    if (
        !DlmmCtor
        || (typeof DlmmCtor !== 'object' && typeof DlmmCtor !== 'function')
        || !('getAllLbPairPositionsByUser' in DlmmCtor)
    ) {
        return [];
    }

    const dlmm = DlmmCtor as {
        getAllLbPairPositionsByUser: (
            rpcConnection: Connection,
            owner: PublicKey
        ) => Promise<Map<string, unknown>>;
    };

    const map = await dlmm.getAllLbPairPositionsByUser(
        connection,
        new PublicKey(walletAddress)
    );

    const positions: LPPosition[] = [];

    for (const [, pairInfoUnknown] of map) {
        const pairInfo = pairInfoUnknown as Record<string, unknown>;

        const lbPair = (pairInfo.lbPair || {}) as Record<string, unknown>;
        const poolAddress =
            toBase58(pairInfo.publicKey)
            || toBase58(lbPair.publicKey)
            || '';
        if (!poolAddress) continue;

        const tokenA =
            toBase58(lbPair.tokenXMint)
            || toBase58((pairInfo.tokenX as Record<string, unknown> | undefined)?.mint)
            || '';
        const tokenB =
            toBase58(lbPair.tokenYMint)
            || toBase58((pairInfo.tokenY as Record<string, unknown> | undefined)?.mint)
            || '';

        const tokenAReserve = (pairInfo.tokenX || {}) as Record<string, unknown>;
        const tokenBReserve = (pairInfo.tokenY || {}) as Record<string, unknown>;
        const tokenAMintInfo = (tokenAReserve.mint || {}) as Record<string, unknown>;
        const tokenBMintInfo = (tokenBReserve.mint || {}) as Record<string, unknown>;

        const decimalsA = parseNumberish(tokenAMintInfo.decimals) || resolveDecimals(tokenA);
        const decimalsB = parseNumberish(tokenBMintInfo.decimals) || resolveDecimals(tokenB);
        const tokenASymbol = resolveSymbol(tokenA);
        const tokenBSymbol = resolveSymbol(tokenB);

        const activeId = parseNumberish(lbPair.activeId);

        const userPositions = ((pairInfo.lbPairPositionsData || []) as unknown[])
            .map((entry) => entry as Record<string, unknown>);

        for (const userPosition of userPositions) {
            const positionAddress = toBase58(userPosition.publicKey);
            if (!positionAddress) continue;

            const positionData = (userPosition.positionData || {}) as Record<string, unknown>;
            const lowerBinId = parseNumberish(positionData.lowerBinId);
            const upperBinId = parseNumberish(positionData.upperBinId);

            const feeARaw = String(positionData.feeX || '0');
            const feeBRaw = String(positionData.feeY || '0');
            const feeAUI = toUiAmount(feeARaw, decimalsA);
            const feeBUI = toUiAmount(feeBRaw, decimalsB);

            let status: LPPosition['status'] = 'unknown';
            if (Number.isFinite(activeId) && Number.isFinite(lowerBinId) && Number.isFinite(upperBinId)) {
                status = activeId >= lowerBinId && activeId <= upperBinId
                    ? 'in_range'
                    : 'out_of_range';
            }

            positions.push({
                id: `meteora:${positionAddress}`,
                positionAddress,
                protocol: 'meteora',
                protocolDisplayName: LP_PROTOCOL_INFO.meteora.displayName,
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
                status,
                liquidityUSD: 0,
                priceRangeLower: null,
                priceRangeUpper: null,
                currentPrice: null,
                lastHarvestedAt: null,
                isSelected: true,
            });
        }
    }

    return positions;
}

export async function scanMeteoraPositions(
    walletAddress: string,
    connection: Connection
): Promise<LPPosition[]> {
    // SECURITY: Validate wallet address before any RPC calls
    toValidPublicKey(walletAddress);

    try {
        return await parseSdkPositions(walletAddress, connection);
    } catch {
        // SDK path may fail on some environments; fallback to API as best-effort.
    }

    try {
        return await parseApiPositions(walletAddress, connection);
    } catch {
        return [];
    }
}
