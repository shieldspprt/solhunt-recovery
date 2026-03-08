import { BufferAccount } from '../types';
import { RECENT_BUFFER_THRESHOLD_MS } from '../constants';
import { shortenAddress } from '@/lib/formatting';
import { Code2, AlertTriangle } from 'lucide-react';

interface BufferRowProps {
    buffer: BufferAccount;
    isSelected: boolean;
    onToggle: (address: string) => void;
}

export function BufferRow({ buffer, isSelected, onToggle }: BufferRowProps) {
    const isRecent = Date.now() - buffer.createdAt < RECENT_BUFFER_THRESHOLD_MS;

    return (
        <div
            className={`
                flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200
                ${isSelected
                    ? 'bg-shield-accent/5 border-shield-accent/40 ring-1 ring-shield-accent/20'
                    : 'bg-shield-bg/50 border-shield-border/40 hover:border-shield-border/80'}
            `}
            onClick={() => onToggle(buffer.address)}
            role="button"
            tabIndex={0}
            data-agent-target={`buffer-row-${buffer.address}`}
        >
            <div className="flex items-center gap-3">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(buffer.address)}
                    className="h-4 w-4 rounded border-shield-border text-shield-accent focus:ring-shield-accent/50 bg-shield-bg"
                    onClick={(e) => e.stopPropagation()}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-shield-card border border-shield-border">
                    <Code2 className="h-5 w-5 text-shield-accent" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-shield-text">
                            {shortenAddress(buffer.address, 6)}
                        </span>
                        {isRecent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-shield-warning/10 text-shield-warning border border-shield-warning/20">
                                <AlertTriangle className="h-3 w-3" />
                                RECENT
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-shield-muted">{buffer.label || 'Program Buffer'}</p>
                </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8">
                <div className="text-right">
                    <p className="text-sm font-bold text-shield-text">{(buffer.lamports / 1e9).toFixed(3)} SOL</p>
                    <p className="text-[10px] text-shield-muted uppercase tracking-wider">Locked Rent</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-shield-accent">{buffer.recoverableSOL.toFixed(3)} SOL</p>
                    <p className="text-[10px] text-shield-muted uppercase tracking-wider">Recoverable</p>
                </div>
            </div>
        </div>
    );
}
