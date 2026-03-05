import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCNFTStore } from './useCNFTStore';
import { fetchAllCNFTs } from '../lib/dasScanner';
import { scoreCNFTs, buildScanResult } from '../lib/spamScorer';
import { fetchCollectionFloorPrices } from '../lib/collectionVerifier';
import { logCNFTScanStarted, logCNFTScanComplete } from '@/lib/analytics';

export function useCNFTScanner() {
    const { publicKey } = useWallet();
    const store = useCNFTStore();
    const heliusRpcUrl = import.meta.env.VITE_HELIUS_RPC_URL;

    const runScan = useCallback(async () => {
        if (!publicKey) return;

        store.setScanStatus('scanning');
        store.setScanError(null);
        store.setCurrentProgressText('Fetching cNFTs...');
        logCNFTScanStarted();

        try {
            // 1. Fetch all cNFTs
            const { assets, fullyScanned } = await fetchAllCNFTs(
                publicKey.toString(),
                heliusRpcUrl,
                (loaded) => {
                    store.setCurrentProgressText(
                        `Loaded ${loaded} cNFTs so far...`
                    );
                }
            );

            if (assets.length === 0) {
                store.setScanResult({
                    scannedAt: new Date(),
                    totalCNFTs: 0,
                    fullyScanned: true,
                    categories: {
                        spam: [],
                        low_value: [],
                        potentially_valuable: [],
                        verified: [],
                        unknown: [],
                    },
                    spamCount: 0,
                    lowValueCount: 0,
                    potentiallyValuableCount: 0,
                    verifiedCount: 0,
                    estimatedRecoverableSOL: 0,
                    totalPages: 0,
                });
                return;
            }

            // 2. Fetch floor prices
            store.setCurrentProgressText('Checking collection data...');
            const collectionMints = [
                ...new Set(
                    assets
                        .map(
                            (a) =>
                                a.grouping?.find(
                                    (g) => g.group_key === 'collection'
                                )?.group_value
                        )
                        .filter(Boolean) as string[]
                ),
            ];
            const floorPrices =
                await fetchCollectionFloorPrices(collectionMints);

            // 3. Score all cNFTs
            store.setCurrentProgressText('Scoring spam signals...');
            const scoredItems = scoreCNFTs(assets, floorPrices);

            // 4. Build scan result
            const result = buildScanResult(scoredItems, fullyScanned);
            store.setScanResult(result);

            logCNFTScanComplete({
                totalCNFTs: result.totalCNFTs,
                spamCount: result.spamCount,
                lowValueCount: result.lowValueCount,
                potentiallyValuableCount: result.potentiallyValuableCount,
                verifiedCount: result.verifiedCount,
                fullyScanned: result.fullyScanned,
            });
        } catch {
            store.setScanStatus('error');
            store.setScanError(
                'Could not scan cNFTs. Please try again.'
            );
        }
    }, [publicKey, heliusRpcUrl, store]);

    return {
        scanStatus: store.scanStatus,
        scanResult: store.scanResult,
        scanError: store.scanError,
        currentProgressText: store.currentProgressText,
        runScan,
    };
}
