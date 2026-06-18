// netlify/functions/mcp-logs.ts
// Query endpoint for MCP call analytics
// Returns recent tool calls with wallet, timestamp, and duration

import {
  type Handler,
  buildCorsHeaders,
  getErrorMessage,
  safeLogError,
} from './_shared';

// In-memory log buffer (shared across warm instances)
declare global {
  var mcpCallLog: Array<{
    timestamp: string;
    tool: string;
    wallet: string;
    duration: number;
    success: boolean;
  }>;
}

// Initialize if not exists
if (!global.mcpCallLog) {
  global.mcpCallLog = [];
}

const MAX_LOGS = 1000;

export const handler: Handler = async (event) => {
  const headers = buildCorsHeaders(event, { methods: 'GET, POST, OPTIONS' });

  // Log a call (POST from mcp.ts)
  if (event.httpMethod === 'POST') {
    try {
      // Defensive type validation. JSON.parse returns `any` and the try/catch
      // only catches a thrown SyntaxError — not wrong field types. A caller
      // sending `{"tool": 123, "duration": "abc", "success": "yes"}` would
      // silently pollute the strictly-typed mcpCallLog array, then break the
      // `tool_breakdown` accumulator and the `filter(l => l.tool === tool)`
      // GET query with a runtime TypeError. Validate every field at the
      // boundary so the log buffer can stay tightly typed downstream.
      const parsed = JSON.parse(event.body || '{}') as Record<string, unknown>;

      // tool: must be a non-empty string, capped at 64 chars (longest valid
      // MCP tool name is well under that — defensive against log injection).
      const rawTool = parsed.tool;
      if (typeof rawTool !== 'string' || rawTool.length === 0 || rawTool.length > 64) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid tool' }) };
      }
      const tool = rawTool;

      // wallet: optional string. Cap at 64 chars to match Solana pubkey max
      // (44) with a small safety margin. Non-string values are coerced to
      // 'unknown' so analytics isn't lost on bad clients.
      const rawWallet = parsed.wallet;
      const wallet = typeof rawWallet === 'string' && rawWallet.length > 0 && rawWallet.length <= 64
        ? rawWallet.slice(0, 8) + '...'
        : 'unknown';

      // duration: must be a finite non-negative number, capped at 1 hour
      // (3,600,000 ms) — anything longer is almost certainly a client bug
      // or a clock skew issue, and would skew P95 dashboards.
      const rawDuration = parsed.duration;
      if (typeof rawDuration !== 'number' || !Number.isFinite(rawDuration) || rawDuration < 0 || rawDuration > 3_600_000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid duration' }) };
      }
      const duration = rawDuration;

      // success: must be a boolean. Coerce strict-true string "true" so
      // stringified analytics from older MCP clients still work, but reject
      // any other truthy/falsy coercion (1, "yes", etc.) which used to
      // silently pass through.
      const rawSuccess = parsed.success;
      const success = typeof rawSuccess === 'boolean'
        ? rawSuccess
        : rawSuccess === 'true';

      global.mcpCallLog.unshift({
        timestamp: new Date().toISOString(),
        tool,
        wallet,
        duration,
        success,
      });
      
      // Keep only last MAX_LOGS
      if (global.mcpCallLog.length > MAX_LOGS) {
        global.mcpCallLog = global.mcpCallLog.slice(0, MAX_LOGS);
      }
      
      return { statusCode: 200, headers, body: JSON.stringify({ logged: true }) };
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      // Suppresses in prod to avoid leaking malformed payload contents
      // (which can include wallet addresses) to server stderr.
      safeLogError('mcp-logs error:', message);
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid log data' }) };
    }
  }
  
  // Query logs (GET)
  if (event.httpMethod === 'GET') {
    // Hardened limit parser: clamp to [1, 1000], fall back to 50 on any
    // non-numeric / NaN / negative / zero input. Previously `parseInt('abc')`
    // returned NaN, and `slice(0, Math.min(NaN, 1000))` silently returned 0
    // entries. Negative limits (e.g. `?limit=-5`) also slipped through
    // Math.min unchanged. Now we treat malformed input as the default and
    // bound the value to a known-safe range.
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 1000;
    const rawLimit = event.queryStringParameters?.limit;
    const parsedLimit = rawLimit === undefined ? DEFAULT_LIMIT : Number.parseInt(rawLimit, 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const tool = event.queryStringParameters?.tool;

    let logs = global.mcpCallLog.slice(0, limit);
    
    if (tool) {
      logs = logs.filter(l => l.tool === tool);
    }
    
    // Analytics summary
    const summary = {
      total_calls: global.mcpCallLog.length,
      unique_wallets: new Set(global.mcpCallLog.map(l => l.wallet)).size,
      tool_breakdown: global.mcpCallLog.reduce((acc, log) => {
        acc[log.tool] = (acc[log.tool] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recent_logs: logs
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(summary, null, 2)
    };
  }
  
  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};