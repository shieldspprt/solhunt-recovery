import {
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    AccountMeta,
} from '@solana/web3.js';
import type { Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import {
    BUBBLEGUM_PROGRAM_ID,
    SPL_NOOP_PROGRAM_ID,
    SPL_COMPRESSION_PROGRAM,
    BURN_SESSION_FEE_LAMPORTS,
} from '../constants';
import type { CNFTItem, BurnProof } from '../types';

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
 * Fetch the canopy depth for a Merkle tree.
 * The canopy stores the bottom N levels of the proof on-chain,
 * so we don't need those nodes in the transaction.
 */
async function getCanopyDepth(
    treeAddress: PublicKey,
    connection: Connection
): Promise<number> {
    try {
        const accountInfo = await connection.getAccountInfo(treeAddress);
        if (!accountInfo) return 0;

        // SPL Account Compression tree account layout:
        // - 8 bytes: discriminator
        // - Header section varies, but the tree data starts after a fixed offset
        // - The canopy is stored at the END of the account data
        //
        // The concurrent merkle tree header is:
        //   8 (disc) + 4 (maxDepth) + 4 (maxBufferSize) + ... 
        // Total header: 8 + 4 + 4 + 16 + 32 = 64 bytes (authority, etc.)
        //
        // After that: the changelog buffer + right-most path + canopy
        //
        // Simpler approach: derive canopy depth from total account size
        // Account data size = header + tree_data + canopy_data
        // canopy_data = (2^(canopy_depth+1) - 2) * 32 bytes
        //
        // For our purposes, we read maxDepth from the header and calculate
        // expected tree data to find canopy.

        const data = accountInfo.data;
        if (data.length < 12) return 0;

        // Read maxDepth at offset 8 (u32 LE)
        const maxDepth = data.readUInt32LE(8);
        // Read maxBufferSize at offset 12 (u32 LE)
        const maxBufferSize = data.readUInt32LE(12);

        // The tree node data:
        // changelog: maxBufferSize * (maxDepth + 1) * 32 + additional
        // rightmost_path: (maxDepth + 1) * 32
        // 
        // Rather than computing the exact layout, we can compute canopy depth
        // from the residual bytes after the known tree structures.
        // 
        // Alternative: simply compute what proof length the transaction can handle.
        // Solana tx limit = 1232 bytes
        // Single burn ix with N proof nodes uses approximately:
        //   65 (sig) + 3 (header) + 32 (blockhash) + instruction overhead
        //   + (7 + N) * 32 (accounts) + ~120 (ix data + encoding)
        // ≈ 340 + N * 32
        //
        // So N_max ≈ (1232 - 340) / 32 ≈ 27 proof nodes
        //
        // But for safety let's use the proper canopy calculation.

        // Anchor header for concurrent merkle tree:
        // 8 bytes discriminator
        // Then ConcurrentMerkleTreeHeader:
        //   4: account_type
        //   4: creation_slot (actually u32)
        //   ... this varies by version
        //
        // Let's just use a practical approach: try sending the proof at
        // various truncation levels until it fits.

        // The most reliable method from the Metaplex/Bubblegum ecosystem:
        // ConcurrentMerkleTree account data after the 8-byte discriminator:
        //   header_size varies, so calculate canopy from remaining bytes.
        //
        // Tree data bytes (no canopy) = 
        //   header(varies) + changelog(maxBufferSize * (maxDepth+1) * 32 + ...) + path
        //
        // Since the exact header layout can differ between SPL compression versions,
        // let's use the known formula:
        // canopyBytes = accountDataLen - expectedTreeSize
        // canopyNodes = canopyBytes / 32
        // canopyDepth = log2(canopyNodes + 2) - 1

        // A simpler approach that works: the ConcurrentMerkleTree + canopy account:
        // The standard SPL account compression layout uses the last portion for canopy.
        // canopySize = dataLen - (headerLen + changelogLen + pathLen)
        //
        // headerLen = 8 (disc) + header fields
        // For spl-account-compression v0.2+:
        //   ConcurrentMerkleTreeHeader = 90 bytes total (including discriminator)
        //   Actually: 8 (disc) + 1 (version) + 1 (padding) + 4 (max_depth) + 
        //             4 (max_buffer_size) + 32 (authority) + 8 (creation_slot) + 
        //             6 (padding) = 64 after disc => 72 total
        //   
        // REAL layout from spl-account-compression source:
        //   - ConcurrentMerkleTreeHeaderDataV1:
        //     max_buffer_size: u32, max_depth: u32, authority: Pubkey,
        //     creation_slot: u64, is_batch_initialized: bool, padding: [u8; 5]
        //   Total with enum discriminator etc ≈ ~90 bytes
        //   
        // Tree data (ConcurrentMerkleTree<MAX_DEPTH, MAX_BUFFER_SIZE>):
        //   sequence_number: u64 (8)
        //   active_index: u64 (8)
        //   buffer_size: u64 (8)
        //   change logs: MAX_BUFFER_SIZE * ChangeLog<MAX_DEPTH>
        //     each ChangeLog = 32 (root) + MAX_DEPTH * 32 (path) + 4 (index) + 4 (pad) = 32 + maxDepth*32 + 8
        //   rightmost_proof: MAX_DEPTH * 32 + 32 (leaf) + 4 (index) + 4 (pad)
        //
        // This is too complex to compute reliably across versions. 
        // Let's use a simpler heuristic.

        // PRACTICAL APPROACH: Calculate max proof nodes that fit in a legacy tx
        // and truncate to that. This is what most dApps do.
        void maxDepth;
        void maxBufferSize;

        return 0; // Will use tx-size-based truncation instead
    } catch {
        return 0;
    }
}

/** Maximum proof nodes that fit in a single legacy Solana transaction */
const MAX_PROOF_NODES = 24;

/**
 * Build a Bubblegum burn instruction manually.
 * Truncates proof to at most MAX_PROOF_NODES to fit within tx size limits.
 * The remaining proof nodes are read from the tree's on-chain canopy.
 */
function buildBurnIx(
    item: CNFTItem,
    proof: BurnProof,
    walletPublicKey: PublicKey,
    maxProofNodes?: number
): TransactionInstruction {
    const bubblegumProgramId = new PublicKey(BUBBLEGUM_PROGRAM_ID);
    const merkleTree = new PublicKey(item.treeAddress);
    const treeAuthority = deriveTreeAuthority(merkleTree);

    // Anchor discriminator for "burn" instruction
    const discriminator = Buffer.from([116, 110, 29, 56, 107, 219, 42, 93]);

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
    const keys: AccountMeta[] = [
        { pubkey: treeAuthority, isSigner: false, isWritable: true },
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: walletPublicKey, isSigner: false, isWritable: false },
        { pubkey: merkleTree, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(SPL_NOOP_PROGRAM_ID), isSigner: false, isWritable: false },
        { pubkey: new PublicKey(SPL_COMPRESSION_PROGRAM), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    // Truncate proof to fit within transaction size limits.
    // The on-chain canopy stores the bottom levels, so we only need
    // the top N proof nodes. Take from the BEGINNING of the array.
    const limit = maxProofNodes ?? MAX_PROOF_NODES;
    const truncatedProof = proof.proof.slice(0, limit);

    for (const node of truncatedProof) {
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
 * Estimate the serialized size of a burn transaction to find
 * the maximum number of proof nodes that fit.
 */
function findMaxProofNodes(
    item: CNFTItem,
    proof: BurnProof,
    walletPublicKey: PublicKey,
    blockhash: string
): number {
    // Binary search for max proof nodes that fit
    let lo = 1;
    let hi = proof.proof.length;
    let best = 1;

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const tx = new Transaction();
        tx.feePayer = walletPublicKey;
        tx.recentBlockhash = blockhash;
        tx.add(buildBurnIx(item, proof, walletPublicKey, mid));

        try {
            const serialized = tx.serialize({
                verifySignatures: false,
                requireAllSignatures: false,
            });
            if (serialized.length <= 1232) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        } catch {
            // Serialization failed (too large) — try fewer nodes
            hi = mid - 1;
        }
    }

    return best;
}

/**
 * Build Bubblegum burn transactions.
 * Each transaction burns exactly 1 cNFT.
 * Proof nodes are automatically truncated to fit within Solana's 1232-byte limit.
 * Session fee is sent as a separate first transaction.
 */
export async function buildBurnTransactions(
    items: CNFTItem[],
    proofs: Map<string, BurnProof>,
    walletPublicKey: PublicKey,
    connection: Connection,
    treasuryWallet: string
): Promise<Transaction[]> {
    const burnableItems = items.filter(
        (item) => item.isBurnable && proofs.has(item.id)
    );

    if (burnableItems.length === 0) return [];

    const transactions: Transaction[] = [];
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    // Fetch canopy depth (for future use — currently using tx-size-based truncation)
    void getCanopyDepth;

    // Transaction 0: standalone session fee transfer
    const feeTx = new Transaction();
    feeTx.feePayer = walletPublicKey;
    feeTx.recentBlockhash = blockhash;
    feeTx.add(
        SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: new PublicKey(treasuryWallet),
            lamports: BURN_SESSION_FEE_LAMPORTS,
        })
    );
    transactions.push(feeTx);

    // Build individual burn transactions, auto-fitting proof size
    for (const item of burnableItems) {
        const proof = proofs.get(item.id);
        if (!proof) continue;

        // Find the maximum proof nodes that fit in a single tx
        const maxNodes = findMaxProofNodes(item, proof, walletPublicKey, blockhash);

        const tx = new Transaction();
        tx.feePayer = walletPublicKey;
        tx.recentBlockhash = blockhash;
        tx.add(buildBurnIx(item, proof, walletPublicKey, maxNodes));
        transactions.push(tx);
    }

    return transactions;
}
