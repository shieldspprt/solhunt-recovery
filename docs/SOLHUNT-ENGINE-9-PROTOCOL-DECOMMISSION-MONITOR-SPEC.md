# 🪦 SolHunt — Engine 9: Protocol Decommission Monitor
### Complete Build Specification for AI Agent (Claude Opus 4.6)
### Repo: https://github.com/shieldspprt/solhunt-recovery
### Status: New Standalone Module — Own Route, Own Nav Card
### The engine for 20,000 Friktion wallets that still have stranded value they think is gone.

---

## AGENT CONTEXT — READ FIRST

You are adding **Engine 9** to the SolHunt wallet recovery suite.

**Existing engines already working in production:**
- Engine 1: Permission Revocation    (`src/modules/revocation/`)
- Engine 2: Account Rent Reclaimer   (`src/modules/rent/`)
- Engine 3: Dust Consolidator        (`src/modules/dust/`)
- Engine 4: Staking Ticket Finder    (`src/modules/staking/`)
- Engine 5: LP Fee Harvester         (`src/modules/lp/`)
- Engine 7: MEV & Priority Fee Claims (inside `src/modules/staking/`)
- Engine 8: Airdrop Deadline Tracker  (`src/modules/airdrop/`)

**Stack (do not change or add dependencies unless specified):**
React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Zustand + Firebase + Helius RPC
`@solana/wallet-adapter-react` · `@solana/web3.js` · `@solana/spl-token`

**Engine 9 architecture decision: FULLY INDEPENDENT MODULE**

```
src/modules/decommission/    ← New top-level module
```

It gets:
- Its own route: `/decommission`
- Its own nav card on the homepage
- Its own Zustand store
- Its own dead protocol registry
- Zero coupling to other engines at runtime

**Why fully independent and not embedded in Engine 3:**
Engine 3 (Dust Consolidator) handles tokens that are genuinely worthless —
dust from airdrops, micro-balances from old trades, tokens with no liquidity.
Engine 9 handles tokens that *look* worthless but are actually position receipts
from dead protocols — LP tokens, vault shares, structured product tokens —
that have real underlying assets recoverable directly from on-chain contracts.

The critical difference: Engine 3 destroys tokens to reclaim value.
Engine 9 redeems tokens against their underlying on-chain contracts.

A token that Engine 3 would burn could be an Engine 9 rescue — the user
would lose real money if Engine 3 ran first. They must always be separate.

**The relationship that justifies "pairs naturally with Engine 3":**
Engine 3 → sweep truly dead tokens
Engine 9 → rescue stranded but recoverable positions

Together they form SolHunt's complete answer to: "Why do I have all these
mystery tokens and what do I do with them?"

**Shared utilities (reuse, do not rewrite):**
`confirmTransactionRobust`, `getCachedSOLPrice`, `getTokenPrice`,
`withTimeout`, `logEvent`, `logger`, `chunk`

**DO NOT modify any existing engine files.**
Homepage card and route addition are the only shared-codebase touches.

---

## PART 1 — WHY THIS ENGINE EXISTS

### The Problem: Ghost Tokens in 50,000+ Wallets

When a Solana DeFi protocol shuts down its frontend but leaves its
on-chain contracts running, the following happens:

1. Protocol team kills the website or app
2. Users with positions (LP tokens, vault shares, deposit receipts) have
   no UI to interact with anymore
3. The on-chain contracts are still live — funds are still there —
   but users cannot access them without knowing how to send raw
   instructions to a Solana program
4. Most users assume the money is gone
5. The tokens sit in the wallet for months or years — classified as
   "worthless dust" — while the underlying assets remain locked

**Friktion Finance (January 2023)**
Friktion shut down its UI after $150M TVL peak.
Nearly 20,000 user wallets had Volt position tokens (fTokens)
representing shares in structured DeFi strategies.
The underlying protocol remained accessible on-chain.
Most users either never withdrew, or did so only because they
happened to check at the right moment during the wind-down period.
Many wallets still hold fToken mints years later with no idea
they may represent residual claims.

**Saber (SBR AMM)**
Saber's AMM at `SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ`
still exists on-chain. LP tokens issued by Saber pools are redeemable
directly against the pool contract — no UI required.
Users who provided stablecoin liquidity in 2021–2022 and never
withdrew may have LP tokens representing actual USDC/USDT still in pools.
SBR the governance token is worth next to nothing.
Saber LP tokens representing pool shares are an entirely different story.

**Atrix Finance**
Atrix was a Raydium-integrated AMM on Solana.
It quietly went inactive in late 2022.
No formal shutdown announcement — UI simply stopped being maintained.
LP tokens from Atrix pools are still redeemable on-chain.

**Aldrin**
Aldrin was a Solana DEX with AMM pools.
The project went dormant with no formal wind-down.
LP token holders may still have redeemable positions.

**Jet Protocol**
Jet Protocol's lending markets were wound down.
Users who deposited to Jet lending had deposit receipt tokens (jetTokens).
Some unclaimed positions may still exist on-chain.

**The Pattern**

Every DeFi cycle leaves ghost tokens behind. In Solana's history:
- Bear market 2022: Friktion, Atrix, Aldrin, early Jet
- Bear market 2024: More protocols wound down quietly
- Each cycle: new ghost tokens accumulate in wallets

None of these users are currently being served. No tool scans wallets for
ghost position tokens and recovers the underlying assets. Engine 9 does this.

### Why This Pairs With Engine 3 But Must Be Separate

Engine 3 logic: "This token has $0.02 of value. Jupiter can't swap it.
Burn it, recover the rent."

Engine 9 logic: "This token *looks* like it has $0.02 of value on Jupiter
because the protocol token (SBR) is worthless. But it is actually an LP
token representing a share of a Saber stablecoin pool that still holds
real USDC. The underlying value is not $0.02."

If Engine 3 runs first and burns an LP token, the user loses their
claim on the pool entirely. Engine 9 must run and be visible before
any token burn is ever suggested.

**Product placement rule:**
On the homepage, Engine 9's card appears BEFORE Engine 3's card.
In the nav order: 1 → 9 → 3 → 2 → 5 → 4/7 → 8

The "wallet guardian" brand is cemented by this pair:
- Engine 9: "We found you have tokens from dead protocols — here's what
  you can recover before anyone suggests burning them"
- Engine 3: "Here's the truly worthless dust — sweep it all into SOL"

### Revenue Model

**Fee:** 8% of recovered SOL/stablecoin value

