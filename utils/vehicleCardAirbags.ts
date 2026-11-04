/** Subtitle fragment from listing features, e.g. "6 Airbags". */
export function airbagLabel(features: string[] | undefined): string | null {
  if (!features?.length) return null;
  for (const f of features) {
    const m = f.match(/(\d+)\s*airbags?/i) || f.match(/airbags?\s*[x×]?\s*(\d+)/i);
    if (m) return `${m[1]} Airbags`;
    if (/dual\s*airbags?/i.test(f)) return 'Dual Airbags';
    if (/airbags?/i.test(f)) return f.trim();
  }
  return null;
}
