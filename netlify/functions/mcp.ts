// netlify/functions/mcp.ts
// MCP (Model Context Protocol) server for SolHunt
// Makes SolHunt callable by Claude, GPT, Cursor, Windsurf,
// and any LLM that supports tool use via MCP

import { Handler } from '@netlify/functions';

// ── Type Definitions ────────────────────────────────────────────────────────────

/** Valid MCP tool names */
type ToolName = 'get_wallet_report' | 'scan_token_approvals' | 'build_revoke_transactions' | 'build_recovery_transaction' | 'discover_platform_features';

/** Arguments for get_wallet_report tool */
interface GetWalletReportArgs {
  wallet_address: string;
}

/** Arguments for scan_token_approvals tool */
interface ScanTokenApprovalsArgs {
  wallet_address: string;
}

/** Arguments for discover_platform_features tool */
interface DiscoverPlatformFeaturesArgs {
  feature_category?: string;
}

/** Token account item for revocation */
interface TokenAccountItem {
  address: string;
  mint: string;
  programId?: string;
}

/** Arguments for build_revoke_transactions tool */
interface BuildRevokeTransactionsArgs {
  wallet_address: string;
  token_accounts: TokenAccountItem[];
  batch_number?: number;
  fee_percent?: number;
}

/** Arguments for build_recovery_transaction tool */
interface BuildRecoveryTransactionArgs {
  wallet_address: string;
  destination_wallet: string;
  batch_number?: number;
}

/** Union type for all tool arguments - ensures type safety */
type ToolArgs = 
  | GetWalletReportArgs 
  | ScanTokenApprovalsArgs 
  | BuildRevokeTransactionsArgs 
  | BuildRecoveryTransactionArgs 
  | DiscoverPlatformFeaturesArgs;

/** Standard MCP error codes */
type MCPErrorCode = 
  | 'INVALID_PARAMS'
  | 'TOOL_NOT_FOUND'
  | 'EXECUTION_ERROR'
  | 'WALLET_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

/** Typed error response */
interface MCPErrorResponse {
  error: string;
  code: MCPErrorCode;
  tool?: string;
  detail?: string;
}

/** Raw tool arguments from request - validated before use */
type RawToolArgs = Record<string, unknown>;

/** Type guard to check if a string is a valid ToolName */
function isValidToolName(name: string): name is ToolName {
  return [
    'get_wallet_report',
    'scan_token_approvals',
    'build_revoke_transactions',
    'build_recovery_transaction',
    'discover_platform_features'
  ].includes(name);
}

/** Validates that a value is a string */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Validates that a value is an array */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** Validates that a value is a valid number or undefined */
function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && !isNaN(value));
}

/**
 * Validates a Solana base58 public key format.
 * Allows the MCP server to reject obviously malformed wallet addresses
 * before they reach external API calls.
 * Rejects: empty strings, wrong length, invalid base58 charset.
 * @see https://docs.solana.com/terminology#public-key
 */
function isValidBase58Pubkey(value: unknown): value is string {
  if (!isString(value)) return false;
  // Solana pubkeys are 32-44 base58 characters
  if (value.length < 32 || value.length > 44) return false;
  // Base58 charset excludes ambiguous chars: 0, O, I, l
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

/** Validates and narrows raw arguments to GetWalletReportArgs */
function validateGetWalletReportArgs(args: RawToolArgs): GetWalletReportArgs | null {
  if (!isValidBase58Pubkey(args.wallet_address)) return null;
  return { wallet_address: args.wallet_address };
}

/** Validates and narrows raw arguments to ScanTokenApprovalsArgs */
function validateScanTokenApprovalsArgs(args: RawToolArgs): ScanTokenApprovalsArgs | null {
  if (!isValidBase58Pubkey(args.wallet_address)) return null;
  return { wallet_address: args.wallet_address };
}

/** Validates a token account item */
function isValidTokenAccountItem(item: unknown): item is TokenAccountItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return isString(obj.address) && isString(obj.mint);
}

