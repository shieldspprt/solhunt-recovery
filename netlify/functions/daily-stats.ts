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
const DEFAULT_WALLETS_TO_SCAN = 300; // Solid credible baseline that perfectly fits inside a 30s Lambda
const SCAN_BATCH_SIZE = 12;       // parallel scans at a time
const SCAN_DELAY_MS = 800;        // 800ms delay perfectly rides the Helius free tier RPS limit
const MIN_RECOVERABLE_SOL = 0.001; // skip wallets below this

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ── Step 1: Get recent active wallets from Helius ────────────────────────────
// Strategy: get recent transactions from high-activity programs
// Deduplicate fee payers = unique active wallets

interface ActiveWallet {
  address: string;
  sourceProject: string;
}

async function getRecentActiveWallets(limit: number): Promise<ActiveWallet[]> {
  // Programs that see high wallet activity on Solana
  // We query recent transactions and extract unique fee payers (= wallet addresses)
  const PROGRAM_NAMES: Record<string, string> = {
    '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'pump.fun',
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter v6',
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3sFjJ2L': 'Orca Whirlpool',
    '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin': 'OpenBook',
    'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': 'Marinade',
    'JitosoLrHgLqLmkH3fHfPPVMkHYZABQkMnRBKgguMwZ': 'Jito',
    'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr': 'Raydium v4',
    'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'Orca v1',
  };
  const TARGET_PROGRAMS = Object.keys(PROGRAM_NAMES);

  const walletMap = new Map<string, string>();

  // Fetch from all programs in parallel to stay well under Netlify 30s timeout
  await Promise.allSettled(
    TARGET_PROGRAMS.map(async (program) => {
      const projectName = PROGRAM_NAMES[program];

      try {
        const response = await fetch(
          `${HELIUS_BASE}/addresses/${program}/transactions?api-key=${HELIUS_API_KEY}&limit=60&type=UNKNOWN`,
          { signal: AbortSignal.timeout(6000) } // 6s timeout gives heavy programs time without breaking Netlify
        );

        if (!response.ok) {
          console.error(`Error fetching from Helius: ${response.status} ${response.statusText}`);
          return;
        }
        
        const txs = await response.json();
        if (!Array.isArray(txs)) return;

        for (const tx of txs) {
          const feePayer = tx.feePayer || tx.fee_payer;
          if (feePayer && typeof feePayer === 'string' && feePayer.length >= 32) {
            walletMap.set(feePayer, projectName);
          }

          if (Array.isArray(tx.signers)) {
            for (const signer of tx.signers) {
              if (typeof signer === 'string' && signer.length >= 32) {
                walletMap.set(signer, projectName);
              }
            }
          }
        }
      } catch (e: any) {
        console.error(`Failed to fetch transactions for ${program}:`, e.message);
      }
    })
  );

  // Filter out program addresses (they are not user wallets)
  const programAddresses = new Set(TARGET_PROGRAMS);
  const allWallets = Array.from(walletMap.entries())
    .filter(([w]) => !programAddresses.has(w));

  // Fisher-Yates shuffle so each run scans a different subset
  for (let i = allWallets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allWallets[i], allWallets[j]] = [allWallets[j], allWallets[i]];
  }

  const wallets: ActiveWallet[] = allWallets
    .slice(0, limit)
    .map(([address, sourceProject]) => ({ address, sourceProject }));

  console.log(`Found ${wallets.length} unique active wallets (shuffled)`);
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

