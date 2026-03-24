// netlify/functions/build-revoke.ts
// Builds unsigned transaction(s) to revoke token approvals
// Fee: 0.001 SOL per batch (first transaction only)

import { Handler } from '@netlify/functions';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createRevokeInstruction, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

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
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { wallet_address, token_accounts, batch_number = 1 } = body;

  if (!wallet_address || !isValidSolanaAddress(wallet_address)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid wallet_address' }) };
  }

  if (!token_accounts || !Array.isArray(token_accounts) || token_accounts.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'token_accounts array required' }) };
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
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid token accounts to revoke' }) };
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

  } catch (error: any) {
    console.error('build-revoke error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to build revoke transaction. RPC may be rate limited.'
      })
    };
  }
};
