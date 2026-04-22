// netlify/functions/mcp-logs.ts
// Query endpoint for MCP call analytics
// Returns recent tool calls with wallet, timestamp, and duration

import { Handler } from '@netlify/functions';

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
  const allowedOrigins = ['https://solhunt.dev', 'http://localhost:5173', 'http://localhost:8888'];
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://solhunt.dev';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
  };

  // Log a call (POST from mcp.ts)
  if (event.httpMethod === 'POST') {
    try {
      const { tool, wallet, duration, success } = JSON.parse(event.body || '{}');
      
      global.mcpCallLog.unshift({
        timestamp: new Date().toISOString(),
        tool,
        wallet: wallet ? wallet.slice(0, 8) + '...' : 'unknown',
        duration,
        success
      });
      
      // Keep only last MAX_LOGS
      if (global.mcpCallLog.length > MAX_LOGS) {
        global.mcpCallLog = global.mcpCallLog.slice(0, MAX_LOGS);
      }
      
      return { statusCode: 200, headers, body: JSON.stringify({ logged: true }) };
    } catch (err: unknown) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid log data' }) };
    }
  }
  
  // Query logs (GET)
  if (event.httpMethod === 'GET') {
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const tool = event.queryStringParameters?.tool;
    
    let logs = global.mcpCallLog.slice(0, Math.min(limit, 1000));
    
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