async function scanAllWallets(wallets: ActiveWallet[]): Promise<{
  address: string;
  sourceProject: string;
  closeable: number;
  recoverable_sol: number;
}[]> {
  const connection = new Connection(RPC_URL, 'confirmed');
  const results: { address: string; sourceProject: string; closeable: number; recoverable_sol: number }[] = [];

  for (let i = 0; i < wallets.length; i += SCAN_BATCH_SIZE) {
    const batch = wallets.slice(i, i + SCAN_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (w) => {
        const res = await scanWallet(w.address, connection);
        return { ...res, sourceProject: w.sourceProject };
      })
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
  results: { address: string; sourceProject: string; closeable: number; recoverable_sol: number }[],
  excludeWorstWallets: Set<string> = new Set()
): {
  wallets_scanned: number;
  wallets_with_dust: number;
  total_recoverable_sol: number;
  avg_recoverable_sol: number;
  max_recoverable_sol: number;
  worst_wallet: string;
  percent_with_dust: number;
  top_project: string;
} {
  const withDust = results.filter(r => r.recoverable_sol > 0);

  const totalSol = withDust.reduce((sum, r) => sum + r.recoverable_sol, 0);
  const avgSol = withDust.length > 0 ? totalSol / withDust.length : 0;

  const sorted = withDust.sort((a, b) => b.recoverable_sol - a.recoverable_sol);

  // Pick the first wallet NOT in the exclusion set, fall back to absolute worst
  const worst = sorted.find(w => !excludeWorstWallets.has(w.address)) || sorted[0];

  if (excludeWorstWallets.size > 0) {
    console.log(`Excluding ${excludeWorstWallets.size} recent worst wallets:`, Array.from(excludeWorstWallets));
    console.log(`Selected worst wallet: ${worst?.address || 'none'} (${worst?.recoverable_sol.toFixed(4) || 0} SOL)`);
  }

  const projectStats = new Map<string, number>();
  for (const r of withDust) {
    projectStats.set(r.sourceProject, (projectStats.get(r.sourceProject) || 0) + r.recoverable_sol);
  }
  let topProject = '';
  let maxProjectSol = -1;
  for (const [project, sol] of projectStats.entries()) {
    if (sol > maxProjectSol) {
      maxProjectSol = sol;
      topProject = project;
    }
  }

  return {
    wallets_scanned: walletCount,
    wallets_with_dust: withDust.length,
    total_recoverable_sol: parseFloat(totalSol.toFixed(4)),
    avg_recoverable_sol: parseFloat(avgSol.toFixed(4)),
    max_recoverable_sol: worst ? parseFloat(worst.recoverable_sol.toFixed(4)) : 0,
    worst_wallet: worst?.address || '',
    percent_with_dust: parseFloat(((withDust.length / walletCount) * 100).toFixed(1)),
    top_project: topProject
  };
}

// ── Step 5: Generate X post draft ────────────────────────────────────────────

async function generateXDraft(stats: ReturnType<typeof computeStats>, date: string): Promise<string> {
  let solPrice = 150; // fallback
  try {
    const res = await fetch('https://price.jup.ag/v6/price?ids=SOL', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.SOL?.price) {
        solPrice = data.data.SOL.price;
      }
    }
  } catch (e: any) {
    console.warn('Failed to fetch SOL price from Jupiter:', e.message);
  }

  const totalUsd = (stats.total_recoverable_sol * solPrice).toFixed(0);
  const avgUsd = (stats.avg_recoverable_sol * solPrice).toFixed(2);
  const projectHighlight = stats.top_project ? `\n\nProjects creating the most dust today? ${stats.top_project} users lead the pack.` : '';

  // Pick one of three post templates based on the numbers
  // This creates variety so daily posts don't look copy-pasted

  const day = new Date(date).getDay(); // 0-6

  if (day % 3 === 0) {
    // Template A: Focus on total locked value
    return `We scanned ${stats.wallets_scanned} active Solana wallets today.

${stats.total_recoverable_sol.toFixed(2)} SOL (~$${totalUsd}) is sitting locked in dead token accounts.${projectHighlight}

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
Average across dirty wallets: ${stats.avg_recoverable_sol.toFixed(4)} SOL (~$${avgUsd}).${stats.top_project ? `\nTop dust-generating project: ${stats.top_project}` : ''}

Paste your address at solhunt.dev to check yours.`;
  }

  // Template C: Question format (highest engagement)
  return `${stats.percent_with_dust}% of active Solana wallets we scanned today have recoverable SOL locked in dead token accounts.

Total across ${stats.wallets_scanned} wallets: ${stats.total_recoverable_sol.toFixed(2)} SOL.${stats.top_project ? `\nUsers interacting with ${stats.top_project} had the most recoverable SOL today.` : ''}

Most operators don't know. Is your wallet one of them?

Check free at solhunt.dev ↓`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  // Security: only allow internal calls or Netlify scheduler
  const secret = event.headers?.['x-internal-secret'] || event.queryStringParameters?.secret;
  
  // Netlify's "Run now" and cron scheduler use POST requests, which we'll allow
  const isNetlifyTrigger = event.httpMethod === 'POST';

  if (!isNetlifyTrigger && secret !== API_SECRET) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // NOTE: "run once per day" guard disabled for testing — re-enable for production
  // const { data: existing } = await supabase
  //   .from('daily_stats')
  //   .select('id')
  //   .eq('date', today)
  //   .single();
  //
  // if (existing) {
  //   return {
  //     statusCode: 200,
  //     headers,
  //     body: JSON.stringify({ success: true, message: 'Already ran today', date: today })
  //   };
  // }

  try {
    console.log('Starting daily stats run for', today);
    const isFast = !!event.queryStringParameters?.fast;

    // Step 1: Get wallets
    // If fast mode, skip the Helius search entirely and just test one wallet
    const wallets: ActiveWallet[] = isFast 
      ? [{ address: 'vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg', sourceProject: 'FastModeFallback' }] 
      : await getRecentActiveWallets(DEFAULT_WALLETS_TO_SCAN);
    if (wallets.length === 0) {
      throw new Error('No wallets found — Helius may be rate limited');
    }

    // Step 2 & 3: Scan
    const results = await scanAllWallets(wallets);

    // Step 4: Fetch recent worst wallets to exclude, then compute stats
    const { data: recentWorst } = await supabase
      .from('daily_stats')
      .select('worst_wallet')
      .order('date', { ascending: false })
      .limit(10);

    const excludeWallets = new Set(
      (recentWorst || []).map((r: any) => r.worst_wallet).filter(Boolean)
    );

    const stats = computeStats(wallets.length, results, excludeWallets);

    // Step 5: Generate X draft
    const xDraft = await generateXDraft(stats, today);

    // Step 6: Save to Supabase
    const { error: dbError } = await supabase
      .from('daily_stats')
      .upsert({
        date: today,
        wallets_scanned: stats.wallets_scanned,
        wallets_with_dust: stats.wallets_with_dust,
        total_recoverable_sol: stats.total_recoverable_sol,
        avg_recoverable_sol: stats.avg_recoverable_sol,
        max_recoverable_sol: stats.max_recoverable_sol,
        worst_wallet: stats.worst_wallet,
        percent_with_dust: stats.percent_with_dust,
        x_draft: xDraft
      }, { onConflict: 'date' });

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
