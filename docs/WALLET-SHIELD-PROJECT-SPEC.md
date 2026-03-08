# 🛡️ Wallet Shield — Complete Project Specification
### For AI Agent Build (Claude Opus / Cursor / Windsurf)
### Stack: React + TypeScript + Firebase + Netlify

---

## ⚠️ READ THIS FIRST — Agent Instructions

You are building a **finance-grade, production-ready** Solana web application.
This is not a demo. Real users will connect real wallets with real money.

**Your non-negotiable principles throughout this build:**

1. **Never touch user funds** — The app is read-heavy. The only write operation is sending a `Revoke` instruction, which cannot move tokens.
2. **Never store private keys** — The app uses wallet adapter (Phantom, Backpack, etc.) exclusively. Private keys never touch your code.
3. **Fail loudly, not silently** — Every async operation must have try/catch. Every error must show the user a clear message.
4. **No action without confirmation** — Every transaction must show a clear "You are about to do X" modal before proceeding.
5. **Type everything strictly** — No `any` types. TypeScript strict mode is ON.
6. **Validate all inputs** — All public keys, addresses, and user inputs must be validated before use.
7. **Audit every dependency** — Use only well-known, maintained packages. Check npm package weekly downloads. Avoid unknown packages.

---

## 1. Project Overview

### What Is Wallet Shield?

A Solana web app that scans a user's wallet for dangerous **token delegations** — permissions that allow third-party programs to move the user's tokens — and revokes them safely in a single transaction.

### Why This Exists

When users interact with Solana DeFi protocols, they sometimes grant token "delegate" permissions. These permissions:
- Never expire on their own
- Can be granted by protocols the user has forgotten about
- If the original protocol is exploited, could allow an attacker to drain tokens
- Are invisible in most wallet UIs

This app makes the invisible visible and gives users one-click protection.

### Business Model

- **Scanning** is free — always
- **Revocation** charges a small service fee taken from the user's SOL (not tokens)
- Fee structure: Flat fee of **0.01 SOL per revocation session** (not per account — the whole batch)
- This fee is shown clearly before any transaction is signed
- Fee is sent to a hardcoded treasury wallet address defined in environment variables

### What the App Does NOT Do

- It does NOT custody funds at any point
- It does NOT store wallet addresses on a server (scans happen client-side via RPC)
- It does NOT require email or account creation
- It does NOT have a backend server — it is a static frontend + Firebase for analytics/logging only
- It does NOT send transactions without explicit user confirmation

---

## 2. Technical Stack

### Frontend
- **Framework:** React 18 with TypeScript (strict mode)
- **Build tool:** Vite
- **Styling:** Tailwind CSS v3
- **Component library:** shadcn/ui (for modals, buttons, cards, toasts)
- **State management:** Zustand (lightweight, simple)
- **Routing:** React Router v6

### Solana Integration
- **Wallet adapter:** `@solana/wallet-adapter-react` + `@solana/wallet-adapter-wallets`
  - Support: Phantom, Backpack, Solflare, Coinbase Wallet
- **Web3:** `@solana/web3.js` v1.x (stable — do NOT use v2 beta)
- **SPL Token:** `@solana/spl-token` (for token account parsing and revoke instructions)
- **RPC:** Helius (primary), public mainnet as fallback — URL from env vars

### Backend / Infrastructure
- **Firebase (Google):**
  - Firestore: Log scan events (wallet hash only — never full address), revocation counts, error rates
  - Analytics: Page views, scan completions, revocation completions
  - No Auth required — the app is wallet-authenticated only
- **Netlify:** Static site hosting with continuous deploy from GitHub
- **No custom backend server** — everything runs client-side

### Key Libraries (Full List)
```
@solana/web3.js
@solana/spl-token
@solana/wallet-adapter-react
@solana/wallet-adapter-base
@solana/wallet-adapter-wallets
@solana/wallet-adapter-react-ui
firebase
react
react-dom
react-router-dom
zustand
tailwindcss
@shadcn/ui
lucide-react
bs58
clsx
react-hot-toast
```

---

## 3. Repository Structure

