import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet } from 'lucide-react';

interface WalletConnectButtonProps {
    label?: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function WalletConnectButton({
    label = 'Connect Wallet',
    className = '',
    size = 'md',
}: WalletConnectButtonProps) {
    const { setVisible } = useWalletModal();
    const { connected } = useWallet();

    if (connected) return null;

    const sizeClasses = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
    };

    return (
        <button
            id="wallet-connect-button"
            onClick={() => setVisible(true)}
            className={`
                inline-flex items-center gap-2 rounded-xl font-bold
                bg-shield-accent hover:bg-shield-accent/90
                text-shield-bg shadow-lg shadow-shield-accent/20
                transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                ${sizeClasses[size]}
                ${className}
            `}
        >
            <Wallet className="h-5 w-5" />
            {label}
        </button>
    );
}
