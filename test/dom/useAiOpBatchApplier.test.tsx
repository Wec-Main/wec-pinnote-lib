import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAiPreviewStore, type AiPreviewStore } from "../../src/ai/aiPreviewStore";
import * as opBatchApplier from "../../src/ai/opBatchApplier";
import { useAiOpBatchApplier, type AiOpBatchApplier } from "../../src/ai/useAiOpBatchApplier";
import type { RevisionedDocumentState } from "../../src/hooks/useRevisionedDocument";
import type { AiOpBatch } from "../../src/types/ai.types";
import type { ErdDocumentJSON } from "../../src/types/dataModel.types";
import { ErdEngine } from "../../src/utils/erd/erdEngine";
import { blogDocument } from "../erdFixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let applier: AiOpBatchApplier;
let container: HTMLDivElement;
let root: Root;
let engine: ErdEngine;
let store: AiPreviewStore;
let docState: RevisionedDocumentState<ErdDocumentJSON>;
const onHold = vi.fn();
const fetchMock = vi.fn();

function batch(id: string, ops: AiOpBatch["ops"]): AiOpBatch {
  return {
    aiOpBatchId: id,
    aiSessionId: "s1",
    aiTurnId: "t1",
    targetKind: "data_model",
    targetId: "dm1",
    baseRevision: 3,
    title: "",
    rationale: "",
    summary: { added: 0, changed: 0, removed: 0 },
    status: "proposed",
    statusDetail: null,
    savedRevision: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ops,
  } as AiOpBatch;
}

function documentState(overrides: Partial<RevisionedDocumentState<ErdDocumentJSON>> = {}) {
  return {
    status: "ready",
    document: null,
    loadKey: 1,
    error: null,
    saveError: null,
    saveState: "idle",
    savedCount: 0,
    hasUnsavedChanges: false,
    revision: 3,
    scheduleSave: vi.fn(),
    save: vi.fn(),
    publish: vi.fn(),
    reload: vi.fn(),
    applyRemoteRevision: vi.fn(),
    ...overrides,
  } as RevisionedDocumentState<ErdDocumentJSON>;
}

function Probe() {
  applier = useAiOpBatchApplier({
    kind: "data_model",
    targetId: "dm1",
    engine,
    documentState: docState,
    apiBaseUrl: "https://api.example.com",
    getAuthToken: () => "tok",
    onUnsavedAiChangesChange: onHold,
    previewStore: store,
  });
  return null;
}

const render = () => act(() => root.render(createElement(Probe)));

function patches() {
  return fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => ({
    id: url.split("/").at(-1),
    body: JSON.parse(String(init.body)),
  }));
}

