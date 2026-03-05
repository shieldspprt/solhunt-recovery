import { useState, useCallback } from 'react';
import { resolveUri } from '../utils/ipfs';

interface CNFTImageThumbnailProps {
    uri: string | null;
    alt: string;
    size?: number;
}

export function CNFTImageThumbnail({
    uri,
    alt,
    size = 40,
}: CNFTImageThumbnailProps) {
    const [hasError, setHasError] = useState(false);
    const resolvedUri = resolveUri(uri);

    const handleError = useCallback(() => {
        setHasError(true);
    }, []);

    const firstLetter = (alt || '?').charAt(0).toUpperCase();

    if (!resolvedUri || hasError) {
        return (
            <div
                className="flex-shrink-0 rounded-lg bg-shield-border/50 flex items-center justify-center text-shield-muted font-medium text-xs"
                style={{ width: size, height: size }}
            >
                {firstLetter}
            </div>
        );
    }

    return (
        <img
            src={resolvedUri}
            alt={alt}
            width={size}
            height={size}
            loading="lazy"
            onError={handleError}
            className="flex-shrink-0 rounded-lg object-cover bg-shield-border/30"
            style={{ width: size, height: size }}
        />
    );
}
