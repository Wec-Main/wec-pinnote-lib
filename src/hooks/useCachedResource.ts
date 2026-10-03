import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  DEFAULT_TTL_MS,
  emptySnapshot,
  fetchResource,
  isResourceFresh,
  mutateResource,
  updateResource,
  readResource,
  subscribeResource,
  watchResource,
  type FetchOptions,
  type ResourceFetcher,
  type ResourceSnapshot,
} from "../utils/resourceCache";
import { useSkeletonGate, type SkeletonGateOptions } from "./useSkeletonGate";

export interface UseCachedResourceOptions<T> extends SkeletonGateOptions {
  enabled?: boolean;
  ttlMs?: number;
  initialData?: T;
  keepPrevious?: boolean;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  retries?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

export interface CachedResource<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isRefreshing: boolean;
  showSkeleton: boolean;
  isPlaceholder: boolean;
  refresh: () => Promise<T | undefined>;
  mutate: (next: T | ((current: T | undefined) => T)) => void;
  update: (change: (current: T) => T) => void;
}

const NEVER = () => () => undefined;

export function useCachedResource<T>(
  key: string | null,
  fetcher: ResourceFetcher<T>,
  options: UseCachedResourceOptions<T> = {},
): CachedResource<T> {
  const {
    enabled = true,
    ttlMs = DEFAULT_TTL_MS,
    initialData,
    keepPrevious = false,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    retries,
    retryBaseMs,
    retryMaxMs,
    isRetryable,
    delayMs,
    minMs,
  } = options;
  const active = enabled && key !== null;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const fetchOptions = useRef<FetchOptions>({});
  fetchOptions.current = { ttlMs, retries, retryBaseMs, retryMaxMs, isRetryable };

  const subscribe = useCallback(
    (listener: () => void) => (key === null ? NEVER() : subscribeResource(key, listener)),
    [key],
  );
  const getSnapshot = useCallback(
    (): ResourceSnapshot<T> => (key === null ? emptySnapshot<T>() : readResource<T>(key)),
    [key],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const previousRef = useRef<T | undefined>(undefined);
  const hasPreviousRef = useRef(false);
  if (snapshot.hasData) {
    previousRef.current = snapshot.data;
    hasPreviousRef.current = true;
  }

  const run = useCallback(
    (force: boolean) => {
      if (key === null) return Promise.resolve(undefined);
      return fetchResource<T>(key, (signal, ctx) => fetcherRef.current(signal, ctx), {
        ...fetchOptions.current,
        force,
      });
    },
    [key],
  );

  useEffect(() => {
    if (!active || key === null) return undefined;
    const release = watchResource(key);
    void run(false);
    return release;
  }, [active, key, run]);

  useEffect(() => {
    if (!active || key === null) return undefined;
    const revalidate = () => {
      if (!isResourceFresh(key, fetchOptions.current.ttlMs ?? DEFAULT_TTL_MS)) {
        void run(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    if (revalidateOnFocus) {
      window.addEventListener("focus", revalidate);
      document.addEventListener("visibilitychange", onVisible);
    }
    if (revalidateOnReconnect) {
      window.addEventListener("online", revalidate);
    }
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", revalidate);
    };
  }, [active, key, run, revalidateOnFocus, revalidateOnReconnect]);

  const refresh = useCallback(() => run(true), [run]);

  const mutate = useCallback(
    (next: T | ((current: T | undefined) => T)) => {
      if (key !== null) mutateResource<T>(key, next);
    },
    [key],
  );

  const update = useCallback(
    (change: (current: T) => T) => {
      if (key !== null) updateResource<T>(key, change);
    },
    [key],
  );

  const settledEmpty = !snapshot.hasData && !snapshot.isFetching && !snapshot.error;
  useEffect(() => {
    if (!active || key === null || !settledEmpty) return;
    void run(false);
  }, [active, key, run, settledEmpty]);

  const ownData = snapshot.hasData;
  const usePrevious = !ownData && keepPrevious && hasPreviousRef.current;
  const seeded = !ownData && !usePrevious && initialData !== undefined;
  const data = ownData
    ? snapshot.data
    : usePrevious
      ? previousRef.current
      : seeded
        ? initialData
        : undefined;
  const hasAny = ownData || usePrevious || seeded;
  const isLoading = active && !hasAny && !snapshot.error;
  const isRefreshing = active && hasAny && (snapshot.isFetching || usePrevious);
  const showSkeleton = useSkeletonGate(isLoading, { delayMs, minMs });

  return {
    data,
    error: snapshot.error,
    isLoading,
    isRefreshing,
    showSkeleton,
    isPlaceholder: usePrevious || seeded,
    refresh,
    mutate,
    update,
  };
}
