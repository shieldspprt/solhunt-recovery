# 🔐 SolHunt — Complete Codebase Audit & Hardening Specification
### For: Claude Opus 4.6 (or Senior Security Reviewer)
### Scope: All 6 Engines — Full Security, Quality & Performance Audit
### Standard: Finance-Grade Production Application

---

## ⚠️ AUDIT AGENT — READ THIS FIRST

You are performing a **complete security and quality audit** of SolHunt — a Solana wallet recovery application that handles real user wallets and real SOL.

**What is at stake:**
- Users are connecting real wallets with real funds
- The app builds and submits transactions that move SOL and interact with tokens
- A single vulnerability could result in user fund loss
- A single UX failure in a confirmation flow could cause irreversible actions

**Your role:** Read every file in the codebase. Fix every issue you find. Do not skip anything because it seems minor. In finance-grade applications, minor issues compound into catastrophic failures.

**Output of this audit:**
- Fixed code (not just a report — actually fix every issue found)
- Audit log: a written record of every issue found, its severity, and how it was fixed
- Test coverage improvements
- Performance optimizations
- A final "Audit Complete" summary with confidence rating

**Audit philosophy:**
> *"If you are not sure if something is safe — it is not safe. Fix it."*

---

## PART 1 — PRE-AUDIT SETUP

### 1.1 Run These Commands First

Before reading a single file, run all of these and record the output:

```bash
# TypeScript strict check — must be zero errors
npx tsc --noEmit --strict 2>&1 | tee audit-ts-errors.txt

# Build check
npm run build 2>&1 | tee audit-build.txt

# Check for known vulnerable dependencies
npm audit 2>&1 | tee audit-npm.txt

# Check for any hardcoded secrets (API keys, private keys)
grep -rn "private" src/ --include="*.ts" --include="*.tsx" | tee audit-secrets-private.txt
grep -rn "secret" src/ --include="*.ts" --include="*.tsx" | tee audit-secrets-secret.txt
grep -rn "PRIVATE_KEY" src/ --include="*.ts" --include="*.tsx" | tee audit-secrets-pk.txt
grep -rn "0x" src/ --include="*.ts" --include="*.tsx" | tee audit-hex.txt

# Check for console.log statements that may leak data
grep -rn "console.log" src/ --include="*.ts" --include="*.tsx" | tee audit-consolelog.txt

# Check for any instances of 'any' type
grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | tee audit-any-types.txt
grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | tee audit-as-any.txt

# Check for unhandled promise rejections
grep -rn "\.then(" src/ --include="*.ts" --include="*.tsx" | grep -v "catch" | tee audit-unhandled-promises.txt

# Check bundle sizes
npm run build && du -sh dist/assets/* | sort -rh | tee audit-bundle-sizes.txt
```

Record all output. Fix every finding from these commands before continuing.

### 1.2 Establish Audit Log

Create a file `AUDIT_LOG.md` in the project root. For every issue found during the audit, add an entry:

```markdown
## Issue #[N]
- **File:** src/path/to/file.ts
- **Line:** [line number]
- **Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
- **Category:** Security | Logic | Performance | UX | Type Safety | Error Handling
- **Description:** What the issue is
- **Risk:** What could go wrong if not fixed
- **Fix Applied:** What was changed to fix it
- **Status:** FIXED | WONT_FIX (with reason)
```

---

## PART 2 — SECURITY AUDIT

### 2.1 CRITICAL — Private Key & Secret Exposure

**Check every file for:**

```typescript
// These patterns must NEVER appear in src/ files
// If found anywhere: CRITICAL severity, fix immediately

- Any import of bs58 for private key decoding in frontend code
- Any reference to Keypair.fromSecretKey() in frontend code
- Any variable named privateKey, secretKey, or seed in non-test code
- Any hardcoded base58 string that looks like a Solana private key (87-88 chars)
- Any hardcoded API key or RPC URL (must always come from import.meta.env)
- Any environment variable read without VITE_ prefix
- process.env usage (not available in Vite browser builds — silently undefined)
```

**Required pattern for all env vars:**
```typescript
// CORRECT — always check for existence
const rpcUrl = import.meta.env.VITE_HELIUS_RPC_URL;
if (!rpcUrl) throw new Error('VITE_HELIUS_RPC_URL is not configured');

// WRONG — silently undefined in production
const rpcUrl = process.env.HELIUS_RPC_URL;
```

**Audit action:** Search every file. Fix every instance. Add a startup check that verifies all required env vars are present and throws a visible error if not.

---

### 2.2 CRITICAL — Transaction Instruction Verification

**Every transaction built in the codebase must be audited.**

For each transaction-building function across all 6 engines, verify:

**Check 1 — Instruction whitelist**
```typescript
// Before submitting ANY transaction, verify it contains ONLY allowed instructions
// Maintain an explicit whitelist of allowed program IDs

const ALLOWED_PROGRAM_IDS = new Set([
  SystemProgram.programId.toString(),           // SOL transfers (fees only)
  TOKEN_PROGRAM_ID.toString(),                  // SPL Token operations
  TOKEN_2022_PROGRAM_ID.toString(),             // Token-2022 operations
  BUBBLEGUM_PROGRAM_ID,                         // cNFT burns
  SPL_NOOP_PROGRAM_ID,                          // Required by Bubblegum
  SPL_COMPRESSION_PROGRAM,                      // Required by Bubblegum
  MARINADE_PROGRAM_ID,                          // Marinade claims
  StakeProgram.programId.toString(),            // Native stake withdrawals
  ORCA_WHIRLPOOL_PROGRAM_ID,                    // LP fee harvest
  RAYDIUM_CLMM_PROGRAM_ID,                      // LP fee harvest
  METEORA_DLMM_PROGRAM_ID,                      // LP fee harvest
]);

function verifyTransaction(tx: Transaction | VersionedTransaction): void {
  const instructions = tx instanceof Transaction
    ? tx.instructions
    : tx.message.compiledInstructions;

  for (const ix of instructions) {
    const programId = tx instanceof Transaction
      ? ix.programId.toString()
      : tx.message.staticAccountKeys[ix.programIdIndex].toString();

    if (!ALLOWED_PROGRAM_IDS.has(programId)) {
      throw new Error(`SECURITY: Unexpected program ID in transaction: ${programId}`);
    }
  }
}

// Call this BEFORE every signTransaction() call
verifyTransaction(tx);
await signTransaction(tx);
```

