import { useMemo, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
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
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAppStore } from '@/hooks/useAppStore';
import { WalletStatusManager } from '@/components/wallet/WalletStatusManager';
import { isValidSolanaAddress } from '@/lib/validation';

// Lazy-loaded pages for code splitting — reduces initial bundle size
// Named exports are wrapped to provide default export for React.lazy
const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })));
const ScanPage = lazy(() => import('@/pages/ScanPage').then(m => ({ default: m.ScanPage })));
const TicketFinderPage = lazy(() => import('@/pages/TicketFinderPage').then(m => ({ default: m.TicketFinderPage })));
const LpFeeHarvesterPage = lazy(() => import('@/pages/LpFeeHarvesterPage').then(m => ({ default: m.LpFeeHarvesterPage })));
const BufferRecoveryPage = lazy(() => import('@/pages/BufferRecoveryPage').then(m => ({ default: m.BufferRecoveryPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const HowItWorksPage = lazy(() => import('@/pages/HowItWorksPage').then(m => ({ default: m.HowItWorksPage })));
const EngineHowItWorksPage = lazy(() => import('@/pages/EngineHowItWorksPage').then(m => ({ default: m.EngineHowItWorksPage })));
const LearnPage = lazy(() => import('@/pages/LearnPage').then(m => ({ default: m.LearnPage })));
const DecommissionPage = lazy(() => import('@/modules/decommission/components/DecommissionPage').then(m => ({ default: m.DecommissionPage })));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('@/pages/TermsPage').then(m => ({ default: m.TermsPage })));
const LicensePage = lazy(() => import('@/pages/LicensePage').then(m => ({ default: m.LicensePage })));
const CopyrightPage = lazy(() => import('@/pages/CopyrightPage').then(m => ({ default: m.CopyrightPage })));

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * TWA / PWA Shortcut Router
 * Routes home-screen shortcuts (https://solhunt.dev/?engine=...) to the
 * correct page. Without this, tapping a shortcut silently drops the engine
 * parameter and lands on the home page — defeating the purpose of the
 * shortcut.
 *
 * PWA manifest declares 6 shortcuts in public/manifest.webmanifest:
 *   - scan       → /scan       (full wallet analysis)
 *   - revoke     → /scan       (revoke flows live inside the scanner)
 *   - reclaim    → /buffers    (rent reclaim is part of buffer recovery)
 *   - lp-fees    → /lp-fees    (LP Fee Harvester engine)
 *   - buffers    → /buffers    (Buffer Account Recovery engine)
 *   - tickets    → /tickets    (Staking Ticket Finder engine)
 *
 * Android app shortcuts (app/src/main/res/xml/shortcuts.xml) declare 4:
 *   - scan, revoke, reclaim, fleet.
 *   - fleet is MCP/web-only → routed to /scan as a graceful fallback.
 *
 * @see public/manifest.webmanifest — keep this list in sync when adding
 *      a new shortcut to either surface.
 * @see app/src/main/res/xml/shortcuts.xml
 */
function TwaShortcutRouter() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const engine = searchParams.get('engine');
        if (!engine) return;

        // Whitelist: only known shortcut IDs route. Unknown values are
        // intentionally ignored so a malformed shortcut never breaks the
        // home page or exposes internal routes.
        switch (engine) {
            case 'scan':
                navigate('/scan', { replace: true });
                break;
            case 'revoke':
                // Revoke flows are surfaced inside the scanner page.
                navigate('/scan', { replace: true });
                break;
            case 'reclaim':
                // Rent reclaim lives inside buffer recovery.
                navigate('/buffers', { replace: true });
                break;
            case 'lp-fees':
                navigate('/lp-fees', { replace: true });
                break;
            case 'buffers':
                navigate('/buffers', { replace: true });
                break;
            case 'tickets':
                navigate('/tickets', { replace: true });
                break;
            case 'fleet':
                // Fleet Manager is currently an MCP/web-only tool — route to
                // the scan page so the user can still monitor a single wallet.
                navigate('/scan', { replace: true });
                break;
            default:
                // Unknown engine — leave on the home page.
                break;
        }
    }, [searchParams, navigate]);

    return null;
}

/**
 * Headless Agent Parser
 * Intercepts ?wallet=XYZ and saves it to global store, enabling AI models
 * to perform read-only scans without connecting an extension via Phantom.
 * 
 * SECURITY: Validates wallet address format before setting to prevent
 * injection attacks via URL parameters.
 */
function AgentUrlParser() {
    const [searchParams] = useSearchParams();
    const setAgentWallet = useAppStore((s) => s.setAgentWallet);

    useEffect(() => {
        const walletParam = searchParams.get('wallet');
        if (walletParam && isValidSolanaAddress(walletParam)) {
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
                        <WalletStatusManager />
                        <BrowserRouter>
                            <TwaShortcutRouter />
                            <AgentUrlParser />
                            <Suspense fallback={<LoadingSpinner fullpage message="Loading..." />}>
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
                            </Suspense>
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
