# 🗑️ SolHunt — Engine 6: cNFT Spam Cleaner
### Complete Specification for AI Agent Build
### Independent Module — Extends existing SolHunt codebase (Engines 1–5 already built)

---

## ⚠️ AGENT CONTEXT — READ FIRST

You are adding **Engine 6** to the SolHunt wallet recovery suite.

**Engines 1–5 are already built and working:**
- Engine 1: Permission Revocation
- Engine 2: Account Rent Reclaimer
- Engine 3: Dust Consolidator
- Engine 4: Staking Ticket Finder
- Engine 5: LP Fee Harvester

**This engine is an INDEPENDENT MODULE** — same architecture as Engine 5.

Module location: `src/modules/cnft-cleaner/`

It connects to the app only via:
- One card component imported into ScanPage
- One shared analytics call to Firebase

**Do NOT touch or refactor any existing engine code.**
Follow all existing security rules, naming conventions, and patterns.

---

## 1. What Engine 6 Does

### The Problem

**Compressed NFTs (cNFTs)** are NFTs minted using Metaplex's Bubblegum program and stored in on-chain Merkle trees. They cost almost nothing to mint (fractions of a cent vs ~0.012 SOL for standard NFTs), which means:

- Projects airdrop millions of cNFTs to random wallets — spam, promotions, fake collections
- Scammers mint fake cNFTs impersonating real collections and airdrop them to targeted wallets
- DeFi protocols issue cNFTs as receipts, badges, or proof-of-participation tokens that become worthless over time
- Gaming and loyalty programs distribute cNFTs that pile up unused

**The result:** Active Solana wallets accumulate hundreds — sometimes thousands — of cNFTs they never asked for, never want, and can't easily remove. Most wallet UIs render them poorly or not at all, so users don't even know they have them.

**The difference from standard NFTs:**
Standard NFTs are SPL token accounts — Engine 2 and Engine 3 already handle those. cNFTs are stored differently: they live inside shared **Merkle trees** on-chain, not in individual token accounts. They require different instructions to burn (the Bubblegum `burn` instruction with a Merkle proof).

### What This Engine Does

1. **Scans** the wallet for all cNFTs using the Helius DAS API
2. **Scores** each cNFT: verified collection, floor price, metadata quality, spam signals
3. **Categorizes** into: Spam, Low Value, Potentially Valuable, and Keep (verified collections)
4. **Burns** selected cNFTs in batches — returns a small SOL fee per burn to the user
5. Shows user a cleaner, lighter wallet

### Revenue Model

Two revenue streams:

**Stream A — Burn fee:**
Each cNFT account has a tiny amount of SOL locked in the Merkle tree leaf. When burned, the tree's canopy SOL is partially returned. This is very small (~0.000001 SOL per cNFT) but multiplied by hundreds of burns it adds up.
- Take **20% of any recovered lamports** from burns
- On 500 cNFT burns: ~0.0005 SOL recovered total, your cut ~0.0001 SOL (negligible alone)

**Stream B — Flat session fee:**
Charge a flat **0.005 SOL per burn session** (regardless of how many cNFTs are burned) as a service fee for the scan + categorization + batch burn.
- Shown clearly before user confirms
- Primary revenue mechanism for this engine
- 1,000 sessions/month = 5 SOL/month

**Why flat fee makes sense here:** The recovered lamports from cNFT burns are tiny. The real value to the user is the clean wallet + spam removal, not SOL recovery. Flat fee is transparent and fair.

---

## 2. Understanding cNFTs on Solana

### 2.1 Metaplex Bubblegum Program

**Program ID:** `BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY`

cNFTs are stored in **concurrent Merkle trees** — shared data structures that can hold millions of compressed assets. Key concepts:

- **Asset ID:** Each cNFT has a unique asset ID (a public key) — this is what wallets display
- **Leaf:** Each cNFT is one leaf in a Merkle tree
- **Proof:** To perform any operation on a cNFT (transfer, burn), you need a Merkle proof — the path from the leaf to the tree root
- **Tree Authority:** The account that controls the Merkle tree
- **Canopy:** A cached portion of the Merkle tree stored on-chain to reduce proof size

### 2.2 Why Burns Need Proofs

Unlike standard NFT burning (which just closes a token account), burning a cNFT requires:
1. The asset ID
2. The current Merkle tree state
3. A proof path (array of 3–24 pubkeys depending on tree depth)
4. The leaf index within the tree

This proof data is NOT stored in the user's wallet — it must be fetched from an indexer. This is why the **Helius DAS API** is essential — it provides both the asset data AND the proof needed to burn.

### 2.3 Helius DAS API

DAS = Digital Asset Standard. Helius implements the full DAS API spec.

**Key endpoints:**

```
# Get all assets owned by a wallet
POST https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
Body: {
  "jsonrpc": "2.0",
  "id": "1",
  "method": "getAssetsByOwner",
  "params": {
    "ownerAddress": "<wallet>",
    "page": 1,
    "limit": 1000,
    "displayOptions": {
      "showCollectionMetadata": true,
      "showUnverifiedCollections": true,
      "showNativeBalance": false
    }
  }
}

# Get proof for a specific asset (needed to burn)
POST https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
Body: {
  "jsonrpc": "2.0",
  "id": "1",
  "method": "getAssetProof",
  "params": { "id": "<asset_id>" }
}
```

**DAS Asset response shape (important fields):**
```typescript
interface DASAsset {
  id: string;                    // Asset ID (public key string)
  interface: string;             // "V1_NFT" | "V1_PRINT" | "LEGACY_NFT" | "FungibleAsset" etc.
  compression: {
    eligible: boolean;           // Is this a cNFT?
    compressed: boolean;
    data_hash: string;
    creator_hash: string;
    asset_hash: string;
    tree: string;                // Merkle tree address
    seq: number;
    leaf_id: number;             // Leaf index in tree
  };
  grouping: Array<{
    group_key: string;           // "collection"
    group_value: string;         // Collection mint address
    verified: boolean;           // ← KEY: Is this a verified Metaplex collection?
  }>;
  content: {
    $schema: string;
    json_uri: string;            // Metadata URI
    metadata: {
      name: string;
      symbol: string;
      description: string;
    };
    files: Array<{ uri: string; mime: string }>;
    links: { image: string | null };
  };
  authorities: Array<{ address: string; scopes: string[] }>;
  creators: Array<{ address: string; share: number; verified: boolean }>;
  royalty: { basis_points: number; primary_sale_happened: boolean };
  supply: { print_max_supply: number; print_current_supply: number };
  mutable: boolean;
  burnt: boolean;
}
```