```
wallet-shield/
├── public/
│   ├── favicon.ico
│   └── og-image.png               # Social share image
│
├── src/
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Router + Provider setup
│   │
│   ├── config/
│   │   ├── constants.ts           # All app constants (fee amounts, addresses)
│   │   ├── firebase.ts            # Firebase initialization
│   │   └── solana.ts              # RPC connection, network config
│   │
│   ├── hooks/
│   │   ├── useWalletScanner.ts    # Core scanning logic
│   │   ├── useRevoke.ts           # Revocation transaction builder
│   │   └── useAppStore.ts         # Zustand global state
│   │
│   ├── lib/
│   │   ├── scanner.ts             # Pure functions: fetch + parse token accounts
│   │   ├── revoke.ts              # Pure functions: build revoke transactions
│   │   ├── validation.ts          # Input validation helpers
│   │   ├── formatting.ts          # Address shortening, SOL formatting
│   │   └── analytics.ts           # Firebase event logging
│   │
│   ├── types/
│   │   └── index.ts               # All shared TypeScript types/interfaces
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn/ui base components (auto-generated)
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── PageWrapper.tsx
│   │   ├── wallet/
│   │   │   └── WalletConnectButton.tsx
│   │   ├── scanner/
│   │   │   ├── ScannerCard.tsx
│   │   │   ├── ScanResults.tsx
│   │   │   ├── DelegationRow.tsx
│   │   │   └── EmptyAccountsInfo.tsx
│   │   ├── revoke/
│   │   │   ├── RevokeButton.tsx
│   │   │   ├── RevokeConfirmModal.tsx
│   │   │   └── RevokeProgressModal.tsx
│   │   └── common/
│   │       ├── ErrorBoundary.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── RiskBadge.tsx
│   │
│   └── pages/
│       ├── HomePage.tsx           # Landing / connect wallet
│       ├── ScanPage.tsx           # Main scan + results page
│       └── NotFoundPage.tsx
│
├── .env.example                   # Template with all required env vars
├── .env.local                     # Real values (gitignored)
├── netlify.toml                   # Netlify build + redirect config
├── vite.config.ts
├── tsconfig.json                  # Strict mode ON
├── tailwind.config.ts
└── package.json
```

---

## 4. Environment Variables

Create `.env.example` with ALL of these. Real values go in `.env.local` (gitignored).

```bash
# ─── Solana RPC ───────────────────────────────────────
# Primary: Get free key at https://dev.helius.xyz
VITE_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=d60e2680-f668-43d0-a021-f8d4c2e20b07

# Fallback (rate-limited but always works)
VITE_SOLANA_FALLBACK_RPC=https://api.mainnet-beta.solana.com

# ─── Firebase ─────────────────────────────────────────
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# ─── App Config ───────────────────────────────────────
# Treasury wallet that receives service fees
VITE_TREASURY_WALLET=vH7bXdiPDxVskg2igCh1W8HTKCcsuyTN5Zybw92hx8d

# Service fee in SOL (shown to user before they sign)
VITE_SERVICE_FEE_SOL=0.01

# App environment (development | production)
VITE_APP_ENV=development
```

**Agent note:** Prefix ALL env vars with `VITE_` — this is required by Vite to expose them to the browser bundle.

---

## 5. TypeScript Types (Define These First)

File: `src/types/index.ts`

