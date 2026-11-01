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
  price_drops: number[];
  new_matches: number[];
} {
  const existingViewed = uniqueIds(existing?.recently_viewed);
  const incomingViewed = uniqueIds(incoming.recentlyViewed);
  const recently_viewed = uniqueIds([...incomingViewed, ...existingViewed]).slice(0, 20);

  const removedSearches = new Set(
    (Array.isArray(incoming.removeSavedSearchIds) ? incoming.removeSavedSearchIds : []).map((id) => String(id || '')).filter(Boolean),
  );
  const saved_searches = mergeById(incoming.savedSearches, existing?.saved_searches)
    .filter((item) => !removedSearches.has(String((item as { id?: unknown }).id || '')));

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

  return { recently_viewed, saved_searches, price_drops, new_matches };
}
