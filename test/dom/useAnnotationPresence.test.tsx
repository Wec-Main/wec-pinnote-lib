import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { useAnnotationPresence } from "../../src/hooks/useAnnotationPresence";
import { ANNOTATION_SCOPE_ATTRIBUTE } from "../../src/utils/annotationScope";
import { generateSelector } from "../../src/utils/selectorGenerator";
import type { Annotation } from "../../src/types/annotation.types";

function annotation(id: string, selector: string, elementIdentifier: string): Annotation {
  return {
    id,
    projectId: "demo",
    pageKey: "/home",
    number: 1,
    status: "open",
    anchor: {
      selector,
      elementIdentifier,
      relativeX: 0.5,
      relativeY: 0.5,
      fallbackX: 0,
      fallbackY: 0,
      viewportWidth: 1024,
      viewportHeight: 768,
    },
    comments: [],
    createdBy: { id: "u1", name: "Ada Lovelace" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

let container: HTMLDivElement;
let root: Root;
let latestPresent: Set<string> | null = null;

function Harness({ annotations }: { annotations: Annotation[] }) {
  latestPresent = useAnnotationPresence(annotations);
  return null;
}

function renderHarness(annotations: Annotation[]) {
  act(() => {
    root.render(createElement(Harness, { annotations }));
  });
}

async function flushObserversAndTimers() {
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(500);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.body.innerHTML = "";
  latestPresent = null;
  vi.useRealTimers();
});

describe("useAnnotationPresence", () => {
  it("marks an id present when its element exists and absent once removed", async () => {
    const target = document.createElement("input");
    target.name = "email";
    document.body.appendChild(target);
    const items = [annotation("a1", "", "email")];

    renderHarness(items);
    expect(latestPresent?.has("a1")).toBe(true);

    target.remove();
    await flushObserversAndTimers();
    expect(latestPresent?.has("a1")).toBe(false);
  });

  it("marks an id present again once its element is re-added", async () => {
    const items = [annotation("a1", "", "email")];
    renderHarness(items);
    expect(latestPresent?.has("a1")).toBe(false);

    const target = document.createElement("input");
    target.name = "email";
    document.body.appendChild(target);
    await flushObserversAndTimers();
    expect(latestPresent?.has("a1")).toBe(true);
  });

  it("follows a data-annotation-scope swap", async () => {
    const scopeA = document.createElement("div");
    scopeA.setAttribute(ANNOTATION_SCOPE_ATTRIBUTE, "modal-a");
    const inputA = document.createElement("input");
    inputA.name = "email";
    scopeA.appendChild(inputA);
    document.body.appendChild(scopeA);

    const { selector, elementIdentifier } = generateSelector(inputA, {
      name: "modal-a",
      root: scopeA,
    });
    const items = [annotation("a1", selector, elementIdentifier)];
    renderHarness(items);
    expect(latestPresent?.has("a1")).toBe(true);

    const scopeB = document.createElement("div");
    scopeB.setAttribute(ANNOTATION_SCOPE_ATTRIBUTE, "modal-b");
    document.body.appendChild(scopeB);
    await flushObserversAndTimers();
    expect(latestPresent?.has("a1")).toBe(false);

    scopeB.remove();
    await flushObserversAndTimers();
    expect(latestPresent?.has("a1")).toBe(true);
  });
});
