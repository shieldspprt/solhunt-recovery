import { useEffect, useMemo, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ScannerCard } from '@/components/scanner/ScannerCard';
import { ScanResults } from '@/components/scanner/ScanResults';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { useWalletScanner } from '@/hooks/useWalletScanner';
import { useWalletStatus } from '@/hooks/useStoreSelectors';

// Memoized to prevent unnecessary re-renders when parent state changes
export const ScanPage = memo(function ScanPage() {
    const { connected } = useWallet();
    const { agentWallet } = useWalletStatus();
    const location = useLocation();
    const {
        scanResult,
        hasResults,
        clearScan
    } = useWalletScanner();

    // Memoize the hash value to prevent unnecessary effect re-runs
    // Extract just the hash to avoid triggering effect when other location properties change
    const hash = useMemo(() => location.hash?.replace('#', '') || '', [location.hash]);

    useEffect(() => {
        if (!hasResults || !hash) return;
        
        const timer = setTimeout(() => {
            const target = document.getElementById(hash);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 120);
        
        return () => clearTimeout(timer);
    }, [hasResults, hash]);

    return (
        <PageWrapper>
            <div className="py-8 sm:py-10 px-4 sm:px-6 w-full animate-fade-in-up">
                {!connected && !agentWallet ? (
                    <div className="mx-auto w-full max-w-4xl">
                        <div className="glass-card rounded-2xl p-8 text-center">
                            <p className="text-shield-muted mb-4">
                                Connect your wallet to scan for revocations, reclaimable rent, and dust.
                            </p>
                            <div className="flex justify-center">
                                <WalletConnectButton size="lg" label="Connect Wallet" />
                            </div>
                        </div>
                    </div>
                ) : !hasResults || !scanResult ? (
                    <ScannerCard />
                ) : (
                    <div className="w-full">
                        <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center">
                            <h1 className="text-2xl font-bold text-shield-text">Scan Results</h1>
                        </div>
                        <ScanResults
                            result={scanResult}
                            onScanAgain={clearScan}
                        />
                    </div>
                )}
            </div>
        </PageWrapper>
    );
});