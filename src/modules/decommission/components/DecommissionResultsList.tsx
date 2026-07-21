import { memo, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DecommissionPositionItem } from '../types';
import { DeadProtocolCard } from './DeadProtocolCard';

interface Props {
    items: DecommissionPositionItem[];
    selectedItems: DecommissionPositionItem[];
    toggleItem: (id: string) => void;
}

/**
 * Virtualized list component for decommission scan results.
 * 
 * Uses @tanstack/react-virtual to render only visible items,
 * improving performance when scanning finds many positions across
 * multiple dead protocols.
 * 
 * Maintains full accessibility with aria-setsize and aria-posinset
 * for screen reader users navigating the virtualized list.
 */
export const DecommissionResultsList = memo(function DecommissionResultsList({ items, selectedItems, toggleItem }: Props) {
    if (items.length === 0) return null;

    // Memoize selected IDs set for O(1) lookup in render
    const selectedIds = useMemo(() => 
        new Set(selectedItems.map(i => i.tokenAccountAddress)),
        [selectedItems]
    );

    // Container ref for virtualizer
    const containerRef = useRef<HTMLDivElement>(null);

    // Virtualizer setup - estimate 300px per card, measure dynamically
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 300,
        overscan: 3, // Render 3 items above/below viewport for smooth scrolling
    });

    const virtualItems = virtualizer.getVirtualItems();

    return (
        <div 
            ref={containerRef}
            className="space-y-4 max-h-[600px] overflow-auto pr-2"
            role="list"
            aria-label={`${items.length} decommissioned protocol positions found`}
            aria-setsize={items.length}
        >
            {/* Spacer for total height to maintain scroll position */}
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualItems.map((virtualItem) => {
                    const item = items[virtualItem.index];
                    return (
                        <div
                            key={item.tokenAccountAddress}
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                            role="listitem"
                            aria-posinset={virtualItem.index + 1}
                        >
                            <DeadProtocolCard
                                item={item}
                                isSelected={selectedIds.has(item.tokenAccountAddress)}
                                onToggle={toggleItem}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
});