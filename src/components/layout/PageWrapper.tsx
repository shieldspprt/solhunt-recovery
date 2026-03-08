import type { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface PageWrapperProps {
    children: ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
    const location = useLocation();
    const isHome = location.pathname === '/';

    return (
        <div className="flex min-h-screen flex-col bg-shield-bg">
            <Header />
            <main className="flex-1">
                {!isHome && (
                    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pt-6 sm:pt-8 pb-2 animate-fade-in">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-shield-muted hover:text-shield-text transition-colors group"
                        >
                            <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-300" />
                            Back to Home
                        </Link>
                    </div>
                )}
                {children}
            </main>
            <Footer />
        </div>
    );
}
