import { useCallback, useEffect, useState } from 'react';
import type { DealLead } from '../types';
import { fetchMyDealLeads } from '../services/dealService';

let cachedLeads: DealLead[] | null = null;
let cacheTimestamp = 0;
let inflight: Promise<DealLead[]> | null = null;

const CACHE_TTL_MS = 30_000;

export function invalidateMyDealLeadsCache(): void {
  cachedLeads = null;
  cacheTimestamp = 0;
}

export function useMyDealLeads() {
  const [leads, setLeads] = useState<DealLead[]>(cachedLeads ?? []);
  const [loading, setLoading] = useState(cachedLeads === null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedLeads && now - cacheTimestamp < CACHE_TTL_MS) {
      setLeads(cachedLeads);
      setLoading(false);
      setError(null);
      return cachedLeads;
    }

    if (!inflight) {
      inflight = fetchMyDealLeads()
        .then((rows) => {
          cachedLeads = rows;
          cacheTimestamp = Date.now();
          return rows;
        })
        .finally(() => {
          inflight = null;
        });
    }

    setLoading(true);
    setError(null);
    try {
      const rows = await inflight;
      setLeads(rows);
      return rows;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load deals';
      setError(message);
      setLeads([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeLeads = leads.filter((l) => l.status === 'active');

  return {
    leads,
    activeLeads,
    activeCount: activeLeads.length,
    loading,
    error,
    reload: () => load(true),
  };
}
