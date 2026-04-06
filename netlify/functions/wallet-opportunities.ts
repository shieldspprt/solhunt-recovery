// netlify/functions/wallet-opportunities.ts
// Returns specific zero-balance token accounts that can be closed for SOL recovery
// No auth required. Rate limited by Helius free tier.

import { Handler } from '@netlify/functions';
import { Connection, PublicKey } from '@solana/web3.js';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RENT_PER_ACCOUNT_SOL = 0.00203928;
const MAX_ACCOUNTS_PER_TX = 15; // Safe limit for standard transactions

/** Safely extract error message from unknown error type */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error ?? 'Unknown error');
}

function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export const handler: Handler = async (event) => {
  const allowedOrigins = ['https://solhunt.dev', 'http://localhost:5173', 'http://localhost:8888'];
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://solhunt.dev';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const address = event.queryStringParameters?.wallet?.trim();

  if (!address) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Missing wallet parameter' })
    };
  }

  if (!isValidSolanaAddress(address)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid wallet address' })
    };
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const pubkey = new PublicKey(address);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: new PublicKey(TOKEN_PROGRAM_ID) },
      'confirmed'
    );

    const closeable: string[] = [];

    for (const { pubkey: accountPubkey, account } of tokenAccounts.value) {
      const parsed = account.data.parsed;
      const amount = parsed?.info?.tokenAmount?.uiAmount ?? 0;
      const rawAmount = parsed?.info?.tokenAmount?.amount ?? '0';

      if (amount === 0 || rawAmount === '0') {
        closeable.push(accountPubkey.toBase58());
      }
    }

    // Group into batches
    const batches: { batchNumber: number; accounts: string[]; recoverableSol: number }[] = [];
    for (let i = 0; i < closeable.length; i += MAX_ACCOUNTS_PER_TX) {
      const batchAccounts = closeable.slice(i, i + MAX_ACCOUNTS_PER_TX);
      batches.push({
        batchNumber: Math.floor(i / MAX_ACCOUNTS_PER_TX) + 1,
        accounts: batchAccounts,
        recoverableSol: parseFloat((batchAccounts.length * RENT_PER_ACCOUNT_SOL).toFixed(6))
      });
    }

    const totalRecoverable = closeable.length * RENT_PER_ACCOUNT_SOL;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          address,
          total_closeable: closeable.length,
          total_recoverable_sol: parseFloat(totalRecoverable.toFixed(6)),
          batches
        }
      })
    };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('wallet-opportunities error:', message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch opportunities. RPC may be rate limited.'
      })
    };
  }
};
