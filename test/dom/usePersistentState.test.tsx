import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePersistentState } from "../../src/hooks/usePersistentState";
import { isBoolean } from "../../src/utils/valueGuards";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = "wpn-test:flag";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

describe("usePersistentState", () => {
  it("renders the persisted value on the very first paint, with no fallback flash", () => {
    window.localStorage.setItem(KEY, "true");
    const seenValues: boolean[] = [];

    function Harness() {
      const [value] = usePersistentState(KEY, false, isBoolean);
      seenValues.push(value);
      return createElement("output", null, String(value));
    }

    act(() => root.render(createElement(Harness)));

    // Every render this hook ever produced should already show the
    // persisted value — the fallback must never have been rendered first.
    expect(seenValues.length).toBeGreaterThan(0);
    expect(seenValues.every((value) => value === true)).toBe(true);
    expect(container.textContent).toBe("true");
  });

  it("falls back to the given default when nothing is stored", () => {
    function Harness() {
      const [value] = usePersistentState(KEY, false, isBoolean);
      return createElement("output", null, String(value));
    }

    act(() => root.render(createElement(Harness)));
    expect(container.textContent).toBe("false");
  });

  it("falls back when the stored value fails validation", () => {
    window.localStorage.setItem(KEY, JSON.stringify("not-a-boolean"));

    function Harness() {
      const [value] = usePersistentState(KEY, false, isBoolean);
      return createElement("output", null, String(value));
    }

    act(() => root.render(createElement(Harness)));
    expect(container.textContent).toBe("false");
  });

  it("persists updates so a later mount for the same key picks them up immediately", () => {
    function Harness() {
      const [value, setValue] = usePersistentState(KEY, false, isBoolean);
      return createElement("button", { onClick: () => setValue(!value) }, String(value));
    }

    act(() => root.render(createElement(Harness)));
    const button = () => container.querySelector("button") as HTMLButtonElement;
    act(() => button().click());
    expect(button().textContent).toBe("true");

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(createElement(Harness)));

    expect(button().textContent).toBe("true");
  });
});
