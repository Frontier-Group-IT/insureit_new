import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchPartnerQuery,
  getPartnerQueryCache,
  isLikelyConnectivityError,
} from '@/lib/partner-query-cache';

export type PartnerQueryState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  offline: boolean;
  error: string;
  updatedAt: number | null;
  refresh: () => Promise<void>;
};

export function usePartnerQuery<T>({
  scopeKey,
  key,
  fetcher,
  staleTimeMs = 60_000,
  enabled = true,
}: {
  scopeKey: string;
  key: string;
  fetcher: () => Promise<T>;
  staleTimeMs?: number;
  enabled?: boolean;
}): PartnerQueryState<T> {
  const cached = useMemo(
    () => (enabled ? getPartnerQueryCache<T>(scopeKey, key) : undefined),
    [enabled, key, scopeKey],
  );
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(enabled && !cached);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.updatedAt ?? null);

  const run = useCallback(async (force: boolean) => {
    if (!enabled) return;

    const current = getPartnerQueryCache<T>(scopeKey, key);
    if (!current) setLoading(true);
    else setRefreshing(true);
    setError('');
    setOffline(false);

    try {
      const result = await fetchPartnerQuery({
        scopeKey,
        key,
        fetcher,
        staleTimeMs,
        force,
      });
      setData(result.data);
      setUpdatedAt(result.updatedAt);
      setStale(result.stale);
      if (result.stale) {
        setOffline(Boolean(result.fallbackError?.offline));
        setError(result.fallbackError?.message || 'Refresh failed. Showing the last successfully loaded information.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Data could not be loaded.');
      setOffline(isLikelyConnectivityError(cause));
      setStale(false);
      setData(null);
      setUpdatedAt(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, fetcher, key, scopeKey, staleTimeMs]);

  useEffect(() => {
    if (!enabled) return;
    const current = getPartnerQueryCache<T>(scopeKey, key);
    if (current) {
      setData(current.data);
      setUpdatedAt(current.updatedAt);
      setLoading(false);
    }
    void run(false);
  }, [enabled, key, run, scopeKey]);

  const refresh = useCallback(() => run(true), [run]);

  return { data, loading, refreshing, stale, offline, error, updatedAt, refresh };
}