```typescript
// All token program IDs that can have delegations
export type TokenProgramId = 
  | 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'   // SPL Token
  | 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';  // Token-2022

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TokenDelegation {
  tokenAccountAddress: string;   // The token account public key
  mint: string;                   // Token mint address
  delegate: string;               // Program/wallet that has permission
  delegatedAmount: string;        // Amount the delegate can move (as string to avoid BigInt issues)
  ownerBalance: number;           // Current token balance of the owner
  ownerBalanceRaw: string;        // Raw balance as string
  decimals: number;               // Token decimals
  tokenSymbol: string;            // Token symbol if resolvable, else "UNKNOWN"
  programId: TokenProgramId;      // Which token program owns this account
  riskLevel: RiskLevel;           // Calculated risk level
  isKnownDelegate: boolean;       // Whether delegate is in known protocol list
}

export interface EmptyTokenAccount {
  address: string;
  mint: string;
  estimatedRentLamports: number;
}

export interface ScanResult {
  walletAddress: string;
  scannedAt: Date;
  totalTokenAccounts: number;
  delegations: TokenDelegation[];
  emptyAccounts: EmptyTokenAccount[];
  estimatedRecoverableSOL: number;
  scanDurationMs: number;
}

export type ScanStatus = 
  | 'idle'
  | 'scanning'
  | 'scan_complete'
  | 'error';

export type RevokeStatus =
  | 'idle'
  | 'awaiting_confirmation'
  | 'building_transaction'
  | 'awaiting_signature'
  | 'confirming'
  | 'complete'
  | 'error';

export interface RevokeResult {
  success: boolean;
  signature: string | null;
  revokedCount: number;
  errorMessage: string | null;
}

export interface AppError {
  code: string;
  message: string;           // User-facing message (plain English)
  technicalDetail: string;   // For logging, not shown to user
}
```

---

## 6. Core Logic (Detailed)

### 6.1 Scanner Logic — `src/lib/scanner.ts`

This is the most important file. Document every function thoroughly.

**Function: `scanWalletForDelegations(walletAddress: string, connection: Connection): Promise<ScanResult>`**

Steps in order:
1. Validate `walletAddress` is a valid Solana public key — throw `AppError` with code `INVALID_ADDRESS` if not
2. Call `connection.getParsedTokenAccountsByOwner()` for `TOKEN_PROGRAM_ID`
3. Call `connection.getParsedTokenAccountsByOwner()` for `TOKEN_2022_PROGRAM_ID`
4. Combine results into a single array
5. For each account, check `parsed.info.delegate` — if present, it is a delegation
6. For accounts with delegation:
   - Extract all fields defined in `TokenDelegation` type
   - Calculate `riskLevel`:
     - `HIGH` if `ownerBalance > 0` (tokens can actually be drained)
     - `MEDIUM` if `ownerBalance === 0` but `delegatedAmount > 0`
     - `LOW` if both are 0 (likely a stale permission from closed position)
   - Check `isKnownDelegate` against a hardcoded list of known safe protocol addresses (Orca, Raydium, Marinade, Jupiter, etc.) — see section 6.3
7. For empty accounts (balance === 0, no delegation), add to `emptyAccounts`
8. Calculate `estimatedRecoverableSOL` = `emptyAccounts.length × 0.00203928`
9. Return the full `ScanResult`

**Error handling requirements:**
- If RPC call fails, retry ONCE with exponential backoff (500ms delay)
- If retry also fails, throw `AppError` with code `RPC_ERROR` and a user-friendly message ("Connection to Solana network failed. Please try again.")
- Never let raw web3.js errors bubble to the UI

### 6.2 Revoke Logic — `src/lib/revoke.ts`

**Function: `buildRevokeTransaction(delegations: TokenDelegation[], walletPublicKey: PublicKey, connection: Connection): Promise<Transaction[]>`**

This returns an ARRAY of transactions because Solana transactions have a size limit.

Steps:
1. Validate `delegations` is not empty
2. Group delegations into batches of maximum **15 per transaction** (conservative limit for safety)
3. For each batch, create a new `Transaction`
4. For each delegation in the batch, add a `createRevokeInstruction(tokenAccountAddress, ownerPublicKey, [], programId)`
5. Add the service fee transfer instruction to the FIRST transaction only:
   - `SystemProgram.transfer({ fromPubkey: walletPublicKey, toPubkey: TREASURY_WALLET, lamports: SERVICE_FEE_LAMPORTS })`
6. Fetch `recentBlockhash` and set on each transaction
7. Return all transactions

**Important:** The fee is added to the first transaction. If user signs tx 1, they pay the fee. Tx 2+ are free. This is honest and intentional.

**Function: `estimateTransactionCost(delegationCount: number): { serviceFeeSOL: number, networkFeeSOL: number, totalSOL: number }`**

Returns a breakdown shown to the user before signing:
- `serviceFeeSOL`: The app's fee (from env var)
- `networkFeeSOL`: Estimated Solana network fees (~0.000005 SOL per signature)
- `totalSOL`: Sum of both

