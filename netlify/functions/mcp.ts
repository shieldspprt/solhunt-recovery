// netlify/functions/mcp.ts
// MCP (Model Context Protocol) server for SolHunt
// Makes SolHunt callable by Claude, GPT, Cursor, Windsurf,
// and any LLM that supports tool use via MCP

import { Handler } from '@netlify/functions';
import { buildCorsHeaders, safeLogInfo } from './_shared';

// ── Type Definitions ────────────────────────────────────────────────────────────

/** Valid MCP tool names */
type ToolName = 'get_wallet_report' | 'scan_token_approvals' | 'build_revoke_transactions' | 'build_recovery_transaction' | 'preview_recovery' | 'discover_platform_features';

/** Arguments for get_wallet_report tool */
interface GetWalletReportArgs {
  wallet_address: string;
}

/** Arguments for scan_token_approvals tool */
interface ScanTokenApprovalsArgs {
  wallet_address: string;
}

/** Arguments for preview_recovery tool */
interface PreviewRecoveryArgs {
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

/** Platform features grouped by category for discover_platform_features tool */
type FeaturesByCategory = Record<string, string[]>;

/** Arguments for build_revoke_transactions tool */
interface BuildRevokeTransactionsArgs {
  wallet_address: string;
  token_accounts: TokenAccountItem[];
  batch_number?: number;
  fee_percent?: number;
  /** Maximum number of revocations per transaction (default: 15, Solana hard limit). */
  max_revoke_batch_size?: number;
}

/** Arguments for build_recovery_transaction tool */
interface BuildRecoveryTransactionArgs {
  wallet_address: string;
  destination_wallet: string;
  batch_number?: number;
  fee_percent?: number;
}

/** Union type for all tool arguments - ensures type safety */
type ToolArgs = 
  | GetWalletReportArgs 
  | ScanTokenApprovalsArgs 
  | BuildRevokeTransactionsArgs 
  | BuildRecoveryTransactionArgs 
  | PreviewRecoveryArgs
  | DiscoverPlatformFeaturesArgs;

/** Standard MCP error codes.
 * PARSE_ERROR is included for JSON-RPC spec compliance (-32700).
 * @see https://www.jsonrpc.org/specification#error_object */
type MCPErrorCode =
  | 'PARSE_ERROR'
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

/** Raw tool arguments from request — untyped at runtime (parsed from JSON).
 * RawToolArgs is consumed exclusively by validate* functions that narrow it to
 * concrete ToolArgs subtypes via exhaustive type guards (isValidBase58Pubkey, etc.).
 * All args are validated before use in any RPC call or external API. */
type RawToolArgs = Record<string, unknown>;

/** Type guard to check if a string is a valid ToolName */
function isValidToolName(name: string): name is ToolName {
  return [
    'get_wallet_report',
    'scan_token_approvals',
    'build_revoke_transactions',
    'build_recovery_transaction',
    'preview_recovery',
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
  return value === undefined || (typeof value === 'number' && !Number.isNaN(value));
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
  if (value?.length < 32 || value?.length > 44) return false;
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
  if (feePercent !== undefined && (typeof feePercent !== 'number' || feePercent < 0 || feePercent > 100 || Number.isNaN(feePercent))) {
    return null;
  }

  return {
    wallet_address: args.wallet_address,
    token_accounts: args.token_accounts as TokenAccountItem[],
    batch_number: (() => {
      const bn = args.batch_number;
      if (bn === undefined) return undefined;
      // Must be a finite positive integer — Solana batch numbers start at 1
      if (typeof bn !== 'number' || !Number.isFinite(bn) || bn < 1 || !Number.isInteger(bn)) return undefined;
      return bn;
    })(),
    fee_percent: typeof feePercent === 'number' ? feePercent : undefined,
    max_revoke_batch_size: (() => {
      const m = args.max_revoke_batch_size;
      if (m === undefined) return undefined;
      // Must be a positive integer between 1 and 15 (Solana tx size limit)
      if (typeof m !== 'number' || !Number.isFinite(m) || m < 1 || m > 15 || !Number.isInteger(m)) return undefined;
      return m;
    })(),
  };
}

/** Validates and narrows raw arguments to BuildRecoveryTransactionArgs */
function validateBuildRecoveryTransactionArgs(args: RawToolArgs): BuildRecoveryTransactionArgs | null {
  if (!isValidBase58Pubkey(args.wallet_address)) return null;
  if (!isValidBase58Pubkey(args.destination_wallet)) return null;

  // Validate fee_percent if provided (0-100 range)
  const feePercent = args.fee_percent;
  if (feePercent !== undefined && (typeof feePercent !== 'number' || feePercent < 0 || feePercent > 100 || Number.isNaN(feePercent))) {
    return null;
  }

  return {
    wallet_address: args.wallet_address,
    destination_wallet: args.destination_wallet,
    batch_number: isOptionalNumber(args.batch_number) ? args.batch_number : undefined,
    fee_percent: typeof feePercent === 'number' ? feePercent : undefined,
  };
}

/** Validates and narrows raw arguments to PreviewRecoveryArgs */
function validatePreviewRecoveryArgs(args: RawToolArgs): PreviewRecoveryArgs | null {
  if (!isValidBase58Pubkey(args.wallet_address)) return null;
  return { wallet_address: args.wallet_address };
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
    case 'preview_recovery':
      return validatePreviewRecoveryArgs(args);
    case 'discover_platform_features':
      return validateDiscoverPlatformFeaturesArgs(args);
    default:
      return null;
  }
}

// ── Tool Definitions ──────────────────────────────────────────────────────────
// These are what agents see when they load SolHunt as an MCP tool
// Write descriptions as if explaining to an AI agent — precise, actionable

// SolHunt MCP — 6 tools:
// get_wallet_report: understand the wallet
// scan_token_approvals: security scan for token approvals
// build_revoke_transactions: revoke token approvals
// build_recovery_transaction: recover locked SOL
// preview_recovery: explicit fee preview before building transactions
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
    },
    instructions: `Step 1: Call get_wallet_report with a Solana wallet address.\nStep 2: Parse the response — it includes health_score, grade, recoverable_sol, fee_sol, and net_recoverable_sol.\nStep 3: If net_recoverable_sol > 0.001, call build_recovery_transaction to get unsigned transaction bytes.\nStep 4: Sign the transaction with the user's wallet and submit to Solana RPC.`
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
    },
    instructions: `Step 1: Call scan_token_approvals with a Solana wallet address.\nStep 2: Parse the response — it includes a list of dApps with spending approvals, rated by risk (HIGH/MEDIUM/LOW).\nStep 3: For HIGH-risk approvals, collect the token account addresses to revoke.\nStep 4: Call build_revoke_transactions with the wallet address and token accounts to revoke.`
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

