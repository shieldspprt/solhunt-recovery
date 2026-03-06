/**
 * Centralized priority fee utility.
 *
 * Fetches an optimal priority fee from the Helius RPC
 * (getRecentPrioritizationFees) and provides helper functions
 * to build ComputeBudget instructions.
 */
import {
    ComputeBudgetProgram,
    type Connection,
    type TransactionInstruction,
} from '@solana/web3.js';

// ─── Defaults ──────────────────────────────────────────────
/** Fallback if the RPC call fails (50k micro-lamports ≈ 0.000005 SOL per 200k CU) */
export const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 100_000;

/** Default compute unit budget — most simple instructions use <200k */
export const DEFAULT_COMPUTE_UNITS = 200_000;

/** Aggressive compute unit budget for complex burns / swaps */
export const HIGH_COMPUTE_UNITS = 400_000;

// ─── Fee Fetcher ──────────────────────────────────────────

interface PrioritizationFee {
    prioritizationFee: number;
    slot: number;
}

/**
 * Fetch a recent optimal priority fee from the RPC.
 * Uses the p75 of recent fees (balances cost vs. speed).
 */
export async function getOptimalPriorityFee(
    connection: Connection
): Promise<number> {
    try {
        const fees: PrioritizationFee[] = await (
            connection as unknown as {
                getRecentPrioritizationFees: () => Promise<PrioritizationFee[]>;
            }
        ).getRecentPrioritizationFees();

        if (!fees || fees.length === 0) {
            return DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS;
        }

        // Sort ascending and pick p75
        const sorted = fees
            .map((f) => f.prioritizationFee)
            .filter((f) => f > 0)
            .sort((a, b) => a - b);

        if (sorted.length === 0) {
            return DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS;
        }

        const p75Index = Math.floor(sorted.length * 0.75);
        const p75Fee = sorted[p75Index];

        // Clamp between 10k and 1M micro-lamports
        return Math.max(10_000, Math.min(p75Fee, 1_000_000));
    } catch {
        return DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS;
    }
}

// ─── Instruction Builders ──────────────────────────────────

/**
 * Build ComputeBudget instructions for priority fees.
 * These should be PREPENDED to the transaction instructions.
 *
 * @returns [setComputeUnitLimit, setComputeUnitPrice]
 */
export function buildPriorityFeeIxs(
    microLamports: number,
    computeUnits: number = DEFAULT_COMPUTE_UNITS
): TransactionInstruction[] {
    return [
        ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
    ];
}