### 6.3 Known Safe Delegates List

Maintain a hardcoded array of known, trusted protocol delegate addresses. This is used to set `isKnownDelegate = true` and show a green "Verified Protocol" badge instead of a warning.

Research and add addresses for:
- Orca Whirlpool program
- Raydium AMM programs
- Jupiter Aggregator programs
- Marinade Finance
- Sanctum
- Kamino Finance
- Meteora

This list is NOT exhaustive and does not guarantee safety. The UI should say "Known Protocol" not "Safe" — even known protocols can be exploited.

---

## 7. UI Pages & Components

### 7.1 HomePage (`/`)

Shown when wallet is NOT connected.

**Layout:**
- Full-height hero section
- Large shield icon (use lucide-react `Shield` icon, styled)
- Headline: "Is your Solana wallet exposed?"
- Subheadline: "Scan for dangerous token permissions in 10 seconds. Free to scan. One click to protect."
- Single primary CTA button: "Connect Wallet & Scan"
- Below hero: 3 feature cards:
  1. "Free to Scan" — No cost to check your wallet
  2. "One-Click Revoke" — Remove all dangerous permissions in one transaction
  3. "Non-Custodial" — Your keys never leave your wallet
- Footer with: "No account needed. No data stored. Open source."

**Behavior:**
- When user clicks "Connect Wallet & Scan", trigger wallet adapter connect modal
- After successful connection, redirect to `/scan`

### 7.2 ScanPage (`/scan`)

The main page. Has multiple states:

**State 1: Scan Ready (wallet connected, no scan yet)**
- Show wallet address (shortened) with a copy button
- "Start Scan" button (large, prominent)
- Short explanation: "We'll scan your token accounts for active delegations"
- Estimated time: "Takes 5–15 seconds"

**State 2: Scanning (in progress)**
- Progress indicator (animated)
- Status text cycling through: "Fetching token accounts...", "Analyzing permissions...", "Calculating risk..."
- DO NOT show a cancel button (keep it simple — scan is fast)

**State 3: Scan Complete — Clean**
- Large green checkmark
- "✅ Your wallet is clean! No dangerous permissions found."
- Show count: "Scanned 47 token accounts"
- Show bonus info: "You have X empty accounts with ~Y SOL in locked rent" (if any)
- Button: "Scan Again"

**State 4: Scan Complete — Issues Found**
- Warning header: "⚠️ X Dangerous Permission(s) Found"
- Risk summary cards:
  - 🔴 High Risk: N accounts (tokens present, can be drained)
  - 🟡 Medium Risk: N accounts (empty but permission exists)
- Results table (see DelegationRow component below)
- Bottom sticky bar: "Revoke All X Permissions — 0.01 SOL fee" button
- Also show empty accounts bonus section if applicable

**State 5: Error**
- Red error card with user-friendly message
- Technical error hidden but logged to Firebase
- "Try Again" button

### 7.3 DelegationRow Component

One row per `TokenDelegation` in the results table.

Columns:
1. **Risk badge** — RED / YELLOW pill
2. **Token** — Symbol + shortened mint address with external link to solscan.io
3. **Your balance** — Amount the user holds
4. **Delegate** — Shortened address + external link to solscan.io; if known protocol, show "Verified Protocol" green badge
5. **Permission level** — "Can move up to X tokens" (formatted delegatedAmount)

On mobile: Collapse to a card layout (not table rows).

### 7.4 RevokeConfirmModal

Shown when user clicks "Revoke All".

Must clearly display:
```
You are about to revoke X token permissions.

This will:
✅ Remove delegate access from X token accounts
✅ Protect your tokens from unauthorized transfers
✅ NOT move, burn, or affect your tokens in any way

Cost breakdown:
  Service fee:      0.01 SOL  (~$1.50)
  Network fees:    ~0.0001 SOL (~$0.02)
  ─────────────────────────────
  Total:            0.0101 SOL (~$1.52)

This fee is deducted from your SOL balance, not your tokens.

[Cancel]  [Revoke X Permissions →]
```

**The Cancel button must be visually equal or larger than the Revoke button.** Never pressure users.

### 7.5 RevokeProgressModal

Shown during and after revocation. Non-dismissible during transaction.

