import { useQuery } from '@tanstack/react-query';
import type { StorefrontDiscoveryAggregates } from '../types';
import { dataService } from '../services/dataService';

const EMPTY: StorefrontDiscoveryAggregates = { categories: {}, cities: {} };

/**
 * Cached storefront discovery counts (category / city). Merges with empty object when the endpoint is absent so UI can fall back to client-side counts.
 */
export function useStorefrontAggregates() {
  return useQuery({
    queryKey: ['storefrontAggregates'],
    queryFn: async () => {
      const res = await dataService.getStorefrontAggregates();
      return res ?? EMPTY;
    },
    staleTime: 120_000,
    gcTime: 600_000,
    retry: 1,
  });
}
