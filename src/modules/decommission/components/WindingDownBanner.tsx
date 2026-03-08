import { DEAD_PROTOCOLS } from '../registry/protocols';

export function WindingDownBanner() {
    const windingDownProtocols = DEAD_PROTOCOLS.filter(p => p.decommissionStatus === 'winding_down');
    if (windingDownProtocols.length === 0) return null;

    return (
        <div className="mb-8 rounded-2xl border-2 border-red-500/50 bg-red-500/10 p-6 overflow-hidden relative group">
            <div className="absolute inset-0 bg-red-500/5 rotate-in pointer-events-none origin-bottom opacity-50 transition-transform duration-1000 group-hover:scale-105" />
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl animate-bounce">🚨</span>
                    <h2 className="text-xl font-bold text-red-500 uppercase tracking-wider">
                        URGENT — WINDING DOWN
                    </h2>
                </div>

                <div className="space-y-4 text-shield-text">
                    {windingDownProtocols.map(p => (
                        <div key={p.id} className="bg-red-900/20 p-4 rounded-xl border border-red-500/20">
                            <strong className="text-red-400 text-lg">{p.name}</strong> has announced it is shutting down.
                            <p className="mt-2 text-sm text-shield-muted/80">
                                Users with associated position tokens must withdraw as soon as possible before recovery becomes impossible.
                            </p>
                        </div>
                    ))}
                </div>

                <p className="mt-6 font-semibold text-shield-text flex items-center gap-2">
                    Scan your wallet now to check if you are affected.
                </p>
            </div>
        </div>
    );
}
