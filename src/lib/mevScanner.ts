import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
    JITO_KOBE_API_BASE,
    JITO_STAKER_REWARDS_ENDPOINT,
    MEV_API_PAGE_SIZE,
    MEV_MIN_CLAIM_LAMPORTS,
} from '@/config/constants';
import type { MEVClaimItem } from '@/types';
import { withTimeout } from './withTimeout';
import { logger } from './logger';

/**
 * Paginated fetch with timeout wrapper for MEV API pages.
 */
async function fetchWithTimeout(url: string, body: object): Promise<Response> {
    return withTimeout(
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        10_000,
        'RPC_TIMEOUT'
    );
}

export interface JitoStakerReward {
    stake_account: string;
    vote_account: string;
    epoch: number;
    reward_lamports: number;
    priority_fee_lamports: number;
    mev_commission_bps: number;
    priority_fee_commission_bps: number;
    claim_status_account: string;
    is_claimed: boolean;
    merkle_proof: string[];
    merkle_root: string;
    tip_distribution_account: string;
}

/**
 * Fetch all claimable MEV and priority fee rewards for a wallet
 * via the Jito kobe.mainnet API.
 *
 * This API returns rewards across ALL epochs, ALL stake accounts,
 * for any wallet that has native SOL staked to Jito-running validators.
 *
 * Returns [] if wallet has no native stake with Jito validators.
 * Never throws — returns empty array on any API error.
 */
export async function fetchMEVClaims(
    walletAddress: string
): Promise<MEVClaimItem[]> {
    try {
        const url = `${JITO_KOBE_API_BASE}${JITO_STAKER_REWARDS_ENDPOINT}`;
        const response = await withTimeout(
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: walletAddress,
                    limit: MEV_API_PAGE_SIZE,
                }),
            }),
            10_000,
            'RPC_TIMEOUT'
        );

        if (!response.ok) {
            logger.warn('MEV API non-200', response.status);
            return [];
        }

        const data = await response.json();
        let rewards: JitoStakerReward[] = data?.rewards ?? [];

        // Pagination if more than one page
        const totalCount = data?.total_count ?? 0;
        if (totalCount > MEV_API_PAGE_SIZE) {
            const additionalPages = Math.ceil(
                (totalCount - MEV_API_PAGE_SIZE) / MEV_API_PAGE_SIZE
            );
            for (let page = 1; page <= additionalPages; page++) {
                try {
                    const pageResponse = await fetchWithTimeout(url, {
                        wallet: walletAddress,
                        limit: MEV_API_PAGE_SIZE,
                        offset: page * MEV_API_PAGE_SIZE,
                    });
                    if (pageResponse.ok) {
                        const pageData = await pageResponse.json();
                        const pageRewards = pageData?.rewards ?? [];
                        rewards = [...rewards, ...pageRewards];
                    }
                } catch (pageErr: unknown) {
                    logger.error(`fetchMEVClaims page ${page} failed`, pageErr);
                }
            }
        }

        // Filter and transform
        return rewards
            .filter(
                (r) =>
                    !r.is_claimed &&
                    (r.reward_lamports || 0) + (r.priority_fee_lamports || 0) >=
                    MEV_MIN_CLAIM_LAMPORTS
            )
            .map((r) => transformReward(r));
    } catch (err: unknown) {
        logger.error('fetchMEVClaims failed', err);
        return []; // Never block the rest of Engine 4 scan
    }
}

function transformReward(r: JitoStakerReward): MEVClaimItem {
    const totalLamports = (r.reward_lamports ?? 0) + (r.priority_fee_lamports ?? 0);
    const totalSOL = totalLamports / LAMPORTS_PER_SOL;
    const solPriceHardcoded = 150; // Use reasonable price for USD estimation since no cache available

    return {
        stakeAccount: r.stake_account ?? '',
        voteAccount: r.vote_account ?? '',
        validatorName: null, // Custom protocol display can map this
        epoch: r.epoch ?? 0,
        mevLamports: r.reward_lamports ?? 0,
        priorityFeeLamports: r.priority_fee_lamports ?? 0,
        totalLamports,
        totalSOL,
        estimatedValueUSD: totalSOL * solPriceHardcoded,
        mevCommissionBps: r.mev_commission_bps ?? 0,
        priorityFeeCommissionBps: r.priority_fee_commission_bps ?? 0,
        tipDistributionAccount: r.tip_distribution_account ?? '',
        claimStatusAccount: r.claim_status_account ?? '',
        merkleProof: r.merkle_proof ?? [],
        merkleRoot: r.merkle_root ?? '',
        isClaimed: r.is_claimed ?? false,
        isSelected: true, // Default: select all
    };
}
