import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Coins, Sparkles, Ticket, Layers3, Flame, TrendingUp, Zap } from 'lucide-react';
import type { ComponentType } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ENGINE_METADATA } from '@/config/constants';
import { useAppStore } from '@/hooks/useAppStore';

// Map engine IDs to icons
const ENGINE_ICONS: Record<number, ComponentType<any>> = {
    1: Shield,
    2: Coins,
    3: Sparkles,
    4: Ticket,
    5: Layers3,
    6: Flame,
    7: Zap,
};

export function HomePage() {
    const navigate = useNavigate();
    const agentWallet = useAppStore(s => s.agentWallet);

    useEffect(() => {
        if (agentWallet) {
            navigate('/scan', { replace: true });
        }
    }, [agentWallet, navigate]);
    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16 mt-4">

                {/* Lean Hero — just the pitch, no fluff */}
                <div className="text-center mb-14">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] mb-5">
                        <span className="gradient-text">Your wallet has hidden SOL.</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-shield-muted max-w-2xl mx-auto leading-relaxed">
                        Unclaimed rent, expired stakes, dust tokens, LP fees — SolHunt finds and recovers them.
                    </p>
                </div>

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
                                    <div className="relative flex items-center justify-between mt-auto pt-4 border-t border-shield-border/30 group-hover:border-shield-border/60 transition-colors duration-300">
                                        <span className="flex items-center gap-1.5 text-xs text-shield-muted font-medium">
                                            <TrendingUp className="h-4 w-4 text-shield-accent" />
                                            Avg. recovery <span className="font-bold text-shield-accent bg-shield-accent/10 px-1.5 py-0.5 rounded-md">~{engine.avgRecoverySOL} SOL</span>
                                        </span>
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-shield-bg group-hover:bg-shield-accent group-hover:text-shield-bg border border-shield-border/50 transition-all duration-300 shadow-sm">
                                            <ArrowRight className="h-4 w-4 text-shield-muted group-hover:text-shield-bg group-hover:translate-x-0.5 transition-all duration-300" />
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
                            <Link
                                key={engine.id}
                                to={engine.route}
                                data-agent-target={`engine-card-${engine.id}`}
                                className="group relative glass-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-shield-accent/10 hover:border-shield-accent/50 hover:bg-shield-card/90 flex flex-col cursor-pointer overflow-hidden border border-shield-border/40 focus:outline-none focus:ring-2 focus:ring-shield-accent/50"
                            >
                                {cardContent}
                            </Link>
                        );
                    })}
                </div>

                {/* Trust Strip — innovative: on-chain proof, not vanity metrics */}
                <div className="glass-card rounded-3xl p-6 sm:p-8 mt-4">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 flex-shrink-0 shadow-sm">
                            <Shield className="h-5 w-5 text-shield-accent" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-shield-text">Why trust SolHunt?</h3>
                            <p className="text-sm text-shield-muted mt-1">Verify everything yourself — no trust required.</p>
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
                            <div className="font-semibold text-shield-text mb-1">🛡️ Audited code</div>
                            <p className="text-shield-muted leading-relaxed">
                                Program whitelist, integer fee math, zero data stored.{' '}
                                <Link to="/audit" className="text-shield-accent hover:underline">Read the audit →</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
}
