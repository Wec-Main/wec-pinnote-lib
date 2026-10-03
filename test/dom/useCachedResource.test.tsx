import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCachedResource,
  type CachedResource,
  type UseCachedResourceOptions,
} from "../../src/hooks/useCachedResource";
import { AnnotationApiError } from "../../src/types/annotation.types";
import { readResource, writeResource } from "../../src/utils/resourceCache";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let latest: CachedResource<string>;

interface Deferred {
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}

function deferred(): { promise: Promise<string> } & Deferred {
  let resolve!: (value: string) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe(props: {
  cacheKey: string | null;
  fetcher: () => Promise<string>;
  options?: UseCachedResourceOptions<string>;
}) {
  latest = useCachedResource<string>(props.cacheKey, props.fetcher, {
    retries: 0,
    ...props.options,
  });
  return null;
}

function render(props: Parameters<typeof Probe>[0]) {
  act(() => root.render(createElement(Probe, props)));
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useCachedResource", () => {
  it("is loading without data then resolves", async () => {
    const d = deferred();
    render({ cacheKey: "a", fetcher: () => d.promise });
    expect(latest.isLoading).toBe(true);
    expect(latest.data).toBeUndefined();
    d.resolve("one");
    await settle();
    expect(latest.isLoading).toBe(false);
    expect(latest.data).toBe("one");
  });

  it("de-duplicates across two consumers of the same key", async () => {
    const fetcher = vi.fn(async () => "x");
    act(() =>
      root.render(
        createElement(
          "div",
          null,
          createElement(Probe, { cacheKey: "dup", fetcher }),
          createElement(Probe, { cacheKey: "dup", fetcher }),
        ),
      ),
    );
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves cached data instantly and revalidates in the background", async () => {
    writeResource("a", "stale");
    vi.advanceTimersByTime(60_000);
    const d = deferred();
    render({ cacheKey: "a", fetcher: () => d.promise });
    expect(latest.data).toBe("stale");
    expect(latest.isLoading).toBe(false);
    expect(latest.isRefreshing).toBe(true);
    d.resolve("fresh");
    await settle();
    expect(latest.data).toBe("fresh");
    expect(latest.isRefreshing).toBe(false);
  });

  it("does not refetch while within ttl", async () => {
    writeResource("a", "cached");
    const fetcher = vi.fn(async () => "new");
    render({ cacheKey: "a", fetcher, options: { ttlMs: 10_000 } });
    await settle();
    expect(fetcher).not.toHaveBeenCalled();
    expect(latest.data).toBe("cached");
  });

  it("keeps data and exposes error when a revalidation fails", async () => {
    writeResource("a", "good");
    vi.advanceTimersByTime(60_000);
    render({
      cacheKey: "a",
      fetcher: async () => {
        throw new AnnotationApiError("boom", 400, null);
      },
    });
    await settle();
    expect(latest.data).toBe("good");
    expect(latest.error).toBeInstanceOf(AnnotationApiError);
    expect(latest.isLoading).toBe(false);
  });

  it("reports an error with no data as not loading", async () => {
    render({
      cacheKey: "a",
      fetcher: async () => {
        throw new AnnotationApiError("boom", 400, null);
      },
    });
    await settle();
    expect(latest.data).toBeUndefined();
    expect(latest.isLoading).toBe(false);
    expect(latest.error).toBeTruthy();
  });

  it("keeps previous data while the key changes when keepPrevious is set", async () => {
    render({ cacheKey: "a", fetcher: async () => "A", options: { keepPrevious: true } });
    await settle();
    const d = deferred();
    render({ cacheKey: "b", fetcher: () => d.promise, options: { keepPrevious: true } });
    expect(latest.data).toBe("A");
    expect(latest.isPlaceholder).toBe(true);
    expect(latest.isRefreshing).toBe(true);
    expect(latest.isLoading).toBe(false);
    d.resolve("B");
    await settle();
    expect(latest.data).toBe("B");
    expect(latest.isPlaceholder).toBe(false);
  });

  it("drops previous data on key change without keepPrevious", async () => {
    render({ cacheKey: "a", fetcher: async () => "A" });
    await settle();
    const d = deferred();
    render({ cacheKey: "b", fetcher: () => d.promise });
    expect(latest.data).toBeUndefined();
    expect(latest.isLoading).toBe(true);
  });

  it("uses initialData without loading and still revalidates", async () => {
    const fetcher = vi.fn(async () => "server");
    render({ cacheKey: "a", fetcher, options: { initialData: "seed" } });
    expect(latest.data).toBe("seed");
    expect(latest.isLoading).toBe(false);
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(latest.data).toBe("server");
  });

  it("refresh forces a refetch and mutate updates the cache", async () => {
    let n = 0;
    const fetcher = vi.fn(async () => `v${++n}`);
    render({ cacheKey: "a", fetcher });
    await settle();
    await act(async () => {
      await latest.refresh();
    });
    expect(latest.data).toBe("v2");
    act(() => latest.mutate("manual"));
    expect(latest.data).toBe("manual");
    expect(readResource("a").data).toBe("manual");
  });

  it("revalidates on focus once stale", async () => {
    const fetcher = vi.fn(async () => "x");
    render({ cacheKey: "a", fetcher, options: { ttlMs: 1000 } });
    await settle();
    act(() => void window.dispatchEvent(new Event("focus")));
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1500);
    act(() => void window.dispatchEvent(new Event("focus")));
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("aborts in-flight work on unmount", async () => {
    let aborted = false;
    const signalFetcher = (signal: AbortSignal) => {
      signal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise<string>(() => undefined);
    };
    act(() =>
      root.render(
        createElement(() => {
          useCachedResource<string>("sig", (signal) => signalFetcher(signal), { retries: 0 });
          return null;
        }),
      ),
    );
    act(() => root.unmount());
    expect(aborted).toBe(true);
    root = createRoot(container);
  });
});
