import { AnnotationApiError } from "../types/annotation.types";
import { withJitter } from "./backoff";

export const DEFAULT_TTL_MS = 30_000;
export const DEFAULT_RETRIES = 2;
export const DEFAULT_RETRY_BASE_MS = 800;
export const DEFAULT_RETRY_MAX_MS = 8_000;

export class ConditionalResult<T> {
  readonly unchanged: boolean;
  readonly data: T | undefined;
  readonly etag: string | null;

  constructor(unchanged: boolean, data: T | undefined, etag: string | null) {
    this.unchanged = unchanged;
    this.data = data;
    this.etag = etag;
  }
}

export function withEtag<T>(data: T, etag: string | null): ConditionalResult<T> {
  return new ConditionalResult(false, data, etag);
}

export function notModified<T = never>(etag: string | null = null): ConditionalResult<T> {
  return new ConditionalResult<T>(true, undefined, etag);
}

export interface FetchContext {
  signal: AbortSignal;
  etag: string | null;
}

export type ResourceFetcher<T> = (
  signal: AbortSignal,
  context: FetchContext,
) => Promise<T | ConditionalResult<T>>;

export interface ResourceSnapshot<T> {
  data: T | undefined;
  hasData: boolean;
  error: unknown;
  isFetching: boolean;
  etag: string | null;
  updatedAt: number;
}

export interface FetchOptions {
  ttlMs?: number;
  force?: boolean;
  retries?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  isRetryable?: (error: unknown) => boolean;
  detached?: boolean;
}

interface Inflight<T> {
  promise: Promise<T | undefined>;
  controller: AbortController;
  detached: boolean;
}

interface Entry<T> {
  snapshot: ResourceSnapshot<T>;
  listeners: Set<() => void>;
  watchers: number;
  inflight: Inflight<T> | null;
}

const entries = new Map<string, Entry<unknown>>();

const EMPTY_SNAPSHOT: ResourceSnapshot<never> = {
  data: undefined,
  hasData: false,
  error: null,
  isFetching: false,
  etag: null,
  updatedAt: 0,
};

export function emptySnapshot<T>(): ResourceSnapshot<T> {
  return EMPTY_SNAPSHOT as ResourceSnapshot<T>;
}

function entryFor<T>(key: string): Entry<T> {
  let entry = entries.get(key) as Entry<T> | undefined;
  if (!entry) {
    entry = { snapshot: emptySnapshot<T>(), listeners: new Set(), watchers: 0, inflight: null };
    entries.set(key, entry as Entry<unknown>);
  }
  return entry;
}

function publish<T>(entry: Entry<T>, patch: Partial<ResourceSnapshot<T>>): void {
  entry.snapshot = { ...entry.snapshot, ...patch };
  for (const listener of [...entry.listeners]) {
    listener();
  }
}

export function readResource<T>(key: string): ResourceSnapshot<T> {
  const entry = entries.get(key) as Entry<T> | undefined;
  return entry ? entry.snapshot : emptySnapshot<T>();
}

export function hasResource(key: string): boolean {
  return readResource(key).hasData;
}

export function isResourceFresh(key: string, ttlMs: number, now: number = Date.now()): boolean {
  const snapshot = readResource(key);
  return snapshot.hasData && now - snapshot.updatedAt < ttlMs;
}

export function isFetchingResource(key: string): boolean {
  return Boolean(entries.get(key)?.inflight);
}

export function subscribeResource(key: string, listener: () => void): () => void {
  const entry = entryFor(key);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

export function watchResource(key: string): () => void {
  const entry = entryFor(key);
  entry.watchers += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.watchers -= 1;
    const inflight = entry.inflight;
    if (entry.watchers <= 0 && inflight && !inflight.detached) {
      inflight.controller.abort();
    }
  };
}

export function writeResource<T>(key: string, data: T, etag: string | null = null): void {
  const entry = entryFor<T>(key);
  publish(entry, {
    data,
    hasData: true,
    error: null,
    etag: etag ?? entry.snapshot.etag,
    updatedAt: Date.now(),
  });
}

export function mutateResource<T>(
  key: string,
  next: T | ((current: T | undefined) => T),
  etag: string | null = null,
): void {
  const current = readResource<T>(key).data;
  const value =
    typeof next === "function" ? (next as (current: T | undefined) => T)(current) : next;
  writeResource(key, value, etag);
}

