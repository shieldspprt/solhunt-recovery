import { useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
    SolanaMobileWalletAdapter,
    createDefaultAddressSelector,
    createDefaultAuthorizationResultCache,
    createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { Toaster } from 'react-hot-toast';

import { primaryConnection } from '@/config/solana';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { HomePage } from '@/pages/HomePage';
import { ScanPage } from '@/pages/ScanPage';
import { TicketFinderPage } from '@/pages/TicketFinderPage';
import { LpFeeHarvesterPage } from '@/pages/LpFeeHarvesterPage';
import { BufferRecoveryPage } from '@/pages/BufferRecoveryPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { HowItWorksPage } from '@/pages/HowItWorksPage';
import { EngineHowItWorksPage } from '@/pages/EngineHowItWorksPage';
import { LearnPage } from '@/pages/LearnPage';
import { DecommissionPage } from '@/modules/decommission/components/DecommissionPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { TermsPage } from '@/pages/TermsPage';
import { LicensePage } from '@/pages/LicensePage';
import { CopyrightPage } from '@/pages/CopyrightPage';
import { useAppStore } from '@/hooks/useAppStore';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * Headless Agent Parser
 * Intercepts ?wallet=XYZ and saves it to global store, enabling AI models
 * to perform read-only scans without connecting an extension via Phantom.
 */
function AgentUrlParser() {
    const [searchParams] = useSearchParams();
    const setAgentWallet = useAppStore((s) => s.setAgentWallet);

    useEffect(() => {
        const walletParam = searchParams.get('wallet');
        if (walletParam) {
            setAgentWallet(walletParam);
        }
    }, [searchParams, setAgentWallet]);

    return null;
}

function App() {
    // We use the Helius connection URL configured in solana.ts
    const endpoint = primaryConnection.rpcEndpoint;

    // Configure supported wallets (desktop + Solana Mobile)
    const wallets = useMemo(
        () => {
            const adapters = [
                new SolanaMobileWalletAdapter({
                    addressSelector: createDefaultAddressSelector(),
                    appIdentity: {
                        name: 'SolHunt',
                        uri: 'https://solhunt.dev',
                        icon: '/icons/icon-192.png',
                    },
                    authorizationResultCache: createDefaultAuthorizationResultCache(),
                    cluster: 'mainnet-beta',
                    onWalletNotFound: createDefaultWalletNotFoundHandler(),
                }),
                new PhantomWalletAdapter(),
                new SolflareWalletAdapter(),
            ];

            // Deduplicate wallets by name to avoid "Encountered two children with the same key" errors
            // specifically for MetaMask/Injected conflicts
            const uniqueWallets = new Map();
            adapters.forEach(wallet => {
                if (!uniqueWallets.has(wallet.name)) {
                    uniqueWallets.set(wallet.name, wallet);
                }
            });
            return Array.from(uniqueWallets.values());
        },
        []
    );

    return (
        <ErrorBoundary>
            <ConnectionProvider endpoint={endpoint}>
                <WalletProvider wallets={wallets} autoConnect>
                    <WalletModalProvider>
                        <BrowserRouter>
                            <AgentUrlParser />
                            <Routes>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/scan" element={<ScanPage />} />
                                <Route path="/tickets" element={<TicketFinderPage />} />
                                <Route path="/lp-fees" element={<LpFeeHarvesterPage />} />
                                <Route path="/buffers" element={<BufferRecoveryPage />} />
                                <Route path="/how-it-works" element={<HowItWorksPage />} />
                                <Route path="/how-it-works/engine/:id" element={<EngineHowItWorksPage />} />
                                <Route path="/learn" element={<LearnPage />} />
                                <Route path="/learn/:id" element={<LearnPage />} />
                                <Route path="/decommission" element={<DecommissionPage />} />
                                <Route path="/privacy" element={<PrivacyPage />} />
                                <Route path="/terms" element={<TermsPage />} />
                                <Route path="/license" element={<LicensePage />} />
                                <Route path="/copyright" element={<CopyrightPage />} />
                                <Route path="/404" element={<NotFoundPage />} />
                                <Route path="*" element={<Navigate to="/404" replace />} />
                            </Routes>
                        </BrowserRouter>

                        <Toaster
                            position="bottom-center"
                            toastOptions={{
                                style: {
                                    background: '#111827',
                                    color: '#f9fafb',
                                    border: '1px solid #1f2937',
                                    borderRadius: '12px',
                                },
                                success: {
                                    iconTheme: {
                                        primary: '#10b981',
                                        secondary: '#111827',
                                    },
                                },
                            }}
                        />
                    </WalletModalProvider>
                </WalletProvider>
            </ConnectionProvider>
        </ErrorBoundary>
    );
}

export default App;
