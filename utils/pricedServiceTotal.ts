export type PricedLine = { price?: number | null; quantity?: number | null };

/**
 * Sum of qty * price when every line has a finite price of zero or more.
 * A missing price returns undefined so a partial sum is not shown as the total.
 */
export function completeLineTotal(lines: PricedLine[]): number | undefined {
  if (!lines.length) return undefined;
  let total = 0;
  for (const line of lines) {
    const price = line.price;
    if (price == null || !Number.isFinite(price) || price < 0) return undefined;
    const qty = line.quantity != null && line.quantity > 0 ? line.quantity : 1;
    total += price * qty;
  }
  return total;
}
