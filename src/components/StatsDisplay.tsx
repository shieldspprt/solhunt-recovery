// src/components/StatsDisplay.tsx
// Shows today's scan stats and the ready-to-post X draft
// Displays on solhunt.dev homepage or /stats page

import { useState, useEffect, memo, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface StatsData {
  today: DayStat | null;
  history: DayStat[];
  totals: {
    sol_7d: number;
    avg_dust_percent_7d: number;
    days_of_data: number;
  };
}

// ── Skeleton shimmer for loading state ───────────────────────────────────────

const StatsSkeleton = memo(function StatsSkeleton() {
  return (
    <section className="w-full max-w-2xl mx-auto px-4 py-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex flex-col gap-1.5">
          <div className="h-6 w-40 bg-gray-800 rounded animate-pulse" />
          <div className="h-3 w-56 bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="h-5 w-20 bg-gray-800 rounded animate-pulse" />
      </div>

      {/* 4 stat boxes skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-4 text-center bg-gray-800/70 border border-gray-700/50">
            <div className="h-3 w-16 mx-auto bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-8 w-24 mx-auto bg-gray-700 rounded animate-pulse mb-1" />
            <div className="h-2 w-12 mx-auto bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* X draft skeleton */}
      <div className="mt-5 rounded-xl bg-gray-900 border border-gray-700/60">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
          <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-7 w-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-7 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="h-4 w-full bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-4/6 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
    </section>
  );
});

// ── Copy to clipboard button ──────────────────────────────────────────────────

const CopyButton = memo(({ text, label = 'Copy' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers without clipboard API
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={[
        'text-xs px-3 py-1.5 rounded-md font-medium transition-all',
        copied
          ? 'bg-green-600 text-white'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
      ].join(' ')}
      aria-label={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
});

// ── Single stat box (memoized) ───────────────────────────────────────────────

const StatBox = memo(function StatBox({
  label,
  value,
  sub,
  accent
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={[
      'rounded-xl p-4 text-center',
      accent
        ? 'bg-purple-900/50 border border-purple-500/30'
        : 'bg-gray-800/70 border border-gray-700/50'
    ].join(' ')}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ? 'text-purple-300' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
});

// ── 7-day mini bar chart (memoized) ──────────────────────────────────────────

const MiniChart = memo(function MiniChart({ history }: { history: DayStat[] }) {
  if (history.length < 2) return null;

  const reversed = [...history].reverse(); // oldest first
  const maxSol = Math.max(...reversed.map(d => d.total_recoverable_sol));

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 mb-2">7-day recoverable SOL</p>
      <div className="flex items-end gap-1 h-12">
        {reversed.map((d) => (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${d.date}: ${d.total_recoverable_sol} SOL`}
          >
            <div
              className="w-full rounded-t bg-purple-500/60 hover:bg-purple-400/80 transition-colors"
              style={{
                height: maxSol > 0
                  ? `${Math.max(4, (d.total_recoverable_sol / maxSol) * 40)}px`
                  : '4px'
              }}
            />
            <span className="text-gray-600 text-xs">
              {new Date(d.date).getDate()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export function StatsDisplay() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/get-stats')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (d.success) setData(d.data);
        else setError('Failed to load stats');
      })
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <StatsSkeleton />;
  }

  if (error || !data?.today) {
    return (
      <section className="w-full max-w-2xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600 text-sm">
          Stats update daily at 9am UTC.
          {!data?.today && data?.totals?.days_of_data === 0
            ? ' First scan has not run yet.'
            : ''
          }
        </p>
      </section>
    );
  }

  const { today, history, totals } = data;

  return (
    <section className="w-full max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-white">Daily Wallet Scan</h2>
          <p className="text-xs text-gray-500">
            {new Date(today.date).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded">
          Updates 9am UTC
        </span>
      </div>

      {/* Today's 4 key stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox
          label="Wallets Scanned"
          value={today.wallets_scanned.toLocaleString()}
        />
        <StatBox
          label="Have Hidden SOL"
          value={`${today.percent_with_dust}%`}
          sub={`${today.wallets_with_dust} wallets`}
          accent
        />
        <StatBox
          label="Total Recoverable"
          value={`${today.total_recoverable_sol.toFixed(2)} SOL`}
          sub={`~$${(today.total_recoverable_sol * 150).toFixed(0)}`}
          accent
        />
        <StatBox
          label="Avg Per Wallet"
          value={`${today.avg_recoverable_sol.toFixed(4)}`}
          sub="SOL (wallets with dust)"
        />
      </div>

      {/* 7-day chart */}
      {history.length > 1 && <MiniChart history={history} />}

      {/* 7-day totals */}
      {totals.days_of_data > 1 && (
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span>{totals.days_of_data}-day total: <span className="text-gray-400">{totals.sol_7d.toFixed(2)} SOL</span></span>
          <span>Avg dust rate: <span className="text-gray-400">{totals.avg_dust_percent_7d}%</span></span>
        </div>
      )}

      {/* X draft — the most important part */}
      <div className="mt-5 rounded-xl bg-gray-900 border border-gray-700/60">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.733-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="text-xs text-gray-400 font-medium">Today's post draft</span>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton text={today.x_draft} label="Copy post" />
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(today.x_draft)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-md font-medium bg-black hover:bg-gray-900 text-white border border-gray-700 transition-all"
            >
              Post to X →
            </a>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
            {today.x_draft}
          </p>
        </div>
        <div className="px-4 py-2 border-t border-gray-700/60">
          <p className="text-xs text-gray-600">
            {today.x_draft.length} characters
            {today.x_draft.length > 280 && (
              <span className="text-yellow-600 ml-2">
                ⚠ Over 280 chars — trim before posting
              </span>
            )}
          </p>
        </div>
      </div>

    </section>
  );
}

export default StatsDisplay;
