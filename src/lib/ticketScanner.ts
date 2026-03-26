import {
    Connection,
    LAMPORTS_PER_SOL,
    ParsedAccountData,
    PublicKey,
    StakeProgram,
} from '@solana/web3.js';
import type {
    StakingProtocol,
    StakingTicket,
    TicketClaimStatus,
    TicketScanResult,
} from '@/types';
import {
    BLAZESTAKE_STAKE_POOL,
    EPOCH_DURATION_HOURS,
    JITO_STAKE_POOL,
    MARINADE_PROGRAM_ID,
    MAX_U64,
    PROTOCOL_INFO,
    SANCTUM_TICKETS_API,
    TICKET_MIN_VALUE_SOL,
} from '@/config/constants';
import { isValidSolanaPublicKey } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { createAppError } from '@/lib/errors';

interface StakeAuthorizedInfo {
    staker?: string;
    withdrawer?: string;
}

interface StakeMetaInfo {
    authorized?: StakeAuthorizedInfo;
}

interface StakeDelegationInfo {
    voter?: string;
    deactivationEpoch?: string | number;
}

interface StakeStateInfo {
    delegation?: StakeDelegationInfo;
}

interface ParsedStakeInfo {
    meta?: StakeMetaInfo;
    stake?: StakeStateInfo | null;
}

interface StakeAccountEntry {
    address: string;
    lamports: number;
    info: ParsedStakeInfo;
}

interface SanitizedStakeAccount {
    address: string;
    lamports: number;
    deactivationEpoch: number | null;
    isDeactivating: boolean;
    validatorVoteAccount: string | null;
}

interface SanctumApiTicket {
    ticket?: string;
    ticketAddress?: string;
    lstMint?: string;
    lamportsValue?: string;
    lamports_value?: string;
    valueLamports?: string;
    epochCreated?: number | string;
    createdEpoch?: number | string;
    isClaimable?: boolean;
    claimable?: boolean;
}

interface SanctumApiResponse {
    tickets?: SanctumApiTicket[];
}

const SCANNED_PROTOCOLS: StakingProtocol[] = [
    'marinade',
    'sanctum',
    'jito',
    'blazestake',
    'native_stake',
];

let sanctumApiSkipUntilMs = 0;

// Conservative placeholders. Unknown stake accounts are classified as native.
const JITO_VALIDATOR_VOTE_ACCOUNTS = new Set<string>([JITO_STAKE_POOL]);
const BLAZESTAKE_VALIDATOR_VOTE_ACCOUNTS = new Set<string>([BLAZESTAKE_STAKE_POOL]);

function toNumberEpoch(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
}

function readU64LE(data: Uint8Array, offset: number): bigint {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return view.getBigUint64(offset, true);
}

function bytesToBase58(bytes: Uint8Array): string | null {
    try {
        return new PublicKey(bytes).toBase58();
    } catch {
        return null;
    }
}

function getStatusFromEpoch(
    claimableAfterEpoch: number | null,
    currentEpoch: number
): TicketClaimStatus {
    if (claimableAfterEpoch === null) return 'unknown';
    return currentEpoch >= claimableAfterEpoch ? 'claimable' : 'pending';
}

function getEpochsRemaining(
    claimStatus: TicketClaimStatus,
    claimableAfterEpoch: number | null,
    currentEpoch: number
): number | null {
    if (claimStatus !== 'pending' || claimableAfterEpoch === null) return null;
    return Math.max(claimableAfterEpoch - currentEpoch, 0);
}

