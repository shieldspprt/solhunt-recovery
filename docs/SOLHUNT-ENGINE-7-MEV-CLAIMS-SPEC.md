# ⚡ SolHunt — Engine 7: MEV & Priority Fee Claims Aggregator
### Complete Build Specification for AI Agent (Claude Opus 4.6)
### Status: New Engine — Extends Engine 4 (Staking Ticket Finder)
### No competition. No partnerships needed. Revenue from day one.

---

## AGENT CONTEXT — READ FIRST

You are adding **Engine 7** to the SolHunt wallet recovery suite.

**Engines 1–5 are already built and working:**
- Engine 1: Permission Revocation
- Engine 2: Account Rent Reclaimer
- Engine 3: Dust Consolidator
- Engine 4: Staking Ticket Finder ← Engine 7 EXTENDS this
- Engine 5: LP Fee Harvester

**Engine 6 (cNFT Spam Cleaner) is rolled back — do not reference it.**

**Engine 7 architecture decision:**
Engine 7 is NOT a fully standalone module. It is an **extension of Engine 4**.
Engine 4 already scans native stake accounts and identifies validators.
Engine 7 reuses that scan data and adds a new sub-section to Engine 4's card:
"MEV & Priority Fee Claims" — shown after staking tickets in the same card.

Code lives in: `src/modules/staking/` (Engine 4's module)
New files are added to this existing module — not a new top-level module.

**Do NOT touch or refactor Engines 1, 2, 3, or 5.**

---

## PART 1 — WHY THIS ENGINE EXISTS

### The Background

Jito tips account for nearly 50% of Solana's REV, having paid out $674 million to stakers and validators.

TipRouter already standardizes the distribution of Jito tips (over 50% of Solana's REV). It has processed upwards of $250M since its inception in February.

Priority fees make up roughly 35-40% of Solana's REV. TipRouter now distributes priority fees to stakers — unlocking a significant rewards stream for stakers, maintaining economic alignment with validators.

**The critical distinction most users miss:**

- **JitoSOL holders:** MEV rewards auto-compound into the LST exchange rate.
  No claim needed. This engine does NOT apply to them.

- **Native SOL stakers delegated to Jito-running validators:**
  MEV tips and priority fee rewards accumulate in per-epoch
  TipDistributionAccounts (TDAs) and ARE claimable separately.
  These rewards DO NOT auto-compound. They sit there until claimed.
  Most users have NO idea this money exists.

**This is the gap SolHunt fills.**

Engine 4 already finds native stake accounts. Engine 7 adds:
for each native stake account, check if its validator runs Jito client,
then check the TipRouter merkle tree for claimable MEV + priority fee rewards,
aggregate all of it, and let the user claim everything in one session.

### Why No Competition

- Most Solana wallet UIs don't surface MEV claims at all
- jito.network/rewards shows rewards but only if you go there specifically
- No tool aggregates claimable MEV across multiple stake accounts in one click
- Most native stakers don't even know MEV rewards are claimable separately
- SolHunt already has their wallet connected and their stake accounts scanned
- This is the most natural value-add to Engine 4 imaginable

### Why Revenue From Day One

The Jito staker rewards API is public and free.
No partner API key required.
No protocol integration work.
The merkle proof data needed to build claim transactions is returned by the API.
Build time: 1–2 weeks.
Revenue from first user who claims.

---

## PART 2 — HOW JITO MEV CLAIMS WORK (Technical Foundation)

### 2.1 The On-Chain Architecture

The tip distribution program is responsible for collecting and distributing MEV to validators and stakers. Every epoch, the validator client creates a unique TipDistributionAccount derived by the epoch and vote account public key. The validator client then uses this TipDistributionAccount to aggregate MEV paid out to their account over the entire epoch. Once the epoch is over, a validator (or delegate) takes a snapshot of the last slot in the previous epoch, generates a merkle tree containing the claims for each validator and stake account, and uploads the root on-chain. Then validators and stakers can claim MEV (or have others claim on their behalf) in the form of an airdrop.

**Key programs:**
```
Tip Distribution Program:  4R3gSG8BpU4t19KYj8CfnbtRpnT8gtk4dvTHxVRwc2r7
Tip Payment Program:       T1pyyaTNZsKv2WcRAB8oVnk93mLJw2XzjtVYqCsaHqt
```

**TipDistributionAccount (TDA) derivation:**
```
PDA seeds: [vote_account_pubkey, epoch_as_u64_le_bytes]
Program:   Tip Distribution Program
```

Each validator running Jito-Solana has one TDA per epoch.
Tips for that epoch accumulate in the TDA.
After epoch closes: merkle tree computed, root uploaded on-chain.
Stakers claim pro-rata based on their stake weight that epoch.

### 2.2 TipRouter NCN — What Changed in 2025

TipRouter operators take a snapshot of Solana validator and stake accounts at the end of the last slot of each epoch. Operators calculate the distribution split. Once quorum is reached, the winning merkle root is set. Rewards are distributed via merkle trees for gas-efficient claiming.

The TipRouter NCN (launched February 2025) decentralized this process.
It also added priority fee distribution:

Priority Fees: TipRouter now distributes priority fees (commonly referred to as block rewards) to stakers.

**This means Engine 7 finds TWO types of claimable rewards:**
1. MEV tip rewards (has existed since 2022, now via TipRouter)
2. Priority fee rewards (new in 2025 via TipRouter upgrade)

Both are queried via the same API. Both are claimed via the same mechanism.

### 2.3 The Jito Claims API

Purpose: Retrieve individual claimable MEV and priority fee rewards from the tip distribution merkle trees. This includes both: Rewards claimable by actual stakers (delegators) who have staked SOL with validators.

**Base URL:** `https://kobe.mainnet.jito.network`

**Endpoint 1 — Staker Rewards (PRIMARY — used by Engine 7):**
```
GET /api/v1/staker_rewards?wallet=<wallet_address>&limit=<N>
OR
POST /api/v1/staker_rewards
Body: { "wallet": "<wallet_address>", "limit": 100 }
```

**Response shape:**
```json
{
  "rewards": [
    {
      "stake_account": "ABC123...",
      "vote_account": "DEF456...",
      "epoch": 678,
      "reward_lamports": 15420000,
      "priority_fee_lamports": 3280000,
      "mev_commission_bps": 800,
      "priority_fee_commission_bps": 1000,
      "claim_status_account": "GHI789...",
      "is_claimed": false,
      "merkle_proof": ["node1...", "node2...", "..."],
      "merkle_root": "root_hash...",
      "tip_distribution_account": "JKL012..."
    }
  ],
  "total_count": 14
}
```

**Key fields:**
- `reward_lamports` — claimable MEV tips for this stake account this epoch
- `priority_fee_lamports` — claimable priority fees for this stake account this epoch
- `is_claimed` — if true, already claimed — skip this entry
- `merkle_proof` — the proof nodes needed to build the claim transaction
- `tip_distribution_account` — the TDA address (needed as account in claim instruction)
- `claim_status_account` — tracks whether claim has been made (checked on-chain)

**Endpoint 2 — Validator Rewards (for showing validator context):**
```
GET /api/v1/validator_rewards?epoch=<N>&limit=<N>
POST /api/v1/validator_rewards
Body: { "epoch": 678 }
```

**API caching:** The API implements caching with a 60-second lifespan to ensure optimal performance.

### 2.4 Claim Instruction (On-Chain)

To claim MEV rewards, submit a transaction with the `claim` instruction
on the Tip Distribution Program:

```typescript
// Accounts needed for claim instruction:
const claimIx = new TransactionInstruction({
  programId: new PublicKey(TIP_DISTRIBUTION_PROGRAM_ID),
  keys: [
    { pubkey: tipDistributionAccount, isSigner: false, isWritable: true },
    { pubkey: claimStatusAccount,     isSigner: false, isWritable: true },
    { pubkey: claimant,               isSigner: false, isWritable: true },
    { pubkey: payer,                  isSigner: true,  isWritable: true },
    { pubkey: SystemProgram.programId,isSigner: false, isWritable: false },
  ],
  // Instruction data: discriminator + amount + proof
  data: buildClaimInstructionData(amountLamports, merkleProof),
});
```

**Instruction data layout:**
```
[0..8]   — 8-byte discriminator: sha256("global:claim")[0..8]
[8..16]  — amount as u64 little-endian (total lamports to claim)
[16..20] — proof length as u32 little-endian
[20..]   — proof nodes concatenated (32 bytes each)
```

**ClaimStatus PDA derivation:**
```typescript
const [claimStatusPDA] = PublicKey.findProgramAddressSync(
  [
    Buffer.from('claim_status'),
    claimantPubkey.toBuffer(),
    tipDistributionAccount.toBuffer(),
  ],
  new PublicKey(TIP_DISTRIBUTION_PROGRAM_ID)
);
```

**Verify claim not already made:**
Before building any claim instruction, fetch the claimStatusPDA account.
If it exists and is initialized — the claim was already made. Skip.
If it doesn't exist — claim is available.

**Note on priority fee claims:**
Priority fee claims use the same Tip Distribution Program but a different
TipDistributionAccount (separate PDA for priority fees vs MEV tips).
The staker_rewards API returns BOTH in the same response.
Engine 7 aggregates both reward types and claims them together where possible.

---

## PART 3 — FILE STRUCTURE

Engine 7 extends the existing staking module. New files only.
Do NOT modify existing Engine 4 files unless adding an import or hook call.

```
src/modules/staking/           ← Engine 4's existing module
│
├── [existing Engine 4 files — DO NOT MODIFY]
│
├── lib/
│   ├── [existing Engine 4 scanners]
│   │
│   ├── mevScanner.ts          ← NEW: Fetch claimable MEV via Jito API
│   └── mevClaimBuilder.ts     ← NEW: Build claim transactions
│
├── hooks/
│   ├── [existing Engine 4 hooks]
│   │
│   └── useMEVClaims.ts        ← NEW: MEV claim state + execution hook
│
└── components/
    ├── [existing Engine 4 components]
    │
    ├── MEVClaimsSection.tsx   ← NEW: Sub-section in Engine 4 card
    ├── MEVClaimRow.tsx        ← NEW: One row per claimable reward
    └── MEVClaimConfirmModal.tsx ← NEW: Confirm before claiming
```

**Integration point — Engine 4 card:**
```tsx
// In StakingCard.tsx (Engine 4's main card) — add after ticket section:
import { MEVClaimsSection } from './MEVClaimsSection';

// Inside the card, after the staking tickets section:
{scanStatus === 'scan_complete' && (
  <>
    {/* existing ticket sections */}
    <MEVClaimsSection />   {/* ← NEW */}
  </>
)}
```

---

## PART 4 — TYPESCRIPT TYPES

File: `src/modules/staking/types.ts` — ADD these types (do not remove existing)

```typescript
// ─── MEV CLAIM TYPES ──────────────────────────────────────────────────────

export interface MEVClaimItem {
  // Identity
  stakeAccount: string;           // Stake account pubkey
  voteAccount: string;            // Validator vote account
  validatorName: string | null;   // Human readable (from Jito API or null)
  epoch: number;                  // Epoch this reward is from

  // Amounts
  mevLamports: number;            // Claimable MEV tip rewards
  priorityFeeLamports: number;    // Claimable priority fee rewards
  totalLamports: number;          // mevLamports + priorityFeeLamports
  totalSOL: number;               // totalLamports / LAMPORTS_PER_SOL
  estimatedValueUSD: number;      // totalSOL * solPrice

  // Commission (shown for transparency)
  mevCommissionBps: number;       // Validator's MEV commission
  priorityFeeCommissionBps: number;

  // Claim data (needed to build transaction)
  tipDistributionAccount: string;
  claimStatusAccount: string;
  merkleProof: string[];          // Base58 encoded proof nodes
  merkleRoot: string;

  // State
  isClaimed: boolean;             // Already claimed — should be filtered out
  isSelected: boolean;            // User selection for batch claim
}

export interface MEVScanResult {
  scannedAt: Date;
  totalItems: number;
  totalClaimableSOL: number;
  totalClaimableUSD: number;
  items: MEVClaimItem[];
  epochsScanned: number[];        // Which epochs had claimable rewards
  oldestEpoch: number | null;     // Oldest unclaimed epoch found
  newestEpoch: number | null;     // Most recent unclaimed epoch found
}

export interface MEVClaimEstimate {
  selectedCount: number;
  totalClaimSOL: number;
  totalClaimUSD: number;
  serviceFeeSOL: number;          // 5% of totalClaimSOL
  serviceFeeLamports: number;
  networkFeeSOL: number;          // ~0.000005 * tx count
  netReceivedSOL: number;         // totalClaimSOL - serviceFeeSOL
}

export interface MEVClaimResultItem {
  stakeAccount: string;
  epoch: number;
  success: boolean;
  signature: string | null;
  claimedLamports: number;
  errorMessage: string | null;
}

export interface MEVClaimResult {
  success: boolean;
  claimedCount: number;
  failedCount: number;
  totalClaimedLamports: number;
  totalClaimedSOL: number;
  serviceFeeSignature: string | null;
  signatures: string[];
  items: MEVClaimResultItem[];
}

export type MEVScanStatus =
  | 'idle'
  | 'scanning'
  | 'scan_complete'
  | 'no_rewards'
  | 'error';

export type MEVClaimStatus =
  | 'idle'
  | 'awaiting_confirmation'
  | 'claiming'
  | 'sending_fee'
  | 'complete'
  | 'error';
```

---

## PART 5 — CONSTANTS

File: `src/modules/staking/constants.ts` — ADD these (do not remove existing)

```typescript
// ─── MEV CLAIM CONSTANTS ──────────────────────────────────────────────────

// Jito on-chain programs
export const TIP_DISTRIBUTION_PROGRAM_ID = '4R3gSG8BpU4t19KYj8CfnbtRpnT8gtk4dvTHxVRwc2r7';
export const TIP_PAYMENT_PROGRAM_ID      = 'T1pyyaTNZsKv2WcRAB8oVnk93mLJw2XzjtVYqCsaHqt';

// Jito API
export const JITO_KOBE_API_BASE = 'https://kobe.mainnet.jito.network';
export const JITO_STAKER_REWARDS_ENDPOINT = '/api/v1/staker_rewards';

// Claim instruction discriminator
// sha256("global:claim")[0..8] — first 8 bytes
export const CLAIM_DISCRIMINATOR = Buffer.from([
  62, 198, 214, 193, 213, 159, 108, 210
]);
// ⚠️ AGENT: Verify this discriminator against the actual Jito tip distribution
// program IDL before build. It may differ from the Bubblegum discriminator.
// The correct discriminator can be found in the Jito distributor repo IDL.

// Fees
export const MEV_SERVICE_FEE_PERCENT  = 5;
export const MEV_SERVICE_FEE_DENOMINATOR = 100;

// Limits
export const MEV_MAX_CLAIMS_PER_TX    = 4;   // Claims per transaction
export const MEV_API_PAGE_SIZE        = 100;  // Items per API call

// Minimum claimable threshold
// Don't show rewards under this amount (dust, network fee cost > claim value)
export const MEV_MIN_CLAIM_LAMPORTS   = 5000; // 0.000005 SOL minimum

// Claim instruction seeds
export const CLAIM_STATUS_SEED = Buffer.from('claim_status');
```

---

## PART 6 — MEV SCANNER

File: `src/modules/staking/lib/mevScanner.ts`

```typescript
/**
 * Fetch all claimable MEV and priority fee rewards for a wallet
 * via the Jito kobe.mainnet API.
 *
 * This API returns rewards across ALL epochs, ALL stake accounts,
 * for any wallet that has native SOL staked to Jito-running validators.
 *
 * Returns [] if wallet has no native stake with Jito validators.
 * Never throws — returns empty array on any API error.
 */
export async function fetchMEVClaims(
  walletAddress: string
): Promise<MEVClaimItem[]>
```

Implementation:

```typescript
export async function fetchMEVClaims(
  walletAddress: string
): Promise<MEVClaimItem[]> {

  try {
    const response = await withTimeout(
      fetch(`${JITO_KOBE_API_BASE}${JITO_STAKER_REWARDS_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          limit: MEV_API_PAGE_SIZE,
        }),
      }),
      10_000,
      'MEV_API_TIMEOUT'
    );

    if (!response.ok) {
      logger.warn('MEV API non-200', response.status);
      return [];
    }

    const data = await response.json();
    const rewards: JitoStakerReward[] = data?.rewards ?? [];

    // Filter and transform
    return rewards
      .filter(r =>
        !r.is_claimed &&
        (r.reward_lamports + r.priority_fee_lamports) >= MEV_MIN_CLAIM_LAMPORTS
      )
      .map(r => transformReward(r));

  } catch (err) {
    logger.error('fetchMEVClaims failed', err);
    return []; // Never block the rest of Engine 4 scan
  }
}

