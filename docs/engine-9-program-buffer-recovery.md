# Engine 9 — Program Buffer Recovery
**SolHunt Module Spec · v1.0 · 2026**

> Route: `/buffers` · Homepage card: Yes · Icon: `<Code2>` (lucide-react) · Status: `preview`

---

## 1. The Problem

When a Solana developer deploys or upgrades a program, the runtime first writes the compiled bytecode into a **BPF Loader buffer account**. This buffer holds the full program binary and must be funded with rent-exempt SOL proportional to program size — typically **1–5 SOL per buffer**.

Buffers become permanently orphaned when:
- A deployment fails mid-way and the dev moves on
- An upgrade is abandoned after testing
- A script deploys multiple iterations and forgets cleanup
- An **AI agent** runs rapid deployment loops — 10, 20, 50 iterations — and never cleans up any of them

The dev (or the agent operator) has no obvious place to discover these. The SOL just sits there, invisible.

---

## 2. Why This Is on the Homepage (Not Buried in Engine 2)

Engine 2 (Reclaim Rent) handles empty *token* accounts. Buffers are a completely different account type, owned by the BPF Loader programs, and require a different instruction to close. More importantly, **the audience is different**.

A developer landing on SolHunt for any reason needs to immediately see that this tool exists. The homepage card does that discovery job — a dev recognises "abandoned program buffers" in two seconds and knows it's for them. Without a homepage card, this engine is invisible to the exact people who need it.

---

## 3. Two Target Audiences

### 3.1 Individual Developers
- Deployed programs manually via `solana program deploy` or Anchor
- Have 1–5 forgotten buffers from failed upgrades or abandoned experiments
- Average recovery: **1–5 SOL**
- Discovery: Homepage card, dev Twitter/Discord word-of-mouth

### 3.2 Teams Running AI Agent Pipelines
- Agents iterate on deployments autonomously — dozens per hour
- No human is watching the individual buffer accounts
- The treasury/ops person has zero visibility into buffer sprawl
- Average recovery: **10–50+ SOL** depending on pipeline activity
- Discovery: Homepage card, targeted outreach to AI agent infrastructure teams

**Strategic angle:** A team that trusts SolHunt with their dev/agent wallet is a warm lead for bulk treasury recovery. This is the top of that funnel.

---

## 4. Homepage Card Entry

Add to `ENGINE_METADATA` in `src/config/constants.ts`:

```typescript
{
  id: 9,
  name: 'Recover Program Buffers',
  description: 'Close abandoned BPF Loader buffer accounts from failed or forgotten program deployments. Devs and AI agent pipelines commonly leave 1–50 SOL locked.',
  avgRecoverySOL: 3.0,
  route: '/buffers',
  status: 'preview',
}
```

Add to `ENGINE_ICONS` in `src/pages/HomePage.tsx`:

```typescript
import { ..., Code2 } from 'lucide-react';

const ENGINE_ICONS = {
  ...
  9: Code2,
};
```

---

## 5. Module File Structure

Follows the same pattern as `cnft-cleaner`, `lp-harvester`:

```
src/modules/buffer-recovery/
  index.ts                        # Re-exports public surface
  types.ts                        # BufferAccount, BufferScanResult, BufferCloseResult
  constants.ts                    # Program IDs, fee config, limits
  lib/
    bufferScanner.ts              # getProgramAccounts filtered for BPF buffer accounts
    bufferCloser.ts               # Builds SetAuthority + CloseBuffer transaction(s)
    rentCalculator.ts             # Derives exact lamports recoverable per buffer
  hooks/
    useBufferRecovery.ts          # Main hook — scan, select, close
  components/
    BufferRecoveryCard.tsx        # Root UI card
    BufferRow.tsx                 # Single buffer: size, locked SOL, close CTA
    ConfirmCloseModal.tsx         # ⚠️ Strong confirmation before irreversible close
```

Page + route:

```
src/pages/BufferRecoveryPage.tsx  # Mirrors TicketFinderPage structure
```

---

## 6. Core Types

```typescript
// src/modules/buffer-recovery/types.ts

export type BufferStatus =
  | 'closeable'     // Authority is the connected wallet — safe to close
  | 'active'        // In use by a current deployment — DO NOT close
  | 'foreign'       // Authority is a different wallet — not ours
  | 'unknown';      // Cannot determine state

export interface BufferAccount {
  address: string;                  // Buffer account pubkey
  authorityAddress: string;         // Who can close this buffer
  dataLengthBytes: number;          // Size of bytecode stored
  lamports: number;                 // Total SOL locked (rent + buffer)
  recoverableSOL: number;           // What user gets back after fee
  loaderProgram: 'v2' | 'v3';       // BPFLoader2 or BPFLoaderUpgradeable
  status: BufferStatus;
  label: string | null;             // Optional: derive from deploy history
}

export interface BufferScanResult {
  scannedAt: Date;
  buffers: BufferAccount[];
  closeableBuffers: BufferAccount[];
  totalLockedSOL: number;
  totalRecoverableSOL: number;
}

export type BufferScanStatus =
  | 'idle'
  | 'scanning'
  | 'scan_complete'
  | 'error';

export type BufferCloseStatus =
  | 'idle'
  | 'awaiting_confirmation'
  | 'closing'
  | 'complete'
  | 'error';

export interface BufferCloseResult {
  success: boolean;
  closedCount: number;
  failedCount: number;
  reclaimedSOL: number;
  signatures: string[];
  errorMessage: string | null;
}
```

