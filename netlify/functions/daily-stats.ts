// netlify/functions/daily-stats.ts
// Runs daily at 9am UTC via Netlify scheduler
// Scans 500 recent active Solana wallets and saves aggregate stats

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { Connection, PublicKey } from '@solana/web3.js';

// ── Config ────────────────────────────────────────────────────────────────────

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const HELIUS_BASE = `https://api.helius.xyz/v0`;
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const API_SECRET = process.env.API_SECRET!;
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RENT_PER_ACCOUNT_SOL = 0.00203928;
const WALLETS_TO_SCAN = 500;
const SCAN_BATCH_SIZE = 20;       // parallel scans at a time
const SCAN_DELAY_MS = 300;        // delay between batches (rate limit)
const MIN_RECOVERABLE_SOL = 0.001; // skip wallets below this

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ── Step 1: Get recent active wallets from Helius ────────────────────────────
// Strategy: get recent transactions from high-activity programs
// Deduplicate fee payers = unique active wallets

async function getRecentActiveWallets(): Promise<string[]> {
  // Programs that see high wallet activity on Solana
  // We query recent transactions and extract unique fee payers (= wallet addresses)
  const TARGET_PROGRAMS = [
    '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', // pump.fun
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3sFjJ2L', // Orca Whirlpool
    '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', // Serum/OpenBook
  ];

  const walletSet = new Set<string>();

  for (const program of TARGET_PROGRAMS) {
    if (walletSet.size >= WALLETS_TO_SCAN) break;

    try {
      // Get recent transactions for this program
      const response = await fetch(
        `${HELIUS_BASE}/addresses/${program}/transactions?api-key=${HELIUS_API_KEY}&limit=100&type=UNKNOWN`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) continue;
      const txs = await response.json();

      if (!Array.isArray(txs)) continue;

      for (const tx of txs) {
        // Extract fee payer = the wallet that initiated the transaction
        const feePayer = tx.feePayer || tx.fee_payer;
        if (feePayer && typeof feePayer === 'string' && feePayer.length >= 32) {
          walletSet.add(feePayer);
        }

        // Also extract other signers
        if (Array.isArray(tx.signers)) {
          for (const signer of tx.signers) {
            if (typeof signer === 'string' && signer.length >= 32) {
              walletSet.add(signer);
            }
          }
        }

        if (walletSet.size >= WALLETS_TO_SCAN) break;
      }
    } catch (e: any) {
      console.error(`Failed to fetch transactions for ${program}:`, e.message);
      continue;
    }

    // Small delay between program queries
    await new Promise(r => setTimeout(r, 500));
  }

  // Filter out program addresses (they are not user wallets)
  const programAddresses = new Set(TARGET_PROGRAMS);
  const wallets = Array.from(walletSet)
    .filter(w => !programAddresses.has(w))
    .slice(0, WALLETS_TO_SCAN);

  console.log(`Found ${wallets.length} unique active wallets`);
  return wallets;
}

// ── Step 2: Scan one wallet for recoverable SOL ───────────────────────────────

async function scanWallet(address: string, connection: Connection): Promise<{
  address: string;
  closeable: number;
  recoverable_sol: number;
  error?: string;
}> {
  try {
    const pubkey = new PublicKey(address);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      pubkey,
      { programId: new PublicKey(TOKEN_PROGRAM_ID) },
      'confirmed'
    );

    const closeableCount = tokenAccounts.value.filter(({ account }) => {
      const amount = account.data.parsed?.info?.tokenAmount?.amount ?? '1';
      return amount === '0';
    }).length;

    return {
      address,
      closeable: closeableCount,
      recoverable_sol: closeableCount * RENT_PER_ACCOUNT_SOL
    };
  } catch (e: any) {
    return { address, closeable: 0, recoverable_sol: 0, error: e.message };
  }
}

// ── Step 3: Scan all wallets in parallel batches ─────────────────────────────

async function scanAllWallets(wallets: string[]): Promise<{
  address: string;
  closeable: number;
  recoverable_sol: number;
}[]> {
  const connection = new Connection(RPC_URL, 'confirmed');
  const results: { address: string; closeable: number; recoverable_sol: number }[] = [];

  for (let i = 0; i < wallets.length; i += SCAN_BATCH_SIZE) {
    const batch = wallets.slice(i, i + SCAN_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(w => scanWallet(w, connection))
    );

    results.push(
      ...batchResults
        .filter(r => !r.error && r.recoverable_sol >= MIN_RECOVERABLE_SOL)
    );

    console.log(`Scanned ${Math.min(i + SCAN_BATCH_SIZE, wallets.length)}/${wallets.length}`);

    // Rate limit delay between batches
    if (i + SCAN_BATCH_SIZE < wallets.length) {
      await new Promise(r => setTimeout(r, SCAN_DELAY_MS));
    }
  }

  return results;
}

