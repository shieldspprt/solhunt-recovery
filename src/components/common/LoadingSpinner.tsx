import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    message?: string;
    className?: string;
    fullpage?: boolean;
}

// Memoized to prevent re-renders when used as Suspense fallback across route changes
export const LoadingSpinner = memo(function LoadingSpinner({
    size = 'md',
    message,
    className,
    fullpage = false,
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    };

    const content = (
        <div 
            className={clsx('flex flex-col items-center justify-center gap-3', className)}
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-atomic="true"
        >
            <Loader2
                className={clsx(
                    'animate-spin text-shield-accent',
                    sizeClasses[size]
                )}
                aria-hidden="true"
            />
            {message && (
                <p className="text-sm text-shield-muted animate-pulse">{message}</p>
            )}
        </div>
    );

    if (fullpage) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-shield-bg/80 backdrop-blur-sm">
                {content}
            </div>
        );
    }

    return content;
});