**Check 2 — Fee payer verification**
Every transaction must have `feePayer` explicitly set to the connected wallet's public key. Verify this for every transaction builder function.

**Check 3 — Instruction count limits**
Verify no transaction exceeds 25 instructions. Over-stuffed transactions can cause unexpected behavior.

**Check 4 — SystemProgram.transfer destinations**
Every `SystemProgram.transfer` instruction in the codebase must send SOL ONLY to `TREASURY_WALLET`. Find every instance of `SystemProgram.transfer` and verify the `toPubkey` is always `new PublicKey(TREASURY_WALLET)` — never a dynamic address, never an address from user input or API response.

```typescript
// CORRECT
SystemProgram.transfer({
  fromPubkey: walletPublicKey,
  toPubkey: new PublicKey(import.meta.env.VITE_TREASURY_WALLET),
  lamports: feeAmount,
})

// DANGEROUS — never do this
SystemProgram.transfer({
  fromPubkey: walletPublicKey,
  toPubkey: new PublicKey(apiResponse.destination),  // ← NEVER
  lamports: apiResponse.amount,                       // ← NEVER
})
```

---

### 2.3 CRITICAL — Jupiter API Response Validation

Engine 3 (Dust Consolidator) and Engine 5 (LP Fee Harvester) use Jupiter. The swap transaction from Jupiter is a **black box** — the app deserializes and signs a transaction it didn't build itself. This is the highest-risk operation in the codebase.

**Audit every Jupiter swap flow for these checks:**

```typescript
// REQUIRED checks before signing any Jupiter transaction

async function validateJupiterTransaction(
  txBase64: string,
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<VersionedTransaction> {

  // 1. Deserialize
  let tx: VersionedTransaction;
  try {
    const txBuffer = Buffer.from(txBase64, 'base64');
    tx = VersionedTransaction.deserialize(txBuffer);
  } catch {
    throw new Error('SECURITY: Could not deserialize Jupiter transaction');
  }

  // 2. Verify fee payer is user's wallet
  const feePayer = tx.message.staticAccountKeys[0];
  if (!feePayer.equals(walletPublicKey)) {
    throw new Error('SECURITY: Jupiter transaction fee payer is not the connected wallet');
  }

  // 3. Verify blockhash is recent (not stale)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  // The transaction's blockhash should be close to current
  // If it's too old the transaction will fail anyway, but verify it's set
  if (!tx.message.recentBlockhash) {
    throw new Error('SECURITY: Jupiter transaction has no blockhash');
  }

  // 4. Verify no unexpected SOL transfers to unknown addresses
  // Parse all SystemProgram.transfer instructions and verify destinations
  // This detects potential "address poisoning" in Jupiter responses
  for (const ix of tx.message.compiledInstructions) {
    const programKey = tx.message.staticAccountKeys[ix.programIdIndex];
    if (programKey.equals(SystemProgram.programId)) {
      // Verify this transfer's destination is the user's wallet or a known address
      // (Jupiter may create wSOL accounts etc — verify these are ATAs for the user)
    }
  }

  return tx;
}
```

**Additionally:** Verify that the quote price used at confirmation time matches the price at execution time within 1%. If Jupiter quotes 0.1 SOL output and the swap transaction would produce 0.05 SOL, abort.

---

### 2.4 HIGH — Input Validation Completeness

Audit every place user input or external API data touches a `PublicKey` constructor:

```typescript
// Every PublicKey instantiation must be wrapped in try/catch
// Create a shared utility and use it everywhere

// In src/lib/validation.ts (existing) — verify this pattern is used everywhere:
function safePublicKey(address: string, context: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw new AppError({
      code: 'INVALID_ADDRESS',
      message: 'Invalid wallet address detected.',
      technicalDetail: `Failed to parse PublicKey in context: ${context}, value: ${address}`,
    });
  }
}

// Audit: grep for "new PublicKey(" across the entire codebase
// Every instance that does NOT use safePublicKey() must be reviewed
// and either wrapped or replaced with safePublicKey()
```

Find every `new PublicKey(` call that passes a value from:
- User input
- URL parameters
- API responses (DAS, Jupiter, Sanctum, Meteora, Magic Eden)
- Merkle proof data

All of these must be validated. Only `new PublicKey(KNOWN_CONSTANT)` calls can skip validation.

---

### 2.5 HIGH — RPC Response Shape Validation

Every `getParsedTokenAccountsByOwner`, `getProgramAccounts`, `getParsedProgramAccounts`, and DAS API response must be defensively parsed.

**Create a validation layer for all RPC responses:**

```typescript
// Pattern to enforce across ALL scanner files

// DANGEROUS — crashes on unexpected RPC response shape
const delegate = account.account.data.parsed.info.delegate;

// REQUIRED — defensive parsing everywhere
function parseTokenAccountSafe(account: ParsedAccountInfo): ParsedTokenInfo | null {
  const data = account?.data;
  if (!data || typeof data !== 'object' || !('parsed' in data)) return null;

  const parsed = (data as any).parsed;
  if (!parsed?.info || typeof parsed.info !== 'object') return null;

  return {
    mint: typeof parsed.info.mint === 'string' ? parsed.info.mint : null,
    owner: typeof parsed.info.owner === 'string' ? parsed.info.owner : null,
    delegate: typeof parsed.info.delegate === 'string' ? parsed.info.delegate : null,
    tokenAmount: parsed.info.tokenAmount ?? null,
  };
}
```

