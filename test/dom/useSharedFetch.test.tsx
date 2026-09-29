import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { invalidateSharedFetch, useSharedFetch } from "../../src/hooks/useSharedFetch";

let calls = 0;
let reloadFromHook: () => void = () => undefined;

function Probe({ cacheKey }: { cacheKey: string }) {
  const { data, reload } = useSharedFetch<number>(cacheKey, async () => {
    calls += 1;
    return calls;
  });
  reloadFromHook = reload;
  return createElement("output", null, data === null ? "empty" : String(data));
}

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  calls = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useSharedFetch", () => {
  it("delivers fresh data to a mounted subscriber when its key is invalidated", async () => {
    act(() => root.render(createElement(Probe, { cacheKey: "invalidate-case" })));
    await flush();
    expect(container.textContent).toBe("1");

    act(() => invalidateSharedFetch("invalidate-case"));
    await flush();
    expect(container.textContent).toBe("2");
  });

  it("still updates on reload right after an invalidation", async () => {
    act(() => root.render(createElement(Probe, { cacheKey: "invalidate-then-reload" })));
    await flush();

    act(() => {
      invalidateSharedFetch("invalidate-then-reload");
      reloadFromHook();
    });
    await flush();
    expect(container.textContent).toBe("3");
  });
});
