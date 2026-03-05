import { useState, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CATEGORY_INFO } from '../constants';
import { CNFTItemRow } from './CNFTItemRow';
import type { CNFTCategory, CNFTItem } from '../types';

interface CNFTCategorySectionProps {
    category: CNFTCategory;
    items: CNFTItem[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    onSelectAll: (category: CNFTCategory) => void;
    onDeselectAll: (category: CNFTCategory) => void;
    defaultExpanded?: boolean;
}

const ROW_HEIGHT = 64;

export function CNFTCategorySection({
    category,
    items,
    selectedIds,
    onToggle,
    onSelectAll,
    onDeselectAll,
    defaultExpanded = false,
}: CNFTCategorySectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const parentRef = useRef<HTMLDivElement>(null);
    const info = CATEGORY_INFO[category];

    const selectedCount = items.filter((i) =>
        selectedIds.includes(i.id)
    ).length;
    const isVerified = category === 'verified';

    const virtualizer = useVirtualizer({
        count: isExpanded ? items.length : 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 10,
    });

    const handleSelectAll = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelectAll(category);
        },
        [category, onSelectAll]
    );

    const handleDeselectAll = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDeselectAll(category);
        },
        [category, onDeselectAll]
    );

    if (items.length === 0) return null;

    return (
        <div className="rounded-xl border border-shield-border/50 bg-shield-card/50 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-shield-border/10 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-shield-muted" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-shield-muted" />
                    )}
                    <span className="text-sm">{info.icon}</span>
                    <span
                        className="text-sm font-semibold uppercase tracking-wide"
                        style={{ color: info.color }}
                    >
                        {info.label}
                    </span>
                    <span className="text-xs text-shield-muted">
                        ({items.length} item{items.length !== 1 ? 's' : ''})
                    </span>
                    {!isVerified && selectedCount > 0 && (
                        <span className="text-xs text-shield-accent">
                            · {selectedCount} selected
                        </span>
                    )}
                </div>

                {/* Select / Deselect buttons */}
                {isExpanded && (
                    <div className="flex items-center gap-2">
                        {isVerified ? (
                            <div className="flex items-center gap-2 mr-2" onClick={e => e.stopPropagation()}>
                                <span className="text-xs text-shield-muted">Auto-select if worth &lt;</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={0.01}
                                    className="w-16 bg-shield-bg border border-shield-border rounded-md px-2 py-0.5 text-xs text-shield-text outline-none focus:border-shield-accent"
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val)) {
                                            // Deselect all verified first
                                            onDeselectAll(category);
                                            // Then select those below threshold
                                            items.forEach(item => {
                                                if (item.estimatedValueSOL <= val && !selectedIds.includes(item.id)) {
                                                    onToggle(item.id);
                                                }
                                            });
                                        }
                                    }}
                                />
                                <span className="text-xs text-shield-muted">SOL</span>
                            </div>
                        ) : null}

                        <span
                            onClick={handleSelectAll}
                            className="text-xs text-shield-accent hover:underline cursor-pointer"
                        >
                            Select All
                        </span>
                        <span
                            onClick={handleDeselectAll}
                            className="text-xs text-shield-muted hover:underline cursor-pointer"
                        >
                            Deselect All
                        </span>
                    </div>
                )}
            </button>

            {/* Items */}
            {isExpanded && (
                <>
                    {isVerified && (
                        <div className="px-4 py-3 bg-shield-warning/5 border-t border-shield-border/30 flex items-start gap-2">
                            <span className="text-shield-warning text-lg leading-none mt-px">⚠</span>
                            <p className="text-xs text-shield-muted leading-relaxed">
                                <strong className="text-shield-warning">Warning:</strong> These are verified cNFTs.
                                Burning them is irreversible and they will be permanently destroyed.
                                Many verified cNFTs have very low value, but please review carefully.
                            </p>
                        </div>
                    )}

                    <div
                        ref={parentRef}
                        className="border-t border-shield-border/30"
                        style={{
                            maxHeight: Math.min(items.length * ROW_HEIGHT, 400),
                            overflow: 'auto',
                        }}
                    >
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const item = items[virtualRow.index];
                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        <CNFTItemRow
                                            item={item}
                                            isSelected={selectedIds.includes(
                                                item.id
                                            )}
                                            onToggle={onToggle}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