Audit every scanner file. Replace every direct property access on RPC data with validated access.

---

### 2.6 HIGH — Fee Calculation Integrity

Audit every fee calculation across all 6 engines:

**Engine 1 (Revocation):** Flat 0.01 SOL — verify this is read from env var, not hardcoded
**Engine 2 (Rent Reclaim):** 15% of reclaimed SOL — verify calculation uses actual reclaimed amount, not estimate
**Engine 3 (Dust):** 12% of SOL received — verify calculated AFTER swaps complete, from actual received amounts
**Engine 4 (Staking):** 5% of claimed SOL — verify calculated from actual confirmed claim amounts
**Engine 5 (LP Harvest):** 8% or 10% of harvested value — verify calculated from actual harvested amounts
**Engine 6 (cNFT):** 0.005 SOL flat — verify the lamport constant is correct (0.005 * 1e9 = 5,000,000)

**For every percentage-based fee:**
```typescript
// Verify fee calculation uses integer arithmetic to avoid floating point errors
// DANGEROUS — floating point imprecision
const feeLamports = totalLamports * 0.15;  // Can produce 0.149999999... 

// CORRECT — integer arithmetic
const FEE_PERCENT = 15;
const FEE_DENOMINATOR = 100;
const feeLamports = Math.floor((totalLamports * FEE_PERCENT) / FEE_DENOMINATOR);

// Verify: feeLamports is always less than totalLamports
// Verify: feeLamports is never negative
// Verify: feeLamports is always a whole number (integer)
if (!Number.isInteger(feeLamports) || feeLamports < 0 || feeLamports >= totalLamports) {
  throw new Error('Fee calculation produced invalid result');
}
```

**Verify fee never exceeds recovered value:**
Add a guard in every fee calculation: if the calculated fee is >= the total recovery amount, set the fee to 0 and log a warning. Never charge more than the user receives.

---

### 2.7 HIGH — Treasury Wallet Address Integrity

The treasury wallet receives all service fees. If this address is wrong or manipulated, fees are lost or sent to an attacker.

**Audit:**
1. Verify `VITE_TREASURY_WALLET` is validated as a valid Solana public key at app startup
2. Verify the treasury wallet address is NEVER sourced from:
   - API responses
   - URL parameters
   - Local storage or session storage
   - User input
3. It must ONLY come from `import.meta.env.VITE_TREASURY_WALLET`
4. Add a startup validation function:

```typescript
// In src/config/constants.ts or App.tsx startup
function validateTreasuryWallet(): PublicKey {
  const address = import.meta.env.VITE_TREASURY_WALLET;
  if (!address) throw new Error('Treasury wallet not configured. App cannot start.');

  try {
    const pubkey = new PublicKey(address);
    // Verify it's not the system program or other known-bad addresses
    if (pubkey.equals(SystemProgram.programId)) {
      throw new Error('Treasury wallet cannot be system program');
    }
    return pubkey;
  } catch {
    throw new Error(`Invalid treasury wallet address: ${address}`);
  }
}

export const TREASURY_PUBKEY = validateTreasuryWallet();
```

---

### 2.8 HIGH — Stale Proof Detection (Engine 6)

Merkle proofs for cNFT burns become stale when the tree is updated. A stale proof causes transaction failure — this is not a fund loss risk but a bad UX failure that could leave the burn UI broken.

**Audit the proof fetch → transaction build → send flow:**
- Proofs must be fetched AFTER user confirms, not during scan
- Maximum acceptable time between proof fetch and transaction submission: 30 seconds
- If more than 30 seconds pass between proof fetch and `signTransaction()` call (e.g., user walked away from the confirm modal), re-fetch proofs before submitting
- Add a timestamp to each proof in the `BurnProof` type and check it before use

```typescript
interface BurnProof {
  // existing fields...
  fetchedAt: number;  // Date.now() when fetched
}

function isProofFresh(proof: BurnProof): boolean {
  return Date.now() - proof.fetchedAt < 30_000; // 30 seconds
}

// In burnBuilder — before using each proof:
if (!isProofFresh(proof)) {
  // Re-fetch this proof before continuing
}
```

---

### 2.9 MEDIUM — Content Security Policy Completeness

Audit `netlify.toml` headers:

The current CSP must be verified to include ALL external domains the app actually calls:

```
connect-src should include:
  - *.helius-rpc.com         (RPC + DAS)
  - api.mainnet-beta.solana.com  (fallback RPC)
  - *.firebaseio.com         (Firebase)
  - *.googleapis.com         (Firebase)
  - price.jup.ag             (Jupiter price API)
  - quote-api.jup.ag         (Jupiter quote + swap)
  - dlmm-api.meteora.ag      (Meteora)
  - api.raydium.io           (Raydium pool list)
  - api-mainnet.magiceden.dev (Magic Eden floor prices)
  - sanctum-extra-api.ngrok.dev (Sanctum tickets)
  - arweave.net              (NFT metadata)
  - nftstorage.link          (IPFS gateway)
  - ipfs.io                  (IPFS gateway)
  - cloudflare-ipfs.com      (IPFS gateway)

img-src should include:
  - * (for NFT images from arbitrary domains)
  - data: (for base64 fallback images)
```

Any domain the app fetches from that is NOT in the CSP will cause silent failures in production. Audit every `fetch()` call across the codebase and ensure its domain is in the CSP.

---

### 2.10 MEDIUM — Rate Limiting & DoS Prevention

**Client-side rate limiting must be verified for all engines:**