function transformReward(r: JitoStakerReward): MEVClaimItem {
  const totalLamports = (r.reward_lamports ?? 0) + (r.priority_fee_lamports ?? 0);
  const totalSOL = totalLamports / LAMPORTS_PER_SOL;

  return {
    stakeAccount:             r.stake_account ?? '',
    voteAccount:              r.vote_account ?? '',
    validatorName:            null,  // Enriched later if needed
    epoch:                    r.epoch ?? 0,
    mevLamports:              r.reward_lamports ?? 0,
    priorityFeeLamports:      r.priority_fee_lamports ?? 0,
    totalLamports,
    totalSOL,
    estimatedValueUSD:        totalSOL * getCachedSOLPrice(),
    mevCommissionBps:         r.mev_commission_bps ?? 0,
    priorityFeeCommissionBps: r.priority_fee_commission_bps ?? 0,
    tipDistributionAccount:   r.tip_distribution_account ?? '',
    claimStatusAccount:       r.claim_status_account ?? '',
    merkleProof:              r.merkle_proof ?? [],
    merkleRoot:               r.merkle_root ?? '',
    isClaimed:                r.is_claimed ?? false,
    isSelected:               true,  // Default: select all
  };
}

// Raw Jito API response type
interface JitoStakerReward {
  stake_account: string;
  vote_account: string;
  epoch: number;
  reward_lamports: number;
  priority_fee_lamports: number;
  mev_commission_bps: number;
  priority_fee_commission_bps: number;
  claim_status_account: string;
  is_claimed: boolean;
  merkle_proof: string[];
  merkle_root: string;
  tip_distribution_account: string;
}
```

**API pagination:**
If `total_count` > `MEV_API_PAGE_SIZE`, fetch additional pages:
```typescript
// Add after first fetch if needed:
if (data.total_count > MEV_API_PAGE_SIZE) {
  const additionalPages = Math.ceil(
    (data.total_count - MEV_API_PAGE_SIZE) / MEV_API_PAGE_SIZE
  );
  for (let page = 1; page <= additionalPages; page++) {
    const pageResponse = await fetch(URL, {
      body: JSON.stringify({ wallet, limit: MEV_API_PAGE_SIZE, offset: page * MEV_API_PAGE_SIZE })
    });
    // accumulate results
  }
}
```

**On-chain verification (optional but recommended):**
For each claim, verify the `claimStatusAccount` does NOT exist on-chain
before showing it as claimable. The API cache may lag.
Use `connection.getAccountInfo(claimStatusPDA)` — if account exists, skip.

---

## PART 7 — CLAIM BUILDER

File: `src/modules/staking/lib/mevClaimBuilder.ts`

```typescript
/**
 * Build batched claim transactions for selected MEV rewards.
 * 
 * Each transaction claims MEV_MAX_CLAIMS_PER_TX rewards.
 * The service fee (5% of total claimed) is appended to the LAST transaction.
 * 
 * Important: MEV tip claims and priority fee claims for the same
 * stake account + epoch may be in separate TDAs — handle both.
 */
