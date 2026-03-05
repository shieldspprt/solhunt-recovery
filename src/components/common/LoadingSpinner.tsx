import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    message?: string;
    className?: string;
}

export function LoadingSpinner({
    size = 'md',
    message,
    className,
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    };

    return (
        <div className={clsx('flex flex-col items-center justify-center gap-3', className)}>
            <Loader2
                className={clsx(
                    'animate-spin text-shield-accent',
                    sizeClasses[size]
                )}
            />
            {message && (
                <p className="text-sm text-shield-muted animate-pulse">{message}</p>
            )}
        </div>
    );
}
