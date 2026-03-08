# 🔐 SolHunt Codebase Audit Log

> Audit performed against: `SOLHUNT-COMPLETE-AUDIT-SPEC.md`
> Date: 2026-03-05

---

## Issue #1
- **File:** `src/config/firebase.ts`
- **Line:** 49
- **Severity:** MEDIUM
- **Category:** Error Handling
- **Description:** `console.warn` used directly — leaks internal details in production builds.
- **Risk:** Firebase init errors could expose internal infrastructure info to browser console.
- **Fix Applied:** Replaced with silenced comment. Firebase init errors are caught and safely ignored.
- **Status:** FIXED

## Issue #2
- **File:** `src/components/common/ErrorBoundary.tsx`
- **Line:** 24
- **Severity:** MEDIUM
- **Category:** Security / Error Handling
- **Description:** `console.error` used directly to log caught errors. No fallback prop for per-engine error isolation.
- **Risk:** Error details leak to production console. A crash in one engine could unmount the entire app.
- **Fix Applied:** Replaced with `logger.error()`. Added `fallback` prop for per-engine ErrorBoundary wrapping.
- **Status:** FIXED

## Issue #3
- **File:** `src/lib/ticketScanner.ts`
- **Lines:** 287, 298
- **Severity:** LOW
- **Category:** Error Handling
- **Description:** Two `console.warn` calls for Sanctum API parsing — leak info in production.
- **Risk:** Minor info leakage about Sanctum API integration details.
- **Fix Applied:** Replaced with `logger.warn()`.
- **Status:** FIXED

## Issue #4
- **File:** `src/lib/reclaimRent.ts`
- **Lines:** 64, 102
- **Severity:** HIGH
- **Category:** Logic / Security
- **Description:** Fee calculated using floating-point: `totalLamports * (30 / 100)`. Floating-point can produce non-integer lamport values.
- **Risk:** Non-integer lamports passed to `SystemProgram.transfer` could cause unexpected behavior.
- **Fix Applied:** Changed to `Math.floor((totalLamports * 30) / 100)` — integer division.
- **Status:** FIXED

## Issue #5
- **File:** `src/lib/dustBurnReclaim.ts`
- **Line:** 48
- **Severity:** HIGH
- **Category:** Logic / Security
- **Description:** Same floating-point fee calculation: `totalReclaimLamports * (15 / 100)`.
- **Risk:** Non-integer lamport value in SystemProgram.transfer.
- **Fix Applied:** Changed to `Math.floor((totalReclaimLamports * 15) / 100)`.
- **Status:** FIXED

## Issue #6
- **File:** `src/hooks/useDustBurnReclaim.ts`
- **Line:** 289
- **Severity:** HIGH
- **Category:** Logic / Security
- **Description:** Fee calculation uses `Math.floor(lamports * (15/100))` — the inner calculation still uses floating-point.
- **Risk:** Floating-point imprecision before Math.floor could round to wrong value.
- **Fix Applied:** Changed to `Math.floor((lamports * 15) / 100)`.
- **Status:** FIXED

## Issue #7
- **File:** `src/lib/dustSwapper.ts`
- **Line:** 177
- **Severity:** HIGH
- **Category:** Logic / Security
- **Description:** Dust swap fee uses `Math.floor(lamports * (15/100))` pattern.
- **Risk:** Same floating-point imprecision risk.
- **Fix Applied:** Changed to `Math.floor((lamports * 15) / 100)`.
- **Status:** FIXED

## Issue #8
- **File:** `src/modules/lp-harvester/lib/feeCalculator.ts`
- **Line:** 72
- **Severity:** MEDIUM
- **Category:** Logic
- **Description:** `toPubkey: new PublicKey(TREASURY_WALLET)` — `TREASURY_WALLET` is already a `PublicKey`, so this double-wraps it unnecessarily.
- **Risk:** No runtime failure but shows conceptual confusion about the constant's type.
- **Fix Applied:** Changed to `toPubkey: TREASURY_WALLET`.
- **Status:** FIXED

