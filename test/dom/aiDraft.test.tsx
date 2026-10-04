import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiPreviewStore } from "../../src/features/ai/aiPreviewStore";
import {
  useAiOpBatchApplier,
  type AiOpBatchApplier,
} from "../../src/features/ai/useAiOpBatchApplier";
import type { RevisionedDocumentState } from "../../src/hooks/useRevisionedDocument";
import type { AiOpBatch } from "../../src/types/ai.types";
import type { ErdDocumentJSON } from "../../src/types/dataModel.types";
import { ErdEngine } from "../../src/utils/erd/erdEngine";
import { blogDocument } from "../erdFixtures";
import { T0 } from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;
let engine: ErdEngine;
let applier: AiOpBatchApplier;
const fetchMock = vi.fn();

const docState = {
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
} as unknown as RevisionedDocumentState<ErdDocumentJSON>;

function Harness() {
  applier = useAiOpBatchApplier({
    kind: "data_model",
    targetId: "dm1",
    engine,
    documentState: docState,
    apiBaseUrl: "https://api.test",
    getAuthToken: () => "t",
  });
  return null;
}

const names = () => engine.getState().entities.map((entity) => entity.name);
const addEntity = (name: string) => ({ op: "addEntity", name });

function batch(ops: unknown[]): AiOpBatch {
  return {
    aiOpBatchId: "b1",
    aiSessionId: "s1",
    aiTurnId: null,
    targetKind: "data_model",
    targetId: "dm1",
    baseRevision: 3,
    title: "Add tables",
    rationale: "",
    summary: { added: ops.length, changed: 0, removed: 0 },
    status: "proposed",
    statusDetail: null,
    savedRevision: null,
    createdAt: T0,
    updatedAt: T0,
    ops,
  } as AiOpBatch;
}

beforeEach(async () => {
  docState.savedCount = 0;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "applied" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  engine = new ErdEngine();
  engine.applyDocument(blogDocument());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Harness)));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const patchedStatuses = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).includes("/ai/op-batches/"))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)).status);

describe("applying a proposal", () => {
  it("skips an operation that cannot apply and still applies the rest", async () => {
    let outcome: Awaited<ReturnType<AiOpBatchApplier["preview"]>> | null = null;
    await act(async () => {
      outcome = await applier.preview(
        batch([addEntity("labels"), { op: "addField", entity: "ghost", name: "x", type: "int" }]),
      );
    });
    expect(outcome).toMatchObject({ ok: true });
    expect((outcome as unknown as { skipped: string[] }).skipped).toHaveLength(1);
    expect(names()).toContain("labels");
  });

  it("only marks a failing proposal as conflict once", async () => {
    fetchMock.mockImplementation(
      async (_url: string, init: RequestInit) =>
        new Response(JSON.stringify({ status: JSON.parse(String(init.body)).status }), {
          status: 200,
        }),
    );
    const bad = batch([addEntity("posts")]);
    await act(async () => {
      expect((await applier.preview(bad)).ok).toBe(false);
    });
    await act(async () => {
      expect((await applier.preview(bad)).ok).toBe(false);
    });
    expect(patchedStatuses().filter((status) => status === "conflict")).toHaveLength(1);
  });

  it("keeps a proposal applied when the document is saved while it is previewed", async () => {
    await act(async () => {
      await applier.preview(batch([addEntity("labels")]));
    });
    expect(applier.previewingBatchId).toBe("b1");
    docState.savedCount = 1;
    await act(async () => root.render(createElement(Harness)));
    await act(async () => undefined);
    expect(applier.previewingBatchId).toBeNull();
    expect(applier.savedBatchIds).toEqual(["b1"]);
    expect(names()).toContain("labels");
  });

  it("ignores the save made by the publish-before-build step", async () => {
    await act(async () => {
      await applier.preview(batch([addEntity("labels")]));
    });
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let tracked: Promise<void> = Promise.resolve();
    act(() => {
      tracked = applier.trackSnapshot(pending);
    });
    docState.savedCount = 2;
    await act(async () => root.render(createElement(Harness)));
    release();
    await act(async () => tracked);
    expect(applier.previewingBatchId).toBe("b1");
    expect(applier.savedBatchIds).toEqual([]);
  });
});