**Filter for cNFTs only:**
```typescript
// A cNFT has compression.compressed === true
// Standard NFTs have compression.compressed === false or compression field absent
const isCompressed = asset.compression?.compressed === true;
```

### 2.4 Bubblegum Burn Instruction

```typescript
import {
  createBurnInstruction,
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
} from '@metaplex-foundation/mpl-bubblegum';

// Build burn instruction
const burnIx = createBurnInstruction(
  {
    treeAuthority: treeAuthorityPDA,
    leafOwner: walletPublicKey,
    leafDelegate: walletPublicKey,   // Same as owner if not delegated
    merkleTree: new PublicKey(asset.compression.tree),
    logWrapper: SPL_NOOP_PROGRAM_ID,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  },
  {
    root: [...Buffer.from(proof.root, 'base64')],
    dataHash: [...Buffer.from(asset.compression.data_hash, 'base64')],
    creatorHash: [...Buffer.from(asset.compression.creator_hash, 'base64')],
    nonce: asset.compression.leaf_id,
    index: asset.compression.leaf_id,
  }
);

// Add proof accounts as remaining accounts
burnIx.keys.push(
  ...proof.proof.map(node => ({
    pubkey: new PublicKey(node),
    isSigner: false,
    isWritable: false,
  }))
);
```

**Critical:** The proof accounts are appended as `remainingAccounts` — this is what makes cNFT transactions larger than standard ones. Deep trees (depth 20+) have up to 24 proof nodes, making each burn instruction quite large. Maximum **3–5 burns per transaction** to stay under Solana's transaction size limit.

---

## 3. Module File Structure

```
src/modules/cnft-cleaner/
│
├── index.ts                          ← Public API
│
├── types.ts                          ← All Engine 6 types
├── constants.ts                      ← Engine 6 constants
│
├── lib/
│   ├── dasScanner.ts                 ← Fetch all cNFTs via Helius DAS API
│   ├── spamScorer.ts                 ← Score + categorize each cNFT
│   ├── proofFetcher.ts               ← Fetch Merkle proofs for burn
│   ├── burnBuilder.ts                ← Build Bubblegum burn transactions
│   └── collectionVerifier.ts        ← Check verified collections + floor prices
│
├── hooks/
│   ├── useCNFTStore.ts               ← Zustand slice (local)
│   ├── useCNFTScanner.ts             ← Scan hook
│   └── useCNFTBurner.ts              ← Burn execution hook
│
├── components/
│   ├── CNFTCleanerCard.tsx           ← Main card for ScanPage
│   ├── CNFTCategorySection.tsx       ← Groups cNFTs by category
│   ├── CNFTItemRow.tsx               ← One row per cNFT
│   ├── CNFTImageThumbnail.tsx        ← Lazy-loaded image with fallback
│   ├── BurnConfirmModal.tsx          ← Confirm before burning
│   ├── BurnProgressModal.tsx         ← Progress during burn
│   └── SpamScoreBadge.tsx            ← Visual spam score indicator
│
└── utils/
    ├── formatting.ts
    └── ipfs.ts                       ← IPFS URI → HTTP gateway conversion
```

---

## 4. TypeScript Types

File: `src/modules/cnft-cleaner/types.ts`

```typescript
export type CNFTCategory =
  | 'spam'              // Almost certainly worthless spam
  | 'low_value'         // Unverified, no floor price, likely worthless
  | 'potentially_valuable'  // Has some signals of value — user should check
  | 'verified'          // Verified Metaplex collection — do NOT auto-select for burn
  | 'unknown';          // Could not determine

export type SpamSignal =
  | 'unverified_collection'
  | 'no_metadata'
  | 'suspicious_name'        // Contains "airdrop", "free", "claim", URLs
  | 'duplicate_image'        // Same image as many other cNFTs in wallet
  | 'no_creators'
  | 'zero_royalty'           // Legitimate projects almost always have royalties
  | 'suspicious_uri'         // Metadata points to suspicious domain
  | 'known_spam_collection'; // On the spam blocklist

export interface CNFTItem {
  id: string;                        // Asset ID (DAS asset id)
  name: string;
  symbol: string;
  description: string;
  imageUri: string | null;           // HTTP-accessible image URI (IPFS converted)
  metadataUri: string | null;        // Original metadata URI
  collection: string | null;         // Collection mint address
  collectionName: string | null;
  isVerifiedCollection: boolean;     // Metaplex verified collection
  floorPriceSOL: number | null;      // null if unknown or no market
  estimatedValueSOL: number;         // 0 if no floor price
  category: CNFTCategory;
  spamScore: number;                 // 0–100 (100 = definitely spam)
  spamSignals: SpamSignal[];         // Which signals triggered
  treeAddress: string;               // Merkle tree address
  leafIndex: number;                 // Leaf index in tree
  dataHash: string;
  creatorHash: string;
  isSelected: boolean;               // User can toggle selection
  isBurnable: boolean;               // false if proof fetch failed or verified collection
}

export interface CNFTScanResult {
  scannedAt: Date;
  totalCNFTs: number;
  categories: {
    spam: CNFTItem[];
    low_value: CNFTItem[];
    potentially_valuable: CNFTItem[];
    verified: CNFTItem[];
    unknown: CNFTItem[];
  };
  spamCount: number;
  lowValueCount: number;
  potentiallyValuableCount: number;
  verifiedCount: number;
  estimatedRecoverableSOL: number;   // From burn lamport recovery (tiny)
  totalPages: number;                // DAS API pagination
  fullyScanned: boolean;             // false if wallet has >1000 cNFTs and not all loaded
}

export interface BurnEstimate {
  selectedCount: number;
  sessionFeeSOL: number;             // Flat 0.005 SOL
  networkFeeSOL: number;             // ~0.000005 SOL per signature
  totalCostSOL: number;
  estimatedRecoverableSOL: number;   // From canopy — usually negligible
}

export interface BurnProof {
  assetId: string;
  root: string;
  proof: string[];                   // Array of base58 pubkey strings
  nodeIndex: number;
  leaf: string;
  treeId: string;
}

export interface BurnResultItem {
  assetId: string;
  name: string;
  success: boolean;
  signature: string | null;
  errorMessage: string | null;
}

export interface BurnResult {
  success: boolean;
  burnedCount: number;
  failedCount: number;
  signatures: string[];
  sessionFeeSignature: string | null;
  items: BurnResultItem[];
}

export type CNFTScanStatus =
  | 'idle'
  | 'scanning'
  | 'scan_complete'
  | 'error';

export type CNFTBurnStatus =
  | 'idle'
  | 'fetching_proofs'
  | 'awaiting_confirmation'
  | 'burning'
  | 'sending_fee'
  | 'complete'
  | 'error';

export interface CNFTStoreState {
  scanStatus: CNFTScanStatus;
  scanResult: CNFTScanResult | null;
  scanError: string | null;
  burnStatus: CNFTBurnStatus;
  burnResult: BurnResult | null;
  burnError: string | null;
  selectedIds: string[];
  currentProgressText: string;
  completedItems: BurnResultItem[];
  burnProofs: Map<string, BurnProof>;
}
```

