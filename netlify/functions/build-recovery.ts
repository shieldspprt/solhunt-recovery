import { Handler } from '@netlify/functions';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createCloseAccountInstruction } from '@solana/spl-token';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RENT_PER_ACCOUNT_LAMPORTS = 2039280; // 0.00203928 SOL in lamports
const MAX_ACCOUNTS_PER_TX = 15;
const FEE_PERCENT = 15;
const FEE_WALLET = 'DD4AdYKVcV6kgpmiCEeASRmJyRdKgmaRAbsjKucx8CvY';
// Configurable fee percentage via env var (default 15%). Allows ops to A/B test
// or run promotions without redeploying. Must be a finite number in [0, 100].
const EFFECTIVE_FEE_PERCENT = (() => {
  const envVal = process.env.SOLHUNT_FEE_PERCENT;
  if (envVal === undefined) return FEE_PERCENT;
  const parsed = parseFloat(envVal);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : FEE_PERCENT;
})();

function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  try {
    new PublicKey(address);
    return true;
  } catch (_err: unknown) {
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || '{}') as Record<string, unknown>;
  } catch (err: unknown) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const wallet_address = typeof body.wallet_address === 'string' ? body.wallet_address : '';
  const destination_wallet = typeof body.destination_wallet === 'string' ? body.destination_wallet : '';
  // Validate batch_number: must be a finite positive integer (Solana batches start at 1)
  const rawBatch = body.batch_number;
  const batch_number =
    typeof rawBatch === 'number' && Number.isFinite(rawBatch) && Number.isInteger(rawBatch) && rawBatch >= 1
      ? rawBatch
      : 1;
  // Validate fee_percent: must be a finite number in [0, 100]; clamp invalid values to default
  const rawFeePercent = body.fee_percent;
  const fee_percent_override =
    typeof rawFeePercent === 'number' && Number.isFinite(rawFeePercent) && rawFeePercent >= 0 && rawFeePercent <= 100
      ? rawFeePercent
      : null;
  const effective_fee_percent = fee_percent_override !== null ? fee_percent_override : EFFECTIVE_FEE_PERCENT;

  if (!wallet_address || !isValidSolanaAddress(wallet_address)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid wallet_address' }) };
  }

  if (!destination_wallet || !isValidSolanaAddress(destination_wallet)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid destination_wallet' }) };
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const userWallet = new PublicKey(wallet_address);
    const destWallet = new PublicKey(destination_wallet);
    const feeWalletPk = new PublicKey(FEE_WALLET);

    // Get all zero balance accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      userWallet,
      { programId: new PublicKey(TOKEN_PROGRAM_ID) },
      'confirmed'
    );

    const closeable: PublicKey[] = [];

    for (const { pubkey: accountPubkey, account } of tokenAccounts.value) {
      const parsed = account.data.parsed;
      const amount = parsed?.info?.tokenAmount?.uiAmount ?? 0;
      const rawAmount = parsed?.info?.tokenAmount?.amount ?? '0';

      if (amount === 0 || rawAmount === '0') {
        closeable.push(accountPubkey);
      }
    }

    const totalBatches = Math.ceil(closeable.length / MAX_ACCOUNTS_PER_TX) || 1;
    const batchIdx = Math.max(0, batch_number - 1);
    
    // Safety check
    if (batchIdx >= totalBatches && closeable.length > 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Batch number out of range' }) };
    }

    const startIdx = batchIdx * MAX_ACCOUNTS_PER_TX;
    const batchAccounts = closeable.slice(startIdx, startIdx + MAX_ACCOUNTS_PER_TX);
    
    const recoveryLamports = batchAccounts.length * RENT_PER_ACCOUNT_LAMPORTS;
    const feeLamports = Math.floor(recoveryLamports * (effective_fee_percent / 100));
    const operatorLamports = recoveryLamports - feeLamports;

    // Create Transaction
    const tx = new Transaction();
    tx.feePayer = userWallet;
    
    // Use recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    const instructionsPreview: string[] = [];

    // 1. Close accounts (funds go to userWallet so they can be transferred afterwards)
    for (const acc of batchAccounts) {
      tx.add(
        createCloseAccountInstruction(
          acc, // account to close
          userWallet, // destination for rent
          userWallet // owner
        )
      );
      instructionsPreview.push(`closeAccount: ${acc.toBase58()} → ${userWallet.toBase58()}`);
    }

    // 2. Transfer Fee to SolHunt
    if (feeLamports > 0) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: userWallet,
          toPubkey: feeWalletPk,
          lamports: feeLamports
        })
      );
      instructionsPreview.push(`transfer: ${(feeLamports / 1e9).toFixed(5)} SOL → SolHunt fee wallet`);
    }

    // 3. Transfer remaining recovered SOL to destination (if it's different from the userWallet)
    if (operatorLamports > 0 && userWallet.toBase58() !== destWallet.toBase58()) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: userWallet,
          toPubkey: destWallet,
          lamports: operatorLamports
        })
      );
      instructionsPreview.push(`transfer: ${(operatorLamports / 1e9).toFixed(5)} SOL → ${destWallet.toBase58()}`);
    }

    const unsignedTransaction = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        batch_number: batch_number,
        total_batches: totalBatches,
        accounts_in_batch: batchAccounts.length,
        recovery_lamports: recoveryLamports,
        fee_lamports: feeLamports,
        fee_percent: effective_fee_percent,
        operator_lamports: operatorLamports,
        unsigned_transaction: unsignedTransaction,
        instructions_preview: instructionsPreview,
        sign_and_submit: "User signs this transaction with their wallet keypair and submits to Solana RPC"
      })
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // Production log silence — matches the pattern in scan-wallet.ts,
    // dd-sign.ts, wallet-opportunities.ts, and scan-token-approvals.ts.
    const isProduction = process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';
    if (!isProduction) {
      console.error('build-recovery error:', errorMessage);
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to build recovery transaction',
        code: 'EXECUTION_ERROR',
        detail: errorMessage
      })
    };
  }
};
