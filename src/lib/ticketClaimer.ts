import {
    Connection,
    PublicKey,
    StakeProgram,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    VersionedTransaction,
} from '@solana/web3.js';
import type {
    AppError,
    StakingTicket,
    TicketClaimResult,
    TicketClaimStatus,
    TicketProgressStatus,
} from '@/types';
import {
    ERROR_CODES,
    ERROR_MESSAGES,
    MARINADE_CLAIM_DISCRIMINATOR,
    MARINADE_PROGRAM_ID,
    MARINADE_STATE_ADDRESS,
    SANCTUM_REDEEM_API,
    TICKET_CLAIM_FEE_PERCENT,
    TREASURY_WALLET,
} from '@/config/constants';
import { getOptimalPriorityFee, buildPriorityFeeIxs } from '@/lib/priorityFee';

type SendTransactionFn = (
    transaction: Transaction | VersionedTransaction,
    connection: Connection
) => Promise<string>;

interface ClaimProgressUpdate {
    id: string;
    status: TicketProgressStatus;
    signature: string | null;
    claimedSOL: number;
    message: string;
}

interface ClaimAllTicketsParams {
    tickets: StakingTicket[];
    walletPublicKey: PublicKey;
    sendTransaction: SendTransactionFn;
    connection: Connection;
    onProgress?: (update: ClaimProgressUpdate) => void;
}

interface MarinadeSdkClaimResponse {
    transaction?: Transaction;
}

interface MarinadeSdkInstance {
    claim: (ticketAddress: PublicKey) => Promise<MarinadeSdkClaimResponse | Transaction>;
}

interface MarinadeSdkModule {
    Marinade: new (config: unknown) => MarinadeSdkInstance;
    MarinadeConfig: new (config: { connection: Connection; publicKey: PublicKey }) => unknown;
}

interface SanctumRedeemResponse {
    transaction?: string;
}

type TxInstructionData = ConstructorParameters<typeof TransactionInstruction>[0]['data'];

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

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function statusFromEpoch(
    claimableAfterEpoch: number | null,
    currentEpoch: number
): TicketClaimStatus {
    if (claimableAfterEpoch === null) return 'unknown';
    return currentEpoch >= claimableAfterEpoch ? 'claimable' : 'pending';
}

function parseLamports(valueLamports: string): bigint {
    try {
        return BigInt(valueLamports);
    } catch {
        return 0n;
    }
}

function toLamportsNumber(lamports: bigint): number {
    if (lamports <= 0n) return 0;
    if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number.MAX_SAFE_INTEGER;
    }
    return Number(lamports);
}

function ensureTransactionFeePayer(
    transaction: Transaction | VersionedTransaction,
    walletPublicKey: PublicKey
): void {
    if (transaction instanceof VersionedTransaction) {
        const feePayer = transaction.message.staticAccountKeys[0];
        if (!feePayer || !feePayer.equals(walletPublicKey)) {
            throw createAppError(
                'TICKET_CLAIM_FAILED',
                `Versioned transaction fee payer mismatch for ${walletPublicKey.toBase58()}.`
            );
        }
        return;
    }

    if (transaction.feePayer && !transaction.feePayer.equals(walletPublicKey)) {
        throw createAppError(
            'TICKET_CLAIM_FAILED',
            `Transaction fee payer mismatch for ${walletPublicKey.toBase58()}.`
        );
    }
}