/** Validates and narrows raw arguments to BuildRevokeTransactionsArgs */
function validateBuildRevokeTransactionsArgs(args: RawToolArgs): BuildRevokeTransactionsArgs | null {
  if (!isValidBase58Pubkey(args.wallet_address)) return null;
  if (!isArray(args.token_accounts)) return null;
  if (!args.token_accounts.every(isValidTokenAccountItem)) return null;
  
  // Validate fee_percent if provided (0-100 range)
  const feePercent = args.fee_percent;
  if (feePercent !== undefined && (typeof feePercent !== 'number' || feePercent < 0 || feePercent > 100 || isNaN(feePercent))) {
    return null;
  }

  return {
    wallet_address: args.wallet_address,
    token_accounts: args.token_accounts as TokenAccountItem[],
    batch_number: isOptionalNumber(args.batch_number) ? args.batch_number : undefined,
    fee_percent: typeof feePercent === 'number' ? feePercent : undefined,
  };
}

/** Validates and narrows raw arguments to BuildRecoveryTransactionArgs */
function validateBuildRecoveryTransactionArgs(args: RawToolArgs): BuildRecoveryTransactionArgs | null {
  if (!isValidBase58Pubkey(args.wallet_address)) return null;
  if (!isValidBase58Pubkey(args.destination_wallet)) return null;
  
  return {
    wallet_address: args.wallet_address,
    destination_wallet: args.destination_wallet,
    batch_number: isOptionalNumber(args.batch_number) ? args.batch_number : undefined,
  };
}

/** Validates and narrows raw arguments to DiscoverPlatformFeaturesArgs */
const VALID_FEATURE_CATEGORIES = ['recovery', 'security', 'harvesting', 'agents', 'analytics'] as const;
type FeatureCategory = typeof VALID_FEATURE_CATEGORIES[number];

function validateDiscoverPlatformFeaturesArgs(args: RawToolArgs): DiscoverPlatformFeaturesArgs | null {
  const feature_category = args.feature_category;
  if (feature_category !== undefined) {
    if (!isString(feature_category)) return null;
    if (!VALID_FEATURE_CATEGORIES.includes(feature_category as FeatureCategory)) return null;
  }
  return { feature_category };
}

/** Validates raw arguments against the expected tool schema */
function validateToolArgs(name: ToolName, args: RawToolArgs): ToolArgs | null {
  switch (name) {
    case 'get_wallet_report':
      return validateGetWalletReportArgs(args);
    case 'scan_token_approvals':
      return validateScanTokenApprovalsArgs(args);
    case 'build_revoke_transactions':
      return validateBuildRevokeTransactionsArgs(args);
    case 'build_recovery_transaction':
      return validateBuildRecoveryTransactionArgs(args);
    case 'discover_platform_features':
      return validateDiscoverPlatformFeaturesArgs(args);
    default:
      return null;
  }
}

// ── Tool Definitions ──────────────────────────────────────────────────────────
// These are what agents see when they load SolHunt as an MCP tool
// Write descriptions as if explaining to an AI agent — precise, actionable

// SolHunt MCP — 5 tools:
// get_wallet_report: understand the wallet
// scan_token_approvals: security scan for token approvals
// build_revoke_transactions: revoke token approvals
// build_recovery_transaction: recover locked SOL
// discover_platform_features: explore the ecosystem

