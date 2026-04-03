import { memo } from 'react';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { formatSOLValue } from '@/lib/formatting';
import type { EmptyTokenAccount } from '@/types';

interface EmptyAccountsInfoProps {
    emptyAccounts: EmptyTokenAccount[];
    estimatedRecoverableSOL: number;
}

export const EmptyAccountsInfo = memo(function EmptyAccountsInfo({
    emptyAccounts,
    estimatedRecoverableSOL,
}: EmptyAccountsInfoProps) {
    if (emptyAccounts.length === 0) return null;

    return (
        <div className="rounded-xl border border-shield-border bg-shield-card/50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-shield-accent/10 flex-shrink-0">
                    <Wallet className="h-4 w-4 text-shield-accent" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-shield-text mb-1">
                        Empty Token Accounts Found
                    </h3>
                    <p className="text-sm text-shield-muted mb-2">
                        You have <span className="font-medium text-shield-text">{emptyAccounts.length}</span> empty
                        token accounts with approximately{' '}
                        <span className="font-medium text-shield-success">
                            {formatSOLValue(estimatedRecoverableSOL)}
                        </span>{' '}
                        in locked rent.
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-shield-success/80">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Ready for reclaim via Engine 2</span>
                    </div>
                </div>
            </div>
        </div>
    );
});
