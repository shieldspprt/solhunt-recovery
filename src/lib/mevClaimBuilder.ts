import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import type { MEVClaimItem } from '@/types';
import {
    CLAIM_DISCRIMINATOR,
    CLAIM_STATUS_SEED,
    MEV_MAX_CLAIMS_PER_TX,
    MEV_SERVICE_FEE_DENOMINATOR,
    MEV_SERVICE_FEE_PERCENT,
    TIP_DISTRIBUTION_PROGRAM_ID,
    TREASURY_WALLET,
} from '@/config/constants';
import { getOptimalPriorityFee, buildPriorityFeeIxs } from '@/lib/priorityFee';
import { logger } from './logger';
import { verifyTransactionSecurity } from './transactionVerifier';
import { chunk } from '@/lib/arrayUtils';

/**
 * Build batched claim transactions for selected MEV rewards.
 * 
 * Each transaction claims MEV_MAX_CLAIMS_PER_TX rewards.
 * The service fee (5% of total claimed) is appended to the LAST transaction.
 * 
 * Important: MEV tip claims and priority fee claims for the same
 * stake account + epoch may be in separate TDAs — handle both.
 */
export async function buildMEVClaimTransactions(
    items: MEVClaimItem[],
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    const batches = chunk(items, MEV_MAX_CLAIMS_PER_TX);
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const priorityFee = await getOptimalPriorityFee(connection);

    // Calculate total service fee
    const totalLamports = items.reduce((sum, i) => sum + i.totalLamports, 0);
    const serviceFeeLamports = Math.floor(
        (totalLamports * MEV_SERVICE_FEE_PERCENT) / Math.max(1, MEV_SERVICE_FEE_DENOMINATOR)
    );

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const tx = new Transaction();
        tx.feePayer = walletPublicKey;
        tx.recentBlockhash = blockhash;

        // Add priority fees to each transaction
        for (const ix of buildPriorityFeeIxs(priorityFee)) {
            tx.add(ix);
        }

        // Add claim instruction for each item in batch
        for (const item of batch) {
            const claimIx = buildSingleClaimInstruction(item, walletPublicKey);
            if (claimIx) tx.add(claimIx);
        }

        // Add service fee to LAST transaction only
        if (batchIdx === batches.length - 1 && serviceFeeLamports > 0) {
            tx.add(SystemProgram.transfer({
                fromPubkey: walletPublicKey,
                toPubkey: TREASURY_WALLET,
                lamports: serviceFeeLamports,
            }));
        }

        // Security audit: verify transaction only contains allowed instructions
        verifyTransactionSecurity(tx, walletPublicKey);

        // Safety check: verify transaction size
        const serialized = tx.serialize({ requireAllSignatures: false });
        if (serialized.length > 1200) {
            logger.warn('MEV claim tx approaching size limit', serialized.length);
            // We accept it, as 1232 is the strict limit and we chunked it via MEV_MAX_CLAIMS_PER_TX
        }

        transactions.push(tx);
    }

    return transactions;
}

function buildSingleClaimInstruction(
    item: MEVClaimItem,
    walletPublicKey: PublicKey
): TransactionInstruction | null {
    try {
        // Derive ClaimStatus PDA
        const [claimStatusPDA] = PublicKey.findProgramAddressSync(
            [
                CLAIM_STATUS_SEED,
                walletPublicKey.toBuffer(),
                new PublicKey(item.tipDistributionAccount).toBuffer(),
            ],
            new PublicKey(TIP_DISTRIBUTION_PROGRAM_ID)
        );

        // Build merkle proof buffer
        const proofNodes = item.merkleProof.map((node) =>
            Buffer.from(bs58.decode(node))
        );

        // Build instruction data
        const data = buildClaimInstructionData(
            item.totalLamports,
            proofNodes
        );

        return new TransactionInstruction({
            programId: new PublicKey(TIP_DISTRIBUTION_PROGRAM_ID),
            keys: [
                {
                    pubkey: new PublicKey(item.tipDistributionAccount),
                    isSigner: false,
                    isWritable: true,
                },
                {
                    pubkey: claimStatusPDA,
                    isSigner: false,
                    isWritable: true,
                },
                {
                    pubkey: walletPublicKey,   // claimant = stake owner
                    isSigner: false,
                    isWritable: true,
                },
                {
                    pubkey: walletPublicKey,   // payer of account creation
                    isSigner: true,
                    isWritable: true,
                },
                {
                    pubkey: SystemProgram.programId,
                    isSigner: false,
                    isWritable: false,
                },
            ],
            data,
        });
    } catch (err: unknown) {
        logger.error('buildSingleClaimInstruction failed', err);
        return null;
    }
}

function buildClaimInstructionData(
    amountLamports: number,
    proofNodes: Buffer[]
): Buffer {
    const proofLength = proofNodes.length;
    const dataLength = 8 + 8 + 4 + (proofLength * 32);
    const buf = Buffer.alloc(dataLength);
    let offset = 0;

    // 8-byte discriminator
    Buffer.from(CLAIM_DISCRIMINATOR).copy(buf, offset);
    offset += 8;

    // Amount as u64 little-endian
    buf.writeBigUInt64LE(BigInt(amountLamports), offset);
    offset += 8;

    // Proof length as u32
    buf.writeUInt32LE(proofLength, offset);
    offset += 4;

    // Proof nodes
    for (const node of proofNodes) {
        node.copy(buf, offset);
        offset += 32;
    }

    return buf;
}
