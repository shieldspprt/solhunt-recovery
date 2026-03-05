/**
 * Fetch floor prices for collections.
 * Disabled — previously used Magic Eden API via CORS proxy which caused
 * Content Security Policy errors. Floor prices are not needed for the
 * burn-to-recover-SOL flow.
 */
export async function fetchCollectionFloorPrices(
    _collectionMints: string[]
): Promise<Map<string, number>> {
    return new Map<string, number>();
}
