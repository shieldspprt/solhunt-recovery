import {
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
} from '@solana/web3.js';
import type { Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import {
    BUBBLEGUM_PROGRAM_ID,
    SPL_NOOP_PROGRAM_ID,
    SPL_COMPRESSION_PROGRAM,
    BURN_SESSION_FEE_LAMPORTS,
    MAX_BURNS_PER_TX,
} from '../constants';
import type { CNFTItem, BurnProof } from '../types';

function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/**
 * Derive the tree authority PDA for a Merkle tree.
 */
function deriveTreeAuthority(merkleTree: PublicKey): PublicKey {
    const [treeAuthority] = PublicKey.findProgramAddressSync(
        [merkleTree.toBuffer()],
        new PublicKey(BUBBLEGUM_PROGRAM_ID)
    );
    return treeAuthority;
}

/**
 * Build a Bubblegum burn instruction manually.
 * The mpl-bubblegum v5 uses Umi and is incompatible with @solana/web3.js v1,
 * so we build the instruction directly from the program IDL.
 *
 * Bubblegum burn instruction discriminator: [116, 110, 29, 56, 107, 219, 42, 93]
 */
function buildBurnIx(
    item: CNFTItem,
    proof: BurnProof,
    walletPublicKey: PublicKey
): TransactionInstruction {
    const bubblegumProgramId = new PublicKey(BUBBLEGUM_PROGRAM_ID);
    const merkleTree = new PublicKey(item.treeAddress);
    const treeAuthority = deriveTreeAuthority(merkleTree);

    // Anchor discriminator for "burn" instruction
    const discriminator = Buffer.from([116, 110, 29, 56, 107, 219, 42, 93]);

    // Encode args: root (32 bytes), data_hash (32 bytes), creator_hash (32 bytes),
    // nonce (u64 LE), index (u32 LE)
    const rootBytes = bs58.decode(proof.root);
    const dataHashBytes = bs58.decode(item.dataHash);
    const creatorHashBytes = bs58.decode(item.creatorHash);

    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigUInt64LE(BigInt(item.leafIndex));

    const indexBuf = Buffer.alloc(4);
    indexBuf.writeUInt32LE(item.leafIndex);

    const data = Buffer.concat([
        discriminator,
        rootBytes,
        dataHashBytes,
        creatorHashBytes,
        nonceBuf,
        indexBuf,
    ]);

    // Account keys for burn instruction
    const keys = [
        { pubkey: treeAuthority, isSigner: false, isWritable: true },
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },    // leaf_owner
        { pubkey: walletPublicKey, isSigner: false, isWritable: false },   // leaf_delegate
        { pubkey: merkleTree, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(SPL_NOOP_PROGRAM_ID), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(SPL_COMPRESSION_PROGRAM), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    // Append proof nodes as remaining accounts
    for (const node of proof.proof) {
        keys.push({
            pubkey: new PublicKey(node),
            isSigner: false,
            isWritable: false,
        });
    }

    return new TransactionInstruction({
        programId: bubblegumProgramId,
        keys,
        data,
    });
}

/**
 * Build batched Bubblegum burn transactions.
 * Each transaction burns MAX_BURNS_PER_TX cNFTs.
 * First transaction includes the flat session fee transfer.
 */
export async function buildBurnTransactions(
    items: CNFTItem[],
    proofs: Map<string, BurnProof>,
    walletPublicKey: PublicKey,
    connection: Connection,
    treasuryWallet: string
): Promise<Transaction[]> {
    // Filter to items with proofs and that are burnable
    const burnableItems = items.filter(
        (item) => item.isBurnable && proofs.has(item.id)
    );

    if (burnableItems.length === 0) return [];

    const batches = chunk(burnableItems, MAX_BURNS_PER_TX);
    const transactions: Transaction[] = [];
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const tx = new Transaction();
        tx.feePayer = walletPublicKey;
        tx.recentBlockhash = blockhash;

        for (const item of batch) {
            const proof = proofs.get(item.id);
            if (!proof) continue;

            const burnIx = buildBurnIx(item, proof, walletPublicKey);
            tx.add(burnIx);
        }

        // Add session fee to FIRST transaction only
        if (batchIndex === 0) {
            tx.add(
                SystemProgram.transfer({
                    fromPubkey: walletPublicKey,
                    toPubkey: new PublicKey(treasuryWallet),
                    lamports: BURN_SESSION_FEE_LAMPORTS,
                })
            );
        }

        transactions.push(tx);
    }

    return transactions;
}
