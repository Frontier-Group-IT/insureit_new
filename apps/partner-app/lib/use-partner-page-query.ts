import { useCallback, useEffect, useState } from 'react';

import {
  fetchPartnerQuery,
  invalidatePartnerQueryCache,
  isLikelyConnectivityError,
} from '@/lib/partner-query-cache';

type PageResult<T> = {
  rows: T[];
  total: number;
};

export function usePartnerPageQuery<T>({
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
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changingPage, setChangingPage] = useState(false);
  const [stale, setStale] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const loadPage = useCallback(async (nextPageIndex: number, force = false, pageChange = false) => {
    if (pageChange) setChangingPage(true);
    else if (force) setRefreshing(true);
    else setLoading(true);

    setError('');
    setOffline(false);

    const offset = nextPageIndex * pageSize;
    try {
      const result = await fetchPartnerQuery({
        scopeKey,
        key: `${key}:page:${offset}`,
        staleTimeMs,
        force,
        fetcher: () => fetchPage({ limit: pageSize, offset }),
      });

      setRows(result.data.rows);
      setTotal(result.data.total);
      setPageIndex(nextPageIndex);
      setUpdatedAt(result.updatedAt);
      setStale(result.stale);
      if (result.stale) {
        setOffline(Boolean(result.fallbackError?.offline));
        setError(result.fallbackError?.message || 'Refresh failed. Showing cached information.');
      }
    } catch (cause) {
      setOffline(isLikelyConnectivityError(cause));
      setError(cause instanceof Error ? cause.message : 'Data could not be loaded.');
      if (!pageChange) {
        setRows([]);
        setTotal(0);
        setUpdatedAt(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setChangingPage(false);
    }
  }, [fetchPage, key, pageSize, scopeKey, staleTimeMs]);

  useEffect(() => {
    setPageIndex(0);
    void loadPage(0, false, false);
  }, [key, loadPage]);

  const refresh = useCallback(async () => {
    invalidatePartnerQueryCache(scopeKey, key);
    await loadPage(pageIndex, true, false);
  }, [key, loadPage, pageIndex, scopeKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previousPage = useCallback(() => {
    if (pageIndex <= 0 || changingPage) return;
    void loadPage(pageIndex - 1, false, true);
  }, [changingPage, loadPage, pageIndex]);
  const nextPage = useCallback(() => {
    if (pageIndex + 1 >= totalPages || changingPage) return;
    void loadPage(pageIndex + 1, false, true);
  }, [changingPage, loadPage, pageIndex, totalPages]);

  return {
    rows,
    total,
    page: pageIndex + 1,
    totalPages,
    pageSize,
    loading,
    refreshing,
    changingPage,
    stale,
    offline,
    error,
    updatedAt,
    refresh,
    previousPage,
    nextPage,
  };
}
