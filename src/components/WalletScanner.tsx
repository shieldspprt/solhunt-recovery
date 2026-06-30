// src/components/WalletScanner.tsx
// Wallet scanner component for SolHunt homepage
// Self-contained. Manages its own state. No props required.

import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { isValidSolanaPublicKey } from '@/lib/validation';
import { shortenAddress } from '@/lib/formatting';
import { toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { clamp } from '@/lib/arrayUtils';
import { FALLBACK_SOL_PRICE_USD } from '@/lib/solPrice';
import type { WalletScanResponse } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanState = 'idle' | 'loading' | 'success' | 'error';

/** Maximum scan duration before showing timeout warning (15 seconds) */
const SCAN_TIMEOUT_MS = 15000;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function readJsonResponse(response: Response): Promise<{ data: unknown; errorText: string | null }> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return { data: await response.json(), errorText: null };
    } catch (err: unknown) {
      return {
        data: null,
        errorText: `Invalid JSON response from server (${response.status} ${response.statusText})`
      };
    }
  }

  const text = await response.text().catch(() => '');
  return {
    data: null,
    errorText: text
      ? `Unexpected response from server (${response.status} ${response.statusText}): ${text.slice(0, 120)}`
      : `Unexpected response from server (${response.status} ${response.statusText})`
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ScoreBar = memo(function ScoreBar({ score }: { score: number }) {
  // Clamp to [0, 100] so assistive tech never hears an out-of-range value
  const clampedScore = clamp(Math.round(score), 0, 100);
  return (
    <div
      className="w-full bg-gray-700 rounded-full h-2"
      role="progressbar"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Wallet health score: ${clampedScore} out of 100`}
    >
      <div
        className={`h-2 rounded-full transition-all duration-700 ${scoreBarColor(clampedScore)}`}
        style={{ width: `${clampedScore}%` }}
        aria-hidden="true"
      />
    </div>
  );
});

const StatCard = memo(function StatCard({
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
    <div className={`rounded-xl p-4 transition-colors ${highlight ? 'bg-shield-accent/5 border border-shield-accent/30 shadow-[inset_0_0_20px_rgba(20,241,149,0.05)]' : 'bg-shield-bg/50 border border-shield-border/50'}`}>
      <p className="text-[10px] text-shield-muted mb-1 font-mono uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold font-mono tracking-tight ${highlight ? 'text-shield-accent drop-shadow-[0_0_8px_rgba(20,241,149,0.4)]' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-shield-muted/70 mt-1.5 font-light">{sub}</p>}
    </div>
  );
});

// ── Results display ───────────────────────────────────────────────────────────

const ScanResults = memo(function ScanResults({ result }: { result: WalletScanResponse }) {
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
          sub={`~$${(result.recoverable_sol * FALLBACK_SOL_PRICE_USD).toFixed(2)} at $${FALLBACK_SOL_PRICE_USD}/SOL`}
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
        <div className="rounded-xl bg-shield-accent/10 border border-shield-accent/40 p-5 mt-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-shield-accent/0 via-shield-accent/5 to-shield-accent/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <h4 className="text-shield-accent font-mono text-xs tracking-widest mb-1.5 uppercase drop-shadow-[0_0_8px_rgba(20,241,149,0.5)]">
            [ Action Required ]
          </h4>
          <p className="text-white text-lg font-bold mb-4">
            {formatSol(result.recoverable_sol)} SOL Available For Recovery
          </p>
          <button
            type="button"
            aria-label="Initiate recovery protocol to reclaim SOL"
            className="inline-flex items-center gap-2 bg-shield-accent text-shield-bg hover:bg-white text-sm font-bold font-mono uppercase tracking-wide px-6 py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(20,241,149,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Initiate Protocol →
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
});

// ── Main component ────────────────────────────────────────────────────────────

export function WalletScanner() {
  const [address, setAddress] = useState('');
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<WalletScanResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [isSlow, setIsSlow] = useState(false);
  const [liveStats, setLiveStats] = useState<{scanned: number, sol: number} | null>(null);

  // Refs for managing async operations and timeouts
  const abortControllerRef = useRef<AbortController | null>(null);
  const slowScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedAddress = address.trim();
  const isAddressValid = normalizedAddress.length > 0 && isValidSolanaPublicKey(normalizedAddress);
  const addressHintId = 'wallet-scan-hint';
  const errorId = 'wallet-scan-error';
  const describedByIds = [
    error ? errorId : null,
    normalizedAddress.length > 0 && !isAddressValid && state !== 'loading' ? addressHintId : null,
  ].filter((id): id is string => Boolean(id)).join(' ') || undefined;

  // Cleanup function to cancel in-flight requests and timers
  const cleanupScan = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (slowScanTimeoutRef.current) {
      clearTimeout(slowScanTimeoutRef.current);
      slowScanTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupScan();
  }, [cleanupScan]);

  // Fetch live network overview stats strictly for the public pill
  useEffect(() => {
    // Combine the unmount-controller signal with a hard 8s timeout so a hung
    // /api/get-stats endpoint can't pin this fetch's promise indefinitely.
    // Matches the timeout used elsewhere in the codebase for /api/* calls.
    const controller = new AbortController();
    const timeoutSignal = AbortSignal.timeout(8000);
    const signal = AbortSignal.any([controller.signal, timeoutSignal]);

    fetch('/api/get-stats?days=1', { signal })
      .then(async res => {
        if (!res.ok) return null;
        try {
          return await res.json();
        } catch (err: unknown) {
          return null;
        }
      })
      .then(data => {
        if (data?.success && data?.data?.today) {
          setLiveStats({
            scanned: data.data.today.wallets_scanned,
            sol: data.data.today.total_recoverable_sol
          });
        }
      })
      .catch((err: unknown) => {
        // Non-critical — pill stats failure should not crash or alert the user
        logger.warn('Live stats fetch failed:', err instanceof Error ? err.message : String(err));
      });

    return () => controller.abort();
  }, []);

  const handleScan = useCallback(async () => {
    const trimmed = address.trim();

    // Cancel any in-flight scan before starting a new one
    cleanupScan();

    // Client-side validation before hitting the API
    if (!trimmed) {
      setError('Paste a wallet address to scan');
      return;
    }

    if (!isValidSolanaPublicKey(trimmed)) {
      setError('That does not look like a valid Solana address (32–44 characters, base58)');
      return;
    }

    setError('');
    setState('loading');
    setIsSlow(false);
    setResult(null);

    // Set up slow scan warning timeout
    slowScanTimeoutRef.current = setTimeout(() => {
      setIsSlow(true);
    }, SCAN_TIMEOUT_MS);

    // Create new abort controller for this scan
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `/api/scan-wallet?address=${encodeURIComponent(trimmed)}`,
        { 
          method: 'GET',
          signal: abortControllerRef.current.signal 
        }
      );

      // Clear slow scan timeout since we got a response
      if (slowScanTimeoutRef.current) {
        clearTimeout(slowScanTimeoutRef.current);
        slowScanTimeoutRef.current = null;
      }

      const { data, errorText } = await readJsonResponse(response);
      if (!data || typeof data !== 'object') {
        setState('error');
        setError(errorText || 'Scan failed. Please try again.');
        return;
      }

      const payload = data as Partial<WalletScanResponse> & { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        setState('error');
        setError(payload.error || errorText || 'Scan failed. Please try again.');
        return;
      }

      setResult(payload as WalletScanResponse);
      setState('success');
    } catch (err: unknown) {
      // Don't report errors for aborted requests - they were intentionally cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        setState('idle');
        return;
      }

      // Log full error in non-production for debugging; in production this is
      // handled gracefully and surfaced to the user as an AppError message
      logger.warn('WalletScanner handleScan failed:', err instanceof Error ? err.message : String(err));

      setState('error');
      const appError = toAppError(err, 'NETWORK_ERROR');
      setError(appError.message);
    } finally {
      // Clear slow scan timeout in case of error
      if (slowScanTimeoutRef.current) {
        clearTimeout(slowScanTimeoutRef.current);
        slowScanTimeoutRef.current = null;
      }
      abortControllerRef.current = null;
    }
  }, [address, cleanupScan]);

  const handlePrimaryAction = useCallback(() => {
    if (state === 'loading') {
      cleanupScan();
      setState('idle');
      setIsSlow(false);
      return;
    }

    void handleScan();
  }, [cleanupScan, handleScan, state]);

  // Allow Enter key to trigger scan
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;

    if (state === 'loading') {
      handlePrimaryAction();
      return;
    }

    if (!isAddressValid) {
      setError(normalizedAddress.length > 0
        ? 'Enter a valid Solana address before scanning'
        : 'Paste a wallet address to scan');
      return;
    }

    void handleScan();
  }, [handlePrimaryAction, handleScan, isAddressValid, normalizedAddress, state]);

  // Clear results when address changes - also cancels in-flight requests
  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    setAddress(newAddress);
    
    // Cancel any in-flight request when user starts typing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (state !== 'idle') {
      setState('idle');
      setResult(null);
      setError('');
      setIsSlow(false);
    }
  }, [state]);

  return (
    <section className="w-full max-w-2xl mx-auto px-4 py-8 relative">

      {/* Live Stats Pill */}
      {liveStats && (
        <div className="flex justify-center mb-5 animate-in fade-in duration-1000">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-shield-accent/5 border border-shield-accent/20 backdrop-blur-sm shadow-[0_0_15px_rgba(20,241,149,0.05)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-shield-accent opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-shield-accent"></span>
            </span>
            <span className="text-[10px] sm:text-xs font-mono text-shield-muted uppercase tracking-widest">
              Live Network: <span className="text-white font-bold">{liveStats.scanned.toLocaleString()}</span> scanned • <span className="text-shield-accent font-bold drop-shadow-[0_0_8px_rgba(20,241,149,0.5)]">{liveStats.sol} SOL</span> Located
            </span>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex flex-col sm:flex-row gap-3 relative z-10">
        <div className="relative flex-1 group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-shield-accent/50 to-[#9945ff]/50 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          {/* maxLength=44 caps paste/typing at the Solana address upper bound,
              preventing oversized strings from ever reaching validation.
              autoCapitalize/autoCorrect=off stop mobile keyboards from
              mutating the base58 string. See src/lib/validation.ts. */}
          <input
            type="text"
            value={address}
            onChange={handleAddressChange}
            onKeyDown={handleKeyDown}
            placeholder="[ Paste Wallet Address ]"
            aria-label="Solana wallet address to scan"
            aria-invalid={!!error || (normalizedAddress.length > 0 && !isAddressValid && state !== 'loading')}
            aria-describedby={describedByIds}
            aria-busy={state === 'loading'}
            maxLength={44}
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            pattern="^[1-9A-HJ-NP-Za-km-z]{32,44}$"
            className={[
              'relative w-full bg-shield-bg/90 backdrop-blur-xl border rounded-xl px-5 py-4 text-sm text-white',
              'placeholder-shield-muted/50 outline-none transition-all font-mono shadow-inner',
              error || (normalizedAddress.length > 0 && !isAddressValid && state !== 'loading')
                ? 'border-red-500/60 focus:border-red-400 focus:ring-1 focus:ring-red-400'
                : 'border-shield-border hover:border-shield-accent/50 focus:border-shield-accent focus:ring-1 focus:ring-shield-accent/50'
            ].join(' ')}
            disabled={state === 'loading'}
            autoComplete="off"
            spellCheck={false}
          />
          {normalizedAddress.length > 0 && !isAddressValid && state !== 'loading' && (
            <p id={addressHintId} className="mt-2 pl-1 text-xs text-red-400" role="note">
              Enter a valid Solana wallet address before scanning.
            </p>
          )}
        </div>
        <button
          onClick={handlePrimaryAction}
          aria-label={state === 'loading' ? 'Cancel wallet scan' : isAddressValid ? 'Execute wallet scan' : 'Enter a valid wallet address first'}
          disabled={state !== 'loading' && !isAddressValid}
          aria-disabled={state !== 'loading' && !isAddressValid}
          type="button"
          className={[
            'relative px-8 py-4 rounded-xl font-bold text-sm transition-all overflow-hidden group/btn font-mono uppercase tracking-widest',
            'disabled:opacity-50 disabled:cursor-not-allowed border',
            state === 'loading'
              ? 'bg-shield-bg border-shield-border text-shield-muted cursor-wait'
              : 'bg-shield-accent border-shield-accent text-shield-bg hover:shadow-[0_0_20px_rgba(20,241,149,0.4)] hover:scale-[1.02] active:scale-[0.98]'
          ].join(' ')}
        >
          {state === 'loading' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              CANCEL
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10">{isAddressValid ? 'EXECUTE' : normalizedAddress.length > 0 ? 'INVALID' : 'PASTE'}</span>
            </span>
          )}
        </button>
      </div>

      {/* Validation error */}
      {error && state !== 'loading' && (
        <p id={errorId} className="mt-2 text-red-400 text-xs pl-1" role="alert">{error}</p>
      )}

      {/* Loading state */}
      {state === 'loading' && (
        <div className="mt-6 space-y-2" role="status" aria-live="polite" aria-label="Wallet scan in progress">
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <svg className="animate-spin h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Scanning wallet on Solana mainnet...
          </div>
          {isSlow && (
            <div className="text-yellow-400 text-xs pl-7">
              Still scanning... Solana RPC may be experiencing high load.
              <button
                onClick={() => { cleanupScan(); setState('idle'); setIsSlow(false); }}
                type="button"
                aria-label="Cancel slow scan"
                className="ml-2 underline hover:text-yellow-300"
              >
                Cancel
              </button>
            </div>
          )}
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
