import { Code2, TrendingUp } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { BufferRecoveryCard } from '@/modules/buffer-recovery/components/BufferRecoveryCard';
import { ENGINE_METADATA } from '@/config/constants';

export function BufferRecoveryPage() {
    const { connected } = useWallet();
    const config = ENGINE_METADATA.find(e => e.id === 10)!; // Recover Program Buffers

    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-shield-accent/10 border border-shield-accent/20">
                                <Code2 className="h-6 w-6 text-shield-accent" />
                            </div>
                            <span className="inline-flex items-center rounded-full bg-shield-accent/10 px-2.5 py-0.5 text-xs font-bold text-shield-accent border border-shield-accent/20 letter-spacing-wider uppercase">
                                {config.status}
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-shield-text mb-3">
                            {config.name}
                        </h1>
                        <p className="text-lg text-shield-muted leading-relaxed">
                            {config.description}
                        </p>
                    </div>

                    <div className="hidden lg:block glass-card rounded-2xl p-5 border border-shield-border/40">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-shield-accent/10">
                                <TrendingUp className="h-5 w-5 text-shield-accent" />
                            </div>
                            <div>
                                <p className="text-xs text-shield-muted uppercase font-bold tracking-widest leading-none mb-1">Avg. Recovery</p>
                                <p className="text-xl font-black text-shield-accent leading-none">~{config.avgRecoverySOL} SOL</p>
                            </div>
                        </div>
                    </div>
                </div>

                {!connected ? (
                    <div className="mx-auto w-full max-w-4xl">
                        <div className="glass-card rounded-3xl p-10 sm:p-16 text-center border border-shield-border/30 relative overflow-hidden group">
                            {/* Decorative background blur */}
                            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-shield-accent/5 rounded-full blur-3xl group-hover:bg-shield-accent/10 transition-colors duration-500"></div>

                            <div className="relative z-10">
                                <p className="text-xl text-shield-muted mb-8 max-w-md mx-auto">
                                    Connect your developer wallet to scan for abandoned BPF Loader buffers.
                                </p>
                                <div className="flex justify-center">
                                    <WalletConnectButton size="lg" label="Connect Wallet" className="animate-pulse-subtle" />
                                </div>
                                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                                    <div className="p-4 rounded-2xl bg-shield-bg/50 border border-shield-border/40">
                                        <p className="text-sm font-bold text-shield-text mb-1">🛠️ BPFLoaderUpgradeable</p>
                                        <p className="text-xs text-shield-muted">Scans for standard program buffers from Anchor and Solana CLI.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-shield-bg/50 border border-shield-border/40">
                                        <p className="text-sm font-bold text-shield-text mb-1">🏦 Immediate Recovery</p>
                                        <p className="text-xs text-shield-muted">All SOL reclaimed is instantly transferred to your main wallet.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <BufferRecoveryCard />
                )}
            </div>
        </PageWrapper>
    );
}
