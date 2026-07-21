/**
 * Shared utilities for working with SPL Token program IDs.
 */
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import type { TokenProgramId } from '@/types';

/**
 * Converts our TokenProgramId string literal type to the actual PublicKey
 * used in SPL Token instruction builders.
 *
 * This exists because we store program IDs as string literals in types/interfaces
 * (to avoid serialization issues in Zustand) but SPL Token instruction functions
 * expect actual PublicKey instances.
 */
export function toTokenProgramPublicKey(programId: TokenProgramId): PublicKey {
    if (programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
        return TOKEN_2022_PROGRAM_ID;
    }
    return TOKEN_PROGRAM_ID;
}
