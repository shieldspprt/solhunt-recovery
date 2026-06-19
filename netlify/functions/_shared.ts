// netlify/functions/_shared.ts
// Shared utilities for SolHunt Netlify Functions.
//
// The leading underscore in the filename signals to Netlify's function
// discovery (zip-it-and-ship-it) that this is a helper module, not a
// standalone function endpoint. Netlify treats every *.ts file in
// `netlify/functions/` as a function whose name comes from the filename;
// the leading underscore is a documented convention to opt out of
// deployment as a standalone endpoint. See:
//   - https://docs.netlify.com/build/configure-builds/file-based-function-discovery/
//   - https://github.com/netlify/zip-it-and-ship-it#default-configuration
//
// Functions in this file are inlined by esbuild bundler into each consumer
// (or referenced by relative import path). They are NEVER deployed as
// `/.netlify/functions/_shared`.
//
// This module is the single source of truth for:
//   1. CORS header generation (allowed origins, security headers, expose headers)
//   2. Production-aware logging helpers (suppress in prod, preserve in dev)
//   3. Solana base58 public-key validation
//   4. Safe error message extraction from `unknown` values
//   5. Solana mainnet RPC URL resolution + SPL token program IDs
//
// Previously each of these was duplicated across 9+ Netlify functions with
// subtle drift (different allowlists, different security headers, different
// log noise patterns). Centralising them eliminates ~150 lines of
// boilerplate and makes the security posture uniform.

import type { Handler, HandlerEvent } from '@netlify/functions';
import { PublicKey } from '@solana/web3.js';

// ── CORS / Security Headers ──────────────────────────────────────────────────

/** Origins allowed to make CORS requests to SolHunt API endpoints. */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://solhunt.dev',
  'http://localhost:5173',
  'http://localhost:8888',
] as const;

/**
 * Headers attached to every Netlify function response.
 *
 * - `Vary: Origin` is required so caches don't serve a `Access-Control-Allow-Origin`
 *   for one origin to a different origin.
 * - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and the
 *   restrictive CSP are the project's baseline response security policy
 *   (matches `netlify.toml` security headers).
 * - `Cache-Control: no-store` is the safe default for handler responses —
 *   individual functions can override it.
 */
export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Vary': 'Origin',
});

/**
 * Build the CORS / security header set for a handler invocation.
 * Picks `Access-Control-Allow-Origin` from the request's `Origin` header
 * when it matches the allowlist; falls back to the production origin.
 *
 * @param event - The Netlify HandlerEvent whose headers we should inspect.
 * @param options.methods - HTTP methods to advertise (e.g. 'GET, POST, OPTIONS').
 * @param options.exposeHeaders - Extra headers to expose to the browser
 *   (rate-limit headers, etc.). Always includes the base set.
 * @param options.cacheControl - Optional `Cache-Control` override. Defaults
 *   to 'no-store' for handler responses.
 * @param options.extra - Any additional caller-specific headers to merge in.
 */
export interface CorsOptions {
  methods: string;
  exposeHeaders?: readonly string[];
  cacheControl?: string;
  extra?: Record<string, string>;
}

export function buildCorsHeaders(
  event: Pick<HandlerEvent, 'headers'>,
  options: CorsOptions,
): Record<string, string> {
  const requestOrigin = event.headers.origin || event.headers.Origin || '';
  const corsOrigin = (ALLOWED_ORIGINS as readonly string[]).includes(requestOrigin)
    ? requestOrigin
    : 'https://solhunt.dev';

  const headers: Record<string, string> = {
    ...BASE_SECURITY_HEADERS,
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': options.methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-MCP-Version',
    'Cache-Control': options.cacheControl ?? 'no-store',
    ...(options.exposeHeaders && options.exposeHeaders.length > 0
      ? { 'Access-Control-Expose-Headers': options.exposeHeaders.join(', ') }
      : {}),
    ...(options.extra ?? {}),
  };

  return headers;
}

/**
 * Build the CORS preflight response (HTTP 200, empty body, Max-Age set
 * to 24h so browsers cache the preflight for cross-origin MCP clients).
 */
