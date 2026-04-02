# SolHunt Recovery — codebase Audit & Agent Guide

## 🚨 Solana dApp Store Compliance (CRITICAL PRIORITY)

**Status**: On Hold — Addressing non-compliance issues

**Non-Compliance Detail Received**:
> "Wallet connect and disconnect must work reliably"

**Links**:
- [Solana dApp Store Developer Agreement](https://dappstore.solanamobile.com/developer-agreement)
- [Solana dApp Store Policies](https://dappstore.solanamobile.com/policies)

### Compliance Checklist

| Requirement | Status | File/Area |
|-------------|--------|-----------|
| ✅ Wallet connect/disconnect reliability | **FIXED** | `src/components/wallet/WalletStatusManager.tsx` |
| ✅ Transaction error handling + RPC retry logic | **FIXED** | `src/lib/rpcRetry.ts` + applied to all tx builders |
| ✅ Mobile wallet deep links + TWA config | **FIXED** | `app/src/main/AndroidManifest.xml` — added `solana:` and `phantom:` intent filters |
| ✅ Fee disclosure verification + user consent flows | **COMPLETE** ✅ | `RevokeConfirmModal`, `ReclaimConfirmModal`, `DustConfirmModal`, `DustBurnConfirmModal`, `ClaimConfirmModal`, `MEVClaimConfirmModal` |
| ✅ RPC retry hardening — scanner RPC calls | **IN PROGRESS** | decommission, buffer-recovery scanners wrapped |

### Hourly Work Schedule

The agent will work **every hour** to achieve full compliance:
1. **Hour 1**: ✅ Wallet reliability (COMPLETE)
2. **Hour 2**: ✅ Transaction error handling + RPC retry logic (COMPLETE)
3. **Hour 3**: ✅ Mobile wallet deep links + TWA config (COMPLETE)
4. **Hour 4**: ✅ Fee disclosure + RPC retry hardening (COMPLETE) — decommission scanner now uses withRetry
5. **Hour 5**: ✅ RPC retry audit — buffer-recovery scanner wrapped; remaining: lp-harvester, ticketScanner

---

## Architecture Overview

**9 Recovery Engines**: Revoke, Reclaim Rent, Dust Consolidator, Staking Ticket Finder, LP Fee Harvester, Buffer Account Recovery, Decommission Scanner, cNFT Cleaner, MEV/Priority Fee Claims.

**Stack**: React 19 + Vite + TypeScript 5.9 (strict mode) + `@solana/web3.js` + Tailwind CSS + Zustand state management.

**Key Directories**: `src/lib/` (core logic), `src/modules/` (engine-specific), `src/hooks/` (React hooks), `src/components/` (UI), `src/pages/` (routes).

---

## Priority Improvement Areas

### 1. Security (HIGHEST)
- Add input sanitization to all wallet address inputs
- Add rate limiting to prevent RPC spam
- Add transaction size limits (128 accounts max per Solana tx)
- Add slippage protection for swap routes
- Add signature verification before broadcasting

### 2. Type Safety (HIGH)
- Replace `: any` in:
  - `useDecommissionScanner.ts` lines 11, 46, 143, 177
  - `sw.ts` line 78
- Add strict typing for API responses (DexScreener, Jito, Jupiter)
- Add branded types for `PublicKey` vs `string` address

### 3. Error Handling (HIGH)
- Add exponential backoff for RPC retries
- Add circuit breaker pattern for failing external APIs
- Add user-friendly error recovery suggestions
- Standardize error codes across all engines

### 4. Performance (MEDIUM)
- Memoize heavy components (scanner results, tables)
- Debounce input validation in forms
- Use React.memo for list items (PositionRow, TicketRow)
- Virtualize long lists with `@tanstack/react-virtual`

### 5. Code Quality (MEDIUM)
- Extract duplicated RPC connection logic
- Add missing JSDoc to `lib/` functions
- Fix unused imports and variables (TypeScript strict catches these)
- Standardize naming: `handleX` vs `onX` vs `doX`

---

## File Index by Category

### Critical Security Files (Review First)
- `src/lib/transactionSender.ts` — Jito + fallback RPC
- `src/lib/validation.ts` — Address validation
- `src/lib/transactionVerifier.ts` — TX verification before signing
- `src/config/solana.ts` — RPC endpoints, cluster config

### Type-Heavy Files (Needs Strict Types)
- `src/types/index.ts` — 500+ lines, well-structured but could use branded types
- `src/modules/*/types.ts` — Engine-specific types
- API response types: `DexScreenerPair`, `JupiterQuoteResponse`, `RaydiumQuoteResponse`

### Error-Prone Areas
- `src/modules/*/hooks/use*Scanner.ts` — All scanner hooks have try/catch but could use better typed errors
- `src/lib/*Scanner.ts` — RPC calls that can fail
- `src/lib/dustSwapper.ts` — Swap quote fetching

### Performance Hotspots
- `src/modules/lp-harvester/components/PositionRow.tsx` — Rendered many times
- `src/modules/decommission/components/DecommissionResultsList.tsx` — Large lists
- `src/components/scanner/ScanResults.tsx` — Dynamic content

---

## Patterns to Follow

### Error Handling Pattern (from `errors.ts`)
```typescript
import { createAppError } from '@/lib/errors';
throw createAppError('RPC_ERROR', `Details: ${err.message}`);
```

### Validation Pattern (from `validation.ts`)
```typescript
import { toValidPublicKey } from '@/lib/validation';
const pubkey = toValidPublicKey(address); // throws on invalid
```

### Transaction Pattern (from `transactionSender.ts`)
```typescript
import { sendWithJito } from '@/lib/transactionSender';
const sig = await sendWithJito(signedTx, connection);
```

---

## Known Issues (From Code Review)

| File | Line | Issue | Priority | Status |
|------|------|-------|----------|--------|
| `positionValueEstimator.ts` | 61 | `as any` for mint data | Medium | FIXED |
| `useDecommissionScanner.ts` | 11 | `any[]` typed log | Low | Open |
| `useDecommissionScanner.ts` | 46, 143, 177 | `err: any` in catch | Medium | Open |
| `sw.ts` | 78 | `event: any` in ServiceWorker | Low | Open |
| Transaction sender | - | No max retry limit | Medium | Open |

---

## Success Criteria

A "blockchain-grade" Solana dApp should have:
- ✅ Strict TypeScript (no `any` except where truly necessary)
- ✅ Input validation at all entry points
- ✅ Retry logic with exponential backoff for RPC
- ✅ Transaction simulation before sending
- ✅ Graceful degradation when services are down
- ✅ Clear user feedback for all error states
- ✅ No hardcoded values in business logic

---

## Agent Workflow

1. **Pick ONE improvement area** from Priority list above
2. **Pick ONE file** from the File Index
3. Make a focused change
4. Run `npm run typecheck` — must pass
5. Commit with conventional message: `security:`, `types:`, `refactor:`, `perf:`, `fix:`

**Tool Budget**: Stay under 30 tool calls per run to avoid 50-call limit.

---

Last Updated: 2026-03-31
Total Files: 139 `.ts/.tsx` source files
