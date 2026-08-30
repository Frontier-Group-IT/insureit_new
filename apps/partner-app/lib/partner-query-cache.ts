type QueryCacheEntry<T> = {
  data: T;
  updatedAt: number;
  scopeKey: string;
};

type QueryResult<T> = {
  data: T;
  updatedAt: number;
  fromCache: boolean;
  stale: boolean;
};

const cache = new Map<string, QueryCacheEntry<unknown>>();
const inflight = new Map<string, Promise<QueryResult<unknown>>>();

function scopedKey(scopeKey: string, key: string) {
  return `${scopeKey}::${key}`;
}

export function getPartnerQueryCache<T>(scopeKey: string, key: string) {
  return cache.get(scopedKey(scopeKey, key)) as QueryCacheEntry<T> | undefined;
}

export async function fetchPartnerQuery<T>({
  scopeKey,
  key,
  fetcher,
  staleTimeMs = 60_000,
  force = false,
}: {
  scopeKey: string;
  key: string;
  fetcher: () => Promise<T>;
  staleTimeMs?: number;
  force?: boolean;
}): Promise<QueryResult<T>> {
  const keyWithScope = scopedKey(scopeKey, key);
  const existing = cache.get(keyWithScope) as QueryCacheEntry<T> | undefined;
  const now = Date.now();

  if (!force && existing && now - existing.updatedAt <= staleTimeMs) {
    return {
      data: existing.data,
      updatedAt: existing.updatedAt,
      fromCache: true,
      stale: false,
    };
  }

  const active = inflight.get(keyWithScope) as Promise<QueryResult<T>> | undefined;
  if (active) return active;

  const request = (async () => {
    try {
      const data = await fetcher();
      const updatedAt = Date.now();
      cache.set(keyWithScope, { data, updatedAt, scopeKey });
      return { data, updatedAt, fromCache: false, stale: false };
    } catch (error) {
      if (existing) {
        return {
          data: existing.data,
          updatedAt: existing.updatedAt,
          fromCache: true,
          stale: true,
        };
      }
      throw error;
    } finally {
      inflight.delete(keyWithScope);
    }
  })();

  inflight.set(keyWithScope, request as Promise<QueryResult<unknown>>);
  return request;
}

export function setPartnerQueryCache<T>(scopeKey: string, key: string, data: T) {
  cache.set(scopedKey(scopeKey, key), {
    data,
    updatedAt: Date.now(),
    scopeKey,
  });
}

export function invalidatePartnerQueryCache(scopeKey: string, keyPrefix?: string) {
  for (const key of cache.keys()) {
    const prefix = `${scopeKey}::`;
    if (!key.startsWith(prefix)) continue;
    if (!keyPrefix || key.slice(prefix.length).startsWith(keyPrefix)) cache.delete(key);
  }
}

export function clearPartnerQueryCache(scopeKey?: string) {
  if (!scopeKey) {
    cache.clear();
    inflight.clear();
    return;
  }

  const prefix = `${scopeKey}::`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

export function isLikelyConnectivityError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    message.includes('network request failed')
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('timeout')
    || message.includes('timed out')
    || message.includes('offline')
  );
}
