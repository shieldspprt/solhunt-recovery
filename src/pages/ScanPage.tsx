import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ScannerCard } from '@/components/scanner/ScannerCard';
import { ScanResults } from '@/components/scanner/ScanResults';
import { useWalletScanner } from '@/hooks/useWalletScanner';

export function ScanPage() {
    const { connected } = useWallet();
    const navigate = useNavigate();
    const location = useLocation();
    const {
        scanResult,
        hasResults,
        clearScan
    } = useWalletScanner();

    useEffect(() => {
        if (!connected) {
            navigate('/', { replace: true });
        }
    }, [connected, navigate]);

    useEffect(() => {
        if (!hasResults || !location.hash) return;
        const id = location.hash.replace('#', '');
        const timer = setTimeout(() => {
            const target = document.getElementById(id);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 120);
        return () => clearTimeout(timer);
    }, [hasResults, location.hash]);

    if (!connected) return null;

    return (
        <PageWrapper>
            <div className="py-8 sm:py-10 px-4 sm:px-6 w-full animate-fade-in-up">
                {!hasResults || !scanResult ? (
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
}
