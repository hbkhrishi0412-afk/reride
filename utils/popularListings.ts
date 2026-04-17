/**
 * Data-driven "popular" aggregations for home-page discovery surfaces.
 *
 * The entire point of this module is that the home page's popular-brand
 * and popular-model chips stay in sync with the live catalog with zero
 * manual maintenance. When a new make or model gets added in production,
 * it starts showing up on the home page the moment its listing count
 * crosses the top-N threshold — no code change required.
 *
 * Every helper is:
 *   - Pure (no side effects, stable under memoization).
 *   - Tolerant of missing / malformed rows (skipped silently).
 *   - Status-aware (only `published` rows feed the ranking).
 *   - Case-insensitive on grouping keys but returns the most common
 *     spelling as the canonical display value, so the chip's label is
 *     always an exact match for at least one row in the catalog. That's
 *     what makes the downstream deep-link filter deterministic.
 */
import type { Vehicle } from '../types';

export interface PopularMake {
    name: string;
    count: number;
}

export interface PopularModel {
    make: string;
    model: string;
    count: number;
}

const normKey = (s: string): string => s.trim().toLowerCase();

/**
 * Group items by a case-insensitive key and track the most common exact
 * spelling. Returns an array sorted by descending count (tie-broken by
 * alphabetical display name for stable rendering).
 */
function tallyByCanonical<T>(
    items: T[],
    keyOf: (item: T) => string | undefined | null
): Array<{ key: string; display: string; count: number }> {
    const buckets = new Map<string, { count: number; spellings: Map<string, number> }>();
    for (const item of items) {
        const raw = keyOf(item);
        if (!raw || typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const key = normKey(trimmed);
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = { count: 0, spellings: new Map() };
            buckets.set(key, bucket);
        }
        bucket.count += 1;
        bucket.spellings.set(trimmed, (bucket.spellings.get(trimmed) || 0) + 1);
    }
    return Array.from(buckets.entries())
        .map(([key, { count, spellings }]) => {
            let best = '';
            let bestCount = -1;
            for (const [spelling, n] of spellings) {
                if (n > bestCount) {
                    best = spelling;
                    bestCount = n;
                }
            }
            return { key, display: best, count };
        })
        .sort((a, b) => (b.count - a.count) || a.display.localeCompare(b.display));
}

/** Top makes by live listing count, filtered to published rows. */
export function getPopularMakes(vehicles: Vehicle[], limit = 8): PopularMake[] {
    if (!Array.isArray(vehicles) || vehicles.length === 0) return [];
    const published = vehicles.filter((v) => v && v.status === 'published');
    const ranked = tallyByCanonical(published, (v) => v.make);
    return ranked.slice(0, Math.max(0, limit)).map((r) => ({ name: r.display, count: r.count }));
}

/**
 * Top make+model pairs by live listing count. Returns the canonical
 * spelling for both make and model so the deep-link filter lands on
 * exact rows. Ensures at most one entry per unique make/model pair.
 */
export function getPopularModels(vehicles: Vehicle[], limit = 6): PopularModel[] {
    if (!Array.isArray(vehicles) || vehicles.length === 0) return [];
    const published = vehicles.filter(
        (v) => v && v.status === 'published' && v.make && v.model
    );
    const ranked = tallyByCanonical(published, (v) => `${v.make}::${v.model}`);
    const out: PopularModel[] = [];
    for (const row of ranked) {
        const idx = row.display.indexOf('::');
        if (idx <= 0) continue;
        const make = row.display.slice(0, idx).trim();
        const model = row.display.slice(idx + 2).trim();
        if (!make || !model) continue;
        out.push({ make, model, count: row.count });
        if (out.length >= limit) break;
    }
    return out;
}
