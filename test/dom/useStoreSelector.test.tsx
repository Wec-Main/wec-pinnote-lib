import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStoreSelector } from "../../src/hooks/useStoreSelector";
import { Store } from "../../src/utils/flowchart/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface DemoState {
  count: number;
}

function shallowArrayEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// A selector that allocates a brand-new array only on its first call, then
// settles on a stable reference — otherwise, since React's
// useSyncExternalStore reruns an unstable getSnapshot forever, a selector
// that *always* returns a fresh reference crashes the real renderer with
// "Maximum update depth exceeded" before this hook's own dev warning is
// ever useful. This fixture reproduces exactly the one-time mismatch the
// warning targets (a freshly-computed value from otherwise-unchanged
// state) without making React spin forever.
function makeSettlingSelector(getCount: () => number) {
  let calls = 0;
  let settled: number[] | null = null;
  return (): number[] => {
    calls += 1;
    if (calls === 1) {
      return [getCount()];
    }
    if (!settled) {
      settled = [getCount()];
    }
    return settled;
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useStoreSelector dev-mode warning", () => {
  it("warns once when the selector returns a new reference from otherwise-unchanged state", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = new Store<DemoState>({ count: 1 });
    const selector = makeSettlingSelector(() => store.getState().count);

    function Harness() {
      const ids = useStoreSelector(store, () => selector());
      return createElement("output", null, ids.join(","));
    }

    act(() => root.render(createElement(Harness)));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("useStoreSelector");

    warnSpy.mockRestore();
  });

  it("does not warn when a shallow-equality function is supplied", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = new Store<DemoState>({ count: 1 });

    function Harness() {
      useStoreSelector(store, (s) => [s.count], shallowArrayEqual);
      return null;
    }

    act(() => root.render(createElement(Harness)));
    act(() => root.render(createElement(Harness)));
    act(() => root.render(createElement(Harness)));

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("does not warn, and still updates, for a primitive selector when the store state changes", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = new Store<DemoState>({ count: 1 });
    let latest = 0;

    function Harness() {
      latest = useStoreSelector(store, (s) => s.count);
      return null;
    }

    act(() => root.render(createElement(Harness)));
    act(() => store.setState({ count: 2 }));

    expect(latest).toBe(2);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