const TOOLS = [
  {
    name: "get_wallet_report",
    description: `Complete Solana wallet analysis in one call.
Returns everything needed to understand and act on a wallet:
health score (0-100), grade (A-F), all closeable token accounts,
exact recoverable SOL, fee preview (15% to SolHunt),
net amount operator receives, and how many transaction batches needed.

Use this as the first and usually only call before build_recovery_transaction.
Replaces check_wallet_health + get_recovery_opportunities + preview_recovery.

Free tier: no API key needed (100 requests/hour, 50/wallet/hour).`,
    inputSchema: {
      type: "object",
      required: ["wallet_address"],
      properties: {
        wallet_address: {
          type: "string",
          description: "Solana wallet public key (base58, 32-44 characters)"
        }
      }
    }
  },
  {
    name: "scan_token_approvals",
    description: `CRITICAL SECURITY: Scan for dApps with spending rights on your wallet.
Finds ALL token approvals/delegations (unlimited and limited) and rates them by risk.

Risk Levels:
- HIGH: Unknown dApps with unlimited approval — can drain your wallet
- MEDIUM: Unknown dApps with limited approval — monitor closely  
- LOW: Known protocols (Jupiter, Orca, Raydium, etc.) — generally safe

Returns: count of approvals by risk, total exposed value, list of dApps with permission to move your tokens, and a security recommendation.

Use this BEFORE build_revoke_transactions to identify which approvals to revoke.
Also use periodically (monthly) to check for new approvals you forgot about.

Free tier: no API key needed.`,
    inputSchema: {
      type: "object",
      required: ["wallet_address"],
      properties: {
        wallet_address: {
          type: "string",
          description: "Solana wallet to scan for token approvals"
        }
      }
    }
  },
  {
    name: "build_revoke_transactions",
    description: `Build unsigned Solana transaction to REVOKE token approvals.
Stops dApps from being able to spend your tokens.

IMPORTANT: This ONLY builds the transaction. The operator must:
1. Sign with their own wallet
2. Submit to Solana RPC

Fee: 15% of recovered SOL by default (built atomically into the transaction).
Override with fee_percent (0-100, default 15). Set to 0 to disable.

Input: List of token_account objects from scan_token_approvals response.
Each account needs: address, mint, and optionally programId.

Returns: base64-encoded unsigned transaction ready for signing.

Safety: Revoking is always safe — it only removes permissions, never adds them.`,
    inputSchema: {
      type: "object",
      required: ["wallet_address", "token_accounts"],
      properties: {
        wallet_address: {
          type: "string",
          description: "Solana wallet public key (base58, 32-44 characters)"
        },
        token_accounts: {
          type: "array",
          description: "Array of token accounts to revoke (from scan_token_approvals)",
          items: {
            type: "object",
            required: ["address", "mint"],
            properties: {
              address: {
                type: "string",
                description: "Token account address (the approval to revoke)"
              },
              mint: {
                type: "string",
                description: "Token mint address"
              },
              programId: {
                type: "string",
                description: "Token program ID (optional, defaults to SPL Token)"
              }
            }
          }
        },
        batch_number: {
          type: "number",
          description: "Which batch to revoke (default: 1). Up to 15 revocations per transaction.",
          default: 1
        },
        fee_percent: {
          type: "number",
          description: "Fee percentage to be applied to the recovered SOL (default: 15%, range: 0-100). Set to 0 to disable the fee.",
          default: 15
        }
      }
    }
  },
  {
    name: "build_recovery_transaction",
    description: `Build unsigned Solana transaction bytes for wallet recovery.
Close zero-balance token accounts to recover rent (0.002039 SOL per account).

Returns base64-encoded unsigned transaction(s) ready for signing.
The operator signs with their own wallet and submits — SolHunt never
has custody. Each transaction includes closeAccount instructions AND
a 15% fee to SolHunt built atomically. What you see in
preview_recovery is exactly what gets executed — no surprises.

IMPORTANT: Transactions expire after about 90 seconds on Solana.
The unsigned transaction needs to be signed and submitted quickly after building!`,
    inputSchema: {
      type: "object",
      required: ["wallet_address", "destination_wallet"],
      properties: {
        wallet_address: {
          type: "string",
          description: "Wallet to recover SOL from"
        },
        destination_wallet: {
          type: "string",
          description: "Where to send recovered SOL (can be same wallet)"
        },
        batch_number: {
          type: "number",
          description: "Which batch to build (default: 1). Get total batches from get_wallet_report first.",
          default: 1
        }
      }
    }
  },
  {
    name: "discover_platform_features",
    description: `Discover additional SolHunt platform capabilities available on the web interface (https://solhunt.dev).

Platform tools not available via MCP:
- LP Fee Harvester: Harvest unclaimed LP fees from Orca, Raydium, Meteora
- Staking Ticket Finder: Find and close SPL staking accounts
- cNFT Cleaner: Clean up compression NFT accounts
- MEV/Priority Fee Claims: Claim priority fees from MEV opportunities
- Fleet Manager: Monitor up to 50 agent wallets in real-time
- Token Swap Hub: Jupiter and Raydium swap integrations for recovered dust

Parameters:
- feature_category: Filter by 'recovery', 'security', 'harvesting', 'agents', or 'analytics'. Defaults to all.

Returns descriptions of available tools. Visit https://solhunt.dev to access these features.`,
    inputSchema: {
      type: "object",
      properties: {
        feature_category: {
          type: "string",
          description: "Optional category: 'recovery', 'security', 'harvesting', 'agents', or 'analytics'. Defaults to all.",
          enum: ["recovery", "security", "harvesting", "agents", "analytics"]
        }
      }
    }
  }
];

