/** Canonical workshop booking helpers — id aliases, menu match, listing gate. */

export function collectProviderIdAliases(
  ...ids: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function providerMatchesActor(
  storedId: unknown,
  aliases: string[],
): boolean {
  const id = String(storedId || '').trim();
  if (!id || aliases.length === 0) return false;
  return aliases.includes(id);
}

/** Incoming visibility: assigned to this workshop, or explicitly listed as a candidate. */
export function incomingVisibleToProvider(
  request: { providerId?: string | null; candidateProviderIds?: unknown },
  aliases: string[],
): boolean {
  if (request.providerId) {
    return providerMatchesActor(request.providerId, aliases);
  }
  const candidates = request.candidateProviderIds;
  if (!Array.isArray(candidates) || candidates.length === 0) return false;
  return candidates.some((id) => aliases.includes(String(id)));
}

export function assignedWorkshopId(payload: {
  providerId?: string | null;
  candidateProviderIds?: unknown;
}): string | null {
  const direct = String(payload.providerId || '').trim();
  if (direct) return direct;
  const candidates = payload.candidateProviderIds;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = String(candidates[0] || '').trim();
  return first || null;
}

type CatalogLine = { serviceType?: string; active?: boolean; price?: number };

export function workshopOffersAllTypes(
  providerServices: CatalogLine[] | undefined,
  selectedTypes: string[],
): boolean {
  if (selectedTypes.length === 0) return false;
  const offered = new Set(
    (providerServices || [])
      .filter((s) => s.active !== false)
      .map((s) => String(s.serviceType || '').trim().toLowerCase())
      .filter(Boolean),
  );
  return selectedTypes.every((t) => offered.has(String(t).trim().toLowerCase()));
}

export function workshopHasAnyActiveService(
  providerServices: CatalogLine[] | undefined,
): boolean {
  return (providerServices || []).some(
    (s) => s.active !== false && String(s.serviceType || '').trim() !== '',
  );
}

export function catalogHasPricedMenu(services: unknown): boolean {
  if (!services || typeof services !== 'object' || Array.isArray(services)) return false;
  return Object.values(services as Record<string, CatalogLine | undefined>).some((s) => {
    if (!s || s.active === false) return false;
    return typeof s.price === 'number' && Number.isFinite(s.price) && s.price > 0;
  });
}

export function catalogStartingFrom(services: unknown): number | undefined {
  if (!services || typeof services !== 'object' || Array.isArray(services)) return undefined;
  let min: number | undefined;
  for (const s of Object.values(services as Record<string, CatalogLine | undefined>)) {
    if (!s || s.active === false) continue;
    if (typeof s.price !== 'number' || !Number.isFinite(s.price) || s.price <= 0) continue;
    min = min == null ? s.price : Math.min(min, s.price);
  }
  return min;
}

export function workshopIsListed(opts: {
  city?: string | null;
  hasPricedMenu: boolean;
}): boolean {
  const city = String(opts.city || '').trim();
  if (!city || city.toLowerCase() === 'pending setup') return false;
  return opts.hasPricedMenu;
}
