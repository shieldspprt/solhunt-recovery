/**
 * Fetch floor prices for collections.
 * Uses Magic Eden API with best-effort approach.
 * Never blocks scan — fetches in parallel with 3-second timeout.
 */
export async function fetchCollectionFloorPrices(
    collectionMints: string[]
): Promise<Map<string, number>> {
    const floorPrices = new Map<string, number>();

    if (collectionMints.length === 0) return floorPrices;

    // Deduplicate
    const uniqueMints = [...new Set(collectionMints)];

    // Fetch in parallel with timeout
    const results = await Promise.allSettled(
        uniqueMints.map((mint) => fetchSingleFloorPrice(mint))
    );

    results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value > 0) {
            floorPrices.set(uniqueMints[i], result.value);
        }
    });

    return floorPrices;
}

async function fetchSingleFloorPrice(
    collectionMint: string
): Promise<number> {
    try {
        const targetUrl = encodeURIComponent(
            `https://api-mainnet.magiceden.dev/v2/collections/${collectionMint}/stats`
        );
        const proxyUrl = `https://corsproxy.io/?${targetUrl}`;

        const response = await fetch(proxyUrl, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(4000),
        });

        if (!response.ok) return 0;

        const data = await response.json();
        const floorLamports = data?.floorPrice;

        if (typeof floorLamports === 'number' && floorLamports > 0) {
            return floorLamports / 1e9; // Convert lamports to SOL
        }

        return 0;
    } catch {
        return 0;
    }
}
