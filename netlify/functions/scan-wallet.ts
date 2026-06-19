// netlify/functions/scan-wallet.ts
// Scans a Solana wallet for recoverable SOL (locked rent in zero-balance token accounts)
// No auth required. Public data only. Rate limited by Helius free tier.

import { Connection, PublicKey } from '@solana/web3.js';
import {
  type Handler,
  buildCorsHeaders,
  corsPreflightResponse,
  errorBody,
  getErrorMessage,
  isValidSolanaAddress,
  methodNotAllowed,
  safeLogError,
  getSolanaRpcUrl,
  SOLANA_TOKEN_PROGRAM_ID,
} from './_shared';

const RPC_URL = getSolanaRpcUrl();

const TOKEN_PROGRAM_ID = SOLANA_TOKEN_PROGRAM_ID;
const RENT_PER_ACCOUNT_SOL = 0.00203928; // standard token account rent
const MAX_ACCOUNTS_PER_TX = 20;
const TX_FEE_SOL = 0.000005;

// ── Score calculation ─────────────────────────────────────────────────────────

function computeScore(closeableCount: number, dustCount: number): {
  score: number;
  grade: string;
  label: string;
} {
  let score = 100;
  score -= Math.min(closeableCount * 0.5, 40);
  score -= Math.min(dustCount * 0.2, 10);
  score = Math.max(0, Math.round(score));

  const grade = score >= 80 ? 'A'
    : score >= 60 ? 'B'
    : score >= 40 ? 'C'
    : score >= 20 ? 'D' : 'F';

  const label = score >= 80 ? 'Healthy'
    : score >= 60 ? 'Good'
    : score >= 40 ? 'Needs Cleanup'
    : 'Critical';

  return { score, grade, label };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const headers = buildCorsHeaders(event, { methods: 'GET, OPTIONS' });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse(event, { methods: 'GET, OPTIONS' });
  }

  if (event.httpMethod !== 'GET') {
    return methodNotAllowed(event, 'GET, OPTIONS');
  }

  // Get wallet address from query param
  const address = event.queryStringParameters?.address?.trim();

  if (!address) {
    return {
      statusCode: 400,
      headers,
      body: errorBody('INVALID_PARAMS', 'Missing address parameter', 'Pass ?address=<base58 Solana public key>.')
    };
  }

  if (!isValidSolanaAddress(address)) {
    return {
      statusCode: 400,
      headers,
      body: errorBody('INVALID_PARAMS', 'Invalid Solana wallet address', 'Must be 32–44 characters, base58 encoded.')
    };
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const pubkey = new PublicKey(address);

    // Fetch all token accounts owned by this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: new PublicKey(TOKEN_PROGRAM_ID) },
      'confirmed'
    );

    // Separate zero-balance (closeable) from dust (non-zero, tiny balance)
    const closeable: string[] = [];
    let dustCount = 0;

    for (const { pubkey: accountPubkey, account } of tokenAccounts.value) {
      const parsed = account.data.parsed;
      const amount = parsed?.info?.tokenAmount?.uiAmount ?? 0;
      const rawAmount = parsed?.info?.tokenAmount?.amount ?? '0';

      if (amount === 0 || rawAmount === '0') {
        closeable.push(accountPubkey.toBase58());
      } else if (amount > 0 && amount < 0.01) {
        dustCount++;
      }
    }

    // Calculate recoverable amounts
    const recoverableSol = closeable.length * RENT_PER_ACCOUNT_SOL;
    const estimatedBatches = Math.ceil(closeable.length / MAX_ACCOUNTS_PER_TX);
    const estimatedTxCost = estimatedBatches * TX_FEE_SOL;
    const netRecoverable = Math.max(0, recoverableSol - estimatedTxCost);

    // Compute health score
    const { score, grade, label } = computeScore(closeable.length, dustCount);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          address,
          health_score: score,
          grade,
          health_label: label,
          closeable_accounts: closeable.length,
          dust_tokens: dustCount,
          recoverable_sol: parseFloat(recoverableSol.toFixed(6)),
          estimated_tx_cost_sol: parseFloat(estimatedTxCost.toFixed(6)),
          net_recoverable_sol: parseFloat(netRecoverable.toFixed(6)),
          worth_cleaning: netRecoverable > 0.01,
          scanned_at: new Date().toISOString()
        }
      })
    };
  } catch (error: unknown) {
    // Check for known RPC errors with type-safe access
    const errorMessage = getErrorMessage(error);

    if (errorMessage.includes('Invalid public key')) {
      return {
        statusCode: 400,
        headers,
        body: errorBody('INVALID_PARAMS', 'Invalid wallet address', 'Solana public key did not pass curve-point validation.')
      };
    }

    safeLogError('scan-wallet error:', errorMessage);
    return {
      statusCode: 500,
      headers,
      body: errorBody('EXECUTION_ERROR', 'Scan failed. The RPC may be rate limited. Try again in a moment.', errorMessage)
    };
  }
};
