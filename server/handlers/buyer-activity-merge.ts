export function uniqueIds(ids: unknown): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  if (!Array.isArray(ids)) return out;
  for (const raw of ids) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Stored inside saved_searches so a stale tab cannot put a deleted search back. */
export const REMOVED_SAVED_SEARCH_ID = '__removed__';

function searchId(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  return String((item as { id?: unknown }).id || '');
}

export function splitSavedSearches(raw: unknown): { items: unknown[]; removed: string[] } {
  const items: unknown[] = [];
  const removed: string[] = [];
  if (!Array.isArray(raw)) return { items, removed };
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { id?: unknown; ids?: unknown };
    if (String(record.id || '') === REMOVED_SAVED_SEARCH_ID && Array.isArray(record.ids)) {
      for (const id of record.ids) {
        const text = String(id || '');
        if (text && text !== REMOVED_SAVED_SEARCH_ID) removed.push(text);
      }
      continue;
    }
    if (searchId(item)) items.push(item);
  }
  return { items, removed };
}

export function savedSearchesForClient(raw: unknown): unknown[] {
  return splitSavedSearches(raw).items;
}

export function storedSavedSearches(items: unknown[], removedIds: string[]): unknown[] {
  if (!removedIds.length) return items;
  return [...items, { id: REMOVED_SAVED_SEARCH_ID, ids: removedIds }];
}

function mergeById(incoming: unknown, existing: unknown): unknown[] {
  const a = Array.isArray(incoming) ? incoming : [];
  const b = Array.isArray(existing) ? existing : [];
  if (a.length === 0) return b;
  const map = new Map<string, unknown>();
  for (const item of [...a, ...b]) {
    if (!item || typeof item !== 'object') continue;
    const id = String((item as { id?: unknown }).id || '');
    if (!id || map.has(id)) continue;
    map.set(id, item);
  }
  return [...map.values()];
}

export type BuyerActivityIncoming = {
  recentlyViewed?: unknown;
  savedSearches?: unknown;
  notifications?: { priceDrops?: unknown; newMatches?: unknown };
  removePriceDrops?: unknown;
  removeSavedSearchIds?: unknown;
};

export type BuyerActivityRow = {
  recently_viewed?: unknown;
  saved_searches?: unknown;
  price_drops?: unknown;
  new_matches?: unknown;
};

export function mergeBuyerActivityRecord(
  existing: BuyerActivityRow | null | undefined,
  incoming: BuyerActivityIncoming,
): {
  recently_viewed: number[];
  saved_searches: unknown[];
  removedSavedSearchIds: string[];
  price_drops: number[];
  new_matches: number[];
} {
  const existingViewed = uniqueIds(existing?.recently_viewed);
  const incomingViewed = uniqueIds(incoming.recentlyViewed);
  const recently_viewed = uniqueIds([...incomingViewed, ...existingViewed]).slice(0, 20);

  const existingSplit = splitSavedSearches(existing?.saved_searches);
  const removedSearches = new Set(existingSplit.removed);
  for (const id of Array.isArray(incoming.removeSavedSearchIds) ? incoming.removeSavedSearchIds : []) {
    const text = String(id || '');
    if (text) removedSearches.add(text);
  }
  const incomingItems = splitSavedSearches(incoming.savedSearches).items.filter(
    (item) => !removedSearches.has(searchId(item)),
  );
  const keptExisting = existingSplit.items.filter((item) => !removedSearches.has(searchId(item)));
  const saved_searches = mergeById(incomingItems, keptExisting);
  // ponytail: cap tombstones at 100; older deletions can be re-added by a stale client after that.
  const removedSavedSearchIds = [...removedSearches].slice(-100);

  let price_drops = uniqueIds([
    ...(uniqueIds(existing?.price_drops)),
    ...(uniqueIds(incoming.notifications?.priceDrops)),
  ]);
  const removals = new Set(uniqueIds(incoming.removePriceDrops));
  if (removals.size > 0) {
    price_drops = price_drops.filter((id) => !removals.has(id));
  }

  const new_matches = uniqueIds([
    ...(uniqueIds(existing?.new_matches)),
    ...(uniqueIds(incoming.notifications?.newMatches)),
  ]);

  return { recently_viewed, saved_searches, removedSavedSearchIds, price_drops, new_matches };
}
