import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AnnotationDataContext,
  AnnotationUiContext,
  type AnnotationDataContextValue,
  type AnnotationUiContextValue,
} from "../../src/context/AnnotationContext";
import { useAnnotations } from "../../src/hooks/useAnnotations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeData(overrides: Partial<AnnotationDataContextValue> = {}): AnnotationDataContextValue {
  return {
    annotations: [],
    loading: false,
    error: null,
    retry: () => undefined,
    actionError: null,
    clearActionError: () => undefined,
    createAnnotation: async () => {
      throw new Error("unused");
    },
    addComment: async () => undefined,
    editComment: async () => undefined,
    removeComment: async () => undefined,
    setStatus: async () => undefined,
    renameAnnotation: async () => undefined,
    removeAnnotation: async () => undefined,
    pageKey: "/home",
    connectionState: "open",
    ...overrides,
  } as AnnotationDataContextValue;
}

function fakeUi(overrides: Partial<AnnotationUiContextValue> = {}): AnnotationUiContextValue {
  return {
    selectedId: null,
    selectAnnotation: () => undefined,
    ...overrides,
  } as AnnotationUiContextValue;
}

let container: HTMLDivElement;
let root: Root;
let seenReturns: Array<ReturnType<typeof useAnnotations>> = [];

function Probe() {
  const value = useAnnotations();
  seenReturns.push(value);
  return null;
}

function Harness({
  data,
  ui,
}: {
  data: AnnotationDataContextValue;
  ui: AnnotationUiContextValue;
}) {
  return createElement(
    AnnotationDataContext.Provider,
    { value: data },
    createElement(AnnotationUiContext.Provider, { value: ui }, createElement(Probe)),
  );
}

beforeEach(() => {
  seenReturns = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useAnnotations() memoization", () => {
  it("returns a referentially stable object across re-renders when nothing it reads changed", () => {
    const data = fakeData();
    const ui = fakeUi();

    act(() => root.render(createElement(Harness, { data, ui })));
    act(() => root.render(createElement(Harness, { data, ui })));
    act(() => root.render(createElement(Harness, { data, ui })));

    expect(seenReturns).toHaveLength(3);
    expect(seenReturns[0]).toBe(seenReturns[1]);
    expect(seenReturns[1]).toBe(seenReturns[2]);
  });

  it("returns a new object once a field it reads actually changes", () => {
    const ui = fakeUi();

    act(() => root.render(createElement(Harness, { data: fakeData(), ui })));
    act(() => root.render(createElement(Harness, { data: fakeData({ loading: true }), ui })));

    expect(seenReturns).toHaveLength(2);
    expect(seenReturns[0]).not.toBe(seenReturns[1]);
  });
});