States:
1. "Building transaction..." (spinner)
2. "Waiting for wallet signature..." (wallet icon pulsing) — If wallet popup doesn't appear within 5 seconds, show hint: "Check your wallet extension for a signature request"
3. "Confirming on Solana..." (spinner)
4. SUCCESS: Green checkmark, signature link to solscan.io, "Done — Your wallet is protected"
5. ERROR: Red X, user-friendly error message, "Try Again" button

---

## 8. State Management — Zustand Store

File: `src/hooks/useAppStore.ts`

```typescript
interface AppStore {
  // Scan state
  scanStatus: ScanStatus;
  scanResult: ScanResult | null;
  scanError: AppError | null;

  // Revoke state
  revokeStatus: RevokeStatus;
  revokeResult: RevokeResult | null;
  revokeError: AppError | null;

  // Actions
  setScanStatus: (status: ScanStatus) => void;
  setScanResult: (result: ScanResult) => void;
  setScanError: (error: AppError) => void;
  clearScan: () => void;
  setRevokeStatus: (status: RevokeStatus) => void;
  setRevokeResult: (result: RevokeResult) => void;
  setRevokeError: (error: AppError) => void;
  clearRevoke: () => void;
  resetAll: () => void;
}
```

---

## 9. Firebase Integration

File: `src/lib/analytics.ts`

Firebase is used for **anonymous analytics only**. Never log wallet addresses.

**Events to log:**

```typescript
// User connects wallet
logEvent('wallet_connected', { timestamp: Date.now() });

// User starts a scan
logEvent('scan_started', { timestamp: Date.now() });

// Scan completes
logEvent('scan_complete', {
  totalAccounts: number,
  delegationsFound: number,
  highRiskCount: number,
  scanDurationMs: number,
  hadError: false
});

// User clicks Revoke
logEvent('revoke_initiated', {
  delegationCount: number,
  feePaidSOL: number
});

// Revoke completes
logEvent('revoke_complete', {
  success: boolean,
  revokedCount: number,
  errorCode: string | null
});
```

**Firestore structure (optional, for your own dashboard):**

Collection: `scan_events`
Document fields:
- `timestamp`: Firestore server timestamp
- `delegationsFound`: number
- `highRiskCount`: number
- `revokeAttempted`: boolean
- `revokeSuccess`: boolean
- DO NOT store wallet address, IP address, or any identifying information

---

## 10. Security Requirements

These are non-negotiable. Agent must implement all of them.

### 10.1 Input Validation

Every public key from user input or URL params must be validated:
```typescript
// In src/lib/validation.ts
function isValidSolanaPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
```

### 10.2 RPC Response Validation

Never trust raw RPC responses. Always check that parsed data has expected shape before accessing nested properties:
```typescript
// BAD - crashes if unexpected shape
const delegate = account.account.data.parsed.info.delegate;

// GOOD - defensive access
const parsed = account.account.data?.parsed?.info;
if (!parsed || typeof parsed !== 'object') continue;
const delegate = parsed.delegate ?? null;
```

### 10.3 Transaction Validation Before Sending

Before sending any transaction to the wallet for signing, validate:
1. `recentBlockhash` is set
2. `feePayer` is set to the connected wallet
3. All instructions are `revokeInstruction` types or the fee transfer — nothing else
4. Total number of instructions does not exceed 25 per transaction

### 10.4 Content Security Policy

In `netlify.toml`, set the following headers:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; connect-src 'self' https://*.helius-rpc.com https://api.mainnet-beta.solana.com https://*.firebaseio.com https://*.googleapis.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### 10.5 Rate Limiting (Client-Side)

Prevent users from spamming scans:
- Minimum 10 seconds between scans
- Disable scan button for 10 seconds after each scan completes
- Store last scan time in component state (not localStorage)

### 10.6 Fee Transparency

The service fee must be:
1. Shown in the confirm modal BEFORE any signing
2. Shown in SOL AND estimated USD equivalent
3. Clearly labeled as "Service fee" (not hidden in total)
4. Hardcoded in `constants.ts` and pulled from env var — never dynamically calculated on-chain

---

## 11. Error Handling Reference

