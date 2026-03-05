import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface PageWrapperProps {
    children: ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
    return (
        <div className="flex min-h-screen flex-col bg-shield-bg">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
        </div>
    );
}
