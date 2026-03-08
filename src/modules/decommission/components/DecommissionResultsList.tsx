import { DecommissionPositionItem } from '../types';
import { DeadProtocolCard } from './DeadProtocolCard';

interface Props {
    items: DecommissionPositionItem[];
    selectedItems: DecommissionPositionItem[];
    toggleItem: (id: string) => void;
}

export function DecommissionResultsList({ items, selectedItems, toggleItem }: Props) {
    if (items.length === 0) return null;

    return (
        <div className="space-y-4">
            {items.map(item => (
                <DeadProtocolCard
                    key={item.tokenAccountAddress}
                    item={item}
                    isSelected={selectedItems.some(i => i.tokenAccountAddress === item.tokenAccountAddress)}
                    onToggle={toggleItem}
                />
            ))}
        </div>
    );
}
