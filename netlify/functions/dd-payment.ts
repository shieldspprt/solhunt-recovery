import { createClient } from '@supabase/supabase-js';
import {
  type Handler,
  buildCorsHeaders,
  getErrorMessage,
  methodNotAllowed,
  safeLogError,
} from './_shared';

const DD_WALLET   = 'DD4AdYKVcV6kgpmiCEeASRmJyRdKgmaRAbsjKucx8CvY';
const MEMO_PROG   = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

const TIERS = [
  { min: 0.009,  label: 'fleet',    days: 30 },
  { min: 0.004,  label: 'plus',     days: 30 },
  { min: 0.0009, label: 'standard', days: 30 }
];

function getTier(sol: number) {
  return TIERS.find(t => sol >= t.min) || null;
}

// ── Local Types for Helius Webhook Payload ──────────────────────────────────
// Typed to match the Helius parsed transaction webhook format

interface HeliusInstruction {
  programId: string;
  data?: string;
}

interface HeliusNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number; // in lamports
}

interface HeliusTransaction {
  signature: string;
  instructions?: HeliusInstruction[];
  nativeTransfers?: HeliusNativeTransfer[];
  memo?: string;
}

function extractMemo(tx: HeliusTransaction): string | null {
  if (tx.memo && typeof tx.memo === 'string') return tx.memo.trim();
  const ixs = tx.instructions ?? [];
  const memoIx = ixs.find((ix: HeliusInstruction) => ix.programId === MEMO_PROG);
  if (memoIx?.data) return String(memoIx.data).trim();
  return null;
}

export const handler: Handler = async (event) => {
  const headers = buildCorsHeaders(event, {
    methods: 'POST, OPTIONS',
    // dd-payment also accepts `Authorization: Bearer …` for the Helius webhook auth.
    extra: { 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
  });

  if (event.httpMethod !== 'POST') {
    return methodNotAllowed(event, 'POST, OPTIONS');
  }

  // Helius webhook auth
  const auth = event.headers?.['authorization'];
  if (auth !== `Bearer ${process.env.HELIUS_WEBHOOK_SECRET}`) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let transactions: HeliusTransaction[];
  try {
    transactions = JSON.parse(event.body || '[]');
    if (!Array.isArray(transactions)) throw new Error('expected array');
  } catch (_err: unknown) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid body' }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  let registered = 0, queries = 0, confirmations = 0;

  for (const tx of transactions) {
    try {
      const incoming = (tx.nativeTransfers || []).filter(
        (t: HeliusNativeTransfer) => t.toUserAccount === DD_WALLET && t.amount > 0
      );

      for (const transfer of incoming) {
        const sender    = transfer.fromUserAccount;
        const amountSol = transfer.amount / 1e9;
        if (!sender || sender === DD_WALLET) continue;

        const memo = extractMemo(tx);

        // Confirmation transaction
        if (memo?.startsWith('DD/CONFIRM/')) {
          await supabase.from('dd_inbox').upsert({
            from_wallet:      sender,
            message:          memo.slice(0, 500),
            tx_signature:     tx.signature,
            amount_sol:       amountSol,
            paid_reply:       false,
            is_confirmation:  true,
            received_at:      new Date().toISOString(),
            replied:          false
          }, { onConflict: 'tx_signature' });
          confirmations++;
          continue;
        }

        // Message with memo
        if (memo && memo.length > 2) {
          const isPaid = amountSol >= 0.001;
          await supabase.from('dd_inbox').upsert({
            from_wallet:     sender,
            message:         memo.slice(0, 500),
            tx_signature:    tx.signature,
            amount_sol:      amountSol,
            paid_reply:      isPaid,
            is_confirmation: false,
            received_at:     new Date().toISOString(),
            replied:         false
          }, { onConflict: 'tx_signature' });
          if (isPaid) queries++;
          continue;
        }

        // No memo — watchlist registration
        const tier = getTier(amountSol);
        if (!tier) continue;

        await supabase.from('dd_watchlist').upsert({
          wallet:          sender,
          tier:            tier.label,
          payment_sol:     amountSol,
          payment_tx:      tx.signature,
          expires_at:      new Date(Date.now() + tier.days * 86400000).toISOString(),
          active:          true,
          registered_at:   new Date().toISOString()
        }, { onConflict: 'wallet' });
        registered++;
      }
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      // Suppresses in prod to keep sender wallet/amount data off Netlify server stderr.
      safeLogError('dd-payment error:', message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Payment processing failed: ${message}`,
          processed: transactions.length,
          partial: { registered, queries, confirmations }
        })
      };
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, processed: transactions.length, registered, queries, confirmations })
  };
};
