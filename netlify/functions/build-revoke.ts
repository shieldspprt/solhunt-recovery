// netlify/functions/build-revoke.ts
// Builds unsigned transaction(s) to revoke token approvals
// Fee: 0.001 SOL per batch (first transaction only)

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createRevokeInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  type Handler,
  buildCorsHeaders,
  corsPreflightResponse,
  errorBody,
  getErrorMessage,
  isValidSolanaAddress,
  methodNotAllowed,
  safeLogError,
} from './_shared';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const TOKEN_PROGRAM_ID_PK = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID_PK = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

const MAX_REVOKE_PER_TX = 15;
const SERVICE_FEE_SOL = 0.001;
const SERVICE_FEE_LAMPORTS = Math.floor(SERVICE_FEE_SOL * 1_000_000_000);
const FEE_WALLET = 'DD4AdYKVcV6kgpmiCEeASRmJyRdKgmaRAbsjKucx8CvY';

interface TokenAccountToRevoke {
  address: string;
  mint: string;
  delegate: string;
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' | 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
}

export const handler: Handler = async (event) => {
  const headers = buildCorsHeaders(event, { methods: 'POST, OPTIONS' });

  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse(event, { methods: 'POST, OPTIONS' });
  }

  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(event, 'POST, OPTIONS');
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || '{}') as Record<string, unknown>;
  } catch (err: unknown) {
    // Parse error — return the typed contract so clients can branch on
    // code='PARSE_ERROR' (retryable transient) vs. 'INVALID_PARAMS' (fix
    // your request) vs. 'EXECUTION_ERROR' (server bug).
    safeLogError('build-revoke parse error:', getErrorMessage(err));
    return { statusCode: 400, headers, body: errorBody('PARSE_ERROR', 'Invalid JSON body') };
  }

  const wallet_address = typeof body.wallet_address === 'string' ? body.wallet_address : '';
  const batch_number = typeof body.batch_number === 'number' ? body.batch_number : 1;
  const token_accounts_raw = body.token_accounts;
  const token_accounts = Array.isArray(token_accounts_raw) ? token_accounts_raw : [];

  if (!wallet_address || !isValidSolanaAddress(wallet_address)) {
    return { statusCode: 400, headers, body: errorBody('INVALID_PARAMS', 'Invalid wallet_address', 'Provide a base58 Solana public key (32-44 characters).') };
  }

  if (!token_accounts || token_accounts.length === 0) {
    return { statusCode: 400, headers, body: errorBody('INVALID_PARAMS', 'token_accounts array required', 'Provide a non-empty array of token account objects with address and mint fields.') };
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const userWallet = new PublicKey(wallet_address);
    const feeWalletPk = new PublicKey(FEE_WALLET);

    // Validate all token accounts
    const accountsToRevoke: TokenAccountToRevoke[] = [];
    for (const acc of token_accounts) {
      if (!acc.address || !isValidSolanaAddress(acc.address)) continue;
      if (!acc.mint || !isValidSolanaAddress(acc.mint)) continue;
      
      accountsToRevoke.push({
        address: acc.address,
        mint: acc.mint,
        delegate: acc.delegate || 'unknown',
        programId: acc.programId === TOKEN_2022_PROGRAM_ID.toBase58() 
          ? 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
          : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
      });
    }

    if (accountsToRevoke.length === 0) {
      return { statusCode: 400, headers, body: errorBody('INVALID_PARAMS', 'No valid token accounts to revoke', 'Each token account must have a valid base58 address and mint.') };
    }

    // Get blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Group into batches
    const batches: TokenAccountToRevoke[][] = [];
    for (let i = 0; i < accountsToRevoke.length; i += MAX_REVOKE_PER_TX) {
      batches.push(accountsToRevoke.slice(i, i + MAX_REVOKE_PER_TX));
    }

    const totalBatches = batches.length;
    const batchIdx = Math.min(Math.max(0, batch_number - 1), totalBatches - 1);
    const currentBatch = batches[batchIdx];

    // Build transaction
    const transaction = new Transaction();

    // Add compute budget for priority fee (optional but recommended)
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userWallet,
        toPubkey: feeWalletPk,
        lamports: SERVICE_FEE_LAMPORTS,
      })
    );

    // Add revoke instructions for each token account
    for (const acc of currentBatch) {
      const tokenAccountPubkey = new PublicKey(acc.address);
      const programId = acc.programId === TOKEN_2022_PROGRAM_ID.toBase58()
        ? TOKEN_2022_PROGRAM_ID_PK
        : TOKEN_PROGRAM_ID_PK;

      transaction.add(
        createRevokeInstruction(
          tokenAccountPubkey,
          userWallet,
          [],
          programId
        )
      );
    }

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    // Serialize to base64
    const serialized = transaction.serialize({ requireAllSignatures: false });
    const base64Tx = Buffer.from(serialized).toString('base64');

    // Calculate what gets revoked
    const revokeCount = currentBatch.length;
    const remaining = accountsToRevoke.length - (batchIdx * MAX_REVOKE_PER_TX) - revokeCount;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        wallet: wallet_address,
        batch_number: batchIdx + 1,
        total_batches: totalBatches,
        revoke_count: revokeCount,
        remaining: remaining,
        service_fee_sol: SERVICE_FEE_SOL,
        unsigned_transaction: base64Tx,
        blockhash,
        last_valid_block_height: lastValidBlockHeight,
        instructions: {
          fee_transfer: 1,
          revoke_instructions: revokeCount,
          total: 1 + revokeCount
        },
        ready_to_sign: true,
        warning: 'Transaction expires in ~90 seconds. Sign and submit quickly!'
      })
    };

  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    safeLogError('build-revoke error:', errorMessage);
    return {
      statusCode: 500,
      headers,
      body: errorBody('EXECUTION_ERROR', 'Failed to build revoke transaction', errorMessage)
    };
  }
};
