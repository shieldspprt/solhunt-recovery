import { PageWrapper } from '@/components/layout/PageWrapper';
import { ShieldCheck, CheckCircle2, Lock, ArrowRight, Zap, Eye, Code2, Globe, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuditFinding {
    title: string;
    badge: string;
    icon: typeof Lock;
    items: string[];
}

const FINDINGS: AuditFinding[] = [
    {
        title: 'Private Key Handling',
        badge: 'Non-custodial',
        icon: Lock,
        items: [
            'Never requests private keys, mnemonics, or seed phrases.',
            'All signatures delegated to your browser wallet (Phantom, Solflare).',
            'Static analysis: zero references to private key variables.',
        ],
    },
    {
        title: 'Transaction Security',
        badge: 'Verified',
        icon: ShieldCheck,
        items: [
            'Program ID whitelist — every instruction checked before signing.',
            'Integer-only fee arithmetic — no floating-point rounding errors.',
            'Fee charged once per session, never per-transaction.',
        ],
    },
    {
        title: 'Data & Privacy',
        badge: 'Zero storage',
        icon: Eye,
        items: [
            'No backend server. Runs entirely in your browser.',
            'No cookies, no tracking pixels, no user accounts.',
            'RPC calls go directly from your browser to Solana.',
        ],
    },
    {
        title: 'Code Quality',
        badge: 'Strict',
        icon: Code2,
        items: [
            'TypeScript strict mode, zero `any` types.',
            'Production logger prevents data leakage to console.',
            'All console.* calls silenced in production builds.',
        ],
    },
    {
        title: 'Deployment',
        badge: 'Hardened',
        icon: Globe,
        items: [
            'CSP headers whitelist every API domain.',
            'Source maps disabled — no source code exposure.',
            'HSTS + Permissions-Policy enforced.',
        ],
    },
];

// The exact program IDs our transactions interact with — fully verifiable on Solscan
const PROGRAM_WHITELIST = [
    { name: 'System Program', id: '11111111111111111111111111111111' },
    { name: 'SPL Token', id: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { name: 'Token-2022', id: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' },
    { name: 'Stake Program', id: 'Stake11111111111111111111111111111111111111' },
    { name: 'Bubblegum (cNFTs)', id: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY' },
    { name: 'Orca Whirlpool', id: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc' },
];

export function AuditPage() {
    return (
        <PageWrapper>
            <div className="mx-auto max-w-3xl py-10 px-4 sm:px-6 animate-fade-in-up">

                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                            <ShieldCheck className="h-5 w-5 text-shield-accent" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-shield-text">Security Audit</h1>
                            <p className="text-xs text-shield-muted">Last reviewed: March 2026</p>
                        </div>
                    </div>
                    <p className="text-sm text-shield-muted leading-relaxed">
                        SolHunt is fully client-side, non-custodial, and open source.
                        This page documents exactly how we handle your wallet interactions so you can verify everything yourself.
                    </p>
                </div>

                {/* Verify It Yourself — The innovative part */}
                <div className="glass-card rounded-2xl p-5 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-shield-accent" />
                        <h2 className="text-sm font-bold text-shield-text">Verify it yourself</h2>
                    </div>
                    <p className="text-xs text-shield-muted mb-4 leading-relaxed">
                        These are the <strong className="text-shield-text">only</strong> Solana programs our transactions interact with.
                        Click any to verify on Solscan — we interact with nothing else.
                    </p>
                    <div className="space-y-1.5">
                        {PROGRAM_WHITELIST.map((program) => (
                            <a
                                key={program.id}
                                href={`https://solscan.io/account/${program.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-2 rounded-lg bg-shield-bg/80 border border-shield-border/50 px-3 py-2 hover:border-shield-accent/30 transition-colors group"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <CheckCircle2 className="h-3 w-3 text-shield-accent flex-shrink-0" />
                                    <span className="text-xs font-medium text-shield-text">{program.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono text-shield-muted truncate max-w-[120px] sm:max-w-[200px]">{program.id}</span>
                                    <ExternalLink className="h-2.5 w-2.5 text-shield-border group-hover:text-shield-accent flex-shrink-0" />
                                </div>
                            </a>
                        ))}
                    </div>
                </div>

                {/* How Your Wallet Stays Safe */}
                <div className="glass-card rounded-2xl p-5 mb-6">
                    <h2 className="text-sm font-bold text-shield-text mb-4 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-shield-accent" />
                        How your wallet stays safe
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-shield-bg/80 border border-shield-border/50 p-4">
                            <div className="text-xl font-extrabold text-shield-accent mb-1">1</div>
                            <div className="text-xs font-semibold text-shield-text mb-1">You connect</div>
                            <div className="text-[11px] text-shield-muted leading-relaxed">Read-only access. We scan your token accounts via RPC.</div>
                        </div>
                        <div className="rounded-xl bg-shield-bg/80 border border-shield-border/50 p-4">
                            <div className="text-xl font-extrabold text-shield-accent mb-1">2</div>
                            <div className="text-xs font-semibold text-shield-text mb-1">We build the tx</div>
                            <div className="text-[11px] text-shield-muted leading-relaxed">Transaction built locally in your browser. Only whitelisted programs.</div>
                        </div>
                        <div className="rounded-xl bg-shield-bg/80 border border-shield-border/50 p-4">
                            <div className="text-xl font-extrabold text-shield-accent mb-1">3</div>
                            <div className="text-xs font-semibold text-shield-text mb-1">You approve</div>
                            <div className="text-[11px] text-shield-muted leading-relaxed">Your wallet extension shows every instruction. You sign or reject.</div>
                        </div>
                    </div>
                </div>

                {/* Detailed Findings */}
                <h2 className="text-sm font-bold text-shield-text mb-3 px-1">Audit Findings</h2>
                <div className="space-y-2 mb-8">
                    {FINDINGS.map((finding) => {
                        const Icon = finding.icon;
                        return (
                            <details key={finding.title} className="glass-card rounded-xl group">
                                <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-shield-accent/10 flex-shrink-0">
                                        <Icon className="h-4 w-4 text-shield-accent" />
                                    </div>
                                    <span className="text-sm font-semibold text-shield-text flex-1">{finding.title}</span>
                                    <span className="text-[10px] font-bold text-shield-accent bg-shield-accent/10 px-2 py-0.5 rounded-md">
                                        {finding.badge}
                                    </span>
                                    <span className="text-shield-muted text-xs group-open:rotate-90 transition-transform">▶</span>
                                </summary>
                                <div className="px-4 pb-4 pt-0">
                                    <ul className="space-y-1.5 text-xs text-shield-muted leading-relaxed ml-11">
                                        {finding.items.map((item, i) => (
                                            <li key={i} className="flex items-start gap-1.5">
                                                <span className="text-shield-accent mt-0.5">•</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </details>
                        );
                    })}
                </div>

                {/* CTA */}
                <div className="text-center pt-2">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 rounded-xl bg-shield-accent hover:bg-shield-accent/90 text-shield-bg font-bold px-6 py-3 text-sm transition-all hover:scale-[1.02]"
                    >
                        Start Recovering SOL
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

            </div>
        </PageWrapper>
    );
}
