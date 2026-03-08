# 🎫 Wallet Shield — Engine 4: Staking Ticket Finder
### Complete Specification for AI Agent Build
### Extends existing Wallet Shield codebase (Engines 1, 2, 3 already built)

---

## ⚠️ AGENT CONTEXT — READ FIRST

You are adding **Engine 4** to an already working Wallet Shield app.

**Engines 1, 2, and 3 are already built and working:**
- Engine 1: Permission Revocation
- Engine 2: Account Rent Reclaimer
- Engine 3: Dust Consolidator

**Do NOT touch or refactor any existing engine code.**
Follow the exact same patterns, file structure, naming conventions, and security rules established in the existing codebase.

### What Engine 4 Does

When users unstake SOL from liquid staking protocols (Marinade, Sanctum, Jito, BlazeStake, Socean), they don't receive SOL instantly. They receive a **"staking ticket"** — a special on-chain account that entitles them to their SOL after a delay (1–2 epochs, roughly 2–5 days).

Many users:
- Forget they have tickets
- Don't know they need to manually redeem them
- Receive tickets from protocol interactions they've forgotten about
- Have tickets sitting unclaimed for weeks, months, or longer

This engine scans all supported protocols, finds unredeemed tickets, shows the user what they're owed, and redeems everything in one click.

**Fee model: 5% of redeemed SOL.** This is intentionally low — the user gets SOL they had completely forgotten about. Psychologically this is a pure finder's fee on "found money."

---

## 1. Understanding Staking Tickets on Solana

Before building, understand what a staking ticket actually is on-chain for each protocol. They are implemented differently per protocol.

### 1.1 Marinade Finance

