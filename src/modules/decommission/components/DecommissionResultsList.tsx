import { memo, useMemo } from 'react';
import { DecommissionPositionItem } from '../types';
import { DeadProtocolCard } from './DeadProtocolCard';

interface Props {
    items: DecommissionPositionItem[];
    selectedItems: DecommissionPositionItem[];
    toggleItem: (id: string) => void;
}

/** 
 * Memoized list component for decommission scan results.
 * Prevents re-renders when parent updates but items haven't changed.
 */
export const DecommissionResultsList = memo(function DecommissionResultsList({ items, selectedItems, toggleItem }: Props) {
    if (items.length === 0) return null;

    // Memoize selected IDs set for O(1) lookup in render
    const selectedIds = useMemo(() => 
        new Set(selectedItems.map(i => i.tokenAccountAddress)),
        [selectedItems]
    );

    return (
        <div className="space-y-4">
            {items.map(item => (
                <DeadProtocolCard
                    key={item.tokenAccountAddress}
                    item={item}
                    isSelected={selectedIds.has(item.tokenAccountAddress)}
                    onToggle={toggleItem}
                />
            ))}
        </div>
    );
});