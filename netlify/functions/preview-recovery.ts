import { Connection, PublicKey } from '@solana/web3.js';
import {
  type Handler,
  buildCorsHeaders,
  corsPreflightResponse,
  getErrorMessage,
  isValidSolanaAddress,
  safeLogError,
} from './_shared';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RENT_PER_ACCOUNT_SOL = 0.00203928;
const MAX_ACCOUNTS_PER_TX = 15;
const FEE_PERCENT = 15;
const ESTIMATED_TX_COST_SOL = 0.000005; // 5000 lamports base fee, just an estimate
const FEE_WALLET = 'DD4AdYKVcV6kgpmiCEeASRmJyRdKgmaRAbsjKucx8CvY';

/** Error codes returned by preview-recovery. Matches the MCPErrorCode
 *  vocabulary used in netlify/functions/mcp.ts so API and MCP clients
 *  can share a single error-decoding switch. */
type PreviewRecoveryErrorCode =
  | 'INVALID_PARAMS'
  | 'EXECUTION_ERROR'
  | 'METHOD_NOT_ALLOWED';

/** Build a typed error response body. Mirrors the { error, code, detail }
 *  shape used by build-recovery.ts and build-revoke.ts so every Netlify
 *  function returns the same error contract. */
function errorBody(
  code: PreviewRecoveryErrorCode,
  error: string,
  detail?: string,
): string {
  return JSON.stringify(
    detail === undefined ? { error, code } : { error, code, detail },
  );
}

export const handler: Handler = async (event) => {
  const headers = buildCorsHeaders(event, { methods: 'GET, OPTIONS' });

  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse(event, { methods: 'GET, OPTIONS' });
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: errorBody('METHOD_NOT_ALLOWED', `Method not allowed. Use GET.`),
    };
  }

  const wallet = event.queryStringParameters?.wallet?.trim();
  const maxAccountsStr = event.queryStringParameters?.max_accounts?.trim();

  if (!wallet || !isValidSolanaAddress(wallet)) {
    return {
      statusCode: 400,
      headers,
      body: errorBody(
        'INVALID_PARAMS',
        'Invalid or missing wallet address',
        'Provide a base58 Solana public key (32-44 characters) in the `wallet` query parameter.',
      ),
    };
  }

  // Validate max_accounts: must be a finite positive integer in [1, 1000].
  // Previously a malformed value silently became NaN and was used as the
  // slice limit, which would either return zero accounts (NaN coerces to 0)
  // or skip the cap entirely. Reject invalid input explicitly.
  const DEFAULT_MAX_ACCOUNTS = 100;
  const MIN_MAX_ACCOUNTS = 1;
  const MAX_MAX_ACCOUNTS = 1000;
  let maxAccounts = DEFAULT_MAX_ACCOUNTS;
  if (maxAccountsStr !== undefined && maxAccountsStr !== '') {
    const parsed = Number(maxAccountsStr);
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < MIN_MAX_ACCOUNTS ||
      parsed > MAX_MAX_ACCOUNTS
    ) {
      return {
        statusCode: 400,
        headers,
        body: errorBody(
          'INVALID_PARAMS',
          `Invalid max_accounts: ${maxAccountsStr}`,
          `Must be an integer between ${MIN_MAX_ACCOUNTS} and ${MAX_MAX_ACCOUNTS}.`,
        ),
      };
    }
    maxAccounts = parsed;
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const pubkey = new PublicKey(wallet);

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

    // Limit by max_accounts
    const accountsToClose = closeable.slice(0, Math.min(closeable.length, maxAccounts));
    const numAccounts = accountsToClose.length;

    const grossRecoverableSol = numAccounts * RENT_PER_ACCOUNT_SOL;
    const solhuntFeeSol = grossRecoverableSol * (FEE_PERCENT / 100);
    const youReceiveSol = grossRecoverableSol - solhuntFeeSol;

    const batchesNeeded = Math.ceil(numAccounts / MAX_ACCOUNTS_PER_TX);
    const totalEstimatedTxCost = batchesNeeded * ESTIMATED_TX_COST_SOL;
    const netToYouSol = youReceiveSol - totalEstimatedTxCost;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        wallet: wallet,
        accounts_to_close: numAccounts,
        gross_recoverable_sol: parseFloat(grossRecoverableSol.toFixed(6)),
        solhunt_fee_sol: parseFloat(solhuntFeeSol.toFixed(6)),
        fee_percent: FEE_PERCENT,
        you_receive_sol: parseFloat(youReceiveSol.toFixed(6)),
        estimated_tx_cost_sol: parseFloat(totalEstimatedTxCost.toFixed(6)),
        net_to_you_sol: parseFloat(netToYouSol.toFixed(6)),
        batches_needed: batchesNeeded,
        fee_destination: FEE_WALLET,
        ready_to_execute: numAccounts > 0
      })
    };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    safeLogError('preview-recovery error:', message);
    return {
      statusCode: 500,
      headers,
      body: errorBody(
        'EXECUTION_ERROR',
        'Failed to generate recovery preview. RPC may be rate limited.',
        message,
      ),
    };
  }
};
