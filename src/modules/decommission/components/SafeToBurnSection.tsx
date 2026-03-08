import { useNavigate } from 'react-router-dom';
import { DecommissionPositionItem } from '../types';

interface Props {
    items: DecommissionPositionItem[];
}

export function SafeToBurnSection({ items }: Props) {
    const navigate = useNavigate();

    if (items.length === 0) return null;

    return (
        <div className="mt-12 mb-8 mx-auto max-w-3xl">
            <div className="relative">
                <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-shield-border to-transparent" />
            </div>

            <div className="glass-card rounded-2xl p-6 md:p-8 mt-8 border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-3 mb-6 border-b border-shield-border/30 pb-4">
                    <span className="text-2xl">✅</span>
                    <div>
                        <h3 className="font-bold text-lg text-emerald-400">SAFE TO BURN (confirmed worthless tokens)</h3>
                    </div>
                </div>

                <p className="text-shield-muted text-sm leading-relaxed mb-6">
                    These tokens are from protocols that are fully dead — contracts confirmed empty. They hold no underlying value. It is safe to use Engine 3 to burn them and recover rent.
                </p>

                <div className="space-y-2 mb-6">
                    {items.map(item => (
                        <div key={item.tokenAccountAddress} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-black/20 border border-white/5">
                            <span className="font-mono text-sm text-shield-text font-bold">{item.tokenDef.symbol}</span>
                            <span className="text-xs text-shield-muted sm:ml-2">({item.protocol.name}) — Protocol dead, token worthless</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => navigate('/scan#engine-3')}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-6 py-3 font-semibold text-emerald-400 transition-all hover:bg-emerald-500 hover:text-emerald-950 shadow-sm shadow-emerald-500/10"
                >
                    Burn in Engine 3 →
                </button>
            </div>
        </div>
    );
}
