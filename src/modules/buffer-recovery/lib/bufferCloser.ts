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

/**
 * Builds instructions to close BPFLoaderUpgradeable buffers and handle fees.
 */
export function createCloseBufferInstructions(
    walletAddress: string,
    bufferAddresses: string[],
    totalRecoverableSOL: number
): TransactionInstruction[] {
    const walletPubkey = new PublicKey(walletAddress);
    const instructions: TransactionInstruction[] = [];

    // 1. Service Fee Instruction
    const totalLamports = bufferAddresses.length > 0 ? (totalRecoverableSOL * 1e9) : 0;
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

    // 2. Close Buffer Instructions
    bufferAddresses.forEach((addr) => {
        const bufferPubkey = new PublicKey(addr);

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
    });

    return instructions;
}
