import { useCallback, useEffect, useRef, useState } from "react";

interface CacheEntry<T> {
  promise: Promise<T>;
  controller: AbortController;
  subscribers: number;
  result?: { value: T } | { error: unknown };
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * A failed fetch is never stored as `result` here: a cached success is safe to
 * replay to new subscribers, but a cached failure (a 401 from a since-fixed
 * auth gate, a transient 500) would otherwise be served forever to everyone
 * who asks for this key, with no way for the app to know the underlying
 * condition has changed. Dropping the cache entry on failure means the next
 * subscriber, or the next mount of the same one, naturally retries instead.
 */
function startFetch<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>): CacheEntry<T> {
  const controller = new AbortController();
  const entry: CacheEntry<T> = { controller, subscribers: 0, promise: Promise.resolve() as never };
  entry.promise = fetcher(controller.signal)
    .then((value) => {
      entry.result = { value };
      return value;
    })
    .catch((error: unknown) => {
      if (cache.get(key) === (entry as CacheEntry<unknown>)) {
        cache.delete(key);
      }
      entry.result = { error };
      throw error;
    });
  cache.set(key, entry as CacheEntry<unknown>);
  return entry;
}

/**
 * Several unrelated components (a settings table, a filter dropdown, a form
 * picker) often need the same read-only list at once. Without sharing, each
 * one fires its own request for identical data. Subscribers to the same key
 * share one in-flight request and its result; the request is only aborted
 * once the last subscriber leaves before it settles, and `reload` forces a
 * fresh fetch for everyone currently subscribed.
 */
export function useSharedFetch<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
): { data: T | null; loading: boolean; error: unknown; reload: () => void } {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [, forceRender] = useState(0);
  const dataRef = useRef<T | null>(null);
  const errorRef = useRef<unknown>(null);
  const loadingRef = useRef(false);

  const applyEntry = useCallback((entry: CacheEntry<unknown>) => {
    if (entry.result && "value" in entry.result) {
      dataRef.current = entry.result.value as T;
      errorRef.current = null;
      loadingRef.current = false;
    } else if (entry.result && "error" in entry.result) {
      errorRef.current = entry.result.error;
      loadingRef.current = false;
    } else {
      loadingRef.current = true;
    }
    forceRender((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!key) {
      return;
    }
    let cancelled = false;
    let entry = cache.get(key);
    if (!entry) {
      entry = startFetch(key, fetcherRef.current) as CacheEntry<unknown>;
    }
    entry.subscribers += 1;
    applyEntry(entry);

    entry.promise.then(
      () => {
        if (!cancelled) {
          applyEntry(cache.get(key) ?? entry!);
        }
      },
      () => {
        if (!cancelled) {
          applyEntry(cache.get(key) ?? entry!);
        }
      },
    );

    return () => {
      cancelled = true;
      const current = cache.get(key);
      if (!current) {
        return;
      }
      current.subscribers -= 1;
      if (current.subscribers <= 0 && !current.result) {
        current.controller.abort();
        cache.delete(key);
      }
    };
  }, [key, applyEntry]);

  const reload = useCallback(() => {
    if (!key) {
      return;
    }
    const existing = cache.get(key);
    const subscribers = existing?.subscribers ?? 1;
    if (existing) {
      cache.delete(key);
    }
    const entry = startFetch(key, fetcherRef.current) as CacheEntry<unknown>;
    entry.subscribers = subscribers;
    applyEntry(entry);
    entry.promise.then(
      () => applyEntry(cache.get(key) ?? entry),
      () => applyEntry(cache.get(key) ?? entry),
    );
  }, [key, applyEntry]);

  return {
    data: dataRef.current,
    loading: loadingRef.current,
    error: errorRef.current,
    reload,
  };
}

export function invalidateSharedFetch(key: string): void {
  const entry = cache.get(key);
  if (!entry) {
    return;
  }
  if (entry.subscribers <= 0) {
    entry.controller.abort();
  }
  cache.delete(key);
}