Safety: Revoking is always safe — it only removes permissions, never adds them.

⚠️ Transaction expiry: Solana transactions expire after ~90 seconds. Sign and submit quickly after building.`,
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
        },
        max_revoke_batch_size: {
          type: "number",
          description: "Maximum number of revocations per transaction (default: 15, Solana hard limit). SolHunt will split into multiple transactions if the total exceeds this.",
          default: 15
        }
      }
    },
    instructions: `Step 1: Call scan_token_approvals with a Solana wallet address.\nStep 2: Parse the response — collect HIGH and MEDIUM risk token account addresses to revoke.\nStep 3: Call build_revoke_transactions with the wallet address and the token accounts list.\nStep 4: Sign the resulting unsigned transaction with your wallet and submit to Solana RPC.\nStep 5: Confirm the revocation succeeded on-chain — call scan_token_approvals again to verify all approvals were removed.`,
  },
  {
    name: "build_recovery_transaction",
    description: `Build unsigned Solana transaction bytes for wallet recovery.
Close zero-balance token accounts to recover rent (0.002039 SOL per account).

Returns base64-encoded unsigned transaction(s) ready for signing.
The operator signs with their own wallet and submits — SolHunt never
has custody. Each transaction includes closeAccount instructions AND
a fee to SolHunt built atomically. What you see in
get_wallet_report is exactly what gets executed — no surprises.

IMPORTANT: Transactions expire after about 90 seconds on Solana.
The unsigned transaction needs to be signed and submitted quickly after building!

Fee: 15% of recovered SOL by default (built atomically into the transaction).
Override with fee_percent (0-100, default: 15). Set to 0 to disable the fee.
destination_wallet is the wallet that receives the recovered SOL (can be the same as the source wallet).`,
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
          description: "Solana wallet public key (base58, 32-44 characters)"
        },
        batch_number: {
          type: "number",
          description: "Which batch to build (default: 1). Get total batches from get_wallet_report first.",
          default: 1
        },
        fee_percent: {
          type: "number",
          description: "Fee percentage to be applied to the recovered SOL (default: 15%, range: 0-100). Set to 0 to disable the fee.",
          default: 15
        }
      }
    },
    instructions: `Step 1: Call get_wallet_report with a Solana wallet address.\nStep 2: Parse the response — it includes recoverable_sol, estimated_batches, and net_recoverable_sol.\nStep 3: If net_recoverable_sol > 0.001, call build_recovery_transaction with wallet_address, destination_wallet, and batch_number=1.\nStep 4: Sign the resulting unsigned transaction with the user's wallet and submit to Solana RPC.\nStep 5: Repeat for each batch until all recoverable SOL is collected.\nStep 6: Call get_wallet_report again to verify recovery — health score should improve and recoverable_sol should be near zero.`,
  },
  {
    name: "preview_recovery",
    description: `Get an explicit fee and recovery preview BEFORE building a transaction.
Use this when you want to show the user exactly what they'll recover and what
SolHunt's fee will be — without committing to building a transaction yet.

Unlike get_wallet_report (which gives a full health analysis), this tool is
laser-focused on recovery economics: recoverable SOL, SolHunt's fee (default 15%),
network transaction estimate, and net amount the user receives.

Call this BEFORE build_recovery_transaction to give users full transparency
before any signing happens.

Input: wallet_address (the wallet to preview recovery for)

Returns: exact recoverable SOL, fee in SOL and percent, network cost estimate,
net amount, estimated number of batches, and whether recovery is worth doing.
Does NOT build or return any transaction bytes.`,
    inputSchema: {
      type: "object",
      required: ["wallet_address"],
      properties: {
        wallet_address: {
          type: "string",
          description: "Solana wallet to preview recovery for (base58, 32-44 characters)"
        }
      }
    },
    instructions: `Step 1: Call preview_recovery with a Solana wallet address.\nStep 2: Parse the response — it includes recoverable_sol, fee_sol, net_recoverable_sol, and worth_recovering.\nStep 3: If worth_recovering is true, call build_recovery_transaction to get unsigned transaction bytes.\nStep 4: Show the user the fee preview before asking them to sign anything.\nStep 5: After recovery is complete, call get_wallet_report to verify — recoverable_sol should be near zero and health score improved.`,
  },
  {
    name: "discover_platform_features",
    description: `Explore SolHunt web platform capabilities — LP Fee Harvester, Staking Ticket Finder, cNFT Cleaner, MEV/Priority Fee Claims, Fleet Manager, Token Swap Hub, and more.

Use feature_category to filter by 'recovery', 'security', 'harvesting', 'agents', or 'analytics'. Defaults to all.

Response shape (matches the other SolHunt MCP tools):
  data.category         — the requested category or 'all'
  data.category_label   — human-readable label for the requested category
  data.category_labels  — full map of category key → human label
  data.web_exclusive_tools — list of platform features (strings)
  data.url              — https://solhunt.dev

Full platform at https://solhunt.dev.`,
    inputSchema: {
      type: "object",
      properties: {
        feature_category: {
          type: "string",
          description: "Optional category: 'recovery', 'security', 'harvesting', 'agents', or 'analytics'. Defaults to all.",
          enum: ["recovery", "security", "harvesting", "agents", "analytics"]
        }
      },
      additionalProperties: false
    },
    instructions: `Step 1: Call discover_platform_features with an optional feature_category filter.\nStep 2: Parse the response — it includes a list of web-only tools at https://solhunt.dev.\nStep 3: Visit https://solhunt.dev to access the full platform.\nStep 4: For programmatic wallet recovery and token approvals, use the other SolHunt MCP tools.`
  }
];

