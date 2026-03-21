// netlify/functions/get-stats.ts
// Returns stored daily stats — used by the stats page and by external agents

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600' // cache for 1 hour
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // How many days of history to return (default: 7)
  const days = Math.min(
    parseInt(event.queryStringParameters?.days || '7'),
    30
  );

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
    const totalSol7d = sevenDay.reduce((sum: number, d: any) => sum + Number(d.total_recoverable_sol), 0);
    const avgDust7d = sevenDay.length > 0
      ? sevenDay.reduce((sum: number, d: any) => sum + Number(d.percent_with_dust), 0) / sevenDay.length
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
  } catch (e: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
