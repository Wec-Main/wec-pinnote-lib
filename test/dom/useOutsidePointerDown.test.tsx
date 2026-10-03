import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutsidePointerDown } from "../../src/hooks/useOutsidePointerDown";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let outsideCount = 0;

function Harness({ renderNonce, active = true }: { renderNonce: number; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // A fresh closure every render, matching real call sites (e.g.
  // useComboboxList passes `() => setOpen(false)` inline).
  useOutsidePointerDown(
    ref,
    () => {
      outsideCount += 1;
    },
    active,
  );
  return createElement("div", { ref, "data-nonce": renderNonce }, "inside");
}

function firePointerDown(target: Element) {
  const event = new PointerEvent("pointerdown", { bubbles: true });
  Object.defineProperty(event, "target", { value: target });
  document.dispatchEvent(event);
}

beforeEach(() => {
  outsideCount = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useOutsidePointerDown", () => {
  it("keeps a single document listener across re-renders with a new callback each time", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    act(() => root.render(createElement(Harness, { renderNonce: 0 })));
    for (let i = 1; i <= 5; i += 1) {
      act(() => root.render(createElement(Harness, { renderNonce: i })));
    }

    const adds = addSpy.mock.calls.filter((args) => args[0] === "pointerdown").length;
    const removes = removeSpy.mock.calls.filter((args) => args[0] === "pointerdown").length;

    expect(adds).toBe(1);
    expect(removes).toBe(0);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("still invokes the latest callback on an outside pointerdown after re-renders", () => {
    act(() => root.render(createElement(Harness, { renderNonce: 0 })));
    act(() => root.render(createElement(Harness, { renderNonce: 1 })));

    firePointerDown(document.body);
    expect(outsideCount).toBe(1);
  });

  it("does not invoke the callback for a pointerdown inside the ref", () => {
    act(() => root.render(createElement(Harness, { renderNonce: 0 })));
    const inside = container.querySelector("div[data-nonce]") as HTMLElement;
    firePointerDown(inside);
    expect(outsideCount).toBe(0);
  });

  it("re-subscribes only when `active` toggles, not on every render", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    act(() => root.render(createElement(Harness, { renderNonce: 0, active: false })));
    firePointerDown(document.body);
    expect(outsideCount).toBe(0);

    act(() => root.render(createElement(Harness, { renderNonce: 1, active: true })));
    firePointerDown(document.body);
    expect(outsideCount).toBe(1);

    const adds = addSpy.mock.calls.filter((args) => args[0] === "pointerdown").length;
    expect(adds).toBe(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
