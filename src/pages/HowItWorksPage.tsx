import { Shield, Lock, FileCode, Search, HelpCircle, Code2, Cpu, FileJson } from 'lucide-react';
import { memo, useEffect } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';

// Memoized to prevent unnecessary re-renders when parent state changes
// This is a static content page with no props
export const HowItWorksPage = memo(function HowItWorksPage() {
    useEffect(() => {
        document.title = 'How It Works | SolHunt';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'A transparent technical breakdown of Solana rent, client-side transaction building, and SolHunt\'s non-custodial security model for recovering locked SOL.');
    }, []);

    return (
        <PageWrapper>
            <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
                <div className="text-center mb-12 sm:mb-16">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                        <span className="gradient-text">How SolHunt Works</span>
                    </h1>
                    <p className="text-lg text-shield-muted max-w-2xl mx-auto">
                        A transparent technical breakdown of Solana rent, client-side transaction building, and our security model.
                    </p>
                </div>

                {/* Section 1: The Problem (Rent) */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                            <Cpu className="h-5 w-5 text-shield-accent" />
                        </div>
                        <h2 className="text-2xl font-bold text-shield-text">Solana State & Account Rent</h2>
                    </div>
                    <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-4 text-shield-muted leading-relaxed">
                        <p>
                            On Solana, keeping data ("state") alive on the blockchain requires validators to allocate hardware memory space. To prevent spam, Solana enforces a <strong>rent-exemption fee</strong>. Whenever an account is created—such as a token account for a new meme coin, a stake account, or an intermediate swap account—a small amount of SOL (typically ~0.002 SOL) is deposited into it to make it "rent-exempt."
                        </p>
                        <p>
                            If you buy and sell 50 different tokens over a year, you leave behind 50 empty token accounts. Those 50 accounts hold approximately 0.1 SOL in locked rent. Since the token balance is 0, the accounts serve no purpose, but your SOL remains locked inside them indefinitely.
                        </p>
                    </div>
                </section>

                {/* Section 2: The Solution (CloseAccount) */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-success/10 border border-shield-success/20">
                            <Code2 className="h-5 w-5 text-shield-success" />
                        </div>
                        <h2 className="text-2xl font-bold text-shield-text">The closeAccount Instruction</h2>
                    </div>
                    <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-4 text-shield-muted leading-relaxed">
                        <p>
                            To retrieve this locked SOL, Solana provides a native instruction within the SPL Token Program called <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">closeAccount</code>.
                        </p>
                        <p>
                            When <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">closeAccount</code> is executed on an empty token account you own, two things happen:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-2 text-shield-text">
                            <li>The account is permanently deleted from the blockchain's state array.</li>
                            <li>The locked rent SOL is deposited back into the designated destination address (your main wallet).</li>
                        </ul>
                        <p className="mt-4">
                            <strong>SolHunt automates this via client-side RPC queries.</strong> We scan your wallet's token accounts using the <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">getTokenAccountsByOwner</code> RPC method, filter out any accounts with a balance greater than 0, and construct a transaction containing an array of <code className="bg-shield-bg px-1.5 py-0.5 rounded border border-shield-border/50 text-shield-text font-mono text-xs">closeAccount</code> instructions to recover the SOL.
                        </p>
                    </div>
                </section>


                {/* Section 3: Security & Trust */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-warning/10 border border-shield-warning/20">
                            <Shield className="h-5 w-5 text-shield-warning" />
                        </div>
                        <h2 className="text-2xl font-bold text-shield-text">Security Architecture</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="glass-card rounded-2xl p-6">
                            <Lock className="h-6 w-6 text-shield-warning mb-3" />
                            <h3 className="text-lg font-bold text-shield-text mb-2">100% Non-Custodial</h3>
                            <p className="text-sm text-shield-muted leading-relaxed">
                                We do not use a backend database or relayer. Your wallet is strictly connected to the Vite/React frontend using the official <code className="text-xs font-mono">@solana/wallet-adapter</code>. We never see your private key or write-transfer permissions.
                            </p>
                        </div>
                        <div className="glass-card rounded-2xl p-6">
                            <FileCode className="h-6 w-6 text-shield-warning mb-3" />
                            <h3 className="text-lg font-bold text-shield-text mb-2">Client-Side Assembly</h3>
                            <p className="text-sm text-shield-muted leading-relaxed">
                                Every Transaction and VersionedTransaction is natively constructed in your browser using <code className="text-xs font-mono">@solana/web3.js</code>. The raw buffers are serialized and passed directly to your wallet extension (Phantom/Solflare) for you to review and sign.
                            </p>
                        </div>
                        <div className="glass-card rounded-2xl p-6">
                            <Search className="h-6 w-6 text-shield-warning mb-3" />
                            <h3 className="text-lg font-bold text-shield-text mb-2">Immutable Modals</h3>
                            <p className="text-sm text-shield-muted leading-relaxed">
                                We've implemented explicit instruction preview banners on all signing modals. Before the transaction payload hits your extension, you will see exactly how many instructions you are signing and what type they are.
                            </p>
                        </div>
                        <div className="glass-card rounded-2xl p-6">
                            <FileJson className="h-6 w-6 text-shield-warning mb-3" />
                            <h3 className="text-lg font-bold text-shield-text mb-2">Simulated Testing</h3>
                            <p className="text-sm text-shield-muted leading-relaxed">
                                Before passing to the wallet, we optionally simulate the transaction against the RPC node using <code className="text-xs font-mono">simulateTransaction</code> to ensure mathematical accuracy and calculate required micro-lamport fee tiers.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 4: Contact / Help */}
                <section className="mb-4">
                    <div className="rounded-3xl border border-shield-accent/30 bg-gradient-to-br from-shield-accent/10 to-transparent p-8 sm:p-10 text-center">
                        <HelpCircle className="h-10 w-10 text-shield-accent mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-shield-text mb-3">Questions? Let's chat.</h2>
                        <p className="text-shield-text/80 max-w-xl mx-auto mb-6">
                            We are builders in the Solana ecosystem and are hyper-focused on tooling transparency. Whether you are a user looking for help or a dev reviewing our architecture, our DMs are open.
                        </p>
                        <a
                            href="https://twitter.com/solhuntdev"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Contact SolHunt on Twitter"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1DA1F2] px-6 py-3 font-semibold text-white shadow-lg shadow-[#1DA1F2]/20 hover:bg-[#1A91DA] transition-all hover:-translate-y-0.5"
                        >
                            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                            </svg>
                            Message @solhuntdev
                        </a>
                    </div>
                </section>
            </div>
        </PageWrapper>
    );
});