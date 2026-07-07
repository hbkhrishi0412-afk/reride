export function maskVehicleIdentifier(value?: string, visibleSuffix = 4): string {
  if (!value) return '-';
  const cleaned = value.trim();
  if (!cleaned) return '-';
  const suffixLength = Math.max(0, visibleSuffix);
  const suffix = suffixLength > 0 ? cleaned.slice(-suffixLength) : '';
  return `••••${suffix}`;
}

export function isSensitiveDisclosureItem(itemId: string): boolean {
  return itemId.startsWith('core.docs.') || itemId === 'core.photos.documents';
}