beforeEach(() => {
  engine = new ErdEngine({ initialDocument: blogDocument() });
  store = createAiPreviewStore();
  docState = documentState();
  onHold.mockReset();
  fetchMock.mockReset().mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { status: string };
    return new Response(JSON.stringify({ ...batch("x", []), status: body.status }), {
      status: 200,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  render();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("useAiOpBatchApplier", () => {
  it("previews a batch as one undo step with an overlay, then rejects it", async () => {
    engine.addEntity({ name: "local_edit" });
    await act(async () => {
      const outcome = await applier.preview(batch("ob1", [{ op: "addEntity", name: "labels" }]));
      expect(outcome.ok).toBe(true);
    });
    const names = engine.getState().entities.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(["local_edit", "labels"]));
    expect(store.get("data_model", "dm1")?.added.size).toBe(1);
    expect(applier.hasUnsavedAiChanges).toBe(true);
    expect(onHold).toHaveBeenLastCalledWith(true);
    expect(patches()).toEqual([{ id: "ob1", body: { status: "applied" } }]);

    await act(async () => {
      await applier.reject();
    });
    expect(engine.getState().entities.map((e) => e.name)).not.toContain("labels");
    expect(engine.getState().entities.map((e) => e.name)).toContain("local_edit");
    expect(store.get("data_model", "dm1")).toBeNull();
    expect(applier.hasUnsavedAiChanges).toBe(false);
    expect(onHold).toHaveBeenLastCalledWith(false);
    expect(patches().at(-1)).toEqual({ id: "ob1", body: { status: "rejected" } });
  });

  it("accept clears the overlay but keeps unsaved AI changes until a save", async () => {
    await act(async () => {
      await applier.preview(batch("ob1", [{ op: "addEntity", name: "labels" }]));
    });
    act(() => applier.accept());
    expect(store.get("data_model", "dm1")).toBeNull();
    expect(applier.hasUnsavedAiChanges).toBe(true);
    docState = documentState({ savedCount: 1, revision: 4 });
    render();
    await act(async () => {
      await Promise.resolve();
    });
    expect(patches().at(-1)).toEqual({ id: "ob1", body: { status: "saved", savedRevision: 4 } });
    expect(applier.hasUnsavedAiChanges).toBe(false);
  });

  it("an edit during the preview counts as accepting", async () => {
    await act(async () => {
      await applier.preview(batch("ob1", [{ op: "addEntity", name: "labels" }]));
    });
    act(() => {
      engine.addEntity({ name: "after" });
    });
    expect(applier.previewingBatchId).toBeNull();
    expect(store.get("data_model", "dm1")).toBeNull();
  });

  it("marks a batch conflict when it no longer applies to the local document", async () => {
    let outcome: Awaited<ReturnType<AiOpBatchApplier["preview"]>> | undefined;
    await act(async () => {
      outcome = await applier.preview(batch("ob2", [{ op: "removeEntity", entity: "gone" }]));
    });
    expect(outcome).toMatchObject({ ok: false, status: "conflict" });
    expect(patches()).toEqual([
      { id: "ob2", body: { status: "conflict", statusDetail: expect.stringContaining("gone") } },
    ]);
    expect(engine.getState().canUndo).toBe(false);
  });

  it("discard PATCHes discarded and reloads the saved revision", async () => {
    await act(async () => {
      await applier.preview(batch("ob1", [{ op: "addEntity", name: "a1" }]));
    });
    await act(async () => {
      await applier.preview(batch("ob3", [{ op: "addEntity", name: "a2" }]));
    });
    expect(applier.appliedBatchIds).toEqual(["ob1", "ob3"]);
    await act(async () => {
      await applier.discard();
    });
    expect(docState.reload).toHaveBeenCalled();
    expect(
      patches()
        .slice(-2)
        .map((p) => [p.id, p.body.status]),
    ).toEqual([
      ["ob1", "discarded"],
      ["ob3", "discarded"],
    ]);
    expect(applier.hasUnsavedAiChanges).toBe(false);
  });

  it("does not desync the draft when a partial apply fails after a successful step", async () => {
    const alpha = { op: "addEntity", name: "alpha" };
    const beta = { op: "addEntity", name: "beta" };
    const gamma = { op: "addEntity", name: "gamma" };

    await act(async () => {
      expect(await applier.draft([alpha])).toBe(true);
    });
    expect(engine.getState().entities.map((e) => e.name)).toContain("alpha");

    const spy = vi.spyOn(opBatchApplier, "applyPartialOps").mockResolvedValueOnce(null);
    await act(async () => {
      expect(await applier.draft([alpha, beta])).toBe(false);
    });
    spy.mockRestore();
    expect(engine.getState().entities.map((e) => e.name)).not.toContain("beta");

    await act(async () => {
      expect(await applier.draft([alpha, beta, gamma])).toBe(true);
    });
    const names = engine.getState().entities.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(["alpha", "beta", "gamma"]));
  });

  it("does not desync the draft when the first (full) step fails", async () => {
    const alpha = { op: "addEntity", name: "alpha" };
    const beta = { op: "addEntity", name: "beta" };

    const spy = vi.spyOn(opBatchApplier, "applyPartialOps").mockResolvedValueOnce(null);
    await act(async () => {
      expect(await applier.draft([alpha])).toBe(false);
    });
    spy.mockRestore();
    expect(engine.getState().entities.map((e) => e.name)).not.toContain("alpha");

    await act(async () => {
      expect(await applier.draft([alpha, beta])).toBe(true);
    });
    const names = engine.getState().entities.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(["alpha", "beta"]));
  });
});
