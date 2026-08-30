import { useCallback, useEffect, useState } from 'react';

import {
  fetchPartnerQuery,
  getPartnerQueryCache,
  invalidatePartnerQueryCache,
  isLikelyConnectivityError,
  setPartnerQueryCache,
} from '@/lib/partner-query-cache';

type PageResult<T> = {
  rows: T[];
  total: number;
};

type Aggregate<T> = {
  rows: T[];
  total: number;
};

export function usePartnerPagedQuery<T>({
  scopeKey,
  key,
  pageSize = 25,
  fetchPage,
  staleTimeMs = 60_000,
}: {
  scopeKey: string;
  key: string;
  pageSize?: number;
  fetchPage: (input: { limit: number; offset: number }) => Promise<PageResult<T>>;
  staleTimeMs?: number;
}) {
  const aggregateKey = `${key}:aggregate`;
  const cached = getPartnerQueryCache<Aggregate<T>>(scopeKey, aggregateKey);
  const [rows, setRows] = useState<T[]>(cached?.data.rows ?? []);
  const [total, setTotal] = useState(cached?.data.total ?? 0);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stale, setStale] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.updatedAt ?? null);

  const storeAggregate = useCallback((nextRows: T[], nextTotal: number, fetchedAt = Date.now()) => {
    setRows(nextRows);
    setTotal(nextTotal);
    setPartnerQueryCache(scopeKey, aggregateKey, { rows: nextRows, total: nextTotal }, fetchedAt);
    setUpdatedAt(fetchedAt);
  }, [aggregateKey, scopeKey]);

  const loadFirst = useCallback(async (force = false) => {
    const existing = getPartnerQueryCache<Aggregate<T>>(scopeKey, aggregateKey);
    if (force && existing) setRefreshing(true);
    else if (!existing) setLoading(true);
    setError('');
    setOffline(false);

    try {
      const result = await fetchPartnerQuery({
        scopeKey,
        key: `${key}:page:0`,
        staleTimeMs,
        force,
        fetcher: () => fetchPage({ limit: pageSize, offset: 0 }),
      });

      storeAggregate(result.data.rows, result.data.total, result.updatedAt);
      setStale(result.stale);
      if (result.stale) {
        setOffline(Boolean(result.fallbackError?.offline));
        setError(result.fallbackError?.message || 'Refresh failed. Showing the last successfully loaded information.');
      }
    } catch (cause) {
      if (existing) {
        setRows(existing.data.rows);
        setTotal(existing.data.total);
        setUpdatedAt(existing.updatedAt);
        setStale(true);
      } else {
        setRows([]);
        setTotal(0);
        setUpdatedAt(null);
      }
      setOffline(isLikelyConnectivityError(cause));
      setError(cause instanceof Error ? cause.message : 'Data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [aggregateKey, fetchPage, key, pageSize, scopeKey, staleTimeMs, storeAggregate]);

  useEffect(() => {
    const existing = getPartnerQueryCache<Aggregate<T>>(scopeKey, aggregateKey);
    if (existing) {
      setRows(existing.data.rows);
      setTotal(existing.data.total);
      setUpdatedAt(existing.updatedAt);
      setLoading(false);
    } else {
      setRows([]);
      setTotal(0);
      setUpdatedAt(null);
      setStale(false);
      setOffline(false);
      setError('');
      setLoading(true);
    }
    void loadFirst(false);
  }, [aggregateKey, loadFirst, scopeKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    setError('');

    try {
      const offset = rows.length;
      const result = await fetchPartnerQuery({
        scopeKey,
        key: `${key}:page:${offset}`,
        staleTimeMs,
        fetcher: () => fetchPage({ limit: pageSize, offset }),
      });
      const combined = [...rows, ...result.data.rows];
      const aggregateFetchedAt = updatedAt ?? result.updatedAt;
      storeAggregate(combined, result.data.total, aggregateFetchedAt);
      setStale(result.stale);
      if (result.stale) {
        setOffline(Boolean(result.fallbackError?.offline));
        setError(result.fallbackError?.message || 'More records could not be refreshed. Showing cached information.');
      }
    } catch (cause) {
      setOffline(isLikelyConnectivityError(cause));
      setError(cause instanceof Error ? cause.message : 'More records could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, key, loadingMore, pageSize, rows, scopeKey, staleTimeMs, storeAggregate, total, updatedAt]);

  const refresh = useCallback(async () => {
    invalidatePartnerQueryCache(scopeKey, key);
    await loadFirst(true);
  }, [key, loadFirst, scopeKey]);

  return {
    rows,
    total,
    loading,
    refreshing,
    loadingMore,
    stale,
    offline,
    error,
    updatedAt,
    refresh,
    loadMore,
  };
}