describe("live AI drafts", () => {
  it("draws partial ops, redraws without stacking, and restores on endDraft", async () => {
    const original = JSON.stringify(engine.toJSON());
    await act(async () => {
      expect(await applier.draft([addEntity("labels")])).toBe(true);
    });
    expect(names()).toContain("labels");
    expect(aiPreviewStore.get("data_model", "dm1")?.added.size).toBe(1);
    await act(async () => {
      await applier.draft([
        addEntity("labels"),
        addEntity("badges"),
        { op: "addField", entity: "$x" },
      ]);
    });
    expect(names().filter((name) => name === "labels")).toHaveLength(1);
    expect(names()).toContain("badges");
    act(() => applier.endDraft());
    expect(JSON.stringify(engine.toJSON())).toBe(original);
    expect(aiPreviewStore.get("data_model", "dm1")).toBeNull();
  });

  it("applies only the new ops when the stream grows and still restores in one endDraft", async () => {
    const original = JSON.stringify(engine.toJSON());
    const first = addEntity("labels");
    const second = addEntity("badges");
    const third = addEntity("flags");
    await act(async () => {
      await applier.draft([first]);
    });
    await act(async () => {
      await applier.draft([first, second]);
    });
    await act(async () => {
      expect(await applier.draft([first, second, third])).toBe(true);
    });
    expect(names().filter((name) => ["labels", "badges", "flags"].includes(name))).toHaveLength(3);
    expect(aiPreviewStore.get("data_model", "dm1")?.added.size).toBe(3);
    act(() => applier.endDraft());
    expect(JSON.stringify(engine.toJSON())).toBe(original);
  });

  it("hands the canvas over to the final preview, and Discard returns to the original", async () => {
    const original = JSON.stringify(engine.toJSON());
    await act(async () => {
      await applier.draft([addEntity("labels")]);
    });
    await act(async () => {
      const outcome = await applier.preview(batch([addEntity("labels"), addEntity("badges")]));
      expect(outcome.ok).toBe(true);
    });
    expect(names().filter((name) => name === "labels")).toHaveLength(1);
    expect(names()).toContain("badges");
    await act(async () => applier.reject());
    expect(JSON.stringify(engine.toJSON())).toBe(original);
  });

  it("stops drafting instead of undoing a change the user made", async () => {
    await act(async () => {
      await applier.draft([addEntity("labels")]);
    });
    act(() => {
      const current = engine.toJSON();
      engine.applyDocument(
        { ...current, entities: current.entities.filter((entity) => entity.name !== "posts") },
        { recordHistory: true },
      );
    });
    let drawn = true;
    await act(async () => {
      drawn = await applier.draft([addEntity("labels"), addEntity("badges")]);
    });
    expect(drawn).toBe(false);
    expect(names()).not.toContain("badges");
    act(() => applier.endDraft());
    expect(names()).toContain("labels");
  });
});

describe("undoing an accepted proposal", () => {
  it("undoes it when nothing changed since", async () => {
    await act(async () => {
      await applier.preview(batch([addEntity("labels")]));
    });
    act(() => applier.accept());
    let undone = false;
    await act(async () => {
      undone = await applier.undoAccepted("b1");
    });
    expect(undone).toBe(true);
    expect(names()).not.toContain("labels");
  });

  it("refuses to undo once the document was edited after accepting", async () => {
    await act(async () => {
      await applier.preview(batch([addEntity("labels")]));
    });
    act(() => applier.accept());
    act(() => {
      const current = engine.toJSON();
      engine.applyDocument(
        { ...current, entities: current.entities.filter((entity) => entity.name !== "posts") },
        { recordHistory: true },
      );
    });
    let undone = true;
    await act(async () => {
      undone = await applier.undoAccepted("b1");
    });
    expect(undone).toBe(false);
    expect(names()).toContain("labels");
    expect(names()).not.toContain("posts");
  });
});

describe("selecting changes", () => {
  it("applies only the selected ops", async () => {
    await act(async () => {
      await applier.preview(batch([addEntity("labels"), addEntity("badges")]), {
        exclude: new Set([1]),
      });
    });
    expect(names()).toContain("labels");
    expect(names()).not.toContain("badges");
    await act(async () => {
      await applier.repreview(batch([addEntity("labels"), addEntity("badges")]), {
        exclude: new Set(),
      });
    });
    expect(names()).toContain("badges");
    expect(names().filter((name) => name === "labels")).toHaveLength(1);
  });
});

describe("syncing status changes", () => {
  it("reports a sync warning and keeps retrying when the status PATCH fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    let outcome: Awaited<ReturnType<AiOpBatchApplier["preview"]>> | null = null;
    await act(async () => {
      outcome = await applier.preview(batch([addEntity("labels")]));
    });
    expect(outcome).toMatchObject({ ok: true, syncWarning: expect.stringContaining("retrying") });
    expect(applier.syncPending).toBe(true);
    expect(names()).toContain("labels");
  });

  it("treats a 409 as authoritative and does not keep retrying", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "no" }), { status: 409 }));
    await act(async () => {
      await applier.preview(batch([addEntity("labels")]));
    });
    expect(applier.syncPending).toBe(false);
    expect(applier.error).toContain("already updated");
  });
});
