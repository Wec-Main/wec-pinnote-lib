import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearResources,
  fetchResource,
  invalidateResource,
  isResourceFresh,
  mutateResource,
  notModified,
  prefetchResource,
  readResource,
  removeResource,
  subscribeResource,
  withEtag,
  updateResource,
  watchResource,
  writeResource,
} from "../src/utils/resourceCache";
import { RequestTimeoutError, withRequestTimeout } from "../src/utils/requestTimeout";
import { AnnotationApiError } from "../src/types/annotation.types";

beforeEach(() => {
  vi.useFakeTimers();
  clearResources();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resourceCache", () => {
  it("de-duplicates concurrent requests for one key", async () => {
    const fetcher = vi.fn(async () => "value");
    const [a, b] = await Promise.all([fetchResource("k", fetcher), fetchResource("k", fetcher)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toBe("value");
    expect(b).toBe("value");
    expect(readResource("k").data).toBe("value");
  });

  it("serves fresh data without refetching and refetches once stale", async () => {
    const fetcher = vi.fn(async () => Date.now());
    await fetchResource("k", fetcher, { ttlMs: 1000 });
    await fetchResource("k", fetcher, { ttlMs: 1000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    expect(isResourceFresh("k", 1000)).toBe(false);
    await fetchResource("k", fetcher, { ttlMs: 1000 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("force bypasses ttl and invalidate marks stale", async () => {
    const fetcher = vi.fn(async () => 1);
    await fetchResource("k", fetcher);
    await fetchResource("k", fetcher, { force: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    invalidateResource("k");
    await fetchResource("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("keeps previous data when a revalidation fails", async () => {
    await fetchResource("k", async () => "good");
    await fetchResource(
      "k",
      async () => {
        throw new AnnotationApiError("nope", 400, null);
      },
      { force: true },
    );
    const snapshot = readResource<string>("k");
    expect(snapshot.data).toBe("good");
    expect(snapshot.error).toBeInstanceOf(AnnotationApiError);
    expect(snapshot.isFetching).toBe(false);
  });

  it("retries retryable errors with backoff then succeeds", async () => {
    let attempts = 0;
    const promise = fetchResource(
      "k",
      async () => {
        attempts += 1;
        if (attempts < 3) throw new AnnotationApiError("down", 503, null);
        return "ok";
      },
      { retries: 3, retryBaseMs: 100 },
    );
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).resolves.toBe("ok");
    expect(attempts).toBe(3);
    expect(readResource("k").error).toBeNull();
  });

  it("does not retry client errors", async () => {
    const fetcher = vi.fn(async () => {
      throw new AnnotationApiError("forbidden", 403, null);
    });
    await fetchResource("k", fetcher, { retries: 3, retryBaseMs: 10 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readResource("k").error).toBeInstanceOf(AnnotationApiError);
  });

  it("stores etag and treats not-modified as unchanged", async () => {
    await fetchResource("k", async () => withEtag([1, 2], '"v1"'));
    expect(readResource("k").etag).toBe('"v1"');
    const seen: Array<string | null> = [];
    await fetchResource(
      "k",
      async (_signal, ctx) => {
        seen.push(ctx.etag);
        return notModified<number[]>('"v1"');
      },
      { force: true },
    );
    expect(seen).toEqual(['"v1"']);
    expect(readResource("k").data).toEqual([1, 2]);
    expect(readResource("k").error).toBeNull();
  });

  it("aborts a hook-owned request when the last watcher leaves", async () => {
    let aborted = false;
    const release = watchResource("k");
    void fetchResource(
      "k",
      (signal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(aborted).toBe(true);
    expect(readResource("k").isFetching).toBe(false);
    expect(readResource("k").error).toBeNull();
  });

  it("starts a new request when the previous one was aborted by the last watcher leaving", async () => {
    const release = watchResource("k");
    void fetchResource(
      "k",
      (signal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    release();
    const again = watchResource("k");
    const second = vi.fn(async () => "fresh");
    const result = fetchResource("k", second);
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toBe("fresh");
    expect(second).toHaveBeenCalledTimes(1);
    expect(readResource("k").data).toBe("fresh");
    again();
  });

  it("update only changes a loaded resource", () => {
    updateResource<number>("k", (current) => current + 1);
    expect(readResource("k").hasData).toBe(false);
    writeResource("k", 1);
    updateResource<number>("k", (current) => current + 1);
    expect(readResource("k").data).toBe(2);
  });

  it("times out a request that never settles and aborts it", async () => {
    const outer = new AbortController();
    let inner: AbortSignal | null = null;
    const pending = withRequestTimeout(
      outer.signal,
      1000,
      (signal) =>
        new Promise<string>(() => {
          inner = signal;
        }),
    );
    const caught = pending.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await caught).toBeInstanceOf(RequestTimeoutError);
    expect((inner as AbortSignal | null)?.aborted).toBe(true);
  });

  it("does not abort prefetches when watchers leave", async () => {
    const release = watchResource("k");
    const promise = prefetchResource("k", async () => "warm");
    release();
    await expect(promise).resolves.toBe("warm");
  });

  it("mutate writes through functional updates", () => {
    writeResource("k", 1);
    mutateResource<number>("k", (current) => (current ?? 0) + 1);
    expect(readResource("k").data).toBe(2);
  });

  it("keeps a still-subscribed entry alive after removeResource clears its data", () => {
    writeResource("k", "first");
    const seen: unknown[] = [];
    const unsubscribe = subscribeResource("k", () => {
      seen.push(readResource("k").data);
    });

    removeResource("k");
    expect(readResource("k").hasData).toBe(false);

    writeResource("k", "second");
    expect(readResource("k").data).toBe("second");
    expect(seen).toContain("second");

    unsubscribe();
  });

  it("caps the number of cached entries to avoid unbounded growth", async () => {
    const total = 505;
    for (let i = 0; i < total; i += 1) {
      await fetchResource(`cap-${i}`, async () => i);
    }
    expect(readResource("cap-0").hasData).toBe(false);
    expect(readResource(`cap-${total - 1}`).hasData).toBe(true);
  });
});
