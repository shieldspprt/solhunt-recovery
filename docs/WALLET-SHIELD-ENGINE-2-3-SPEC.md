# 🔧 Wallet Shield — Engine 2 & Engine 3 Spec
### For AI Agent Build (Claude Opus / Cursor / Windsurf)
### Adds to existing working codebase — do NOT rebuild from scratch

---

## ⚠️ AGENT CONTEXT — READ FIRST

You are extending an **already working** Solana wallet security app called Wallet Shield.

**Engine 1 (Permission Revocation) is already built and working.**

Your job:
- Add **Engine 2: Account Rent Reclaimer** — close empty token accounts, return locked SOL to user
- Add **Engine 3: Dust Consolidator** — swap tiny worthless token balances to SOL via Jupiter

**Rules carry over from Engine 1 — all still apply:**
- Never store private keys
- Never touch funds without explicit user confirmation modal
- Strict TypeScript — no `any` types
- All errors show user-friendly messages
- All fees shown clearly before signing
- Fail loudly, never silently

---

## 1. How the Existing App Is Structured

Before adding anything, understand what already exists:

```
src/
├── config/constants.ts       ← Add new fee constants here
├── lib/scanner.ts            ← Already scans token accounts — REUSE this data
├── lib/revoke.ts             ← Engine 1 logic — reference for pattern
├── hooks/useAppStore.ts      ← Add new state slices here
├── hooks/useWalletScanner.ts ← Already fetches ScanResult — engines share this
├── types/index.ts            ← Add new types here
└── pages/ScanPage.tsx        ← Add new engine sections below existing results
```

**Key insight:** The scanner already fetches ALL token accounts including empty ones. `ScanResult` already contains `emptyAccounts[]`. Engine 2 simply acts on data that is already there. No new RPC calls needed for the basic case.

---

## 2. What to Add to Existing Types

File: `src/types/index.ts` — append these types, do not change existing ones.

```typescript
// ─── ENGINE 2: RENT RECLAIMER ────────────────────────────

export interface CloseableAccount {
  address: string;           // Token account public key
  mint: string;              // Token mint (for display)
  tokenSymbol: string;       // "USDC", "BONK", or "UNKNOWN"
  tokenBalance: number;      // Should be 0 — but verify
  estimatedRentLamports: number;   // Lamports locked in this account (~2039280)
  estimatedRentSOL: number;        // estimatedRentLamports / 1e9
  programId: TokenProgramId; // Which token program owns it
}

export interface ReclaimEstimate {
  totalAccounts: number;
  totalLamports: number;
  totalSOL: number;
  userReceivesSOL: number;   // After service fee
  serviceFeeSOL: number;
  networkFeeSOL: number;
}

export type ReclaimStatus =
  | 'idle'
  | 'awaiting_confirmation'
  | 'building_transaction'
  | 'awaiting_signature'
  | 'confirming'
  | 'complete'
  | 'error';

export interface ReclaimResult {
  success: boolean;
  closedCount: number;
  reclaimedSOL: number;
  signature: string | null;
  errorMessage: string | null;
}

// ─── ENGINE 3: DUST CONSOLIDATOR ─────────────────────────

export interface DustToken {
  tokenAccountAddress: string;
  mint: string;
  tokenSymbol: string;
  tokenLogoUri: string | null;
  rawBalance: string;          // Full precision as string
  uiBalance: number;           // Human readable
  decimals: number;
  estimatedValueUSD: number;   // 0 if price unavailable
  estimatedValueSOL: number;   // 0 if price unavailable
  isSwappable: boolean;        // Jupiter can swap this token
  programId: TokenProgramId;
}

export interface DustScanResult {
  dustTokens: DustToken[];
  totalEstimatedValueUSD: number;
  totalEstimatedValueSOL: number;
  swappableCount: number;
  unswappableCount: number;
}

export interface DustSwapQuote {
  inputMint: string;
  outputMint: string;           // Always wSOL or SOL
  inAmount: string;
  outAmount: string;            // Estimated SOL out (lamports as string)
  outAmountSOL: number;         // Human readable
  priceImpactPct: number;
  routePlan: string;            // Jupiter route summary for display
}

export type DustStatus =
  | 'idle'
  | 'fetching_prices'
  | 'awaiting_confirmation'
  | 'swapping'
  | 'complete'
  | 'error';

export interface DustResult {
  success: boolean;
  swappedCount: number;
  receivedSOL: number;
  signatures: string[];
  errorMessage: string | null;
}
```

