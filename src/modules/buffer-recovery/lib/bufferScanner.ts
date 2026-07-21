import { AccountInfo, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import {
    BufferAccount
} from '../types';
import {
    BPF_LOADER_UPGRADEABLE,
    BUFFER_CLOSE_FEE_PERCENT
} from '../constants';
import { withRetry } from '@/lib/rpcRetry';
import { isValidSolanaPublicKey } from '@/lib/validation';
import { createAppError } from '@/lib/errors';
import { chunk } from '@/lib/arrayUtils';

/**
 * Scans for BPF Loader buffer accounts owned by the given wallet.
 *
 * SECURITY: Validates wallet address before making any RPC calls to prevent
 * injection attacks and ensure consistent error handling.
 *
 * The connection is intentionally NOT a parameter: `withRetry` internally
 * tries the configured primary and backup RPCs, so accepting a connection
 * here would only mislead callers into thinking it controls the retry
 * chain. Callers should not need to plumb a `useConnection()` value down
 * to a scanner that already has its own resilient transport.
 */
export async function scanForBuffers(
    walletAddress: string
): Promise<BufferAccount[]> {
    // Validate wallet address format before making any RPC calls
    if (!isValidSolanaPublicKey(walletAddress)) {
        throw createAppError(
            'INVALID_ADDRESS',
            `Invalid wallet address provided to buffer scanner: ${walletAddress.substring(0, 10)}...`
        );
    }

    // 1. Scan BPFLoaderUpgradeable buffers with retry
    const upgradeableBuffers = await withRetry(
        (conn) => conn.getProgramAccounts(
            new PublicKey(BPF_LOADER_UPGRADEABLE),
            {
                filters: [
                    { memcmp: { offset: 0, bytes: bs58.encode([1]) } }, // State: Buffer
                    { memcmp: { offset: 4, bytes: walletAddress } },    // Authority: Wallet
                ],
                dataSlice: { offset: 0, length: 36 }
            }
        ),
        { operationName: 'scanForBuffers.getProgramAccounts' }
    );

    if (upgradeableBuffers.length === 0) {
        return [];
    }

    const pubkeys = upgradeableBuffers.map((acc) => acc.pubkey);
    const chunks = chunk(pubkeys, 100);
    const infos: (AccountInfo<Buffer> | null)[] = [];

    for (const batch of chunks) {
        const batchInfos = await withRetry(
            (conn) => conn.getMultipleAccountsInfo(batch),
            { operationName: 'scanForBuffers.getMultipleAccountsInfo' }
        );
        infos.push(...batchInfos);
    }

    const loaderV3Buffers: BufferAccount[] = [];
    for (let i = 0; i < upgradeableBuffers.length; i += 1) {
        const acc = upgradeableBuffers[i];
        const info = infos[i];
        if (!info) continue;

        const lamports = info.lamports;
        const dataLength = info.data.length;

        const recoverableSOL = lamports / 1e9;
        const fee = recoverableSOL * (BUFFER_CLOSE_FEE_PERCENT / 100);

        loaderV3Buffers.push({
            address: acc.pubkey.toBase58(),
            authorityAddress: walletAddress,
            dataLengthBytes: dataLength,
            lamports: lamports,
            recoverableSOL: recoverableSOL - fee,
            loaderProgram: 'v3',
            status: 'closeable' as const,
            createdAt: Date.now(),
            label: `Upgradeable Buffer (${(dataLength / (1024 * 1024)).toFixed(1)} MB)`
        });
    }

    return [...loaderV3Buffers];
}