export function updateResource<T>(key: string, update: (current: T) => T): void {
  const snapshot = readResource<T>(key);
  if (!snapshot.hasData || snapshot.data === undefined) return;
  writeResource(key, update(snapshot.data));
}

export function invalidateResource(key: string): void {
  const entry = entries.get(key);
  if (entry && entry.snapshot.hasData) {
    publish(entry, { updatedAt: 0 });
  }
}

export function invalidateResources(prefix: string): void {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) {
      invalidateResource(key);
    }
  }
}

export function removeResource(key: string): void {
  const entry = entries.get(key);
  if (!entry) return;
  entry.inflight?.controller.abort();
  entry.inflight = null;
  publish(entry, { ...emptySnapshot<unknown>() });
}

export function clearResources(): void {
  for (const entry of entries.values()) {
    entry.inflight?.controller.abort();
  }
  entries.clear();
}

export function isRetryableResourceError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (!(error instanceof AnnotationApiError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof DOMException && error.name === "AbortError");
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function runWithRetry<T>(
  fetcher: ResourceFetcher<T>,
  etag: string | null,
  signal: AbortSignal,
  options: FetchOptions,
): Promise<T | ConditionalResult<T>> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const base = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  const max = options.retryMaxMs ?? DEFAULT_RETRY_MAX_MS;
  const retryable = options.isRetryable ?? isRetryableResourceError;
  let attempt = 0;
  for (;;) {
    try {
      return await fetcher(signal, { signal, etag });
    } catch (error) {
      if (isAbortError(error, signal) || attempt >= retries || !retryable(error)) {
        throw error;
      }
      await sleep(withJitter(Math.min(base * 2 ** attempt, max)), signal);
      attempt += 1;
    }
  }
}

export function fetchResource<T>(
  key: string,
  fetcher: ResourceFetcher<T>,
  options: FetchOptions = {},
): Promise<T | undefined> {
  const entry = entryFor<T>(key);
  if (entry.inflight && entry.inflight.controller.signal.aborted) {
    entry.inflight = null;
  }
  if (entry.inflight) {
    if (options.detached) entry.inflight.detached = true;
    return entry.inflight.promise;
  }
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  if (!options.force && isResourceFresh(key, ttl)) {
    return Promise.resolve(entry.snapshot.data);
  }
  const controller = new AbortController();
  const inflight: Inflight<T> = {
    controller,
    detached: Boolean(options.detached),
    promise: Promise.resolve(undefined),
  };
  entry.inflight = inflight;
  publish(entry, { isFetching: true });
  const etag = entry.snapshot.hasData ? entry.snapshot.etag : null;
  inflight.promise = runWithRetry(fetcher, etag, controller.signal, options).then(
    (result) => {
      if (entry.inflight !== inflight) return entry.snapshot.data;
      entry.inflight = null;
      if (result instanceof ConditionalResult) {
        if (result.unchanged && entry.snapshot.hasData) {
          publish(entry, {
            isFetching: false,
            error: null,
            updatedAt: Date.now(),
            etag: result.etag ?? entry.snapshot.etag,
          });
          return entry.snapshot.data;
        }
        publish(entry, {
          data: result.data as T,
          hasData: true,
          isFetching: false,
          error: null,
          etag: result.etag,
          updatedAt: Date.now(),
        });
        return result.data;
      }
      publish(entry, {
        data: result,
        hasData: true,
        isFetching: false,
        error: null,
        etag: null,
        updatedAt: Date.now(),
      });
      return result;
    },
    (error: unknown) => {
      if (entry.inflight !== inflight) return entry.snapshot.data;
      entry.inflight = null;
      if (isAbortError(error, controller.signal)) {
        publish(entry, { isFetching: false });
        return entry.snapshot.data;
      }
      publish(entry, { isFetching: false, error });
      return entry.snapshot.data;
    },
  );
  return inflight.promise;
}

export function prefetchResource<T>(
  key: string,
  fetcher: ResourceFetcher<T>,
  options: FetchOptions = {},
): Promise<T | undefined> {
  return fetchResource(key, fetcher, { ...options, detached: true });
}