function buildTicket(params: {
    address: string;
    protocol: StakingProtocol;
    valueLamports: bigint;
    claimStatus: TicketClaimStatus;
    createdEpoch: number | null;
    claimableAfterEpoch: number | null;
    currentEpoch: number;
    validatorVoteAccount?: string | null;
}): StakingTicket | null {
    const valueSOL = Number(params.valueLamports) / LAMPORTS_PER_SOL;
    if (!Number.isFinite(valueSOL) || valueSOL < TICKET_MIN_VALUE_SOL) {
        return null;
    }

    const protocolInfo = PROTOCOL_INFO[params.protocol] || PROTOCOL_INFO.unknown;
    const epochsRemaining = getEpochsRemaining(
        params.claimStatus,
        params.claimableAfterEpoch,
        params.currentEpoch
    );

    return {
        id: params.address,
        ticketAccountAddress: params.address,
        protocol: params.protocol,
        protocolDisplayName: protocolInfo.displayName,
        protocolLogoUri: protocolInfo.logoUri,
        valueSOL,
        valueLamports: params.valueLamports.toString(),
        claimStatus: params.claimStatus,
        createdEpoch: params.createdEpoch,
        claimableAfterEpoch: params.claimableAfterEpoch,
        currentEpoch: params.currentEpoch,
        epochsRemaining,
        estimatedTimeRemainingHours:
            epochsRemaining !== null ? epochsRemaining * EPOCH_DURATION_HOURS : null,
        isNativeStake: params.protocol === 'native_stake',
        validatorVoteAccount: params.validatorVoteAccount ?? null,
    };
}

function parseMarinadeTicketData(
    data: Uint8Array,
    ticketAddress: string,
    walletAddress: string,
    currentEpoch: number
): StakingTicket | null {
    // 8 discriminator + 32 state + 32 beneficiary + 8 lamports + 8 created epoch
    if (data.byteLength < 88) return null;

    const beneficiary = bytesToBase58(data.slice(40, 72));
    if (!beneficiary || beneficiary !== walletAddress) {
        return null;
    }

    const valueLamports = readU64LE(data, 72);
    const createdEpoch = Number(readU64LE(data, 80));
    const claimableAfterEpoch = createdEpoch + 2;
    const claimStatus = getStatusFromEpoch(claimableAfterEpoch, currentEpoch);

    return buildTicket({
        address: ticketAddress,
        protocol: 'marinade',
        valueLamports,
        claimStatus,
        createdEpoch,
        claimableAfterEpoch,
        currentEpoch,
    });
}

async function scanMarinadeTickets(
    walletAddress: string,
    connection: Connection,
    currentEpoch: number
): Promise<StakingTicket[]> {
    try {
        const accounts = await connection.getProgramAccounts(new PublicKey(MARINADE_PROGRAM_ID), {
            filters: [
                {
                    // beneficiary starts at discriminator(8) + state(32)
                    memcmp: { offset: 40, bytes: walletAddress },
                },
            ],
        });

        return accounts
            .map((account) => parseMarinadeTicketData(
                account.account.data,
                account.pubkey.toBase58(),
                walletAddress,
                currentEpoch
            ))
            .filter((ticket): ticket is StakingTicket => Boolean(ticket));
    } catch (error) {
        throw createAppError(
            'MARINADE_SCAN_FAILED',
            error instanceof Error ? error.message : String(error)
        );
    }
}

