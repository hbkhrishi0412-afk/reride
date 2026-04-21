import type { User } from '../types';

/** Non-null when the seller has a usable public average rating (1–5). */
export function getPublicDealerRating(seller: User): { average: number; count?: number } | null {
  const raw = seller.averageRating ?? seller.sellerAverageRating;
  const n = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const capped = Math.min(5, Math.max(0, n));
  const countRaw = seller.ratingCount ?? seller.sellerRatingCount;
  const count = typeof countRaw === 'number' && countRaw > 0 ? Math.floor(countRaw) : undefined;
  return { average: Math.round(capped * 10) / 10, count };
}
