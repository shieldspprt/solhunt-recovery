import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';

export function LicensePage() {
    useEffect(() => {
        document.title = 'License | SolHunt';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'SolHunt is open source software. Learn about our license, third-party open source dependencies, and your rights to use, modify, and distribute the code.');
    }, []);

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
                            <Scale className="h-5 w-5 text-shield-accent" />
                        </div>
                        <h1 className="text-3xl font-bold text-shield-text">Open Source License</h1>
                    </div>
                    <p className="text-shield-muted text-sm">
                        Last updated: March 28, 2026
                    </p>
                </div>

                <div className="space-y-8 text-shield-muted leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">License Summary</h2>
                        <p>
                            SolHunt is distributed under the MIT License. This license allows use,
                            copy, modification, merge, publication, distribution, sublicensing,
                            and sale of the software, provided that the copyright notice and this
                            permission notice are included in substantial portions of the software.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-shield-text mb-3">Full MIT License</h2>
                        <div className="rounded-2xl border border-shield-border bg-black/20 p-5">
                            <pre className="whitespace-pre-wrap text-sm leading-7 text-shield-muted font-mono">
{`MIT License

Copyright (c) 2025 SolHunt

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
                            </pre>
                        </div>
                    </section>
                </div>
            </div>
        </PageWrapper>
    );
}
