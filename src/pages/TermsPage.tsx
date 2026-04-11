import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';

export function TermsPage() {
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
                            <FileText className="h-5 w-5 text-shield-accent" />
                        </div>
                        <h1 className="text-3xl font-bold text-shield-text">Terms of Service</h1>
                    </div>
                    <p className="text-shield-muted text-sm">
                        Last updated: March 27, 2025
                    </p>
                </div>

                {/* Content */}
                <div className="space-y-8 text-shield-muted leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using SolHunt ("the Service"), available at{' '}
                            <a href="https://solhunt.dev" className="text-shield-accent hover:underline">solhunt.dev</a>{' '}
                            and its associated mobile applications, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">2. Description of Service</h2>
                        <p>
                            SolHunt is a <strong>non-custodial</strong>, client-side Solana wallet recovery tool. The Service scans connected Solana wallets for recoverable value (rent, delegations, unclaimed fees, staking tickets, etc.) and constructs recovery transactions that are executed entirely in the user's browser. SolHunt does not hold, manage, or have access to your private keys or assets.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">3. License Grant</h2>
                        <p>
                            Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal, non-commercial use. The underlying source code is available under the MIT License as described in the project repository.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">4. User Responsibilities</h2>
                        <p className="mb-3">By using the Service, you represent and warrant that:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>You are at least 18 years of age</li>
                            <li>You have the legal authority to accept these Terms</li>
                            <li>You are the authorized owner of the connected wallet</li>
                            <li>You understand the inherent risks of blockchain transactions</li>
                            <li>You are solely responsible for reviewing and approving all transactions before signing</li>
                            <li>You will not use the Service for any illegal, fraudulent, or unauthorized purpose</li>
                            <li>You comply with all applicable laws and regulations in your jurisdiction</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">5. Transaction Disclaimer</h2>
                        <p className="mb-3">
                            <strong>All transactions are constructed client-side and signed by you.</strong> SolHunt:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Does <strong>not</strong> have access to your private keys or seed phrases</li>
                            <li>Does <strong>not</strong> sign, submit, or execute transactions on your behalf</li>
                            <li>Does <strong>not</strong> request persistent delegation or transfer authority over your assets</li>
                            <li>Does <strong>not</strong> guarantee the success, outcome, or profitability of any transaction</li>
                            <li>Does <strong>not</strong> guarantee the accuracy of displayed values, which are based on real-time on-chain data that may change</li>
                        </ul>
                        <p className="mt-3">
                            You are solely responsible for reviewing every transaction instruction before signing. Once a transaction is signed and submitted to the Solana blockchain, it is <strong>irreversible</strong>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">6. Fees</h2>
                        <p>
                            SolHunt may charge a service fee on certain recovery transactions. Any applicable fees are clearly displayed before you sign a transaction. Solana network transaction fees (gas) are paid directly from your wallet and are determined by the Solana network, not by SolHunt.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">7. Intellectual Property</h2>
                        <p>
                            The SolHunt name, logo, brand identity, and proprietary service design are owned by SolHunt. The underlying application code is open source under the MIT License. You may not use the SolHunt brand, name, or logo to represent or endorse any product or service without our express written consent.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">8. Prohibited Activities</h2>
                        <p className="mb-3">You agree not to:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Use the Service to conduct fraudulent, deceptive, or illegal activities</li>
                            <li>Attempt to exploit, reverse-engineer, or compromise the Service's infrastructure</li>
                            <li>Use automated systems (bots, scrapers) against the Service without authorization</li>
                            <li>Impersonate other users or misrepresent your identity</li>
                            <li>Use the Service while subject to sanctions or trade restrictions</li>
                            <li>Interfere with the Service's normal operation or other users' access</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">9. Limitation of Liability</h2>
                        <p className="mb-3">
                            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SOLHUNT AND ITS DEVELOPERS, CONTRIBUTORS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Loss of funds, tokens, or digital assets</li>
                            <li>Loss of profits, data, or business opportunities</li>
                            <li>Damages resulting from blockchain network issues, RPC downtime, or wallet software bugs</li>
                            <li>Damages resulting from unauthorized access to your wallet</li>
                            <li>Damages resulting from lost, compromised, or forgotten private keys</li>
                        </ul>
                        <p className="mt-3">
                            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">10. Indemnification</h2>
                        <p>
                            You agree to indemnify and hold harmless SolHunt and its team from any claims, damages, losses, or expenses (including reasonable attorney's fees) arising from your use of the Service, your violation of these Terms, or your violation of any applicable law or regulation.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">11. Service Availability</h2>
                        <p>
                            We strive to keep the Service available at all times but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, network issues, or circumstances beyond our control. We reserve the right to modify, suspend, or discontinue the Service at any time without prior notice.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">12. Modifications to Terms</h2>
                        <p>
                            We reserve the right to modify these Terms at any time. Material changes will be reflected by updating the "Last updated" date. Your continued use of the Service after any changes constitutes acceptance of the updated Terms. If you do not agree with the modified Terms, you must stop using the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">13. Governing Law</h2>
                        <p>
                            These Terms shall be governed by and construed in accordance with applicable law, without regard to conflict of law principles. Any disputes arising from these Terms or the Service shall be resolved through good-faith negotiation. If negotiation fails, disputes shall be subject to binding arbitration.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">14. Severability</h2>
                        <p>
                            If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">15. Contact</h2>
                        <p>
                            For questions about these Terms, please contact us at{' '}
                            <a href="https://x.com/solhuntdev" className="text-shield-accent hover:underline" target="_blank" rel="noopener noreferrer">@solhuntdev</a>{' '}
                            on X (Twitter) or visit{' '}
                            <a href="https://solhunt.dev" className="text-shield-accent hover:underline">solhunt.dev</a>.
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
