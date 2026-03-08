# 💧 SolHunt — Engine 5: LP Fee Harvester
### Complete Specification for AI Agent Build
### Independent Module — Extends existing SolHunt codebase (Engines 1–4 already built)

---

## ⚠️ AGENT CONTEXT — READ FIRST

You are adding **Engine 5** to the SolHunt wallet recovery suite.

**Engines 1–4 are already built and working:**
- Engine 1: Permission Revocation
- Engine 2: Account Rent Reclaimer
- Engine 3: Dust Consolidator
- Engine 4: Staking Ticket Finder

**This engine is explicitly designed as an INDEPENDENT MODULE.**

What that means architecturally:
- Engine 5 has its own folder: `src/modules/lp-harvester/`
- It does NOT share lib files with other engines
- It has its own types, hooks, components, and logic — self-contained
- It connects to the app only via the Zustand store (one state slice) and ScanPage (one card component)
- This design allows it to be extracted into a standalone product later

**Do NOT touch or refactor any existing engine code.**
Follow the exact same security rules, naming conventions, and patterns established in the existing codebase.

---

## 1. What Engine 5 Does

### The Problem

When a user provides liquidity on Solana DEXes (Orca, Raydium, Meteora), they earn fees from every trade that passes through their pool. These fees accumulate inside the position but are NOT automatically sent to the user's wallet.

Most retail liquidity providers:
- Don't know they need to manually harvest fees
- Check their positions infrequently (weekly or monthly)
- Leave fees sitting idle for weeks — losing purchasing power
- Don't realize their fees don't compound unless manually reinvested

**Real numbers:**
A position earning 0.3% daily on $5,000 TVL = $15/day in fees. Left unharvested for 30 days = $450 sitting idle inside the pool doing nothing.

### What This Engine Does

1. **Scans** all three major DEXes (Orca Whirlpools, Raydium CLMM + Standard, Meteora DLMM) for LP positions owned by the connected wallet
2. **Shows** all positions with their unclaimed fee balances in token amounts and USD value
3. **Harvests** all fees in one batched operation — sends them to the user's wallet
4. **Optionally compounds** harvested fees back into the position (reinvests automatically via Jupiter)

### Fee Model

- **Harvest only:** 8% of harvested fee value (in SOL equivalent)
- **Harvest + compound:** 10% of harvested fee value
- Fee is collected as a SOL transfer after harvest completes
- Fee is based on actual harvested amount — never on estimates

### Why This Is Different From Kamino

Kamino auto-compounds but requires users to deposit into Kamino vaults — the user loses direct custody of their LP position. This engine harvests fees from **the user's own existing positions** without moving them anywhere. Zero custody. Zero trust required beyond the harvest instruction itself.

---

## 2. Understanding LP Positions on Solana

### 2.1 Orca Whirlpools (Concentrated Liquidity)

Orca uses the **Whirlpool** program — Solana's most widely used CLMM (Concentrated Liquidity Market Maker).

**Program ID:** `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`

**How positions work:**
- Each LP position is an NFT stored in the user's wallet
- The NFT mint corresponds to a **Position account** on-chain
- The Position account stores: liquidity, fee growth checkpoints, unclaimed fees in token A and token B
- To harvest fees: call `collectFees` instruction on the Whirlpool program
- After harvest, optionally call `updateFeesAndRewards` to refresh checkpoints

**Finding positions:**
```typescript
// Get all token accounts — filter for Whirlpool position NFTs
// Whirlpool position mints have exactly 1 supply and are owned by the Whirlpool program
// Use Orca's SDK: @orca-so/whirlpools-sdk

import { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpools-sdk';

const ctx = WhirlpoolContext.from(connection, wallet, ORCA_WHIRLPOOL_PROGRAM_ID);
const client = buildWhirlpoolClient(ctx);

// Fetch all positions for the wallet
const positions = await ctx.fetcher.getPositions(positionAddresses);
```

**Detecting unclaimed fees:**
```typescript
// Each position has:
position.feeOwedA  // Token A fees owed (u64)
position.feeOwedB  // Token B fees owed (u64)
// These are the raw unclaimed amounts — compare with current fee growth to get latest
```

**Harvest instruction:**
```typescript
// Use Orca SDK's collectFeesQuote + collectFees
import { collectFeesQuote } from '@orca-so/whirlpools-sdk';

const quote = collectFeesQuote({
  whirlpool: whirlpoolData,
  position: positionData,
  tickLower: tickLowerData,
  tickUpper: tickUpperData,
});

// quote.feeOwedA, quote.feeOwedB — the actual amounts
const { tx } = await whirlpool.collectFees(positionAddress);
```

### 2.2 Raydium CLMM

Raydium has two pool types — handle both:

**CLMM (Concentrated Liquidity):**
- Program ID: `CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK`
- Positions are stored as PDAs (not NFTs like Orca)
- SDK: `@raydium-io/raydium-sdk-v2`

**Standard AMM (Legacy pools):**
- Program ID: `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`
- LP tokens are SPL tokens held in user's wallet
- Fees are embedded in the pool — harvesting means withdrawing LP tokens

**Finding CLMM positions:**
```typescript
import { Raydium } from '@raydium-io/raydium-sdk-v2';

const raydium = await Raydium.load({ connection, owner: walletPublicKey });
const positions = await raydium.clmm.getOwnerPositionInfo({ programId: CLMM_PROGRAM_ID });
```

**Unclaimed fees on CLMM:**
```typescript
// Each position has:
position.tokenFeeAmountA  // Token A fees
position.tokenFeeAmountB  // Token B fees
```

**Harvest instruction (CLMM):**
```typescript
const { execute } = await raydium.clmm.collectReward({
  poolInfo,
  ownerPosition: positionInfo,
  ownerInfo: { useSOLBalance: true },
});
```

