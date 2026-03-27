import { Link } from 'react-router-dom';
import { ArrowLeft, Copyright } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';

export function CopyrightPage() {
    return (
        <PageWrapper>
            <div className="mx-auto max-w-3xl px-4 py-12 animate-fade-in-up">
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
                            <Copyright className="h-5 w-5 text-shield-accent" />
                        </div>
                        <h1 className="text-3xl font-bold text-shield-text">Copyright Notice</h1>
                    </div>
                    <p className="text-shield-muted text-sm">
                        Last updated: March 28, 2026
                    </p>
                </div>

                <div className="space-y-8 text-shield-muted leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">Ownership</h2>
                        <p>
                            The SolHunt software, source code, site copy, application layout, and
                            related documentation are copyrighted by SolHunt, except where
                            third-party open source libraries, APIs, trademarks, or assets apply
                            under their own respective licenses and terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">Copyright Statement</h2>
                        <p>
                            Copyright (c) 2025 SolHunt. All rights in the SolHunt brand, name,
                            logo, and proprietary content are reserved unless explicitly licensed
                            otherwise.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">Open Source Code</h2>
                        <p>
                            Portions of the SolHunt codebase are made available under the MIT
                            License. Use of the source code is governed by the license terms
                            published on the License page and in the project repository.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">Third-Party Materials</h2>
                        <p>
                            SolHunt depends on third-party open source packages and external
                            service providers. All trademarks, product names, logos, and software
                            components belonging to third parties remain the property of their
                            respective owners.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">Questions</h2>
                        <p>
                            For copyright or ownership questions, contact SolHunt through{' '}
                            <a
                                href="https://x.com/solhuntapp"
                                className="text-shield-accent hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                @solhuntapp
                            </a>.
                        </p>
                    </section>
                </div>
            </div>
        </PageWrapper>
    );
}