// ── Step 4: Compute aggregate stats ──────────────────────────────────────────

function computeStats(
  walletCount: number,
  results: { address: string; closeable: number; recoverable_sol: number }[]
): {
  wallets_scanned: number;
  wallets_with_dust: number;
  total_recoverable_sol: number;
  avg_recoverable_sol: number;
  max_recoverable_sol: number;
  worst_wallet: string;
  percent_with_dust: number;
} {
  const withDust = results.filter(r => r.recoverable_sol > 0);

  const totalSol = withDust.reduce((sum, r) => sum + r.recoverable_sol, 0);
  const avgSol = withDust.length > 0 ? totalSol / withDust.length : 0;

  const worst = withDust.sort((a, b) => b.recoverable_sol - a.recoverable_sol)[0];

  return {
    wallets_scanned: walletCount,
    wallets_with_dust: withDust.length,
    total_recoverable_sol: parseFloat(totalSol.toFixed(4)),
    avg_recoverable_sol: parseFloat(avgSol.toFixed(4)),
    max_recoverable_sol: worst ? parseFloat(worst.recoverable_sol.toFixed(4)) : 0,
    worst_wallet: worst?.address || '',
    percent_with_dust: parseFloat(((withDust.length / walletCount) * 100).toFixed(1))
  };
}

// ── Step 5: Generate X post draft ────────────────────────────────────────────

function generateXDraft(stats: ReturnType<typeof computeStats>, date: string): string {
  const solPrice = 150; // hardcoded — good enough for illustration
  const totalUsd = (stats.total_recoverable_sol * solPrice).toFixed(0);
  const avgUsd = (stats.avg_recoverable_sol * solPrice).toFixed(2);

  // Pick one of three post templates based on the numbers
  // This creates variety so daily posts don't look copy-pasted

  const day = new Date(date).getDay(); // 0-6

  if (day % 3 === 0) {
    // Template A: Focus on total locked value
    return `We scanned ${stats.wallets_scanned} active Solana wallets today.

${stats.total_recoverable_sol.toFixed(2)} SOL (~$${totalUsd}) is sitting locked in dead token accounts.

${stats.percent_with_dust}% of wallets have recoverable SOL they don't know about.

Is yours one of them?
→ solhunt.dev`;
  }

  if (day % 3 === 1) {
    // Template B: Focus on the worst offender
    return `Daily Solana wallet scan — ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}

${stats.wallets_scanned} wallets scanned.
${stats.wallets_with_dust} have hidden recoverable SOL.

Worst wallet today: ${stats.max_recoverable_sol.toFixed(3)} SOL locked in empty token accounts.
Average across dirty wallets: ${stats.avg_recoverable_sol.toFixed(4)} SOL (~$${avgUsd}).

Paste your address at solhunt.dev to check yours.`;
  }

  // Template C: Question format (highest engagement)
  return `${stats.percent_with_dust}% of active Solana wallets we scanned today have recoverable SOL locked in dead token accounts.

Total across ${stats.wallets_scanned} wallets: ${stats.total_recoverable_sol.toFixed(2)} SOL.

Most operators don't know. Is your wallet one of them?

Check free at solhunt.dev ↓`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  // Security: only allow internal calls or Netlify scheduler
  const secret = event.headers?.['x-internal-secret'] ||
    event.queryStringParameters?.secret;

  if (secret !== API_SECRET) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if already ran today
  const { data: existing } = await supabase
    .from('daily_stats')
    .select('id')
    .eq('date', today)
    .single();

  if (existing) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Already ran today', date: today })
    };
  }

  try {
    console.log('Starting daily stats run for', today);

    // Step 1: Get wallets
    const wallets = await getRecentActiveWallets();
    if (wallets.length === 0) {
      throw new Error('No wallets found — Helius may be rate limited');
    }

    // Step 2 & 3: Scan
    const results = await scanAllWallets(wallets);

    // Step 4: Compute stats
    const stats = computeStats(wallets.length, results);

    // Step 5: Generate X draft
    const xDraft = generateXDraft(stats, today);

    // Step 6: Save to Supabase
    const { error: dbError } = await supabase
      .from('daily_stats')
      .insert({
        date: today,
        wallets_scanned: stats.wallets_scanned,
        wallets_with_dust: stats.wallets_with_dust,
        total_recoverable_sol: stats.total_recoverable_sol,
        avg_recoverable_sol: stats.avg_recoverable_sol,
        max_recoverable_sol: stats.max_recoverable_sol,
        worst_wallet: stats.worst_wallet,
        percent_with_dust: stats.percent_with_dust,
        x_draft: xDraft
      });

    if (dbError) throw new Error(`DB error: ${dbError.message}`);

    console.log('Daily stats saved:', stats);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        date: today,
        stats,
        x_draft: xDraft
      })
    };
  } catch (e: any) {
    console.error('Daily stats failed:', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
