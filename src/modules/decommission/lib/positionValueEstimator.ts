import { Connection, PublicKey } from '@solana/web3.js';
import { PositionTokenDefinition, DeadProtocol } from '../types';
import { logger } from '@/lib/logger';
import { withRetry } from '@/lib/rpcRetry';

/**
 * Typed shape of a parsed SPL Token Mint account from getParsedAccountInfo.
 * This avoids unsafe `as any` casts when accessing mint metadata.
 */
interface MintAccountData {
    parsed: {
        info: {
            supply: string;
            decimals: number;
        };
        type: string;
    };
}

export interface ValueEstimate {
    estimatedUnderlyingA: number | null;
    estimatedUnderlyingB: number | null;
    estimatedValueUSD: number | null;
}

async function getTokenPrice(mint: string): Promise<number> {
    try {
        const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, {
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) return 0;
        const data = await response.json();
        if (data && data.length > 0 && data[0].priceUsd) {
            return parseFloat(data[0].priceUsd);
        }
        return 0;
    } catch (err: unknown) {
        logger.warn('Failed to fetch token price from DexScreener', mint, err instanceof Error ? err.message : String(err));
        return 0;
    }
}

export async function estimatePositionValue(
    tokenDef: PositionTokenDefinition,
    balance: number,
    _protocol: DeadProtocol,
    connection: Connection
): Promise<ValueEstimate> {
    try {
        if (tokenDef.positionType === 'lp_token') {
            return await estimateLPTokenValue(tokenDef, balance, connection);
        }
        if (tokenDef.positionType === 'lending_receipt') {
            return await estimateLendingReceiptValue(tokenDef, balance);
        }
        return await estimateVaultShareValue(tokenDef, balance);
    } catch (err: unknown) {
        logger.warn('estimatePositionValue failed', tokenDef.mint, err instanceof Error ? err.message : String(err));
        return { estimatedUnderlyingA: null, estimatedUnderlyingB: null, estimatedValueUSD: null };
    }
}

async function estimateLPTokenValue(
    tokenDef: PositionTokenDefinition,
    balance: number,
    connection: Connection
): Promise<ValueEstimate> {
    if (!tokenDef.poolOrVaultAddress || !tokenDef.underlyingTokenA) {
        return { estimatedUnderlyingA: null, estimatedUnderlyingB: null, estimatedValueUSD: null };
    }

    try {
        const mintInfo = await withRetry(() => connection.getParsedAccountInfo(new PublicKey(tokenDef.mint)));
        if (!mintInfo.value) {
            return { estimatedUnderlyingA: null, estimatedUnderlyingB: null, estimatedValueUSD: null };
        }

        const mintData = (mintInfo.value.data as MintAccountData).parsed?.info;
        if (!mintData) {
            return { estimatedUnderlyingA: null, estimatedUnderlyingB: null, estimatedValueUSD: null };
        }
        const supplyNum = Number(mintData.supply ?? 0);
        const totalSupply = supplyNum / Math.pow(10, tokenDef.decimals);

        if (totalSupply === 0) {
            return { estimatedUnderlyingA: 0, estimatedUnderlyingB: 0, estimatedValueUSD: 0 };
        }

        const poolReserveA = await withRetry(() =>
            connection.getTokenAccountBalance(new PublicKey(tokenDef.poolOrVaultAddress!))
        );
        const reserveAAmount = Number(poolReserveA.value.uiAmount ?? 0);

        const userShare = balance / totalSupply;
        const userAmountA = reserveAAmount * userShare;

        const priceA = await getTokenPrice(tokenDef.underlyingTokenA);
        const priceB = tokenDef.underlyingTokenB ? await getTokenPrice(tokenDef.underlyingTokenB) : priceA;

        const userAmountB = tokenDef.underlyingTokenB ? userAmountA * (priceA / (priceB || 1)) : null;

        const estimatedValueUSD = (userAmountA * priceA) + (userAmountB !== null ? userAmountB * priceB : userAmountA * priceA);

        return {
            estimatedUnderlyingA: userAmountA,
            estimatedUnderlyingB: userAmountB,
            estimatedValueUSD,
        };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to estimate LP token value';
        logger.warn('estimateLPTokenValue error', message);
        return { estimatedUnderlyingA: null, estimatedUnderlyingB: null, estimatedValueUSD: null };
    }
}

async function estimateLendingReceiptValue(
    tokenDef: PositionTokenDefinition,
    balance: number
): Promise<ValueEstimate> {
    if (!tokenDef.underlyingTokenA) {
        return { estimatedUnderlyingA: balance, estimatedUnderlyingB: null, estimatedValueUSD: null };
    }
    const price = await getTokenPrice(tokenDef.underlyingTokenA);
    return {
        estimatedUnderlyingA: balance,
        estimatedUnderlyingB: null,
        estimatedValueUSD: balance * price,
    };
}

async function estimateVaultShareValue(
    _tokenDef: PositionTokenDefinition,
    balance: number
): Promise<ValueEstimate> {
    return {
        estimatedUnderlyingA: balance,
        estimatedUnderlyingB: null,
        estimatedValueUSD: null,
    };
}