export async function buildMEVClaimTransactions(
  items: MEVClaimItem[],
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<Transaction[]>
```

Implementation:

```typescript
export async function buildMEVClaimTransactions(
  items: MEVClaimItem[],
  walletPublicKey: PublicKey,
  connection: Connection
): Promise<Transaction[]> {

  const transactions: Transaction[] = [];
  const batches = chunk(items, MEV_MAX_CLAIMS_PER_TX);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  // Calculate total service fee
  const totalLamports = items.reduce((sum, i) => sum + i.totalLamports, 0);
  const serviceFeeLamports = Math.floor(
    (totalLamports * MEV_SERVICE_FEE_PERCENT) / MEV_SERVICE_FEE_DENOMINATOR
  );

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const tx = new Transaction();
    tx.feePayer = walletPublicKey;
    tx.recentBlockhash = blockhash;

    // Add claim instruction for each item in batch
    for (const item of batch) {
      const claimIx = buildSingleClaimInstruction(item, walletPublicKey);
      if (claimIx) tx.add(claimIx);
    }

    // Add service fee to LAST transaction only
    if (batchIdx === batches.length - 1 && serviceFeeLamports > 0) {
      tx.add(SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey:   new PublicKey(import.meta.env.VITE_TREASURY_WALLET),
        lamports:   serviceFeeLamports,
      }));
    }

    // Safety check: verify transaction size
    const serialized = tx.serialize({ requireAllSignatures: false });
    if (serialized.length > 1200) {
      // Split this batch further — reduce to 2 claims per tx
      logger.warn('MEV claim tx too large, reducing batch size');
      // Re-build with smaller batch — implementation detail
    }

    transactions.push(tx);
  }

  return transactions;
}

