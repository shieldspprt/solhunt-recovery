import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    PDAUtil,
    PriceMath,
    collectFeesQuote,
    TokenExtensionUtil,
} from '@orca-so/whirlpools-sdk';
import {
    LP_PROTOCOL_INFO,
    ORCA_WHIRLPOOL_PROGRAM_ID,
} from '../../constants';
import type { LPPosition } from '../../types';
import { KNOWN_TOKEN_SYMBOLS } from '../../utils/addresses';
import { createReadonlyWallet, toBase58, toUiAmount } from '../../utils/readonlyWallet';

interface ParsedTokenAccountInfo {
    mint: string;
    tokenAmount?: {
        amount?: string;
        uiAmount?: number | null;
        decimals?: number;
    };
}

function toDisplaySymbol(mint: string): string {
    return KNOWN_TOKEN_SYMBOLS[mint] || `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

function asParsedTokenInfo(data: unknown): ParsedTokenAccountInfo | null {
    if (!data || typeof data !== 'object' || !('parsed' in data)) return null;
    const parsed = (data as { parsed?: unknown }).parsed;
    if (!parsed || typeof parsed !== 'object' || !('info' in parsed)) return null;
    const info = (parsed as { info?: unknown }).info;
    if (!info || typeof info !== 'object') return null;
    return info as ParsedTokenAccountInfo;
}

export async function scanOrcaPositions(
    walletAddress: string,
    connection: Connection
): Promise<LPPosition[]> {
    const walletPublicKey = new PublicKey(walletAddress);
    const programId = new PublicKey(ORCA_WHIRLPOOL_PROGRAM_ID);
    const readonlyWallet = createReadonlyWallet(walletPublicKey);

    const ctx = WhirlpoolContext.from(
        connection,
        readonlyWallet as never,
        programId
    );
    const client = buildWhirlpoolClient(ctx);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_PROGRAM_ID },
        'confirmed'
    );

    const nftMints = tokenAccounts.value
        .map((account) => asParsedTokenInfo(account.account.data))
        .filter((info): info is ParsedTokenAccountInfo => Boolean(info))
        .filter((info) => {
            const uiAmount = info.tokenAmount?.uiAmount ?? 0;
            const decimals = info.tokenAmount?.decimals ?? 0;
            return uiAmount === 1 && decimals === 0;
        })
        .map((info) => info.mint)
        .filter((mint): mint is string => typeof mint === 'string' && mint.length > 0);

    const dedupedNftMints = Array.from(new Set(nftMints));
    if (dedupedNftMints.length === 0) return [];

    const positions: LPPosition[] = [];

    for (const mintAddress of dedupedNftMints) {
        try {
            const mintPublicKey = new PublicKey(mintAddress);
            const positionAddress = PDAUtil.getPosition(programId, mintPublicKey).publicKey;

            const position = await client.getPosition(positionAddress);
            const positionData = position.getData();
            const whirlpoolData = position.getWhirlpoolData();
            const tickLowerData = position.getLowerTickData();
            const tickUpperData = position.getUpperTickData();

            const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContextForPool(
                ctx.fetcher,
                whirlpoolData.tokenMintA,
                whirlpoolData.tokenMintB
            );

            const quote = collectFeesQuote({
                whirlpool: whirlpoolData,
                position: positionData,
                tickLower: tickLowerData,
                tickUpper: tickUpperData,
                tokenExtensionCtx,
            });

            const tokenAMint = toBase58(whirlpoolData.tokenMintA);
            const tokenBMint = toBase58(whirlpoolData.tokenMintB);
            const decimalsA = tokenExtensionCtx.tokenMintWithProgramA.decimals;
            const decimalsB = tokenExtensionCtx.tokenMintWithProgramB.decimals;

            const feeARaw = quote.feeOwedA.toString();
            const feeBRaw = quote.feeOwedB.toString();
            const feeAUI = toUiAmount(feeARaw, decimalsA);
            const feeBUI = toUiAmount(feeBRaw, decimalsB);

            const tokenASymbol = toDisplaySymbol(tokenAMint);
            const tokenBSymbol = toDisplaySymbol(tokenBMint);

            const currentPrice = Number(
                PriceMath.sqrtPriceX64ToPrice(
                    whirlpoolData.sqrtPrice,
                    decimalsA,
                    decimalsB
                ).toString()
            );
            const priceRangeLower = Number(
                PriceMath.tickIndexToPrice(
                    positionData.tickLowerIndex,
                    decimalsA,
                    decimalsB
                ).toString()
            );
            const priceRangeUpper = Number(
                PriceMath.tickIndexToPrice(
                    positionData.tickUpperIndex,
                    decimalsA,
                    decimalsB
                ).toString()
            );

            const status =
                whirlpoolData.tickCurrentIndex >= positionData.tickLowerIndex
                && whirlpoolData.tickCurrentIndex <= positionData.tickUpperIndex
                    ? 'in_range'
                    : 'out_of_range';

            positions.push({
                id: `orca:${positionAddress.toBase58()}`,
                positionAddress: positionAddress.toBase58(),
                protocol: 'orca',
                protocolDisplayName: LP_PROTOCOL_INFO.orca.displayName,
                poolAddress: toBase58(positionData.whirlpool),
                poolName: `${tokenASymbol}/${tokenBSymbol}`,
                tokenA: tokenAMint,
                tokenB: tokenBMint,
                tokenASymbol,
                tokenBSymbol,
                unclaimedFeeA: {
                    mint: tokenAMint,
                    symbol: tokenASymbol,
                    logoUri: null,
                    rawAmount: feeARaw,
                    uiAmount: feeAUI,
                    decimals: decimalsA,
                    valueUSD: 0,
                },
                unclaimedFeeB: {
                    mint: tokenBMint,
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
                priceRangeLower: Number.isFinite(priceRangeLower) ? priceRangeLower : null,
                priceRangeUpper: Number.isFinite(priceRangeUpper) ? priceRangeUpper : null,
                currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
                lastHarvestedAt: null,
                isSelected: true,
            });
        } catch {
            // Not an Orca position mint (or failed to fetch) — skip.
        }
    }

    return positions;
}
