/**
 * Transaction security verification.
 *
 * Verifies that every transaction contains ONLY instructions
 * for allowed program IDs before the user signs.
 *
 * Audit Spec §2.2 — Transaction Instruction Verification.
 */
import {
    PublicKey,
    SystemProgram,
    StakeProgram,
    Transaction,
    VersionedTransaction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
    BUBBLEGUM_PROGRAM_ID,
    SPL_NOOP_PROGRAM_ID,
    SPL_COMPRESSION_PROGRAM,
} from '@/modules/cnft-cleaner/constants';
import {
    MARINADE_PROGRAM_ID,
} from '@/config/constants';

/**
 * Whitelist of program IDs that our transactions are allowed to interact with.
 * Any transaction containing an instruction for a program NOT in this set
 * will be rejected before signing.
 */
const ALLOWED_PROGRAM_IDS = new Set<string>([
    // Core Solana
    SystemProgram.programId.toString(),
    TOKEN_PROGRAM_ID.toString(),
    TOKEN_2022_PROGRAM_ID.toString(),
    StakeProgram.programId.toString(),

    // Compute budget (priority fees)
    'ComputeBudget111111111111111111111111111111',

    // cNFT / Bubblegum
    BUBBLEGUM_PROGRAM_ID,
    SPL_NOOP_PROGRAM_ID,
    SPL_COMPRESSION_PROGRAM,

    // Staking protocols
    MARINADE_PROGRAM_ID,

    // LP harvesting — Orca, Raydium, Meteora
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',  // Orca Whirlpool
    'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',  // Raydium CLMM
    'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',  // Meteora DLMM

    // Associated Token Account program (used when creating ATAs for harvests)
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
]);

/**
 * Verifies a Legacy Transaction against the program whitelist.
 * Throws if any instruction targets an unknown program.
 */
function verifyLegacyTransaction(tx: Transaction): void {
    for (const ix of tx.instructions) {
        const programId = ix.programId.toString();
        if (!ALLOWED_PROGRAM_IDS.has(programId)) {
            throw new Error(
                `SECURITY: Unexpected program ID in transaction: ${programId}`
            );
        }
    }
}

/**
 * Verifies a Versioned Transaction against the program whitelist.
 * Throws if any instruction targets an unknown program.
 */
function verifyVersionedTransaction(tx: VersionedTransaction): void {
    for (const ix of tx.message.compiledInstructions) {
        const programKey = tx.message.staticAccountKeys[ix.programIdIndex];
        if (!programKey) {
            throw new Error('SECURITY: Transaction instruction references missing account key.');
        }
        const programId = programKey.toString();
        if (!ALLOWED_PROGRAM_IDS.has(programId)) {
            throw new Error(
                `SECURITY: Unexpected program ID in transaction: ${programId}`
            );
        }
    }
}

/**
 * Verifies a transaction before signing.
 *
 * Call this BEFORE every `signTransaction()` or `sendTransaction()` call.
 * Also validates fee payer matches the connected wallet public key.
 */
export function verifyTransactionSecurity(
    tx: Transaction | VersionedTransaction,
    expectedFeePayer?: PublicKey
): void {
    if (tx instanceof Transaction) {
        verifyLegacyTransaction(tx);

        // Verify fee payer
        if (expectedFeePayer && tx.feePayer && !tx.feePayer.equals(expectedFeePayer)) {
            throw new Error('SECURITY: Transaction fee payer does not match connected wallet.');
        }

        // Verify instruction count limit
        if (tx.instructions.length > 25) {
            throw new Error(
                `SECURITY: Transaction has ${tx.instructions.length} instructions, exceeds limit of 25.`
            );
        }
    } else {
        verifyVersionedTransaction(tx);

        // Verify fee payer for versioned transactions
        if (expectedFeePayer) {
            const feePayer = tx.message.staticAccountKeys[0];
            if (feePayer && !feePayer.equals(expectedFeePayer)) {
                throw new Error('SECURITY: Versioned transaction fee payer does not match connected wallet.');
            }
        }
    }
}
