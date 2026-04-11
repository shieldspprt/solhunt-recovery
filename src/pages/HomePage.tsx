import { useEffect, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Coins, Sparkles, Ticket, Layers3, TrendingUp, Zap, Code2, BookOpen, Ghost, MessageSquare } from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { WalletScanner } from '@/components/WalletScanner';
import { StatsDisplay } from '@/components/StatsDisplay';
import { ENGINE_METADATA } from '@/config/constants';
import { useWalletStatus } from '@/hooks/useStoreSelectors';
import { useLocation } from 'react-router-dom';

// Map engine IDs to icons with proper typing
const ENGINE_ICONS: Record<number, ComponentType<LucideProps>> = {
    1: Shield,
    2: Coins,
    3: Sparkles,
    4: Ticket,
    5: Layers3,
    7: Zap,
    9: Ghost,
    10: Code2,
};

// Memoized to prevent re-renders when parent state changes
export const HomePage = memo(function HomePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { agentWallet } = useWalletStatus();
    const isAdmin = new URLSearchParams(location.search).get('admin') === 'true';

    useEffect(() => {
        if (agentWallet) {
            navigate('/scan', { replace: true });
        }
    }, [agentWallet, navigate]);
    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-12 mt-2">

                {/* Technical Hero */}
                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-shield-accent/10 border border-shield-accent/20 mb-6">
                        <div className="w-2 h-2 rounded-full bg-shield-accent animate-pulse" />
                        <span className="text-xs font-mono text-shield-accent uppercase tracking-wider">System Operational</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white mb-4">
                        Max Extractable Value <br className="hidden sm:block" />
                        <span className="gradient-text font-mono tracking-tighter">From Your Solana Wallet</span>
                    </h1>
                    <p className="text-lg text-shield-muted max-w-2xl font-light">
                        Autonomous retrieval of locked rent, zero-balance token accounts, and scattered dust. Non-custodial operations executed seamlessly.
                    </p>
                </div>

                <div className="relative mb-16">
                    <div className="absolute -inset-1 bg-gradient-to-r from-shield-accent/20 to-[#9945ff]/20 rounded-3xl blur-xl opacity-50 pointer-events-none" />
                    <WalletScanner />
                </div>
                
                {isAdmin && (
                    <div className="mb-16 border border-[#9945ff]/30 rounded-2xl bg-[#9945ff]/10 p-4">
                        <h3 className="text-xs font-mono text-[#9945ff] uppercase tracking-widest pl-4 mb-2">Admin Dashboard</h3>
                        <StatsDisplay />
                    </div>
                )}

                {/* Engine Cards — the product IS the trust */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-16">
                    {ENGINE_METADATA.map((engine) => {
                        const Icon = ENGINE_ICONS[engine.id] || Shield;
                        const isComingSoon = engine.status === 'coming_soon';

                        const cardContent = (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-br from-shield-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                <div className="relative flex items-center gap-4 mb-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20 group-hover:bg-shield-accent/20 group-hover:border-shield-accent/40 shadow-sm group-hover:shadow-shield-accent/20 transition-all duration-300">
                                        <Icon className="h-6 w-6 text-shield-accent group-hover:scale-110 transition-transform duration-300" />
                                    </div>
                                    <div className="flex items-center justify-between flex-1">
                                        <h2 className="text-lg font-bold text-shield-text group-hover:text-shield-accent transition-colors duration-300">
                                            {engine.name}
                                        </h2>
                                        {isComingSoon && (
                                            <span className="inline-flex items-center rounded-md bg-shield-border/30 px-2 py-1 text-[10px] font-medium text-shield-muted ring-1 ring-inset ring-shield-border/50 shadow-sm">
                                                Coming Soon
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="relative text-sm text-shield-muted leading-relaxed mb-6 group-hover:text-shield-muted/90 transition-colors duration-300">
                                    {engine.description}
                                </p>

                                {!isComingSoon && (
                                    <div className="relative flex flex-col gap-3 mt-auto pt-4 border-t border-shield-border/30 group-hover:border-shield-border/60 transition-colors duration-300">
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-xs text-shield-muted font-medium">
                                                <TrendingUp className="h-4 w-4 text-shield-accent" />
                                                Avg. recovery <span className="font-bold text-shield-accent bg-shield-accent/10 px-1.5 py-0.5 rounded-md">~{engine.avgRecoverySOL} SOL</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Link
                                                to={engine.howItWorksRoute}
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-shield-border bg-shield-bg/50 px-3 py-2 text-xs font-semibold text-shield-text hover:bg-shield-border/50 hover:text-shield-accent transition-all duration-300"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <BookOpen className="h-3.5 w-3.5" />
                                                How it works
                                            </Link>
                                            <Link
                                                to={engine.route}
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-shield-accent/10 border border-shield-accent/20 px-3 py-2 text-xs font-semibold text-shield-accent hover:bg-shield-accent hover:text-shield-bg transition-all duration-300 group/btn"
                                            >
                                                Launch Tool
                                                <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </>
                        );

                        if (isComingSoon) {
                            return (
                                <div
                                    key={engine.id}
                                    className="group glass-card rounded-2xl p-6 border border-shield-border/30 opacity-70 cursor-not-allowed flex flex-col relative overflow-hidden"
                                >
                                    {cardContent}
                                </div>
                            );
                        }

                        return (
                            <div
                                key={engine.id}
                                data-agent-target={`engine-card-${engine.id}`}
                                className="group relative glass-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-shield-accent/10 hover:border-shield-accent/50 hover:bg-shield-card/90 flex flex-col overflow-hidden border border-shield-border/40"
                            >
                                {cardContent}
                            </div>
                        );
                    })}

                    {/* 9th Card: Contact Us */}
                    <div className="group relative rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#1DA1F2]/20 flex flex-col overflow-hidden border border-[#1DA1F2]/30 bg-gradient-to-br from-[#1DA1F2]/10 to-transparent">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1DA1F2]/20 text-[#1DA1F2] shadow-inner">
                                <MessageSquare className="h-6 w-6" />
                            </div>
                            <div className="rounded-full bg-[#1DA1F2]/10 px-3 py-1 text-xs font-semibold text-[#1DA1F2] border border-[#1DA1F2]/20">
                                Connect
                            </div>
                        </div>

                        <div className="mb-2">
                            <h3 className="text-xl font-bold text-white group-hover:text-[#1DA1F2] transition-colors">
                                Talk to SolHunt
                            </h3>
                        </div>

                        <p className="text-sm text-shield-muted leading-relaxed line-clamp-2 mb-6 flex-grow">
                            Have a query, partnership idea, or want to request a new recovery engine feature? Reach out directly.
                        </p>

                        <div className="mt-auto pt-4 border-t border-[#1DA1F2]/20 flex gap-3">
                            <a
                                href="https://twitter.com/solhuntdev"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DA1F2] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#1A91DA] hover:shadow-lg shadow-[#1DA1F2]/20"
                            >
                                Contact @solhuntdev
                            </a>
                        </div>
                    </div>
                </div>

                {/* Trust Strip — innovative: on-chain proof, not vanity metrics */}
                <div className="glass-card rounded-3xl p-6 sm:p-8 mt-4">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 flex-shrink-0 shadow-sm">
                            <Shield className="h-5 w-5 text-shield-accent" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-shield-text">Why trust SolHunt? Is this safe?</h3>
                            <p className="text-sm text-shield-muted mt-2 leading-relaxed">
                                We know tools like this get a bad reputation. Here's exactly what we do and don't do: we never request transfer authority, we never custody your assets, and every transaction is constructed client-side and visible before you sign.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
                        <div className="rounded-xl bg-shield-bg/80 border border-shield-border/50 p-3">
                            <div className="font-semibold text-shield-text mb-1">🔍 Open source</div>
                            <p className="text-shield-muted leading-relaxed">
                                Every transaction is built client-side. View the code, verify every instruction.
                            </p>
                        </div>
                        <div className="rounded-xl bg-shield-bg/80 border border-shield-border/50 p-3">
                            <div className="font-semibold text-shield-text mb-1">🔑 Non-custodial</div>
                            <p className="text-shield-muted leading-relaxed">
                                Your wallet extension signs every tx. We never see your private key.
                            </p>
                        </div>
                        <div className="rounded-xl bg-shield-bg/80 border border-shield-border/50 p-3">
                            <div className="font-semibold text-shield-text mb-1">🤝 Community built</div>
                            <p className="text-shield-muted leading-relaxed">
                                Built for the Solana community, by the community. No hidden agendas, just pure utility.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
});