### 2.3 Meteora DLMM

Meteora uses **DLMM (Dynamic Liquidity Market Maker)** — a newer design.

**Program ID:** `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`

**How positions work:**
- Positions are stored as PDAs
- Each position can span multiple "bins" — the fee calculation is more complex
- SDK: `@meteora-ag/dlmm`

**Finding positions:**
```typescript
import DLMM from '@meteora-ag/dlmm';

// Get all DLMM positions for a wallet
const positions = await DLMM.getPositionsByUserAndLbPair(
  connection,
  walletPublicKey
);
```

**Unclaimed fees:**
```typescript
// Each position bin has pending fees
// Sum across all bins for total unclaimed
position.positionData.feeX  // Token X fees
position.positionData.feeY  // Token Y fees
```

**Harvest instruction:**
```typescript
const claimFeeTx = await dlmmPool.claimLMReward({
  owner: walletPublicKey,
  position: positionInfo,
});
```

---

## 3. Module File Structure

This engine lives entirely inside `src/modules/lp-harvester/`. 

```
src/modules/lp-harvester/
│
├── index.ts                          ← Public API — exports only what ScanPage needs
│
├── types.ts                          ← All Engine 5 types (self-contained)
├── constants.ts                      ← Engine 5 constants (self-contained)
│
├── lib/
│   ├── scanners/
│   │   ├── orcaScanner.ts            ← Orca Whirlpool position scanner
│   │   ├── raydiumScanner.ts         ← Raydium CLMM + AMM scanner
│   │   ├── meteoraScanner.ts         ← Meteora DLMM scanner
│   │   └── index.ts                  ← Orchestrates all scanners in parallel
│   │
│   ├── harvesters/
│   │   ├── orcaHarvester.ts          ← Build Orca harvest transactions
│   │   ├── raydiumHarvester.ts       ← Build Raydium harvest transactions
│   │   ├── meteoraHarvester.ts       ← Build Meteora harvest transactions
│   │   └── index.ts                  ← Orchestrates harvest execution
│   │
│   ├── pricer.ts                     ← Token price fetching (Jupiter Price API)
│   ├── feeCalculator.ts              ← Calculate service fees from harvest results
│   └── validator.ts                  ← Pre-transaction safety checks
│
├── hooks/
│   ├── useLPScanner.ts               ← Scan hook
│   ├── useLPHarvester.ts             ← Harvest execution hook
│   └── useLPStore.ts                 ← Zustand slice (local to this module)
│
├── components/
│   ├── LPHarvesterCard.tsx           ← Main card for ScanPage
│   ├── PositionRow.tsx               ← One row per LP position
│   ├── ProtocolSection.tsx           ← Groups positions by protocol
│   ├── HarvestConfirmModal.tsx       ← Confirm before harvesting
│   ├── HarvestProgressModal.tsx      ← Progress during harvest
│   ├── CompoundToggle.tsx            ← Option to auto-compound
│   └── PositionValueBadge.tsx        ← Shows fee value with color coding
│
└── utils/
    ├── formatting.ts                  ← LP-specific formatting helpers
    └── addresses.ts                   ← Known pool addresses, token lists
```

---

## 4. TypeScript Types

File: `src/modules/lp-harvester/types.ts`

```typescript
export type LPProtocol = 'orca' | 'raydium_clmm' | 'raydium_amm' | 'meteora';

export type PositionStatus =
  | 'in_range'      // Current price is within the position's price range
  | 'out_of_range'  // Price has moved outside range — not earning fees
  | 'full_range'    // AMM position — always earning
  | 'unknown';

export interface TokenAmount {
  mint: string;
  symbol: string;
  logoUri: string | null;
  rawAmount: string;       // As string to preserve precision
  uiAmount: number;        // Human readable
  decimals: number;
  valueUSD: number;        // 0 if price unavailable
}

export interface LPPosition {
  id: string;                        // Unique ID for React keys
  positionAddress: string;           // On-chain address of the position account
  protocol: LPProtocol;
  protocolDisplayName: string;
  poolAddress: string;               // The liquidity pool this position is in
  poolName: string;                  // e.g. "SOL/USDC" — derived from token symbols
  tokenA: string;                    // Mint address of token A
  tokenB: string;                    // Mint address of token B
  tokenASymbol: string;
  tokenBSymbol: string;
  
  // Unclaimed fees
  unclaimedFeeA: TokenAmount;
  unclaimedFeeB: TokenAmount;
  totalFeeValueUSD: number;          // Sum of both fees in USD
  totalFeeValueSOL: number;          // Converted to SOL for fee calculation
  
  // Position info
  status: PositionStatus;
  liquidityUSD: number;              // Total position value in USD (approximate)
  priceRangeLower: number | null;    // null for full-range AMM positions
  priceRangeUpper: number | null;
  currentPrice: number | null;
  
  // Metadata
  lastHarvestedAt: Date | null;      // null if never harvested or unknown
  isSelected: boolean;               // User can deselect positions they don't want to harvest
}

export interface LPScanResult {
  scannedAt: Date;
  positions: LPPosition[];
  totalPositions: number;
  positionsWithFees: number;         // Positions with > $0.01 in fees
  totalFeeValueUSD: number;
  totalFeeValueSOL: number;
  protocolBreakdown: {
    protocol: LPProtocol;
    positionCount: number;
    feeValueUSD: number;
  }[];
  protocolsScanned: LPProtocol[];
  protocolsWithErrors: LPProtocol[];
}

export interface HarvestEstimate {
  selectedPositions: number;
  totalFeeValueUSD: number;
  totalFeeValueSOL: number;
  serviceFeePercent: number;         // 8 or 10 depending on compound toggle
  serviceFeeSOL: number;
  networkFeeSOL: number;
  userReceivesValueUSD: number;
  willCompound: boolean;
}

export interface HarvestResultItem {
  positionId: string;
  positionAddress: string;
  protocol: LPProtocol;
  poolName: string;
  success: boolean;
  harvestedFeeA: TokenAmount | null;
  harvestedFeeB: TokenAmount | null;
  harvestedValueUSD: number;
  signature: string | null;
  errorMessage: string | null;
}

export interface HarvestResult {
  success: boolean;
  totalHarvested: number;            // Count of successful harvests
  totalFailed: number;
  totalValueUSD: number;
  totalValueSOL: number;
  serviceFeeSOL: number;
  feeSignature: string | null;
  items: HarvestResultItem[];
  compoundAttempted: boolean;
  compoundResult: CompoundResult | null;
}

export interface CompoundResult {
  success: boolean;
  tokensSwapped: number;
  solAddedToPositions: number;
  signatures: string[];
  errorMessage: string | null;
}

export type LPScanStatus =
  | 'idle'
  | 'scanning'
  | 'scan_complete'
  | 'error';

export type LPHarvestStatus =
  | 'idle'
  | 'awaiting_confirmation'
  | 'harvesting'
  | 'compounding'
  | 'sending_fee'
  | 'complete'
  | 'error';

export interface LPStoreState {
  scanStatus: LPScanStatus;
  scanResult: LPScanResult | null;
  scanError: string | null;
  harvestStatus: LPHarvestStatus;
  harvestResult: HarvestResult | null;
  harvestError: string | null;
  willCompound: boolean;
  selectedPositionIds: string[];
  currentProgressText: string;
  completedItems: HarvestResultItem[];
}
```