---

## 3. New Constants

File: `src/config/constants.ts` — append to existing file:

```typescript
// ─── ENGINE 2: RENT RECLAIMER FEES ───────────────────────

// Service fee: percentage of reclaimed SOL kept by the app
// Example: user reclaims 0.2 SOL, app keeps 15% = 0.03 SOL
export const RENT_RECLAIM_FEE_PERCENT = 15;

// Minimum accounts required to offer reclaim
// (Not worth the UX for 1-2 accounts)
export const RENT_RECLAIM_MIN_ACCOUNTS = 3;

// Solana standard token account rent (lamports)
// This is the actual on-chain minimum — verified via getMinimumBalanceForRentExemption
export const TOKEN_ACCOUNT_RENT_LAMPORTS = 2039280;

// Max accounts to close per transaction (conservative Solana tx size limit)
export const MAX_CLOSE_PER_TX = 15;

// ─── ENGINE 3: DUST CONSOLIDATOR FEES ────────────────────

// Service fee: percentage of total SOL received from swaps
export const DUST_SWAP_FEE_PERCENT = 12;

// Minimum USD value to consider a token "dust" worth consolidating
// Tokens worth MORE than this are shown as warnings, not auto-selected
export const DUST_MAX_VALUE_USD = 2.00;

// Maximum tokens to swap in one session
export const DUST_MAX_TOKENS_PER_SESSION = 20;

// Jupiter API endpoint
export const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
export const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

// SOL mint address (used as output token in swaps)
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Minimum SOL output worth executing a swap for (in lamports)
// Skip tokens where Jupiter quote returns less than this
export const MIN_SWAP_OUTPUT_LAMPORTS = 10000; // 0.00001 SOL
```

---

## 4. ENGINE 2 — Account Rent Reclaimer

### What It Does

Every token account on Solana holds ~0.002 SOL in "rent" to keep the account alive. When a token goes to zero (rug, sold everything, airdrop junk), the account stays open. That rent is permanently locked — until you close the account.

This engine:
1. Finds all token accounts with zero balance
2. Shows user how much SOL is locked
3. Closes them all in batched transactions
4. Returns SOL to user's wallet (minus service fee)

### 4.1 Core Logic

File: `src/lib/reclaimRent.ts` — create this new file.

```typescript
// Functions to implement:

/**
 * Filter ScanResult.emptyAccounts into CloseableAccount[]
 * Verify balance is truly 0 before marking as closeable
 * This uses data already in ScanResult — no new RPC calls
 */
function getCloseableAccounts(scanResult: ScanResult): CloseableAccount[]

/**
 * Calculate what the user will receive after fees
 * Uses RENT_RECLAIM_FEE_PERCENT from constants
 * Returns ReclaimEstimate for display in confirm modal
 */
function calculateReclaimEstimate(accounts: CloseableAccount[]): ReclaimEstimate

/**
 * Build batched close account transactions
 * Each transaction closes MAX_CLOSE_PER_TX accounts
 * Uses spl-token: createCloseAccountInstruction()
 * 
 * IMPORTANT: closeAccount sends rent to the "destination" address
 * Set destination = user's wallet (they get the SOL back)
 * 
 * Fee mechanic: Add a SystemProgram.transfer instruction to FIRST tx only
 * Transfer = (totalReclaimedLamports * RENT_RECLAIM_FEE_PERCENT / 100)
 * This transfers the fee from user wallet to TREASURY_WALLET
 * 
 * Transaction structure per batch:
 * [closeAccount x15, ..., SystemProgram.transfer (first tx only)]
 */
async function buildReclaimTransactions(
  accounts: CloseableAccount[],
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<Transaction[]>
```