```typescript
// Verify these limits are enforced everywhere:

// Scan rate limiting — minimum gap between scans
const MIN_SCAN_INTERVAL_MS = 10_000; // 10 seconds

// API call batching — verify all batch calls have delays
const API_BATCH_DELAY_MS = 200; // between Jupiter price API batches
const PROOF_BATCH_DELAY_MS = 100; // between proof fetches

// Transaction rate limiting — don't spam RPC
const MIN_TX_INTERVAL_MS = 1000; // between transaction submissions

// Verify scan buttons are disabled during ongoing operations
// Verify no way to trigger multiple simultaneous scans
```

Audit every hook: can a user trigger the same operation twice simultaneously? Add loading state guards:
```typescript
// Every async operation must check this pattern
if (store.scanStatus === 'scanning') return; // Guard against double-trigger
```

---

### 2.11 MEDIUM — Error Information Leakage

Audit every `catch` block and error display in the codebase:

```typescript
// DANGEROUS — leaks internal details to UI
setError(err.message);  // Could expose RPC URLs, internal state, stack traces

// REQUIRED — map to user-friendly messages, log technical details separately
catch (err: any) {
  // Log technical detail (to Firebase, NOT to console in production)
  logError({
    code: 'SCAN_ERROR',
    technicalDetail: err.message,
    stack: err.stack,
  });

  // Show user-friendly message only
  setError(ERROR_MESSAGES.RPC_ERROR);
}
```

**Find every place where raw error messages could be shown to users. Fix all of them.**

Additionally: In production builds (`VITE_APP_ENV === 'production'`), verify `console.log`, `console.error`, and `console.warn` do not print wallet addresses, token balances, or transaction details. Add a production logger wrapper:

```typescript
// src/lib/logger.ts
const isDev = import.meta.env.VITE_APP_ENV === 'development';

export const logger = {
  log: (...args: any[]) => { if (isDev) console.log(...args); },
  error: (context: string, err: unknown) => {
    if (isDev) console.error(context, err);
    // In production: send to Firebase Analytics error logging
    logErrorToFirebase(context, err);
  },
  warn: (...args: any[]) => { if (isDev) console.warn(...args); },
};

// Replace ALL console.log/error/warn calls with logger.* calls
```

---

## PART 3 — LOGIC AUDIT

### 3.1 Engine 1 — Permission Revocation

**Audit checklist:**

- [ ] `createRevokeInstruction` is called with correct parameters: `(tokenAccount, owner, [], programId)` — verify `[]` (empty multisig signers) is always passed
- [ ] Token program ID (SPL vs Token-2022) correctly passed per account — mixing these causes silent transaction failure
- [ ] Batch size (15 per tx) respected — no transaction exceeds this
- [ ] After revocation, re-scanning the wallet shows 0 delegations (verify state is cleared and re-scan is triggered or prompted)
- [ ] If user disconnects wallet mid-revocation, state is cleaned up gracefully

**Logic bug to check:**
Does the scanner correctly handle the case where an account has BOTH a delegation AND zero balance? It should still flag it as a delegation (medium risk) but the risk level display must be accurate.

---

### 3.2 Engine 2 — Account Rent Reclaimer

**Audit checklist:**

