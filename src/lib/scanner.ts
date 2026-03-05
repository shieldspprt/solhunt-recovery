import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import type {
    TokenDelegation,
    EmptyTokenAccount,
    TokenHolding,
    ScanResult,
    RiskLevel,
    TokenProgramId,
    AppError,
} from '@/types';
import {
    KNOWN_DELEGATE_ADDRESSES,
    RENT_PER_TOKEN_ACCOUNT_LAMPORTS,
    RENT_PER_TOKEN_ACCOUNT_SOL,
    ERROR_CODES,
    ERROR_MESSAGES,
} from '@/config/constants';
import { isValidSolanaPublicKey } from '@/lib/validation';

/**
 * Parsed token account info shape from Solana RPC.
 * We validate this defensively — never trust raw RPC responses.
 */
interface ParsedAccountInfo {
    mint?: string;
    owner?: string;
    delegate?: string;
    delegatedAmount?: { amount?: string; decimals?: number; uiAmount?: number };
    tokenAmount?: { amount?: string; decimals?: number; uiAmount?: number };
}

/**
 * Creates an AppError with the proper shape.
 */
function createAppError(
    code: keyof typeof ERROR_CODES,
    technicalDetail: string
): AppError {
    return {
        code: ERROR_CODES[code],
        message: ERROR_MESSAGES[code],
        technicalDetail,
    };
}

/**
 * Calculates risk level for a delegation.
 * - HIGH if ownerBalance > 0 (tokens present, can be drained)
 * - MEDIUM if ownerBalance === 0 but delegatedAmount > 0
 * - LOW if both are 0 (stale permission)
 */
function calculateRiskLevel(
    ownerBalance: number,
    delegatedAmount: string
): RiskLevel {
    const parsedDelegatedAmount = parseFloat(delegatedAmount);

    // If the delegate has permission to move > 0 tokens and you have a balance
    if (ownerBalance > 0 && parsedDelegatedAmount > 0) return 'HIGH';

    // If the delegate has permission, but your account is empty
    if (ownerBalance === 0 && parsedDelegatedAmount > 0) return 'MEDIUM';

    // If permission is 0 (exhausted), or both are 0
    return 'LOW';
}

/**
 * Fetches parsed token accounts for a given owner and program ID.
 * Retries ONCE with exponential backoff on failure.
 */
async function fetchTokenAccounts(
    connection: Connection,
    ownerPubkey: PublicKey,
    programId: PublicKey
): Promise<
    Array<{
        pubkey: PublicKey;
        account: { data: { parsed: { info: ParsedAccountInfo } } };
    }>
> {
    const fetchOnce = async () => {
        const result = await connection.getParsedTokenAccountsByOwner(
            ownerPubkey,
            { programId },
            'confirmed'
        );
        return result.value;
    };

    try {
        return await fetchOnce();
    } catch (firstError) {
        // Retry once with 500ms delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
            return await fetchOnce();
        } catch (retryError) {
            throw createAppError(
                'RPC_ERROR',
                `Failed after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`
            );
        }
    }
}

/**
 * Scans a wallet for all token delegations and empty token accounts.
 *
 * This is the most important function in the app. It:
 * 1. Validates the wallet address
 * 2. Fetches all token accounts (SPL Token + Token-2022)
 * 3. Identifies accounts with active delegations
 * 4. Identifies empty accounts (for rent reclaim info)
 * 5. Returns a complete ScanResult
 */