async function confirmSignature(connection: Connection, signature: string): Promise<void> {
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
        throw new Error(`On-chain confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
    }
}

export function buildStakeWithdrawInstruction(
    ticket: StakingTicket,
    walletPublicKey: PublicKey,
    withdrawAmountLamports: number
): TransactionInstruction {
    const tx = StakeProgram.withdraw({
        stakePubkey: new PublicKey(ticket.ticketAccountAddress),
        authorizedPubkey: walletPublicKey,
        toPubkey: walletPublicKey,
        lamports: withdrawAmountLamports,
        custodianPubkey: undefined,
    });

    const instruction = tx.instructions[0];
    if (!instruction) {
        throw createAppError(
            'TICKET_CLAIM_FAILED',
            `Could not build withdraw instruction for ${ticket.ticketAccountAddress}.`
        );
    }

    return instruction;
}

function buildFallbackMarinadeClaimInstruction(
    ticket: StakingTicket,
    walletPublicKey: PublicKey
): TransactionInstruction {
    return new TransactionInstruction({
        programId: new PublicKey(MARINADE_PROGRAM_ID),
        keys: [
            { pubkey: new PublicKey(MARINADE_STATE_ADDRESS), isSigner: false, isWritable: false },
            { pubkey: new PublicKey(ticket.ticketAccountAddress), isSigner: false, isWritable: true },
            { pubkey: walletPublicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: MARINADE_CLAIM_DISCRIMINATOR as unknown as TxInstructionData,
    });
}

export async function buildMarinadeClaimInstruction(
    ticket: StakingTicket,
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<TransactionInstruction> {
    const moduleName = '@marinade.finance/marinade-ts-sdk';

    try {
        const sdkModule = await import(/* @vite-ignore */ moduleName) as unknown as MarinadeSdkModule;
        const config = new sdkModule.MarinadeConfig({
            connection,
            publicKey: walletPublicKey,
        });
        const marinade = new sdkModule.Marinade(config);
        const claimResult = await marinade.claim(new PublicKey(ticket.ticketAccountAddress));
        const tx = claimResult instanceof Transaction
            ? claimResult
            : claimResult.transaction;

        if (!tx || tx.instructions.length === 0) {
            throw new Error('Marinade SDK returned transaction without instructions.');
        }

        const marinadeProgram = new PublicKey(MARINADE_PROGRAM_ID);
        const instruction = tx.instructions.find((ix) => ix.programId.equals(marinadeProgram))
            || tx.instructions[0];

        if (!instruction) {
            throw new Error('Marinade SDK did not return a usable claim instruction.');
        }

        return instruction;
    } catch {
        // SDK is optional. Fallback is best-effort manual claim instruction.
        return buildFallbackMarinadeClaimInstruction(ticket, walletPublicKey);
    }
}

export async function buildSanctumClaimTransaction(
    ticket: StakingTicket,
    walletPublicKey: PublicKey
): Promise<VersionedTransaction | Transaction> {
    const response = await fetch(SANCTUM_REDEEM_API, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            ticket: ticket.ticketAccountAddress,
            wallet: walletPublicKey.toBase58(),
        }),
    });

    if (!response.ok) {
        throw createAppError(
            'TICKET_CLAIM_FAILED',
            `Sanctum redeem endpoint returned ${response.status}.`
        );
    }

    const payload = (await response.json()) as SanctumRedeemResponse;
    if (!payload.transaction) {
        throw createAppError('TICKET_CLAIM_FAILED', 'Sanctum redeem API returned no transaction.');
    }

    const bytes = base64ToBytes(payload.transaction);
    try {
        return VersionedTransaction.deserialize(bytes);
    } catch {
        try {
            return Transaction.from(bytes);
        } catch (error) {
            throw createAppError(
                'TICKET_CLAIM_FAILED',
                `Could not deserialize Sanctum transaction: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

async function verifyTicketOwnership(
    ticket: StakingTicket,
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<boolean> {
    const walletAddress = walletPublicKey.toBase58();

    if (ticket.protocol === 'marinade') {
        const accountInfo = await connection.getAccountInfo(new PublicKey(ticket.ticketAccountAddress), 'confirmed');
        if (!accountInfo || accountInfo.data.byteLength < 72) return false;
        const beneficiary = new PublicKey(accountInfo.data.slice(40, 72)).toBase58();
        return beneficiary === walletAddress;
    }

    if (ticket.protocol === 'sanctum') {
        const accountInfo = await connection.getAccountInfo(new PublicKey(ticket.ticketAccountAddress), 'confirmed');
        return Boolean(accountInfo);
    }

    const parsed = await connection.getParsedAccountInfo(new PublicKey(ticket.ticketAccountAddress), 'confirmed');
    const data = parsed.value?.data;
    if (!data || typeof data === 'string' || !('parsed' in data)) return false;

    const parsedInfo = data.parsed as { info?: { meta?: { authorized?: { staker?: string; withdrawer?: string } } } };
    const authorized = parsedInfo.info?.meta?.authorized;
    return authorized?.staker === walletAddress || authorized?.withdrawer === walletAddress;
}

async function buildTicketTransaction(
    ticket: StakingTicket,
    walletPublicKey: PublicKey,
    connection: Connection
): Promise<Transaction | VersionedTransaction> {
    if (ticket.protocol === 'sanctum') {
        return buildSanctumClaimTransaction(ticket, walletPublicKey);
    }

    if (ticket.protocol === 'marinade') {
        const instruction = await buildMarinadeClaimInstruction(ticket, walletPublicKey, connection);
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const priorityFee = await getOptimalPriorityFee(connection);
        const tx = new Transaction();
        tx.feePayer = walletPublicKey;
        tx.recentBlockhash = blockhash;
        for (const ix of buildPriorityFeeIxs(priorityFee)) {
            tx.add(ix);
        }
        tx.add(instruction);
        return tx;
    }

    if (
        ticket.protocol === 'native_stake'
        || ticket.protocol === 'jito'
        || ticket.protocol === 'blazestake'
    ) {
        const lamports = toLamportsNumber(parseLamports(ticket.valueLamports));
        if (lamports <= 0) {
            throw createAppError(
                'TICKET_CLAIM_FAILED',
                `Invalid withdraw amount for stake account ${ticket.ticketAccountAddress}.`
            );
        }

        const instruction = buildStakeWithdrawInstruction(ticket, walletPublicKey, lamports);
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        const priorityFee = await getOptimalPriorityFee(connection);
        const tx = new Transaction();
        tx.feePayer = walletPublicKey;
        tx.recentBlockhash = blockhash;
        for (const ix of buildPriorityFeeIxs(priorityFee)) {
            tx.add(ix);
        }
        tx.add(instruction);
        return tx;
    }

    throw createAppError(
        'TICKET_CLAIM_FAILED',
        `Unsupported protocol for claim: ${ticket.protocol}.`
    );
}

async function sendFeeTransaction(
    totalClaimedLamports: bigint,
    walletPublicKey: PublicKey,
    connection: Connection,
    sendTransaction: SendTransactionFn
): Promise<string | null> {
    const feeLamports = (totalClaimedLamports * BigInt(TICKET_CLAIM_FEE_PERCENT)) / 100n;
    if (feeLamports <= 0n) return null;

    const lamports = toLamportsNumber(feeLamports);
    if (lamports <= 0) return null;

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const priorityFee = await getOptimalPriorityFee(connection);
    const feeTx = new Transaction();
    feeTx.feePayer = walletPublicKey;
    feeTx.recentBlockhash = blockhash;
    for (const ix of buildPriorityFeeIxs(priorityFee)) {
        feeTx.add(ix);
    }
    feeTx.add(
        SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: TREASURY_WALLET,
            lamports,
        })
    );

    const signature = await sendTransaction(feeTx, connection);
    await confirmSignature(connection, signature);
    return signature;
}

export async function claimAllTickets(params: ClaimAllTicketsParams): Promise<TicketClaimResult> {
    const {
        tickets,
        walletPublicKey,
        sendTransaction,
        connection,
        onProgress,
    } = params;

    if (!tickets || tickets.length === 0) {
        return {
            success: false,
            claimedCount: 0,
            claimedSOL: 0,
            signatures: [],
            failedTickets: [],
            errorMessage: 'No tickets selected for claim.',
        };
    }

    const claimableTickets = tickets
        .filter((ticket) => ticket.claimStatus === 'claimable');

    if (claimableTickets.length === 0) {
        return {
            success: false,
            claimedCount: 0,
            claimedSOL: 0,
            signatures: [],
            failedTickets: [],
            errorMessage: 'No claimable tickets available.',
        };
    }

    const signatures: string[] = [];
    const failedTickets: string[] = [];
    let claimedCount = 0;
    let claimedLamports = 0n;
    let sessionError: string | null = null;
    const currentEpoch = (await connection.getEpochInfo('confirmed')).epoch;

    for (const ticket of claimableTickets) {
        onProgress?.({
            id: ticket.id,
            status: 'building',
            signature: null,
            claimedSOL: 0,
            message: 'Building claim transaction...',
        });

        try {
            const ownershipValid = await verifyTicketOwnership(ticket, walletPublicKey, connection);
            if (!ownershipValid) {
                failedTickets.push(ticket.ticketAccountAddress);
                onProgress?.({
                    id: ticket.id,
                    status: 'failed',
                    signature: null,
                    claimedSOL: 0,
                    message: 'Ticket ownership verification failed.',
                });
                continue;
            }

            const refreshedStatus = statusFromEpoch(ticket.claimableAfterEpoch, currentEpoch);
            if (refreshedStatus !== 'claimable' && ticket.claimableAfterEpoch !== null) {
                failedTickets.push(ticket.ticketAccountAddress);
                onProgress?.({
                    id: ticket.id,
                    status: 'skipped',
                    signature: null,
                    claimedSOL: 0,
                    message: 'Ticket is no longer claimable at current epoch.',
                });
                continue;
            }

            onProgress?.({
                id: ticket.id,
                status: 'awaiting_signature',
                signature: null,
                claimedSOL: 0,
                message: 'Waiting for wallet signature...',
            });

            const tx = await buildTicketTransaction(ticket, walletPublicKey, connection);
            ensureTransactionFeePayer(tx, walletPublicKey);

            onProgress?.({
                id: ticket.id,
                status: 'confirming',
                signature: null,
                claimedSOL: 0,
                message: 'Sending transaction...',
            });

            const signature = await sendTransaction(tx, connection);
            await confirmSignature(connection, signature);

            signatures.push(signature);
            claimedCount += 1;

            const lamports = parseLamports(ticket.valueLamports);
            claimedLamports += lamports > 0n ? lamports : 0n;

            onProgress?.({
                id: ticket.id,
                status: 'success',
                signature,
                claimedSOL: ticket.valueSOL,
                message: 'Claim confirmed.',
            });
        } catch (error) {
            failedTickets.push(ticket.ticketAccountAddress);
            const detail = error instanceof Error ? error.message : String(error);
            sessionError = detail;
            onProgress?.({
                id: ticket.id,
                status: 'failed',
                signature: null,
                claimedSOL: 0,
                message: detail,
            });
        }
    }

    if (claimedCount > 0) {
        try {
            const feeSignature = await sendFeeTransaction(
                claimedLamports,
                walletPublicKey,
                connection,
                sendTransaction
            );
            if (feeSignature) {
                signatures.push(feeSignature);
            }
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            sessionError = sessionError
                ? `${sessionError} | Fee transfer failed: ${detail}`
                : `Fee transfer failed: ${detail}`;
        }
    }

    return {
        success: claimedCount > 0 && failedTickets.length === 0 && !sessionError,
        claimedCount,
        claimedSOL: Number(claimedLamports) / 1e9,
        signatures,
        failedTickets,
        errorMessage: sessionError,
    };
}
