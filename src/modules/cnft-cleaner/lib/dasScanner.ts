import { DAS_PAGE_SIZE, DAS_MAX_PAGES } from '../constants';
import type { DASAsset } from '../types';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch ALL cNFTs owned by the wallet using Helius DAS API.
 * Paginates automatically until all assets are fetched or DAS_MAX_PAGES reached.
 * Filters for compressed assets only (compression.compressed === true).
 */
export async function fetchAllCNFTs(
    walletAddress: string,
    heliusRpcUrl: string,
    onProgress?: (loaded: number) => void
): Promise<{ assets: DASAsset[]; fullyScanned: boolean }> {
    const allAssets: DASAsset[] = [];
    let page = 1;
    let hasMore = true;
    let fullyScanned = true;

    while (hasMore && page <= DAS_MAX_PAGES) {
        let response: Response;

        try {
            response = await fetch(heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: `scan-page-${page}`,
                    method: 'getAssetsByOwner',
                    params: {
                        ownerAddress: walletAddress,
                        page,
                        limit: DAS_PAGE_SIZE,
                        displayOptions: {
                            showCollectionMetadata: true,
                            showUnverifiedCollections: true,
                        },
                    },
                }),
            });
        } catch {
            throw new Error('CNFT_SCAN_FAILED');
        }

        // Handle rate limiting
        if (response.status === 429) {
            await sleep(1000);
            // Retry once
            try {
                response = await fetch(heliusRpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: `scan-page-${page}-retry`,
                        method: 'getAssetsByOwner',
                        params: {
                            ownerAddress: walletAddress,
                            page,
                            limit: DAS_PAGE_SIZE,
                            displayOptions: {
                                showCollectionMetadata: true,
                                showUnverifiedCollections: true,
                            },
                        },
                    }),
                });
            } catch {
                throw new Error('CNFT_SCAN_FAILED');
            }
        }

        if (!response.ok) {
            throw new Error('CNFT_SCAN_FAILED');
        }

        const data = await response.json();
        const items: DASAsset[] = data?.result?.items ?? [];

        // Filter for compressed only
        const compressed = items.filter(
            (a: DASAsset) => a.compression?.compressed === true
        );
        allAssets.push(...compressed);

        onProgress?.(allAssets.length);

        hasMore = items.length === DAS_PAGE_SIZE;
        page++;

        // Rate limit respect
        if (hasMore) await sleep(150);
    }

    if (hasMore && page > DAS_MAX_PAGES) {
        fullyScanned = false;
    }

    return { assets: allAssets, fullyScanned };
}
