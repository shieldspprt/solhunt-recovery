import { Connection, PublicKey } from '@solana/web3.js';
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

/**
 * Scans for BPF Loader buffer accounts owned by the given wallet.
 * 
 * SECURITY: Validates wallet address before making any RPC calls to prevent
 * injection attacks and ensure consistent error handling.
 */
export async function scanForBuffers(
    walletAddress: string,
    _connection: Connection
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

    const loaderV3Buffers: BufferAccount[] = await Promise.all(
        upgradeableBuffers.map(async (acc) => {
            const info = await withRetry(
                (conn) => conn.getAccountInfo(acc.pubkey),
                { operationName: 'scanForBuffers.getAccountInfo' }
            );
            if (!info) return null;

            const lamports = info.lamports;
            const dataLength = info.data.length;

            const recoverableSOL = lamports / 1e9;
            const fee = recoverableSOL * (BUFFER_CLOSE_FEE_PERCENT / 100);

            return {
                address: acc.pubkey.toBase58(),
                authorityAddress: walletAddress,
                dataLengthBytes: dataLength,
                lamports: lamports,
                recoverableSOL: recoverableSOL - fee,
                loaderProgram: 'v3',
                status: 'closeable' as const,
                createdAt: Date.now(),
                label: `Upgradeable Buffer (${(dataLength / (1024 * 1024)).toFixed(1)} MB)`
            } as BufferAccount;
        })
    ).then(res => res.filter((b): b is BufferAccount => b !== null));

    return [...loaderV3Buffers];
}