export function corsPreflightResponse(
  event: Pick<HandlerEvent, 'headers'>,
  options: Omit<CorsOptions, 'cacheControl'>,
): { statusCode: 200; headers: Record<string, string>; body: string } {
  return {
    statusCode: 200,
    headers: {
      ...buildCorsHeaders(event, { ...options, cacheControl: 'public, max-age=86400' }),
    },
    body: '',
  };
}

// ── Production-aware Logging ─────────────────────────────────────────────────
//
// Netlify routes all `console.*` calls to server stderr. A paid log drain
// can ingest that stream. To keep wallet / config metadata from leaking to
// the drain in production (where dev-only debug logs are noise and PII-
// adjacent), these helpers suppress output in production and preserve it
// in development. Mirrors the `safeLogWarn` / `safeLogInfo` pattern already
// in `dd-sign.ts` and `mcp.ts` — now extracted so every function uses the
// same gate.

/** `true` when running in Netlify production (NODE_ENV or build context). */
export const IS_PRODUCTION: boolean =
  process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';

/** Log a structured error message only in development. */
export function safeLogError(...args: unknown[]): void {
  if (!IS_PRODUCTION) console.error(...args);
}

/** Log a structured warning only in development. */
export function safeLogWarn(...args: unknown[]): void {
  if (!IS_PRODUCTION) console.warn(...args);
}

/** Log a structured info message only in development. */
export function safeLogInfo(...args: unknown[]): void {
  if (!IS_PRODUCTION) console.log(...args);
}

// ── Solana Public-Key Validation ────────────────────────────────────────────

/**
 * Validates that a string is a syntactically valid Solana public key.
 *
 * Rules:
 *   - Must be a non-empty string
 *   - Length 32–44 base58 characters (Solana pubkey + base58 overhead)
 *   - Constructable via `@solana/web3.js` `new PublicKey(...)` — this is
 *     the canonical, version-pinned check (handles curve point validity,
 *     not just charset)
 *
 * @see https://docs.solana.com/terminology#public-key
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  try {
    new PublicKey(address);
    return true;
  } catch (_err: unknown) {
    return false;
  }
}

// ── Solana RPC & Program IDs ────────────────────────────────────────────────
// Single source of truth for the Solana RPC endpoint and program ID
// constants that every Netlify function was previously declaring inline.
// Before this section, the same 4-line `RPC_URL` setup + `TOKEN_PROGRAM_ID`
// string was duplicated across 6 functions (build-recovery, build-revoke,
// preview-recovery, scan-token-approvals, scan-wallet, wallet-opportunities),
// plus a slightly different variant in dd-sign.ts and daily-stats.ts. That
// drift made it trivial to bump the Helius endpoint, change the public RPC
// fallback, or rotate the token program ID in one file and miss the others —
// which is the exact class of bug that took down production on 2026-04-19
// when build-recovery.ts pointed at a newer Helius endpoint that the
// scan-wallet function couldn't reach, returning mixed 200/502 responses
// across the same user session.
//
// Centralising here means:
//   1. Adding a new RPC endpoint (e.g. Triton, QuickNode) is a one-line change.
//   2. The fallback public RPC is identical across every function — the
//      wallet-opportunities function was previously defaulting to
//      `api.mainnet-beta.solana.com` while build-recovery.ts had a typo
//      that fell through to the same URL anyway, masking the duplication.
//   3. The `SOLANA_TOKEN_PROGRAM_ID` constant is the canonical base58
//      pubkey from the SPL Token program. Same value is also pinned in
//      src/config/solana.ts on the client side; mismatches between server
//      and client were the root cause of a 2025-12 build-recovery bug
//      where token accounts were being looked up against the wrong program.

/** SPL Token Program ID — base58 public key, canonical Solana mainnet value.
 *  Source: https://spl.solana.com/token */
export const SOLANA_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

/** SPL Token-2022 Program ID — base58 public key.
 *  Source: https://spl.solana.com/token-2022 */
export const SOLANA_TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