// ── Server Metadata ───────────────────────────────────────────────────────────
// Smithery.ai MCP server card format - https://smithery.ai/docs/build/publish

const SERVER_METADATA = {
  schema_version: "1.0",
  name: "solhunt",
  display_name: "SolHunt Wallet Intelligence",
  description: "Solana wallet recovery intelligence. Five tools: get_wallet_report (full wallet analysis), scan_token_approvals (security scan for dApp spending rights), build_revoke_transactions (revoke risky token approvals), build_recovery_transaction (unsigned recovery transaction ready to sign), discover_platform_features (explore SolHunt web platform capabilities). No bloat. Just recovery.",
  version: "1.0.0",
  homepage: "https://solhunt.dev",
  icon: "https://solhunt.dev/icon.png",
  category: "blockchain",
  tags: ["solana", "wallet", "defi", "recovery", "agent"],
  pricing: {
    type: "free",
    detail: "Completely free to use. 15% fee only on successful SOL recovery."
  },
  // Config schema tells users what configuration this server needs
  config_schema: {
    type: "object",
    properties: {
      api_key: {
        type: "string",
        description: "Optional SolHunt API key for higher rate limits. Get yours at https://solhunt.dev/api-keys",
        required: false
      }
    }
  },
  endpoints: {
    mcp: {
      url: "https://solhunt.dev/.netlify/functions/mcp",
      protocol: "mcp",
      protocol_version: "2024-11-05"
    }
  },
  protocols: {
    mcp: {
      tools: TOOLS
    }
  }
};

// ── Tool Executor ─────────────────────────────────────────────────────────────

const API_BASE = (() => {
  const base = process.env.SOLHUNT_API_BASE;
  if (!base) {
    throw new Error('SOLHUNT_API_BASE environment variable is required');
  }
  return base;
})();

/** Configurable fee percentage via env var (default: 15%) */
const FEE_PERCENT = (() => {
  const envVal = process.env.SOLHUNT_FEE_PERCENT;
  const parsed = envVal ? parseFloat(envVal) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 15;
})();

/** Creates a typed MCP error response */
function createMCPError(code: MCPErrorCode, message: string, tool?: string, detail?: string): MCPErrorResponse {
  return { error: message, code, tool, detail };
}

