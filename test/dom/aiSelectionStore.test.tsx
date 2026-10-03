import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  aiSelectionLabel,
  aiSelectionStore,
  usePublishAiSelection,
} from "../../src/ai/aiSelectionStore";

const NOUN = ["entity", "entities"] as const;
const names: Record<string, string> = { e1: "users", e2: "posts" };

function Publisher({ id, ids }: { id: string; ids: ReadonlySet<string> }) {
  usePublishAiSelection("data_model", id, ids, (list) =>
    aiSelectionLabel(
      list.map((item) => names[item] ?? ""),
      NOUN,
    ),
  );
  return null;
}

let container: HTMLDivElement;
let root: Root;

const render = (id: string, ids: string[]) =>
  act(() => root.render(createElement(Publisher, { id, ids: new Set(ids) })));

beforeEach(() => {
  aiSelectionStore.clear();
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  aiSelectionStore.clear();
});

describe("usePublishAiSelection", () => {
  it("publishes the editor selection with a label and clears it", () => {
    render("dm1", ["e1"]);
    expect(aiSelectionStore.get()).toEqual({
      selection: { kind: "data_model", id: "dm1", itemIds: ["e1"] },
      label: "users",
    });
    render("dm1", ["e1", "e2"]);
    expect(aiSelectionStore.get()?.label).toBe("2 entities");
    render("dm1", []);
    expect(aiSelectionStore.get()).toBeNull();
  });

  it("clears its own selection on unmount but leaves another editor's", () => {
    render("dm1", ["e1"]);
    act(() => root.unmount());
    expect(aiSelectionStore.get()).toBeNull();
    root = createRoot(container);
    render("dm1", ["e1"]);
    aiSelectionStore.set({
      selection: { kind: "flow", id: "f1", itemIds: ["n1"] },
      label: "Start",
    });
    act(() => root.unmount());
    expect(aiSelectionStore.get()?.selection.id).toBe("f1");
    root = createRoot(container);
  });
});