async function scanSanctumTickets(
    walletAddress: string,
    connection: Connection,
    currentEpoch: number
): Promise<StakingTicket[]> {
    if (Date.now() < sanctumApiSkipUntilMs) {
        return [];
    }

    const endpoint = `${SANCTUM_TICKETS_API}?wallet=${encodeURIComponent(walletAddress)}`;
    let response: Response;

    try {
        response = await fetch(endpoint, { cache: 'no-store' });
    } catch (error) {
        throw createAppError(
            'SANCTUM_API_FAILED',
            error instanceof Error ? error.message : String(error)
        );
    }

    if (response.status === 404) {
        sanctumApiSkipUntilMs = Date.now() + 15 * 60_000;
        return [];
    }
    if (!response.ok) {
        if (response.status >= 500) {
            throw createAppError(
                'SANCTUM_API_FAILED',
                `Sanctum API returned ${response.status}.`
            );
        }
        return [];
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        logger.warn('Sanctum API returned non-JSON payload.');
        return [];
    }

    const ticketsFromApi = (() => {
        if (Array.isArray(payload)) {
            return payload as SanctumApiTicket[];
        }
        if (payload && typeof payload === 'object' && Array.isArray((payload as SanctumApiResponse).tickets)) {
            return (payload as SanctumApiResponse).tickets as SanctumApiTicket[];
        }
        logger.warn('Sanctum API shape changed. Expected { tickets: [] }.');
        return [] as SanctumApiTicket[];
    })();

    const tickets: StakingTicket[] = [];
    for (const apiTicket of ticketsFromApi) {
        const ticketAddress = (apiTicket.ticket || apiTicket.ticketAddress || '').trim();
        if (!ticketAddress || !isValidSolanaPublicKey(ticketAddress)) continue;

        const accountInfo = await connection.getAccountInfo(new PublicKey(ticketAddress), 'confirmed');
        if (!accountInfo) continue;

        const lamportsRaw = String(
            apiTicket.lamportsValue
            || apiTicket.lamports_value
            || apiTicket.valueLamports
            || '0'
        );
        let valueLamports = 0n;
        try {
            valueLamports = BigInt(lamportsRaw);
        } catch {
            continue;
        }

        const createdEpoch = toNumberEpoch(apiTicket.epochCreated ?? apiTicket.createdEpoch);
        const claimableAfterEpoch = createdEpoch !== null ? createdEpoch + 1 : null;

        const isClaimableByApi = typeof apiTicket.isClaimable === 'boolean'
            ? apiTicket.isClaimable
            : typeof apiTicket.claimable === 'boolean'
                ? apiTicket.claimable
                : null;
        const claimStatus = isClaimableByApi !== null
            ? (isClaimableByApi ? 'claimable' : 'pending')
            : getStatusFromEpoch(claimableAfterEpoch, currentEpoch);

        const ticket = buildTicket({
            address: ticketAddress,
            protocol: 'sanctum',
            valueLamports,
            claimStatus,
            createdEpoch,
            claimableAfterEpoch,
            currentEpoch,
        });

        if (ticket) {
            tickets.push(ticket);
        }
    }

    return tickets;
}

function getParsedStakeInfo(accountData: unknown): ParsedStakeInfo | null {
    if (!accountData || typeof accountData !== 'object' || !('parsed' in accountData)) return null;
    const parsed = (accountData as ParsedAccountData).parsed;
    if (!parsed || typeof parsed !== 'object') return null;
    const info = (parsed as { info?: ParsedStakeInfo }).info;
    if (!info || typeof info !== 'object') return null;
    return info;
}

async function fetchStakeAccountsForWallet(
    walletAddress: string,
    connection: Connection
): Promise<StakeAccountEntry[]> {
    const results = await connection.getParsedProgramAccounts(
        StakeProgram.programId,
        {
            filters: [
                {
                    memcmp: {
                        // Per spec: withdrawer offset in stake account layout
                        offset: 44,
                        bytes: walletAddress,
                    },
                },
            ],
        }
    );

    const entries: StakeAccountEntry[] = [];
    for (const account of results) {
        const info = getParsedStakeInfo(account.account.data);
        if (!info) continue;
        entries.push({
            address: account.pubkey.toBase58(),
            lamports: account.account.lamports,
            info,
        });
    }

    return entries;
}

function sanitizeStakeAccount(
    entry: StakeAccountEntry,
    walletAddress: string
): SanitizedStakeAccount | null {
    const authorized = entry.info.meta?.authorized;
    const withdrawer = authorized?.withdrawer || null;
    const staker = authorized?.staker || null;
    if (withdrawer !== walletAddress && staker !== walletAddress) {
        return null;
    }

    const delegation = entry.info.stake?.delegation;
    const validatorVoteAccount = delegation?.voter || null;
    const rawDeactivationEpoch = delegation?.deactivationEpoch;

    if (rawDeactivationEpoch === MAX_U64) {
        return null;
    }

    return {
        address: entry.address,
        lamports: entry.lamports,
        deactivationEpoch: toNumberEpoch(rawDeactivationEpoch),
        isDeactivating: rawDeactivationEpoch !== null && rawDeactivationEpoch !== undefined,
        validatorVoteAccount,
    };
}

