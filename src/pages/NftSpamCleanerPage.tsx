import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, TrendingUp } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { CNFTCleanerCard } from '@/modules/cnft-cleaner';
import { ENGINE_METADATA } from '@/config/constants';

const ENGINE = ENGINE_METADATA[5]; // Clean NFTs

export function NftSpamCleanerPage() {
    const { connected } = useWallet();

    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                            <Flame className="h-5 w-5 text-shield-accent" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-shield-text">{ENGINE.name}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <TrendingUp className="h-3 w-3 text-shield-accent" />
                                <span className="text-xs text-shield-muted">
                                    Avg. user recovers <span className="text-shield-accent font-semibold">~{ENGINE.avgRecoverySOL} SOL</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1 rounded-lg border border-shield-border px-3 py-2 text-xs text-shield-muted hover:text-shield-text hover:bg-shield-card transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Home
                    </Link>
                </div>

                {!connected ? (
                    <div className="glass-card rounded-2xl p-8 text-center">
                        <p className="text-shield-muted mb-4">
                            Connect your wallet to scan and clean spam NFTs.
                        </p>
                        <div className="flex justify-center">
                            <WalletConnectButton size="lg" label="Connect Wallet" />
                        </div>
                    </div>
                ) : (
                    <CNFTCleanerCard />
                )}
            </div>
        </PageWrapper>
    );
}