/**
 * Resolve the Solana mainnet RPC URL for this function invocation.
 *
 * When `HELIUS_API_KEY` is configured, returns the keyed Helius endpoint
 * (SolHunt's primary RPC, with rate limits lifted). Otherwise falls back
 * to the public Solana mainnet RPC — rate-limited but requires no secrets,
 * so the function still works in local dev or when the env var is
 * temporarily missing in CI.
 *
 * The function is lazy (not a top-level constant) because Netlify bundles
 * each function independently and the env vars are populated per-function
 * at cold start. Evaluating at call time also means the function works
 * correctly under Netlify's preview-deploys where a subset of env vars
 * may be injected lazily after the bundle is loaded.
 */
export function getSolanaRpcUrl(): string {
  const heliusKey = process.env.HELIUS_API_KEY;
  if (heliusKey && heliusKey.length > 0) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  }
  return 'https://api.mainnet-beta.solana.com';
}

// ── Safe Error Extraction ───────────────────────────────────────────────────

/**
 * Extract a human-readable error message from an `unknown` value.
 *
 * Handles the three common shapes that cross module boundaries in Node.js:
 *   1. Native `Error` subclasses (most RPC, fetch, and SDK errors)
 *   2. Plain string throws (e.g. `throw 'wallet not found'`)
 *   3. Anything else — coerced to string, with a fallback for nullish
 *
 * The function intentionally returns a string (not the original error
 * object) so callers can pass it directly into log drains and JSON
 * response bodies without leaking the full stack trace or any attached
 * metadata. Stack traces stay in the error itself if callers want them.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error ?? 'Unknown error');
}

// ── HTTP Method Gate ────────────────────────────────────────────────────────

/**
 * Standard Netlify function error codes. Matches the subset of
 * `MCPErrorCode` from `mcp.ts` that's meaningful for direct API
 * endpoints (no JSON-RPC framing, no Smithery specifics).
 *
 * Centralising the union here means adding a new code (e.g. `RATE_LIMITED`
 * for a future in-function throttle) is a one-line change that the
 * TypeScript compiler then verifies at every call site.
 */
export type NetlifyErrorCode =
  | 'PARSE_ERROR'
  | 'INVALID_PARAMS'
  | 'METHOD_NOT_ALLOWED'
  | 'EXECUTION_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Build a typed error response body that matches the
 * `{ error, code, detail? }` contract used across SolHunt Netlify
 * functions (preview-recovery, build-recovery, build-revoke, mcp).
 *
 * `detail` is omitted from the JSON when undefined so we don't emit
 * `"detail": undefined` in the wire format — clients can use
 * `'code' in body && body.code === 'PARSE_ERROR'` to branch on
 * error type without having to special-case missing detail.
 *
 * Usage:
 *   return { statusCode: 400, headers, body: errorBody('PARSE_ERROR', 'Invalid JSON body') };
 *   return { statusCode: 400, headers, body: errorBody('INVALID_PARAMS', 'Invalid wallet', 'Provide a base58 address') };
 */
export function errorBody(
  code: NetlifyErrorCode,
  error: string,
  detail?: string,
): string {
  return JSON.stringify(
    detail === undefined ? { error, code } : { error, code, detail },
  );
}

/**
 * Build a typed 405 Method Not Allowed response using the shared
 * CORS/security headers. Reduces the "if (method !== X) return …" boilerplate
 * in every function to a single line.
 *
 * Body shape matches the `{ error, code, detail? }` contract used by
 * `errorBody()` — every Netlify function's 405 path now returns the same
 * typed envelope as 400/500 errors, so clients can branch on
 * `body.code === 'METHOD_NOT_ALLOWED'` without special-casing missing fields.
 */
export function methodNotAllowed(
  event: Pick<HandlerEvent, 'headers'>,
  methods: string,
  exposeHeaders?: readonly string[],
): { statusCode: 405; headers: Record<string, string>; body: string } {
  return {
    statusCode: 405,
    headers: {
      ...buildCorsHeaders(event, { methods, exposeHeaders }),
      'Allow': methods,
    },
    body: errorBody('METHOD_NOT_ALLOWED', `Method not allowed. Use ${methods}.`),
  };
}

// Re-export Handler type for callers that want to type their signatures
// without importing @netlify/functions directly.
export type { Handler };
