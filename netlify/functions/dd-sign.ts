import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  Connection, Keypair, Transaction,
  SystemProgram, PublicKey,
  TransactionInstruction
} from '@solana/web3.js';
import bs58 from 'bs58';

// ── Hard limits — in code, not config ────────────────────────────────────────
const DD_WALLET          = 'DD4AdYKVcV6kgpmiCEeASRmJyRdKgmaRAbsjKucx8CvY';
const FIXED_LAMPORTS     = 1000;    // 0.000001 SOL. Always. No exceptions.
const DAILY_CAP_LAMPORTS = 15000;   // 0.000015 SOL/day max across all instances
const MAX_MEMO_LENGTH    = 300;     // characters
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

// ── Constant-time auth check ──────────────────────────────────────────────────
function checkAuth(headers: Record<string, string | undefined>): boolean {
  const provided = headers['x-dd-sign-secret'];
  const expected = process.env.DD_SIGN_SECRET;
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

interface SpendLogRow {
  amount_lamports: number;
}

// ── Daily spend check ─────────────────────────────────────────────────────────
async function getTodaySpendLamports(): Promise<number> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('dd_spend_log')
    .select('amount_lamports')
    .gte('sent_at', todayStart.toISOString());
  return (data || []).reduce((sum: number, r: SpendLogRow) => sum + r.amount_lamports, 0);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler: Handler = async (event) => {
  const allowedOrigins = ['https://solhunt.dev', 'http://localhost:5173', 'http://localhost:8888'];
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://solhunt.dev';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }
  if (!checkAuth(event.headers)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  /** Typed request body for DD sign endpoint */
  interface DDSignRequest {
    to_wallet: string;
    memo: string;
    [key: string]: unknown; // catch extra fields — rejected below
  }

  let body: DDSignRequest;
  try {
    body = JSON.parse(event.body || '{}') as DDSignRequest;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Only two fields allowed. Any extra = reject.
  const allowed = new Set(['to_wallet', 'memo']);
  const extra = Object.keys(body).filter(f => !allowed.has(f));
  if (extra.length > 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { to_wallet, memo } = body;

  if (!to_wallet || typeof to_wallet !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }
  if (!memo || typeof memo !== 'string' || memo.trim().length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) };
  }
  if (memo.length > MAX_MEMO_LENGTH) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Memo max ${MAX_MEMO_LENGTH} chars` }) };
  }

  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(to_wallet);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid wallet address' }) };
  }

  // Daily cap check
  const todaySpend = await getTodaySpendLamports();
  if (todaySpend + FIXED_LAMPORTS > DAILY_CAP_LAMPORTS) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Daily cap reached. Resets midnight UTC.' })
    };
  }

  try {
    const rawKey = process.env.DD_PRIVATE_KEY;
    if (!rawKey) {
      console.error('DD_PRIVATE_KEY not set');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuration error' }) };
    }

    const ddKeypair = Keypair.fromSecretKey(bs58.decode(rawKey));

    if (ddKeypair.publicKey.toBase58() !== DD_WALLET) {
      console.error('CRITICAL: keypair mismatch');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = ddKeypair.publicKey;

    // Memo instruction
    tx.add(new TransactionInstruction({
      keys: [{ pubkey: ddKeypair.publicKey, isSigner: true, isWritable: true }],
      programId: new PublicKey(MEMO_PROGRAM),
      data: Buffer.from(memo.trim(), 'utf-8')
    }));

    // Fixed tiny transfer — hardcoded, no variable amount
    tx.add(SystemProgram.transfer({
      fromPubkey: ddKeypair.publicKey,
      toPubkey: recipientPubkey,
      lamports: FIXED_LAMPORTS
    }));

    tx.sign(ddKeypair);

    const signature = await connection.sendRawTransaction(
      tx.serialize(),
      { skipPreflight: false, maxRetries: 3 }
    );

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    // Log spend
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    await supabase.from('dd_spend_log').insert({
      tx_signature: signature,
      amount_lamports: FIXED_LAMPORTS,
      to_wallet,
      memo_preview: memo.slice(0, 50),
      sent_at: new Date().toISOString()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        signature,
        explorer: `https://solscan.io/tx/${signature}`
      })
    };

  } catch (e: unknown) {
    console.error('dd-sign error:', e instanceof Error ? e.message : String(e));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Transaction failed: ' + (e instanceof Error ? e.message : String(e)) })
    };
  }
};