---

## 5. Constants

File: `src/modules/cnft-cleaner/constants.ts`

```typescript
// ─── PROGRAM IDS ──────────────────────────────────────────
export const BUBBLEGUM_PROGRAM_ID     = 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
export const SPL_NOOP_PROGRAM_ID      = 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV';
export const SPL_COMPRESSION_PROGRAM  = 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';

// ─── FEES ─────────────────────────────────────────────────
// Flat session fee — charged once per burn session (not per cNFT)
export const BURN_SESSION_FEE_SOL    = 0.005;
export const BURN_SESSION_FEE_LAMPORTS = 5000000; // 0.005 * 1e9

// Share of recovered lamports kept as additional fee
export const BURN_LAMPORT_FEE_PERCENT = 20;

// ─── SCAN LIMITS ──────────────────────────────────────────
// DAS API page size
export const DAS_PAGE_SIZE = 1000;

// Maximum pages to fetch (1000 * 10 = 10,000 cNFTs max)
// Beyond this, warn user wallet has too many to scan fully
export const DAS_MAX_PAGES = 10;

// ─── BURN LIMITS ──────────────────────────────────────────
// Max burns per transaction (proof accounts make these large)
export const MAX_BURNS_PER_TX = 3;

// Max cNFTs to burn in one session
export const MAX_BURNS_PER_SESSION = 500;

// ─── SPAM SCORING ─────────────────────────────────────────
// Spam score thresholds
export const SPAM_THRESHOLD    = 70;  // score >= 70 → spam category
export const LOW_VALUE_THRESHOLD = 40; // score 40–69 → low_value
// score 1–39 → potentially_valuable
// score 0 + verified collection → verified

// Signal weights (add to spam score)
export const SPAM_SIGNAL_WEIGHTS: Record<SpamSignal, number> = {
  unverified_collection:  20,
  no_metadata:            30,
  suspicious_name:        25,
  duplicate_image:        15,
  no_creators:            20,
  zero_royalty:           10,
  suspicious_uri:         30,
  known_spam_collection:  100,  // Instant spam
};

// ─── SUSPICIOUS NAME PATTERNS ─────────────────────────────
// cNFT names containing these strings score as suspicious_name
export const SUSPICIOUS_NAME_PATTERNS = [
  'airdrop', 'free', 'claim', 'visit', 'http', 'www.',
  '.com', '.io', '.xyz', 'reward', 'bonus', 'winner',
  'congratulation', 'whitelist', 'mint now', 'limited',
];

// ─── KNOWN SPAM COLLECTIONS ───────────────────────────────
// Hardcoded list of known spam collection addresses
// Maintain and expand this list over time
export const KNOWN_SPAM_COLLECTIONS = new Set<string>([
  // Add known spam collection mint addresses here
  // This list grows as spam is identified — start with community-reported ones
  // Sources: Solana spam reports, community blocklists
]);

// ─── IPFS GATEWAYS ────────────────────────────────────────
// Ordered by reliability — try in sequence
export const IPFS_GATEWAYS = [
  'https://nftstorage.link/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

// ─── CATEGORIES DISPLAY ───────────────────────────────────
export const CATEGORY_INFO = {
  spam:                { label: 'Spam',                color: '#ef4444', icon: '🚫', autoSelect: true  },
  low_value:           { label: 'Low Value',           color: '#f59e0b', icon: '⚠️',  autoSelect: true  },
  potentially_valuable:{ label: 'Check Before Burning',color: '#6366f1', icon: '🔍', autoSelect: false },
  verified:            { label: 'Verified Collection', color: '#10b981', icon: '✅', autoSelect: false },
  unknown:             { label: 'Unknown',             color: '#6b7280', icon: '❓', autoSelect: false },
};
```

---

## 6. Scanner Logic

### 6.1 DAS Scanner

File: `src/modules/cnft-cleaner/lib/dasScanner.ts`

```typescript
/**
 * Fetch ALL cNFTs owned by the wallet using Helius DAS API.
 * Paginates automatically until all assets are fetched or DAS_MAX_PAGES reached.
 * Filters for compressed assets only (compression.compressed === true).
 * Returns raw DAS assets for further processing by spamScorer.
 */
export async function fetchAllCNFTs(
  walletAddress: string,
  heliosRpcUrl: string
): Promise<{ assets: DASAsset[]; fullyScanned: boolean }>
```

Implementation:
```typescript
export async function fetchAllCNFTs(walletAddress, heliosRpcUrl) {
  const allAssets: DASAsset[] = [];
  let page = 1;
  let hasMore = true;
  let fullyScanned = true;

  while (hasMore && page <= DAS_MAX_PAGES) {
    const response = await fetch(heliosRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `scan-page-${page}`,
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page,
          limit: DAS_PAGE_SIZE,
          displayOptions: {
            showCollectionMetadata: true,
            showUnverifiedCollections: true,
          },
        },
      }),
    });

    const data = await response.json();
    const items: DASAsset[] = data?.result?.items ?? [];

    // Filter for compressed only
    const compressed = items.filter(a => a.compression?.compressed === true);
    allAssets.push(...compressed);

    hasMore = items.length === DAS_PAGE_SIZE;
    page++;

    // Rate limit respect
    if (hasMore) await sleep(150);
  }

  if (hasMore && page > DAS_MAX_PAGES) {
    fullyScanned = false;  // More cNFTs exist but we hit the page limit
  }

  return { assets: allAssets, fullyScanned };
}
```

**Error handling:**
- 429 rate limit: Wait 1 second, retry page once
- Network error: Throw `AppError` with `CNFT_SCAN_FAILED`
- Empty wallet (no cNFTs): Return `{ assets: [], fullyScanned: true }` — not an error

