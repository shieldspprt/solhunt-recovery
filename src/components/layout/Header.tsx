import { useWallet } from '@solana/wallet-adapter-react';
import { Link, useLocation } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { shortenAddress } from '@/lib/formatting';
import { useReliableDisconnect } from '@/components/wallet/WalletStatusManager';

const NAV_LINKS = [
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Learn', path: '/learn' },
];

const EXTERNAL_LINKS = [
    { label: 'Docs', url: 'https://github.com/shieldspprt/solhunt-recovery#readme' },
];

export function Header() {
    const { publicKey } = useWallet();
    const { disconnect, isDisconnecting } = useReliableDisconnect();
    const location = useLocation();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-shield-border/60 bg-shield-bg/80 backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-shield-accent/10 border border-shield-accent/20 group-hover:bg-shield-accent/20 transition-colors">
                        <Zap className="h-3.5 w-3.5 text-shield-accent" />
                    </div>
                    <span className="text-lg font-extrabold tracking-tight">
                        <span className="text-shield-text">Sol</span>
                        <span className="text-shield-accent">Hunt</span>
                    </span>
                </Link>

                {/* Center nav */}
                <nav className="hidden md:flex items-center gap-1">
                    {NAV_LINKS.map((link) => {
                        const isActive = location.pathname === link.path;
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors ${isActive
                                    ? 'text-shield-accent bg-shield-accent/10'
                                    : 'text-shield-muted hover:text-shield-text hover:bg-shield-card'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                    {EXTERNAL_LINKS.map((link) => (
                        <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors text-shield-muted hover:text-shield-text hover:bg-shield-card"
                        >
                            {link.label} ↗
                        </a>
                    ))}
                </nav>

                {/* Right side */}
                <div className="flex items-center gap-2">
                    {publicKey ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-shield-muted bg-shield-card px-2 py-1 rounded-md border border-shield-border">
                                {shortenAddress(publicKey.toBase58(), 4)}
                            </span>
                            <button
                                onClick={disconnect}
                                disabled={isDisconnecting}
                                className="text-xs text-shield-muted hover:text-shield-danger transition-colors px-2 py-1 rounded-md hover:bg-shield-danger/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Disconnect wallet"
                            >
                                {isDisconnecting ? '...' : '✕'}
                            </button>
                        </div>
                    ) : (
                        <WalletConnectButton size="sm" />
                    )}
                </div>
            </div>
        </header>
    );
}
