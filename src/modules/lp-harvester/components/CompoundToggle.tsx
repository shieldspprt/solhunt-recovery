interface CompoundToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

export function CompoundToggle({ enabled, onChange }: CompoundToggleProps) {
    return (
        <div className="rounded-xl border border-shield-border/60 bg-shield-bg/50 p-3">
            <label className="flex cursor-pointer items-start gap-3">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => onChange(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-shield-border bg-shield-bg text-shield-accent"
                />
                <span className="text-sm text-shield-text">
                    <span className="font-medium">Auto-compound harvested fees (+2% service fee)</span>
                    <span className="mt-1 block text-xs text-shield-muted">
                        Reinvests harvested tokens into in-range positions only. Fee changes from 8% to 10%.
                    </span>
                </span>
            </label>
        </div>
    );
}