- [ ] `createCloseAccountInstruction` destination is always `walletPublicKey` — verify no other address is ever used
- [ ] Balance verification: immediately before building close transactions, verify each account still has zero balance. If any account gained a balance since scan, remove it from the close list and warn user
- [ ] Fee calculation: verify fee is calculated from ACTUAL rent returned (which is the account's actual lamport balance), not from the estimated `TOKEN_ACCOUNT_RENT_LAMPORTS` constant
- [ ] The actual rent per account can vary slightly from the constant — use `connection.getAccountInfo(address).lamports` for the real value
- [ ] Accounts with active delegates: should they be closed? No — closing a delegated account requires the delegate's permission. Verify delegated accounts are excluded from Engine 2
- [ ] After closing, verify closed accounts no longer appear in subsequent scans

**Critical logic check:**
```typescript
// Before closing any account — verify balance is truly zero
async function verifyZeroBalance(
  accountAddress: string,
  connection: Connection
): Promise<boolean> {
  const accountInfo = await connection.getParsedAccountInfo(
    new PublicKey(accountAddress)
  );
  const balance = (accountInfo.value?.data as any)?.parsed?.info?.tokenAmount?.uiAmount ?? -1;
  return balance === 0;
}

// If this returns false — DO NOT CLOSE THE ACCOUNT
// Show user: "Account balance changed since scan. Skipping for safety."
```

---

### 3.3 Engine 3 — Dust Consolidator

**Audit checklist:**

- [ ] **Dust threshold check at execution time:** Before executing each swap, verify the token's current balance matches what was shown at confirmation time within 10%. If user received more tokens since the scan, they may not want to swap them as "dust"
- [ ] **Minimum output guard:** Verify `MIN_SWAP_OUTPUT_LAMPORTS` check happens on the actual Jupiter quote response, not on a cached quote
- [ ] **Slippage protection:** `slippageBps: 100` (1%) is always passed to Jupiter — verify no code path passes a higher slippage
- [ ] **Token account cleanup:** After swapping a token to SOL, does the original token account get closed? It should — otherwise the empty account still holds locked rent. Ensure the Engine 3 → Engine 2 flow works together
- [ ] **Burn path for unswappable tokens:** For tokens marked `isSwappable: false`, verify the burn+close flow (from the burn & reclaim addition) correctly calls `createBurnInstruction` then `createCloseAccountInstruction` in the right order in the same transaction
- [ ] **Jupiter VersionedTransaction handling:** Verify `signTransaction` is called, NOT `sendTransaction` directly for Jupiter swap transactions. VersionedTransaction requires explicit sign then send

**Logic bug to check:** What happens when a swap partially succeeds? User gets some SOL from some tokens but not others. Is the fee calculated on total received SOL (correct) or total attempted SOL (incorrect)?

---

### 3.4 Engine 4 — Staking Ticket Finder

**Audit checklist:**

- [ ] **Epoch verification at claim time:** Current epoch is re-fetched immediately before building claim transactions — not reused from scan time. Epochs advance roughly every 2.25 days
- [ ] **Ticket ownership verification:** For Marinade tickets, verify `beneficiary` field matches connected wallet before claiming
- [ ] **Native stake withdrawer check:** Verify `authorized.withdrawer` OR `authorized.staker` matches wallet — not just one of them. Some accounts use different staker and withdrawer
- [ ] **MAX_U64 comparison:** The comparison `deactivationEpoch === MAX_U64` must use string comparison, not number comparison — JavaScript cannot represent u64 max accurately as a number
  ```typescript
  // WRONG — JavaScript number precision loss
  if (deactivationEpoch === 18446744073709551615) { }
  
  // CORRECT — string comparison
  if (deactivationEpoch.toString() === MAX_U64) { }
  ```
- [ ] **Sanctum API trust:** Data from Sanctum API must be verified on-chain before claiming — verify the ticket account exists and beneficiary matches
- [ ] **Fee on actual claimed amount:** If 3 tickets are selected and 1 fails, fee is 5% of 2 successful claims only

---

### 3.5 Engine 5 — LP Fee Harvester

**Audit checklist:**

- [ ] **Token account existence before harvest:** Orca's `collectFees` requires token accounts for both tokens to exist in user's wallet. Verify this check happens before building the harvest transaction, and `createAssociatedTokenAccountInstruction` is prepended if needed
- [ ] **Out-of-range compound guard:** Compound flow must check `position.status === 'in_range'` before attempting to add liquidity. Verify this check exists in the compound logic
- [ ] **SDK version pinning:** Verify `package.json` uses exact versions (no `^`) for all three DEX SDKs
- [ ] **Raydium AMM positions:** Standard AMM positions cannot harvest fees independently. Verify the UI correctly marks these as "view only" for harvest and does not build invalid transactions for them
- [ ] **Fee based on USD value to SOL conversion:** The LP harvest fee is calculated as a % of USD value then converted to SOL. Verify the SOL price used for this conversion is fetched fresh (within 60 seconds) — not a stale cached price
- [ ] **Compound swap ratio:** Before compounding, the harvested tokens must be swapped to the correct ratio for the pool. Verify the ratio calculation uses current pool price, not scan-time price
- [ ] **Partial compound failure:** If compound fails for one position but succeeds for others, all harvested fees must already be in the user's wallet. The compound failure must not affect already-harvested funds

---

### 3.6 Engine 6 — cNFT Spam Cleaner

**Audit checklist:**

- [ ] **Verified collection double-check:** The burn builder must independently verify `isVerifiedCollection` from the DAS API data for each asset before building the burn instruction — not just trust the `isBurnable` flag set during scoring
- [ ] **Proof account ordering:** Merkle proof accounts must be appended in the exact order returned by `getAssetProof` — verify no sorting or reordering happens
- [ ] **Transaction size validation:** After building each burn transaction, verify serialized size is under 1232 bytes. Implement the size check from the spec
- [ ] **Proof staleness:** Verify `fetchedAt` timestamp check exists and re-fetches proofs older than 30 seconds
- [ ] **Session fee in first transaction:** Verify the 0.005 SOL session fee is added to the FIRST transaction only — not to every transaction and not to none
- [ ] **Image loading isolation:** A failed image load for one cNFT must not affect the display of others. Verify each `CNFTImageThumbnail` has isolated error handling
- [ ] **Virtual scrolling correctness:** With hundreds of items, verify the virtual scroll implementation correctly measures row heights and doesn't cause items to disappear or overlap

---

## PART 4 — TYPE SAFETY AUDIT

### 4.1 Eliminate All `any` Types

The output from `grep -rn ": any" src/` and `grep -rn "as any"` must show zero results after the audit.

For every `any` type found:

```typescript
// WRONG
function parseAccount(data: any): any {
  return data.parsed.info.delegate;
}

// CORRECT — define the shape
interface RawTokenAccountData {
  parsed: {
    info: {
      delegate?: string;
      mint: string;
      owner: string;
      tokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number | null;
      };
    };
    type: string;
  };
  program: string;
  space: number;
}

function parseAccount(data: RawTokenAccountData): string | null {
  return data.parsed.info.delegate ?? null;
}
```

Common sources of `any` in Solana apps:
- RPC response parsing
- SDK return types that aren't fully typed
- Event handler parameters
- Dynamic JSON parsing

For SDK types that genuinely lack TypeScript definitions: create local type declarations in `src/types/sdk-overrides.d.ts`.

### 4.2 Strict Null Checks

Verify `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

With `noUncheckedIndexedAccess: true`, array access `arr[0]` returns `T | undefined` — this will surface many potential bugs across the codebase. Fix every resulting TypeScript error.

### 4.3 Discriminated Unions for State

Verify all status types use proper discriminated unions with exhaustive checking:

```typescript
// Current pattern (acceptable)
type ScanStatus = 'idle' | 'scanning' | 'scan_complete' | 'error';

// Improved pattern — prevents impossible state combinations
type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; startedAt: number }
  | { status: 'scan_complete'; result: ScanResult; completedAt: number }
  | { status: 'error'; error: AppError; occurredAt: number };

// Exhaustive switch — TypeScript will error if a case is missing
function renderScanState(state: ScanState): React.ReactNode {
  switch (state.status) {
    case 'idle': return <IdleView />;
    case 'scanning': return <ScanningView startedAt={state.startedAt} />;
    case 'scan_complete': return <ResultsView result={state.result} />;
    case 'error': return <ErrorView error={state.error} />;
    // No default needed — TypeScript ensures all cases covered
  }
}
```

Implement this pattern across all 6 engine stores where the current pattern allows impossible states (e.g., `result` being non-null while `status` is `'idle'`).

---

## PART 5 — ERROR HANDLING AUDIT

### 5.1 Unhandled Promise Rejections

Every `async` function called from React components must be wrapped to prevent unhandled rejections from crashing the app silently.

**Audit every `useCallback` and `useEffect` that calls async functions:**

```typescript
// DANGEROUS — unhandled rejection if runScan throws
const handleClick = useCallback(() => {
  runScan();  // Missing await + no catch
}, [runScan]);