function mapStakeAccountToTicket(
    account: SanitizedStakeAccount,
    protocol: StakingProtocol,
    currentEpoch: number
): StakingTicket | null {
    const valueLamports = BigInt(account.lamports);
    const claimableAfterEpoch = account.deactivationEpoch;

    let claimStatus: TicketClaimStatus = 'unknown';
    if (!account.isDeactivating) {
        claimStatus = 'claimable';
    } else if (claimableAfterEpoch !== null) {
        claimStatus = currentEpoch >= claimableAfterEpoch ? 'claimable' : 'pending';
    }

    return buildTicket({
        address: account.address,
        protocol,
        valueLamports,
        claimStatus,
        createdEpoch: null,
        claimableAfterEpoch,
        currentEpoch,
        validatorVoteAccount: account.validatorVoteAccount,
    });
}

function dedupeTicketsByAddress(tickets: StakingTicket[]): StakingTicket[] {
    const ticketByAddress = new Map<string, StakingTicket>();
    const protocolPriority: Record<StakingProtocol, number> = {
        marinade: 0,
        sanctum: 1,
        jito: 2,
        blazestake: 3,
        native_stake: 4,
        unknown: 5,
    };

    for (const ticket of tickets) {
        const existing = ticketByAddress.get(ticket.ticketAccountAddress);
        if (!existing) {
            ticketByAddress.set(ticket.ticketAccountAddress, ticket);
            continue;
        }

        if (protocolPriority[ticket.protocol] < protocolPriority[existing.protocol]) {
            ticketByAddress.set(ticket.ticketAccountAddress, ticket);
            continue;
        }

        if (existing.claimStatus !== 'claimable' && ticket.claimStatus === 'claimable') {
            ticketByAddress.set(ticket.ticketAccountAddress, ticket);
        }
    }

    return Array.from(ticketByAddress.values());
}

function sortTickets(tickets: StakingTicket[]): StakingTicket[] {
    const statusRank: Record<TicketClaimStatus, number> = {
        claimable: 0,
        pending: 1,
        unknown: 2,
    };

    return [...tickets].sort((left, right) => {
        const statusDiff = statusRank[left.claimStatus] - statusRank[right.claimStatus];
        if (statusDiff !== 0) return statusDiff;
        return right.valueSOL - left.valueSOL;
    });
}

async function scanJitoStakeAccounts(
    walletAddress: string,
    currentEpoch: number,
    stakeAccountsPromise: Promise<StakeAccountEntry[]>
): Promise<StakingTicket[]> {
    try {
        const stakeAccounts = await stakeAccountsPromise;
        return stakeAccounts
            .map((entry) => sanitizeStakeAccount(entry, walletAddress))
            .filter((entry): entry is SanitizedStakeAccount => Boolean(entry))
            .filter((entry) => {
                if (!entry.validatorVoteAccount) return false;
                return JITO_VALIDATOR_VOTE_ACCOUNTS.has(entry.validatorVoteAccount);
            })
            .map((entry) => mapStakeAccountToTicket(entry, 'jito', currentEpoch))
            .filter((ticket): ticket is StakingTicket => Boolean(ticket));
    } catch (error) {
        throw createAppError(
            'JITO_SCAN_FAILED',
            error instanceof Error ? error.message : String(error)
        );
    }
}

async function scanBlazeStakeAccounts(
    walletAddress: string,
    currentEpoch: number,
    stakeAccountsPromise: Promise<StakeAccountEntry[]>
): Promise<StakingTicket[]> {
    try {
        const stakeAccounts = await stakeAccountsPromise;
        return stakeAccounts
            .map((entry) => sanitizeStakeAccount(entry, walletAddress))
            .filter((entry): entry is SanitizedStakeAccount => Boolean(entry))
            .filter((entry) => {
                if (!entry.validatorVoteAccount) return false;
                return BLAZESTAKE_VALIDATOR_VOTE_ACCOUNTS.has(entry.validatorVoteAccount);
            })
            .map((entry) => mapStakeAccountToTicket(entry, 'blazestake', currentEpoch))
            .filter((ticket): ticket is StakingTicket => Boolean(ticket));
    } catch (error) {
        throw createAppError(
            'STAKE_SCAN_FAILED',
            error instanceof Error ? error.message : String(error)
        );
    }
}