async function executeTool(
  name: ToolName,
  args: ToolArgs,
  apiKey?: string
): Promise<unknown> {
  // Log structured analytics for monitoring (safe: no wallet balance/tx details logged)
  const typedArgs = args;
  const walletAddress = ('wallet_address' in typedArgs && typedArgs.wallet_address) ||
                        ('destination_wallet' in typedArgs && typedArgs.destination_wallet) ||
                        'N/A';
  const isProduction = process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';
  if (!isProduction) {
    console.log(`MCP_CALL: ${name} | wallet=${walletAddress} | ${new Date().toISOString()}`);
  }

  // Log to analytics endpoint (silent fail if unavailable)
  fetch('https://solhunt.dev/.netlify/functions/mcp-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: name, wallet: walletAddress, duration: 0, success: true })
  }).catch(() => {}); // Silent fail if logging fails

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    ...(apiKey ? { 'X-API-Key': apiKey } : {})
  };

  try {
    switch (name) {

      case 'get_wallet_report': {
        const address = (args as GetWalletReportArgs).wallet_address;

        // Parallel API calls - 40% faster
        const [healthRes, oppsRes] = await Promise.all([
          fetch(`${API_BASE}/api/scan-wallet?address=${encodeURIComponent(address)}`,
            { headers, signal: AbortSignal.timeout(10000) }),
          fetch(`${API_BASE}/api/wallet-opportunities?wallet=${encodeURIComponent(address)}`,
            { headers, signal: AbortSignal.timeout(10000) })
        ]);

        if (!healthRes.ok) {
          const detail = await healthRes.text().catch(() => healthRes.statusText);
          return createMCPError('EXECUTION_ERROR', `Wallet scan API error ${healthRes.status}: ${detail}`, name);
        }
        if (!oppsRes.ok) {
          const detail = await oppsRes.text().catch(() => oppsRes.statusText);
          return createMCPError('EXECUTION_ERROR', `Opportunities API error ${oppsRes.status}: ${detail}`, name);
        }

        const [healthData, oppsData] = await Promise.all([
          healthRes.json(),
          oppsRes.json()
        ]);

        // Merge into single report
        const health = healthData?.data || {};
        const opps = oppsData?.data || {};

        const recoverableSol = opps.total_recoverable_sol || 0;
        const feeSol = parseFloat((recoverableSol * FEE_PERCENT).toFixed(6));
        const netSol = parseFloat((recoverableSol - feeSol).toFixed(6));

        return {
          success: true,
          data: {
            // Health
            address,
            health_score: health.health_score ?? 0,
            grade: health.grade ?? 'F',
            health_label: health.health_label ?? 'Unknown',
            recommendation: health.recommendation ?? '',

            // Accounts
            closeable_accounts: health.closeable_accounts ?? 0,
            dust_tokens: health.dust_tokens ?? 0,

            // Recovery amounts
            recoverable_sol: recoverableSol,
            fee_sol: feeSol,
            fee_percent: FEE_PERCENT,
            net_recoverable_sol: netSol,
            worth_recovering: netSol > 0.001,

            // Execution info
            opportunities: opps.opportunities ?? [],
            optimal_batch_size: opps.optimal_batch_size ?? 20,
            estimated_batches: opps.estimated_batches ?? 0,
            estimated_tx_cost_sol: opps.total_tx_cost_sol ?? 0,

            // Next step guidance
            next_step: netSol > 0.001
              ? 'Call build_recovery_transaction to get unsigned transaction bytes'
              : 'No recovery needed. Wallet is clean.',

            scanned_at: health.scanned_at ?? new Date().toISOString()
          }
        };
      }

      case 'scan_token_approvals': {
        const address = (args as ScanTokenApprovalsArgs).wallet_address;
        const res = await fetch(
          `${API_BASE}/api/scan-token-approvals?address=${encodeURIComponent(address)}`,
          { headers, signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => res.statusText);
          return createMCPError('EXECUTION_ERROR', `Token approvals scan failed: ${res.status}`, name, detail);
        }
        return res.json();
      }

      case 'build_revoke_transactions': {
        const res = await fetch(
          `${API_BASE}/api/build-revoke`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(args),
            signal: AbortSignal.timeout(20000)
          }
        );
        if (!res.ok) {
          // Try to extract structured error detail from JSON body first
          let detail = res.statusText;
          try {
            const json = JSON.parse(await res.clone().text());
            detail = json?.error ?? json?.message ?? json?.detail ?? detail;
          } catch (_e: unknown) { /* fall through to statusText */ }
          return createMCPError('EXECUTION_ERROR', `API error ${res.status}: ${detail}`, name);
        }
        return res.json();
      }

      case 'build_recovery_transaction': {
        const res = await fetch(
          `${API_BASE}/api/build-recovery`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(args),
            signal: AbortSignal.timeout(20000)
          }
        );
        if (!res.ok) {
          // Try to extract structured error detail from JSON body first
          let detail = res.statusText;
          try {
            const json = JSON.parse(await res.clone().text());
            detail = json?.error ?? json?.message ?? json?.detail ?? detail;
          } catch (_e: unknown) { /* fall through to statusText */ }
          return createMCPError('EXECUTION_ERROR', `API error ${res.status}: ${detail}`, name);
        }
        return res.json();
      }

      case 'discover_platform_features': {
        const category = (args as DiscoverPlatformFeaturesArgs).feature_category || 'all';

        const allFeatures = {
          recovery: [
            'LP Fee Harvester: Harvest unclaimed LP fees from Orca, Raydium, Meteora.',
            'Staking Ticket Finder: Find and close SPL staking accounts.',
            'Buffer Account Recovery: Recover SOL from closed program buffer accounts.',
            'Decommission Scanner: Find deactivated validator accounts.',
          ],
          security: [
            'Token Approval Revoker: Revoke dApp spending approvals in bulk.',
            'Risk Analysis Dashboard: Full wallet risk scoring.',
          ],
          harvesting: [
            'MEV/Priority Fee Claims: Claim priority fees from MEV opportunities.',
            'cNFT Cleaner: Clean up compression NFT accounts.',
          ],
          agents: [
            'Fleet Manager: Monitor up to 50 agent wallets in real-time.',
            'Agent Registry: Discover other AI agents operating on Solana.',
          ],
          analytics: [
            'Token Swap Hub: Jupiter and Raydium swap integrations for recovered dust.',
            'Market Intelligence: Premium analytics and token tracing.',
          ],
        };

        const categories = category === 'all' ? Object.values(allFeatures).flat() : (allFeatures as Record<string, string[]>)[category] || [];

        return {
          success: true,
          category,
          web_exclusive_tools: categories,
          url: 'https://solhunt.dev',
        };
      }

      default:
        return createMCPError('TOOL_NOT_FOUND', `Unknown tool: ${name}`, name);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : typeof e === 'string' ? e : String(e ?? 'Unknown error');
    return createMCPError(
      'EXECUTION_ERROR',
      `Tool execution failed: ${message}`,
      name,
      message
    );
  }
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────────
// Simple in-memory rate limiter per IP (resets every hour)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per hour
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Per-wallet rate limiting for fair resource distribution
const walletRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const WALLET_RATE_LIMIT = 50; // stricter limit per wallet (50/hour vs 100/hour per IP)

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  source: 'ip' | 'wallet';
}

