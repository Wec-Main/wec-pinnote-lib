import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTOSAVE_DELAY_MS,
  useRevisionedDocument,
  type RevisionedDocumentAdapter,
  type RevisionedDocumentState,
} from "../../src/hooks/useRevisionedDocument";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Doc {
  text: string;
}

const load = vi.fn();
const save = vi.fn();

const adapter: RevisionedDocumentAdapter<Doc> = {
  load: (...args) => load(...args),
  save: (...args) => save(...args),
  publish: async () => ({}),
  parse: (raw) => raw as Doc,
  conflictMessage: "conflict",
};

let state: RevisionedDocumentState<Doc>;
let container: HTMLDivElement;
let root: Root;

function Probe({ hold, documentId = "doc-1" }: { hold: boolean; documentId?: string }) {
  state = useRevisionedDocument<Doc>({
    apiBaseUrl: "https://api.example.com",
    getAuthToken: () => "token",
    sessionKey: "session",
    documentId,
    adapter,
    holdAutosave: hold,
  });
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function render(hold: boolean, documentId?: string) {
  act(() => root.render(createElement(Probe, { hold, documentId })));
  await flush();
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  load.mockReset().mockResolvedValue({ revision: 3, document: { text: "initial" } });
  save.mockReset().mockImplementation(async (_b, _t, _id, revision: number) => ({
    revision: revision + 1,
    name: "Saved",
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useRevisionedDocument holdAutosave", () => {
  it("keeps edits pending while held and reports unsaved changes", async () => {
    await render(true);
    act(() => state.scheduleSave({ text: "ai" }));
    await wait(AUTOSAVE_DELAY_MS * 3);
    expect(save).not.toHaveBeenCalled();
    expect(state.hasUnsavedChanges).toBe(true);
    expect(state.saveState).toBe("pending");
  });

  it("saves nothing when the hold is released; save() still works", async () => {
    await render(true);
    act(() => state.scheduleSave({ text: "ai" }));
    await render(false);
    await wait(AUTOSAVE_DELAY_MS * 3);
    expect(save).not.toHaveBeenCalled();
    expect(state.hasUnsavedChanges).toBe(true);
    await act(async () => {
      await state.save({ text: "ai" });
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(state.hasUnsavedChanges).toBe(false);
  });

  it("cancels an autosave already scheduled when the hold starts", async () => {
    await render(false);
    act(() => state.scheduleSave({ text: "ai" }));
    await render(true);
    await wait(AUTOSAVE_DELAY_MS * 3);
    expect(save).not.toHaveBeenCalled();
    expect(state.hasUnsavedChanges).toBe(true);
  });

  it("does not flush on unmount while held", async () => {
    await render(true);
    act(() => state.scheduleSave({ text: "ai" }));
    act(() => root.render(createElement("div")));
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("still flushes on unmount when not held (existing behaviour)", async () => {
    await render(false);
    act(() => state.scheduleSave({ text: "user" }));
    act(() => root.render(createElement("div")));
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("autosaves again after release once the user edits and saves", async () => {
    await render(true);
    act(() => state.scheduleSave({ text: "ai" }));
    await act(async () => {
      await state.save({ text: "ai" });
    });
    await render(false);
    act(() => state.scheduleSave({ text: "ai + user" }));
    await wait(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(state.hasUnsavedChanges).toBe(false);
  });

  it("clears the unsaved flag when held edits return to the saved content", async () => {
    await render(true);
    act(() => state.scheduleSave({ text: "ai" }));
    act(() => state.scheduleSave({ text: "initial" }));
    expect(state.hasUnsavedChanges).toBe(false);
  });
});
