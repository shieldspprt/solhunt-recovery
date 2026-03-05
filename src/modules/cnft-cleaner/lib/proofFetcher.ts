import type { BurnProof } from '../types';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/**
 * Fetch Merkle proofs for selected cNFTs.
 * Batch proofs in parallel (Promise.allSettled) — up to 10 concurrent requests.
 * If proof fetch fails for a cNFT, it is omitted from the map.
 */
export async function fetchBurnProofs(
    assetIds: string[],
    heliusRpcUrl: string,
    onProgress?: (fetched: number, total: number) => void
): Promise<Map<string, BurnProof>> {
    const proofMap = new Map<string, BurnProof>();
    const batches = chunk(assetIds, 10);
    let totalFetched = 0;

    for (const batch of batches) {
        const results = await Promise.allSettled(
            batch.map((id) => fetchSingleProof(id, heliusRpcUrl))
        );

        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                proofMap.set(batch[i], result.value);
            }
            // Failed proofs are simply omitted
        });

        totalFetched += batch.length;
        onProgress?.(totalFetched, assetIds.length);

        if (batches.length > 1) await sleep(100);
    }

    return proofMap;
}

async function fetchSingleProof(
    assetId: string,
    heliusRpcUrl: string
): Promise<BurnProof> {
    const response = await fetch(heliusRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            method: 'getAssetProof',
            params: { id: assetId },
        }),
    });

    const data = await response.json();
    const result = data?.result;

    if (!result?.proof || !result?.root) {
        throw new Error(`No proof returned for asset ${assetId}`);
    }

    return {
        assetId,
        root: result.root,
        proof: result.proof,
        nodeIndex: result.node_index,
        leaf: result.leaf,
        treeId: result.tree_id,
        fetchedAt: Date.now(),
    };
}
