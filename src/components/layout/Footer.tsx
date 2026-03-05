import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
    return (
        <footer className="border-t border-shield-border/40 bg-shield-bg py-6 mt-auto">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-shield-muted">
                        <Zap className="h-3.5 w-3.5 text-shield-accent" />
                        <span className="text-sm font-semibold">
                            <span className="text-shield-text">Sol</span>
                            <span className="text-shield-accent">Hunt</span>
                            <span className="text-shield-muted">.dev</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-shield-muted">
                        <Link to="/audit" className="hover:text-shield-text transition-colors">
                            Audit Report
                        </Link>
                        <span className="text-shield-border">•</span>
                        <span>Non-custodial • No data stored</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
