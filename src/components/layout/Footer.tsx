import { memo } from 'react';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer = memo(function Footer() {
    return (
        <footer className="border-t border-shield-border/40 bg-shield-bg py-6 mt-auto" aria-label="Site footer">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-shield-muted">
                            <Zap className="h-3.5 w-3.5 text-shield-accent" aria-hidden="true" />
                            <span>
                                <span className="text-sm font-semibold text-shield-text">Sol</span>
                                <span className="text-sm font-semibold text-shield-accent">Hunt</span>
                                <span className="text-sm font-semibold text-shield-muted">.dev</span>
                            </span>
                        </div>
                        <span className="text-xs text-shield-muted/60">Non-custodial • Client-side • No data stored</span>
                    </div>
                    <nav className="flex items-center gap-4 text-xs text-shield-muted" aria-label="Footer links">
                        <a href="https://twitter.com/solhuntdev" target="_blank" rel="noopener noreferrer" className="hover:text-[#1DA1F2] transition-colors" aria-label="Follow SolHunt on X (Twitter)">
                            @solhuntdev
                        </a>
                        <span className="text-shield-border" aria-hidden="true">•</span>
                        <Link to="/privacy" className="hover:text-shield-text transition-colors" aria-label="Privacy Policy">
                            Privacy
                        </Link>
                        <span className="text-shield-border" aria-hidden="true">•</span>
                        <Link to="/license" className="hover:text-shield-text transition-colors" aria-label="Software License">
                            License
                        </Link>
                        <span className="text-shield-border" aria-hidden="true">•</span>
                        <Link to="/copyright" className="hover:text-shield-text transition-colors" aria-label="Copyright Notice">
                            Copyright
                        </Link>
                    </nav>
                </div>
            </div>
        </footer>
    );
});