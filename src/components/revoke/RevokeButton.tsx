import { memo } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useRevoke } from '@/hooks/useRevoke';
import { RevokeConfirmModal } from '@/components/revoke/RevokeConfirmModal';
import { RevokeProgressModal } from '@/components/revoke/RevokeProgressModal';
import { SERVICE_FEE_SOL } from '@/config/constants';
import type { TokenDelegation } from '@/types';

interface RevokeButtonProps {
    delegations: TokenDelegation[];
}

export const RevokeButton = memo(function RevokeButton({ delegations }: RevokeButtonProps) {
    const { requestConfirmation } = useRevoke();

    // Guard: if delegations is missing or empty, render nothing
    if (!delegations || delegations.length === 0) return null;

    return (
        <>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-shield-card border border-shield-border p-4 shadow-xl shadow-shield-bg/50">
                <div className="text-center sm:text-left">
                    <p className="text-shield-text font-medium">Ready to protect your wallet?</p>
                    <p className="text-sm text-shield-muted">
                        Revoke all {delegations.length} permissions in one transaction.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={requestConfirmation}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-shield-danger hover:bg-shield-danger/90 text-white font-semibold px-8 py-3.5 shadow-lg shadow-shield-danger/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-shield-danger/50 focus-visible:ring-offset-2"
                    aria-label={`Revoke all ${delegations.length} token permissions for ${SERVICE_FEE_SOL} SOL fee`}
                >
                    <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                    Revoke All Permissions
                    <span className="hidden sm:inline bg-white/20 px-2 py-0.5 rounded text-sm ml-1">
                        {SERVICE_FEE_SOL} SOL fee
                    </span>
                </button>
            </div>

            {/* Modals rendered contextually based on Zustand state */}
            <RevokeConfirmModal delegations={delegations} />
            <RevokeProgressModal delegations={delegations} />
        </>
    );
});