// ── Server Metadata ───────────────────────────────────────────────────────────
// Smithery.ai MCP server card format - https://smithery.ai/docs/build/publish
// Schema: serverInfo (required), authentication, tools, resources, prompts
// per MCP spec foundation types from @modelcontextprotocol/sdk/types.js
const SERVER_METADATA = {
  serverInfo: {
    name: "solhunt",
    version: "1.0.0"
  },
  authentication: {
    required: false,
    schemes: []
  },
  tools: TOOLS,
  resources: [],
  prompts: []
};

// ── JSON Response Helper ───────────────────────────────────────────────────────
// Shared helper to parse JSON responses and extract structured error fields.
// Centralizes the try/catch pattern used across all API response handlers.

/**
 * Parses the response body and extracts structured error/detail field.
 * Falls back to statusText if JSON parsing fails or no structured field exists.
 */
async function parseResponseDetail(res: Response): Promise<string> {
  try {
    const json = JSON.parse(await res.clone().text());
    return json?.error ?? json?.message ?? json?.detail ?? res.statusText;
  } catch (parseErr: unknown) {
    return res.statusText;
  }
}

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

/**
 * Maps SolHunt MCP error codes to JSON-RPC 2.0 spec error numbers.
 *
 * Spec-defined codes (https://www.jsonrpc.org/specification#error_object):
 *   -32700  Parse error      — Invalid JSON was received by the server
 *   -32600  Invalid Request  — The JSON sent is not a valid request object
 *   -32601  Method not found — The method does not exist or is unavailable
 *   -32602  Invalid params   — Invalid method parameters
 *   -32603  Internal error   — Internal JSON-RPC error
 *   -32000..-32099 — Server error (reserved for implementation-defined server-errors)
 *
 * Without this mapping, every MCP error is reported as -32000, so a Claude /
 * Cursor / Windsurf client can't distinguish a malformed wallet address from
 * a downstream RPC outage. Tool implementers building error-aware UX
 * (retry-with-backoff vs prompt-the-user-to-fix-input) depend on the code.
 *
 * EXECUTION_ERROR, RATE_LIMITED, WALLET_NOT_FOUND, and METHOD_NOT_ALLOWED
 * are implementation-defined server errors and live in the -32000..-32099
 * range — each gets a unique slot so clients can branch on them.
 */
const JSON_RPC_ERROR_CODE: Readonly<Record<MCPErrorCode, number>> = Object.freeze({
  PARSE_ERROR:      -32700,
  INVALID_PARAMS:   -32602,
  TOOL_NOT_FOUND:   -32601,
  EXECUTION_ERROR:  -32001,
  WALLET_NOT_FOUND: -32002,
  RATE_LIMITED:     -32003,
  METHOD_NOT_ALLOWED: -32004,
  INTERNAL_ERROR:   -32603,
});

function toJsonRpcErrorCode(code: MCPErrorCode): number {
  return JSON_RPC_ERROR_CODE[code];
}

