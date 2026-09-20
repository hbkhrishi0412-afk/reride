/** Merge API catalog packages with session prefill packages (service-* ids from ServiceDetail). */
export function mergeServiceCatalogPackages<T extends { id: string }>(prev: T[], fromApi: T[]): T[] {
  const prefill = prev.filter((p) => p.id.startsWith('service-'));
  const byId = new Map<string, T>();
  for (const p of fromApi) byId.set(p.id, p);
  for (const p of prefill) byId.set(p.id, p);
  return Array.from(byId.values());
}