## Issue #9
- **File:** `netlify.toml`
- **Line:** 18
- **Severity:** HIGH
- **Category:** Security
- **Description:** CSP `connect-src` missing many domains the app actually calls: Meteora DLMM API, MagicEden floor price API, Sanctum API, Jupiter price/quote APIs, IPFS gateways (arweave.net, nftstorage.link, ipfs.io, cloudflare-ipfs.com). `img-src` too restrictive for NFT images. Missing `Permissions-Policy`, `Strict-Transport-Security`, HTML `Cache-Control`.
- **Risk:** Silent fetch failures in production for Engine 5 (Meteora), Engine 6 (MagicEden, IPFS), Engine 4 (Sanctum). Users would see unexplained scan failures.
- **Fix Applied:** Added all missing domains to `connect-src`. Set `img-src * data:`. Added `Permissions-Policy`, `Strict-Transport-Security`, HTML no-cache headers.
- **Status:** FIXED

## Issue #10
- **File:** `vite.config.ts`
- **Line:** 17
- **Severity:** MEDIUM
- **Category:** Security
- **Description:** No `sourcemap: false` setting — production builds would generate source maps exposing original source code.
- **Risk:** Anyone inspecting the deployed site could see all source code.
- **Fix Applied:** Added `sourcemap: false` to `build` config.
- **Status:** FIXED

## Issue #11
- **File:** `tsconfig.json`
- **Line:** 21
- **Severity:** LOW
- **Category:** Type Safety
- **Description:** Missing `noImplicitReturns: true` — functions with non-void return types could silently return `undefined`.
- **Risk:** Potential runtime undefined values from functions with missing return paths.
- **Fix Applied:** Added `"noImplicitReturns": true` to compilerOptions.
- **Status:** FIXED

## Issue #12
- **File:** (new) `src/lib/logger.ts`
- **Severity:** INFO
- **Category:** Security
- **Description:** No production-safe logger existed. All console calls could leak wallet addresses, balances, and transaction details.
- **Risk:** Data leakage through browser console in production.
- **Fix Applied:** Created `logger.ts` — silences output in production, logs normally in development.
- **Status:** FIXED

## Issue #13
- **File:** (new) `src/lib/transactionVerifier.ts`
- **Severity:** INFO
- **Category:** Security
- **Description:** No program ID whitelist verification existed for transactions before signing.
- **Risk:** A compromised API could inject instructions for unexpected programs.
- **Fix Applied:** Created `transactionVerifier.ts` with `verifyTransactionSecurity()` — checks all instructions against allowed program IDs, verifies fee payer, enforces 25-instruction limit.
- **Status:** FIXED

## Issue #14
- **File:** (new) `src/lib/envValidator.ts`
- **Severity:** INFO
- **Category:** Security
- **Description:** No startup validation for required environment variables (`VITE_HELIUS_RPC_URL`, `VITE_TREASURY_WALLET`). Missing/invalid values would cause silent failures.
- **Risk:** Treasury wallet misconfiguration could send fees to wrong address. Missing RPC URL breaks entire app silently.
- **Fix Applied:** Created `envValidator.ts` with `validateEnvironment()` — validates presence and format of all required env vars, verifies treasury wallet is valid PublicKey and not system program.
- **Status:** FIXED

## Issue #15
- **File:** (new) `src/lib/withTimeout.ts`
- **Severity:** INFO
- **Category:** Error Handling
- **Description:** No timeout wrapper for RPC calls. No robust transaction confirmation via HTTP polling.
- **Risk:** App could hang indefinitely if RPC is unresponsive. `connection.confirmTransaction()` uses WebSocket which can silently fail.
- **Fix Applied:** Created `withTimeout()` utility and `confirmTransactionRobust()` with polling-based confirmation.
- **Status:** FIXED

## Issue #16
- **File:** `src/modules/cnft-cleaner/types.ts`, `src/modules/cnft-cleaner/lib/proofFetcher.ts`
- **Lines:** 70–78, 72–80
- **Severity:** MEDIUM
- **Category:** Logic / Security
- **Description:** `BurnProof` type had no `fetchedAt` timestamp for stale proof detection. Merkle proofs become stale when the tree is updated.
- **Risk:** Burns could fail with confusing errors if proofs are stale (tree updated between fetch and burn).
- **Fix Applied:** Added `fetchedAt: number` to `BurnProof` interface. `proofFetcher.ts` now stamps `Date.now()` on each proof.
- **Status:** FIXED