### 4.2 The Close Account Instruction

```typescript
import { createCloseAccountInstruction } from '@solana/spl-token';

// For each account to close:
const closeInstruction = createCloseAccountInstruction(
  new PublicKey(account.address),    // token account to close
  walletPublicKey,                    // destination: rent goes here (user's wallet)
  walletPublicKey,                    // authority: owner (user)
  [],                                 // multisig signers: none
  account.programId                   // TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID
);
```

### 4.3 Safety Checks Before Building Transaction

Verify ALL of these before building — throw AppError if any fail:

1. `accounts.length >= RENT_RECLAIM_MIN_ACCOUNTS` — don't proceed for tiny sets
2. Each account balance is confirmed 0 — re-verify against RPC if last scan > 60 seconds ago
3. User has enough SOL for network fees (at least 0.001 SOL beyond what they're reclaiming)
4. Total fee transfer amount is positive and less than total reclaimed amount

### 4.4 New Hook

File: `src/hooks/useReclaimRent.ts`

```typescript
// State comes from useAppStore
// Exposes:
//   closeableAccounts: CloseableAccount[]
//   reclaimEstimate: ReclaimEstimate | null
//   reclaimStatus: ReclaimStatus
//   reclaimResult: ReclaimResult | null
//   reclaimError: AppError | null
//   initiateReclaim: () => void      // Opens confirm modal
//   executeReclaim: () => Promise<void>  // Runs after user confirms
//   cancelReclaim: () => void
```

### 4.5 New UI Components

**`src/components/reclaim/ReclaimCard.tsx`**

Shown in ScanPage below the Wallet Shield results section.

Display logic:
- If `closeableAccounts.length < RENT_RECLAIM_MIN_ACCOUNTS`: Show nothing (don't clutter UI)
- If `closeableAccounts.length >= 3`: Show the card

Card content:
```
💰 LOCKED SOL FOUND

You have [N] empty token accounts with SOL locked inside.

  Estimated recovery:     0.2040 SOL
  Service fee (15%):     -0.0306 SOL
  ─────────────────────────────────
  You receive:            0.1734 SOL  (~$26.00)

  [Reclaim My SOL →]

  Note: This closes empty accounts only. Accounts with 
  token balances are not affected.
```

**`src/components/reclaim/ReclaimConfirmModal.tsx`**

Confirm modal — same pattern as RevokeConfirmModal.

Must show:
- Exact number of accounts being closed
- Exact SOL breakdown (reclaimed, fee, network fee, user receives)
- Clear statement: "Closing empty accounts permanently removes them. This cannot be undone. Your tokens are not affected because these accounts have zero balance."
- [Cancel] [Close X Accounts & Reclaim SOL]

**`src/components/reclaim/ReclaimProgressModal.tsx`**

Same pattern as RevokeProgressModal. Shows batch progress if multiple transactions needed.

---

## 5. ENGINE 3 — Dust Consolidator

### What It Does

After a wallet has been active for months, it accumulates "dust" — tokens worth $0.01 to $2.00 from airdrops, failed trades, etc. These are too small to bother selling manually, but collectively add up to $10–$60+ per wallet.

This engine:
1. Scans for tokens under $2 USD in value
2. Gets Jupiter swap quotes to convert them to SOL
3. Executes swaps (one per token — Jupiter handles routing)
4. User receives SOL in their wallet

### 5.1 Dust Detection Logic

File: `src/lib/dustScanner.ts`

```typescript
/**
 * From ALL token accounts (not just empty ones), find dust tokens.
 * A token is "dust" if:
 *   - uiBalance > 0 (has some tokens)
 *   - estimatedValueUSD <= DUST_MAX_VALUE_USD ($2.00)
 *   - OR estimatedValueUSD is unknown (no price data) AND uiBalance < 1000 tokens
 *
 * Price fetching:
 *   Use Jupiter Price API v2: https://price.jup.ag/v2/price?ids=MINT1,MINT2,...
 *   Batch all mints in a single request (comma-separated)
 *   Map response back to token accounts
 *   Tokens with no price data: estimatedValueUSD = 0, isSwappable = false initially
 */
async function scanForDust(
  tokenAccounts: ParsedTokenAccountData[],
  connection: Connection
): Promise<DustScanResult>

/**
 * For each dust token with a balance, get a Jupiter swap quote.
 * Input: token mint + full balance
 * Output: SOL
 * 
 * Use Jupiter Quote API v6:
 *   GET https://quote-api.jup.ag/v6/quote
 *   Params: inputMint, outputMint (SOL_MINT), amount (raw), slippageBps: 100
 * 
 * If quote returns outAmount < MIN_SWAP_OUTPUT_LAMPORTS:
 *   Mark token as isSwappable = false (not worth the gas)
 * 
 * Handle rate limits: Jupiter allows ~10 req/sec on free tier
 * Fetch quotes in batches of 5 with 200ms delay between batches
 */
async function getSwapQuotes(
  dustTokens: DustToken[],
  walletAddress: string
): Promise<Map<string, DustSwapQuote>>  // key = mint address
```

### 5.2 Swap Execution Logic

File: `src/lib/dustSwapper.ts`

```typescript
/**
 * Build swap transactions using Jupiter Swap API.
 * 
 * For each token to swap:
 *   POST https://quote-api.jup.ag/v6/swap
 *   Body: { quoteResponse, userPublicKey, wrapAndUnwrapSol: true }
 *   Response contains: swapTransaction (base64 encoded versioned transaction)
 * 
 * IMPORTANT — Jupiter returns VersionedTransaction, not legacy Transaction.
 * You must use VersionedTransaction from @solana/web3.js for these.
 * The wallet adapter must sign VersionedTransaction — use signTransaction() not sendTransaction().
 * 
 * Execution order:
 *   - Execute one swap at a time (not batched — Jupiter txs are large)
 *   - Wait for confirmation before next swap
 *   - If one swap fails, continue to the next (partial success is fine)
 *   - Collect all signatures for the result summary
 * 
 * Fee mechanic:
 *   Jupiter does NOT support adding extra instructions to swap transactions easily.
 *   Instead: After ALL swaps complete, calculate total SOL received and send
 *   a single fee transfer transaction:
 *     fee = totalReceivedLamports * DUST_SWAP_FEE_PERCENT / 100
 *     SystemProgram.transfer to TREASURY_WALLET
 * 
 * This keeps swaps clean and fee is collected at the end.
 */
async function executeSwaps(
  tokens: DustToken[],
  quotes: Map<string, DustSwapQuote>,
  walletPublicKey: PublicKey,
  signTransaction: SignerWalletAdapterProps['signTransaction'],
  connection: Connection
): Promise<DustResult>
```

### 5.3 Jupiter API Details

**Price API (for dust detection):**
```
GET https://price.jup.ag/v2/price?ids=MINT1,MINT2,MINT3
Response: { data: { [mint]: { price: number } } }
```

**Quote API:**
```
GET https://quote-api.jup.ag/v6/quote?inputMint=X&outputMint=So111...&amount=Y&slippageBps=100
```

**Swap API:**
```
POST https://quote-api.jup.ag/v6/swap
Content-Type: application/json
Body: {
  quoteResponse: <full quote response object>,
  userPublicKey: "<wallet address>",
  wrapAndUnwrapSol: true,
  prioritizationFeeLamports: 1000
}
```

**Error handling for Jupiter:**
- 429 Too Many Requests: Wait 1 second, retry once
- Quote not found: Mark token as `isSwappable = false`
- Swap transaction fails: Log error, skip to next token
- Never crash the whole session because one token failed

### 5.4 New Hook

File: `src/hooks/useDustConsolidator.ts`

```typescript
// Exposes:
//   dustScanResult: DustScanResult | null
//   swapQuotes: Map<string, DustSwapQuote>
//   selectedMints: string[]            // User can deselect tokens
//   dustStatus: DustStatus
//   dustResult: DustResult | null
//   dustError: AppError | null
//   toggleTokenSelection: (mint: string) => void
//   selectAll: () => void
//   deselectAll: () => void
//   fetchDustData: () => Promise<void>   // Called after scan
//   initiateDustSwap: () => void         // Opens confirm modal
//   executeDustSwap: () => Promise<void>
//   cancelDustSwap: () => void
```

### 5.5 New UI Components

**`src/components/dust/DustCard.tsx`**

Main dust consolidator section card.

Display logic:
- If `dustScanResult.swappableCount === 0`: Show "No dust found — your wallet is efficient!" quietly
- If `dustScanResult.swappableCount > 0`: Show the full card

Card content:
```
🧹 DUST FOUND — [N] Tiny Token Balances

  [Token list — see DustTokenRow below]

  ─────────────────────────────────────
  Estimated SOL from swaps:   0.042 SOL
  Service fee (12%):         -0.005 SOL  
  You receive:               ~0.037 SOL  (~$5.55)

  Prices are estimates. Final amount depends on Jupiter routing.

  [Select All]  [Deselect All]

  [Consolidate [N] Tokens to SOL →]
```

**`src/components/dust/DustTokenRow.tsx`**

One row per dust token.

Shows:
- Checkbox (user can deselect tokens they want to keep)
- Token symbol + logo (if available)
- Balance (e.g. "14,203 BONK")
- Estimated USD value (e.g. "~$0.43")
- Estimated SOL out from Jupiter quote (e.g. "→ 0.0028 SOL")
- Route (e.g. "via Raydium")
- If not swappable: Grey out with tooltip "Too small to swap profitably"

**`src/components/dust/DustConfirmModal.tsx`**

Must show:
- List of tokens being swapped (summarized — not one row per token if many)
- Total estimated SOL received
- Fee breakdown
- **Important warning:** "Swap amounts are estimates. Actual SOL received may vary by up to 1% due to price movement. Tokens will be permanently swapped — this cannot be undone."
- [Cancel] [Swap [N] Tokens →]

**`src/components/dust/DustProgressModal.tsx`**

Progress modal — shows swap-by-swap progress since these are sequential.

```
Swapping dust tokens to SOL...

✅ BONK → 0.0028 SOL
✅ WIF  → 0.0019 SOL
⏳ POPCAT... (in progress)
○  JUP  (waiting)
○  MYRO (waiting)

Do not close this window.
```

After completion:
```
✅ Consolidation Complete!

Received: 0.037 SOL from 5 tokens
[View Transactions on Solscan]
[Done]
```

---

## 6. ScanPage Layout — How All 3 Engines Fit Together

File: `src/pages/ScanPage.tsx`

After a scan completes, the page should render engines in this order:

```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ WALLET SHIELD RESULTS                                   │
│  [Engine 1: Permission results — already built]             │
│                                                             │
│  ⚠️ 4 dangerous permissions found → [Revoke All]           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  💰 LOCKED SOL                                              │
│  [Engine 2: ReclaimCard — shows if ≥3 empty accounts]      │
│                                                             │
│  12 empty accounts • ~0.024 SOL locked → [Reclaim SOL]    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🧹 DUST TOKENS                                             │
│  [Engine 3: DustCard — shows if swappable tokens exist]    │
│                                                             │
│  6 dust tokens • ~$4.20 total → [Consolidate to SOL]      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📊 WALLET SUMMARY                                          │
│  Total recoverable value: ~$XX.XX                          │
└─────────────────────────────────────────────────────────────┘
```

**The summary card at the bottom:**
Adds up all recoverable values and shows total. This is the number users will screenshot and share.

```
🔍 SCAN COMPLETE

  Protected from:    4 dangerous permissions  ✅ (after revoke)
  Locked SOL:        0.024 SOL (~$3.60)
  Dust value:        0.037 SOL (~$5.55)
  ─────────────────────────────────────────
  Total recoverable: 0.061 SOL (~$9.15)

  Running all 3 engines takes less than 60 seconds.
```

---

## 7. Zustand Store Updates

File: `src/hooks/useAppStore.ts` — add these slices to existing store:

```typescript
// Engine 2 state
reclaimStatus: ReclaimStatus;
closeableAccounts: CloseableAccount[];
reclaimEstimate: ReclaimEstimate | null;
reclaimResult: ReclaimResult | null;
reclaimError: AppError | null;

// Engine 3 state
dustScanResult: DustScanResult | null;
swapQuotes: Map<string, DustSwapQuote>;
selectedDustMints: string[];
dustStatus: DustStatus;
dustResult: DustResult | null;
dustError: AppError | null;

// New actions
setCloseableAccounts: (accounts: CloseableAccount[]) => void;
setReclaimStatus: (status: ReclaimStatus) => void;
setReclaimResult: (result: ReclaimResult) => void;
setReclaimError: (error: AppError) => void;
setDustScanResult: (result: DustScanResult) => void;
setSwapQuotes: (quotes: Map<string, DustSwapQuote>) => void;
toggleDustMint: (mint: string) => void;
setAllDustMints: (mints: string[]) => void;
setDustStatus: (status: DustStatus) => void;
setDustResult: (result: DustResult) => void;
setDustError: (error: AppError) => void;
```

---

## 8. New Error Codes

Append to `src/config/constants.ts`:

```typescript
// Engine 2
RECLAIM_NO_ACCOUNTS: 'Not enough empty accounts to reclaim.',
RECLAIM_TX_FAILED: 'Could not close accounts. No changes were made.',

// Engine 3
DUST_PRICE_FETCH_FAILED: 'Could not fetch token prices. Please try again.',
DUST_QUOTE_FAILED: 'Could not get swap quotes from Jupiter. Please try again.',
DUST_SWAP_FAILED: 'One or more swaps failed. Check your wallet for partial results.',
JUPITER_UNAVAILABLE: 'Jupiter swap service is currently unavailable. Try again later.',
```

---

## 9. New Firebase Analytics Events

File: `src/lib/analytics.ts` — append:

```typescript
// Engine 2 events
logEvent('reclaim_initiated', { accountCount: number, estimatedSOL: number });
logEvent('reclaim_complete', { success: boolean, closedCount: number, reclaimedSOL: number });

// Engine 3 events
logEvent('dust_scan_complete', { dustCount: number, swappableCount: number, estimatedValueUSD: number });
logEvent('dust_swap_initiated', { tokenCount: number, estimatedSOL: number });
logEvent('dust_swap_complete', { success: boolean, swappedCount: number, receivedSOL: number });
```

---

## 10. New Dependencies to Install

```bash
# No new major dependencies needed for Engine 2
# (closeAccount instruction is already in @solana/spl-token)

# Jupiter API is called via fetch() — no SDK needed
# Price API is also fetch() calls

# Optional: For better number formatting
npm install @stdlib/number-float64-base-from-binary
```

Actually — no new npm dependencies are needed. All Jupiter integration is done via the native `fetch()` API. Everything else is already in `@solana/web3.js` and `@solana/spl-token`.

---

## 11. Security Additions for These Engines

### Engine 2 — Close Account Safety

1. **Double-check balance before closing.** If the account has > 0 tokens when you fetch it just before building the transaction, skip it and warn the user. Never close an account with tokens.

2. **Verify destination address.** The `createCloseAccountInstruction` destination must always be `walletPublicKey`. Never allow this to be a different address.

3. **Cap maximum SOL per session.** If total reclaim would be > 1 SOL, show an extra confirmation: "You are reclaiming more than 1 SOL. Please confirm this is intentional."

### Engine 3 — Dust Swap Safety

1. **Never swap tokens above the dust threshold without explicit warning.** If a token somehow ends up worth > $5 in the selection, show a red warning on that row: "This token is worth $X — are you sure you want to swap it as dust?"

2. **Slippage protection.** Always pass `slippageBps: 100` (1%) to Jupiter. Never increase this even if the user asks. If a quote fails due to slippage, skip that token.

3. **Minimum output guard.** Before executing each swap, verify the Jupiter quote's `outAmount` is still within 2% of what was shown to the user at confirmation time. If price moved more than 2%, skip that token and report it.

4. **Never sign an unknown transaction.** The swap transaction from Jupiter is a black box. Before passing it to `signTransaction()`, verify:
   - It's a `VersionedTransaction`
   - The fee payer matches the user's wallet
   - The transaction has a valid recent blockhash
   If any check fails, abort that swap.

---

## 12. Build Order for Agent

Add features in this exact order:

1. **Types** — Add all new types to `src/types/index.ts`
2. **Constants** — Add new constants and error codes to `src/config/constants.ts`
3. **Engine 2 logic** — `src/lib/reclaimRent.ts` (pure functions)
4. **Engine 2 hook** — `src/hooks/useReclaimRent.ts`
5. **Engine 2 UI** — `ReclaimCard`, `ReclaimConfirmModal`, `ReclaimProgressModal`
6. **Engine 2 integration** — Add ReclaimCard to ScanPage, test end to end
7. **Engine 3 scanner** — `src/lib/dustScanner.ts` (price fetch + dust detection)
8. **Engine 3 swapper** — `src/lib/dustSwapper.ts` (Jupiter integration)
9. **Engine 3 hook** — `src/hooks/useDustConsolidator.ts`
10. **Engine 3 UI** — `DustCard`, `DustTokenRow`, `DustConfirmModal`, `DustProgressModal`
11. **Engine 3 integration** — Add DustCard to ScanPage, test end to end
12. **Summary card** — Add total recoverable value card at bottom of ScanPage
13. **Zustand store updates** — Ensure all new state slices are wired in
14. **Analytics events** — Add all new Firebase events
15. **TypeScript check** — `tsc --noEmit` must pass with zero errors
16. **Build check** — `npm run build` must succeed

---

## 13. Testing Checklist

**Engine 2 — Rent Reclaimer**
- [ ] Empty accounts detected correctly after scan
- [ ] Fee calculation is correct (reclaimed SOL × 15% = fee)
- [ ] Confirm modal shows correct SOL breakdown
- [ ] Accounts are closed successfully on a real wallet
- [ ] SOL appears in wallet after close
- [ ] App handles "0 closeable accounts" gracefully (no card shown)
- [ ] App handles RPC error mid-close gracefully

**Engine 3 — Dust Consolidator**
- [ ] Dust tokens detected from real wallet
- [ ] Jupiter price API returns prices correctly
- [ ] Tokens with no price data handled gracefully (shown as unswappable)
- [ ] Jupiter quote fetched correctly for each token
- [ ] Token deselection works (user can uncheck tokens)
- [ ] Confirm modal shows correct estimates with disclaimer
- [ ] Swaps execute sequentially and progress modal updates
- [ ] SOL appears in wallet after swaps
- [ ] Fee transfer fires after all swaps complete
- [ ] Partial success case works (some swaps pass, some fail)
- [ ] `tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds

---

*End of Engine 2 & Engine 3 Specification*
*Version 1.0 — Extends existing Wallet Shield codebase*
