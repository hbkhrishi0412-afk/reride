/** Merge API catalog packages with session prefill packages (service-* ids from ServiceDetail). */
export function mergeServiceCatalogPackages<T extends { id: string }>(prev: T[], fromApi: T[]): T[] {
  const prefill = prev.filter((p) => p.id.startsWith('service-'));
  const byId = new Map<string, T>();
  for (const p of fromApi) byId.set(p.id, p);
  for (const p of prefill) byId.set(p.id, p);
  return Array.from(byId.values());
}

type CatalogServiceLine = { serviceType?: string; price?: number; active?: boolean };

/** Min published price per service type among listed workshops only (not the global public dump). */
export function lowestPublishedPrices(
  providerServices: Record<string, CatalogServiceLine[] | undefined>,
  listedProviderIds: Iterable<string>,
): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const id of listedProviderIds) {
    for (const svc of providerServices[id] || []) {
      if (svc.active === false || !svc.serviceType) continue;
      const price = svc.price;
      if (price == null || price <= 0) continue;
      const prev = prices[svc.serviceType];
      prices[svc.serviceType] = prev != null ? Math.min(prev, price) : price;
    }
  }
  return prices;
}