---

## 5. Constants

File: `src/modules/lp-harvester/constants.ts`

```typescript
// ─── PROGRAM IDS ──────────────────────────────────────────
export const ORCA_WHIRLPOOL_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
export const RAYDIUM_CLMM_PROGRAM_ID   = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
export const RAYDIUM_AMM_PROGRAM_ID    = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
export const METEORA_DLMM_PROGRAM_ID   = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

// ─── FEE STRUCTURE ────────────────────────────────────────
// Service fee: 8% of harvested value (harvest only)
export const HARVEST_FEE_PERCENT = 8;

// Service fee: 10% of harvested value (harvest + compound)
export const HARVEST_COMPOUND_FEE_PERCENT = 10;

// Minimum fee value to bother harvesting a position
// Positions with less than this are shown but auto-deselected
export const MIN_HARVEST_VALUE_USD = 0.50;

// Minimum fee value to show a position at all
export const MIN_DISPLAY_VALUE_USD = 0.01;

// Max positions to harvest per transaction batch
export const MAX_HARVEST_PER_TX = 3;  // LP harvest instructions are large

// ─── PROTOCOL DISPLAY INFO ────────────────────────────────
export const LP_PROTOCOL_INFO = {
  orca:         { displayName: 'Orca',    color: '#00C9A7', logoUri: '/logos/orca.png' },
  raydium_clmm: { displayName: 'Raydium', color: '#C200FB', logoUri: '/logos/raydium.png' },
  raydium_amm:  { displayName: 'Raydium', color: '#C200FB', logoUri: '/logos/raydium.png' },
  meteora:      { displayName: 'Meteora', color: '#00A3FF', logoUri: '/logos/meteora.png' },
};

// ─── KNOWN STABLE TOKENS (for fee display prioritization) ─
export const STABLE_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
]);

// ─── EPOCH / TIMING ───────────────────────────────────────
// Recommended harvest frequency — used in UI messaging
export const RECOMMENDED_HARVEST_DAYS = 7;
```

---

## 6. Scanner Logic

### 6.1 Orchestrator

File: `src/modules/lp-harvester/lib/scanners/index.ts`

```typescript
/**
 * Scan all supported DEXes for LP positions with unclaimed fees.
 * 
 * Runs all protocol scanners in PARALLEL via Promise.allSettled.
 * Failed protocols are recorded — others still complete.
 * 
 * After scanning, fetch token prices for all unique mints found.
 * Then calculate USD values for all positions.
 * 
 * Sort result: by totalFeeValueUSD descending (highest fees first).
 */
export async function scanAllLPPositions(
  walletAddress: string,
  connection: Connection
): Promise<LPScanResult>
```

Implementation flow:
```typescript
export async function scanAllLPPositions(walletAddress, connection) {
  const [orcaResult, raydiumResult, meteoraResult] = await Promise.allSettled([
    scanOrcaPositions(walletAddress, connection),
    scanRaydiumPositions(walletAddress, connection),
    scanMeteoraPositions(walletAddress, connection),
  ]);

  // Collect all positions from fulfilled results
  // Track which protocols errored
  
  // Get all unique token mints across all positions
  const allMints = extractUniqueMints(allPositions);
  
  // Fetch prices for all mints in one batch (Jupiter Price API)
  const prices = await fetchTokenPrices(allMints);
  
  // Apply prices to all positions
  const enrichedPositions = applyPricesToPositions(allPositions, prices);
  
  // Filter out positions with < MIN_DISPLAY_VALUE_USD
  // Sort by totalFeeValueUSD descending
  
  return buildScanResult(enrichedPositions, protocolsScanned, protocolsWithErrors);
}
```

### 6.2 Orca Scanner

File: `src/modules/lp-harvester/lib/scanners/orcaScanner.ts`

```typescript
export async function scanOrcaPositions(
  walletAddress: string,
  connection: Connection
): Promise<LPPosition[]>
```

Steps:
1. Install and import `@orca-so/whirlpools-sdk`
2. Create `WhirlpoolContext` with the connection and wallet
3. Find all Whirlpool position NFTs in the wallet:
   - Get all token accounts with balance = 1 (NFTs)
   - For each, check if the mint is a Whirlpool position mint
   - Whirlpool position mints have a specific metadata structure — use the SDK's `isWhirlpoolPositionMint()` helper or check against the Whirlpool program as authority
