import { IPFS_GATEWAYS } from '../constants';

/**
 * Convert various URI formats to HTTP-accessible URLs.
 * Handles: ipfs://, https://, http://, ar:// (Arweave)
 */
export function resolveUri(uri: string | null): string | null {
    if (!uri) return null;

    if (uri.startsWith('ipfs://')) {
        const hash = uri.slice(7);
        return `${IPFS_GATEWAYS[0]}${hash}`;
    }

    if (uri.startsWith('ar://')) {
        const txId = uri.slice(5);
        return `https://arweave.net/${txId}`;
    }

    if (uri.startsWith('http')) return uri;

    return null;
}

/**
 * Try multiple IPFS gateways in sequence.
 * Used as fallback when primary gateway fails.
 */
export async function resolveUriWithFallback(uri: string): Promise<string | null> {
    if (!uri.startsWith('ipfs://')) {
        return resolveUri(uri);
    }

    const hash = uri.slice(7);

    for (const gateway of IPFS_GATEWAYS) {
        const url = `${gateway}${hash}`;
        try {
            const res = await fetch(url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) return url;
        } catch {
            continue;
        }
    }
    return null;
}
