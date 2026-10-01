import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTOSAVE_DELAY_MS,
  useRevisionedDocument,
  type RevisionedDocumentAdapter,
  type RevisionedDocumentState,
} from "../../src/hooks/useRevisionedDocument";
import { AnnotationApiError } from "../../src/types/annotation.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Doc {
  text: string;
}

const CONFLICT_MESSAGE = "changed elsewhere";

const load = vi.fn();
const save = vi.fn();
const publish = vi.fn();

const adapter: RevisionedDocumentAdapter<Doc> = {
  load: (...args) => load(...args),
  save: (...args) => save(...args),
  publish: (...args) => publish(...args),
  parse: (raw) => raw as Doc,
  conflictMessage: CONFLICT_MESSAGE,
};

let state: RevisionedDocumentState<Doc>;
let container: HTMLDivElement;
let root: Root;

function Probe({ documentId }: { documentId: string | null }) {
  state = useRevisionedDocument<Doc>({
    apiBaseUrl: "https://api.example.com",
    getAuthToken: () => "token",
    sessionKey: "session",
    documentId,
    adapter,
  });
  return createElement("output", null, state.status);
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(documentId: string | null = "doc-1") {
  act(() => root.render(createElement(Probe, { documentId })));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  load.mockReset().mockResolvedValue({ revision: 3, document: { text: "initial" } });
  save.mockReset().mockImplementation(async (_b, _t, _id, revision: number) => ({
    revision: revision + 1,
    name: "Saved Name",
  }));
  publish.mockReset().mockResolvedValue({});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useRevisionedDocument", () => {
  it("loads and parses the document through the adapter", async () => {
    await mount();
    expect(load).toHaveBeenCalledWith(
      "https://api.example.com",
      "token",
      "doc-1",
      expect.any(AbortSignal),
    );
    expect(state.status).toBe("ready");
    expect(state.document).toEqual({ text: "initial" });
    expect(state.loadKey).toBe(1);
    expect(state.saveState).toBe("idle");
  });

  it("does not load without a document id", async () => {
    await mount(null);
    expect(load).not.toHaveBeenCalled();
    expect(state.status).toBe("loading");
  });

  it("reports a load failure", async () => {
    load.mockRejectedValue(new Error("boom"));
    await mount();
    expect(state.status).toBe("error");
    expect(state.error).toBe("boom");
  });

  it("debounces scheduled saves into one request with the loaded revision", async () => {
    await mount();
    act(() => state.scheduleSave({ text: "a" }));
    act(() => state.scheduleSave({ text: "ab" }));
    expect(state.saveState).toBe("pending");
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("https://api.example.com", "token", "doc-1", 3, {
      text: "ab",
    });
    expect(state.saveState).toBe("saved");
    expect(state.savedCount).toBe(1);
  });

  it("skips a save when the content equals what was last loaded", async () => {
    await mount();
    act(() => state.scheduleSave({ text: "initial" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    });
    expect(save).not.toHaveBeenCalled();
    expect(state.saveState).toBe("idle");
  });

  it("uses the revision returned by the previous save for the next one", async () => {
    await mount();
    await act(async () => {
      await state.save({ text: "one" });
    });
    await act(async () => {
      await state.save({ text: "two" });
    });
    expect(save.mock.calls.map((call) => call[3])).toEqual([3, 4]);
  });

  it("reports the conflict message on a 409", async () => {
    save.mockRejectedValue(new AnnotationApiError("Revision conflict", 409, null));
    await mount();
    await act(async () => {
      await state.save({ text: "x" }).catch(() => undefined);
    });
    expect(state.saveState).toBe("error");
    expect(state.saveError).toBe(CONFLICT_MESSAGE);
  });

  it("saves first and then publishes", async () => {
    await mount();
    await act(async () => {
      await state.publish({ text: "final" });
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith("https://api.example.com", "token", "doc-1");
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(
      publish.mock.invocationCallOrder[0] as number,
    );
  });

  it("reloads for a newer remote revision but ignores stale ones", async () => {
    await mount();
    expect(load).toHaveBeenCalledTimes(1);
    act(() => state.applyRemoteRevision(3));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    act(() => state.applyRemoteRevision(4));
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not reload over unsaved local changes", async () => {
    await mount();
    act(() => state.scheduleSave({ text: "dirty" }));
    act(() => state.applyRemoteRevision(10));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("flushes pending changes when the document id changes", async () => {
    await mount("doc-1");
    act(() => state.scheduleSave({ text: "dirty" }));
    act(() => root.render(createElement(Probe, { documentId: "doc-2" })));
    await flush();
    expect(save).toHaveBeenCalledWith("https://api.example.com", "token", "doc-1", 3, {
      text: "dirty",
    });
    expect(load).toHaveBeenLastCalledWith(
      "https://api.example.com",
      "token",
      "doc-2",
      expect.any(AbortSignal),
    );
  });
});