/**
 * Maps MCP error codes to semantically correct HTTP status codes.
 *
 * JSON-RPC 2.0 doesn't constrain HTTP status — the wire protocol uses its own
 * error.code field. But SolHunt's MCP server is also invoked over plain HTTP
 * (direct format, no `method` wrapper) where clients DO depend on HTTP status.
 * Previously every MCP error returned HTTP 400, which collapsed
 * user-correctable failures (WALLET_NOT_FOUND, INVALID_PARAMS) together with
 * server-side outages (INTERNAL_ERROR, EXECUTION_ERROR) and made a 429 look
 * like a malformed request. Returning the correct HTTP status lets browser
 * fetch() and CLI clients (curl, MCP-Inspector) differentiate retry-vs-fix
 * behaviour using a single field — the same UX split JSON-RPC's error.code
 * already encodes on the wrapper side.
 *
 *  - PARSE_ERROR / INVALID_PARAMS / TOOL_NOT_FOUND → 400 (client-side malformed)
 *  - WALLET_NOT_FOUND                              → 404 (resource identity issue)
 *  - METHOD_NOT_ALLOWED                            → 405 (HTTP semantics)
 *  - RATE_LIMITED                                  → 429 (already handled separately)
 *  - EXECUTION_ERROR                               → 502 (downstream API call failed —
 *                                                     the upstream wallet API is the
 *                                                     misbehaving party, not SolHunt's
 *                                                     handler logic, which makes 502 a
 *                                                     better signal than 500)
 *  - INTERNAL_ERROR                                → 500 (SolHunt-side bug)
 */
const MCP_ERROR_HTTP_STATUS: Readonly<Record<MCPErrorCode, number>> = Object.freeze({
  PARSE_ERROR:        400,
  INVALID_PARAMS:     400,
  TOOL_NOT_FOUND:     400,
  WALLET_NOT_FOUND:   404,
  METHOD_NOT_ALLOWED: 405,
  RATE_LIMITED:       429,
  EXECUTION_ERROR:    502,
  INTERNAL_ERROR:     500,
});

function toHttpStatus(code: MCPErrorCode): number {
  return MCP_ERROR_HTTP_STATUS[code];
}

/**
 * Creates a typed MCP error response conforming to the Smithery MCP error schema.
 * @param code - One of: PARSE_ERROR, INVALID_PARAMS, TOOL_NOT_FOUND, EXECUTION_ERROR,
 *               WALLET_NOT_FOUND, RATE_LIMITED, METHOD_NOT_ALLOWED, INTERNAL_ERROR.
 * @param message - Human-readable error message (used as 'error' field in response).
 * @param tool - Optional tool name that produced this error (useful for debugging).
 * @param detail - Machine-readable additional context (structured error body, etc.).
 */
function createMCPError(code: MCPErrorCode, message: string, tool?: string, detail?: string): MCPErrorResponse {
  return { error: message, code, tool, detail };
}

/**
 * Fire-and-forget analytics POST to the mcp-logs endpoint.
 * Centralised so the success path and the error catch in executeTool share
 * exactly the same payload shape, timeout, and silent-fail behaviour. Without
 * this helper the two paths drift independently — the 3s AbortSignal.timeout
 * was added to the success path in one commit and then to the error path in a
 * follow-up, and a third fix elsewhere added a new payload field that only
 * landed on one branch. Collapsing them into one function makes that class of
 * bug structurally impossible.
 *
 * 3s AbortSignal.timeout is intentional: a hung mcp-logs endpoint would
 * otherwise pin the MCP Lambda instance for the rest of the function
 * timeout window (Netlify waits up to the full timeout to free it), blocking
 * subsequent calls and leaking the wallet address into any partial-response
 * logs. 3s is generous for an internal analytics endpoint and lets us move
 * on fast.
 *
 * Silent fail by design: analytics logging must never break tool execution,
 * including a tool that is already failing.
 *
 * @param name - Tool name (for the `tool` field of the mcp-logs payload).
 * @param walletAddress - Caller's wallet address (already-truncated by the
 *   mcp-logs endpoint, so safe to forward).
 * @param startMs - Epoch ms when the tool started; the helper computes
 *   `duration = Date.now() - startMs` at call time.
 * @param success - Whether the tool completed normally (true) or threw (false).
 */
function logMcpCall(
  name: ToolName,
  walletAddress: string,
  startMs: number,
  success: boolean,
): void {
  void fetch('https://solhunt.dev/.netlify/functions/mcp-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: name, wallet: walletAddress, duration: Date.now() - startMs, success }),
    signal: AbortSignal.timeout(3000),
  }).catch((_logErr: unknown) => {
    // Silent fail — analytics logging must never break tool execution
  });
}

