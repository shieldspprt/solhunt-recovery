import { useId } from 'react';

interface CompoundToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

export function CompoundToggle({ enabled, onChange }: CompoundToggleProps) {
    // Explicit id + aria-label guarantee screen readers announce a single,
    // atomic toggle name — relying on the implicit <label> wrapper alone can
    // fragment the announcement across the nested <span>s.
    const inputId = useId();

    return (
        <div className="rounded-xl border border-shield-border/60 bg-shield-bg/50 p-3">
            <label
                htmlFor={inputId}
                className="flex cursor-pointer items-start gap-3"
            >
                <input
                    id={inputId}
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => onChange(event.target.checked)}
                    aria-label="Auto-compound harvested fees"
                    aria-describedby={`${inputId}-description`}
                    className="mt-1 h-4 w-4 rounded border-shield-border bg-shield-bg text-shield-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shield-accent focus-visible:ring-offset-2 focus-visible:ring-offset-shield-bg"
                />
                <span className="text-sm text-shield-text">
                    <span className="font-medium">Auto-compound harvested fees (+2% service fee)</span>
                    <span
                        id={`${inputId}-description`}
                        className="mt-1 block text-xs text-shield-muted"
                    >
                        Reinvests harvested tokens into in-range positions only. Fee changes from 8% to 10%.
                    </span>
                </span>
            </label>
        </div>
    );
}
