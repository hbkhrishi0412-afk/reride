/** Format digits with Indian grouping (e.g. 650000 → 6,50,000). */
export function formatIndianNumberInput(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-IN');
}

/** Strip grouping commas and non-digits from user input. */
export function parseIndianNumberDigits(value: string): string {
  return value.replace(/\D/g, '');
}
