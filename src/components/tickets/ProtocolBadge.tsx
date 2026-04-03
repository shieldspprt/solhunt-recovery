import { memo, useMemo, useState } from 'react';
import { PROTOCOL_INFO } from '@/config/constants';
import type { StakingProtocol } from '@/types';

interface ProtocolBadgeProps {
    protocol: StakingProtocol;
    size?: 'sm' | 'md';
}

export const ProtocolBadge = memo(function ProtocolBadge({ protocol, size = 'sm' }: ProtocolBadgeProps) {
    const [logoFailed, setLogoFailed] = useState(false);
    const info = PROTOCOL_INFO[protocol] || PROTOCOL_INFO.unknown;

    const styles = useMemo(() => {
        if (size === 'md') {
            return {
                container: 'rounded-lg px-2.5 py-1.5 text-xs',
                icon: 'h-4 w-4',
            };
        }
        return {
            container: 'rounded-md px-2 py-1 text-[11px]',
            icon: 'h-3.5 w-3.5',
        };
    }, [size]);

    const initial = info.displayName.charAt(0).toUpperCase();

    return (
        <span
            className={[
                'inline-flex items-center gap-1.5 border border-shield-border bg-shield-bg/70 text-shield-text',
                styles.container,
            ].join(' ')}
            aria-label={`${info.displayName} protocol`}
        >
            {info.logoUri && !logoFailed ? (
                <img
                    src={info.logoUri}
                    alt={info.displayName}
                    onError={() => setLogoFailed(true)}
                    className={`${styles.icon} rounded-full`}
                />
            ) : (
                <span className={`${styles.icon} inline-flex items-center justify-center rounded-full bg-shield-accent/20 text-[10px] font-semibold text-shield-accent`}>
                    {initial}
                </span>
            )}
            <span className="font-medium">{info.displayName}</span>
        </span>
    );
});