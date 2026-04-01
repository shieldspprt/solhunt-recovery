/**
 * Shared array and number utilities to avoid duplication across modules.
 */

/**
 * Splits an array into fixed-size chunks.
 * Example: chunk([1,2,3,4,5], 2) → [[1,2], [3,4], [5]]
 */
export function chunk<T>(items: T[], size: number): T[][] {
    if (size <= 0) return [items];
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

/**
 * Safely parses a value as a float, returning 0 for nullish/invalid values.
 */
export function safeParseFloat(value: string | number | undefined): number {
    if (value === undefined) return 0;
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}