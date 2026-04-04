import { Search, Clock, Shield } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletScanner } from '@/hooks/useWalletScanner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { shortenAddress, copyToClipboard } from '@/lib/formatting';
import { useState, useEffect, memo } from 'react';
import toast from 'react-hot-toast';
import { Copy, Check } from 'lucide-react';
import { useWalletStatus } from '@/hooks/useStoreSelectors';

// Memoized to prevent unnecessary re-renders when parent components update
// This component only depends on internal state and global stores
export const ScannerCard = memo(function ScannerCard() {
    const { publicKey } = useWallet();
    const { agentWallet } = useWalletStatus();
    const { scan, isScanning, isOnCooldown } = useWalletScanner();
    const [copied, setCopied] = useState(false);
    const [scanStatusText, setScanStatusText] = useState('');

    // Cycle through status messages during scan
    useEffect(() => {
        if (!isScanning) {
            setScanStatusText('');
            return;
        }

        const messages = [
            'Fetching token accounts...',
            'Analyzing permissions...',
            'Calculating risk...',
        ];
        let index = 0;
        setScanStatusText(messages[0]);

        const interval = setInterval(() => {
            index = (index + 1) % messages.length;
            setScanStatusText(messages[index]);
        }, 2000);

        return () => clearInterval(interval);
    }, [isScanning]);

    const handleCopy = async () => {
        if (!publicKey) return;
        const success = await copyToClipboard(publicKey.toBase58());
        if (success) {
            setCopied(true);
            toast.success('Address copied!');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const displayWallet = publicKey?.toBase58() || agentWallet;
    if (!displayWallet) return null;

    return (
        <div
            className="w-full max-w-2xl mx-auto"
            aria-live="polite"
            aria-busy={isScanning}
        >
            <div className="rounded-2xl border border-shield-border bg-shield-card p-6 sm:p-8">
                {/* Wallet address */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10">
                            <Shield className="h-5 w-5 text-shield-accent" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-xs text-shield-muted uppercase tracking-wider">Connected Wallet</p>
                            <p className="font-mono text-sm text-shield-text">
                                {shortenAddress(displayWallet, 6)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCopy}
                        className="p-2 rounded-lg hover:bg-shield-border/50 transition-colors text-shield-muted hover:text-shield-text"
                        title="Copy address"
                        aria-label="Copy wallet address to clipboard"
                    >
                        {copied ? (
                            <Check className="h-4 w-4 text-shield-success" aria-hidden="true" />
                        ) : (
                            <Copy className="h-4 w-4" aria-hidden="true" />
                        )}
                    </button>
                </div>

                {/* Scan section */}
                {isScanning ? (
                    <div className="py-8">
                        <LoadingSpinner size="lg" message={scanStatusText} />
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-shield-muted mb-2">
                            We&apos;ll scan your token accounts for active delegations
                        </p>
                        <div className="flex items-center justify-center gap-1 text-xs text-shield-muted mb-6">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            <span>Takes 5–15 seconds</span>
                        </div>
                        <button
                            id="start-scan-button"
                            data-agent-target="start-scan-btn"
                            onClick={scan}
                            disabled={isOnCooldown()}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-shield-accent hover:bg-shield-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-4 text-lg shadow-lg shadow-shield-accent/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Search className="h-5 w-5" aria-hidden="true" />
                            Start Scan
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});

export default ScannerCard;