export async function scanWalletForDelegations(
    walletAddress: string,
    connection: Connection
): Promise<ScanResult> {
    const startTime = Date.now();

    // Step 1: Validate wallet address
    if (!isValidSolanaPublicKey(walletAddress)) {
        throw createAppError(
            'INVALID_ADDRESS',
            `Invalid address provided: ${walletAddress.substring(0, 10)}...`
        );
    }

    const ownerPubkey = new PublicKey(walletAddress);

    // Step 2 & 3: Fetch token accounts from both token programs
    let allAccounts: Array<{
        pubkey: PublicKey;
        account: { data: { parsed: { info: ParsedAccountInfo } } };
        programId: TokenProgramId;
    }> = [];

    try {
        const [splAccounts, token2022Accounts] = await Promise.all([
            fetchTokenAccounts(connection, ownerPubkey, TOKEN_PROGRAM_ID),
            fetchTokenAccounts(connection, ownerPubkey, TOKEN_2022_PROGRAM_ID),
        ]);

        // Tag each account with its program ID
        allAccounts = [
            ...splAccounts.map((a) => ({
                ...a,
                programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as TokenProgramId,
            })),
            ...token2022Accounts.map((a) => ({
                ...a,
                programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as TokenProgramId,
            })),
        ];
    } catch (error) {
        // If the error is already an AppError, rethrow it
        if (error && typeof error === 'object' && 'code' in error) {
            throw error;
        }
        throw createAppError(
            'RPC_ERROR',
            `Failed to fetch token accounts: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    // Step 5 & 6: Process each account
    const delegations: TokenDelegation[] = [];
    const emptyAccounts: EmptyTokenAccount[] = [];
    const tokenHoldings: TokenHolding[] = [];

    for (const account of allAccounts) {
        // Defensive access — never trust raw RPC responses (Section 10.2)
        const parsed = account.account?.data?.parsed?.info;
        if (!parsed || typeof parsed !== 'object') continue;

        const delegate = parsed.delegate ?? null;
        const tokenAmount = parsed.tokenAmount;

        // Parse balance info
        const ownerBalance = tokenAmount?.uiAmount ?? 0;
        const ownerBalanceRaw = tokenAmount?.amount ?? '0';
        const decimals = tokenAmount?.decimals ?? 0;
        const mint = parsed.mint ?? '';

        // If this account has a delegation, record it
        if (delegate) {
            const delegatedAmountRaw = parsed.delegatedAmount?.amount ?? '0';

            const riskLevel = calculateRiskLevel(ownerBalance, delegatedAmountRaw);
            const isKnownDelegate = KNOWN_DELEGATE_ADDRESSES.has(delegate);

            delegations.push({
                tokenAccountAddress: account.pubkey.toBase58(),
                mint,
                delegate,
                delegatedAmount: delegatedAmountRaw,
                ownerBalance,
                ownerBalanceRaw,
                decimals,
                tokenSymbol: 'UNKNOWN', // Token symbol resolution would require on-chain metadata lookup
                programId: account.programId,
                riskLevel,
                isKnownDelegate,
            });
        }

        // If this account has a positive balance, include it in token holdings (Engine 3 input)
        if (ownerBalance > 0) {
            tokenHoldings.push({
                tokenAccountAddress: account.pubkey.toBase58(),
                mint,
                rawBalance: ownerBalanceRaw,
                uiBalance: ownerBalance,
                decimals,
                programId: account.programId,
            });
        }

        // Step 7: If empty account (no balance, no delegation), track for rent reclaim
        if (ownerBalance === 0 && !delegate) {
            emptyAccounts.push({
                address: account.pubkey.toBase58(),
                mint,
                estimatedRentLamports: RENT_PER_TOKEN_ACCOUNT_LAMPORTS,
                programId: account.programId,
            });
        }
    }

    // Sort delegations: HIGH risk first, then MEDIUM, then LOW
    const riskOrder: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    delegations.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

    // Step 8 & 9: Calculate recoverable SOL and build result
    const estimatedRecoverableSOL = emptyAccounts.length * RENT_PER_TOKEN_ACCOUNT_SOL;
    const scanDurationMs = Date.now() - startTime;

    return {
        walletAddress,
        scannedAt: new Date(),
        totalTokenAccounts: allAccounts.length,
        delegations,
        emptyAccounts,
        tokenHoldings,
        estimatedRecoverableSOL,
        scanDurationMs,
    };
}
