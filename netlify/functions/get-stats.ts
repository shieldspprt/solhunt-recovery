// netlify/functions/get-stats.ts
// Returns stored daily stats — used by the stats page and by external agents

import { createClient } from '@supabase/supabase-js';
import {
  type Handler,
  buildCorsHeaders,
  corsPreflightResponse,
  getErrorMessage,
  safeLogError,
} from './_shared';

interface DayStat {
  date: string;
  wallets_scanned: number;
  wallets_with_dust: number;
  total_recoverable_sol: number;
  avg_recoverable_sol: number;
  max_recoverable_sol: number;
  percent_with_dust: number;
  x_draft: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const handler: Handler = async (event) => {
  // get-stats is a public read endpoint — cache the response for an hour to
  // reduce Supabase load. Overridden via the shared header builder.
  const headers = buildCorsHeaders(event, {
    methods: 'GET, OPTIONS',
    cacheControl: 'public, max-age=3600',
  });

  if (event.httpMethod === 'OPTIONS') {
    return corsPreflightResponse(event, { methods: 'GET, OPTIONS' });
  }

  // How many days of history to return (default: 7, max: 30).
  // Hardened parser: clamp to [1, 30], fall back to 7 on any non-numeric /
  // NaN / negative / zero input. Previously `parseInt('abc')` returned NaN
  // and `Math.min(NaN, 30)` stayed NaN — Supabase `.limit(NaN)` would then
  // reject the request. Negative limits (e.g. `?days=-5`) also slipped
  // through Math.min unchanged.
  const DEFAULT_DAYS = 7;
  const MAX_DAYS = 30;
  const rawDays = event.queryStringParameters?.days;
  const parsedDays = rawDays === undefined ? DEFAULT_DAYS : Number.parseInt(rawDays, 10);
  const days = Number.isFinite(parsedDays) && parsedDays > 0
    ? Math.min(parsedDays, MAX_DAYS)
    : DEFAULT_DAYS;

  try {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('date, wallets_scanned, wallets_with_dust, total_recoverable_sol, avg_recoverable_sol, max_recoverable_sol, percent_with_dust, x_draft')
      .order('date', { ascending: false })
      .limit(days);

    if (error) throw error;

    // Today's stats (most recent row)
    const today = data?.[0] || null;

    // 7-day totals for trend display
    const sevenDay = data || [];
    const totalSol7d = sevenDay.reduce((sum: number, d: DayStat) => sum + Number(d.total_recoverable_sol), 0);
    const avgDust7d = sevenDay.length > 0
      ? sevenDay.reduce((sum: number, d: DayStat) => sum + Number(d.percent_with_dust), 0) / sevenDay.length
      : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          today,
          history: data || [],
          totals: {
            sol_7d: parseFloat(totalSol7d.toFixed(3)),
            avg_dust_percent_7d: parseFloat(avgDust7d.toFixed(1)),
            days_of_data: sevenDay.length
          }
        }
      })
    };
  } catch (e: unknown) {
    const message = getErrorMessage(e);
    safeLogError('get-stats error:', message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: message })
    };
  }
};