### 6.2 Spam Scorer

File: `src/modules/cnft-cleaner/lib/spamScorer.ts`

```typescript
/**
 * Score each cNFT for spam likelihood.
 * Returns scored CNFTItem[] sorted by spamScore descending.
 * Auto-selects spam and low_value categories for burning.
 * Never auto-selects potentially_valuable or verified.
 */
export function scoreCNFTs(
  assets: DASAsset[],
  floorPrices: Map<string, number>  // collection mint → floor price SOL
): CNFTItem[]
```

Scoring logic per asset:

```typescript
function scoreAsset(asset: DASAsset, floorPrices: Map<string, number>): CNFTItem {
  let score = 0;
  const signals: SpamSignal[] = [];

  // Check known spam collections first — instant categorization
  const collectionMint = asset.grouping?.find(g => g.group_key === 'collection')?.group_value;
  if (collectionMint && KNOWN_SPAM_COLLECTIONS.has(collectionMint)) {
    signals.push('known_spam_collection');
    score += SPAM_SIGNAL_WEIGHTS.known_spam_collection;
  }

  // Verified collection check — if verified, max score is capped at 30
  // Verified collections should NEVER be auto-selected for burning
  const isVerified = asset.grouping?.some(g => g.group_key === 'collection' && g.verified) ?? false;

  // No metadata
  if (!asset.content?.metadata?.name || asset.content.metadata.name.trim() === '') {
    signals.push('no_metadata');
    score += SPAM_SIGNAL_WEIGHTS.no_metadata;
  }

  // Suspicious name patterns
  const name = (asset.content?.metadata?.name ?? '').toLowerCase();
  const hasSpamName = SUSPICIOUS_NAME_PATTERNS.some(p => name.includes(p));
  if (hasSpamName) {
    signals.push('suspicious_name');
    score += SPAM_SIGNAL_WEIGHTS.suspicious_name;
  }

  // No creators
  if (!asset.creators || asset.creators.length === 0) {
    signals.push('no_creators');
    score += SPAM_SIGNAL_WEIGHTS.no_creators;
  }

  // Zero royalty (not definitive but a signal)
  if (asset.royalty?.basis_points === 0) {
    signals.push('zero_royalty');
    score += SPAM_SIGNAL_WEIGHTS.zero_royalty;
  }

  // Unverified collection (when a collection exists but isn't verified)
  if (collectionMint && !isVerified) {
    signals.push('unverified_collection');
    score += SPAM_SIGNAL_WEIGHTS.unverified_collection;
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Override: if verified collection, cap score at 10
  // This prevents burning valuable NFTs
  if (isVerified) score = Math.min(score, 10);

  // Determine category
  let category: CNFTCategory;
  if (isVerified) {
    category = 'verified';
  } else if (score >= SPAM_THRESHOLD) {
    category = 'spam';
  } else if (score >= LOW_VALUE_THRESHOLD) {
    category = 'low_value';
  } else if (score > 0) {
    category = 'potentially_valuable';
  } else {
    category = 'unknown';
  }

  const floorPrice = collectionMint ? (floorPrices.get(collectionMint) ?? null) : null;

  return {
    id: asset.id,
    name: asset.content?.metadata?.name ?? 'Unnamed',
    // ... map all other fields
    category,
    spamScore: score,
    spamSignals: signals,
    isSelected: CATEGORY_INFO[category].autoSelect,
    isBurnable: category !== 'verified',
    // ...
  };
}
```

### 6.3 Collection Verifier + Floor Price

File: `src/modules/cnft-cleaner/lib/collectionVerifier.ts`

```typescript
/**
 * For all cNFTs with a collection mint, fetch:
 * 1. Whether the collection is verified (from DAS data — already available)
 * 2. Floor price from Magic Eden or Tensor APIs
 * 
 * Returns Map<collectionMint, floorPriceSOL>
 * Collections with no market data or unknown floor return 0
 */
export async function fetchCollectionFloorPrices(
  collectionMints: string[]
): Promise<Map<string, number>>
```

**Magic Eden API:**
```
GET https://api-mainnet.magiceden.dev/v2/collections/{symbol}/stats
Response: { floorPrice: number }  // in lamports
```

**Tensor API (backup):**
```
GET https://api.tensor.so/api/v1/collections?slugs=<slug>
```

**Implementation note:** Collection mints don't always map directly to Magic Eden symbols. Use a best-effort approach:
1. Try Magic Eden with the collection mint as the symbol
2. If not found, try the DAS `collectionName` as the symbol
3. If still not found, return 0 for that collection
4. Never block the scan waiting for floor prices — fetch in parallel with a 3-second timeout

### 6.4 Proof Fetcher

File: `src/modules/cnft-cleaner/lib/proofFetcher.ts`

```typescript
/**
 * Fetch Merkle proofs for selected cNFTs.
 * Called AFTER user confirms burn selection — not during scan.
 * Proofs can go stale if the Merkle tree is updated between fetch and use.
 * Fetch proofs immediately before building transactions — not minutes before.
 * 
 * Batch proofs in parallel (Promise.allSettled) — up to 10 concurrent requests.
 * If proof fetch fails for a cNFT, mark it as failed and skip in burn.
 */
export async function fetchBurnProofs(
  assetIds: string[],
  heliosRpcUrl: string
): Promise<Map<string, BurnProof>>
```

```typescript
export async function fetchBurnProofs(assetIds, heliosRpcUrl) {
  const proofMap = new Map<string, BurnProof>();
  const batches = chunk(assetIds, 10);

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(id => fetchSingleProof(id, heliosRpcUrl))
    );

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        proofMap.set(batch[i], result.value);
      }
      // Failed proofs are simply omitted from the map
      // Burn builder checks for proof existence before building
    });

    if (batches.length > 1) await sleep(100);
  }

  return proofMap;
}

async function fetchSingleProof(assetId: string, heliosRpcUrl: string): Promise<BurnProof> {
  const response = await fetch(heliosRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'getAssetProof',
      params: { id: assetId },
    }),
  });

  const data = await response.json();
  const result = data?.result;

  if (!result?.proof || !result?.root) {
    throw new Error(`No proof returned for asset ${assetId}`);
  }

  return {
    assetId,
    root: result.root,
    proof: result.proof,
    nodeIndex: result.node_index,
    leaf: result.leaf,
    treeId: result.tree_id,
  };
}
```

