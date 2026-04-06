import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

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

function extractMemo(tx: any): string | null {
  if (tx.memo && typeof tx.memo === 'string') return tx.memo.trim();
  const ixs = tx.instructions || [];
  const memoIx = ixs.find((ix: any) => ix.programId === MEMO_PROG);
  if (memoIx?.data) return String(memoIx.data).trim();
  return null;
}

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  // Helius webhook auth
  const auth = event.headers?.['authorization'];
  if (auth !== `Bearer ${process.env.HELIUS_WEBHOOK_SECRET}`) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let transactions: any[];
  try {
    transactions = JSON.parse(event.body || '[]');
    if (!Array.isArray(transactions)) throw new Error('expected array');
  } catch {
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
        (t: any) => t.toUserAccount === DD_WALLET && t.amount > 0
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
      console.error('dd-payment error:', e instanceof Error ? e.message : String(e));
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, processed: transactions.length, registered, queries, confirmations })
  };
};
