import type { SpamSignal } from '../types';

const SIGNAL_LABELS: Record<SpamSignal, string> = {
    unverified_collection: 'Unverified collection',
    no_metadata: 'No metadata',
    suspicious_name: 'Suspicious name',
    duplicate_image: 'Duplicate image',
    no_creators: 'No creators',
    zero_royalty: 'Zero royalty',
    suspicious_uri: 'Suspicious URI',
    known_spam_collection: 'Known spam',
};

export function formatSpamSignal(signal: SpamSignal): string {
    return SIGNAL_LABELS[signal] ?? signal;
}

export function truncateAddress(address: string, chars = 4): string {
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function truncateName(name: string, maxLen = 32): string {
    if (name.length <= maxLen) return name;
    return `${name.slice(0, maxLen - 1)}…`;
}