---

## 7. On-Chain Mechanics

### 7.1 BPF Loader Program IDs

```typescript
// src/modules/buffer-recovery/constants.ts

// BPF Loader v2 (legacy, still used)
export const BPF_LOADER_V2 = 'BPFLoader2111111111111111111111111111111111';

// BPF Loader Upgradeable (current standard — Anchor, native programs)
export const BPF_LOADER_UPGRADEABLE = 'BPFLoaderUpgradeab1e11111111111111111111111';
```

### 7.2 Scanning for Buffers

Use `getProgramAccounts` against both loader programs, filtering for:
- `accountType === 'uninitialized'` — BPF Loader v2 buffers
- `accountType === 'buffer'` — BPFLoaderUpgradeable buffers where `authority === walletPublicKey`

```typescript
// src/modules/buffer-recovery/lib/bufferScanner.ts

export async function scanForBuffers(
  walletAddress: string,
  connection: Connection
): Promise<BufferAccount[]> {
  const walletPubkey = new PublicKey(walletAddress);

  // Scan BPFLoaderUpgradeable buffers owned by this wallet
  const accounts = await connection.getProgramAccounts(
    new PublicKey(BPF_LOADER_UPGRADEABLE),
    {
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode([1]) } },         // discriminator = Buffer variant
        { memcmp: { offset: 4, bytes: walletAddress } },            // authority === wallet
      ],
    }
  );

  return accounts.map(parseBufferAccount);
}
```

### 7.3 Closing a Buffer

Two instructions are required per buffer:

1. **`SetAuthority`** — optional if authority is already the wallet (skip if confirmed)
2. **`CloseBuffer`** — transfers lamports back to the wallet and zeros the account

```typescript
// Instruction to close a BPFLoaderUpgradeable buffer
const closeIx = new TransactionInstruction({
  programId: new PublicKey(BPF_LOADER_UPGRADEABLE),
  keys: [
    { pubkey: bufferAddress, isSigner: false, isWritable: true },   // buffer to close
    { pubkey: walletPubkey,  isSigner: false, isWritable: true },   // SOL destination
    { pubkey: walletPubkey,  isSigner: true,  isWritable: false },  // authority
  ],
  data: Buffer.from([5]),  // CloseBuffer instruction discriminator
});
```

---

## 8. Safety — The Confirmation Step

**Closing a buffer is irreversible.** Unlike token accounts (which hold zero-value dust), a buffer may contain program bytecode that is still needed for an in-progress deployment.

The `ConfirmCloseModal` must be prominent and honest:

```
⚠️  This will permanently destroy the program bytecode stored in these buffers.

Only close buffers from deployments that are FULLY COMPLETE or ABANDONED.

If you are mid-deployment and close an active buffer, your deployment
will fail and the bytecode cannot be recovered.

[ Cancel ]  [ I understand — Close and Recover SOL ]
```

Additional safeguards:
- Show `dataLengthBytes` for each buffer so the dev can cross-reference with their actual program sizes
- Flag any buffer created within the last 24 hours with a `⚡ Recent` badge and exclude it from auto-select
- Never auto-select all — user must manually check each buffer or explicitly "Select All"

---

## 9. Fee Model

| Action | Fee |
|--------|-----|
| Scan | Free |
| Close buffers | 10% of recovered SOL |
| Minimum fee threshold | Only charge if recovery > 0.05 SOL |

Fee rationale: Buffer recovery involves higher SOL amounts than token account rent, but the audience is technical and fee-sensitive. 10% is lower than Engine 2's 30% to reflect this. The service fee transfer is included in the first close transaction, same pattern as Engine 2.

```typescript
export const BUFFER_CLOSE_FEE_PERCENT = 10;
export const BUFFER_MIN_RECOVERY_FOR_FEE = 0.05; // SOL
export const MAX_BUFFERS_PER_TX = 3;             // Buffer closes are large txs
```

---

## 10. AppStore Slice

Add to `src/hooks/useAppStore.ts` following the Engine 7 MEV pattern:

```typescript
// State
bufferScanStatus: BufferScanStatus;
bufferScanResult: BufferScanResult | null;
bufferScanError: AppError | null;
selectedBufferAddresses: string[];
bufferCloseStatus: BufferCloseStatus;
bufferCloseResult: BufferCloseResult | null;
bufferCloseError: AppError | null;

// Actions
setBufferScanStatus: (s: BufferScanStatus) => void;
setBufferScanResult: (r: BufferScanResult | null) => void;
setBufferScanError: (e: AppError | null) => void;
setSelectedBufferAddresses: (addrs: string[]) => void;
toggleBufferSelection: (addr: string) => void;
selectAllBuffers: () => void;
deselectAllBuffers: () => void;
setBufferCloseStatus: (s: BufferCloseStatus) => void;
setBufferCloseResult: (r: BufferCloseResult | null) => void;
setBufferCloseError: (e: AppError | null) => void;
clearBuffers: () => void;
```

---

## 11. Page Layout (BufferRecoveryPage.tsx)

Mirrors `LpFeeHarvesterPage` exactly:

```tsx
import { Code2, ArrowLeft, TrendingUp } from 'lucide-react';
// ...

const ENGINE = ENGINE_METADATA[8]; // Recover Program Buffers

export function BufferRecoveryPage() {
  const { connected } = useWallet();

  return (
    <PageWrapper>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header: icon + title + avg recovery + back link */}
        {/* Wallet not connected: connect prompt */}
        {/* Wallet connected: <BufferRecoveryCard /> */}
      </div>
    </PageWrapper>
  );
}
```

Add route in `App.tsx`:

```tsx
import { BufferRecoveryPage } from '@/pages/BufferRecoveryPage';

<Route path="/buffers" element={<BufferRecoveryPage />} />
```

---

## 12. Transaction Verifier Update

The BPF Loader program IDs must be added to the `ALLOWED_PROGRAM_IDS` whitelist in `src/lib/transactionVerifier.ts`:

```typescript
// Add to ALLOWED_PROGRAM_IDS set:
'BPFLoader2111111111111111111111111111111111',        // BPF Loader v2
'BPFLoaderUpgradeab1e11111111111111111111111',        // BPF Loader Upgradeable
```

---

## 13. Analytics Events

Add to `src/lib/analytics.ts`:

```typescript
// ─── Engine 9 Events ──────────────────────────────────────────────────

export function logBufferScanComplete(data: {
  totalBuffers: number;
  closeableCount: number;
  totalLockedSOL: number;
  hasRecentBuffers: boolean;   // any buffer < 24h old (risk signal)
}): void { logEvent('buffer_scan_complete', data); }

export function logBufferCloseInitiated(data: {
  selectedCount: number;
  totalSOL: number;
  serviceFeeSOL: number;
  hadRecentBufferWarning: boolean;
}): void { logEvent('buffer_close_initiated', data); }

export function logBufferCloseComplete(data: {
  success: boolean;
  closedCount: number;
  failedCount: number;
  reclaimedSOL: number;
}): void { logEvent('buffer_close_complete', data); }
```

---

## 14. Error Messages

Add to `ERROR_MESSAGES` in `src/config/constants.ts`:

```typescript
// Engine 9
BUFFER_SCAN_FAILED: 'Could not scan for program buffers. Please try again.',
BUFFER_CLOSE_FAILED: 'Could not close one or more buffers. Your SOL was not affected.',
BUFFER_NOT_AUTHORITY: 'You are not the authority on one of the selected buffers.',
BUFFER_ACTIVE_DEPLOYMENT: 'One of the selected buffers appears to be in active use. Deselect it and try again.',
```

---

## 15. Implementation Phases

| Phase | Scope |
|-------|-------|
| **Phase 1** | Types, constants, AppStore slice, routing, empty page shell, homepage card |
| **Phase 2** | `bufferScanner.ts` — getProgramAccounts for both BPF loaders, parse + filter |
| **Phase 3** | `BufferRecoveryCard`, `BufferRow`, basic scan UI with skeleton states |
| **Phase 4** | `bufferCloser.ts` — build close transactions, fee deduction, sign + confirm flow |
| **Phase 5** | `ConfirmCloseModal` with ⚠️ warnings, recent buffer detection, manual selection UX |
| **Phase 6** | Transaction verifier update, analytics, error messages, status `live` |

---

## 16. Open Questions

- **BPF Loader v2 support:** Most modern programs use the upgradeable loader, but legacy v2 buffers exist. Include v2 in Phase 2 scope but lower priority.
- **Active deployment detection:** There is no reliable on-chain signal that a buffer is "in use." The 24-hour recency heuristic is the best we can do. Consider also checking if any Program account's `programData` references this buffer — if it does, it's definitely active.
- **Agent wallet detection:** We could surface a special message ("Looks like an agent wallet — X buffers found") if `closeableCount > 5`. Small UX touch that resonates with the AI infra audience.
- **Labelling buffers:** `solana program show --buffers` gives human-readable labels locally. These don't live on-chain, so we can't surface them. Show address + size + SOL as the primary identifiers.

---

*SolHunt · Engine 9 · Program Buffer Recovery · Spec v1.0*