4. For each position NFT, fetch the Position account data
5. Fetch the parent Whirlpool pool data
6. Call `collectFeesQuote()` to get the actual unclaimed fee amounts
7. Get current price from the pool's `sqrtPrice`
8. Determine `PositionStatus` by comparing current tick vs position's tick range
9. Build and return `LPPosition[]`

**Handle positions with zero fees:** Include them in results but mark them clearly. User may want to see all their positions even if no fees to harvest yet.

**SDK initialization pattern:**
```typescript
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  collectFeesQuote,
  PDAUtil,
} from '@orca-so/whirlpools-sdk';
import { AnchorProvider } from '@coral-xyz/anchor';

const provider = new AnchorProvider(connection, wallet, {});
const ctx = WhirlpoolContext.from(connection, wallet, ORCA_WHIRLPOOL_PROGRAM_ID);
const client = buildWhirlpoolClient(ctx);
```

### 6.3 Raydium Scanner

File: `src/modules/lp-harvester/lib/scanners/raydiumScanner.ts`

```typescript
export async function scanRaydiumPositions(
  walletAddress: string,
  connection: Connection
): Promise<LPPosition[]>
```

Steps:
1. Install and import `@raydium-io/raydium-sdk-v2`
2. Initialize Raydium SDK
3. Scan for CLMM positions:
   ```typescript
   const clmmPositions = await raydium.clmm.getOwnerPositionInfo({
     programId: new PublicKey(RAYDIUM_CLMM_PROGRAM_ID)
   });
   ```
4. For each CLMM position: extract `tokenFeeAmountA`, `tokenFeeAmountB`
5. Scan for AMM (standard) LP tokens:
   - Get all token accounts
   - For each, check if the mint is a known Raydium AMM LP mint
   - Use Raydium's pool list API: `https://api.raydium.io/v2/sdk/liquidity/mainnet.json`
   - Cache this list — it's large. Fetch once per session, cache in module-level variable
6. For AMM positions: fees are embedded in the pool as price appreciation of LP tokens
   - Calculate current LP token value vs deposited value
   - Difference = accumulated fees (approximate)
7. Build and return `LPPosition[]` for both CLMM and AMM

**Note on AMM fee calculation:** Raydium standard AMM doesn't separate fees from the LP token value. The "fees" shown for AMM positions will be an approximation — label them clearly in the UI as "Estimated fees (AMM)" with a tooltip explaining they're embedded in LP token appreciation.

### 6.4 Meteora Scanner

File: `src/modules/lp-harvester/lib/scanners/meteoraScanner.ts`

```typescript
export async function scanMeteoraPositions(
  walletAddress: string,
  connection: Connection
): Promise<LPPosition[]>
```

Steps:
1. Install and import `@meteora-ag/dlmm`
2. Use Meteora's API to find positions:
   ```
   GET https://dlmm-api.meteora.ag/position/{walletAddress}
   ```
   This is more reliable than scanning `getProgramAccounts` for Meteora
3. For each position returned:
   - Fetch the actual position account from chain to verify it still exists
   - Sum `feeX` and `feeY` across all bins in the position
4. Fetch pool info to get token details and current price
5. Determine position status (in range vs out of range based on active bin)
6. Build and return `LPPosition[]`

**Meteora API fallback:** If the API is down, fall back to:
```typescript
const positions = await DLMM.getPositionsByUserAndLbPair(
  connection,
  new PublicKey(walletAddress)
);
```

### 6.5 Price Fetcher

File: `src/modules/lp-harvester/lib/pricer.ts`

```typescript
/**
 * Fetch USD prices for a list of token mints in one batch.
 * Uses Jupiter Price API v2.
 * Returns a Map<mintAddress, priceUSD>.
 * Tokens with no price data map to 0.
 * Never throws — returns empty map on complete failure.
 */
export async function fetchTokenPrices(
  mints: string[]
): Promise<Map<string, number>>
```

Implementation:
```typescript
export async function fetchTokenPrices(mints) {
  if (mints.length === 0) return new Map();
  
  // Jupiter price API accepts up to 100 mints per request
  // Batch if more than 100
  const batches = chunk(mints, 100);
  const priceMap = new Map<string, number>();
  
  for (const batch of batches) {
    try {
      const ids = batch.join(',');
      const res = await fetch(`https://price.jup.ag/v2/price?ids=${ids}`);
      const data = await res.json();
      
      for (const [mint, info] of Object.entries(data.data || {})) {
        priceMap.set(mint, (info as any).price ?? 0);
      }
    } catch {
      // Continue — partial price data is better than none
    }
    
    // Rate limit respect
    if (batches.length > 1) await sleep(200);
  }
  
  return priceMap;
}
```

---

## 7. Harvester Logic

### 7.1 Orchestrator

File: `src/modules/lp-harvester/lib/harvesters/index.ts`

```typescript
/**
 * Execute harvest for all selected positions.
 * 
 * Routing: Each position is sent to its protocol-specific harvester.
 * Execution: Sequential per position (LP harvest txs are large — don't batch across protocols)
 * Within same protocol: can batch up to MAX_HARVEST_PER_TX positions per transaction
 * 
 * Progress updates: Emit progress after each position completes via callback.
 * Partial success: If one position fails, continue with others.
 * Fee collection: After all harvests complete, send one fee transaction.
 * Compound (if enabled): After fee collection, run compound logic.
 */
