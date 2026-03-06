import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Coins, Sparkles, Ticket, Layers3, Flame, TrendingUp } from 'lucide-react';
import type { ComponentType } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ENGINE_METADATA } from '@/config/constants';

const ENGINE_ICONS: Record<number, ComponentType<{ className?: string }>> = {
    1: Shield,
    2: Coins,
    3: Sparkles,
    4: Ticket,
    5: Layers3,
    6: Flame,
};

export function HomePage() {
    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">

                {/* Lean Hero — just the pitch, no fluff */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-3">
                        <span className="gradient-text">Your wallet has hidden SOL.</span>
                    </h1>
                    <p className="text-base sm:text-lg text-shield-muted max-w-xl mx-auto leading-relaxed">
                        Unclaimed rent, expired stakes, dust tokens, LP fees — SolHunt finds and recovers them.
                    </p>
                </div>

                {/* Engine Cards — the product IS the trust */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-10">
                    {ENGINE_METADATA.map((engine) => {
                        const Icon = ENGINE_ICONS[engine.id] || Shield;
                        const isComingSoon = engine.status === 'coming_soon';

                        const cardContent = (
                            <>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-shield-accent/10 border border-shield-accent/20 group-hover:bg-shield-accent/15 transition-colors">
                                        <Icon className="h-4.5 w-4.5 text-shield-accent" />
                                    </div>
                                    <div className="flex items-center justify-between flex-1">
                                        <h2 className="text-base font-bold text-shield-text">
                                            {engine.name}
                                        </h2>
                                        {isComingSoon && (
                                            <span className="inline-flex items-center rounded-md bg-shield-border/30 px-2 py-1 text-[10px] font-medium text-shield-muted ring-1 ring-inset ring-shield-border/50">
                                                Coming Soon
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm text-shield-muted leading-relaxed mb-3">
                                    {engine.description}
                                </p>

                                {!isComingSoon && (
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="flex items-center gap-1 text-xs text-shield-muted">
                                            <TrendingUp className="h-3 w-3 text-shield-accent" />
                                            Avg. recovery <span className="font-semibold text-shield-accent">~{engine.avgRecoverySOL} SOL</span>
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5 text-shield-border group-hover:text-shield-accent group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                )}
                            </>
                        );

                        if (isComingSoon) {
                            return (
                                <div
                                    key={engine.id}
                                    className="group glass-card rounded-2xl p-5 border-shield-border/30 opacity-70 cursor-not-allowed flex flex-col"
                                >
                                    {cardContent}
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={engine.id}
                                to={engine.route}
                                className="group glass-card rounded-2xl p-5 transition-all duration-200 hover:glow-border hover:bg-shield-card/80 flex flex-col"
                            >
                                {cardContent}
                            </Link>
                        );
                    })}
                </div>

                {/* Trust Strip — innovative: on-chain proof, not vanity metrics */}
                <div className="glass-card rounded-2xl p-5 sm:p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-shield-accent/10 flex-shrink-0">
                            <Shield className="h-4 w-4 text-shield-accent" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-shield-text">Why trust SolHunt?</h3>
                            <p className="text-xs text-shield-muted mt-0.5">Verify everything yourself — no trust required.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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