// CORRECT
const handleClick = useCallback(async () => {
  try {
    await runScan();
  } catch (err) {
    // Error already handled in runScan — this is belt-and-suspenders
    logger.error('Unexpected error in scan handler', err);
  }
}, [runScan]);
```

### 5.2 ErrorBoundary Coverage

Verify that `ErrorBoundary` wraps each engine module independently, not just the whole app. If Engine 5 throws an unhandled React error, it should not unmount Engines 1–4.

```tsx
// In ScanPage.tsx — each engine wrapped independently
<ErrorBoundary fallback={<EngineErrorFallback engine="LP Harvester" />}>
  <LPHarvesterCard />
</ErrorBoundary>

<ErrorBoundary fallback={<EngineErrorFallback engine="cNFT Cleaner" />}>
  <CNFTCleanerCard />
</ErrorBoundary>
```

### 5.3 Network Failure Scenarios

For each engine, verify behavior when:
1. **RPC is down** mid-scan: User sees clear error, scan state is reset, retry is possible
2. **RPC is slow** (>10 seconds): Timeout fires, user sees "Network is slow" message
3. **Wallet disconnects** mid-transaction: App detects disconnection, cleans up state, no stuck loading states
4. **User rejects** wallet signature: `TX_REJECTED` error code shown, no retry auto-fires
5. **Transaction confirmed** but app lost connection before receiving confirmation: State is consistent — either the tx went through or it didn't. No double-submission.

```typescript
// Add timeout to all RPC calls
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorCode: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new AppError({ code: errorCode, message: ERROR_MESSAGES[errorCode] })), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

// Usage:
const accounts = await withTimeout(
  connection.getParsedTokenAccountsByOwner(pubkey, filter),
  15_000,
  'RPC_TIMEOUT'
);
```

### 5.4 Transaction Confirmation Robustness

The current pattern of `confirmTransaction` can fail silently if the connection drops during confirmation. Implement robust confirmation:

```typescript
async function confirmTransactionRobust(
  connection: Connection,
  signature: string,
  commitment: Commitment = 'confirmed'
): Promise<boolean> {

  const start = Date.now();
  const TIMEOUT_MS = 60_000; // 60 second max wait

  while (Date.now() - start < TIMEOUT_MS) {
    try {
      const result = await connection.getSignatureStatus(signature);
      const status = result.value;

      if (status === null) {
        // Transaction not found yet — wait and retry
        await sleep(2000);
        continue;
      }

      if (status.err) {
        // Transaction found but failed on-chain
        throw new AppError({
          code: 'TX_FAILED',
          message: ERROR_MESSAGES.TX_FAILED,
          technicalDetail: JSON.stringify(status.err),
        });
      }

      if (status.confirmationStatus === commitment ||
          status.confirmationStatus === 'finalized') {
        return true;
      }

      await sleep(2000);
    } catch (err) {
      if (err instanceof AppError) throw err;
      await sleep(2000);
    }
  }

  // Timeout — transaction may have gone through
  throw new AppError({
    code: 'TX_TIMEOUT',
    message: ERROR_MESSAGES.TX_TIMEOUT,
    technicalDetail: `Signature: ${signature}`,
  });
}
```

Replace all `connection.confirmTransaction()` calls with `confirmTransactionRobust()`.

---

## PART 6 — PERFORMANCE AUDIT

### 6.1 Bundle Size Analysis

After `npm run build`, verify:

```
Target bundle sizes (gzipped):
  main chunk:          < 200KB
  solana chunk:        < 400KB
  wallet-adapter:      < 150KB
  firebase:            < 100KB
  lp-orca:             < 300KB
  lp-raydium:          < 400KB
  lp-meteora:          < 200KB
  cnft-bubblegum:      < 150KB
  Total initial load:  < 500KB gzipped
```

If any chunk exceeds these limits, investigate:
1. Is the entire library imported or just what's needed?
   ```typescript
   // WRONG — imports entire library
   import _ from 'lodash';
   
   // CORRECT — tree-shakeable named imports
   import { chunk } from 'lodash-es';
   ```
2. Are DEX SDKs loaded eagerly or lazily?
   ```typescript
   // Lazy load LP engine — only loads when user opens that card
   const LPHarvesterCard = lazy(() => import('@/modules/lp-harvester'));
   ```
3. Are images and protocol logos properly optimized?

### 6.2 React Rendering Performance

**Audit for unnecessary re-renders:**

```typescript
// Every component that renders lists must use React.memo
export const PositionRow = React.memo(function PositionRow({ position }: Props) {
  // ...
});

// Every callback passed to child components must use useCallback
const handleToggle = useCallback((id: string) => {
  store.togglePosition(id);
}, [store.togglePosition]);

// Every computed value must use useMemo
const selectedTotal = useMemo(() =>
  selectedPositions.reduce((sum, p) => sum + p.totalFeeValueUSD, 0),
  [selectedPositions]
);
```

**Check for these common React performance killers:**
- Object literals in JSX props: `<Component style={{ color: 'red' }}` — creates new object every render
- Inline arrow functions in props: `<Button onClick={() => doThing(id)}` — creates new function every render
- Missing dependency arrays in useEffect/useCallback/useMemo
- Large state objects in Zustand causing wholesale re-renders when one field changes

### 6.3 RPC Call Optimization

**Audit for redundant RPC calls:**

Engine 1 and Engine 2 both call `getParsedTokenAccountsByOwner` for the same wallet. These should share a single RPC call and pass the results to both engines.

```typescript
// In useWalletScanner.ts — single scan, data shared to all engines
const tokenAccounts = await getParsedTokenAccountsByOwner(wallet, TOKEN_PROGRAM_ID);
const token2022Accounts = await getParsedTokenAccountsByOwner(wallet, TOKEN_2022_PROGRAM_ID);

