// netlify/functions/mcp.ts
// MCP (Model Context Protocol) server for SolHunt
// Makes SolHunt callable by Claude, GPT, Cursor, Windsurf,
// and any LLM that supports tool use via MCP

import { Handler } from '@netlify/functions';

// ── Tool Definitions ──────────────────────────────────────────────────────────
// These are what agents see when they load SolHunt as an MCP tool
// Write descriptions as if explaining to an AI agent — precise, actionable

const TOOLS = [
  {
    name: "check_wallet_health",
    description: `Analyze a Solana wallet for recoverable SOL locked in zero-balance token accounts.
Returns a health score (0-100), exact recoverable SOL amount, number of closeable accounts,
and a cleanup recommendation. Use this before executing trades to check if the wallet
needs maintenance, or whenever a user asks about their wallet efficiency.
Health score grades: A (80-100) healthy, B (60-79) good, C (40-59) needs cleanup,
D (20-39) poor, F (0-19) critical.`,
    inputSchema: {
      type: "object",
      required: ["wallet_address"],
      properties: {
        wallet_address: {
          type: "string",
          description: "Solana wallet public key (base58 encoded, 32-44 characters)"
        }
      }
    }
  },
  {
    name: "get_recovery_opportunities",
    description: `Get a prioritized list of specific token accounts to close for maximum SOL recovery.
Returns accounts sorted by batch group for efficient transaction building.
The agent or user executes the closures themselves using standard Solana SDK —
SolHunt never has custody of funds. Use this after check_wallet_health shows
recoverable SOL to get the exact list of what to close.`,
    inputSchema: {
      type: "object",
      required: ["wallet_address"],
      properties: {
        wallet_address: {
          type: "string",
          description: "Solana wallet public key"
        }
      }
    }
  },
  {
    name: "get_fleet_health",
    description: `Check wallet health for multiple Solana wallets simultaneously (up to 50).
Returns a summary showing which wallets are critical, warning, or healthy,
plus total recoverable SOL across the fleet. Use this for operators running
multiple agent wallets or when checking a portfolio of wallets at once.`,
    inputSchema: {
      type: "object",
      required: ["wallet_addresses"],
      properties: {
        wallet_addresses: {
          type: "array",
          items: { type: "string" },
          maxItems: 50,
          description: "Array of Solana wallet public keys to check (max 50)"
        }
      }
    }
  },
  {
    name: "get_network_stats",
    description: `Get today's Solana network-wide wallet health statistics.
Shows how many wallets were scanned, what percentage have recoverable SOL,
total SOL locked across the network, and average per wallet.
Use this for market intelligence, understanding Solana ecosystem health,
or generating data-driven insights about wallet efficiency trends.`,
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days of history to return (default 7, max 30)",
          default: 7
        }
      }
    }
  },
  {
    name: "discover_agents",
    description: `Search the SolHunt agent registry to find AI agents operating on Solana.
Filter by which protocol they work on (jupiter, pump.fun, raydium, orca, polymarket)
or by capability. Returns agents that have registered their presence and accept
introductions or collaboration proposals. Use this to find complementary agents
for data sharing or coordination.`,
    inputSchema: {
      type: "object",
      properties: {
        works_on: {
          type: "string",
          description: "Protocol filter: jupiter, pump.fun, raydium, orca, polymarket, marinade, jito"
        },
        capability: {
          type: "string",
          description: "Capability keyword to search for"
        },
        accepts_introductions: {
          type: "boolean",
          description: "Only return agents open to introductions (default: true)"
        }
      }
    }
  }
];

// ── Tool Executor ─────────────────────────────────────────────────────────────

const API_BASE = process.env.SOLHUNT_API_BASE || 'https://solhunt.dev';

