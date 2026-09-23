import { useCallback, useEffect, useRef, useState } from "react";

interface CacheEntry<T> {
  promise: Promise<T>;
  controller: AbortController;
  subscribers: Set<(entry: CacheEntry<unknown>) => void>;
  result?: { value: T } | { error: unknown };
}

const cache = new Map<string, CacheEntry<unknown>>();

function evictIfSettled(key: string, entry: CacheEntry<unknown>): void {
  if (cache.get(key) === entry && entry.subscribers.size === 0) {
    cache.delete(key);
  }
}

function notifySubscribers(entry: CacheEntry<unknown>): void {
  for (const notify of entry.subscribers) {
    notify(entry);
  }
}

function settle(key: string, entry: CacheEntry<unknown>, result: CacheEntry<unknown>["result"]): void {
  if (entry.controller.signal.aborted) {
    return;
  }
  entry.result = result;
  notifySubscribers(entry);
  evictIfSettled(key, entry);
}

function startFetch<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>): CacheEntry<unknown> {
  const controller = new AbortController();
  const promise = fetcher(controller.signal);
  const entry: CacheEntry<unknown> = { controller, subscribers: new Set(), promise };
  promise.then(
    (value) => settle(key, entry, { value }),
    (error: unknown) => settle(key, entry, { error }),
  );
  cache.set(key, entry);
  return entry;
}

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
    const joinedKey = key;
    let entry = cache.get(joinedKey);
    if (!entry) {
      entry = startFetch(joinedKey, fetcherRef.current);
    }
    let owner = entry;
    const notify = (next: CacheEntry<unknown>) => {
      owner = next;
      applyEntry(next);
    };
    owner.subscribers.add(notify);
    applyEntry(owner);

    return () => {
      owner.subscribers.delete(notify);
      if (owner.subscribers.size === 0 && !owner.result) {
        owner.controller.abort();
        if (cache.get(joinedKey) === owner) {
          cache.delete(joinedKey);
        }
      } else {
        evictIfSettled(joinedKey, owner);
      }
    };
  }, [key, applyEntry]);

  const reload = useCallback(() => {
    if (!key) {
      return;
    }
    const existing = cache.get(key);
    existing?.controller.abort();
    const entry = startFetch(key, fetcherRef.current);
    if (existing) {
      entry.subscribers = existing.subscribers;
    }
    notifySubscribers(entry);
  }, [key]);

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
  if (entry.subscribers.size === 0) {
    entry.controller.abort();
  }
  cache.delete(key);
}
