import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { PageWrapper } from '@/components/layout/PageWrapper';

export function NotFoundPage() {
    return (
        <PageWrapper>
            <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center animate-fade-in-up">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-shield-accent/10 border border-shield-accent/20">
                    <Zap className="h-8 w-8 text-shield-accent" />
                </div>
                <h1 className="text-6xl font-extrabold text-shield-text mb-2">404</h1>
                <p className="text-lg text-shield-muted mb-8">
                    This page doesn't exist. Let's get you back on track.
                </p>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 rounded-xl bg-shield-accent hover:bg-shield-accent/90 text-shield-bg font-bold px-6 py-3 transition-all hover:scale-[1.02]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to SolHunt
                </Link>
            </div>
        </PageWrapper>
    );
}