export async function harvestAllPositions(
  positions: LPPosition[],
  willCompound: boolean,
  walletPublicKey: PublicKey,
  signTransaction: WalletContextState['signTransaction'],
  sendTransaction: WalletContextState['sendTransaction'],
  connection: Connection,
  onProgress: (item: HarvestResultItem) => void
): Promise<HarvestResult>
```

### 7.2 Orca Harvester

File: `src/modules/lp-harvester/lib/harvesters/orcaHarvester.ts`

```typescript
export async function buildOrcaHarvestTransaction(
  positions: LPPosition[],
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<Transaction>
```

```typescript
// For each Orca position:
const whirlpool = await client.getPool(poolAddress);
const position = await client.getPosition(positionAddress);

// Build collect fees transaction
const collectTx = await whirlpool.collectFees(positionAddress);

// Orca SDK returns a TransactionBuilder — extract the transaction
const tx = collectTx.build();
```

**Important Orca detail:** Orca's `collectFees` instruction requires that token accounts for both tokenA and tokenB exist in the user's wallet. Check for their existence before building the transaction. If a token account doesn't exist, add a `createAssociatedTokenAccount` instruction before the `collectFees` instruction.

### 7.3 Raydium Harvester

File: `src/modules/lp-harvester/lib/harvesters/raydiumHarvester.ts`

```typescript
export async function buildRaydiumHarvestTransaction(
  positions: LPPosition[],
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<Transaction>
```

For CLMM positions:
```typescript
const { execute } = await raydium.clmm.collectReward({
  poolInfo: poolData,
  ownerPosition: positionData,
  ownerInfo: {
    useSOLBalance: true,
    feePayer: walletPublicKey,
  },
});
```

For AMM positions:
```typescript
// AMM doesn't have a separate "collect fees" instruction
// Fees are claimed by withdrawing LP tokens
// For harvest-only mode: show as "view only" — can't harvest without withdrawing
// For compound mode: withdraw → reinvest is the compound cycle
```

**Important:** For Raydium AMM (standard), fees cannot be harvested independently of the LP position. In the UI, show AMM positions in a separate "Standard AMM" section with a note: "AMM fees are collected when you withdraw liquidity. Use the compound feature to reinvest them."

### 7.4 Meteora Harvester

File: `src/modules/lp-harvester/lib/harvesters/meteoraHarvester.ts`

```typescript
export async function buildMeteoraHarvestTransaction(
  position: LPPosition,
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<Transaction>
```

```typescript
const dlmmPool = await DLMM.create(connection, new PublicKey(position.poolAddress));

const claimFeeTx = await dlmmPool.claimLMReward({
  owner: walletPublicKey,
  position: {
    publicKey: new PublicKey(position.positionAddress),
    positionData: positionData,
  },
});
```

### 7.5 Fee Collection After Harvest

File: `src/modules/lp-harvester/lib/feeCalculator.ts`

```typescript
/**
 * Calculate and send the service fee after harvest completes.
 * Fee is based on ACTUAL harvested value — not estimates.
 * 
 * To calculate fee in SOL:
 *   1. Sum all harvestedValueUSD across successful items
 *   2. Convert USD to SOL using current SOL price (Jupiter price API)
 *   3. Apply fee percent (8% or 10%)
 *   4. Send SystemProgram.transfer to TREASURY_WALLET
 */
export async function collectServiceFee(
  harvestResult: Omit<HarvestResult, 'feeSignature'>,
  willCompound: boolean,
  walletPublicKey: PublicKey,
  signTransaction: WalletContextState['signTransaction'],
  connection: Connection
): Promise<string>  // Returns signature
```

### 7.6 Compound Logic (Optional)

If user enables "Auto-compound" before harvesting:

File: `src/modules/lp-harvester/lib/harvesters/index.ts` (compound section)

```typescript
/**
 * After harvesting fees, optionally compound them back into positions.
 * 
 * Compound flow per position:
 *   1. Harvested fees are now in user's wallet as tokenA and tokenB
 *   2. If fees are not in the correct ratio for the pool:
 *      - Use Jupiter to swap half of one token to the other
 *      - This brings them to approximately 50/50 ratio
 *   3. Add the tokens back to the position as additional liquidity
 * 
 * This is a best-effort operation:
 *   - If compounding one position fails, continue with others
 *   - Report partial compound success
 *   - Never block the harvest result over a failed compound
 * 
 * Only attempt compound for positions that are IN RANGE.
 * Out-of-range positions cannot receive new liquidity efficiently.
 */
async function compoundHarvestedFees(
  positions: LPPosition[],
  harvestItems: HarvestResultItem[],
  walletPublicKey: PublicKey,
  signTransaction: WalletContextState['signTransaction'],
  connection: Connection
): Promise<CompoundResult>
```

---

## 8. React Hooks

### 8.1 useLPStore

File: `src/modules/lp-harvester/hooks/useLPStore.ts`

Local Zustand store — scoped to this module. Connects to the global app store only for the treasury wallet address and SOL price.

```typescript
import { create } from 'zustand';

export const useLPStore = create<LPStoreState & LPStoreActions>((set, get) => ({
  // Initial state
  scanStatus: 'idle',
  scanResult: null,
  scanError: null,
  harvestStatus: 'idle',
  harvestResult: null,
  harvestError: null,
  willCompound: false,
  selectedPositionIds: [],
  currentProgressText: '',
  completedItems: [],

  // Actions
  setScanStatus: (status) => set({ scanStatus: status }),
  setScanResult: (result) => set({
    scanResult: result,
    selectedPositionIds: result.positions
      .filter(p => p.totalFeeValueUSD >= MIN_HARVEST_VALUE_USD)
      .map(p => p.id)
  }),
  togglePosition: (id) => set(state => ({
    selectedPositionIds: state.selectedPositionIds.includes(id)
      ? state.selectedPositionIds.filter(x => x !== id)
      : [...state.selectedPositionIds, id]
  })),
  setWillCompound: (val) => set({ willCompound: val }),
  addCompletedItem: (item) => set(state => ({
    completedItems: [...state.completedItems, item]
  })),
  resetHarvest: () => set({
    harvestStatus: 'idle',
    harvestResult: null,
    harvestError: null,
    completedItems: [],
  }),
  resetAll: () => set({
    scanStatus: 'idle',
    scanResult: null,
    scanError: null,
    harvestStatus: 'idle',
    harvestResult: null,
    harvestError: null,
    willCompound: false,
    selectedPositionIds: [],
    completedItems: [],
  }),
}));
```

### 8.2 useLPScanner

File: `src/modules/lp-harvester/hooks/useLPScanner.ts`

```typescript
export function useLPScanner() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const store = useLPStore();

  const runScan = useCallback(async () => {
    if (!publicKey) return;

    store.setScanStatus('scanning');
    store.setScanError(null);

    try {
      const result = await scanAllLPPositions(
        publicKey.toString(),
        connection
      );
      store.setScanResult(result);
      store.setScanStatus('scan_complete');

      // Log to Firebase
      logEvent('lp_scan_complete', {
        positionCount: result.totalPositions,
        positionsWithFees: result.positionsWithFees,
        totalFeeValueUSD: result.totalFeeValueUSD,
        protocolsScanned: result.protocolsScanned.length,
      });
    } catch (err: any) {
      store.setScanStatus('error');
      store.setScanError('Could not scan LP positions. Please try again.');
    }
  }, [publicKey, connection]);

  return {
    scanStatus: store.scanStatus,
    scanResult: store.scanResult,
    scanError: store.scanError,
    runScan,
  };
}
```

### 8.3 useLPHarvester

File: `src/modules/lp-harvester/hooks/useLPHarvester.ts`

```typescript
export function useLPHarvester() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const store = useLPStore();

  const selectedPositions = useMemo(() => {
    return store.scanResult?.positions.filter(
      p => store.selectedPositionIds.includes(p.id)
    ) ?? [];
  }, [store.scanResult, store.selectedPositionIds]);

  const harvestEstimate = useMemo((): HarvestEstimate | null => {
    if (selectedPositions.length === 0) return null;
    // Calculate estimate from selected positions
    // Apply correct fee percent based on willCompound
  }, [selectedPositions, store.willCompound]);

  const initiateHarvest = useCallback(() => {
    if (selectedPositions.length === 0) return;
    store.setHarvestStatus('awaiting_confirmation');
  }, [selectedPositions]);

  const executeHarvest = useCallback(async () => {
    if (!publicKey || !signTransaction || !sendTransaction) return;

    store.setHarvestStatus('harvesting');

    try {
      const result = await harvestAllPositions(
        selectedPositions,
        store.willCompound,
        publicKey,
        signTransaction,
        sendTransaction,
        connection,
        (item) => store.addCompletedItem(item)  // Progress callback
      );

      store.setHarvestResult(result);
      store.setHarvestStatus('complete');

      logEvent('lp_harvest_complete', {
        success: result.success,
        harvestedCount: result.totalHarvested,
        totalValueUSD: result.totalValueUSD,
        compounded: result.compoundAttempted,
      });
    } catch (err: any) {
      store.setHarvestStatus('error');
      store.setHarvestError('Harvest failed. Please try again.');
    }
  }, [publicKey, signTransaction, sendTransaction, selectedPositions, store]);

  return {
    selectedPositions,
    harvestEstimate,
    harvestStatus: store.harvestStatus,
    harvestResult: store.harvestResult,
    harvestError: store.harvestError,
    willCompound: store.willCompound,
    completedItems: store.completedItems,
    togglePosition: store.togglePosition,
    setWillCompound: store.setWillCompound,
    initiateHarvest,
    executeHarvest,
    cancelHarvest: () => store.setHarvestStatus('idle'),
  };
}
```

---

## 9. UI Components

### 9.1 LPHarvesterCard

File: `src/modules/lp-harvester/components/LPHarvesterCard.tsx`

The main card rendered in ScanPage. Has its own internal scan state.

**State: Idle**
```
💧 LP FEE HARVESTER

Collect unclaimed fees from your Orca, Raydium,
and Meteora liquidity positions.

[Scan LP Positions]

Checks 3 DEXes · Takes 10–30 seconds
```

**State: Scanning**
```
💧 SCANNING YOUR LP POSITIONS...

  ⏳ Orca Whirlpools
  ⏳ Raydium
  ⏳ Meteora
```
Update each line to ✅ as each protocol completes.

**State: Complete — No Positions**
```
💧 NO LP POSITIONS FOUND

You don't have any active liquidity positions
on Orca, Raydium, or Meteora.
```

**State: Complete — Positions Found, No Fees**
```
💧 LP POSITIONS FOUND — NO FEES YET

  3 active positions scanned
  No unclaimed fees at this time.

  [Rescan]  ← small, secondary button
```

**State: Complete — Fees Found**
```
💧 UNCLAIMED LP FEES FOUND

  [ProtocolSection for each protocol with positions]

  ────────────────────────────────────────────────
  
  ☐ Auto-compound harvested fees  [CompoundToggle]
  
  Selected: 4 positions  · Total: $34.20

  Service fee (8%):    -$2.74
  You receive:         ~$31.46

  [Harvest X Positions →]
```

### 9.2 ProtocolSection

Groups positions by protocol with a collapsible header.

```
▼ ORCA  (3 positions · $28.40 in fees)
  [PositionRow]
  [PositionRow]
  [PositionRow]

▼ RAYDIUM  (1 position · $5.80 in fees)
  [PositionRow]

▶ METEORA  (2 positions · $0.00 in fees)  ← collapsed by default if no fees
```

### 9.3 PositionRow

One row per LP position.

```
☑  [Token A logo][Token B logo]  SOL/USDC      Orca
   Range: $148.20 – $195.00     🟢 In Range
   
   Unclaimed fees:
   0.042 SOL  ($6.30)  +  12.50 USDC  ($12.50)
   
   Total: $18.80                          [PositionValueBadge: $18.80]
```

Fields:
- Checkbox (to include/exclude from harvest)
- Token pair logos + symbols
- Protocol badge
- Price range (for CLMM) or "Full Range" (for AMM)
- Status badge: 🟢 In Range / 🔴 Out of Range / ⚪ Full Range
- Unclaimed fee amounts for each token with USD values
- Total fee value (prominent)
- If `lastHarvestedAt` known: small text "Last harvested 14 days ago"

**Out of Range positions:** Show with slightly dimmed styling and a tooltip: "This position is out of range and not currently earning fees. You can still harvest existing unclaimed fees."

### 9.4 CompoundToggle

A toggle with an explanation tooltip:

```
☐ Auto-compound harvested fees (+2% service fee)
  ℹ️  Reinvests fees back into your positions automatically.
      Earns more over time. Fee increases from 8% to 10%.
```

When enabled, the fee section in the card updates to show 10%.

### 9.5 HarvestConfirmModal

```
You are about to harvest fees from X LP positions.

POSITIONS:
  SOL/USDC (Orca)          $18.80
  RAY/USDC (Raydium CLMM)   $8.40
  SOL/USDT (Meteora)        $7.00
  ─────────────────────────────────
  Total fees:               $34.20

[Auto-compound: OFF]

COST BREAKDOWN:
  Service fee (8%):     -$2.74
  Network fees:        ~$0.15
  ──────────────────────────────
  You receive:         ~$31.31

Fees will be sent to your wallet as the original tokens
(SOL, USDC, etc.) — not converted to SOL.

[Cancel]   [Harvest $31.31 in Fees →]
```

**If compound is ON**, change the last line to:
"Fees will be reinvested back into your positions as additional liquidity."

### 9.6 HarvestProgressModal

Shows per-position progress — non-dismissible during execution.

```
Harvesting your LP fees...

✅ SOL/USDC (Orca)         $18.80  [View ↗]
✅ RAY/USDC (Raydium)       $8.40  [View ↗]
⏳ SOL/USDT (Meteora)... (awaiting signature)
○  Collecting service fee...

Do not close this window.
```

Success state:
```
🎉 Harvest Complete!

  Collected from 3 positions:
  ✅ SOL/USDC       0.042 SOL + 12.50 USDC
  ✅ RAY/USDC       8.40 USDC
  ✅ SOL/USDT       7.00 USDT

  Total value:      ~$34.20
  Service fee:      ~$2.74
  Net to you:       ~$31.46

  [View All Transactions ↗]
  [Done]
```

---

## 10. ScanPage Integration

File: `src/pages/ScanPage.tsx`

Import ONLY the public API from the module:
```typescript
import { LPHarvesterCard } from '@/modules/lp-harvester';
```

Add after Engine 4 (Staking Tickets) and before the Summary Card:

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
│  🎫  STAKING TICKETS — [Engine 4]                          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  💧  LP FEE HARVESTER — [Engine 5] ← NEW                   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  📊  TOTAL RECOVERABLE — [Summary Card]                    │
└─────────────────────────────────────────────────────────────┘
```

**Update Summary Card** to include LP fees if scan has been run:
```typescript
const lpFeeValue = lpScanResult?.totalFeeValueUSD ?? null;
// If null: show "LP fees: [Scan to find]" with link
// If 0: show "LP fees: $0.00"
// If > 0: include in total
```

Engine 5 scan is **independent** — user triggers it separately. Same pattern as Engine 4.

---

## 11. Module Public API

File: `src/modules/lp-harvester/index.ts`

Export ONLY what ScanPage needs. Everything else stays private to the module.

```typescript
// Public API — the only file ScanPage imports from
export { LPHarvesterCard } from './components/LPHarvesterCard';
export type { LPScanResult, HarvestResult } from './types';

// Do NOT export internal scanners, harvesters, or store
// Those are implementation details
```

---

## 12. New npm Dependencies

```bash
# Orca SDK
npm install @orca-so/whirlpools-sdk @coral-xyz/anchor

# Raydium SDK
npm install @raydium-io/raydium-sdk-v2

# Meteora DLMM SDK
npm install @meteora-ag/dlmm

# Decimal.js — for precise fee calculations (LP math requires precision)
npm install decimal.js
```

**Note on bundle size:** These SDKs are large. Make sure Vite's `manualChunks` in `vite.config.ts` is updated to split them into their own chunks:
```typescript
manualChunks: {
  // existing chunks...
  'lp-orca':    ['@orca-so/whirlpools-sdk'],
  'lp-raydium': ['@raydium-io/raydium-sdk-v2'],
  'lp-meteora': ['@meteora-ag/dlmm'],
}
```

---

## 13. Security Requirements

All existing security rules apply. Additional rules for Engine 5:

**1. Never modify position parameters.**
The only allowed write operations are `collectFees`, `claimReward`, and `withdraw` instructions. Never build instructions that modify position range, liquidity amounts, or pool configuration.

**2. Verify harvest amounts before signing.**
Before submitting each harvest transaction, verify the expected output amounts match the scan data within 5%. If the position's fee amounts changed significantly since the scan (price movement), warn the user and allow them to re-scan before proceeding.

**3. Cap warning for large harvests.**
If total harvest value > $500, show extra confirmation: "You are harvesting more than $500 in LP fees. Please verify your positions before proceeding."

**4. Compound safety.**
If compound is enabled and a Jupiter swap fails during compounding, do NOT retry automatically. Report the failure and let the user decide. Never loop on failed swaps.

**5. Out-of-range compound guard.**
Never attempt to add liquidity to an out-of-range position during compounding. The transaction would succeed but be economically wasteful. Check position status before each compound instruction.

**6. SDK version pinning.**
Pin exact versions of all three DEX SDKs in `package.json` (use exact versions, not `^`). DEX SDKs change frequently and breaking changes have occurred without major version bumps. Example:
```json
"@orca-so/whirlpools-sdk": "0.13.12",
"@raydium-io/raydium-sdk-v2": "2.0.0-beta.5",
"@meteora-ag/dlmm": "1.1.7"
```
Check npm for the latest stable version at build time and pin to that.

---

## 14. Firebase Analytics Events

File: `src/lib/analytics.ts` — append:

```typescript
logEvent('lp_scan_started', { timestamp: Date.now() });

logEvent('lp_scan_complete', {
  positionCount: number,
  positionsWithFees: number,
  totalFeeValueUSD: number,
  protocolBreakdown: { orca: number, raydium: number, meteora: number },
  protocolsWithErrors: number,
});

logEvent('lp_harvest_initiated', {
  positionCount: number,
  totalFeeValueUSD: number,
  willCompound: boolean,
});

logEvent('lp_harvest_complete', {
  success: boolean,
  harvestedCount: number,
  failedCount: number,
  totalValueUSD: number,
  compoundAttempted: boolean,
  compoundSuccess: boolean,
  feeSOL: number,
});
```

---

## 15. New Error Messages

Append to global error constants or handle within module:

```typescript
LP_SCAN_FAILED:        'Could not scan LP positions. Please try again.',
ORCA_SCAN_FAILED:      'Orca positions could not be loaded. Other DEXes were still scanned.',
RAYDIUM_SCAN_FAILED:   'Raydium positions could not be loaded.',
METEORA_SCAN_FAILED:   'Meteora positions could not be loaded.',
LP_HARVEST_FAILED:     'Harvest failed. Your positions were not affected.',
LP_HARVEST_PARTIAL:    'Some positions were harvested. Check details below.',
LP_COMPOUND_FAILED:    'Fees were harvested but compounding failed. Your fees are in your wallet.',
LP_POSITION_CHANGED:   'Position changed since last scan. Please re-scan before harvesting.',
LP_OUT_OF_RANGE:       'This position is out of range and cannot be compounded.',
```

---

## 16. Build Order for Agent

Build Engine 5 in this exact order:

1. **Dependencies** — Install all 3 DEX SDKs + decimal.js, update vite.config.ts chunks
2. **Types** — Create `src/modules/lp-harvester/types.ts`
3. **Constants** — Create `src/modules/lp-harvester/constants.ts`
4. **Pricer** — `src/modules/lp-harvester/lib/pricer.ts` (used by scanners)
5. **Orca scanner** — `orcaScanner.ts` (build and test independently)
6. **Raydium scanner** — `raydiumScanner.ts`
7. **Meteora scanner** — `meteoraScanner.ts`
8. **Scanner orchestrator** — `src/modules/lp-harvester/lib/scanners/index.ts`
9. **Orca harvester** — `orcaHarvester.ts`
10. **Raydium harvester** — `raydiumHarvester.ts`
11. **Meteora harvester** — `meteoraHarvester.ts`
12. **Fee calculator** — `feeCalculator.ts`
13. **Harvester orchestrator** — `src/modules/lp-harvester/lib/harvesters/index.ts`
14. **Zustand store** — `useLPStore.ts`
15. **Hooks** — `useLPScanner.ts` then `useLPHarvester.ts`
16. **UI components** — In order: `PositionValueBadge`, `CompoundToggle`, `PositionRow`, `ProtocolSection`, `HarvestConfirmModal`, `HarvestProgressModal`, `LPHarvesterCard`
17. **Module index** — `src/modules/lp-harvester/index.ts` (public API)
18. **ScanPage integration** — Import LPHarvesterCard, update summary card
19. **Analytics** — Add Firebase events
20. **Bundle check** — Verify `npm run build` output — lp chunks should be separate
21. **TypeScript check** — `tsc --noEmit` must pass with zero errors

---

## 17. Testing Checklist

**Scanner**
- [ ] Orca positions detected for a wallet with known Orca positions
- [ ] Raydium CLMM positions detected
- [ ] Meteora positions detected
- [ ] Positions with zero fees still appear (but auto-deselected)
- [ ] USD values populated correctly via Jupiter price API
- [ ] Out-of-range positions correctly identified with status badge
- [ ] Protocol scan failure doesn't crash entire scan
- [ ] Wallet with no LP positions shows "none found" state

**Harvest Flow**
- [ ] Confirm modal shows correct fee breakdown
- [ ] Compound toggle changes fee percent from 8% to 10%
- [ ] Individual positions can be deselected
- [ ] Harvest executes successfully for Orca position
- [ ] Harvest executes successfully for Raydium position
- [ ] Harvest executes successfully for Meteora position
- [ ] Progress modal updates per-position in real time
- [ ] Fee transaction fires after all harvests complete
- [ ] Fee equals correct % of ACTUAL harvested value
- [ ] Partial success case: completed harvests shown, failed shown separately
- [ ] Compound flow executes after successful harvest (if enabled)
- [ ] User can cancel at confirm modal without any transaction sent

**Module Independence**
- [ ] Engine 5 can be imported and rendered alone (no other engine required)
- [ ] Module only imports from its own folder + @solana packages + zustand
- [ ] No imports from other engine lib files
- [ ] `src/modules/lp-harvester/index.ts` only exports LPHarvesterCard and types

**Build**
- [ ] `npm run build` succeeds
- [ ] LP SDK chunks appear separately in dist/assets/
- [ ] Total bundle size increase from Engine 5 < 800KB gzipped
- [ ] `tsc --noEmit` passes with zero errors

---

*End of Engine 5 Specification*
*Version 1.0 — Independent module extending SolHunt (Engines 1–4 already built)*