### 6.5 Burn Builder

File: `src/modules/cnft-cleaner/lib/burnBuilder.ts`

```typescript
/**
 * Build batched Bubblegum burn transactions.
 * Each transaction burns MAX_BURNS_PER_TX cNFTs.
 * Includes proof accounts as remaining accounts per burn.
 * First transaction includes the flat session fee transfer.
 */
export async function buildBurnTransactions(
  items: CNFTItem[],
  proofs: Map<string, BurnProof>,
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<Transaction[]>
```

Transaction building per batch:
```typescript
for (const batch of batches) {
  const tx = new Transaction();
  tx.feePayer = walletPublicKey;
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;

  for (const item of batch) {
    const proof = proofs.get(item.id);
    if (!proof) continue;  // Skip if no proof

    // Derive tree authority PDA
    const [treeAuthority] = PublicKey.findProgramAddressSync(
      [new PublicKey(item.treeAddress).toBuffer()],
      new PublicKey(BUBBLEGUM_PROGRAM_ID)
    );

    // Build burn instruction
    const burnIx = createBurnInstruction(
      {
        treeAuthority,
        leafOwner: walletPublicKey,
        leafDelegate: walletPublicKey,
        merkleTree: new PublicKey(item.treeAddress),
        logWrapper: new PublicKey(SPL_NOOP_PROGRAM_ID),
        compressionProgram: new PublicKey(SPL_COMPRESSION_PROGRAM),
        systemProgram: SystemProgram.programId,
      },
      {
        root: Array.from(Buffer.from(proof.root, 'base64')),
        dataHash: Array.from(Buffer.from(item.dataHash, 'base64')),
        creatorHash: Array.from(Buffer.from(item.creatorHash, 'base64')),
        nonce: item.leafIndex,
        index: item.leafIndex,
      }
    );

    // Append proof nodes as remaining accounts
    burnIx.keys.push(
      ...proof.proof.map(node => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
    );

    tx.add(burnIx);
  }

  // Add session fee to FIRST transaction only
  if (batchIndex === 0) {
    tx.add(SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: new PublicKey(TREASURY_WALLET),
      lamports: BURN_SESSION_FEE_LAMPORTS,
    }));
  }

  transactions.push(tx);
}
```

**Transaction size safety check:**
After building each transaction, verify its serialized size:
```typescript
const serialized = tx.serialize({ requireAllSignatures: false });
if (serialized.length > 1200) {
  // Transaction too large — reduce to 2 burns per tx and retry
  // Log this as a warning
}
```

---

## 7. React Hooks

### 7.1 useCNFTStore

File: `src/modules/cnft-cleaner/hooks/useCNFTStore.ts`

Local Zustand store scoped to this module.

```typescript
export const useCNFTStore = create<CNFTStoreState & CNFTStoreActions>((set, get) => ({
  // Initial state
  scanStatus: 'idle',
  scanResult: null,
  scanError: null,
  burnStatus: 'idle',
  burnResult: null,
  burnError: null,
  selectedIds: [],
  currentProgressText: '',
  completedItems: [],
  burnProofs: new Map(),

  // Actions
  setScanResult: (result) => set({
    scanResult: result,
    // Auto-select spam and low_value categories
    selectedIds: [
      ...result.categories.spam,
      ...result.categories.low_value,
    ]
    .filter(item => item.isBurnable)
    .map(item => item.id),
  }),

  toggleItem: (id) => set(state => ({
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter(x => x !== id)
      : [...state.selectedIds, id],
  })),

  selectCategory: (category) => set(state => ({
    selectedIds: [
      ...new Set([
        ...state.selectedIds,
        ...(state.scanResult?.categories[category] ?? [])
          .filter(i => i.isBurnable)
          .map(i => i.id),
      ])
    ],
  })),

  deselectCategory: (category) => set(state => ({
    selectedIds: state.selectedIds.filter(id =>
      !(state.scanResult?.categories[category] ?? [])
        .map(i => i.id)
        .includes(id)
    ),
  })),

  setBurnProofs: (proofs) => set({ burnProofs: proofs }),
  addCompletedItem: (item) => set(state => ({
    completedItems: [...state.completedItems, item],
  })),
  resetBurn: () => set({
    burnStatus: 'idle',
    burnResult: null,
    burnError: null,
    completedItems: [],
    burnProofs: new Map(),
  }),
}));
```

### 7.2 useCNFTScanner

File: `src/modules/cnft-cleaner/hooks/useCNFTScanner.ts`

```typescript
export function useCNFTScanner() {
  const { publicKey } = useWallet();
  const store = useCNFTStore();
  const heliosRpcUrl = import.meta.env.VITE_HELIUS_RPC_URL;

  const runScan = useCallback(async () => {
    if (!publicKey) return;

    store.setScanStatus('scanning');

    try {
      // 1. Fetch all cNFTs
      const { assets, fullyScanned } = await fetchAllCNFTs(
        publicKey.toString(),
        heliosRpcUrl
      );

      if (assets.length === 0) {
        store.setScanResult({
          // empty result
          totalCNFTs: 0,
          fullyScanned: true,
          categories: { spam: [], low_value: [], potentially_valuable: [], verified: [], unknown: [] },
          // ...
        });
        store.setScanStatus('scan_complete');
        return;
      }

      // 2. Fetch floor prices for all unique collections
      const collectionMints = [...new Set(
        assets
          .map(a => a.grouping?.find(g => g.group_key === 'collection')?.group_value)
          .filter(Boolean) as string[]
      )];
      const floorPrices = await fetchCollectionFloorPrices(collectionMints);

      // 3. Score all cNFTs
      const scoredItems = scoreCNFTs(assets, floorPrices);

      // 4. Build scan result
      const result = buildScanResult(scoredItems, fullyScanned);
      store.setScanResult(result);
      store.setScanStatus('scan_complete');

      logEvent('cnft_scan_complete', {
        total: result.totalCNFTs,
        spam: result.spamCount,
        lowValue: result.lowValueCount,
        verified: result.verifiedCount,
      });
    } catch (err: any) {
      store.setScanStatus('error');
      store.setScanError('Could not scan cNFTs. Please try again.');
    }
  }, [publicKey, heliosRpcUrl]);

  return {
    scanStatus: store.scanStatus,
    scanResult: store.scanResult,
    scanError: store.scanError,
    runScan,
  };
}
```

### 7.3 useCNFTBurner