Define all error codes in `src/config/constants.ts`:

```typescript
export const ERROR_CODES = {
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  RPC_ERROR: 'RPC_ERROR',
  RPC_TIMEOUT: 'RPC_TIMEOUT',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_SOL: 'INSUFFICIENT_SOL',
  TX_BUILD_FAILED: 'TX_BUILD_FAILED',
  TX_REJECTED: 'TX_REJECTED',      // User rejected in wallet
  TX_FAILED: 'TX_FAILED',          // Sent but failed on-chain
  TX_TIMEOUT: 'TX_TIMEOUT',        // Sent but not confirmed
  UNKNOWN: 'UNKNOWN',
} as const;

// User-facing messages for each code
export const ERROR_MESSAGES: Record<keyof typeof ERROR_CODES, string> = {
  INVALID_ADDRESS: 'That doesn\'t look like a valid Solana wallet address.',
  RPC_ERROR: 'Could not connect to the Solana network. Please try again in a moment.',
  RPC_TIMEOUT: 'The Solana network is taking too long to respond. Please try again.',
  WALLET_NOT_CONNECTED: 'Please connect your wallet first.',
  INSUFFICIENT_SOL: 'You need at least 0.015 SOL to cover the service fee and network fees.',
  TX_BUILD_FAILED: 'Could not build the transaction. Please try again.',
  TX_REJECTED: 'Transaction was cancelled. Your wallet was not changed.',
  TX_FAILED: 'The transaction failed on-chain. No fees were charged. Please try again.',
  TX_TIMEOUT: 'Transaction sent but confirmation timed out. Check Solscan to see if it went through.',
  UNKNOWN: 'Something unexpected happened. Please refresh the page and try again.',
};
```

---

## 12. Netlify Configuration

File: `netlify.toml` at project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

# SPA routing: redirect all routes to index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"

# Cache static assets aggressively
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

**How to deploy to Netlify:**
1. Push code to GitHub repository
2. Go to netlify.com → New site from Git → Connect your repo
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add all `VITE_*` environment variables in Netlify → Site settings → Environment variables
6. Deploy

---

## 13. Vite Configuration

File: `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Required for @solana/web3.js in browser
    'process.env': {},
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'solana': ['@solana/web3.js', '@solana/spl-token'],
          'wallet-adapter': ['@solana/wallet-adapter-react', '@solana/wallet-adapter-wallets'],
          'firebase': ['firebase/app', 'firebase/analytics', 'firebase/firestore'],
        }
      }
    }
  }
})
```

**Note:** The `global: 'globalThis'` and `process.env: {}` defines are REQUIRED. Without them, `@solana/web3.js` will throw `global is not defined` in the browser.

---

## 14. App.tsx — Root Setup

```typescript
// Rough structure — agent must implement fully

// Wrap everything in:
// 1. ConnectionProvider (Solana RPC)
// 2. WalletProvider (Wallet adapter)
// 3. WalletModalProvider (Wallet connect modal)
// 4. Toaster (react-hot-toast)
// 5. Router

// Routes:
// "/" → HomePage (if not connected) OR redirect to "/scan" if already connected
// "/scan" → ScanPage (requires wallet connection — redirect to "/" if not connected)
// "*" → NotFoundPage
```

---

## 15. Design System

### Colors (Tailwind config additions)
```javascript
// tailwind.config.ts
colors: {
  shield: {
    bg: '#0a0f1e',          // Deep dark navy — main background
    card: '#111827',         // Card background
    border: '#1f2937',       // Card borders
    accent: '#6366f1',       // Indigo — primary action color
    success: '#10b981',      // Green — clean/safe
    warning: '#f59e0b',      // Amber — medium risk
    danger: '#ef4444',       // Red — high risk
    text: '#f9fafb',         // Primary text
    muted: '#6b7280',        // Secondary text
  }
}
```

### Typography
- Font: Inter (Google Fonts) — clean, professional
- Monospace for addresses: `font-mono` (system mono stack)

### Visual Tone
- Dark theme only (crypto-native, professional)
- Clean card-based layout
- Minimal animation — only where it adds meaning (scan progress, success checkmark)
- No gradients except subtle ones in hero
- Icons: lucide-react only