// Pass to Engine 1 scanner (filters for delegations)
const delegations = extractDelegations(tokenAccounts, token2022Accounts);

// Pass to Engine 2 scanner (filters for empty accounts)
const emptyAccounts = extractEmptyAccounts(tokenAccounts, token2022Accounts);

// No duplicate RPC calls
```

**Verify connection reuse:** One `Connection` instance should be created at app startup and shared across all engines via React context. Verify no engine creates its own `Connection` instance.

### 6.4 Image Loading Performance (Engine 6)

**Audit cNFT image loading:**

- Images must use `loading="lazy"` attribute
- Images must have explicit `width` and `height` to prevent layout shift
- IPFS gateway requests should have a 5-second timeout — don't wait indefinitely for slow gateways
- Failed images must show placeholder immediately, not blank space
- Maximum concurrent image requests: 10 (use a request queue if more than 10 thumbnails are visible)

### 6.5 Zustand Selector Optimization

Every Zustand `useStore()` call must use a selector to prevent re-renders on unrelated state changes:

```typescript
// WRONG — component re-renders on ANY store change
const store = useAppStore();

// CORRECT — component only re-renders when scanStatus changes
const scanStatus = useAppStore(state => state.scanStatus);
const scanResult = useAppStore(state => state.scanResult);

// For multiple values — use shallow comparison
import { useShallow } from 'zustand/react/shallow';
const { scanStatus, scanResult } = useAppStore(
  useShallow(state => ({ scanStatus: state.scanStatus, scanResult: state.scanResult }))
);
```

Audit every `useAppStore()` and `useLPStore()` and `useCNFTStore()` call across the codebase.

---

## PART 7 — UX SAFETY AUDIT

### 7.1 Confirmation Flow Completeness

Every destructive or irreversible action must have a confirmation modal. Audit all 6 engines:

| Engine | Action | Reversible? | Has Confirm Modal? | Modal shows full cost? |
|--------|--------|-------------|-------------------|----------------------|
| 1 | Revoke permissions | ✅ Yes | Must verify | Must verify |
| 2 | Close token accounts | ❌ No | Must verify | Must verify |
| 3 | Swap tokens to SOL | ❌ No | Must verify | Must verify |
| 3 | Burn + close tokens | ❌ No | Must verify | Must verify |
| 4 | Claim staking tickets | ✅ Yes | Must verify | Must verify |
| 5 | Harvest LP fees | ✅ Yes | Must verify | Must verify |
| 6 | Burn cNFTs | ❌ No | Must verify | Must verify |

For every irreversible action, verify the confirmation modal:
- Uses the word "permanent" or "cannot be undone"
- Shows exact SOL cost (not just "small fee")
- Has Cancel as the leftmost / most prominent button
- Does not auto-close or auto-proceed

### 7.2 Loading State Completeness

Every async operation must have a loading state. Audit that no button can be clicked twice:

```typescript
// Every action button must be disabled during its operation
<Button
  onClick={executeHarvest}
  disabled={harvestStatus !== 'idle' && harvestStatus !== 'error'}
>
  {harvestStatus === 'harvesting' ? 'Harvesting...' : 'Harvest Fees'}
</Button>
```

Additionally: if a scan is in progress, all action buttons for all engines should be disabled.

### 7.3 Wallet Disconnection Handling

**Simulate wallet disconnection in these scenarios:**
1. During scan (between RPC calls)
2. After seeing results (before clicking action)
3. During confirm modal display
4. After clicking action, before signing
5. After signing, during confirmation wait

For each scenario: verify the app recovers gracefully, shows appropriate message, and does not enter an unrecoverable stuck state.

### 7.4 Mobile Responsiveness

Verify on viewport widths: 320px, 375px, 390px, 414px (common iPhone sizes), 768px (tablet).

Critical checks:
- Wallet connect button accessible on small screens
- Confirmation modals do not overflow on small screens
- cNFT item rows are readable on 375px width
- Long wallet addresses (base58) truncate correctly on all sizes
- Action buttons are minimum 44px touch target

### 7.5 Solscan Links

Every transaction signature shown in the UI must link to `https://solscan.io/tx/{signature}`. Verify all success states include this link and that the signature is correctly formatted (base58, not hex).

---

## PART 8 — DEPENDENCY AUDIT

### 8.1 npm Audit

```bash
npm audit
```

Fix all CRITICAL and HIGH severity vulnerabilities. For MODERATE: assess and fix if related to the Solana or cryptographic functionality.

### 8.2 Dependency Freshness

For these critical packages, verify you are on the latest stable version:
```
@solana/web3.js           — latest stable (NOT v2 beta)
@solana/spl-token         — latest stable
@solana/wallet-adapter-*  — all on same version
@orca-so/whirlpools-sdk   — check for breaking changes in changelog
@raydium-io/raydium-sdk-v2 — check changelog
@meteora-ag/dlmm          — check changelog
@metaplex-foundation/mpl-bubblegum — check changelog
firebase                  — latest v10.x
```

### 8.3 Unused Dependencies

```bash
npx depcheck
```

Remove any packages listed as unused. Unused dependencies increase bundle size and attack surface.

### 8.4 License Compliance

Verify all dependencies use permissive licenses (MIT, Apache 2.0, BSD). Flag any GPL-licensed dependencies — these can affect the ability to keep the code proprietary.

```bash
npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;CC0-1.0;Unlicense'
```

---

## PART 9 — DEPLOYMENT SECURITY AUDIT

### 9.1 Netlify Configuration

