import { memo } from 'react';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer = memo(function Footer() {
    return (
        <footer className="border-t border-shield-border/40 bg-shield-bg py-6 mt-auto">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-shield-muted">
                            <Zap className="h-3.5 w-3.5 text-shield-accent" />
                            <span className="text-sm font-semibold">
                                <span className="text-shield-text">Sol</span>
                                <span className="text-shield-accent">Hunt</span>
                                <span className="text-shield-muted">.dev</span>
                            </span>
                        </div>
                        <span className="text-xs text-shield-muted/60">built using gemini 3.1, claude 4.6 .. a nightly build</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-shield-muted">
                        <a href="https://twitter.com/solhuntdev" target="_blank" rel="noopener noreferrer" className="hover:text-[#1DA1F2] transition-colors" aria-label="Follow SolHunt on X (Twitter)">
                            @solhuntdev
                        </a>
                        <span className="text-shield-border">•</span>
                        <Link to="/privacy" className="hover:text-shield-text transition-colors" aria-label="Privacy Policy">
                            Privacy
                        </Link>
                        <span className="text-shield-border">•</span>
                        <Link to="/license" className="hover:text-shield-text transition-colors" aria-label="Software License">
                            License
                        </Link>
                        <span className="text-shield-border">•</span>
                        <Link to="/copyright" className="hover:text-shield-text transition-colors" aria-label="Copyright Notice">
                            Copyright
                        </Link>
                        <span className="text-shield-border">•</span>
                        <span>Non-custodial • No data stored</span>
                    </div>
                </div>
            </div>
        </footer>
    );
});