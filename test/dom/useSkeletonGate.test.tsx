import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { remainingSkeletonMs, useSkeletonGate } from "../../src/hooks/useSkeletonGate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function Probe({ pending }: { pending: boolean }) {
  const visible = useSkeletonGate(pending);
  return createElement("output", null, visible ? "skeleton" : "none");
}

function render(pending: boolean) {
  act(() => root.render(createElement(Probe, { pending })));
}

const text = () => container.textContent;

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

describe("useSkeletonGate", () => {
  it("computes remaining hold time", () => {
    expect(remainingSkeletonMs(1000, 1100, 300)).toBe(200);
    expect(remainingSkeletonMs(1000, 1400, 300)).toBe(0);
  });

  it("never shows a skeleton for fast loads", () => {
    render(true);
    act(() => void vi.advanceTimersByTime(100));
    expect(text()).toBe("none");
    render(false);
    act(() => void vi.advanceTimersByTime(1000));
    expect(text()).toBe("none");
  });

  it("shows after the delay and holds for the minimum duration", () => {
    render(true);
    act(() => void vi.advanceTimersByTime(120));
    expect(text()).toBe("skeleton");
    act(() => void vi.advanceTimersByTime(50));
    render(false);
    expect(text()).toBe("skeleton");
    act(() => void vi.advanceTimersByTime(249));
    expect(text()).toBe("skeleton");
    act(() => void vi.advanceTimersByTime(2));
    expect(text()).toBe("none");
  });

  it("hides immediately once the minimum has elapsed", () => {
    render(true);
    act(() => void vi.advanceTimersByTime(120));
    act(() => void vi.advanceTimersByTime(500));
    render(false);
    act(() => void vi.advanceTimersByTime(0));
    expect(text()).toBe("none");
  });
});