Verify `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  # Do NOT set any sensitive env vars here — use Netlify dashboard

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    # Prevent clickjacking
    X-Frame-Options = "DENY"
    # Prevent MIME sniffing
    X-Content-Type-Options = "nosniff"
    # XSS protection
    X-XSS-Protection = "1; mode=block"
    # Referrer policy
    Referrer-Policy = "strict-origin-when-cross-origin"
    # Permissions policy — disable unused browser features
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=()"
    # HSTS — enforce HTTPS
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
```

### 9.2 Environment Variable Audit (Netlify Dashboard)

Verify in Netlify dashboard that:
- All `VITE_*` variables are set
- No variable named `PRIVATE_KEY` or `SECRET` exists
- `VITE_APP_ENV` is set to `production`
- `VITE_TREASURY_WALLET` is set to the correct address
- Variables are scoped to Production only (not Preview/Dev) where appropriate

### 9.3 Source Map Policy

Verify that `vite.config.ts` does NOT generate source maps for production:
```typescript
export default defineConfig({
  build: {
    sourcemap: false,  // Do not expose source code in production
  }
});
```

Source maps in production expose your original source code to anyone who inspects the network tab.

---

## PART 10 — FINAL AUDIT CHECKLIST

The audit is complete when EVERY item below is checked:

### Security
- [ ] Zero instances of private key handling in frontend code
- [ ] All transactions verified against program ID whitelist before signing
- [ ] All `SystemProgram.transfer` destinations verified as treasury wallet only
- [ ] All Jupiter transaction responses validated before signing
- [ ] All public key instantiations use `safePublicKey()` wrapper
- [ ] All RPC responses defensively parsed (no direct property access on raw data)
- [ ] All fee calculations use integer arithmetic
- [ ] Treasury wallet validated at app startup
- [ ] Verified collection items cannot be burned (double-checked in burn builder)
- [ ] Stale Merkle proof detection implemented
- [ ] CSP headers cover all external domains
- [ ] No sensitive data logged to console in production
- [ ] Error messages never expose internal technical details to users
- [ ] Rate limiting prevents double-scan and double-action

### Code Quality
- [ ] Zero TypeScript errors with strict mode enabled
- [ ] Zero `any` types in codebase
- [ ] All async operations have proper try/catch
- [ ] All promise chains have error handling
- [ ] `ErrorBoundary` wraps each engine independently
- [ ] `withTimeout()` wraps all RPC calls
- [ ] `confirmTransactionRobust()` used for all transaction confirmations
- [ ] Production logger replaces all console.log/error/warn calls

### Performance
- [ ] Initial bundle under 500KB gzipped
- [ ] All list components use `React.memo`
- [ ] All callbacks use `useCallback`
- [ ] All computed values use `useMemo`
- [ ] All Zustand selectors use specific selectors (not whole store)
- [ ] Token account data shared between Engine 1 and Engine 2 (single RPC call)
- [ ] Single `Connection` instance shared across all engines
- [ ] Virtual scrolling implemented for cNFT list
- [ ] DEX SDK chunks are lazily loaded

### UX Safety
- [ ] Every irreversible action has a confirmation modal with "permanent" language
- [ ] Cancel button is always leftmost / most prominent in modals
- [ ] No button can be clicked twice during async operation
- [ ] Wallet disconnection handled gracefully in all 6 engines
- [ ] All transaction signatures link to solscan.io
- [ ] App is usable on 375px viewport width

### Deployment
- [ ] npm audit shows zero critical/high vulnerabilities
- [ ] Source maps disabled in production build
- [ ] All security headers set in netlify.toml
- [ ] VITE_APP_ENV=production in Netlify dashboard
- [ ] Treasury wallet address verified in Netlify dashboard

---

## PART 11 — AUDIT DELIVERABLES

When the audit is complete, produce these three outputs:

### Deliverable 1: AUDIT_LOG.md
Complete log of every issue found, severity, and fix applied. Sorted by severity (CRITICAL first).

### Deliverable 2: AUDIT_SUMMARY.md
Executive summary including:
- Total issues found by severity
- Most critical fixes made
- Known limitations or risks that remain
- Confidence rating (0–100%) that the app is safe for production use with real wallets
- Recommendations for future security improvements (ongoing monitoring, bug bounty program, third-party audit)

### Deliverable 3: Updated codebase
All fixes applied. All TypeScript errors resolved. All tests passing. `npm run build` succeeds cleanly.

---

## APPENDIX — KNOWN SOLANA-SPECIFIC RISKS

Reference for auditor. These are common failure modes in Solana apps:

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Blockhash expiration** | Transaction blockhash valid for ~150 slots (~60s). If confirmation takes too long, tx is dropped silently | Use `confirmTransactionRobust()` with `getSignatureStatus()` polling |
| **Priority fee starvation** | Busy Solana periods cause transactions to be dropped if priority fee is too low | Add `ComputeBudgetProgram.setComputeUnitPrice()` instruction to all transactions |
| **ATA not initialized** | Harvest transactions fail if token account doesn't exist for the received token | Check and create ATAs before harvest instructions |
| **Proof staleness (cNFT)** | Merkle tree updated between proof fetch and burn | Re-fetch proofs within 30s of signing |
| **Program upgrades** | DEX programs can be upgraded, changing instruction layouts | Pin SDK versions, monitor DEX upgrade announcements |
| **RPC inconsistency** | Different RPC nodes can return different data during high load | Use `confirmed` commitment or higher for all reads |
| **Slot skipping** | Solana can skip slots during congestion | Don't use slot numbers for timing — use wall clock time |
| **Token-2022 incompatibility** | SPL Token and Token-2022 require different program IDs | Always pass correct `programId` to spl-token instructions |

---

*End of SolHunt Codebase Audit Specification*
*Version 1.0 — Finance-Grade Security Standard*
*Perform this audit before any public launch or partnership integration*