async function scanNativeStakeAccounts(
    walletAddress: string,
    currentEpoch: number,
    stakeAccountsPromise: Promise<StakeAccountEntry[]>
): Promise<StakingTicket[]> {
    try {
        const stakeAccounts = await stakeAccountsPromise;
        return stakeAccounts
            .map((entry) => sanitizeStakeAccount(entry, walletAddress))
            .filter((entry): entry is SanitizedStakeAccount => Boolean(entry))
            .map((entry) => mapStakeAccountToTicket(entry, 'native_stake', currentEpoch))
            .filter((ticket): ticket is StakingTicket => Boolean(ticket));
    } catch (error) {
        throw createAppError(
            'STAKE_SCAN_FAILED',
            error instanceof Error ? error.message : String(error)
        );
    }
}

export async function scanForStakingTickets(
    walletAddress: string,
    connection: Connection
): Promise<TicketScanResult> {
    if (!isValidSolanaPublicKey(walletAddress)) {
        throw createAppError(
            'INVALID_ADDRESS',
            `Invalid wallet address for ticket scan: ${walletAddress}`
        );
    }

    let currentEpoch = 0;
    try {
        const epochInfo = await connection.getEpochInfo('confirmed');
        currentEpoch = epochInfo.epoch;
    } catch {
        return {
            scannedAt: new Date(),
            currentEpoch: 0,
            tickets: [],
            claimableTickets: [],
            pendingTickets: [],
            totalClaimableSOL: 0,
            totalPendingSOL: 0,
            totalValueSOL: 0,
            protocolsScanned: SCANNED_PROTOCOLS,
            protocolsWithErrors: [...SCANNED_PROTOCOLS],
        };
    }

    const stakeAccountsPromise = fetchStakeAccountsForWallet(walletAddress, connection);
    const protocolScanners: Array<{
        protocol: StakingProtocol;
        run: () => Promise<StakingTicket[]>;
    }> = [
            {
                protocol: 'marinade',
                run: () => scanMarinadeTickets(walletAddress, connection, currentEpoch),
            },
            {
                protocol: 'sanctum',
                run: () => scanSanctumTickets(walletAddress, connection, currentEpoch),
            },
            {
                protocol: 'jito',
                run: () => scanJitoStakeAccounts(walletAddress, currentEpoch, stakeAccountsPromise),
            },
            {
                protocol: 'blazestake',
                run: () => scanBlazeStakeAccounts(walletAddress, currentEpoch, stakeAccountsPromise),
            },
            {
                protocol: 'native_stake',
                run: () => scanNativeStakeAccounts(walletAddress, currentEpoch, stakeAccountsPromise),
            },
        ];

    const settled = await Promise.allSettled(protocolScanners.map((scanner) => scanner.run()));

    const protocolsWithErrors: StakingProtocol[] = [];
    const allTickets: StakingTicket[] = [];

    for (let index = 0; index < settled.length; index += 1) {
        const result = settled[index];
        const protocol = protocolScanners[index]?.protocol || 'unknown';
        if (result.status === 'fulfilled') {
            allTickets.push(...result.value);
        } else {
            protocolsWithErrors.push(protocol);
        }
    }

    const dedupedTickets = dedupeTicketsByAddress(allTickets)
        .filter((ticket) => ticket.valueSOL >= TICKET_MIN_VALUE_SOL);
    const sortedTickets = sortTickets(dedupedTickets);

    const claimableTickets = sortedTickets.filter((ticket) => ticket.claimStatus === 'claimable');
    const pendingTickets = sortedTickets.filter((ticket) => ticket.claimStatus === 'pending');
    const totalClaimableSOL = claimableTickets.reduce((sum, ticket) => sum + ticket.valueSOL, 0);
    const totalPendingSOL = pendingTickets.reduce((sum, ticket) => sum + ticket.valueSOL, 0);

    return {
        scannedAt: new Date(),
        currentEpoch,
        tickets: sortedTickets,
        claimableTickets,
        pendingTickets,
        totalClaimableSOL,
        totalPendingSOL,
        totalValueSOL: totalClaimableSOL + totalPendingSOL,
        protocolsScanned: SCANNED_PROTOCOLS,
        protocolsWithErrors,
    };
}
