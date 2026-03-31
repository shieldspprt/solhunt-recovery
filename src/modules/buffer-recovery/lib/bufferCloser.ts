import {
    PublicKey,
    TransactionInstruction,
    SystemProgram
} from '@solana/web3.js';
import {
    BPF_LOADER_UPGRADEABLE,
    BUFFER_CLOSE_FEE_PERCENT
} from '../constants';
import { TREASURY_WALLET } from '@/config/constants';
import type { BufferCloseEstimate } from '../types';

/**
 * Builds instructions to close BPFLoaderUpgradeable buffers and handle fees.
 *
 * @param walletAddress - The wallet owning the buffers.
 * @param bufferInfos  - Array of { address, lamports } for each selected buffer.
 *                       lamports is the GROSS rent deposit (before any fee deduction).
 * @param totalLamports - Pre-summed gross lamports for all selected buffers.
 * @returns Array of TransactionInstructions: fee transfer (if any) + close instructions.
 *
 * SECURITY NOTES:
 * - Each close ix uses the wallet as both recipient and authority signer — standard pattern.
 * - The fee transfer is idempotent (no-op if feeLamports === 0).
 * - Total tx count = 1 (all buffers closed in one transaction, respecting MAX_BUFFERS_PER_TX).
 * - Callers should still run verifyTransactionSecurity() on the resulting transaction.
 */
export function createCloseBufferInstructions(
    walletAddress: string,
    bufferInfos: Array<{ address: string; lamports: number }>,
    totalLamports: number
): TransactionInstruction[] {
    const walletPubkey = new PublicKey(walletAddress);
    const instructions: TransactionInstruction[] = [];

    // Service fee: percentage of gross lamports recovered
    const feeLamports = Math.floor(totalLamports * (BUFFER_CLOSE_FEE_PERCENT / 100));

    if (feeLamports > 0) {
        instructions.push(
            SystemProgram.transfer({
                fromPubkey: walletPubkey,
                toPubkey: TREASURY_WALLET,
                lamports: feeLamports,
            })
        );
    }

    // Close Buffer Instructions
    for (const { address: bufferAddress } of bufferInfos) {
        const bufferPubkey = new PublicKey(bufferAddress);

        // BPFLoaderUpgradeable CloseBuffer instruction
        // Discriminator is [5, 0, 0, 0] for CloseBuffer
        const data = Buffer.from([5, 0, 0, 0]);

        instructions.push(
            new TransactionInstruction({
                programId: new PublicKey(BPF_LOADER_UPGRADEABLE),
                keys: [
                    { pubkey: bufferPubkey, isSigner: false, isWritable: true },  // buffer
                    { pubkey: walletPubkey, isSigner: false, isWritable: true },  // recipient
                    { pubkey: walletPubkey, isSigner: true, isWritable: false },  // authority
                ],
                data
            })
        );
    }

    return instructions;
}

/**
 * Estimates the fees and SOL amounts for a buffer close operation.
 * Use this to show the user a preview before they confirm.
 */
export function estimateBufferClose(
    bufferInfos: Array<{ lamports: number }>,
    networkFeeSOL = 0.000005
): BufferCloseEstimate {
    const totalLamports = bufferInfos.reduce((acc, b) => acc + b.lamports, 0);
    const totalSOL = totalLamports / 1e9;
    const serviceFeeSOL = totalSOL * (BUFFER_CLOSE_FEE_PERCENT / 100);
    const userReceivesSOL = totalSOL - serviceFeeSOL;

    return {
        selectedCount: bufferInfos.length,
        totalLamports,
        totalSOL,
        serviceFeeSOL,
        networkFeeSOL,
        userReceivesSOL,
    };
}
