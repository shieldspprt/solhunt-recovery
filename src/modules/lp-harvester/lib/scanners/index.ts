import type { Connection } from '@solana/web3.js';
import {
    MIN_DISPLAY_VALUE_USD,
} from '../../constants';
import { fetchTokenPrices } from '../pricer';
import { scanOrcaPositions } from './orcaScanner';
import { scanRaydiumPositions } from './raydiumScanner';
import { scanMeteoraPositions } from './meteoraScanner';
import { isValidSolanaPublicKey } from '@/lib/validation';
import { createAppError } from '@/lib/errors';
import type { LPPosition, LPProtocol, LPScanResult } from '../../types';

function extractUniqueMints(positions: LPPosition[]): string[] {
    const mints = new Set<string>(['So11111111111111111111111111111111111111112']);

    for (const position of positions) {
        if (position.tokenA) mints.add(position.tokenA);
        if (position.tokenB) mints.add(position.tokenB);
        if (position.unclaimedFeeA.mint) mints.add(position.unclaimedFeeA.mint);
        if (position.unclaimedFeeB.mint) mints.add(position.unclaimedFeeB.mint);
    }

    return Array.from(mints);
}

function enrichPositionWithPrices(
    position: LPPosition,
    prices: Map<string, number>,
    solPriceUSD: number
): LPPosition {
    const feeAValueUSD = position.unclaimedFeeA.uiAmount * (prices.get(position.unclaimedFeeA.mint) || 0);
    const feeBValueUSD = position.unclaimedFeeB.uiAmount * (prices.get(position.unclaimedFeeB.mint) || 0);
    const totalFeeValueUSD = feeAValueUSD + feeBValueUSD;

    return {
        ...position,
        unclaimedFeeA: {
            ...position.unclaimedFeeA,
            valueUSD: feeAValueUSD,
        },
        unclaimedFeeB: {
            ...position.unclaimedFeeB,
            valueUSD: feeBValueUSD,
        },
        totalFeeValueUSD,
        totalFeeValueSOL: solPriceUSD > 0 ? totalFeeValueUSD / solPriceUSD : 0,
    };
}

function buildProtocolBreakdown(positions: LPPosition[]): LPScanResult['protocolBreakdown'] {
    const index = new Map<LPProtocol, { protocol: LPProtocol; positionCount: number; feeValueUSD: number }>();

    for (const position of positions) {
        const existing = index.get(position.protocol);
        if (existing) {
            existing.positionCount += 1;
            existing.feeValueUSD += position.totalFeeValueUSD;
        } else {
            index.set(position.protocol, {
                protocol: position.protocol,
                positionCount: 1,
                feeValueUSD: position.totalFeeValueUSD,
            });
        }
    }

    return Array.from(index.values()).sort((left, right) => right.feeValueUSD - left.feeValueUSD);
}

/**
 * Scans all LP positions across Orca, Raydium, and Meteora.
 * 
 * SECURITY: Validates wallet address before making any RPC calls to prevent
 * injection attacks and ensure consistent error handling.
 */
export async function scanAllLPPositions(
    walletAddress: string,
    connection: Connection
): Promise<LPScanResult> {
    // Validate wallet address format before making any RPC calls
    if (!isValidSolanaPublicKey(walletAddress)) {
        throw createAppError(
            'INVALID_ADDRESS',
            `Invalid wallet address provided to LP scanner: ${walletAddress.substring(0, 10)}...`
        );
    }

    const protocolTasks = [
        {
            protocols: ['orca'] as LPProtocol[],
            run: () => scanOrcaPositions(walletAddress, connection),
        },
        {
            protocols: ['raydium_clmm', 'raydium_amm'] as LPProtocol[],
            run: () => scanRaydiumPositions(walletAddress, connection),
        },
        {
            protocols: ['meteora'] as LPProtocol[],
            run: () => scanMeteoraPositions(walletAddress, connection),
        },
    ];

    const settled = await Promise.allSettled(protocolTasks.map((task) => task.run()));

    const allPositions: LPPosition[] = [];
    const protocolsWithErrors: LPProtocol[] = [];
    const protocolsScanned = new Set<LPProtocol>();

    for (let index = 0; index < settled.length; index += 1) {
        const result = settled[index];
        const task = protocolTasks[index];
        if (!task) continue;

        if (result.status === 'fulfilled') {
            allPositions.push(...result.value);
            task.protocols.forEach((protocol) => protocolsScanned.add(protocol));
        } else {
            task.protocols.forEach((protocol) => protocolsWithErrors.push(protocol));
        }
    }

    const mints = extractUniqueMints(allPositions);
    const prices = await fetchTokenPrices(mints);
    const solPriceUSD = prices.get('So11111111111111111111111111111111111111112') || 0;

    const enriched = allPositions
        .map((position) => enrichPositionWithPrices(position, prices, solPriceUSD))
        .filter((position) => position.totalFeeValueUSD >= MIN_DISPLAY_VALUE_USD || position.protocol === 'raydium_amm')
        .sort((left, right) => right.totalFeeValueUSD - left.totalFeeValueUSD);

    const totalFeeValueUSD = enriched.reduce((sum, position) => sum + position.totalFeeValueUSD, 0);
    const totalFeeValueSOL = solPriceUSD > 0
        ? totalFeeValueUSD / solPriceUSD
        : enriched.reduce((sum, position) => sum + position.totalFeeValueSOL, 0);

    return {
        scannedAt: new Date(),
        positions: enriched,
        totalPositions: enriched.length,
        positionsWithFees: enriched.filter((position) => position.totalFeeValueUSD >= MIN_DISPLAY_VALUE_USD).length,
        totalFeeValueUSD,
        totalFeeValueSOL,
        protocolBreakdown: buildProtocolBreakdown(enriched),
        protocolsScanned: Array.from(protocolsScanned),
        protocolsWithErrors,
    };
}
