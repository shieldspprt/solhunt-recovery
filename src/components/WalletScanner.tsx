// src/components/WalletScanner.tsx
// Wallet scanner component for SolHunt homepage
// Self-contained. Manages its own state. No props required.

import { useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanResult {
  address: string;
  health_score: number;
  grade: string;
  health_label: string;
  closeable_accounts: number;
  dust_tokens: number;
  recoverable_sol: number;
  estimated_tx_cost_sol: number;
  net_recoverable_sol: number;
  worth_cleaning: boolean;
  scanned_at: string;
}

type ScanState = 'idle' | 'loading' | 'success' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed);
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-green-400';
    case 'B': return 'text-green-300';
    case 'C': return 'text-yellow-400';
    case 'D': return 'text-orange-400';
    case 'F': return 'text-red-400';
    default:  return 'text-gray-400';
  }
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-green-400';
  if (score >= 40) return 'bg-yellow-400';
  if (score >= 20) return 'bg-orange-400';
  return 'bg-red-500';
}

function formatSol(sol: number): string {
  if (sol === 0) return '0';
  if (sol < 0.001) return sol.toFixed(6);
  if (sol < 0.1) return sol.toFixed(4);
  return sol.toFixed(3);
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${scoreBarColor(score)}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-purple-900/40 border border-purple-500/30' : 'bg-gray-800/60'}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-purple-300' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Results display ───────────────────────────────────────────────────────────

function ScanResults({ result }: { result: ScanResult }) {
  return (
    <div className="mt-6 space-y-4 animate-in fade-in duration-300">

      {/* Header row: address + score */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm font-mono">
            {shortenAddress(result.address)}
          </span>
          <span className={`text-2xl font-black ${gradeColor(result.grade)}`}>
            {result.grade}
          </span>
          <span className="text-gray-400 text-sm">
            {result.health_label}
          </span>
        </div>
        <span className="text-gray-500 text-xs">
          Score: {result.health_score}/100
        </span>
      </div>

      {/* Score bar */}
      <ScoreBar score={result.health_score} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Recoverable SOL"
          value={`${formatSol(result.recoverable_sol)} SOL`}
          sub={`~$${(result.recoverable_sol * 150).toFixed(2)} at $150/SOL`}
          highlight={result.recoverable_sol > 0}
        />
        <StatCard
          label="Dead Accounts"
          value={result.closeable_accounts.toString()}
          sub="zero-balance token accounts"
        />
        <StatCard
          label="Dust Tokens"
          value={result.dust_tokens.toString()}
          sub="tiny non-zero balances"
        />
        <StatCard
          label="Net After Fees"
          value={`${formatSol(result.net_recoverable_sol)} SOL`}
          sub="after ~0.000005 SOL/tx"
        />
      </div>

      {/* CTA or clean message */}
      {result.worth_cleaning ? (
        <div className="rounded-lg bg-purple-950/60 border border-purple-500/40 p-4">
          <p className="text-purple-200 font-medium text-sm mb-1">
            You have {formatSol(result.recoverable_sol)} SOL recoverable
          </p>
          <p className="text-gray-400 text-xs mb-3">
            Connect your wallet to recover it now using SolHunt.
            Takes about 2 minutes. No third-party custody.
          </p>
          <button
            className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Recover SOL →
          </button>
        </div>
      ) : (
        <div className="rounded-lg bg-green-950/40 border border-green-700/30 p-4">
          <p className="text-green-400 font-medium text-sm">
            ✓ Wallet looks clean
          </p>
          <p className="text-gray-400 text-xs mt-1">
            No significant recoverable SOL found. Check back after your next round of activity.
          </p>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-gray-600 text-right">
        Scanned {new Date(result.scanned_at).toLocaleTimeString()}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WalletScanner() {
  const [address, setAddress] = useState('');
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleScan = useCallback(async () => {
    const trimmed = address.trim();

    // Client-side validation before hitting the API
    if (!trimmed) {
      setError('Paste a wallet address to scan');
      return;
    }

    if (!isValidSolanaAddress(trimmed)) {
      setError('That does not look like a valid Solana address (32–44 characters, base58)');
      return;
    }

    setError('');
    setState('loading');
    setResult(null);

    try {
      const response = await fetch(
        `/api/scan-wallet?address=${encodeURIComponent(trimmed)}`,
        { method: 'GET' }
      );

      const data = await response.json();

      if (!data.success) {
        setState('error');
        setError(data.error || 'Scan failed. Please try again.');
        return;
      }

      setResult(data.data);
      setState('success');
    } catch (e: any) {
      setState('error');
      setError('Network error. Check your connection and try again.');
    }
  }, [address]);

  // Allow Enter key to trigger scan
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan();
  }, [handleScan]);

  // Clear results when address changes
  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    if (state !== 'idle') {
      setState('idle');
      setResult(null);
      setError('');
    }
  }, [state]);

  return (
    <section className="w-full max-w-2xl mx-auto px-4 py-8">

      {/* Section heading */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">
          Check any wallet for hidden SOL
        </h2>
        <p className="text-gray-400 text-sm">
          Paste any Solana address. We scan for locked rent in empty token accounts.
          Free. No wallet connection needed.
        </p>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={handleAddressChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste wallet address..."
          className={[
            'flex-1 bg-gray-800 border rounded-lg px-4 py-3 text-sm text-white',
            'placeholder-gray-500 outline-none transition-colors font-mono',
            error
              ? 'border-red-500/60 focus:border-red-400'
              : 'border-gray-600 focus:border-purple-500'
          ].join(' ')}
          disabled={state === 'loading'}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={handleScan}
          disabled={state === 'loading' || !address.trim()}
          className={[
            'px-5 py-3 rounded-lg font-medium text-sm transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            state === 'loading'
              ? 'bg-purple-700 text-purple-300 cursor-wait'
              : 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white'
          ].join(' ')}
        >
          {state === 'loading' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Scanning
            </span>
          ) : 'Scan'}
        </button>
      </div>

      {/* Validation error */}
      {error && state !== 'loading' && (
        <p className="mt-2 text-red-400 text-xs pl-1">{error}</p>
      )}

      {/* Loading state */}
      {state === 'loading' && (
        <div className="mt-6 flex items-center gap-3 text-gray-400 text-sm">
          <svg className="animate-spin h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Scanning wallet on Solana mainnet...
        </div>
      )}

      {/* Results */}
      {state === 'success' && result && (
        <ScanResults result={result} />
      )}

    </section>
  );
}

export default WalletScanner;