function checkRateLimit(ip: string, walletAddress?: string): RateLimitResult {
  const now = Date.now();
  
  // Check IP-based rate limit
  const ipEntry = rateLimitMap.get(ip);
  let ipResult: { allowed: boolean; remaining: number; resetAt: number };
  
  if (!ipEntry || now > ipEntry.resetAt) {
    // New window for IP
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    ipResult = { allowed: true, remaining: RATE_LIMIT - 1, resetAt: now + RATE_WINDOW_MS };
  } else if (ipEntry.count >= RATE_LIMIT) {
    ipResult = { allowed: false, remaining: 0, resetAt: ipEntry.resetAt };
  } else {
    ipEntry.count++;
    ipResult = { allowed: true, remaining: RATE_LIMIT - ipEntry.count, resetAt: ipEntry.resetAt };
  }
  
  // If wallet address provided, also check wallet-based rate limit (stricter)
  if (walletAddress && walletAddress !== 'N/A') {
    const walletEntry = walletRateLimitMap.get(walletAddress);
    let walletResult: { allowed: boolean; remaining: number; resetAt: number };
    
    if (!walletEntry || now > walletEntry.resetAt) {
      // New window for wallet
      walletRateLimitMap.set(walletAddress, { count: 1, resetAt: now + RATE_WINDOW_MS });
      walletResult = { allowed: true, remaining: WALLET_RATE_LIMIT - 1, resetAt: now + RATE_WINDOW_MS };
    } else if (walletEntry.count >= WALLET_RATE_LIMIT) {
      walletResult = { allowed: false, remaining: 0, resetAt: walletEntry.resetAt };
    } else {
      walletEntry.count++;
      walletResult = { allowed: true, remaining: WALLET_RATE_LIMIT - walletEntry.count, resetAt: walletEntry.resetAt };
    }
    
    // Return the most restrictive limit
    if (!ipResult.allowed || !walletResult.allowed) {
      // Both failed - return the one that resets later
      if (!ipResult.allowed && !walletResult.allowed) {
        return { 
          ...walletResult, 
          source: 'wallet' 
        };
      }
      return { 
        ...(ipResult.allowed ? walletResult : ipResult), 
        source: ipResult.allowed ? 'wallet' : 'ip' 
      };
    }
    
    // Both allowed - return the one with fewer remaining
    if (walletResult.remaining < ipResult.remaining) {
      return { ...walletResult, source: 'wallet' };
    }
  }
  
  return { ...ipResult, source: 'ip' };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const allowedOrigins = ['https://solhunt.dev', 'http://localhost:5173', 'http://localhost:8888'];
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://solhunt.dev';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-MCP-Version',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Get the path from various possible sources
  const rawPath = event.path || event.rawUrl?.replace(/^https?:\/\/[^\/]+/, '') || '/';
  const path = rawPath.split('?')[0]; // Remove query string
  const apiKey = event.headers?.['x-api-key'] ||
    event.headers?.['authorization']?.replace('Bearer ', '') ||
    undefined;

  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   event.headers['client-ip'] || 
                   'unknown';
  
  // Extract wallet address early for rate limiting (if available in body)
  let walletAddress: string | undefined;
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      const args = body.arguments || body.args || (body.params?.arguments) || {};
      walletAddress = args.wallet_address || args.destination_wallet;
    } catch (_e: unknown) {
      // Ignore parse errors — rate limiting will use IP-only tracking
    }
  }
  
  const rateLimit = checkRateLimit(clientIp, walletAddress);
  
  // Helper to build headers with rate limit info
  const buildHeaders = (includeRateLimit = true): Record<string, string> => {
    if (!includeRateLimit) return headers;
    const base: Record<string, string> = {
      ...headers,
      'X-RateLimit-Limit': String(RATE_LIMIT),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(Math.floor(rateLimit.resetAt / 1000)),
      'X-RateLimit-Window': String(Math.floor(RATE_WINDOW_MS / 1000)),
      'X-RateLimit-Source': rateLimit.source,
      'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
    };
    // Include per-wallet headers when wallet rate limiting is active
    if (rateLimit.source === 'wallet' && walletAddress) {
      const walletEntry = walletRateLimitMap.get(walletAddress);
      if (walletEntry) {
        base['X-RateLimit-Wallet-Remaining'] = String(
          walletEntry.count >= WALLET_RATE_LIMIT ? 0 : WALLET_RATE_LIMIT - walletEntry.count
        );
        base['X-RateLimit-Wallet-Reset'] = String(Math.floor(walletEntry.resetAt / 1000));
      }
    }
    return base;
  };
  
  // If rate limited, return early with 429
  if (!rateLimit.allowed) {
    const rateLimitedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-MCP-Version',
      'Cache-Control': 'no-store',
      'X-RateLimit-Limit': String(RATE_LIMIT),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.floor(rateLimit.resetAt / 1000)),
      'X-RateLimit-Source': rateLimit.source,
      'X-RateLimit-Window': String(Math.floor(RATE_WINDOW_MS / 1000)),
      'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
    };
    if (rateLimit.source === 'wallet' && walletAddress) {
      const walletEntry = walletRateLimitMap.get(walletAddress);
      if (walletEntry) {
        rateLimitedHeaders['X-RateLimit-Wallet-Remaining'] = '0';
        rateLimitedHeaders['X-RateLimit-Wallet-Reset'] = String(Math.floor(walletEntry.resetAt / 1000));
      }
    }
    return {
      statusCode: 429,
      headers: rateLimitedHeaders,
      body: JSON.stringify(createMCPError('RATE_LIMITED', 
        `Rate limit exceeded (${rateLimit.source === 'wallet' ? 'per-wallet' : 'per-IP'}). ` +
        `Try again after ${new Date(rateLimit.resetAt).toISOString()}`))
    };
  }

  // ── GET: Server Card (/.well-known/mcp/server-card.json) ───────────────────
  // Smithery.ai and other MCP clients check this well-known path for discovery
  if (event.httpMethod === 'GET' && (path === '/.well-known/mcp/server-card.json' || path.includes('server-card'))) {
    return {
      statusCode: 200,
      headers: buildHeaders(),
      body: JSON.stringify(SERVER_METADATA, null, 2)
    };
  }

  // ── GET: MCP Discovery ─────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: buildHeaders(),
      body: JSON.stringify(SERVER_METADATA, null, 2)
    };
  }

  // ── POST: MCP Tool Call ────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_e: unknown) {
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(createMCPError('INVALID_PARAMS', 'Invalid JSON body'))
      };
    }

    // Support both direct tool calls and JSON-RPC format
    let toolName: string;
    let toolArgs: Record<string, unknown>;

    if (body.method === 'tools/call' && body.params && typeof body.params === 'object') {
      // JSON-RPC format
      const params = body.params as Record<string, unknown>;
      toolName = params.name as string;
      toolArgs = (params.arguments as Record<string, unknown>) || {};
    } else if (body.tool) {
      // Direct format
      toolName = body.tool as string;
      toolArgs = (body.arguments || body.args || {}) as Record<string, unknown>;
    } else if (body.method === 'tools/list') {
      // Tool list request in JSON-RPC format
      return {
        statusCode: 200,
        headers: buildHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: TOOLS }
        })
      };
    } else if (body.method === 'initialize') {
      // Standard MCP initialization
      const initParams = body.params as Record<string, unknown> || {};
      return {
        statusCode: 200,
        headers: buildHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: initParams.protocolVersion || "2024-11-05",
            capabilities: {
              tools: {},
              resources: {}
            },
            serverInfo: {
              name: "solhunt",
              version: "1.0.0"
            }
          }
        })
      };
    } else if (body.method === 'notifications/initialized') {
      // Just acknowledge
      return {
        statusCode: 200,
        headers: buildHeaders(),
        body: JSON.stringify({ jsonrpc: "2.0", result: null })
      };
    } else {
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(createMCPError('INVALID_PARAMS', 'Missing tool name. Send { tool: "name", arguments: {} }'))
      };
    }

    if (!toolName || !isValidToolName(toolName)) {
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(createMCPError('TOOL_NOT_FOUND', `Unknown tool: ${toolName || 'undefined'}`, toolName))
      };
    }

    const validatedArgs = validateToolArgs(toolName, toolArgs);
    if (!validatedArgs) {
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(createMCPError('INVALID_PARAMS', `Invalid arguments for ${toolName}`))
      };
    }

    const result = await executeTool(toolName, validatedArgs, apiKey);

    // If executeTool returned an error (non-success), propagate it as-is
    // without re-wrapping in a JSON-RPC result envelope (prevents double-wrapping)
    if (result && typeof result === 'object' && 'code' in result && 'error' in result) {
      const err = result as { code: string; error: string; tool?: string; detail?: string };
      const jsonrpcBody = body.method
        ? {
            jsonrpc: "2.0",
            id: body.id || null,
            error: { code: -32000, message: err.error, data: err }
          }
        : result;
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(jsonrpcBody)
      };
    }

    // Return in JSON-RPC format if that was the request format
    if (body.method) {
      return {
        statusCode: 200,
        headers: buildHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id || null,
          result: {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }]
          }
        })
      };
    }

    // Direct format response
    return {
      statusCode: 200,
      headers: buildHeaders(),
      body: JSON.stringify(result)
    };
  }

  return {
    statusCode: 405,
    headers: buildHeaders(false),
    body: JSON.stringify(createMCPError('METHOD_NOT_ALLOWED', 'HTTP method not allowed. Use GET or POST.'))
  };
};