async function executeTool(
  name: ToolName,
  args: ToolArgs,
  apiKey?: string
): Promise<unknown> {
  // Start the timer before any async work so analytics duration reflects the
  // full tool execution. Previously this was hardcoded to 0 — the mcp-logs
  // dashboard had no way to distinguish fast calls from slow ones, so P95
  // latency, slow-tool alerts, and per-tool SLO tracking were all blind.
  const startMs = Date.now();

  // Log structured analytics for monitoring (safe: no wallet balance/tx details logged)
  // Extract wallet address for rate limiting and logging.
  // ToolArgs is a union; we use property checks to safely narrow which field is present.
  const walletAddress = ('wallet_address' in args && args.wallet_address) ||
                        ('destination_wallet' in args && args.destination_wallet) ||
                        'N/A';
  safeLogInfo(`MCP_CALL: ${name} | wallet=${walletAddress} | ${new Date().toISOString()}`);

  // Fire-and-forget analytics logging on the success path. The error path
  // calls the same helper from its catch block so both paths use identical
  // payload shape, timeout, and silent-fail behaviour.
  logMcpCall(name, walletAddress, startMs, true);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cache-Control': 'no-store, max-age=300',
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
          const detail = await healthRes.text().catch((e: unknown) => healthRes.statusText || String(e));
          if (healthRes.status === 404) {
            return createMCPError('WALLET_NOT_FOUND', `Wallet ${address} not found. Check the address and try again.`, name);
          }
          return createMCPError('EXECUTION_ERROR', `Wallet scan API error ${healthRes.status}: ${detail}`, name, detail);
        }
        if (!oppsRes.ok) {
          const detail = await oppsRes.text().catch((e: unknown) => oppsRes.statusText || String(e));
          if (oppsRes.status === 404) {
            return createMCPError('WALLET_NOT_FOUND', `Wallet ${address} not found or has no recovery opportunities.`, name);
          }
          return createMCPError('EXECUTION_ERROR', `Opportunities API error ${oppsRes.status}: ${detail}`, name, detail);
        }

        const [healthData, oppsData] = await Promise.all([
          healthRes.json().catch((e: unknown) => { throw new Error(`Health scan response parse failed: ${e instanceof Error ? e.message : String(e)}`); }),
          oppsRes.json().catch((e: unknown) => { throw new Error(`Opportunities response parse failed: ${e instanceof Error ? e.message : String(e)}`); })
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
          // 404 must be surfaced as WALLET_NOT_FOUND, not EXECUTION_ERROR,
          // for parity with get_wallet_report. Otherwise an MCP client
          // (Claude, Cursor, Windsurf) reads a malformed/inactive wallet
          // address as a generic upstream failure and retries indefinitely
          // instead of prompting the user to fix the input. The JSON-RPC
          // error.code maps to -32002 (WALLET_NOT_FOUND) and the HTTP
          // status is 404 — both let the client branch on "fix input"
          // vs "retry with backoff" without an extra round trip.
          const detail = await parseResponseDetail(res);
          if (res.status === 404) {
            return createMCPError('WALLET_NOT_FOUND', `Wallet ${address} not found or has no token approvals to scan.`, name, detail);
          }
          return createMCPError('EXECUTION_ERROR', `Token approvals scan failed: ${res.status}`, name, detail);
        }
        const data = await res.json().catch((e: unknown) => { throw new Error(`Token approvals scan response parse failed: ${e instanceof Error ? e.message : String(e)}`); });
        return { success: true, data };
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
          const detail = await parseResponseDetail(res);
          return createMCPError('EXECUTION_ERROR', `API error ${res.status}: ${detail}`, name, detail);
        }
        return res.json().catch((e: unknown) =>
          createMCPError('EXECUTION_ERROR', `Build revoke response parse failed: ${e instanceof Error ? e.message : String(e)}`, name)
        );
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
          const detail = await parseResponseDetail(res);
          return createMCPError('EXECUTION_ERROR', `API error ${res.status}: ${detail}`, name, detail);
        }
        return res.json().catch((e: unknown) =>
          createMCPError('EXECUTION_ERROR', `Build recovery response parse failed: ${e instanceof Error ? e.message : String(e)}`, name)
        );
      }

      case 'preview_recovery': {
        const address = (args as PreviewRecoveryArgs).wallet_address;

        // Fetch wallet opportunities for fee preview
        const oppsRes = await fetch(
          `${API_BASE}/api/wallet-opportunities?wallet=${encodeURIComponent(address)}`,
          { headers, signal: AbortSignal.timeout(10000) }
        );

        if (!oppsRes.ok) {
          const detail = await oppsRes.text().catch((e: unknown) => oppsRes.statusText || String(e));
          return createMCPError('EXECUTION_ERROR', `Opportunities API error ${oppsRes.status}: ${detail}`, name, detail);
        }

        const oppsData = await oppsRes.json().catch((e: unknown) => { throw new Error(`Preview recovery response parse failed: ${e instanceof Error ? e.message : String(e)}`); });
        const opps = oppsData?.data || {};

        const recoverableSol = opps.total_recoverable_sol || 0;
        const feeSol = parseFloat((recoverableSol * FEE_PERCENT).toFixed(6));
        const netSol = parseFloat((recoverableSol - feeSol).toFixed(6));
        const txCostSol = opps.total_tx_cost_sol || 0;
        const worthRecovering = netSol > 0.001;

        return {
          success: true,
          data: {
            address,
            recoverable_sol: recoverableSol,
            fee_sol: feeSol,
            fee_percent: FEE_PERCENT,
            net_recoverable_sol: netSol,
            estimated_tx_cost_sol: txCostSol,
            estimated_batches: opps.estimated_batches ?? 0,
            worth_recovering: worthRecovering,
            next_step: worthRecovering
              ? 'Call build_recovery_transaction to get unsigned transaction bytes'
              : 'No recovery needed. Wallet is clean.',
            previewed_at: new Date().toISOString(),
          }
        };
      }

      case 'discover_platform_features': {
        const category = (args as DiscoverPlatformFeaturesArgs).feature_category || 'all';

        const allFeatures: FeaturesByCategory = {
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
            'API Access: Programmatic MCP access for AI agents and automated workflows.',
            'MCP get_wallet_report: Full wallet health analysis (recoverable SOL, fee preview, batch count) in one call.',
            'MCP scan_token_approvals: Find dApp token spending approvals rated by risk (HIGH/MEDIUM/LOW).',
            'MCP build_revoke_transactions: Build unsigned tx to revoke token approvals (user signs and submits).',
            'MCP build_recovery_transaction: Build unsigned tx to recover SOL from zero-balance accounts (user signs and submits).',
            'MCP preview_recovery: Explicit fee preview before building any transaction — full transparency on SolHunt fees.',
          ],
          analytics: [
            'Token Swap Hub: Jupiter and Raydium swap integrations for recovered dust.',
            'Market Intelligence: Premium analytics and token tracing.',
          ],
        };

        const categories = category === 'all' ? Object.values(allFeatures).flat() : (allFeatures[category] ?? []);

        // Shape parity with the other 5 MCP tools: every other tool returns
        // { success: true, data: { ... } }, but discover_platform_features was
        // returning { success, category, web_exclusive_tools, url } at the
        // top level. AI agents wired against the standard contract (and the
        // SolHunt MCP Skill docs) trip on this — Claude, Cursor, and Windsurf
        // all assume a uniform envelope so a single tool breaking it forces
        // every caller to add a tool-specific branch. Normalising the shape
        // here means one parser works for all six tools.
        //
        // category_labels exposes the category→human description mapping so
        // agents that filter by 'recovery' / 'security' / 'harvesting' /
        // 'agents' / 'analytics' can present the category name to the user
        // without parsing the prose of each web_exclusive_tools entry.
        const categoryLabels: Record<string, string> = {
          recovery: 'Wallet recovery tools',
          security: 'Security & risk analysis',
          harvesting: 'Yield & reward harvesting',
          agents: 'Automation, MCP, and fleet tools',
          analytics: 'Markets and swap routing',
        };

        return {
          success: true,
          data: {
            category,
            category_label: category === 'all' ? 'All SolHunt features' : (categoryLabels[category] ?? category),
            category_labels: categoryLabels,
            web_exclusive_tools: categories,
            url: 'https://solhunt.dev',
          },
        };
      }

      default:
        return createMCPError('TOOL_NOT_FOUND', `Unknown tool: ${name}`, name);
    }
  } catch (e: unknown) {
    // Unexpected errors are server-side bugs, not tool execution failures — tag as INTERNAL_ERROR
    const message = e instanceof Error ? e.message : typeof e === 'string' ? e : String(e ?? 'Unknown error');
    // Surface the failure to the analytics pipeline so the mcp-logs dashboard
    // can show error rate per tool. Fire-and-forget — must never break the
    // already-failing tool call. Safe to log the wallet here because mcp-logs
    // already truncates it to 8 chars + '...' before storage. Same helper as
    // the success path so payload, timeout, and silent-fail stay identical.
    logMcpCall(name, walletAddress, startMs, false);
    return createMCPError(
      'INTERNAL_ERROR',
      `Internal server error: ${message}`,
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

// Lazy-cleanup threshold: once a map exceeds this many keys, drop all
// expired entries on the next write. Picked well above expected steady-state
// for a warm Netlify function (a handful of IPs × handful of wallets) so
// the sweep is rare under normal load but the map cannot grow unbounded
// under abuse or long-lived warm instances. 1000 entries × ~80 bytes each
// is ~80KB — comfortably under any Lambda heap concern.
const RATE_MAP_CLEANUP_THRESHOLD = 1000;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  source: 'ip' | 'wallet';
}

/**
 * Removes expired entries from a rate-limit map. Called lazily on writes
 * when the map size crosses RATE_MAP_CLEANUP_THRESHOLD so a long-lived warm
 * Lambda can't leak memory through accumulated one-off IPs/wallets whose
 * hour-long window has already expired.
 *
 * @param map - The rate-limit map to purge (mutated in place).
 * @param now - Current epoch ms; entries with resetAt <= now are dropped.
 */
function purgeExpiredEntries(
  map: Map<string, { count: number; resetAt: number }>,
  now: number
): void {
  for (const [key, entry] of map) {
    if (entry.resetAt <= now) {
      map.delete(key);
    }
  }
}

function checkRateLimit(ip: string, walletAddress?: string): RateLimitResult {
  const now = Date.now();

  // Lazy cleanup before reads: keeps the maps bounded without paying the
  // O(n) sweep cost on the request hot path until the threshold is hit.
  if (rateLimitMap.size > RATE_MAP_CLEANUP_THRESHOLD) {
    purgeExpiredEntries(rateLimitMap, now);
  }
  if (walletRateLimitMap.size > RATE_MAP_CLEANUP_THRESHOLD) {
    purgeExpiredEntries(walletRateLimitMap, now);
  }

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
    
    // Both allowed - return the one with fewer remaining.
    // Use <= (not <) so ties resolve to 'wallet'. The wallet policy is the
    // stricter of the two (50/h vs 100/h), so on a freshly-seen wallet behind
    // a busy shared IP the wallet quota is the active constraint clients
    // should be watching. Reporting source: 'ip' here misleads API consumers
    // into optimising against the wrong bucket — they throttle IP retries
    // when the wallet quota is what actually trips next.
    if (walletResult.remaining <= ipResult.remaining) {
      return { ...walletResult, source: 'wallet' };
    }
  }
  
  return { ...ipResult, source: 'ip' };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  // CORS-safelisted response headers are exposed by default. Custom headers
  // (X-RateLimit-*, IETF RateLimit-*, Retry-After, security headers) must be
  // explicitly listed in Access-Control-Expose-Headers or browser-based MCP
  // clients (Claude, Cursor, Windsurf web UIs) will be unable to read them.
  // Without this, browser clients can hit rate limits blind — they never see
  // the remaining quota, reset time, or which policy (ip vs wallet) tripped.
  // See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers
  const EXPOSED_HEADERS = [
    // IETF rate limit fields (draft-ietf-httpapi-ratelimit-headers-11)
    'RateLimit',
    'RateLimit-Policy',
    // Legacy X-RateLimit-* fields (preserved for older clients)
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-RateLimit-Window',
    'X-RateLimit-Source',
    'X-RateLimit-Bucket',
    'X-RateLimit-Wallet-Limit',
    'X-RateLimit-Wallet-Remaining',
    'X-RateLimit-Wallet-Reset',
    // Standard 429 backoff hint
    'Retry-After',
  ].join(', ');

  const headers = buildCorsHeaders(event, {
    methods: 'GET, POST, OPTIONS',
    exposeHeaders: EXPOSED_HEADERS.split(', '),
    extra: { 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-MCP-Version' },
  });

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...headers,
        // Cache the preflight response for 24h so browsers don't repeat the
        // preflight on every MCP tool call.
        'Access-Control-Max-Age': '86400',
      },
      body: ''
    };
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
    // Use wallet address as bucket key when available, else fall back to IP.
    // This lets API clients track their per-wallet quota even when sharing an IP.
    const bucketKey = (rateLimit.source === 'wallet' && walletAddress) ? walletAddress : clientIp;
    const windowSec = Math.floor(RATE_WINDOW_MS / 1000);
    const resetSec = Math.max(0, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));

    // IETF draft-ietf-httpapi-ratelimit-headers-11 structured fields.
    // RateLimit-Policy is stable across responses — clients use it to plan
    // request rates without having to discover limits empirically. We expose
    // BOTH policies (ip and wallet) so clients behind a shared IP can still
    // see the stricter per-wallet quota advertised.
    // RateLimit carries the current service limit for the most restrictive
    // active policy. `r` = remaining quota, `t` = seconds until reset.
    const rateLimitPolicy = `"ip";q=${RATE_LIMIT};w=${windowSec}, "wallet";q=${WALLET_RATE_LIMIT};w=${windowSec}`;
    const rateLimitHeader = `"${rateLimit.source}";r=${rateLimit.remaining};t=${resetSec}`;

    const base: Record<string, string> = {
      ...headers,
      // IETF-standard rate limit fields (draft-ietf-httpapi-ratelimit-headers-11)
      'RateLimit-Policy': rateLimitPolicy,
      'RateLimit': rateLimitHeader,
      // Legacy X-RateLimit-* fields — preserved for older clients that
      // haven't adopted the IETF draft. Will be removed once SolHunt
      // MCP clients (Claude, Cursor, Windsurf) all support RateLimit-*.
      'X-RateLimit-Limit': String(RATE_LIMIT),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(Math.floor(rateLimit.resetAt / 1000)),
      'X-RateLimit-Window': String(windowSec),
      'X-RateLimit-Source': rateLimit.source,
      'X-RateLimit-Bucket': bucketKey,
      'Retry-After': String(resetSec),
    };
    // Include per-wallet headers when wallet rate limiting is active
    if (rateLimit.source === 'wallet' && walletAddress) {
      const walletEntry = walletRateLimitMap.get(walletAddress);
      if (walletEntry) {
        base['X-RateLimit-Wallet-Limit'] = String(WALLET_RATE_LIMIT);
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
    // Rate limit headers are already set — preserve them in the body response too
    const retryAfterSec = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    const retryAt = new Date(rateLimit.resetAt).toISOString();
    // Return typed error + rate limit detail for programmatic clients
    return {
      statusCode: 429,
      headers: buildHeaders(true),
      body: JSON.stringify({
          ...createMCPError('RATE_LIMITED', `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`, undefined, `source=${rateLimit.source}`),
          retry_after_seconds: retryAfterSec,
          rate_limit: {
            limit: RATE_LIMIT,
            remaining: 0,
            reset_at: retryAt,
            window_seconds: Math.floor(RATE_WINDOW_MS / 1000),
            source: rateLimit.source,
          },
          ...(rateLimit.source === 'wallet' && walletAddress
            ? {
                wallet_rate_limit: {
                  limit: WALLET_RATE_LIMIT,
                  remaining: 0,
                  reset_at: retryAt,
                  source: 'wallet',
                },
              }
            : {}),
        })
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
      // Per JSON-RPC 2.0 spec: malformed JSON is a Parse error (-32700),
      // not an Invalid params error (-32602). Clients use the code to decide
      // whether to retry (transient) or fix their request body (permanent).
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(createMCPError('PARSE_ERROR', 'Invalid JSON body'))
      };
    }

    // Support both direct tool calls and JSON-RPC format
    let toolName: string;
    let toolArgs: Record<string, unknown>;

    if (body.method === 'tools/call' && body.params && typeof body.params === 'object') {
      // JSON-RPC format
      const params = body.params as Record<string, unknown>;
      toolName = params.name as string;
      // Safely narrow params.arguments — validate it's an object before casting
      const rawArgs = params.arguments ?? {};
      toolArgs = (typeof rawArgs === 'object' && rawArgs !== null)
        ? rawArgs as Record<string, unknown>
        : {};
    } else if (body.tool) {
      // Direct format
      toolName = body.tool as string;
      // Safely narrow body.arguments — validate it's an object before casting
      const rawArgs = body.arguments ?? body.args ?? {};
      toolArgs = (typeof rawArgs === 'object' && rawArgs !== null)
        ? rawArgs as Record<string, unknown>
        : {};
    } else if (body.method === 'tools/list') {
      // Tool list request in JSON-RPC format
      return {
        statusCode: 200,
        headers: buildHeaders(true),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: TOOLS }
        })
      };
    } else if (body.method === 'initialize') {
      // Standard MCP initialization — include rate limit headers so clients
      // know the current quota even on the initial handshake response
      const initParams = (body.params as Record<string, unknown>) ?? {};
      const INITIALIZE_INSTRUCTIONS = `SolHunt is a non-custodial Solana wallet recovery platform. Six tools are available:
- get_wallet_report: full wallet health analysis (recoverable SOL, fee preview, batch count)
- scan_token_approvals: find dApp token spending approvals rated by risk (HIGH/MEDIUM/LOW)
- build_revoke_transactions: build unsigned tx to revoke token approvals (user signs)
- build_recovery_transaction: build unsigned tx to recover SOL from zero-balance accounts (user signs)
- preview_recovery: explicit fee preview before building any transaction
- discover_platform_features: explore SolHunt web-only tools (LP Harvester, Fleet Manager, etc.)

Workflow: 1) Call get_wallet_report. 2) If recoverable SOL > 0.001, call preview_recovery for full fee transparency. 3) Call build_recovery_transaction to get unsigned tx bytes. 4) User signs and submits to Solana RPC. SolHunt never has custody.`;
      return {
        statusCode: 200,
        headers: buildHeaders(true),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: initParams.protocolVersion || "2025-03-05",
            capabilities: {
              tools: {},
              resources: {},
              prompts: {}
            },
            serverInfo: {
              name: "solhunt",
              version: "1.0.0",
            },
            instructions: INITIALIZE_INSTRUCTIONS
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
    } else if (body.method === 'ping') {
      // Standard MCP ping
      return {
        statusCode: 200,
        headers: buildHeaders(),
        body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result: null })
      };
    } else {
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(createMCPError('INVALID_PARAMS', `Unsupported JSON-RPC method: ${body.method}`))
      };
    }

    if (!toolName || !isValidToolName(toolName)) {
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(createMCPError('TOOL_NOT_FOUND', `Unknown tool: ${toolName || 'undefined'}`, toolName, `Valid tool names are: get_wallet_report, scan_token_approvals, build_revoke_transactions, build_recovery_transaction, preview_recovery, discover_platform_features`))
      };
    }

    const validatedArgs = validateToolArgs(toolName, toolArgs);
    if (!validatedArgs) {
      return {
        statusCode: 400,
        headers: buildHeaders(),
        body: JSON.stringify(createMCPError('INVALID_PARAMS', `Invalid arguments for ${toolName}. See the tool inputSchema for required and optional fields.`, toolName))
      };
    }

    const result = await executeTool(toolName, validatedArgs, apiKey);

    // If executeTool returned an error (non-success), propagate it as-is
    // without re-wrapping in a JSON-RPC result envelope (prevents double-wrapping)
    if (result && typeof result === 'object' && 'code' in result && 'error' in result) {
      const err = result as { code: MCPErrorCode; error: string; tool?: string; detail?: string };
      // JSON-RPC calls: wrap in JSON-RPC error envelope per spec.
      // Use the proper spec-compliant error code (PARSE_ERROR=-32700,
      // INVALID_PARAMS=-32602, TOOL_NOT_FOUND=-32601, INTERNAL_ERROR=-32603,
      // EXECUTION_ERROR=-32001, RATE_LIMITED=-32003, etc.) so clients can
      // branch intelligently — retry-vs-fix-input-vs-show-error UX all depend
      // on receiving the right code.
      if (body.method) {
        return {
          statusCode: toHttpStatus(err.code),
          headers: buildHeaders(),
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id || null,
            error: { code: toJsonRpcErrorCode(err.code), message: err.error, data: err }
          })
        };
      }
      // Direct format: preserve the typed MCP error structure
      return {
        statusCode: toHttpStatus(err.code),
        headers: buildHeaders(),
        body: JSON.stringify({ error: err.error, code: err.code, tool: err.tool, detail: err.detail })
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