---

## 16. Build Order for Agent

Implement in this exact order to avoid circular dependencies and wasted work:

1. **Project scaffold** — Vite + React + TypeScript + Tailwind, all installs
2. **Types** — `src/types/index.ts` and `src/config/constants.ts` first
3. **Validation + formatting utilities** — `src/lib/validation.ts`, `src/lib/formatting.ts`
4. **Solana config** — `src/config/solana.ts`, RPC connection setup
5. **Scanner logic** — `src/lib/scanner.ts` (pure functions, testable)
6. **Revoke logic** — `src/lib/revoke.ts` (pure functions, testable)
7. **Firebase setup** — `src/config/firebase.ts` + `src/lib/analytics.ts`
8. **Zustand store** — `src/hooks/useAppStore.ts`
9. **React hooks** — `src/hooks/useWalletScanner.ts` + `src/hooks/useRevoke.ts`
10. **Layout components** — Header, Footer, PageWrapper
11. **Wallet connect button** — WalletConnectButton
12. **Common components** — ErrorBoundary, LoadingSpinner, RiskBadge
13. **Scanner components** — ScannerCard, DelegationRow, ScanResults
14. **Revoke components** — RevokeButton, RevokeConfirmModal, RevokeProgressModal
15. **Pages** — HomePage, ScanPage, NotFoundPage
16. **App.tsx + main.tsx** — Wire everything together
17. **netlify.toml** — Deployment config
18. **Final pass** — TypeScript strict check, remove all `any` types

---

## 17. Testing Checklist (Agent Must Verify)

Before declaring the build complete, verify each item:

**Functional**
- [ ] Wallet connects (Phantom) and wallet address shows correctly
- [ ] Scan runs and completes on a real mainnet wallet
- [ ] Scan on a clean wallet shows "All clear" state correctly
- [ ] DelegationRow renders correctly for high and medium risk items
- [ ] Revoke confirm modal shows correct fee breakdown
- [ ] Revoke transaction builds without error (can test on devnet with test wallet)
- [ ] Success state shows solscan link after revocation
- [ ] Error states show user-friendly messages (test by disconnecting internet mid-scan)

**Security**
- [ ] No private keys anywhere in the codebase (grep for "privateKey", "secretKey")
- [ ] All public keys validated before use
- [ ] No `any` types in TypeScript (run `tsc --noEmit`)
- [ ] No console.log statements with wallet data in production

**Build**
- [ ] `npm run build` succeeds with zero errors and zero warnings
- [ ] Resulting `dist/` folder is under 5MB total
- [ ] All env vars in `.env.example` are documented

**Netlify**
- [ ] `netlify.toml` exists with redirect rule
- [ ] SPA routing works (navigating to `/scan` directly works)
- [ ] All `VITE_*` env vars added to Netlify dashboard before deploy

---

## 18. Sensitive Data Rules (Absolute)

These are hard rules. No exceptions.

| What | Rule |
|------|------|
| User private keys | NEVER touch the app. Wallet adapter handles signing. |
| Full wallet addresses | Never log to Firebase, console, or any external service |
| RPC API keys | Only in `.env.local`, never committed to git |
| Treasury wallet address | In env var only — not hardcoded in source |
| User token balances | Never sent to any server — all processing is client-side |

---

## 19. Future Roadmap (Context for Agent)

The agent should build this app with the following future features in mind (don't build them now — but don't make architectural choices that block them):

- **Engine 2: Account Rent Reclaimer** — Close empty token accounts and reclaim locked SOL
- **Engine 3: Staking Ticket Finder** — Scan for unredeemed Marinade/Sanctum staking tickets
- **Engine 4: Dust Consolidator** — Aggregate tiny token balances and convert to SOL via Jupiter
- **Premium subscription tier** — Monthly monitoring that alerts via email/Telegram when new delegations appear
- **API mode** — Allow other wallet apps to integrate scanning via a simple REST API

The app should be structured so adding new "engines" means adding new hooks + lib files + a new page section — not refactoring the entire codebase.

---

*End of Wallet Shield Project Specification*
*Version 1.0 — Ready for AI Agent Build*
