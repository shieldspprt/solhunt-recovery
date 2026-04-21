import { DEAD_PROTOCOLS } from '../registry/protocols';

interface Props {
    startScan: () => void;
}

export function DecommissionScanPanel({ startScan }: Props) {
    const knownMintsCount = DEAD_PROTOCOLS.reduce((sum, p) => sum + (p.positionTokenMints?.length || 0), 0);

    return (
        <div className="glass-card rounded-3xl p-8 sm:p-12 text-center mt-6">
            <div className="mb-8 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-shield-border/30 border border-shield-border/50">
                <span className="text-4xl">🪦</span>
            </div>

            <h1 className="text-3xl font-extrabold text-shield-text mb-6">
                Protocol Decommission Monitor
            </h1>

            <p className="text-lg text-shield-muted max-w-2xl mx-auto mb-10 leading-relaxed">
                Solana's DeFi graveyard is full of your tokens. Friktion shut down in 2023 — 20,000 wallets still have position tokens. Saber went quiet — LP tokens representing real USDC sit unreclaimed. Atrix, Aldrin, Jet Protocol — all dormant, all still holding funds.
            </p>

            <div className="bg-shield-bg/50 rounded-2xl p-6 max-w-lg mx-auto mb-10 border border-shield-border/30">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-shield-muted">Monitoring:</span>
                    <span className="font-bold text-shield-text">{DEAD_PROTOCOLS.length} decommissioned protocols</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-shield-muted">Known position tokens:</span>
                    <span className="font-bold text-shield-text">{knownMintsCount} registered mints</span>
                </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 max-w-2xl mx-auto mb-10 text-left flex gap-4">
                <span className="text-2xl">⚠️</span>
                <div>
                    <strong className="text-orange-400 block mb-1">Important: Do not burn tokens from dead protocols.</strong>
                    <span className="text-shield-muted text-sm">
                        They may look like worthless dust. They are not. Scan here first — Engine 3 (Dust Consolidator) runs after.
                    </span>
                </div>
            </div>

            <button
                onClick={startScan}
                aria-label="Scan My Wallet"
                className="group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-shield-accent px-10 py-5 text-lg font-bold text-shield-bg transition-all hover:bg-shield-highlight hover:shadow-xl hover:shadow-shield-accent/20 hover:-translate-y-1"
            >
                <span>Scan My Wallet →</span>
            </button>

            <p className="mt-6 text-sm text-shield-muted/60">
                Read-only scan. No transaction until you confirm recovery.
            </p>
        </div>
    );
}