File: `src/modules/cnft-cleaner/hooks/useCNFTBurner.ts`

```typescript
export function useCNFTBurner() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const store = useCNFTStore();
  const heliosRpcUrl = import.meta.env.VITE_HELIUS_RPC_URL;

  const selectedItems = useMemo(() => {
    const allItems = Object.values(store.scanResult?.categories ?? {}).flat() as CNFTItem[];
    return allItems.filter(item => store.selectedIds.includes(item.id) && item.isBurnable);
  }, [store.scanResult, store.selectedIds]);

  const burnEstimate = useMemo((): BurnEstimate | null => {
    if (selectedItems.length === 0) return null;
    return {
      selectedCount: selectedItems.length,
      sessionFeeSOL: BURN_SESSION_FEE_SOL,
      networkFeeSOL: Math.ceil(selectedItems.length / MAX_BURNS_PER_TX) * 0.000005,
      totalCostSOL: BURN_SESSION_FEE_SOL + (Math.ceil(selectedItems.length / MAX_BURNS_PER_TX) * 0.000005),
      estimatedRecoverableSOL: 0,  // Negligible for cNFTs
    };
  }, [selectedItems]);

  /**
   * Step 1: Fetch proofs for all selected items.
   * Step 2: Open confirm modal.
   */
  const initiateBurn = useCallback(async () => {
    if (!publicKey || selectedItems.length === 0) return;

    store.setBurnStatus('fetching_proofs');
    store.setCurrentProgressText('Fetching Merkle proofs...');

    try {
      const proofs = await fetchBurnProofs(
        selectedItems.map(i => i.id),
        heliosRpcUrl
      );
      store.setBurnProofs(proofs);
      store.setBurnStatus('awaiting_confirmation');
    } catch {
      store.setBurnStatus('error');
      store.setBurnError('Could not fetch proofs. Please try again.');
    }
  }, [publicKey, selectedItems, heliosRpcUrl]);

  /**
   * Execute burn after user confirms.
   */
  const executeBurn = useCallback(async () => {
    if (!publicKey || !signTransaction || !sendTransaction) return;

    store.setBurnStatus('burning');

    try {
      // Build transactions
      const transactions = await buildBurnTransactions(
        selectedItems,
        store.burnProofs,
        publicKey,
        connection
      );

      const signatures: string[] = [];
      let burnedCount = 0;
      let failedCount = 0;

      // Execute each transaction
      for (let i = 0; i < transactions.length; i++) {
        store.setCurrentProgressText(
          `Burning batch ${i + 1} of ${transactions.length}...`
        );

        try {
          const signed = await signTransaction(transactions[i]);
          const sig = await sendTransaction(signed, connection);
          await connection.confirmTransaction(sig, 'confirmed');

          signatures.push(sig);
          // Calculate which items were in this batch and mark as success
          const batchItems = selectedItems.slice(i * MAX_BURNS_PER_TX, (i + 1) * MAX_BURNS_PER_TX);
          batchItems.forEach(item => {
            store.addCompletedItem({ assetId: item.id, name: item.name, success: true, signature: sig, errorMessage: null });
          });
          burnedCount += batchItems.length;

        } catch (txErr: any) {
          const batchItems = selectedItems.slice(i * MAX_BURNS_PER_TX, (i + 1) * MAX_BURNS_PER_TX);
          batchItems.forEach(item => {
            store.addCompletedItem({ assetId: item.id, name: item.name, success: false, signature: null, errorMessage: txErr.message });
          });
          failedCount += batchItems.length;
        }
      }

      store.setBurnResult({
        success: burnedCount > 0,
        burnedCount,
        failedCount,
        signatures,
        sessionFeeSignature: signatures[0] ?? null,  // Fee was in first tx
        items: store.completedItems,
      });
      store.setBurnStatus('complete');

      logEvent('cnft_burn_complete', { burned: burnedCount, failed: failedCount });

    } catch (err: any) {
      store.setBurnStatus('error');
      store.setBurnError('Burn failed. Please try again.');
    }
  }, [publicKey, signTransaction, sendTransaction, selectedItems, store, connection]);

  return {
    selectedItems,
    burnEstimate,
    burnStatus: store.burnStatus,
    burnResult: store.burnResult,
    burnError: store.burnError,
    completedItems: store.completedItems,
    toggleItem: store.toggleItem,
    selectCategory: store.selectCategory,
    deselectCategory: store.deselectCategory,
    initiateBurn,
    executeBurn,
    cancelBurn: () => store.resetBurn(),
  };
}
```

---

## 8. UI Components

### 8.1 CNFTCleanerCard

File: `src/modules/cnft-cleaner/components/CNFTCleanerCard.tsx`

**State: Idle**
```
🗑️ CNFT SPAM CLEANER

Scan for spam and worthless compressed NFTs
cluttering your wallet.

[Scan for cNFT Spam]

Uses Helius DAS · Checks metadata, collections & spam signals
```

**State: Scanning**
```
🗑️ SCANNING YOUR CNFTS...

Fetching assets...  [progress bar fills as pages load]
Scoring spam signals...
Checking collection data...
```
Show a count updating in real time: "Loaded 247 cNFTs so far..."

**State: Clean (no cNFTs or all verified)**
```
🗑️ WALLET LOOKS CLEAN

No spam cNFTs found.
[X] verified collection items kept safe.
```

**State: Results Found**
```
🗑️ CNFT SCAN COMPLETE

  [CNFTCategorySection for spam]
  [CNFTCategorySection for low_value]
  [CNFTCategorySection for potentially_valuable — collapsed]
  [CNFTCategorySection for verified — collapsed, read-only]

  ────────────────────────────────────────────
  Selected: 47 cNFTs for burning

  Session fee:    0.005 SOL  (~$0.75)
  Network fees:  ~0.001 SOL  (~$0.15)
  ─────────────────────────────────────
  Total cost:     0.006 SOL  (~$0.90)

  [Burn 47 Spam cNFTs →]
```

**Important UX:** Make it very clear that burning is permanent. Use language like "permanently delete" not just "burn." The confirmed warning in the modal is the real gate — the card just shows the selection.

### 8.2 CNFTCategorySection

Collapsible section per category.

```
▼ 🚫 SPAM  (23 items)  [Select All] [Deselect All]
  [CNFTItemRow] x 23

▼ ⚠️  LOW VALUE  (31 items)  [Select All] [Deselect All]
  [CNFTItemRow] x 31

▶ 🔍 CHECK BEFORE BURNING  (8 items)  ← collapsed by default
  (expand to review)

▶ ✅ VERIFIED COLLECTIONS  (12 items)  ← collapsed, no burn option
  These are protected. Safe to keep.
```

