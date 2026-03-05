import {
    SPAM_SIGNAL_WEIGHTS,
    SUSPICIOUS_NAME_PATTERNS,
    KNOWN_SPAM_COLLECTIONS,
    SPAM_THRESHOLD,
    LOW_VALUE_THRESHOLD,
    CATEGORY_INFO,
} from '../constants';
import { resolveUri } from '../utils/ipfs';
import type {
    DASAsset,
    CNFTItem,
    CNFTCategory,
    CNFTScanResult,
    SpamSignal,
} from '../types';

/**
 * Score a single DAS asset for spam likelihood.
 */
function scoreAsset(
    asset: DASAsset,
    floorPrices: Map<string, number>
): CNFTItem {
    let score = 0;
    const signals: SpamSignal[] = [];

    // Check known spam collections first
    const collectionMint = asset.grouping?.find(
        (g) => g.group_key === 'collection'
    )?.group_value;

    if (collectionMint && KNOWN_SPAM_COLLECTIONS.has(collectionMint)) {
        signals.push('known_spam_collection');
        score += SPAM_SIGNAL_WEIGHTS.known_spam_collection;
    }

    // Verified collection check
    const isVerified =
        asset.grouping?.some(
            (g) => g.group_key === 'collection' && g.verified
        ) ?? false;

    // No metadata
    if (
        !asset.content?.metadata?.name ||
        asset.content.metadata.name.trim() === ''
    ) {
        signals.push('no_metadata');
        score += SPAM_SIGNAL_WEIGHTS.no_metadata;
    }

    // Suspicious name patterns
    const name = (asset.content?.metadata?.name ?? '').toLowerCase();
    const hasSpamName = SUSPICIOUS_NAME_PATTERNS.some((p) =>
        name.includes(p)
    );
    if (hasSpamName) {
        signals.push('suspicious_name');
        score += SPAM_SIGNAL_WEIGHTS.suspicious_name;
    }

    // No creators
    if (!asset.creators || asset.creators.length === 0) {
        signals.push('no_creators');
        score += SPAM_SIGNAL_WEIGHTS.no_creators;
    }

    // Zero royalty
    if (asset.royalty?.basis_points === 0) {
        signals.push('zero_royalty');
        score += SPAM_SIGNAL_WEIGHTS.zero_royalty;
    }

    // Unverified collection
    if (collectionMint && !isVerified) {
        signals.push('unverified_collection');
        score += SPAM_SIGNAL_WEIGHTS.unverified_collection;
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Override: if verified collection, cap score at 10
    if (isVerified) score = Math.min(score, 10);

    // Determine category
    let category: CNFTCategory;
    if (isVerified) {
        category = 'verified';
    } else if (score >= SPAM_THRESHOLD) {
        category = 'spam';
    } else if (score >= LOW_VALUE_THRESHOLD) {
        category = 'low_value';
    } else if (score > 0) {
        category = 'potentially_valuable';
    } else {
        category = 'unknown';
    }

    const floorPrice = collectionMint
        ? (floorPrices.get(collectionMint) ?? null)
        : null;

    const imageUri =
        resolveUri(asset.content?.links?.image ?? null) ??
        resolveUri(asset.content?.files?.[0]?.uri ?? null);

    const collectionGroup = asset.grouping?.find(
        (g) => g.group_key === 'collection'
    );

    return {
        id: asset.id,
        name: asset.content?.metadata?.name || 'Unnamed',
        symbol: asset.content?.metadata?.symbol || '',
        description: asset.content?.metadata?.description || '',
        imageUri,
        metadataUri: asset.content?.json_uri || null,
        collection: collectionMint || null,
        collectionName: collectionGroup
            ? (collectionGroup as unknown as { collection_metadata?: { name?: string } })
                .collection_metadata?.name ?? null
            : null,
        isVerifiedCollection: isVerified,
        floorPriceSOL: floorPrice,
        estimatedValueSOL: floorPrice ?? 0,
        category,
        spamScore: score,
        spamSignals: signals,
        treeAddress: asset.compression?.tree || '',
        leafIndex: asset.compression?.leaf_id ?? 0,
        dataHash: asset.compression?.data_hash || '',
        creatorHash: asset.compression?.creator_hash || '',
        isSelected: CATEGORY_INFO[category].autoSelect && category !== 'verified',
        isBurnable: true, // All cNFTs are technically burnable, we just don't auto-select verified ones
    };
}

/**
 * Score each cNFT for spam likelihood.
 * Returns scored CNFTItem[] sorted by spamScore descending.
 */
export function scoreCNFTs(
    assets: DASAsset[],
    floorPrices: Map<string, number>
): CNFTItem[] {
    return assets
        .map((asset) => scoreAsset(asset, floorPrices))
        .sort((a, b) => b.spamScore - a.spamScore);
}

/**
 * Build a CNFTScanResult from scored items.
 */
export function buildScanResult(
    scoredItems: CNFTItem[],
    fullyScanned: boolean
): CNFTScanResult {
    const categories: CNFTScanResult['categories'] = {
        spam: [],
        low_value: [],
        potentially_valuable: [],
        verified: [],
        unknown: [],
    };

    for (const item of scoredItems) {
        categories[item.category].push(item);
    }

    return {
        scannedAt: new Date(),
        totalCNFTs: scoredItems.length,
        categories,
        spamCount: categories.spam.length,
        lowValueCount: categories.low_value.length,
        potentiallyValuableCount: categories.potentially_valuable.length,
        verifiedCount: categories.verified.length,
        estimatedRecoverableSOL: 0,
        totalPages: 0,
        fullyScanned,
    };
}