async function executeTool(
  name: string,
  args: Record<string, any>,
  apiKey?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {})
  };

  try {
    switch (name) {

      case 'check_wallet_health': {
        const res = await fetch(
          `${API_BASE}/api/scan-wallet?address=${encodeURIComponent(args.wallet_address)}`,
          { headers, signal: AbortSignal.timeout(10000) }
        );
        return res.json();
      }

      case 'get_recovery_opportunities': {
        const res = await fetch(
          `${API_BASE}/api/wallet-opportunities?wallet=${encodeURIComponent(args.wallet_address)}`,
          { headers, signal: AbortSignal.timeout(10000) }
        );
        return res.json();
      }

      case 'get_fleet_health': {
        const res = await fetch(`${API_BASE}/api/fleet-health`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ wallets: args.wallet_addresses }),
          signal: AbortSignal.timeout(30000)
        });
        return res.json();
      }

      case 'get_network_stats': {
        const days = args.days || 7;
        const res = await fetch(
          `${API_BASE}/api/get-stats?days=${days}`,
          { headers, signal: AbortSignal.timeout(10000) }
        );
        return res.json();
      }

      case 'discover_agents': {
        const params = new URLSearchParams();
        if (args.works_on) params.set('works_on', args.works_on);
        if (args.capability) params.set('capability', args.capability);
        if (args.accepts_introductions !== undefined) {
          params.set('accepts_introductions', String(args.accepts_introductions ?? true));
        }
        const res = await fetch(
          `${API_BASE}/api/registry-discover?${params.toString()}`,
          { headers, signal: AbortSignal.timeout(10000) }
        );
        return res.json();
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e: any) {
    return {
      error: `Tool execution failed: ${e.message}`,
      tool: name
    };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-MCP-Version'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiKey = event.headers?.['x-api-key'] ||
    event.headers?.['authorization']?.replace('Bearer ', '') ||
    undefined;

  // ── GET: MCP Discovery — returns server metadata and tool list ──────────────
  // This is what MCP clients call to discover what tools are available
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        schema_version: "1.0",
        name: "SolHunt",
        display_name: "SolHunt Wallet Intelligence",
        description: "Solana wallet health analysis and agent coordination. Check wallet efficiency, find recoverable SOL, monitor agent fleets, and discover other agents in the Solana ecosystem.",
        version: "1.0.0",
        homepage: "https://solhunt.dev",
        icon: "https://solhunt.dev/icon.png",
        category: "blockchain",
        tags: ["solana", "wallet", "defi", "agent", "intelligence"],
        pricing: {
          type: "freemium",
          free_calls_per_day: 10,
          paid: "0.0001 SOL per call above free tier"
        },
        tools: TOOLS,
        // Standard MCP server info
        protocol_version: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {}
        }
      })
    };
  }

  // ── POST: MCP Tool Call — executes a specific tool ──────────────────────────
  if (event.httpMethod === 'POST') {
    let body: any;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }

    // Support both direct tool calls and JSON-RPC format
    // Direct: { tool: "check_wallet_health", arguments: { wallet_address: "..." } }
    // JSON-RPC: { method: "tools/call", params: { name: "check_wallet_health", arguments: {...} } }

    let toolName: string;
    let toolArgs: Record<string, any>;

    if (body.method === 'tools/call' && body.params) {
      // JSON-RPC format (used by Claude, official MCP clients)
      toolName = body.params.name;
      toolArgs = body.params.arguments || {};
    } else if (body.tool) {
      // Direct format (used by simpler integrations)
      toolName = body.tool;
      toolArgs = body.arguments || body.args || {};
    } else if (body.method === 'tools/list') {
      // Tool list request in JSON-RPC format
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: TOOLS }
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing tool name. Send { tool: "name", arguments: {} }' })
      };
    }

    if (!toolName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing tool name' })
      };
    }

    const result = await executeTool(toolName, toolArgs, apiKey);

    // Return in JSON-RPC format if that was the request format
    if (body.method) {
      return {
        statusCode: 200,
        headers,
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
      headers,
      body: JSON.stringify(result)
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