**How Marinade unstaking works:**
- User holds mSOL (Marinade's liquid staking token)
- User calls `orderUnstake()` → receives a **TicketAccount** (a PDA owned by the Marinade program)
- After the delay epoch, user calls `claim()` on that TicketAccount → receives SOL
- The TicketAccount is then closed

**On-chain structure:**
- Program ID: `MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD`
- Ticket accounts are PDAs derived from the Marinade state + user wallet
- To find tickets: Use `getProgramAccounts()` with filter on the Marinade program, filtering by owner = user wallet

**Ticket account data layout (Marinade):**
```
Discriminator: 8 bytes
State address: 32 bytes
Beneficiary:   32 bytes  ← user's wallet address
lamports_value: 8 bytes  ← SOL owed (u64, little-endian)
created_epoch:  8 bytes  ← when ticket was created
```

**How to check if claimable:**
- Fetch current epoch via `connection.getEpochInfo()`
- Ticket is claimable if `current_epoch > created_epoch + 1`
- (Marinade requires the epoch after creation to pass)

**Claim instruction:**
- Use Marinade's TypeScript SDK: `@marinade.finance/marinade-ts-sdk`
- Or construct the instruction manually using the Marinade IDL

### 1.2 Sanctum (formerly Cardinal Staking)

**How Sanctum unstaking works:**
- Sanctum supports multiple LSTs (Liquid Staking Tokens) — each has its own pool
- Unstaking creates a **WithdrawTicket** account
- After the unstaking period, user calls `redeemWithdrawTicket()`

**Key Sanctum program IDs:**
- Sanctum Infinity: `5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx`
- Individual pool programs vary by LST — must look up per token

**Finding Sanctum tickets:**
- Sanctum provides a REST API: `https://sanctum-extra-api.ngrok.dev/v1/unstake-tickets?wallet=<ADDRESS>`
- This is the recommended approach over raw `getProgramAccounts()` which is complex for Sanctum
- Response includes: ticket address, LST mint, value in SOL, claimable (boolean)

**Fallback if Sanctum API is unavailable:**
- Query `getProgramAccounts()` on Sanctum programs with memcmp filter on beneficiary address
- Parse raw account data per Sanctum's IDL

### 1.3 Jito (JitoSOL)

**How Jito unstaking works:**
- Jito uses the standard SPL Stake Pool program
- Unstaking involves deactivating a stake account — not a "ticket" per se
- User receives a deactivating stake account that becomes withdrawable at epoch boundary

**Finding Jito stake accounts:**
- Jito stake pool address: `Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Poqu`
- Query native stake accounts owned by user wallet:
  `connection.getParsedProgramAccounts(StakeProgram.programId, filters)`
- Filter by `parsed.info.meta.authorized.withdrawer === walletAddress`
- Check `parsed.info.stake.delegation.deactivationEpoch` — if not `18446744073709551615` (max u64 = not deactivating) and `deactivationEpoch < currentEpoch`, it's withdrawable

**Withdraw instruction:**
- Use `StakeProgram.withdraw()` from `@solana/web3.js`
- This is a standard Solana instruction, no special SDK needed

### 1.4 BlazeStake (bSOL)

**How BlazeStake unstaking works:**
- Uses SPL Stake Pool program (same as Jito)
- Stake pool address: `stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov84HpwHA`
- Same approach as Jito — query deactivating stake accounts

**Finding BlazeStake accounts:**
- Query stake accounts where depositor = BlazeStake pool address
- Check deactivation epoch vs current epoch

### 1.5 Native Stake Accounts (Bonus Engine)

Beyond LST protocols, many users have **plain native stake accounts** that are:
- Fully deactivated and withdrawable (but user forgot about them)
- Created during Solana's early days and never touched
- From validator rewards that were auto-staked

These are NOT from a protocol — they're just standard Solana stake accounts.

**Finding them:**
- `connection.getParsedProgramAccounts(StakeProgram.programId)` with filter `parsed.info.meta.authorized.withdrawer === walletAddress`
- If `parsed.info.stake.delegation.deactivationEpoch < currentEpoch` → withdrawable
- If `parsed.info.stake` is null and `parsed.info.meta` exists → fully deactivated, withdrawable

**Include these in the scan.** They are often the highest-value finds (some users have 1–50 SOL in forgotten native stake accounts).

---

## 2. New TypeScript Types

File: `src/types/index.ts` — append, do not modify existing types.

```typescript
// ─── ENGINE 4: STAKING TICKET FINDER ─────────────────────

export type StakingProtocol =
  | 'marinade'
  | 'sanctum'
  | 'jito'
  | 'blazestake'
  | 'native_stake'
  | 'unknown';

export type TicketClaimStatus =
  | 'claimable'       // Ready to redeem right now
  | 'pending'         // Still in unstaking delay period
  | 'unknown';        // Could not determine status

export interface StakingTicket {
  id: string;                        // Unique ID for React keys — use ticket account address
  ticketAccountAddress: string;      // On-chain account address holding the ticket
  protocol: StakingProtocol;
  protocolDisplayName: string;       // "Marinade Finance", "Sanctum", etc.
  protocolLogoUri: string | null;    // Protocol logo for UI
  valueSOL: number;                  // SOL owed to user
  valueLamports: string;             // Raw lamports as string (avoid BigInt precision issues)
  claimStatus: TicketClaimStatus;
  createdEpoch: number | null;       // Epoch when ticket was created
  claimableAfterEpoch: number | null; // Epoch when claimable (null if unknown)
  currentEpoch: number;              // Epoch at time of scan
  epochsRemaining: number | null;    // null if already claimable
  estimatedTimeRemainingHours: number | null; // null if already claimable
  // For native stake accounts
  isNativeStake: boolean;
  validatorVoteAccount: string | null; // Which validator this was staked with
}

export interface TicketScanResult {
  scannedAt: Date;
  currentEpoch: number;
  tickets: StakingTicket[];
  claimableTickets: StakingTicket[];   // Ready now
  pendingTickets: StakingTicket[];     // Still waiting
  totalClaimableSOL: number;
  totalPendingSOL: number;
  totalValueSOL: number;              // claimable + pending
  protocolsScanned: StakingProtocol[];
  protocolsWithErrors: StakingProtocol[]; // Protocols that failed to scan
}

export interface TicketClaimEstimate {
  claimableCount: number;
  totalClaimableSOL: number;
  serviceFeeSOL: number;             // 5% of totalClaimableSOL
  networkFeeSOL: number;             // Estimated Solana fees
  userReceivesSOL: number;
  userReceivesUSD: number;           // Estimated, shown with ~ prefix
}

export type TicketScanStatus =
  | 'idle'
  | 'scanning'
  | 'scan_complete'
  | 'error';

export type TicketClaimStatus_Action =   // Renamed to avoid conflict with TicketClaimStatus
  | 'idle'
  | 'awaiting_confirmation'
  | 'building_transaction'
  | 'awaiting_signature'
  | 'confirming'
  | 'complete'
  | 'error';

export interface TicketClaimResult {
  success: boolean;
  claimedCount: number;
  claimedSOL: number;
  signatures: string[];
  failedTickets: string[];           // ticket account addresses that failed
  errorMessage: string | null;
}
```

---

## 3. New Constants

File: `src/config/constants.ts` — append:

```typescript
// ─── ENGINE 4: STAKING TICKET FINDER ─────────────────────

// Service fee: 5% of redeemed SOL
// Lower than other engines — this is pure finder's fee for forgotten money
export const TICKET_CLAIM_FEE_PERCENT = 5;

// Minimum SOL value to show a ticket in the UI
// Don't show tickets worth less than this (dust-level stakes)
export const TICKET_MIN_VALUE_SOL = 0.01;

// Solana epoch duration in hours (approximate — varies slightly)
export const EPOCH_DURATION_HOURS = 54; // ~2.25 days per epoch on mainnet

// Protocol program IDs
export const MARINADE_PROGRAM_ID = 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD';
export const MARINADE_STATE_ADDRESS = '8szGkuLTAux9XMgZ2vtY39jVSowEvaDA1v9YBYCrbVeA';
export const JITO_STAKE_POOL = 'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Poqu';
export const BLAZESTAKE_STAKE_POOL = 'stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov84HpwHA';

// Sanctum API (use this instead of raw getProgramAccounts for Sanctum)
export const SANCTUM_TICKETS_API = 'https://sanctum-extra-api.ngrok.dev/v1/unstake-tickets';

// Max u64 value — Solana uses this to indicate "not deactivating"
export const MAX_U64 = '18446744073709551615';

// Max claims per transaction
export const MAX_CLAIMS_PER_TX = 5; // Claim instructions are large — stay conservative

// Protocol display names and logos
export const PROTOCOL_INFO: Record<StakingProtocol, { displayName: string; logoUri: string | null }> = {
  marinade:     { displayName: 'Marinade Finance', logoUri: '/logos/marinade.png' },
  sanctum:      { displayName: 'Sanctum',          logoUri: '/logos/sanctum.png' },
  jito:         { displayName: 'Jito',             logoUri: '/logos/jito.png' },
  blazestake:   { displayName: 'BlazeStake',       logoUri: '/logos/blazestake.png' },
  native_stake: { displayName: 'Native Stake',     logoUri: null },
  unknown:      { displayName: 'Unknown Protocol', logoUri: null },
};
```

---

## 4. Core Scanner Logic

File: `src/lib/ticketScanner.ts` — create this new file.

### 4.1 Main Entry Function

```typescript
/**
 * Scan all supported protocols for unredeemed staking tickets.
 * 
 * Runs all protocol scanners in PARALLEL (Promise.allSettled).
 * If one protocol fails, others still complete.
 * Failed protocols are reported in protocolsWithErrors[].
 * 
 * Never throws — always returns a TicketScanResult even if all protocols fail.
 */
async function scanForStakingTickets(
  walletAddress: string,
  connection: Connection
): Promise<TicketScanResult>
```

Implementation pattern:
```typescript
async function scanForStakingTickets(walletAddress, connection) {
  const currentEpoch = (await connection.getEpochInfo()).epoch;
  
  const results = await Promise.allSettled([
    scanMarinadeTickets(walletAddress, connection, currentEpoch),
    scanSanctumTickets(walletAddress, currentEpoch),
    scanJitoStakeAccounts(walletAddress, connection, currentEpoch),
    scanBlazeStakeAccounts(walletAddress, connection, currentEpoch),
    scanNativeStakeAccounts(walletAddress, connection, currentEpoch),
  ]);

  // Collect results and errors
  // Build final TicketScanResult
  // Sort tickets: claimable first, then by valueSOL descending
}
```

### 4.2 Marinade Scanner

```typescript
async function scanMarinadeTickets(
  walletAddress: string,
  connection: Connection,
  currentEpoch: number
): Promise<StakingTicket[]>
```

Steps:
1. Try using `@marinade.finance/marinade-ts-sdk` first — it has a `getTicketAccounts()` method
2. If SDK unavailable, fall back to raw `getProgramAccounts()`:
   ```typescript
   connection.getProgramAccounts(
     new PublicKey(MARINADE_PROGRAM_ID),
     {
       filters: [
         { dataSize: 80 },  // TicketAccount size
         { memcmp: { offset: 40, bytes: walletAddress } }  // beneficiary field
       ]
     }
   )
   ```
3. Parse each account's data buffer to extract `lamports_value` and `created_epoch`
4. Determine `claimStatus`:
   - `claimable` if `currentEpoch > created_epoch + 1`
   - `pending` otherwise
5. Calculate `epochsRemaining` and `estimatedTimeRemainingHours`
6. Return array of `StakingTicket`

**Buffer parsing for Marinade ticket:**
```typescript
function parseMarinadeTicket(data: Buffer, address: string, currentEpoch: number): StakingTicket {
  // Skip 8-byte discriminator
  // Skip 32-byte state address
  // Skip 32-byte beneficiary
  const lamports = data.readBigUInt64LE(72);  // offset 8+32+32 = 72
  const createdEpoch = Number(data.readBigUInt64LE(80));
  
  const claimable = currentEpoch > createdEpoch + 1;
  const epochsRemaining = claimable ? 0 : (createdEpoch + 2) - currentEpoch;
  
  return {
    // ... build StakingTicket
  };
}
```

### 4.3 Sanctum Scanner

```typescript
async function scanSanctumTickets(
  walletAddress: string,
  currentEpoch: number
): Promise<StakingTicket[]>
```

Steps:
1. Fetch from Sanctum API:
   ```
   GET https://sanctum-extra-api.ngrok.dev/v1/unstake-tickets?wallet=<walletAddress>
   ```
2. Parse response — expected shape:
   ```typescript
   interface SanctumApiResponse {
     tickets: Array<{
       ticket: string;          // ticket account address
       lstMint: string;         // which LST was unstaked
       lamportsValue: string;   // SOL owed
       epochCreated: number;
       isClaimable: boolean;
     }>
   }
   ```
3. If API returns 404 or empty: return `[]` (no tickets — not an error)
4. If API returns 5xx or network error: throw so caller marks Sanctum as failed
5. Map to `StakingTicket[]`

**Note:** Sanctum API may change. If it returns an unexpected shape, log a warning and return `[]`. Never crash the whole scan.

### 4.4 Jito Stake Account Scanner

```typescript
async function scanJitoStakeAccounts(
  walletAddress: string,
  connection: Connection,
  currentEpoch: number
): Promise<StakingTicket[]>
```

Steps:
1. Fetch all parsed stake accounts for this wallet:
   ```typescript
   const stakeAccounts = await connection.getParsedProgramAccounts(
     StakeProgram.programId,
     {
       filters: [
         {
           memcmp: {
             offset: 44,  // withdrawer offset in stake account data
             bytes: walletAddress
           }
         }
       ]
     }
   );
   ```
2. For each stake account:
   - Get the `deactivationEpoch` from `parsed.info.stake.delegation.deactivationEpoch`
   - Skip if `deactivationEpoch === MAX_U64` (still active/staking — not deactivating)
   - Skip if `deactivationEpoch > currentEpoch` (deactivating but not done yet → pending)
   - Include if `deactivationEpoch <= currentEpoch` (fully deactivated → claimable)
3. To determine if it's a Jito account vs BlazeStake vs native:
   - Check the `parsed.info.stake.delegation.voter` (validator vote account)
   - Compare against known Jito validator list (maintain a small hardcoded list of major Jito validators)
   - If not recognized: classify as `native_stake`
4. Get account balance via `connection.getBalance(stakeAccountPubkey)`
5. Return only accounts with balance > `TICKET_MIN_VALUE_SOL × LAMPORTS_PER_SOL`

### 4.5 BlazeStake Scanner

Same approach as Jito but filter by BlazeStake validator vote accounts. In practice, many stake accounts won't be clearly attributable to one protocol — it's okay to classify ambiguous ones as `native_stake`.

### 4.6 Native Stake Account Scanner

```typescript
async function scanNativeStakeAccounts(
  walletAddress: string,
  connection: Connection,
  currentEpoch: number
): Promise<StakingTicket[]>
```

This catches ALL deactivated + withdrawable stake accounts not attributed to a known protocol.

Steps:
1. Same `getParsedProgramAccounts(StakeProgram.programId)` query as above
2. Include ALL accounts where:
   - Withdrawer OR staker = walletAddress
   - AND deactivationEpoch ≤ currentEpoch (fully deactivated)
3. Also include accounts where stake data is null (fully inactive, just holding SOL)
4. Deduplicate against any accounts already found by Jito/BlazeStake scanners
5. Mark as `protocol: 'native_stake'`

---

## 5. Claim Logic

File: `src/lib/ticketClaimer.ts` — create this new file.

### 5.1 Main Claim Function

```typescript
/**
 * Claim all claimable tickets.
 * 
 * Different protocols need different claim instructions.
 * Route each ticket to the correct claim function.
 * Execute in batches — MAX_CLAIMS_PER_TX per transaction.
 * After all claims complete, send fee transfer transaction.
 */
async function claimAllTickets(
  tickets: StakingTicket[],
  walletPublicKey: PublicKey,
  signTransaction: WalletContextState['signTransaction'],
  sendTransaction: WalletContextState['sendTransaction'],
  connection: Connection
): Promise<TicketClaimResult>
```

### 5.2 Marinade Claim Instruction

```typescript
async function buildMarinadeClaimInstruction(
  ticket: StakingTicket,
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<TransactionInstruction>
```

Use `@marinade.finance/marinade-ts-sdk`:
```typescript
import { Marinade, MarinadeConfig } from '@marinade.finance/marinade-ts-sdk';

const config = new MarinadeConfig({ connection, publicKey: walletPublicKey });
const marinade = new Marinade(config);
const { transaction } = await marinade.claim(new PublicKey(ticket.ticketAccountAddress));
// Extract the claim instruction from the transaction
```

If SDK not available or throws, fall back to constructing the instruction manually using Marinade's program ID and the `claim` instruction discriminator from their IDL.

### 5.3 Sanctum Claim Instruction

Sanctum claim requires fetching the transaction from their API:

```typescript
async function buildSanctumClaimTransaction(
  ticket: StakingTicket,
  walletPublicKey: PublicKey
): Promise<VersionedTransaction | Transaction>
```

```
POST https://sanctum-extra-api.ngrok.dev/v1/redeem-ticket
Body: { ticket: ticketAccountAddress, wallet: walletAddress }
Response: { transaction: base64EncodedTransaction }
```

Deserialize and return. Sanctum may return a VersionedTransaction — handle both cases.

### 5.4 Native Stake / Jito / BlazeStake Withdraw

These all use the standard Solana `StakeProgram.withdraw()` instruction:

```typescript
function buildStakeWithdrawInstruction(
  ticket: StakingTicket,
  walletPublicKey: PublicKey,
  withdrawAmount: number  // lamports
): TransactionInstruction {
  return StakeProgram.withdraw({
    stakePubkey: new PublicKey(ticket.ticketAccountAddress),
    authorizedPubkey: walletPublicKey,
    toPubkey: walletPublicKey,         // SOL goes back to user's wallet
    lamports: withdrawAmount,
    custodianPubkey: undefined,
  });
}
```

### 5.5 Fee Collection

After ALL claim transactions confirm, send one final fee transaction:

```typescript
async function sendFeeTransaction(
  totalClaimedLamports: number,
  walletPublicKey: PublicKey,
  connection: Connection,
  signTransaction: WalletContextState['signTransaction']
): Promise<string>
```

```typescript
const feeLamports = Math.floor(totalClaimedLamports * TICKET_CLAIM_FEE_PERCENT / 100);
const feeInstruction = SystemProgram.transfer({
  fromPubkey: walletPublicKey,
  toPubkey: new PublicKey(TREASURY_WALLET),
  lamports: feeLamports,
});
// Build, sign, send, confirm
```

### 5.6 Transaction Execution Flow

```
For each claimable ticket:
  1. Build claim instruction for that protocol
  2. Batch up to MAX_CLAIMS_PER_TX instructions per transaction
  
For each batch:
  3. Add recentBlockhash + feePayer
  4. Sign via wallet adapter
  5. Send + confirm
  6. Update progress in UI

After all batches complete:
  7. Calculate totalClaimedLamports (sum of all successfully claimed tickets)
  8. Send fee transaction (1 instruction, separate tx)
  9. Return TicketClaimResult
```

---

## 6. New React Hook

File: `src/hooks/useTicketFinder.ts`

```typescript
export function useTicketFinder() {
  // From useAppStore:
  const ticketScanStatus = useAppStore(s => s.ticketScanStatus);
  const ticketScanResult = useAppStore(s => s.ticketScanResult);
  const ticketScanError = useAppStore(s => s.ticketScanError);
  const ticketClaimStatus = useAppStore(s => s.ticketClaimStatus);
  const ticketClaimResult = useAppStore(s => s.ticketClaimResult);
  const ticketClaimError = useAppStore(s => s.ticketClaimError);

  // From wallet adapter:
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();

  /**
   * Run the full scan across all protocols.
   * Called automatically after main wallet scan completes,
   * OR manually via a "Scan for Staking Tickets" button.
   */
  const runTicketScan = useCallback(async () => { ... }, [...]);

  /**
   * Open the claim confirm modal.
   * Only proceeds if claimableTickets.length > 0.
   */
  const initiateClaimAll = useCallback(() => { ... }, [...]);

  /**
   * Execute the actual claim transactions.
   * Called after user confirms in modal.
   */
  const executeClaimAll = useCallback(async () => { ... }, [...]);

  const cancelClaim = useCallback(() => { ... }, [...]);

  return {
    ticketScanStatus,
    ticketScanResult,
    ticketScanError,
    ticketClaimStatus,
    ticketClaimResult,
    ticketClaimError,
    runTicketScan,
    initiateClaimAll,
    executeClaimAll,
    cancelClaim,
  };
}
```

---

## 7. Zustand Store Updates

File: `src/hooks/useAppStore.ts` — append to existing store:

```typescript
// Engine 4 state
ticketScanStatus: TicketScanStatus;
ticketScanResult: TicketScanResult | null;
ticketScanError: AppError | null;
ticketClaimStatus: TicketClaimStatus_Action;
ticketClaimResult: TicketClaimResult | null;
ticketClaimError: AppError | null;

// Engine 4 actions
setTicketScanStatus: (status: TicketScanStatus) => void;
setTicketScanResult: (result: TicketScanResult) => void;
setTicketScanError: (error: AppError) => void;
setTicketClaimStatus: (status: TicketClaimStatus_Action) => void;
setTicketClaimResult: (result: TicketClaimResult) => void;
setTicketClaimError: (error: AppError) => void;
clearTickets: () => void;
```

---

## 8. UI Components

### 8.1 File Structure

```
src/components/tickets/
├── TicketFinderCard.tsx        ← Main section card
├── TicketRow.tsx               ← One row per ticket
├── PendingTicketRow.tsx        ← Separate display for pending (not yet claimable)
├── ClaimConfirmModal.tsx       ← Confirm before claiming
├── ClaimProgressModal.tsx      ← Progress during claiming
└── ProtocolBadge.tsx           ← Small protocol logo + name badge
```

### 8.2 TicketFinderCard

The main card shown in ScanPage. Has its own internal scan trigger since this scan is heavier than the main wallet scan (multiple external API calls).

**States:**

**State: Idle (scan not yet run)**
```
🎫 STAKING TICKET FINDER

Scan for forgotten unstaked SOL from Marinade, Sanctum,
Jito, BlazeStake, and native stake accounts.

[Scan for Staking Tickets]

Checks 5 protocols · Takes 5–20 seconds
```

**State: Scanning**
```
🎫 SCANNING PROTOCOLS...

✅ Marinade Finance
✅ Sanctum
⏳ Jito...
○  BlazeStake
○  Native Stake Accounts
```
(Update each line as each protocol completes — use per-protocol status flags)

**State: Complete — Nothing Found**
```
🎫 NO STAKING TICKETS FOUND

All 5 protocols scanned. No unredeemed tickets.
Your staked SOL is fully active or already claimed.
```
If any protocol had an error, show a subtle note: "Note: [Sanctum] could not be scanned. Try again later."

**State: Complete — Tickets Found**

Show two sections:

*Section A: Claimable Now*
```
✅ READY TO CLAIM

  [Ticket rows — see TicketRow below]

  ─────────────────────────────────────
  Total claimable:    2.47 SOL
  Service fee (5%):  -0.12 SOL
  You receive:        2.35 SOL  (~$352)

  [Claim All X Tickets →]
```

*Section B: Pending (if any)*
```
⏳ STILL UNSTAKING  (cannot claim yet)

  [PendingTicketRow for each]

  Check back in ~3 days to claim these.
```

### 8.3 TicketRow

One row per claimable ticket.

Layout:
```
[Protocol Badge]  [Ticket address shortened]  [Value]  [Claimable ✅]
Marinade          a4bC...f9eD                 1.20 SOL  Ready to claim
```

Fields:
- Protocol badge (logo + name) — use `ProtocolBadge` component
- Ticket account address, shortened, with external link to solscan.io
- Value in SOL (large, prominent)
- Estimated USD value (~$X)
- Status: green "Ready to Claim" badge
- If `validatorVoteAccount` is known: show "Staked with [validator]" in small text

### 8.4 PendingTicketRow

Same as TicketRow but:
- Orange "Pending" badge instead of green
- Show epochs remaining: "~2 days remaining" or "~1 epoch remaining"
- Slightly muted/dimmed styling vs claimable tickets
- No checkbox (can't be claimed yet)

### 8.5 ClaimConfirmModal

```
You are about to claim X staking ticket(s).

TICKETS TO CLAIM:
  Marinade ticket     1.20 SOL
  Native stake        1.27 SOL
  ─────────────────
  Total:              2.47 SOL

COST BREAKDOWN:
  Service fee (5%):  -0.12 SOL  (~$18)
  Network fees:      -0.001 SOL (~$0.15)
  ──────────────────────────────────────
  You receive:        2.35 SOL  (~$352)

This SOL has been sitting unclaimed in your wallet.
We found it. You get 95% of it.

[Cancel]   [Claim 2.35 SOL →]
```

**Important UX note:** The "You receive" number should be the most visually prominent element in this modal. This is the number that makes users feel great about using the app.

### 8.6 ClaimProgressModal

Shows per-protocol progress since claims may involve multiple transactions:

```
Claiming your staking tickets...

✅ Marinade ticket claimed — 1.20 SOL  [View ↗]
⏳ Native stake account... (confirming)

Do not close this window.
```

Success state:
```
🎉 All tickets claimed!

  Received:    2.47 SOL total
  Service fee: 0.12 SOL
  Net to you:  2.35 SOL  (~$352)

  Transactions:
  [Marinade claim ↗]  [Stake withdraw ↗]  [Fee tx ↗]

  [Done]
```

Partial success state (if some claims failed):
```
⚠️ Partial success

  ✅ Claimed: 1.20 SOL (Marinade ticket)
  ❌ Failed:  Native stake account

  The failed ticket can be retried. Your claimed SOL
  is already in your wallet.

  [Try Failed Tickets Again]  [Done]
```

### 8.7 ProtocolBadge Component

Reusable small badge showing protocol identity.

```tsx
// Props: protocol: StakingProtocol, size?: 'sm' | 'md'
// Shows: logo (if available) + protocol display name
// Falls back to a colored initial badge if no logo
```

---

## 9. ScanPage Integration

Engine 4 card goes between Engine 3 (Dust) and the summary card at the bottom of ScanPage.

```
┌─────────────────────────────────────────────────────────────┐
│  🛡️  WALLET SHIELD — [Engine 1]                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  💰  LOCKED SOL — [Engine 2]                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🧹  DUST TOKENS — [Engine 3]                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🎫  STAKING TICKETS — [Engine 4] ← NEW                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📊  TOTAL RECOVERABLE — [Summary Card]                    │
└─────────────────────────────────────────────────────────────┘
```

**Engine 4 scan does NOT run automatically with the main scan.** It has its own trigger button. Reason: It makes multiple external API calls (Sanctum API, multiple `getProgramAccounts` queries) and is noticeably slower. Separating it prevents the main scan from feeling slow.

**Update the summary card** to include `ticketScanResult.totalClaimableSOL` in the total recoverable amount calculation, but only if the ticket scan has been run. If not run yet, show a note: "+ Staking tickets not yet scanned" with a small [Scan] link.

---

## 10. New Error Codes

Append to `src/config/constants.ts`:

```typescript
// Engine 4
TICKET_SCAN_FAILED:    'Could not scan for staking tickets. Please try again.',
MARINADE_SCAN_FAILED:  'Could not scan Marinade Finance. This protocol may be temporarily unavailable.',
SANCTUM_API_FAILED:    'Sanctum API is unavailable. Your tickets may still exist — try again later.',
JITO_SCAN_FAILED:      'Could not scan Jito stake accounts.',
STAKE_SCAN_FAILED:     'Could not scan native stake accounts.',
TICKET_CLAIM_FAILED:   'Ticket claim failed. Your SOL was not affected. Please try again.',
TICKET_ALREADY_CLAIMED:'This ticket has already been claimed.',
TICKET_NOT_READY:      'This ticket cannot be claimed yet. The unstaking period has not completed.',
```

---

## 11. New Firebase Analytics Events

File: `src/lib/analytics.ts` — append:

```typescript
// Engine 4
logEvent('ticket_scan_started', { timestamp: Date.now() });

logEvent('ticket_scan_complete', {
  claimableCount: number,
  pendingCount: number,
  totalClaimableSOL: number,
  protocolsScanned: number,
  protocolsWithErrors: number,
  hadAnyTickets: boolean,
});

logEvent('ticket_claim_initiated', {
  ticketCount: number,
  estimatedSOL: number,
  protocols: string[],   // e.g. ['marinade', 'native_stake']
});

logEvent('ticket_claim_complete', {
  success: boolean,
  claimedCount: number,
  claimedSOL: number,
  failedCount: number,
  feeSOL: number,
});
```

---

## 12. New npm Dependencies

```bash
# Marinade SDK (for claim instructions)
npm install @marinade.finance/marinade-ts-sdk

# Already installed — no new deps needed for:
# - StakeProgram (in @solana/web3.js)
# - Native fetch for Sanctum API
# - getProgramAccounts (in @solana/web3.js)
```

**If Marinade SDK causes build issues** (it occasionally has peer dependency conflicts), skip it and construct the claim instruction manually using the Marinade program ID and instruction discriminator from their IDL. The instruction discriminator for `claim` is `[62, 198, 214, 193, 213, 159, 108, 210]` (8 bytes).

---

## 13. Security Requirements

All Engine 1–3 security rules apply. Additional rules for Engine 4:

**1. Verify ticket ownership before claiming.**
Before building any claim instruction, verify that the ticket's `beneficiary` or `withdrawer` field matches the connected wallet. Never attempt to claim a ticket that doesn't belong to the user.

**2. Verify claimability epoch before submitting.**
Re-fetch current epoch just before building claim transactions. If a ticket is not yet claimable at execution time (epoch changed during user interaction), skip it and report it as pending — do not submit a transaction that will fail.

**3. Never trust Sanctum API data blindly.**
After receiving ticket data from the Sanctum API, verify each ticket account exists on-chain before including it in the claim. A one-line check: `connection.getAccountInfo(ticketAddress)` — if null, skip.

**4. Cap maximum claim value warning.**
If `totalClaimableSOL > 10 SOL`, show an extra prominent warning in the confirm modal:
```
⚠️  You are about to claim more than 10 SOL.
    Please verify this is your wallet before proceeding.
```

**5. Fee calculation integrity.**
The fee must be calculated from `actualClaimedLamports` (sum of confirmed claims) — NOT from the estimate shown to the user. If fewer tickets are claimed than expected, the fee is lower. Never charge a fee based on an estimate.

---

## 14. Build Order for Agent

Add Engine 4 in this exact order:

1. **Dependencies** — `npm install @marinade.finance/marinade-ts-sdk`
2. **Types** — Append all new types to `src/types/index.ts`
3. **Constants** — Append new constants and error codes to `src/config/constants.ts`
4. **Protocol scanners** — Build `src/lib/ticketScanner.ts`:
   - `scanNativeStakeAccounts()` first (simplest, no external APIs)
   - `scanJitoStakeAccounts()` (same pattern as native)
   - `scanBlazeStakeAccounts()` (same pattern)
   - `scanMarinadeTickets()` (SDK + fallback)
   - `scanSanctumTickets()` (API call)
   - `scanForStakingTickets()` (orchestrator — build last)
5. **Claim logic** — Build `src/lib/ticketClaimer.ts`:
   - `buildStakeWithdrawInstruction()` first (standard Solana)
   - `buildMarinadeClaimInstruction()` (SDK)
   - `buildSanctumClaimTransaction()` (API)
   - `claimAllTickets()` (orchestrator)
6. **Zustand store** — Add Engine 4 state slices
7. **Hook** — `src/hooks/useTicketFinder.ts`
8. **UI components** — In order: `ProtocolBadge`, `TicketRow`, `PendingTicketRow`, `TicketFinderCard`, `ClaimConfirmModal`, `ClaimProgressModal`
9. **ScanPage integration** — Add `TicketFinderCard` to ScanPage, update summary card
10. **Analytics** — Add new Firebase events
11. **TypeScript check** — `tsc --noEmit` must pass with zero errors
12. **Build check** — `npm run build` must succeed

---

## 15. Testing Checklist

**Scanner**
- [ ] Native stake accounts detected correctly (use a wallet known to have deactivated stakes)
- [ ] Marinade tickets detected (use a wallet that has pending Marinade claims)
- [ ] Sanctum API returns data correctly and maps to `StakingTicket[]`
- [ ] If Sanctum API is down (simulate with wrong URL), scan still completes for other protocols
- [ ] Tickets with `claimableAfterEpoch > currentEpoch` correctly marked as `pending`
- [ ] Tickets with `claimableAfterEpoch <= currentEpoch` correctly marked as `claimable`
- [ ] Wallet with NO tickets shows "nothing found" state correctly
- [ ] `protocolsWithErrors[]` populated when a protocol fails

**Claim Flow**
- [ ] Confirm modal shows correct SOL breakdown
- [ ] Claim modal warns correctly when total > 10 SOL
- [ ] Native stake withdraw executes successfully
- [ ] Marinade claim executes successfully
- [ ] Progress modal updates per-ticket as claims complete
- [ ] Fee transaction fires after all claims complete
- [ ] Fee equals exactly 5% of actually claimed SOL (not estimate)
- [ ] Partial success case: failed tickets shown, successful SOL in wallet
- [ ] `TX_REJECTED` (user cancels in wallet) handled gracefully

**Integration**
- [ ] Engine 4 card appears below Engine 3 in ScanPage
- [ ] Summary card total updates to include claimable ticket value
- [ ] Engine 4 scan runs independently from main wallet scan
- [ ] All 4 engines can run sequentially in one session without state conflicts
- [ ] `tsc --noEmit` passes with zero errors after Engine 4 added
- [ ] `npm run build` succeeds

---

*End of Engine 4 Specification*
*Version 1.0 — Extends Wallet Shield (Engines 1, 2, 3 already built)*
