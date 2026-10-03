import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AnnotationStoreContext,
  useAnnotationSelector,
  type AnnotationContextValue,
} from "../../src/context/AnnotationContext";
import { useAnnotationMode } from "../../src/hooks/useAnnotationMode";
import { Store } from "../../src/utils/flowchart/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeContextValue(
  overrides: Partial<AnnotationContextValue> = {},
): AnnotationContextValue {
  return {
    modeEnabled: false,
    setModeEnabled: () => undefined,
    annotations: [],
    annotationTags: [],
    flowPins: [],
    ...overrides,
  } as unknown as AnnotationContextValue;
}

let container: HTMLDivElement;
let root: Root;
let modeRenders = 0;
let modeReturn: ReturnType<typeof useAnnotationMode> | null = null;

function ModeProbe() {
  modeRenders += 1;
  modeReturn = useAnnotationMode();
  return null;
}

let unrelatedRenders = 0;

function UnrelatedProbe() {
  unrelatedRenders += 1;
  // Reads a field far from `modeEnabled` on the merged context.
  useAnnotationSelector((state) => state.annotations);
  return null;
}

beforeEach(() => {
  modeRenders = 0;
  unrelatedRenders = 0;
  modeReturn = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useAnnotationSelector / useAnnotationMode (blast-radius fix)", () => {
  it("does not re-render a modeEnabled-only consumer when an unrelated field changes", () => {
    const store = new Store<AnnotationContextValue>(fakeContextValue());

    act(() =>
      root.render(
        createElement(AnnotationStoreContext.Provider, { value: store }, createElement(ModeProbe)),
      ),
    );
    expect(modeRenders).toBe(1);
    expect(modeReturn!.enabled).toBe(false);

    // A change to an unrelated slice of the merged context (e.g. a new
    // annotations array after a comment was added elsewhere) must not
    // re-render a consumer that only reads modeEnabled.
    act(() => store.setState({ annotations: [{ id: "a1" } as never] }));
    expect(modeRenders).toBe(1);

    // A change that actually touches modeEnabled must re-render it.
    act(() => store.setState({ modeEnabled: true }));
    expect(modeRenders).toBe(2);
    expect(modeReturn!.enabled).toBe(true);
  });

  it("still re-renders a selector reading the field that changed", () => {
    const store = new Store<AnnotationContextValue>(fakeContextValue());

    act(() =>
      root.render(
        createElement(
          AnnotationStoreContext.Provider,
          { value: store },
          createElement(UnrelatedProbe),
        ),
      ),
    );
    expect(unrelatedRenders).toBe(1);

    act(() => store.setState({ annotations: [{ id: "a1" } as never] }));
    expect(unrelatedRenders).toBe(2);

    // Changing modeEnabled (which this consumer doesn't read) should not
    // re-render it again.
    act(() => store.setState({ modeEnabled: true }));
    expect(unrelatedRenders).toBe(2);
  });
});