function buildSingleClaimInstruction(
  item: MEVClaimItem,
  walletPublicKey: PublicKey
): TransactionInstruction | null {

  try {
    // Derive ClaimStatus PDA
    const [claimStatusPDA] = PublicKey.findProgramAddressSync(
      [
        CLAIM_STATUS_SEED,
        walletPublicKey.toBuffer(),
        new PublicKey(item.tipDistributionAccount).toBuffer(),
      ],
      new PublicKey(TIP_DISTRIBUTION_PROGRAM_ID)
    );

    // Build merkle proof buffer
    const proofNodes = item.merkleProof.map(node =>
      Buffer.from(bs58.decode(node))
    );

    // Build instruction data
    const data = buildClaimInstructionData(
      item.totalLamports,
      proofNodes
    );

    return new TransactionInstruction({
      programId: new PublicKey(TIP_DISTRIBUTION_PROGRAM_ID),
      keys: [
        {
          pubkey: new PublicKey(item.tipDistributionAccount),
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: claimStatusPDA,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: walletPublicKey,   // claimant = stake owner
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: walletPublicKey,   // payer of account creation
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });

  } catch (err) {
    logger.error('buildSingleClaimInstruction failed', err);
    return null;
  }
}

function buildClaimInstructionData(
  amountLamports: number,
  proofNodes: Buffer[]
): Buffer {

  const proofLength = proofNodes.length;
  const dataLength = 8 + 8 + 4 + (proofLength * 32);
  const buf = Buffer.alloc(dataLength);
  let offset = 0;

  // 8-byte discriminator
  CLAIM_DISCRIMINATOR.copy(buf, offset);
  offset += 8;

  // Amount as u64 little-endian
  buf.writeBigUInt64LE(BigInt(amountLamports), offset);
  offset += 8;

  // Proof length as u32
  buf.writeUInt32LE(proofLength, offset);
  offset += 4;

  // Proof nodes
  for (const node of proofNodes) {
    node.copy(buf, offset);
    offset += 32;
  }

  return buf;
}
```

---

## PART 8 — HOOK

File: `src/modules/staking/hooks/useMEVClaims.ts`

```typescript
/**
 * Hook managing MEV claim scan and execution state.
 * Integrates with Engine 4's existing Zustand store.
 * 
 * Scan is triggered by Engine 4's main scan — NOT separately.
 * Claims are executed independently.
 */
export function useMEVClaims() {

  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();

  // Store MEV state in Engine 4's Zustand store (new slice)
  const mevScanStatus   = useStakingStore(s => s.mevScanStatus);
  const mevScanResult   = useStakingStore(s => s.mevScanResult);
  const mevClaimStatus  = useStakingStore(s => s.mevClaimStatus);
  const mevClaimResult  = useStakingStore(s => s.mevClaimResult);
  const selectedMEVIds  = useStakingStore(s => s.selectedMEVIds);
  const store           = useStakingStore();

  // Called by Engine 4's main scan — not directly by user
  const scanMEVClaims = useCallback(async () => {
    if (!publicKey) return;

    store.setMEVScanStatus('scanning');

    const items = await fetchMEVClaims(publicKey.toString());

    if (items.length === 0) {
      store.setMEVScanStatus('no_rewards');
      store.setMEVScanResult(null);
      return;
    }

    const result: MEVScanResult = {
      scannedAt:         new Date(),
      totalItems:        items.length,
      totalClaimableSOL: items.reduce((s, i) => s + i.totalSOL, 0),
      totalClaimableUSD: items.reduce((s, i) => s + i.estimatedValueUSD, 0),
      items,
      epochsScanned:     [...new Set(items.map(i => i.epoch))].sort(),
      oldestEpoch:       Math.min(...items.map(i => i.epoch)),
      newestEpoch:       Math.max(...items.map(i => i.epoch)),
    };

    store.setMEVScanResult(result);
    store.setMEVScanStatus('scan_complete');
    store.setSelectedMEVIds(items.map(i => `${i.stakeAccount}-${i.epoch}`));

    logEvent('mev_scan_complete', {
      total:  result.totalItems,
      solValue: result.totalClaimableSOL,
    });

  }, [publicKey]);

  const selectedItems = useMemo(() => {
    const allItems = mevScanResult?.items ?? [];
    return allItems.filter(i =>
      selectedMEVIds.includes(`${i.stakeAccount}-${i.epoch}`)
    );
  }, [mevScanResult, selectedMEVIds]);

  const claimEstimate = useMemo((): MEVClaimEstimate | null => {
    if (selectedItems.length === 0) return null;
    const totalLamports = selectedItems.reduce((s, i) => s + i.totalLamports, 0);
    const totalSOL = totalLamports / LAMPORTS_PER_SOL;
    const serviceFeeLamports = Math.floor(
      (totalLamports * MEV_SERVICE_FEE_PERCENT) / MEV_SERVICE_FEE_DENOMINATOR
    );
    const txCount = Math.ceil(selectedItems.length / MEV_MAX_CLAIMS_PER_TX);

    return {
      selectedCount:    selectedItems.length,
      totalClaimSOL:    totalSOL,
      totalClaimUSD:    totalSOL * getCachedSOLPrice(),
      serviceFeeSOL:    serviceFeeLamports / LAMPORTS_PER_SOL,
      serviceFeeLamports,
      networkFeeSOL:    txCount * 0.000005,
      netReceivedSOL:   totalSOL - (serviceFeeLamports / LAMPORTS_PER_SOL),
    };
  }, [selectedItems]);

  const initiateClaim = useCallback(async () => {
    if (!publicKey || selectedItems.length === 0) return;
    store.setMEVClaimStatus('awaiting_confirmation');
  }, [publicKey, selectedItems]);

  const executeClaim = useCallback(async () => {
    if (!publicKey || !signTransaction || !sendTransaction) return;

    store.setMEVClaimStatus('claiming');

    try {
      const transactions = await buildMEVClaimTransactions(
        selectedItems,
        publicKey,
        connection
      );

      const signatures: string[] = [];
      const resultItems: MEVClaimResultItem[] = [];
      let claimedLamports = 0;

      for (let i = 0; i < transactions.length; i++) {
        store.setMEVProgressText(
          `Claiming batch ${i + 1} of ${transactions.length}...`
        );

        try {
          const signed = await signTransaction(transactions[i]);
          const sig    = await sendTransaction(signed, connection);
          await confirmTransactionRobust(connection, sig, 'confirmed');

          signatures.push(sig);

          // Mark items in this batch as claimed
          const batchItems = selectedItems.slice(
            i * MEV_MAX_CLAIMS_PER_TX,
            (i + 1) * MEV_MAX_CLAIMS_PER_TX
          );
          batchItems.forEach(item => {
            resultItems.push({
              stakeAccount:    item.stakeAccount,
              epoch:           item.epoch,
              success:         true,
              signature:       sig,
              claimedLamports: item.totalLamports,
              errorMessage:    null,
            });
            claimedLamports += item.totalLamports;
          });

        } catch (txErr: any) {
          const batchItems = selectedItems.slice(
            i * MEV_MAX_CLAIMS_PER_TX,
            (i + 1) * MEV_MAX_CLAIMS_PER_TX
          );
          batchItems.forEach(item => {
            resultItems.push({
              stakeAccount:    item.stakeAccount,
              epoch:           item.epoch,
              success:         false,
              signature:       null,
              claimedLamports: 0,
              errorMessage:    txErr.message ?? 'Transaction failed',
            });
          });
        }
      }

      const claimed = resultItems.filter(r => r.success).length;
      const failed  = resultItems.filter(r => !r.success).length;

      store.setMEVClaimResult({
        success:               claimed > 0,
        claimedCount:          claimed,
        failedCount:           failed,
        totalClaimedLamports:  claimedLamports,
        totalClaimedSOL:       claimedLamports / LAMPORTS_PER_SOL,
        serviceFeeSignature:   signatures[signatures.length - 1] ?? null,
        signatures,
        items:                 resultItems,
      });

      store.setMEVClaimStatus('complete');

      logEvent('mev_claim_complete', {
        claimed,
        failed,
        solClaimed: claimedLamports / LAMPORTS_PER_SOL,
      });

    } catch (err: any) {
      store.setMEVClaimStatus('error');
      store.setMEVClaimError('Claim failed. Your rewards were not affected.');
    }
  }, [publicKey, signTransaction, sendTransaction, selectedItems, connection]);

  return {
    // Scan
    mevScanStatus,
    mevScanResult,
    scanMEVClaims,

    // Selection
    selectedItems,
    toggleMEVItem:    store.toggleMEVItem,
    selectAllMEV:     store.selectAllMEV,
    deselectAllMEV:   store.deselectAllMEV,

    // Claim
    claimEstimate,
    mevClaimStatus,
    mevClaimResult,
    initiateClaim,
    executeClaim,
    cancelClaim: () => store.resetMEVClaim(),
  };
}
```

---

## PART 9 — UI COMPONENTS

### 9.1 MEVClaimsSection.tsx

Sub-section rendered inside Engine 4's card.
Positioned after staking tickets, before the total summary.

**State: scanning (Engine 4 main scan in progress)**
```
⚡ MEV & PRIORITY FEE CLAIMS
Scanning for claimable rewards...
```

**State: no_rewards**
```
⚡ MEV & PRIORITY FEE CLAIMS
No unclaimed MEV or priority fee rewards found.
(Only applies to native SOL staked with Jito validators)
```

**State: scan_complete with results**
```
⚡ MEV & PRIORITY FEE CLAIMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [MEVClaimRow] × N items
  
  ─────────────────────────────────────
  Selected: 8 rewards across 3 epochs

  MEV tips:           0.042 SOL
  Priority fees:      0.018 SOL
  Total claimable:    0.060 SOL (~$7.80)

  Service fee (5%):   0.003 SOL
  You receive:        0.057 SOL (~$7.41)

  [Claim MEV Rewards →]
```

**Educational callout (show always when rewards found):**
```
ℹ️  What are these rewards?
When your SOL is staked with validators running Jito client,
you earn MEV tips + priority fees each epoch.
These are separate from your base staking rewards
and must be claimed manually.
```

### 9.2 MEVClaimRow.tsx

One row per claimable reward item. Compact.

```
☑  Epoch 678  |  Stake: ABC...XYZ  |  Validator: XYZ...123
   MEV: 0.0048 SOL  +  Priority: 0.0019 SOL  =  0.0067 SOL (~$0.87)
   Commission: 8% MEV · 10% priority
```

Clicking row expands:
- Full stake account address (with Solscan link)
- Full validator vote account (with Solscan link)
- Epoch number
- MEV vs priority fee breakdown
- Validator commission rates

### 9.3 MEVClaimConfirmModal.tsx

```
⚡ CLAIM MEV & PRIORITY FEE REWARDS

You are about to claim staking rewards that have
accumulated but were never automatically collected.

Selected:        8 rewards (across 3 epochs)
Total claimable: 0.060 SOL (~$7.80)

Breakdown:
  MEV tip rewards:      0.042 SOL
  Priority fee rewards: 0.018 SOL

Service fee (5%):      -0.003 SOL
You receive:            0.057 SOL (~$7.41)

Network fees:          ~0.000025 SOL

This claim is safe and reversible to the protocol.
Your wallet balance will increase after confirmation.

[Cancel]   [Claim 0.057 SOL →]
```

Note: "Reversible" is accurate here — unlike burns or closes,
claiming is non-destructive. Use softer language than Engine 6.

---

## PART 10 — INTEGRATION WITH ENGINE 4 SCAN

Engine 7's scan is triggered automatically when Engine 4 runs.
Add one call to the existing Engine 4 scan flow:

```typescript
// In useStakingScanner.ts (Engine 4) — inside the main scan function,
// after staking tickets are found:

// Existing Engine 4 scan logic
const tickets = await scanAllProtocols(publicKey);
store.setTickets(tickets);

// NEW — Engine 7 scan (runs in parallel, doesn't block tickets)
scanMEVClaims().catch(err => {
  logger.error('MEV scan failed silently', err);
  // Never fail the main Engine 4 scan because of MEV
});
```

The MEV scan runs in the background. If it fails — Engine 4 still works.
If it succeeds — the MEV section appears in the card automatically.

---

## PART 11 — ZUSTAND STORE ADDITIONS

Add these fields to Engine 4's existing Zustand store:

```typescript
// Add to StakingStoreState interface:
mevScanStatus:   MEVScanStatus;
mevScanResult:   MEVScanResult | null;
mevScanError:    string | null;
mevClaimStatus:  MEVClaimStatus;
mevClaimResult:  MEVClaimResult | null;
mevClaimError:   string | null;
selectedMEVIds:  string[];              // `${stakeAccount}-${epoch}`
mevProgressText: string;

// Add to store actions:
setMEVScanStatus:   (status: MEVScanStatus) => void;
setMEVScanResult:   (result: MEVScanResult | null) => void;
setMEVScanError:    (err: string | null) => void;
setMEVClaimStatus:  (status: MEVClaimStatus) => void;
setMEVClaimResult:  (result: MEVClaimResult | null) => void;
setMEVClaimError:   (err: string | null) => void;
setSelectedMEVIds:  (ids: string[]) => void;
toggleMEVItem:      (id: string) => void;
selectAllMEV:       () => void;
deselectAllMEV:     () => void;
setMEVProgressText: (text: string) => void;
resetMEVClaim:      () => void;

// Initial values:
mevScanStatus:   'idle',
mevScanResult:   null,
mevScanError:    null,
mevClaimStatus:  'idle',
mevClaimResult:  null,
mevClaimError:   null,
selectedMEVIds:  [],
mevProgressText: '',
```

---

## PART 12 — ANALYTICS EVENTS

```typescript
logEvent('mev_scan_started');

logEvent('mev_scan_complete', {
  totalItems:       number,
  totalSOL:         number,
  epochsFound:      number,
  oldestEpoch:      number | null,
});

logEvent('mev_claim_initiated', {
  selectedCount:    number,
  totalSOL:         number,
  serviceFeeSOL:    number,
});

logEvent('mev_claim_complete', {
  success:          boolean,
  claimedCount:     number,
  failedCount:      number,
  totalClaimedSOL:  number,
});
```

---

## PART 13 — ERROR MESSAGES

Add to `src/config/constants.ts`:

```typescript
MEV_SCAN_FAILED:        'Could not fetch MEV rewards. This is optional — your staking tickets are unaffected.',
MEV_CLAIM_FAILED:       'Claim transaction failed. Your unclaimed rewards are still waiting.',
MEV_CLAIM_PARTIAL:      'Some rewards were claimed. Check details below.',
MEV_ALREADY_CLAIMED:    'These rewards have already been claimed.',
MEV_PROOF_INVALID:      'Reward proof is invalid or expired. This epoch may have been recalculated.',
MEV_API_UNAVAILABLE:    'Jito rewards API is temporarily unavailable. Try again later.',
```

---

## PART 14 — SECURITY REQUIREMENTS

**1. Treasury wallet verification**
The service fee transfer must go to `VITE_TREASURY_WALLET`.
Same verification as all other engines — verify at tx build time.

**2. Claim amount integrity**
The claimed amount in the instruction must match what the API reported.
Never modify `totalLamports` between API fetch and instruction build.

**3. On-chain claim status verification**
Before showing any reward as claimable, verify the `claimStatusAccount`
does NOT exist on-chain (indicating the claim has already been made).
The API has 60-second caching — on-chain verification is the source of truth.

```typescript
async function verifyClaimNotMade(
  item: MEVClaimItem,
  connection: Connection
): Promise<boolean> {
  try {
    const [claimStatusPDA] = PublicKey.findProgramAddressSync(
      [CLAIM_STATUS_SEED, walletPubkey.toBuffer(),
       new PublicKey(item.tipDistributionAccount).toBuffer()],
      new PublicKey(TIP_DISTRIBUTION_PROGRAM_ID)
    );
    const accountInfo = await connection.getAccountInfo(claimStatusPDA);
    return accountInfo === null; // null means not claimed
  } catch {
    return true; // If we can't verify, allow the claim attempt
  }
}
```

**4. API response validation**
Every field from the Jito API must be validated before use:
- `stake_account` — valid Solana public key
- `vote_account` — valid Solana public key
- `reward_lamports` — positive integer
- `merkle_proof` — array of valid base58 strings

**5. Program ID whitelist**
Add `TIP_DISTRIBUTION_PROGRAM_ID` to the transaction
instruction whitelist in the security layer.

---

## PART 15 — AGENT NOTES & CAVEATS

**⚠️ Verify before build:**

1. **Claim instruction discriminator:** The `CLAIM_DISCRIMINATOR` constant
   must be verified against the actual Jito tip distribution program IDL.
   Check the Jito Foundation GitHub repository for the current IDL:
   `https://github.com/jito-foundation/jito-programs`
   The discriminator may differ from what's shown here.

2. **Claim instruction layout:** The exact account ordering and
   instruction data layout must be verified against the live program IDL.
   Test on devnet before mainnet if possible.

3. **Priority fee claims vs MEV claims:** These may use separate
   TipDistributionAccounts. The API response indicates which is which.
   Verify whether they require separate claim instructions or can be
   batched into one instruction per epoch.

4. **API response schema:** The Jito API schema shown here is based on
   public documentation as of March 2026. Always fetch the actual API
   response first and verify field names match the TypeScript interfaces.

5. **Test with small amounts first:** Before deploying,
   test with a wallet that has a tiny MEV claim (< 0.01 SOL)
   to verify the full claim flow works before handling larger amounts.

---

## PART 16 — BUILD ORDER

1. Add types to `src/modules/staking/types.ts`
2. Add constants to `src/modules/staking/constants.ts`
3. Build `mevScanner.ts` — API fetch + transform
4. Test API call manually: `curl https://kobe.mainnet.jito.network/api/v1/staker_rewards?limit=2`
5. Verify actual API response shape against TypeScript interface
6. Build `mevClaimBuilder.ts` — transaction construction
7. Verify claim instruction discriminator from Jito IDL
8. Add MEV state to existing Zustand store
9. Build `useMEVClaims.ts` hook
10. Build `MEVClaimRow.tsx` component
11. Build `MEVClaimConfirmModal.tsx` component
12. Build `MEVClaimsSection.tsx` — main UI section
13. Integrate: add `scanMEVClaims()` call to Engine 4 scan
14. Integrate: add `<MEVClaimsSection />` to Engine 4 card
15. Add error messages to constants
16. Add analytics events
17. Add `TIP_DISTRIBUTION_PROGRAM_ID` to security whitelist
18. TypeScript strict check — zero errors
19. Build — `npm run build` success
20. Test on real wallet with known Jito stake

---

## PART 17 — TESTING CHECKLIST

**Scanner**
- [ ] API call succeeds for wallet with known Jito stake
- [ ] Empty result handled gracefully (no Jito stake)
- [ ] Already-claimed rewards filtered out (`is_claimed: true`)
- [ ] Rewards below minimum threshold filtered out
- [ ] API timeout handled — MEV section shows nothing, rest of Engine 4 unaffected
- [ ] On-chain claim status verification works

**Claim Builder**
- [ ] Claim instruction builds without error
- [ ] Instruction discriminator is correct (verified from IDL)
- [ ] Merkle proof is correctly decoded and placed in instruction data
- [ ] ClaimStatus PDA derivation is correct
- [ ] Service fee goes to treasury wallet only
- [ ] Transaction size under 1232 bytes for max batch size

**UI**
- [ ] Section doesn't appear when `mevScanStatus === 'no_rewards'`
- [ ] All items default to selected
- [ ] Deselect individual item works
- [ ] Select/deselect all works
- [ ] Claim estimate updates correctly when selection changes
- [ ] Confirm modal shows correct breakdown
- [ ] Progress modal updates per batch
- [ ] Success state shows solscan links for all signatures

**Integration**
- [ ] MEV scan failure does NOT prevent Engine 4 staking ticket results from showing
- [ ] MEV section appears within Engine 4 card (not a separate card)
- [ ] Engine 4 scan completion triggers MEV scan automatically
- [ ] TypeScript strict mode — zero errors
- [ ] `npm run build` — success

---

## APPENDIX — SCALE OF OPPORTUNITY

For context on why this engine matters:

Jito tips account for nearly 50% of Solana's REV, having paid out $674 million to stakers and validators.

TipRouter has processed upwards of $250M since its inception in February.

Priority fees make up roughly 35-40% of Solana's REV. Since SIMD-0096 passed, validators capture 100% of priority fees, and stakers do not realize any of this revenue stream — until validators opt to share via TipRouter.

The number of native SOL stakers who have never checked for
claimable MEV rewards is enormous. Engine 4 already has their
stake accounts. Engine 7 turns that into claimable value they
never knew existed.

---

*End of SolHunt Engine 7 Specification*
*MEV & Priority Fee Claims Aggregator*
*Extends Engine 4 (Staking Ticket Finder)*
*Revenue from day one — no partnerships required*
