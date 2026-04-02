import { useAppStore } from '@/hooks/useAppStore';
import { useRevoke } from '@/hooks/useRevoke';
import { estimateTransactionCost } from '@/lib/revoke';
import { formatSOLValue, estimateUSD } from '@/lib/formatting';
import { ShieldAlert, X } from 'lucide-react';
import type { TokenDelegation } from '@/types';
import { useState } from 'react';

interface RevokeConfirmModalProps {
    delegations: TokenDelegation[];
}

export function RevokeConfirmModal({ delegations }: RevokeConfirmModalProps) {
    const { revokeStatus, clearRevoke } = useAppStore();
    const { revoke } = useRevoke();
    const [feeConsent, setFeeConsent] = useState(false);

    // Only show when state is awaiting_confirmation
    if (revokeStatus !== 'awaiting_confirmation') return null;

    const cost = estimateTransactionCost(delegations.length);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-shield-bg/80 backdrop-blur-sm"
                onClick={clearRevoke}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-shield-border bg-shield-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={clearRevoke}
                    className="absolute right-4 top-4 text-shield-muted hover:text-shield-text transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-6 sm:p-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-shield-danger/10">
                        <ShieldAlert className="h-8 w-8 text-shield-danger" />
                    </div>

                    <h2 className="text-xl font-bold text-center text-shield-text mb-6">
                        Revoke {delegations.length} token permission{delegations.length !== 1 ? 's' : ''}?
                    </h2>

                    <div className="space-y-3 mb-6 text-sm">
                        <p className="text-shield-muted text-center mb-4">This will:</p>
                        <ul className="space-y-2 text-shield-text">
                            <li className="flex items-start gap-2">
                                <span className="text-shield-success">✅</span>
                                Remove delegate access from {delegations.length} token accounts
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-shield-success">✅</span>
                                Protect your tokens from unauthorized transfers
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-shield-success">✅</span>
                                NOT move, burn, or affect your tokens in any way
                            </li>
                        </ul>
                    </div>

                    <div className="rounded-xl border border-shield-border bg-shield-bg p-4 mb-6">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-shield-muted mb-3">
                            Cost Breakdown
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Service fee:</span>
                                <span className="text-shield-text">
                                    {formatSOLValue(cost.serviceFeeSOL)} <span className="text-shield-muted text-xs">({estimateUSD(cost.serviceFeeSOL)})</span>
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-shield-muted">Network fees (est):</span>
                                <span className="text-shield-text">
                                    ~{formatSOLValue(cost.networkFeeSOL)} <span className="text-shield-muted text-xs">({estimateUSD(cost.networkFeeSOL)})</span>
                                </span>
                            </div>
                            <div className="my-2 border-t border-shield-border/50" />
                            <div className="flex justify-between font-semibold">
                                <span className="text-shield-text">Total:</span>
                                <span className="text-shield-text">
                                    ~{formatSOLValue(cost.totalSOL)} <span className="text-shield-muted text-xs font-normal">({estimateUSD(cost.totalSOL)})</span>
                                </span>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-center text-shield-muted italic">
                            This fee is deducted from your SOL balance, not your tokens.
                        </p>
                    </div>

                    {/* Fee Disclosure & Consent */}
                    <div className="rounded-xl border border-shield-accent/30 bg-shield-accent/5 p-4 mb-6">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={feeConsent}
                                onChange={(e) => setFeeConsent(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-shield-border bg-shield-bg text-shield-accent focus:ring-shield-accent focus:ring-offset-0 cursor-pointer"
                            />
                            <span className="text-xs text-shield-text leading-relaxed">
                                I understand that a service fee of <span className="font-semibold text-shield-accent">{formatSOLValue(cost.serviceFeeSOL)}</span> and network fees of approximately <span className="font-semibold text-shield-accent">{formatSOLValue(cost.networkFeeSOL)}</span> will be deducted from my wallet upon confirmation.
                            </span>
                        </label>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button
                            onClick={clearRevoke}
                            className="flex-1 rounded-xl border border-shield-border bg-transparent px-4 py-3 font-semibold text-shield-text hover:bg-shield-border/50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => revoke(delegations)}
                            disabled={!feeConsent}
                            className="flex-1 rounded-xl bg-shield-danger px-4 py-3 font-semibold text-white shadow-lg shadow-shield-danger/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none hover:bg-shield-danger/90 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed"
                        >
                            Revoke {delegations.length} Permissions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