**Verified section:** No checkboxes. No burn button. Read-only display. Message: "These cNFTs belong to verified collections and cannot be selected for burning. If you want to remove them, use a dedicated NFT management tool."

### 8.3 CNFTItemRow

One row per cNFT. Compact — many may be shown.

```
☑  [Image 40x40]  Mysterious Airdrop #4421        🚫 Spam  score: 95
                  No collection · No creators · Suspicious name
                  Est. value: $0.00
```

Fields:
- Checkbox (disabled for verified items)
- Thumbnail image (lazy loaded, fallback to gray placeholder)
- Name (truncated if long)
- `SpamScoreBadge` showing category + score
- Spam signals as small tags (e.g. "No metadata", "Suspicious name")
- Estimated value
- Clicking the row expands to show full metadata + Solscan link

**Performance note:** This list can have hundreds of items. Use **virtual scrolling** (react-window or @tanstack/virtual) for the item rows. Rendering 500 DOM nodes will make the page unusable without it.

### 8.4 CNFTImageThumbnail

Lazy-loaded image with graceful fallback.

```typescript
// Props: uri: string | null, alt: string, size: number
// 1. Convert IPFS URIs to HTTP via IPFS_GATEWAYS[0]
// 2. Lazy load with IntersectionObserver
// 3. On error: try next IPFS gateway
// 4. Final fallback: gray placeholder with first letter of NFT name
// 5. Never show broken image icons
```

IPFS URI conversion:
```typescript
function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '');
    return `${IPFS_GATEWAYS[0]}${hash}`;
  }
  return uri;
}
```

### 8.5 SpamScoreBadge

```typescript
// Props: category: CNFTCategory, score: number
// Shows: colored pill with icon + label
// 🚫 Spam (95)  → red
// ⚠️ Low Value (52) → amber
// 🔍 Check First (28) → indigo
// ✅ Verified → green
// ❓ Unknown → gray
```

### 8.6 BurnConfirmModal

This modal must be the clearest warning in the entire app. Burning is permanent.

```
⚠️  PERMANENTLY DELETE 47 CNFTS

You have selected:
  🚫 Spam:       23 items
  ⚠️  Low Value:  24 items

⛔ THIS CANNOT BE UNDONE.
   Burned cNFTs are permanently destroyed on-chain.
   They cannot be recovered.

Before confirming:
  ✓ I have reviewed the selected cNFTs
  ✓ I understand burning is permanent
  ✓ I have not selected any items I want to keep

COST:
  Session fee:   0.005 SOL  (~$0.75)
  Network fees: ~0.001 SOL
  ─────────────────────────────────
  Total:         0.006 SOL  (~$0.90)

[Cancel — Keep My cNFTs]   [Yes, Permanently Delete 47 cNFTs]
```

**Cancel button must be the LEFT button and visually prominent.**
The confirm button text should say "Permanently Delete" — not "Burn" or "Confirm." The scary language is intentional and protects users.

**Optional: add a 3-second delay** before the confirm button becomes clickable. Forces the user to read the modal.

### 8.7 BurnProgressModal

```
🗑️  Burning spam cNFTs...

  Batch 1/5:  ✅ 3 burned  [View ↗]
  Batch 2/5:  ✅ 3 burned  [View ↗]
  Batch 3/5:  ⏳ Burning... (awaiting wallet signature)
  Batch 4/5:  ○  Waiting
  Batch 5/5:  ○  Waiting

  Do not close this window.
```

Success:
```
✅ DONE — WALLET CLEANED

  Permanently deleted: 47 spam cNFTs
  Failed:              0

  Your wallet is now cleaner.

  [View Transactions ↗]
  [Done]
```

Partial success (some batches failed):
```
⚠️  PARTIAL SUCCESS

  ✅ Deleted: 33 cNFTs
  ❌ Failed:  14 cNFTs

  Failed items can be retried individually.
  All deleted items are permanently removed.

  [Retry Failed]  [Done]
```

---

## 9. IPFS Utility

File: `src/modules/cnft-cleaner/utils/ipfs.ts`

```typescript
/**
 * Convert various URI formats to HTTP-accessible URLs.
 * Handles: ipfs://, https://, http://, ar:// (Arweave)
 */
export function resolveUri(uri: string | null): string | null {
  if (!uri) return null;

  if (uri.startsWith('ipfs://')) {
    const hash = uri.slice(7);
    return `${IPFS_GATEWAYS[0]}${hash}`;
  }

  if (uri.startsWith('ar://')) {
    const txId = uri.slice(5);
    return `https://arweave.net/${txId}`;
  }

  if (uri.startsWith('http')) return uri;

  return null;  // Unknown format
}

/**
 * Try multiple IPFS gateways in sequence.
 * Used as fallback when primary gateway fails.
 */
export async function resolveUriWithFallback(uri: string): Promise<string | null> {
  for (const gateway of IPFS_GATEWAYS) {
    if (uri.startsWith('ipfs://')) {
      const url = `${gateway}${uri.slice(7)}`;
      try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
        if (res.ok) return url;
      } catch { continue; }
    }
  }
  return null;
}
```

---

## 10. ScanPage Integration

```typescript
// In src/pages/ScanPage.tsx — add after Engine 5
import { CNFTCleanerCard } from '@/modules/cnft-cleaner';
```

Position in page:
```
Engine 1: Permission Revocation
Engine 2: Account Rent Reclaimer
Engine 3: Dust Consolidator
Engine 4: Staking Ticket Finder
Engine 5: LP Fee Harvester
Engine 6: cNFT Spam Cleaner  ← NEW
──────────────────────────────
Summary Card
```

**Update Summary Card:**
Engine 6 doesn't recover SOL (cost is negligible). Update the summary card to show:
```
Spam removed: 47 cNFTs  (after burn)
```
as a separate line from the SOL recovery total.

---

## 11. Module Public API

File: `src/modules/cnft-cleaner/index.ts`

```typescript
export { CNFTCleanerCard } from './components/CNFTCleanerCard';
export type { CNFTScanResult, BurnResult, CNFTItem } from './types';
```

---

## 12. New npm Dependencies

```bash
# Metaplex Bubblegum (cNFT burn instructions)
npm install @metaplex-foundation/mpl-bubblegum