Why 8% (higher than Engine 2's 15% but framed differently):
- The value recovered was genuinely thought to be lost
- 8% is psychologically easy on "money the user didn't know they had"
- Same framing as Engine 2 (rent recovery) — percentage of surprise value
- For a wallet with $50 in recovered stablecoin, fee = $4 in SOL

---

## PART 2 — THE DEAD PROTOCOL REGISTRY

The heart of Engine 9. Lives in `src/modules/decommission/registry/protocols.ts`.
This is a manually maintained registry — never auto-populated from external sources.
The registry is the only source of truth for what qualifies as a dead protocol.

### 2.1 Registry Entry Type

```typescript
// src/modules/decommission/registry/protocols.ts

export type DecommissionStatus =
  | 'ui_dead'       // Frontend down, on-chain contracts still live — RECOVERABLE
  | 'partially_dead' // Some features dead, some alive — PARTIALLY RECOVERABLE
  | 'fully_dead'    // Contracts upgraded away or emptied — NOT RECOVERABLE
  | 'winding_down'; // Announced wind-down in progress — URGENT: recover now

export type PositionType =
  | 'lp_token'          // AMM pool share token (Saber, Atrix, Aldrin)
  | 'vault_share'       // Yield vault share (Friktion Volts, Hubble vaults)
  | 'lending_receipt'   // Lending market deposit receipt (Jet, early Solend)
  | 'staked_position'   // Staked/locked position token
  | 'structured_product'; // Options vol strategies (Friktion Volts)

export interface DeadProtocol {
  // Identity
  id: string;                       // e.g. 'friktion_volts'
  name: string;                     // e.g. 'Friktion Volts'
  protocolName: string;             // e.g. 'Friktion'
  logoUrl: string;
  category: 'dex' | 'lending' | 'yield' | 'derivatives' | 'other';
  decommissionStatus: DecommissionStatus;

  // Timeline
  uiShutdownDate: Date | null;      // When frontend died
  announcementUrl: string | null;   // Link to shutdown announcement

  // Position tokens this protocol issued
  // Engine 9 scans user wallet for these specific mints
  positionTokenMints: PositionTokenDefinition[];

  // On-chain redemption
  isRecoverable: boolean;           // Can SolHunt build a withdrawal tx?
  onChainProgram: string | null;    // Program ID to call for withdrawal
  withdrawalMethod: WithdrawalMethod;

  // Display
  description: string;              // What this protocol was + why tokens exist
  underlyingAssets: string[];       // e.g. ['USDC', 'USDT'] or ['SOL', 'RAY']
  warningMessage: string | null;    // e.g. "DO NOT burn these tokens in Engine 3"
  recoveryUrl: string | null;       // Official recovery page if exists
}

export interface PositionTokenDefinition {
  mint: string;                     // SPL token mint address
  symbol: string;                   // Display symbol e.g. 'saber-USDC-USDT-LP'
  positionType: PositionType;
  poolOrVaultAddress: string | null; // Associated pool/vault on-chain
  underlyingTokenA: string | null;  // Mint of first underlying asset
  underlyingTokenB: string | null;  // Mint of second (if AMM LP)
  decimals: number;
}

export type WithdrawalMethod =
  | { type: 'direct_program_call'; instruction: string }
  // SolHunt builds the withdrawal instruction directly
  | { type: 'redirect'; url: string }
  // Protocol has a separate recovery tool — redirect user
  | { type: 'unknown' }
  // Position exists but withdrawal method not yet reverse-engineered
  | { type: 'no_recovery' };
  // On-chain contracts confirmed empty or upgraded away
```

### 2.2 Initial Registry — Confirmed Dead Protocols

```typescript
export const DEAD_PROTOCOLS: DeadProtocol[] = [

  // ─── CONFIRMED DEAD — ON-CHAIN CONTRACTS STILL LIVE ────────────────────

  {
    id: 'friktion_volts',
    name: 'Friktion Volts',
    protocolName: 'Friktion',
    logoUrl: '/logos/friktion.svg',
    category: 'derivatives',
    decommissionStatus: 'ui_dead',
    uiShutdownDate: new Date('2023-01-25'),
    announcementUrl: 'https://web.archive.org/web/2023*/https://friktion.fi',
    positionTokenMints: [
      // fToken mints — one per Volt strategy
      // ⚠️ AGENT: These must be looked up on-chain / Solscan before building
      // Search: site:solscan.io "friktion" token accounts
      // Or query: getTokenAccountsByMint for known Volt program accounts
      {
        mint: 'PLACEHOLDER_FRIKTION_VOLT1_MINT', // Replace with real mint
        symbol: 'fcUSD',
        positionType: 'structured_product',
        poolOrVaultAddress: null,
        underlyingTokenA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        underlyingTokenB: null,
        decimals: 6,
      },
      // Add other Volt mints as discovered
    ],
    isRecoverable: true,
    onChainProgram: 'VoLT1mJz1sbnxwq5Fv2SXjdVDgPXrb9tJyC8WpMDkSY',
    // ⚠️ AGENT: Verify Friktion program ID — search Solscan for Friktion transactions
    withdrawalMethod: {
      type: 'direct_program_call',
      instruction: 'withdraw',
    },
    description:
      'Friktion was a structured DeFi derivatives protocol (covered calls, '
      + 'crab strategy) that shut down its UI in January 2023. Volt position '
      + 'tokens (fTokens) represent shares in these strategies and may still '
      + 'hold underlying USDC or SOL.',
    underlyingAssets: ['USDC', 'SOL', 'BTC', 'ETH'],
    warningMessage:
      'DO NOT burn these tokens using Engine 3. They may represent real '
      + 'underlying value locked in the Friktion Volt contracts.',
    recoveryUrl: null,
  },

  {
    id: 'saber_lp',
    name: 'Saber AMM LP Tokens',
    protocolName: 'Saber',
    logoUrl: '/logos/saber.svg',
    category: 'dex',
    decommissionStatus: 'ui_dead',
    uiShutdownDate: null, // UI gradually became unmaintained ~2023
    announcementUrl: null,
    positionTokenMints: [
      // ⚠️ AGENT: Saber LP tokens are derived programmatically from pool accounts
      // Each pool has a unique LP mint. The most common pools were stablecoin pairs.
      // Fetch all Saber pool accounts from the Saber AMM program and extract LP mints.
      // Saber AMM program: SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ
      {
        mint: 'PLACEHOLDER_SABER_USDC_USDT_LP',
        symbol: 'USDC-USDT-LP',
        positionType: 'lp_token',
        poolOrVaultAddress: null, // Derived from LP mint
        underlyingTokenA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        underlyingTokenB: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
        decimals: 6,
      },
      // USDC-USDH, USDC-mSOL, USDC-stSOL, others — add programmatically
    ],
    isRecoverable: true,
    onChainProgram: 'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',
    withdrawalMethod: {
      type: 'direct_program_call',
      instruction: 'removeLiquidity',
    },
    description:
      'Saber was a Solana AMM specializing in stablecoin and pegged-asset '
      + 'swaps. The protocol\'s UI is no longer actively maintained. LP '
      + 'tokens can still be redeemed directly against the on-chain pool '
      + 'contracts for the underlying stablecoins.',
    underlyingAssets: ['USDC', 'USDT', 'USDH', 'mSOL', 'stSOL', 'whETH'],
    warningMessage:
      'DO NOT burn Saber LP tokens. They represent real stablecoin '
      + 'liquidity locked in on-chain pools.',
    recoveryUrl: 'https://app.saber.so',
  },

  {
    id: 'atrix_lp',
    name: 'Atrix AMM LP Tokens',
    protocolName: 'Atrix',
    logoUrl: '/logos/atrix.svg',
    category: 'dex',
    decommissionStatus: 'ui_dead',
    uiShutdownDate: null, // Went dormant late 2022
    announcementUrl: null,
    positionTokenMints: [
      // ⚠️ AGENT: Atrix built on top of Raydium's CLMM/OpenBook.
      // Atrix program: HvwYjjzPbXWpykgVZhqvvfeeSmZGZPvmCQAWyBMEZnEH
      // Verify this program ID and fetch LP mints from program accounts
      {
        mint: 'PLACEHOLDER_ATRIX_LP_MINT',
        symbol: 'ATRIX-LP',
        positionType: 'lp_token',
        poolOrVaultAddress: null,
        underlyingTokenA: null,
        underlyingTokenB: null,
        decimals: 6,
      },
    ],
    isRecoverable: true,
    onChainProgram: 'HvwYjjzPbXWpykgVZhqvvfeeSmZGZPvmCQAWyBMEZnEH',
    // ⚠️ AGENT: Verify Atrix program ID from a known Atrix transaction on Solscan
    withdrawalMethod: {
      type: 'unknown', // Verify instruction name from IDL
    },
    description:
      'Atrix was a Raydium-integrated AMM on Solana that went inactive in '
      + 'late 2022 without a formal shutdown announcement. LP token holders '
      + 'may still have redeemable positions in on-chain pools.',
    underlyingAssets: ['SOL', 'RAY', 'USDC', 'various'],
    warningMessage:
      'DO NOT burn Atrix LP tokens. They may represent recoverable liquidity.',
    recoveryUrl: null,
  },

  {
    id: 'aldrin_lp',
    name: 'Aldrin AMM LP Tokens',
    protocolName: 'Aldrin',
    logoUrl: '/logos/aldrin.svg',
    category: 'dex',
    decommissionStatus: 'ui_dead',
    uiShutdownDate: null, // Went dormant
    announcementUrl: null,
    positionTokenMints: [
      // ⚠️ AGENT: Aldrin AMM program needs verification
      // Search Solscan for Aldrin transactions to find program ID
      {
        mint: 'PLACEHOLDER_ALDRIN_LP_MINT',
        symbol: 'ALDRIN-LP',
        positionType: 'lp_token',
        poolOrVaultAddress: null,
        underlyingTokenA: null,
        underlyingTokenB: null,
        decimals: 6,
      },
    ],
    isRecoverable: true,
    onChainProgram: null, // ⚠️ AGENT: Must verify
    withdrawalMethod: { type: 'unknown' },
    description:
      'Aldrin was a Solana DEX with AMM pools and futures trading. The '
      + 'protocol went dormant. LP token holders from the AMM may have '
      + 'recoverable positions in on-chain pool contracts.',
    underlyingAssets: ['SOL', 'RIN', 'USDC', 'various'],
    warningMessage:
      'DO NOT burn Aldrin LP tokens until recovery status is verified.',
    recoveryUrl: null,
  },

  {
    id: 'jet_protocol',
    name: 'Jet Protocol Deposits',
    protocolName: 'Jet Protocol',
    logoUrl: '/logos/jet.svg',
    category: 'lending',
    decommissionStatus: 'ui_dead',
    uiShutdownDate: null,
    announcementUrl: null,
    positionTokenMints: [
      // Jet issued jetTokens as deposit receipts (e.g. jetUSDC, jetSOL)
      // ⚠️ AGENT: Verify these mints from Jet Protocol docs or on-chain data
      {
        mint: 'PLACEHOLDER_JET_USDC_MINT',
        symbol: 'jetUSDC',
        positionType: 'lending_receipt',
        poolOrVaultAddress: null,
        underlyingTokenA: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        underlyingTokenB: null,
        decimals: 6,
      },
      {
        mint: 'PLACEHOLDER_JET_SOL_MINT',
        symbol: 'jetSOL',
        positionType: 'lending_receipt',
        poolOrVaultAddress: null,
        underlyingTokenA: null, // Native SOL
        underlyingTokenB: null,
        decimals: 9,
      },
    ],
    isRecoverable: true,
    onChainProgram: null, // ⚠️ AGENT: Verify Jet lending program ID
    withdrawalMethod: { type: 'unknown' },
    description:
      'Jet Protocol was a Solana lending market. Its UI is no longer '
      + 'active. Jet deposit receipt tokens (jetUSDC, jetSOL) represent '
      + 'claims on deposited assets in the on-chain lending contracts.',
    underlyingAssets: ['USDC', 'SOL', 'BTC', 'ETH'],
    warningMessage:
      'DO NOT burn Jet protocol tokens. They represent lending market deposits.',
    recoveryUrl: null,
  },

  // ─── WINDING DOWN — URGENT ────────────────────────────────────────────────
  // Add protocols that have announced wind-down here with status: 'winding_down'
  // These get a prominent "URGENT: Withdraw NOW" banner in the UI

  // ─── FULLY DEAD — NO RECOVERY ─────────────────────────────────────────────
  // Kept in registry for display purposes only — shown as "tokens confirmed worthless"
  // so Engine 3 knows it is safe to burn them

];
```

### 2.3 Registry Maintenance Protocol

**When a new protocol dies:**
1. Open `src/modules/decommission/registry/protocols.ts`
2. Add entry at top with `decommissionStatus: 'ui_dead'`
3. Set `isRecoverable: true` initially — verify withdrawal method
4. Research the on-chain program ID from Solscan
5. Reverse-engineer withdrawal instruction from IDL or tx history
6. Update `withdrawalMethod` once confirmed
7. Run `npm run build` and push

**When a protocol announces wind-down:**
1. Add immediately with `decommissionStatus: 'winding_down'`
2. Post tweet from @solhunt about it (major acquisition opportunity)
3. "New: [Protocol] is winding down. SolHunt can detect and recover your
   [Protocol] positions before the deadline. Check now → solhunt.dev/decommission"

**When contracts confirmed empty:**
1. Update to `decommissionStatus: 'fully_dead'`
2. Update `withdrawalMethod: { type: 'no_recovery' }`
3. Set `isRecoverable: false`
4. Keep in registry so Engine 3 knows it is safe to burn the tokens

**Registry is the single source of truth.**
Engine 3 will eventually read from this registry to know which tokens
to EXCLUDE from its burn list. Add `isRecoverable: false` + `isDeadProtocol: true`
to any token before Engine 3 is allowed to suggest burning it.

---

## PART 3 — FILE STRUCTURE

```
src/modules/decommission/
├── index.ts                              ← Module barrel export
│
├── registry/
│   └── protocols.ts                      ← Dead protocol registry (Part 2)
│
├── types.ts                              ← All TypeScript types
├── constants.ts                          ← Program IDs, seeds, fee config
│
├── lib/
│   ├── decommissionScanner.ts            ← Orchestrator: scan wallet tokens
│   │                                        vs registry, find matches
│   ├── positionValueEstimator.ts         ← Estimate USD value of positions
│   └── withdrawalBuilder.ts             ← Build withdrawal transactions
│
├── hooks/
│   └── useDecommissionScanner.ts         ← All state + scan + recover logic
│
├── store/
│   └── decommissionStore.ts              ← Zustand store
│
└── components/
    ├── DecommissionPage.tsx              ← Top-level route component
    ├── DecommissionScanPanel.tsx         ← Pre-scan hero
    ├── DecommissionResultsList.tsx       ← Results after scan
    ├── DeadProtocolCard.tsx              ← One card per matched dead protocol
    ├── PositionRow.tsx                   ← One row per position token found
    ├── RecoveryModal.tsx                 ← Confirm + execute recovery
    ├── WindingDownBanner.tsx             ← Urgent banner for active wind-downs
    ├── SafeToBurnSection.tsx             ← Confirmed worthless dead tokens
    └── DecommissionEmptyState.tsx        ← No dead protocol tokens found
```

---

## PART 4 — TYPESCRIPT TYPES

File: `src/modules/decommission/types.ts`

```typescript
import type { DeadProtocol, PositionTokenDefinition } from './registry/protocols';

// ─── SCAN RESULT PER POSITION ─────────────────────────────────────────────────

export interface DecommissionPositionItem {
  // What was found
  protocol:              DeadProtocol;
  tokenDef:              PositionTokenDefinition;

  // On-chain balance
  tokenAccountAddress:   string;     // User's token account address
  balance:               number;     // Raw balance (pre-decimals)
  balanceFormatted:      number;     // Human readable (post-decimals)

  // Value estimate (null if cannot be determined)
  estimatedUnderlyingA:  number | null;  // Amount of token A recoverable
  estimatedUnderlyingB:  number | null;  // Amount of token B recoverable
  estimatedValueUSD:     number | null;

  // Recovery capability
  canRecover:            boolean;    // true = SolHunt can build the tx
  recoveryMethod:        'in_app' | 'redirect' | 'unknown' | 'none';
  redirectUrl:           string | null;

  // Urgency
  urgency:               'critical' | 'high' | 'normal' | 'none';
  // critical = protocol winding_down (deadline exists)
  // high = protocol ui_dead but recovery still possible
  // normal = standard dead protocol
  // none = fully_dead (no recovery possible)

  // UI state
  isSelected:            boolean;
}

export interface DecommissionScanResult {
  scannedAt:             Date;
  walletAddress:         string;
  protocolsChecked:      number;    // How many dead protocols checked
  positionsFound:        number;    // Total matching positions found
  recoverableCount:      number;    // canRecover === true
  redirectCount:         number;    // Redirect to official site
  unknownCount:          number;    // Recovery method not yet known
  confirmedWorthless:    number;    // fully_dead — safe to burn
  totalRecoverableUSD:   number | null;
  windingDownCount:      number;    // URGENT items
  items:                 DecommissionPositionItem[];
}

// ─── RECOVERY ESTIMATE ───────────────────────────────────────────────────────

export interface DecommissionRecoveryEstimate {
  selectedItems:         DecommissionPositionItem[];
  inAppItems:            DecommissionPositionItem[];
  redirectItems:         DecommissionPositionItem[];
  totalValueUSD:         number | null;
  serviceFeePercent:     number;
  serviceFeeUSD:         number | null;
  serviceFeeLamports:    number;
  netValueUSD:           number | null;
  txCount:               number;
}

// ─── RECOVERY RESULT ─────────────────────────────────────────────────────────

export interface DecommissionRecoveryItemResult {
  protocolId:            string;
  protocolName:          string;
  tokenSymbol:           string;
  success:               boolean;
  signature:             string | null;
  recoveredValueUSD:     number | null;
  errorMessage:          string | null;
  redirectUrl:           string | null;
}

export interface DecommissionRecoveryResult {
  recoveredCount:        number;
  redirectCount:         number;
  failedCount:           number;
  totalRecoveredUSD:     number | null;
  serviceFeeSignature:   string | null;
  items:                 DecommissionRecoveryItemResult[];
}

// ─── SCAN STATUS ──────────────────────────────────────────────────────────────

export type DecommissionScanStatus =
  | 'idle'
  | 'scanning'
  | 'scan_complete'
  | 'nothing_found'
  | 'error';

export type DecommissionRecoveryStatus =
  | 'idle'
  | 'awaiting_confirmation'
  | 'recovering'
  | 'complete'
  | 'error';

export interface DecommissionScanProgress {
  current:               number;
  total:                 number;
  currentProtocolName:   string;
  foundSoFar:            number;
}
```

---

## PART 5 — CONSTANTS

File: `src/modules/decommission/constants.ts`

```typescript
// ─── FEES ─────────────────────────────────────────────────────────────────────

export const DECOMMISSION_SERVICE_FEE_PERCENT = 8;  // 8% of recovered USD value
export const DECOMMISSION_FEE_SOL_MIN         = 0.001; // Minimum fee in SOL

// ─── SCAN ────────────────────────────────────────────────────────────────────

export const DECOMMISSION_SCAN_TIMEOUT_MS = 6_000;
export const DECOMMISSION_MIN_VALUE_USD   = 0.05;  // Don't show below this threshold

// ─── KNOWN PROGRAMS — add as registry entries are verified ──────────────────

// Saber stable swap AMM
export const SABER_AMM_PROGRAM =
  'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ';

// Friktion Volt program
// ⚠️ AGENT: Verify before use
export const FRIKTION_VOLT_PROGRAM =
  'VoLT1mJz1sbnxwq5Fv2SXjdVDgPXrb9tJyC8WpMDkSY';

// ─── INSTRUCTION SEEDS / DISCRIMINATORS ─────────────────────────────────────

// Saber stable swap remove liquidity instruction discriminator
// ⚠️ AGENT: Verify from Saber stable-swap IDL
export const SABER_REMOVE_LIQUIDITY_DISCRIMINATOR = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // PLACEHOLDER — verify
]);

// Friktion withdraw instruction discriminator
// ⚠️ AGENT: Verify from Friktion IDL or tx decode
export const FRIKTION_WITHDRAW_DISCRIMINATOR = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // PLACEHOLDER — verify
]);
```

---

## PART 6 — SCANNER

File: `src/modules/decommission/lib/decommissionScanner.ts`

The scanner is fundamentally different from all other SolHunt engines.
It does NOT call external APIs. It works entirely from:
1. The user's wallet token accounts (from RPC)
2. The dead protocol registry (static local data)

Matching is a simple set intersection: tokens in wallet ∩ tokens in registry.

```typescript
/**
 * Scan the user's wallet for tokens that match any dead protocol
 * in the registry. For each match, attempt to estimate underlying value.
 *
 * This is pure on-chain data — no external APIs required.
 * Speed: fast. The registry lookup is O(N*M) where N = token accounts
 * and M = registry entries. Both are small numbers (<200 each).
 */
export async function scanForDeadProtocolPositions(
  walletAddress: string,
  connection: Connection,
  onProgress: (p: DecommissionScanProgress) => void
): Promise<DecommissionScanResult>
```

Implementation:

```typescript
export async function scanForDeadProtocolPositions(
  walletAddress: string,
  connection: Connection,
  onProgress: (p: DecommissionScanProgress) => void
): Promise<DecommissionScanResult> {

  // Step 1: Get all token accounts for wallet
  const tokenAccountsResponse = await connection.getParsedTokenAccountsByOwner(
    new PublicKey(walletAddress),
    { programId: TOKEN_PROGRAM_ID }
  );

  const walletTokens = tokenAccountsResponse.value.map(acc => ({
    accountAddress: acc.pubkey.toString(),
    mint:           acc.account.data.parsed.info.mint as string,
    balance:        acc.account.data.parsed.info.tokenAmount.amount as string,
    balanceUI:      acc.account.data.parsed.info.tokenAmount.uiAmount as number,
    decimals:       acc.account.data.parsed.info.tokenAmount.decimals as number,
  }));

  if (walletTokens.length === 0) {
    return emptyResult(walletAddress);
  }

  // Build a lookup map: mint → token account
  const walletMintMap = new Map(walletTokens.map(t => [t.mint, t]));

  // Step 2: Check every dead protocol registry entry
  const activeProtocols = DEAD_PROTOCOLS.filter(
    p => p.decommissionStatus !== 'fully_dead' || true // include all for display
  );

  const items: DecommissionPositionItem[] = [];
  let foundCount = 0;

  for (let i = 0; i < activeProtocols.length; i++) {
    const protocol = activeProtocols[i];

    onProgress({
      current: i + 1,
      total: activeProtocols.length,
      currentProtocolName: protocol.protocolName,
      foundSoFar: foundCount,
    });

    // Check each token mint defined for this protocol
    for (const tokenDef of protocol.positionTokenMints) {
      const walletToken = walletMintMap.get(tokenDef.mint);

      if (!walletToken || walletToken.balanceUI <= 0) continue;

      // Match found — estimate underlying value
      const valueEstimate = await estimatePositionValue(
        tokenDef,
        walletToken.balanceUI,
        protocol,
        connection
      );

      // Skip if below minimum threshold
      if (
        valueEstimate.estimatedValueUSD !== null &&
        valueEstimate.estimatedValueUSD < DECOMMISSION_MIN_VALUE_USD
      ) continue;

      const urgency = computeUrgency(protocol.decommissionStatus);
      const recoveryMethod = resolveRecoveryMethod(protocol);

      items.push({
        protocol,
        tokenDef,
        tokenAccountAddress:  walletToken.accountAddress,
        balance:              Number(walletToken.balance),
        balanceFormatted:     walletToken.balanceUI,
        estimatedUnderlyingA: valueEstimate.estimatedUnderlyingA,
        estimatedUnderlyingB: valueEstimate.estimatedUnderlyingB,
        estimatedValueUSD:    valueEstimate.estimatedValueUSD,
        canRecover:           protocol.isRecoverable &&
                              recoveryMethod !== 'unknown' &&
                              recoveryMethod !== 'none',
        recoveryMethod,
        redirectUrl:          protocol.recoveryUrl,
        urgency,
        isSelected:           true,
      });

      foundCount++;
    }
  }

  // Sort: winding_down first → ui_dead recoverable → redirect → unknown → none
  items.sort((a, b) => {
    const order = { critical: 0, high: 1, normal: 2, none: 3 };
    return order[a.urgency] - order[b.urgency];
  });

  const recoverableItems = items.filter(i => i.canRecover);
  const totalUSD = recoverableItems
    .filter(i => i.estimatedValueUSD !== null)
    .reduce((sum, i) => sum + (i.estimatedValueUSD ?? 0), 0);

  return {
    scannedAt:           new Date(),
    walletAddress,
    protocolsChecked:    activeProtocols.length,
    positionsFound:      items.length,
    recoverableCount:    recoverableItems.length,
    redirectCount:       items.filter(i => i.recoveryMethod === 'redirect').length,
    unknownCount:        items.filter(i => i.recoveryMethod === 'unknown').length,
    confirmedWorthless:  items.filter(i => i.recoveryMethod === 'none').length,
    totalRecoverableUSD: totalUSD > 0 ? totalUSD : null,
    windingDownCount:    items.filter(i => i.urgency === 'critical').length,
    items,
  };
}

function resolveRecoveryMethod(
  protocol: DeadProtocol
): DecommissionPositionItem['recoveryMethod'] {
  const wm = protocol.withdrawalMethod;
  if (wm.type === 'direct_program_call') return 'in_app';
  if (wm.type === 'redirect') return 'redirect';
  if (wm.type === 'unknown') return 'unknown';
  if (wm.type === 'no_recovery') return 'none';
  return 'unknown';
}

function computeUrgency(
  status: DeadProtocol['decommissionStatus']
): DecommissionPositionItem['urgency'] {
  if (status === 'winding_down') return 'critical';
  if (status === 'ui_dead')      return 'high';
  if (status === 'partially_dead') return 'normal';
  return 'none'; // fully_dead
}
```

---

## PART 7 — POSITION VALUE ESTIMATOR

File: `src/modules/decommission/lib/positionValueEstimator.ts`

For AMM LP tokens, value can be estimated by reading pool reserves on-chain.
For vault/structured product tokens, estimation is harder — may need
to call the protocol's on-chain state account.

```typescript
export interface ValueEstimate {
  estimatedUnderlyingA:  number | null;
  estimatedUnderlyingB:  number | null;
  estimatedValueUSD:     number | null;
}

export async function estimatePositionValue(
  tokenDef:      PositionTokenDefinition,
  balance:       number,
  protocol:      DeadProtocol,
  connection:    Connection
): Promise<ValueEstimate> {

  try {
    if (tokenDef.positionType === 'lp_token') {
      return await estimateLPTokenValue(tokenDef, balance, protocol, connection);
    }
    if (tokenDef.positionType === 'lending_receipt') {
      return await estimateLendingReceiptValue(tokenDef, balance, connection);
    }
    // Structured products (Friktion Volts): harder to estimate — use conservative approach
    return await estimateVaultShareValue(tokenDef, balance, connection);

  } catch (err) {
    logger.warn('estimatePositionValue failed', tokenDef.mint, err);
    return { estimatedUnderlyingA: null, estimatedUnderlyingB: null, estimatedValueUSD: null };
  }
}

/**
 * Estimate LP token value by reading pool reserve accounts on-chain.
 *
 * For Saber stable swap:
 * - Fetch pool account (derives from LP mint)
 * - Read token A reserve balance and token B reserve balance
 * - Read LP token total supply
 * - User's share = balance / totalSupply
 * - User's value = share * (reserveA_value + reserveB_value)
 */
async function estimateLPTokenValue(
  tokenDef:   PositionTokenDefinition,
  balance:    number,
  protocol:   DeadProtocol,
  connection: Connection
): Promise<ValueEstimate> {

  if (!tokenDef.poolOrVaultAddress || !tokenDef.underlyingTokenA) {
    return { estimatedUnderlyingA: null, estimatedUnderlyingB: null, estimatedValueUSD: null };
  }

  // Get LP token total supply from mint
  const mintInfo = await connection.getParsedAccountInfo(
    new PublicKey(tokenDef.mint)
  );
  if (!mintInfo.value) {
    return { estimatedUnderlyingA: null, estimatedUnderlyingB: null, estimatedValueUSD: null };
  }

  const mintData = (mintInfo.value.data as any).parsed?.info;
  const totalSupply = Number(mintData?.supply ?? 0) / Math.pow(10, tokenDef.decimals);

  if (totalSupply === 0) {
    return { estimatedUnderlyingA: 0, estimatedUnderlyingB: 0, estimatedValueUSD: 0 };
  }

  // Get pool reserves — read token accounts of the pool
  const poolReserveA = await connection.getTokenAccountBalance(
    new PublicKey(tokenDef.poolOrVaultAddress)
  );

  const reserveAAmount = Number(poolReserveA.value.uiAmount ?? 0);
  const userShare      = balance / totalSupply;
  const userAmountA    = reserveAAmount * userShare;

  // For stablecoin pools: token A ≈ $1, so value ≈ userAmountA * 2 (A + B symmetric)
  // For non-stable pools: fetch price from Jupiter price API
  const priceA = await getTokenPrice(tokenDef.underlyingTokenA);
  const priceB = tokenDef.underlyingTokenB
    ? await getTokenPrice(tokenDef.underlyingTokenB)
    : priceA; // Assume symmetric for pegged assets

  // Estimate user's token B amount (symmetric for stable AMMs)
  const userAmountB = tokenDef.underlyingTokenB ? userAmountA * (priceA / priceB) : null;

  const estimatedValueUSD =
    (userAmountA * priceA) +
    (userAmountB !== null ? userAmountB * priceB : userAmountA * priceA);

  return {
    estimatedUnderlyingA: userAmountA,
    estimatedUnderlyingB: userAmountB,
    estimatedValueUSD,
  };
}

async function estimateLendingReceiptValue(
  tokenDef:   PositionTokenDefinition,
  balance:    number,
  connection: Connection
): Promise<ValueEstimate> {
  // For lending receipts, the exchange rate is usually 1:1 plus accrued interest
  // Simplest estimate: balance * price of underlying
  if (!tokenDef.underlyingTokenA) {
    return { estimatedUnderlyingA: balance, estimatedUnderlyingB: null, estimatedValueUSD: null };
  }
  const price = await getTokenPrice(tokenDef.underlyingTokenA);
  return {
    estimatedUnderlyingA: balance,
    estimatedUnderlyingB: null,
    estimatedValueUSD: balance * price,
  };
}

async function estimateVaultShareValue(
  tokenDef:   PositionTokenDefinition,
  balance:    number,
  connection: Connection
): Promise<ValueEstimate> {
  // Conservative: show balance as unknown value if we can't read on-chain state
  // This prompts the user to try recovery even with no USD estimate
  return {
    estimatedUnderlyingA: balance, // Raw share balance
    estimatedUnderlyingB: null,
    estimatedValueUSD: null,       // Show as "unknown — try recovery"
  };
}
```

---

## PART 8 — WITHDRAWAL BUILDER

File: `src/modules/decommission/lib/withdrawalBuilder.ts`

Builds withdrawal transactions for supported (in_app) recovery items.

**Architecture note:** Because each dead protocol has a unique instruction
layout, this file uses a protocol-specific dispatch pattern — one builder
function per protocol. New protocols are added by implementing a new
builder function and adding a case to the dispatch switch.

```typescript
export async function buildWithdrawalTransactions(
  items:            DecommissionPositionItem[],
  walletPublicKey:  PublicKey,
  connection:       Connection
): Promise<Transaction[]> {

  const inAppItems = items.filter(i => i.recoveryMethod === 'in_app');
  if (inAppItems.length === 0) return [];

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const transactions: Transaction[] = [];

  // Calculate service fee
  const totalValueUSD = inAppItems
    .filter(i => i.estimatedValueUSD !== null)
    .reduce((sum, i) => sum + (i.estimatedValueUSD ?? 0), 0);

  const solPrice = getCachedSOLPrice();
  const serviceFeeUSD = totalValueUSD * (DECOMMISSION_SERVICE_FEE_PERCENT / 100);
  const serviceFeeLamports = Math.max(
    Math.floor((serviceFeeUSD / solPrice) * LAMPORTS_PER_SOL),
    Math.floor(DECOMMISSION_FEE_SOL_MIN * LAMPORTS_PER_SOL)
  );

  for (let i = 0; i < inAppItems.length; i++) {
    const item = inAppItems[i];
    const tx = new Transaction();
    tx.feePayer = walletPublicKey;
    tx.recentBlockhash = blockhash;

    // Build protocol-specific withdrawal instruction
    const withdrawIx = await buildWithdrawInstruction(
      item, walletPublicKey, connection
    );

    if (!withdrawIx) {
      logger.warn('Could not build withdrawal for', item.protocol.id);
      continue;
    }

    tx.add(withdrawIx);

    // Add service fee to last transaction
    if (i === inAppItems.length - 1 && serviceFeeLamports > 0) {
      tx.add(SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey:   new PublicKey(import.meta.env.VITE_TREASURY_WALLET),
        lamports:   serviceFeeLamports,
      }));
    }

    transactions.push(tx);
  }

  return transactions;
}

async function buildWithdrawInstruction(
  item:            DecommissionPositionItem,
  walletPublicKey: PublicKey,
  connection:      Connection
): Promise<TransactionInstruction | null> {

  switch (item.protocol.id) {
    case 'saber_lp':
      return buildSaberWithdrawInstruction(item, walletPublicKey, connection);

    case 'friktion_volts':
      return buildFriktionWithdrawInstruction(item, walletPublicKey, connection);

    // Add new cases as new withdrawal builders are implemented

    default:
      logger.warn('No withdrawal builder for protocol:', item.protocol.id);
      return null;
  }
}

/**
 * Saber stable swap remove_liquidity instruction
 *
 * ⚠️ AGENT: Before implementing, verify:
 * 1. The Saber stable-swap program instruction layout from IDL at:
 *    https://github.com/saber-hq/stable-swap
 * 2. The account ordering for the remove_liquidity instruction
 * 3. The instruction discriminator
 * 4. Whether a minimum output amount must be specified (slippage)
 *
 * Key accounts needed:
 * - swap account (pool state)
 * - authority (PDA derived from swap account)
 * - user LP token account (the position token account)
 * - token A reserve account (pool holds token A here)
 * - token B reserve account (pool holds token B here)
 * - user token A destination account
 * - user token B destination account
 * - LP token mint
 * - token program
 */
async function buildSaberWithdrawInstruction(
  item:            DecommissionPositionItem,
  walletPublicKey: PublicKey,
  connection:      Connection
): Promise<TransactionInstruction | null> {

  if (!item.tokenDef.poolOrVaultAddress) return null;

  // Derive pool authority PDA
  const [poolAuthority] = PublicKey.findProgramAddressSync(
    [new PublicKey(item.tokenDef.poolOrVaultAddress).toBuffer()],
    new PublicKey(SABER_AMM_PROGRAM)
  );

  // Build instruction — exact accounts from Saber IDL
  // ⚠️ AGENT: Replace this stub with actual Saber stable-swap IDL implementation
  logger.warn('Saber withdrawal instruction builder: STUB — implement from IDL');
  return null; // Remove this line once implemented
}

/**
 * Friktion Volt withdrawal instruction
 *
 * ⚠️ AGENT: Before implementing, verify:
 * 1. Friktion Volt program IDL — available at https://github.com/Friktion-Labs/sdk
 *    or decode from on-chain program at VoLT1mJz1sbnxwq5Fv2SXjdVDgPXrb9tJyC8WpMDkSY
 * 2. The `withdraw` instruction account layout
 * 3. Whether withdrawal requires an epoch boundary (delayed)
 * 4. Whether vault-specific pending withdrawal accounts are needed
 */
async function buildFriktionWithdrawInstruction(
  item:            DecommissionPositionItem,
  walletPublicKey: PublicKey,
  connection:      Connection
): Promise<TransactionInstruction | null> {

  // ⚠️ AGENT: Implement from Friktion SDK / IDL
  logger.warn('Friktion withdrawal instruction builder: STUB — implement from IDL');
  return null; // Remove this line once implemented
}
```

**Critical implementation note for the agent:**

The withdrawal builders for each dead protocol are intentionally stubbed.
Each one requires:
1. Finding the protocol's GitHub repo or archived Anchor IDL
2. Verifying the exact instruction name, account ordering, and data layout
3. Testing on a devnet fork if possible before mainnet use

The correct process per protocol:
1. Search GitHub for `[protocol-name] solana program IDL`
2. Or: Find a historical withdrawal transaction on Solscan and decode the instruction data
3. Implement the builder from the verified IDL
4. Test with the smallest possible position first

Do NOT write fabricated instruction data. Every field must be verified.

---

## PART 9 — ZUSTAND STORE

File: `src/modules/decommission/store/decommissionStore.ts`

```typescript
interface DecommissionStoreState {
  scanStatus:      DecommissionScanStatus;
  scanResult:      DecommissionScanResult | null;
  scanError:       string | null;
  scanProgress:    DecommissionScanProgress | null;
  recoveryStatus:  DecommissionRecoveryStatus;
  recoveryResult:  DecommissionRecoveryResult | null;
  recoveryError:   string | null;
  recoveryProgress: string;
  selectedIds:     string[];    // tokenAccountAddress values

  setScanStatus:      (s: DecommissionScanStatus) => void;
  setScanResult:      (r: DecommissionScanResult | null) => void;
  setScanError:       (e: string | null) => void;
  setScanProgress:    (p: DecommissionScanProgress | null) => void;
  setRecoveryStatus:  (s: DecommissionRecoveryStatus) => void;
  setRecoveryResult:  (r: DecommissionRecoveryResult | null) => void;
  setRecoveryError:   (e: string | null) => void;
  setRecoveryProgress:(t: string) => void;
  setSelectedIds:     (ids: string[]) => void;
  toggleItem:         (id: string) => void;
  selectAllRecoverable: () => void;
  deselectAll:        () => void;
  reset:              () => void;
}
```

---

## PART 10 — HOOK

File: `src/modules/decommission/hooks/useDecommissionScanner.ts`

```typescript
export function useDecommissionScanner() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const store = useDecommissionStore();

  const startScan = useCallback(async () => {
    if (!publicKey) return;
    store.reset();
    store.setScanStatus('scanning');

    logEvent('decommission_scan_started');

    try {
      const result = await scanForDeadProtocolPositions(
        publicKey.toString(),
        connection,
        (progress) => store.setScanProgress(progress)
      );

      store.setScanResult(result);
      store.setScanStatus(
        result.positionsFound > 0 ? 'scan_complete' : 'nothing_found'
      );

      // Default select all recoverable items
      store.setSelectedIds(
        result.items
          .filter(i => i.canRecover)
          .map(i => i.tokenAccountAddress)
      );

      logEvent('decommission_scan_complete', {
        positionsFound:    result.positionsFound,
        recoverableCount:  result.recoverableCount,
        totalValueUSD:     result.totalRecoverableUSD,
        windingDownCount:  result.windingDownCount,
      });

    } catch (err: any) {
      store.setScanStatus('error');
      store.setScanError('Scan failed. Please try again.');
    }
  }, [publicKey, connection]);

  const selectedItems = useMemo(() => {
    return (store.scanResult?.items ?? []).filter(
      i => store.selectedIds.includes(i.tokenAccountAddress)
    );
  }, [store.scanResult, store.selectedIds]);

  const recoveryEstimate = useMemo((): DecommissionRecoveryEstimate | null => {
    if (selectedItems.length === 0) return null;

    const inAppItems    = selectedItems.filter(i => i.recoveryMethod === 'in_app');
    const redirectItems = selectedItems.filter(i => i.recoveryMethod === 'redirect');

    const totalValueUSD = selectedItems
      .filter(i => i.estimatedValueUSD !== null)
      .reduce((sum, i) => sum + (i.estimatedValueUSD ?? 0), 0);

    const serviceFeeUSD = totalValueUSD * (DECOMMISSION_SERVICE_FEE_PERCENT / 100);
    const solPrice      = getCachedSOLPrice();
    const serviceFeeSOL = Math.max(
      serviceFeeUSD / solPrice,
      DECOMMISSION_FEE_SOL_MIN
    );

    return {
      selectedItems,
      inAppItems,
      redirectItems,
      totalValueUSD:      totalValueUSD > 0 ? totalValueUSD : null,
      serviceFeePercent:  DECOMMISSION_SERVICE_FEE_PERCENT,
      serviceFeeUSD:      serviceFeeUSD > 0 ? serviceFeeUSD : null,
      serviceFeeLamports: Math.floor(serviceFeeSOL * LAMPORTS_PER_SOL),
      netValueUSD:        totalValueUSD > 0 ? totalValueUSD - serviceFeeUSD : null,
      txCount:            inAppItems.length,
    };
  }, [selectedItems]);

  const initiateRecovery = useCallback(() => {
    if (selectedItems.length === 0) return;
    store.setRecoveryStatus('awaiting_confirmation');
  }, [selectedItems]);

  const executeRecovery = useCallback(async () => {
    if (!publicKey || !signTransaction || !sendTransaction) return;

    store.setRecoveryStatus('recovering');
    const resultItems: DecommissionRecoveryItemResult[] = [];

    try {
      // Handle redirect items first — open official site in new tab
      const redirectItems = selectedItems.filter(i => i.recoveryMethod === 'redirect');
      for (const item of redirectItems) {
        if (item.redirectUrl) {
          window.open(item.redirectUrl, '_blank', 'noopener');
        }
        resultItems.push({
          protocolId:        item.protocol.id,
          protocolName:      item.protocol.name,
          tokenSymbol:       item.tokenDef.symbol,
          success:           false,
          signature:         null,
          recoveredValueUSD: null,
          errorMessage:      null,
          redirectUrl:       item.redirectUrl,
        });
      }

      // Handle in-app recovery items
      const inAppItems = selectedItems.filter(i => i.recoveryMethod === 'in_app');
      if (inAppItems.length > 0) {

        const transactions = await buildWithdrawalTransactions(
          inAppItems, publicKey, connection
        );

        for (let i = 0; i < transactions.length; i++) {
          const item = inAppItems[i];
          store.setRecoveryProgress(
            `Recovering ${item.protocol.name}... (${i + 1}/${transactions.length})`
          );

          try {
            const signed = await signTransaction(transactions[i]);
            const sig    = await sendTransaction(signed, connection);
            await confirmTransactionRobust(connection, sig, 'confirmed');

            resultItems.push({
              protocolId:        item.protocol.id,
              protocolName:      item.protocol.name,
              tokenSymbol:       item.tokenDef.symbol,
              success:           true,
              signature:         sig,
              recoveredValueUSD: item.estimatedValueUSD,
              errorMessage:      null,
              redirectUrl:       null,
            });

          } catch (txErr: any) {
            resultItems.push({
              protocolId:        item.protocol.id,
              protocolName:      item.protocol.name,
              tokenSymbol:       item.tokenDef.symbol,
              success:           false,
              signature:         null,
              recoveredValueUSD: null,
              errorMessage:      txErr.message ?? 'Transaction failed',
              redirectUrl:       item.protocol.recoveryUrl,
            });
          }
        }
      }

      store.setRecoveryResult({
        recoveredCount:      resultItems.filter(r => r.success).length,
        redirectCount:       resultItems.filter(r => r.redirectUrl && !r.success).length,
        failedCount:         resultItems.filter(r => !r.success && !r.redirectUrl).length,
        totalRecoveredUSD:
          resultItems
            .filter(r => r.success && r.recoveredValueUSD)
            .reduce((s, r) => s + (r.recoveredValueUSD ?? 0), 0) || null,
        serviceFeeSignature: null,
        items: resultItems,
      });

      store.setRecoveryStatus('complete');

      logEvent('decommission_recovery_complete', {
        recovered: resultItems.filter(r => r.success).length,
        redirect:  resultItems.filter(r => r.redirectUrl).length,
        failed:    resultItems.filter(r => !r.success && !r.redirectUrl).length,
      });

    } catch (err: any) {
      store.setRecoveryStatus('error');
      store.setRecoveryError('Recovery failed. Please try again.');
    }
  }, [publicKey, signTransaction, sendTransaction, selectedItems, connection]);

  return {
    scanStatus:       store.scanStatus,
    scanResult:       store.scanResult,
    scanProgress:     store.scanProgress,
    startScan,
    selectedItems,
    recoveryEstimate,
    toggleItem:       store.toggleItem,
    selectAllRecoverable: store.selectAllRecoverable,
    deselectAll:      store.deselectAll,
    recoveryStatus:   store.recoveryStatus,
    recoveryResult:   store.recoveryResult,
    recoveryError:    store.recoveryError,
    initiateRecovery,
    executeRecovery,
    cancelRecovery:   () => store.setRecoveryStatus('idle'),
  };
}
```

---

## PART 11 — UI COMPONENTS

### 11.1 DecommissionPage.tsx — Route Component

```
Route: /decommission
Title: Protocol Decommission Monitor
```

Layout:
```
<DecommissionPage>
  ├── WindingDownBanner (if any winding_down protocols exist — always visible)
  │
  ├── if scanStatus === 'idle':
  │     <DecommissionScanPanel />
  │
  ├── if scanStatus === 'scanning':
  │     Scanning progress with per-protocol name
  │
  ├── if scanStatus === 'scan_complete':
  │     <DecommissionResultsList />
  │     <SafeToBurnSection />     ← confirmed worthless tokens (safe for Engine 3)
  │
  ├── if scanStatus === 'nothing_found':
  │     <DecommissionEmptyState />
  │
  └── if recoveryStatus is active:
        <RecoveryModal />
```

### 11.2 WindingDownBanner.tsx

This banner appears at the very top of the page — ABOVE everything —
whenever a `winding_down` protocol exists in the registry.
It is shown even before the user scans.

```
┌──────────────────────────────────────────────────────────────────┐
│  🚨  URGENT — [Protocol Name] IS WINDING DOWN                    │
│                                                                   │
│  [Protocol] has announced it is shutting down.                   │
│  Users with [position token] positions must withdraw             │
│  before [deadline if known / as soon as possible].               │
│                                                                   │
│  Scan your wallet now to check if you are affected.              │
│                                                                   │
│  [Scan My Wallet Now →]                                          │
└──────────────────────────────────────────────────────────────────┘
```

This banner is the most powerful acquisition tool in the module.
When a major protocol winds down, this becomes a tweet:
"[Protocol] is shutting down. SolHunt automatically detects positions in
winding-down protocols and helps you recover before it's too late.
Check now → solhunt.dev/decommission"

### 11.3 DecommissionScanPanel.tsx — Pre-Scan Hero

```
🪦 Protocol Decommission Monitor

Solana's DeFi graveyard is full of your tokens.

Friktion shut down in 2023 — 20,000 wallets still have position tokens.
Saber went quiet — LP tokens representing real USDC sit unreclaimed.
Atrix, Aldrin, Jet Protocol — all dormant, all still holding funds.

The contracts are still on-chain. The money is still there.
You just need someone to build the recovery transaction for you.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Currently monitoring:    [N] decommissioned protocols
Known position tokens:   [N] registered token mints

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Important: Do not burn tokens from dead protocols.
    They may look like worthless dust. They are not.
    Scan here first — Engine 3 (Dust Consolidator) runs after.

[Scan My Wallet →]

Read-only scan. No transaction until you confirm recovery.
```

The warning about Engine 3 is deliberate and important. It reinforces
the order of operations and subtly prompts users who know about Engine 3
to come here first. It's also the strongest argument for SolHunt Pro:
"We run this check automatically every day before your dust scan."

### 11.4 DeadProtocolCard.tsx — One Card Per Matched Protocol

**Variant A — Recoverable (in_app)**
```
┌──────────────────────────────────────────────────────────────────┐
│  [Saber Logo]  Saber AMM                             ⬆ RECOVER   │
│                UI Shut Down: 2023                                 │
│                                                                   │
│  Position found:                                                  │
│                                                                   │
│  ☑  USDC-USDT-LP   0.842 tokens                                  │
│     Estimated value: ~$34.20                                      │
│     Underlying: ~17.10 USDC + ~17.10 USDT                        │
│     Recovery: In-app (SolHunt builds the tx)                     │
│                                                                   │
│  Saber was a stablecoin AMM. Its UI is inactive but the          │
│  on-chain contracts still hold your liquidity.                    │
│                                                                   │
│  ⚠️ DO NOT burn this token in Engine 3.                           │
└──────────────────────────────────────────────────────────────────┘
```

**Variant B — Redirect**
```
┌──────────────────────────────────────────────────────────────────┐
│  [Friktion Logo]  Friktion Volts                     ↗ REDIRECT  │
│                  UI Shut Down: Jan 25, 2023                       │
│                                                                   │
│  Position found:                                                  │
│                                                                   │
│     fcUSD Volt   12.4 shares                                      │
│     Estimated value: Unknown (check official recovery)           │
│                                                                   │
│  [Open Friktion Recovery →]                                      │
│                                                                   │
│  Friktion's protocol is still on-chain. Recovery may             │
│  be possible via their official recovery tool.                   │
└──────────────────────────────────────────────────────────────────┘
```

**Variant C — Urgent (winding_down)**
```
┌──────────────────────────────────────────────────────────────────┐
│  🚨  [Protocol Logo]  [Protocol Name]         URGENT — WITHDRAW  │
│                       Wind-down announced                         │
│                                                                   │
│  DEADLINE: [date or "as soon as possible"]                       │
│                                                                   │
│  Position found: X tokens — ~$XX.XX value                        │
│                                                                   │
│  This protocol is actively shutting down.                        │
│  Recovery becomes harder or impossible after wind-down.          │
│                                                                   │
│  ☑ Include in recovery                                           │
│  [Recover Now →]                                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Variant D — Confirmed Worthless (fully_dead)**
Shown in the `SafeToBurnSection` only, not in the main results.
```
  ✅  SBR (Saber Protocol Token)
      Protocol confirmed shut down. Token confirmed worthless.
      Safe to burn in Engine 3 to recover rent.
```

### 11.5 SafeToBurnSection.tsx

Shown at the bottom of results, after all recoverable items.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ SAFE TO BURN (confirmed worthless tokens)

These tokens are from protocols that are fully dead —
contracts confirmed empty. They hold no underlying value.
It is safe to use Engine 3 to burn them and recover rent.

  SBR (Saber governance token)    — Protocol dead, token worthless
  [other fully_dead tokens]

[Burn in Engine 3 →]             ← Links to /dust with pre-filter

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The "Burn in Engine 3" button should deep-link to `/dust` with the
fully-dead token mints pre-populated in the Engine 3 filter.
This is the hand-off between Engine 9 and Engine 3 — the "pairs naturally" part.

### 11.6 RecoveryModal.tsx — Confirm Before Recovering

```
🪦  RECOVER STRANDED POSITIONS

You are about to recover assets from decommissioned protocols.

  ↻  Saber USDC-USDT LP    ~$34.20   [in-app recovery]
  ↗  Friktion Volt          Unknown   [redirect to official site]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In-app recoveries:
  Estimated value:        ~$34.20
  Service fee (8%):       ~$2.74
  You receive:            ~$31.46

Note: Friktion will open in a new tab for manual recovery.

These assets were thought to be lost.
After recovery, they return directly to your wallet.

[Cancel]   [Recover →]
```

---

## PART 12 — HOMEPAGE NAV CARD

Add to homepage engine grid. Appears **before** Engine 3 (Dust Consolidator)
in visual order — this is a hard product requirement, not a suggestion.

```tsx
<EngineCard
  href="/decommission"
  icon="🪦"
  title="Protocol Monitor"
  description="Recover positions from dead DeFi protocols before they're gone"
  badge="NEW"
  urgencyIndicator={hasWindingDownProtocols}  // Red dot if winding_down exists
/>
```

**Nav order on homepage (full revised order):**
1. Permission Revocation (`/revoke`)       — Engine 1
2. Protocol Monitor (`/decommission`)      — Engine 9  ← NEW (before Engine 3)
3. Dust Consolidator (`/dust`)             — Engine 3
4. Rent Reclaimer (`/rent`)               — Engine 2
5. LP Fee Harvester (`/lp`)               — Engine 5
6. Staking & MEV (`/staking`)             — Engines 4 + 7
7. Airdrop Tracker (`/airdrops`)          — Engine 8

---

## PART 13 — ROUTING

```tsx
import { DecommissionPage } from './modules/decommission/components/DecommissionPage';

<Route path="/decommission" element={<DecommissionPage />} />
```

---

## PART 14 — CROSS-ENGINE INTEGRATION: ENGINE 3 SAFEGUARD

This is the most important integration point in the entire spec.

Engine 3 (Dust Consolidator) must NEVER suggest burning a token that is
in the dead protocol registry as `isRecoverable: true`.

Add to Engine 3's dust scanning logic:

```typescript
// In src/modules/dust/lib/dustScanner.ts
// Import the dead protocol registry
import { DEAD_PROTOCOLS } from '../decommission/registry/protocols';

// Build a set of mints that must never be burned
const PROTECTED_MINTS = new Set<string>(
  DEAD_PROTOCOLS
    .filter(p => p.isRecoverable)
    .flatMap(p => p.positionTokenMints.map(t => t.mint))
);

// In the dust scan function, before classifying a token as burnable:
if (PROTECTED_MINTS.has(token.mint)) {
  // This token is from a dead protocol with recoverable value
  // DO NOT include in dust results
  // DO include in a separate "check Protocol Monitor" warning
  continue;
}
```

**This cross-engine integration is the reason the two modules "pair naturally"
and is what makes SolHunt the "wallet guardian" — it protects users from
accidentally destroying recoverable value.**

---

## PART 15 — SECURITY REQUIREMENTS

**1. Registry as source of truth**
All protocol program IDs, token mints, and redirect URLs come exclusively
from the local registry. No external source can inject a malicious
program ID or redirect URL.

**2. Treasury wallet verification**
Service fee transfer verified as going to `VITE_TREASURY_WALLET` at tx build time.

**3. Instruction verification**
Every withdrawal instruction builder is explicitly stubbed until the
agent has verified the exact instruction from the protocol IDL.
DO NOT fabricate instruction data. Fabricated instruction data will
either fail silently (waste of user's fees) or — worst case — send
the user's tokens to the wrong account.

**4. Amount minimums**
Never build a recovery tx for a position with estimated value under
`DECOMMISSION_MIN_VALUE_USD` — gas cost would exceed recovered value.

**5. Program ID whitelist**
Add all dead protocol program IDs to the transaction instruction
whitelist, but only AFTER verifying each one from on-chain data.

**6. Redirect safety**
All `window.open` calls use `noopener`. Redirect URLs come only from
the registry — never from API responses or user input.

---

## PART 16 — ANALYTICS EVENTS

```typescript
logEvent('decommission_page_view');

logEvent('decommission_scan_started', {
  protocolCount: DEAD_PROTOCOLS.length,
});

logEvent('decommission_scan_complete', {
  positionsFound:    number,
  recoverableCount:  number,
  totalValueUSD:     number | null,
  windingDownCount:  number,
  protocolIds:       string[], // which dead protocols had matches
});

logEvent('decommission_recovery_initiated', {
  inAppCount:    number,
  redirectCount: number,
  totalValueUSD: number | null,
});

logEvent('decommission_recovery_complete', {
  recovered:   number,
  redirect:    number,
  failed:      number,
  valueUSD:    number | null,
});

logEvent('decommission_winding_down_banner_view', {
  protocolId:  string,
});

logEvent('decommission_safe_to_burn_click', {
  tokenCount:  number,
});
```

---

## PART 17 — ERROR MESSAGES

Add to `src/config/constants.ts`:

```typescript
DECOMMISSION_SCAN_FAILED:
  'Scan could not complete. Please check your connection and try again.',

DECOMMISSION_NO_POSITIONS:
  'No positions found from decommissioned protocols. '
  + 'You may still have unrelated dust — check Engine 3.',

DECOMMISSION_RECOVERY_FAILED:
  'Recovery transaction failed. Your position tokens are unaffected. '
  + 'Try again or use the official recovery link.',

DECOMMISSION_UNKNOWN_METHOD:
  'Recovery method for this protocol is not yet implemented. '
  + 'Check the official site for manual recovery.',

DECOMMISSION_VALUE_UNKNOWN:
  'Could not estimate value — try recovery to find out actual amount.',
```

---

## PART 18 — BUILD ORDER

1. Create `src/modules/decommission/registry/protocols.ts`
   — stub entries only, PLACEHOLDER mints
2. Create `src/modules/decommission/types.ts`
3. Create `src/modules/decommission/constants.ts`
4. Research and verify each protocol on Solscan:
   - Find real LP token mint addresses for Saber pools
   - Verify Saber AMM program ID: `SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ`
   - Find Friktion fToken mints and verify program ID
   - Find and verify Atrix and Aldrin program IDs
   - Find and verify Jet Protocol mint addresses
5. Update registry with real mints (replace all PLACEHOLDER values)
6. Create `src/modules/decommission/store/decommissionStore.ts`
7. Create `src/modules/decommission/lib/positionValueEstimator.ts`
8. Create `src/modules/decommission/lib/decommissionScanner.ts`
9. Create `src/modules/decommission/lib/withdrawalBuilder.ts`
   — stubs for now, implement Saber first (most widely held)
10. Verify Saber stable-swap remove_liquidity instruction from IDL:
    `https://github.com/saber-hq/stable-swap`
    Implement `buildSaberWithdrawInstruction` fully
11. Create `src/modules/decommission/hooks/useDecommissionScanner.ts`
12. Create all UI components (start with DecommissionPage + ScanPanel + EmptyState)
13. Create `DeadProtocolCard.tsx`, `PositionRow.tsx`
14. Create `RecoveryModal.tsx`
15. Create `SafeToBurnSection.tsx`
16. Create `WindingDownBanner.tsx`
17. Add route `/decommission` to router
18. Add nav card to homepage (before Engine 3 card)
19. **Engine 3 integration:** Add `PROTECTED_MINTS` check to dust scanner
20. Add error messages to shared constants
21. Add verified program IDs to security whitelist
22. TypeScript strict — zero `any`, zero errors
23. `npm run build` — clean build
24. Test scan on wallet with known Saber LP tokens
25. Test scan on wallet with NO dead protocol tokens — empty state
26. Test Engine 3 does NOT show Saber LP tokens in its burn list

---

## PART 19 — TESTING CHECKLIST

**Registry**
- [ ] All PLACEHOLDER mints replaced with real on-chain mints
- [ ] All program IDs verified from Solscan transaction history
- [ ] All `isRecoverable` flags are accurate (verified on-chain)

**Scanner**
- [ ] Correctly identifies Saber LP tokens in wallet
- [ ] Correctly returns nothing for wallet with no dead protocol tokens
- [ ] Protected mints excluded from Engine 3 dust scan
- [ ] LP token value estimation reads pool reserves correctly
- [ ] Empty result state displayed properly

**Withdrawal Builder**
- [ ] Saber `removeLiquidity` instruction built correctly (verified from IDL)
- [ ] Instruction discriminator verified — not fabricated
- [ ] Account ordering matches program IDL exactly
- [ ] Service fee goes to TREASURY_WALLET only
- [ ] Transaction builds without error

**UI**
- [ ] WindingDownBanner shown above everything when winding_down protocol in registry
- [ ] Card urgency levels display correctly (critical/high/normal/none)
- [ ] SafeToBurnSection lists only `fully_dead` protocol tokens
- [ ] "Burn in Engine 3" deep-link passes correct token mints
- [ ] RecoveryModal shows clear in-app vs redirect breakdown
- [ ] Homepage: Engine 9 card appears BEFORE Engine 3 card
- [ ] `/decommission` route loads without error

**Cross-engine**
- [ ] Engine 3 dust scanner respects `PROTECTED_MINTS`
- [ ] No Saber LP, fToken, or Atrix LP appears in Engine 3 burn suggestions
- [ ] TypeScript strict mode — zero errors
- [ ] `npm run build` — clean

---

## APPENDIX — THE WALLET GUARDIAN BRAND

Engine 1 + Engine 9 + Engine 3 together tell a complete story:

**Engine 1 — Permission Revocation:**
"These programs have permission to move your tokens. You didn't know.
We revoke the dangerous ones."

**Engine 9 — Protocol Decommission Monitor:**
"These tokens look dead. They're not. They represent real assets
locked in contracts that no longer have a UI. We rescue them."

**Engine 3 — Dust Consolidator:**
"These tokens ARE dead. Truly worthless. We burn them and give you
the rent back."

Three engines. One complete answer to every mystery token in a Solana wallet.
This is the "wallet guardian" brand: SolHunt sees what other tools miss,
protects what other tools would destroy, and recovers what users had
already written off.

No other Solana tool does all three. This is SolHunt's complete moat.

---

*End of SolHunt Engine 9 Specification*
*Protocol Decommission Monitor — Standalone Module*
*Route: /decommission · Own nav card · 8% service fee*
*Pairs with Engine 3 to complete the "wallet guardian" brand.*
*The engine for 20,000 Friktion wallets that don't know their money is still there.*
