import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';

export function PrivacyPage() {
    useEffect(() => {
        document.title = 'Privacy Policy | SolHunt';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'SolHunt is a client-side, non-custodial wallet recovery tool. We never access your private keys, hold your assets, or store your wallet data on any server.');
    }, []);

    return (
        <PageWrapper>
            <div className="mx-auto max-w-3xl px-4 py-12 animate-fade-in-up">
                {/* Header */}
                <div className="mb-10">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm text-shield-muted hover:text-shield-accent transition-colors mb-6"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to SolHunt
                    </Link>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shield-accent/10 border border-shield-accent/20">
                            <Shield className="h-5 w-5 text-shield-accent" />
                        </div>
                        <h1 className="text-3xl font-bold text-shield-text">Privacy Policy</h1>
                    </div>
                    <p className="text-shield-muted text-sm">
                        Last updated: March 27, 2025
                    </p>
                </div>

                {/* Content */}
                <div className="space-y-8 text-shield-muted leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">1. Introduction</h2>
                        <p>
                            SolHunt ("we," "us," or "our") operates the website at{' '}
                            <a href="https://solhunt.dev" className="text-shield-accent hover:underline" rel="noopener noreferrer">solhunt.dev</a>{' '}
                            and its associated applications (the "Service"). This Privacy Policy explains how we collect, use, and protect information when you use our Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">2. Information We Collect</h2>
                        <h3 className="text-lg font-medium text-shield-text mb-2">2.1 Blockchain Data (Public)</h3>
                        <p className="mb-3">
                            When you connect your Solana wallet, we read <strong>publicly available on-chain data</strong> associated with your wallet address. This includes token accounts, delegations, liquidity positions, staking tickets, and account balances. This data is already public on the Solana blockchain and is not considered personal information.
                        </p>

                        <h3 className="text-lg font-medium text-shield-text mb-2">2.2 Wallet Address</h3>
                        <p className="mb-3">
                            Your wallet public address is used solely to query on-chain data and construct recovery transactions. We do <strong>not</strong> store your wallet address on any server or database beyond your current browser session.
                        </p>

                        <h3 className="text-lg font-medium text-shield-text mb-2">2.3 Analytics (Aggregated)</h3>
                        <p className="mb-3">
                            We use Firebase Analytics to collect aggregated, anonymized usage data such as page views, feature usage frequency, and general performance metrics. This data does not contain wallet addresses, transaction details, or personal identifiers.
                        </p>

                        <h3 className="text-lg font-medium text-shield-text mb-2">2.4 What We Do NOT Collect</h3>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Private keys or seed phrases</li>
                            <li>Passwords or authentication credentials</li>
                            <li>Personal identification information (name, email, phone)</li>
                            <li>Financial data beyond publicly available blockchain state</li>
                            <li>IP addresses for tracking purposes</li>
                            <li>Cookies for advertising or cross-site tracking</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">3. How We Use Information</h2>
                        <ul className="list-disc list-inside space-y-1">
                            <li>To scan your wallet and identify recoverable value</li>
                            <li>To construct recovery transactions in your browser</li>
                            <li>To improve the Service through aggregated analytics</li>
                            <li>To monitor and maintain Service stability</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">4. Client-Side Architecture</h2>
                        <p>
                            SolHunt is designed as a <strong>client-side application</strong>. All transaction construction happens entirely in your browser. We do not operate any backend service that holds private keys, signs transactions on your behalf, or has custody over your assets. When you sign a transaction, you are signing instructions that were built locally in your browser and sent directly to the Solana blockchain via your connected wallet.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">5. Data Sharing</h2>
                        <p className="mb-3">
                            We do <strong>not</strong> sell, rent, or trade any user data. We may share anonymized, aggregated analytics data with service providers (Firebase/Google) solely for the purpose of improving the Service.
                        </p>
                        <p>
                            Blockchain transactions are inherently public. When you sign and submit a recovery transaction, the transaction details are recorded on the Solana blockchain and are publicly accessible.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">6. Third-Party Services</h2>
                        <p className="mb-3">Our Service interacts with the following third-party services:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Helius</strong> — RPC provider for Solana blockchain data</li>
                            <li><strong>Jupiter</strong> — DEX aggregator for token swap routing</li>
                            <li><strong>Firebase</strong> — Anonymized analytics</li>
                            <li><strong>Solana Wallet Adapters</strong> — Phantom, Solflare, and Solana Mobile wallets</li>
                        </ul>
                        <p className="mt-3">
                            Each third-party service has its own privacy policy. We encourage you to review them.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">7. Data Security</h2>
                        <p>
                            We implement security best practices including HTTPS encryption, Content Security Policy headers, strict transport security, and frame protection. Since we do not store personal data on our servers, the primary security responsibility lies in your wallet security. We strongly recommend using a hardware wallet for high-value operations.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">8. Your Rights</h2>
                        <p>
                            Since we do not collect or store personal data, there is generally no personal data to access, modify, or delete. You can disconnect your wallet at any time to end all data interaction with the Service. If you have questions about your data, please contact us.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">9. Children's Privacy</h2>
                        <p>
                            The Service is not intended for individuals under the age of 18. We do not knowingly collect information from children.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">10. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Last updated" date at the top of this page. Your continued use of the Service after changes constitutes acceptance of the updated policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">11. Contact</h2>
                        <p>
                            For any questions or concerns about this Privacy Policy, please contact us at{' '}
                            <a href="https://x.com/solhuntdev" className="text-shield-accent hover:underline" target="_blank" rel="noopener noreferrer">@solhuntdev</a>{' '}
                            on X (Twitter) or visit{' '}
                            <a href="https://solhunt.dev" className="text-shield-accent hover:underline" rel="noopener noreferrer">solhunt.dev</a>.
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="mt-12 pt-8 border-t border-shield-border">
                    <p className="text-sm text-shield-muted">
                        © 2025 SolHunt. All rights reserved.
                    </p>
                </div>
            </div>
        </PageWrapper>
    );
}