# SPL Account Compression (required by Bubblegum)
npm install @solana/spl-account-compression

# Virtual scrolling (required — hundreds of items in the list)
npm install @tanstack/react-virtual

# No other new dependencies needed
# DAS API is called via fetch()
# Floor prices via fetch()
```

**Update vite.config.ts:**
```typescript
manualChunks: {
  // existing chunks...
  'cnft-bubblegum': ['@metaplex-foundation/mpl-bubblegum', '@solana/spl-account-compression'],
}
```

---

## 13. Security Requirements

**1. Never auto-burn verified collections.**
The `isBurnable` flag must be `false` for any cNFT with `isVerifiedCollection === true`. The burn builder must check this flag and skip verified items even if somehow included in the selected IDs. This is a double safety check.

**2. Proof freshness.**
Merkle proofs are fetched immediately before building transactions (not during scan). Even so, if a proof is older than 60 seconds when the transaction is submitted, it may be stale. If a transaction fails with a proof-related error, automatically re-fetch the proof and retry once before reporting failure.

**3. Spam score transparency.**
Every cNFT in the UI must show its spam signals (why it was categorized as spam). Never hide the reasoning. Users need to understand why something was flagged before they burn it.

**4. "Potentially Valuable" items are NEVER auto-selected.**
The `autoSelect` flag in `CATEGORY_INFO` must be `false` for `potentially_valuable` and `verified`. The store initialization must respect this. Never select these categories by default.

**5. Maximum burn warning.**
If user selects more than 100 cNFTs to burn, show a prominent warning:
"You are about to permanently delete X cNFTs. Take a moment to review your selection."

**6. No metadata = extra caution.**
If a cNFT has no loadable image or metadata (perhaps because the URI is still loading), show a special placeholder in the UI and do NOT include it in the auto-selected burn list until metadata is loaded. User can manually select it if desired.

---

## 14. Firebase Analytics Events

```typescript
logEvent('cnft_scan_started', { timestamp: Date.now() });

logEvent('cnft_scan_complete', {
  totalCNFTs: number,
  spamCount: number,
  lowValueCount: number,
  potentiallyValuableCount: number,
  verifiedCount: number,
  fullyScanned: boolean,
});

logEvent('cnft_burn_initiated', {
  selectedCount: number,
  spamSelected: number,
  lowValueSelected: number,
  sessionFeeSOL: number,
});

logEvent('cnft_burn_complete', {
  success: boolean,
  burnedCount: number,
  failedCount: number,
  transactionCount: number,
});
```

---

## 15. Error Messages

```typescript
CNFT_SCAN_FAILED:      'Could not scan for cNFTs. Check your connection and try again.',
CNFT_PROOF_FAILED:     'Could not fetch burn proofs for some items. They have been skipped.',
CNFT_BURN_FAILED:      'Burn transaction failed. Your cNFTs were not affected.',
CNFT_BURN_PARTIAL:     'Some cNFTs were burned successfully. Check details below.',
CNFT_STALE_PROOF:      'Proof expired during burn. Re-fetching and retrying...',
CNFT_VERIFIED_BLOCKED: 'Verified collection items cannot be burned with this tool.',
CNFT_TOO_MANY:         'Your wallet has too many cNFTs to fully scan. Showing first 10,000.',
```

---

## 16. Build Order for Agent

1. **Dependencies** — Install bubblegum, spl-account-compression, tanstack-virtual. Update vite.config.ts
2. **Types** — `src/modules/cnft-cleaner/types.ts`
3. **Constants** — `src/modules/cnft-cleaner/constants.ts`
4. **IPFS utility** — `src/modules/cnft-cleaner/utils/ipfs.ts`
5. **DAS Scanner** — `lib/dasScanner.ts` (fetch + paginate)
6. **Collection Verifier** — `lib/collectionVerifier.ts` (floor prices)
7. **Spam Scorer** — `lib/spamScorer.ts` (categorization logic)
8. **Proof Fetcher** — `lib/proofFetcher.ts`
9. **Burn Builder** — `lib/burnBuilder.ts`
10. **Zustand store** — `hooks/useCNFTStore.ts`
11. **Scanner hook** — `hooks/useCNFTScanner.ts`
12. **Burner hook** — `hooks/useCNFTBurner.ts`
13. **UI — atoms** — `SpamScoreBadge`, `CNFTImageThumbnail` (with virtual scroll)
14. **UI — rows** — `CNFTItemRow`
15. **UI — sections** — `CNFTCategorySection`
16. **UI — modals** — `BurnConfirmModal` (with 3-second delay), `BurnProgressModal`
17. **UI — card** — `CNFTCleanerCard`
18. **Module index** — `src/modules/cnft-cleaner/index.ts`
19. **ScanPage integration** — Add card, update summary
20. **Analytics** — Firebase events
21. **TypeScript** — `tsc --noEmit` zero errors
22. **Build** — `npm run build` success

---

## 17. Testing Checklist

**Scanner**
- [ ] cNFTs fetched correctly via Helius DAS API
- [ ] Pagination works for wallets with >1000 cNFTs
- [ ] Compressed assets correctly filtered from non-compressed
- [ ] Spam scoring categorizes known spam correctly
- [ ] Verified collections never auto-selected
- [ ] Floor prices fetched and applied where available
- [ ] Empty wallet (no cNFTs) handled gracefully

**Burn Flow**
- [ ] Proofs fetched correctly for selected items
- [ ] Burn transactions build without error (check serialized size < 1232 bytes)
- [ ] Session fee included in first transaction only
- [ ] Burn executes successfully for a real spam cNFT
- [ ] Confirmed burned cNFT no longer appears in DAS scan
- [ ] Verified items cannot be selected or burned
- [ ] Cancel at confirm modal sends zero transactions
- [ ] 3-second delay on confirm button works
- [ ] Partial success case handled and shown correctly

**Performance**
- [ ] Virtual scrolling renders 500+ items without lag
- [ ] Images lazy load correctly (not all at once)
- [ ] IPFS fallback gateway triggered when primary fails
- [ ] Scan completes in under 30 seconds for 500 cNFTs

**Module Independence**
- [ ] Only `CNFTCleanerCard` imported in ScanPage
- [ ] No imports from other engine modules
- [ ] `tsc --noEmit` zero errors
- [ ] `npm run build` success

---

*End of Engine 6 Specification*
*Version 1.0 — Independent module extending SolHunt (Engines 1–5 already built)*
