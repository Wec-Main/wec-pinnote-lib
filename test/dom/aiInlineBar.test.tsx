import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiPreviewStore } from "../../src/ai/aiPreviewStore";
import { useAiOpBatchApplier } from "../../src/ai/useAiOpBatchApplier";
import { AiInlineBar } from "../../src/components/Ai/AiInlineBar";
import { aiEditorRequests } from "../../src/components/Ai/aiEditorRequests";
import { AiRuntimeContext } from "../../src/context/AiRuntimeContext";
import type { RevisionedDocumentState } from "../../src/hooks/useRevisionedDocument";
import type { AiOpBatch } from "../../src/types/ai.types";
import type { ErdDocumentJSON } from "../../src/types/dataModel.types";
import { ErdEngine } from "../../src/utils/erd/erdEngine";
import { blogDocument } from "../erdFixtures";
import {
  T0,
  aiMe,
  buttonByText,
  connector,
  fakeRuntime,
  flush,
  jsonResponse,
  press,
  signedOut,
  typeInto,
  type FakeRuntime,
} from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;
let engine: ErdEngine;
let runtime: FakeRuntime;
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

function batch(id: string, ops: AiOpBatch["ops"], aiTurnId = "t1"): AiOpBatch {
  return {
    aiOpBatchId: id,
    aiSessionId: "s-other",
    aiTurnId,
    targetKind: "data_model",
    targetId: "dm1",
    baseRevision: 3,
    title: "Add labels",
    rationale: "",
    summary: { added: 1, changed: 0, removed: 0 },
    status: "proposed",
    statusDetail: null,
    savedRevision: null,
    createdAt: T0,
    updatedAt: T0,
    ops,
  } as AiOpBatch;
}

function Harness() {
  const applier = useAiOpBatchApplier({
    kind: "data_model",
    targetId: "dm1",
    engine,
    documentState: docState,
  });
  return createElement(AiInlineBar, {
    kind: "data_model",
    targetId: "dm1",
    applier,
    getSelectedIds: () => [...engine.getState().selection.entityIds],
    selectedCount: engine.getState().selection.entityIds.size,
    itemNoun: ["entity", "entities"] as const,
    wholeLabel: "whole model",
  });
}

const names = () => engine.getState().entities.map((entity) => entity.name);
const input = () => container.querySelector<HTMLInputElement>(".wpn-ai-bar__input")!;

function path(url: string) {
  return new URL(url).pathname.replace("/api/v1/pinnote", "");
}

beforeEach(async () => {
  aiEditorRequests.reset();
  engine = new ErdEngine({ initialDocument: blogDocument() });
  runtime = fakeRuntime({
    me: aiMe({ connectors: [connector("claude"), signedOut("codex")] }),
  });
  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    const route = path(url);
    const method = init?.method ?? "GET";
    if (route === "/ai/sessions" && method === "GET") return jsonResponse([]);
    if (route.startsWith("/ai/op-batches/")) {
      const body = JSON.parse(String(init?.body)) as { status: string };
      return jsonResponse({ ...batch(route.split("/").at(-1)!, []), status: body.status });
    }
    if (route === "/ai/sessions" && method === "POST") {
      return jsonResponse({ aiSessionId: "s-new", projectId: "p1" }, 201);
    }
    if (route === "/ai/sessions/s-new/messages") {
      return jsonResponse({ message: {}, turn: { aiTurnId: "t9", aiSessionId: "s-new" } }, 202);
    }
    if (route === "/ai/sessions/s-new") {
      return jsonResponse({
        session: { aiSessionId: "s-new", activeTurn: null },
        messages: [],
        hasMoreMessages: false,
        opBatches: [],
        commentDrafts: [],
      });
    }
    throw new Error(`unexpected ${method} ${route}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      createElement(AiRuntimeContext.Provider, { value: runtime.value }, createElement(Harness)),
    ),
  );
  await flush();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("AiInlineBar", () => {
  it("previews a proposal from my turn, Enter accepts it", async () => {
    aiEditorRequests.rememberTurn("t1");
    await flush();
    expect(container.querySelector(".wpn-ai-bar__scope")?.textContent).toBe("whole model");

    await act(async () => {
      runtime.emit({
        type: "ai_op_batch.upserted",
        batch: batch("ob1", [{ op: "addEntity", name: "labels" }]),
      });
    });
    await flush();
    expect(names()).toContain("labels");
    expect(aiPreviewStore.get("data_model", "dm1")?.added.size).toBeGreaterThan(0);
    expect(container.querySelector(".wpn-ai-bar__preview")?.textContent).toContain(
      "Enter to accept",
    );

    press(input(), "Enter");
    await flush();
    expect(aiPreviewStore.get("data_model", "dm1")).toBeNull();
    expect(names()).toContain("labels");
    expect(container.querySelector(".wpn-ai-bar__preview")).toBeNull();
  });

  it("Esc rejects the preview (undo)", async () => {
    aiEditorRequests.rememberTurn("t2");
    await act(async () => {
      runtime.emit({
        type: "ai_op_batch.upserted",
        batch: batch("ob2", [{ op: "addEntity", name: "badges" }], "t2"),
      });
    });
    await flush();
    expect(names()).toContain("badges");
    press(input(), "Escape");
    await flush();
    expect(names()).not.toContain("badges");
    const patched = fetchMock.mock.calls
      .filter(([url]) => String(url).includes("/ai/op-batches/ob2"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).status);
    expect(patched).toEqual(["applied", "rejected"]);
  });

  it("ignores proposals from other people's turns", async () => {
    await act(async () => {
      runtime.emit({
        type: "ai_op_batch.upserted",
        batch: batch("ob3", [{ op: "addEntity", name: "spam" }], "someone-else"),
      });
    });
    await flush();
    expect(names()).not.toContain("spam");
  });

  it("previews a batch requested from the chat", async () => {
    await act(async () => {
      aiEditorRequests.requestPreview(batch("ob4", [{ op: "addEntity", name: "from_chat" }], "x"));
    });
    await flush();
    expect(names()).toContain("from_chat");
  });

  it("Enter sends the prompt with the selection, creating a scoped session", async () => {
    const first = engine.getState().entities[0]!;
    act(() => engine.select("entity", first.id));
    typeInto(input(), "add audit columns");
    press(input(), "Enter");
    await flush(20);
    const create = fetchMock.mock.calls.find(
      ([url, init]) =>
        path(String(url)) === "/ai/sessions" && (init as RequestInit)?.method === "POST",
    );
    expect(JSON.parse(String((create?.[1] as RequestInit).body))).toMatchObject({
      scopeKind: "data_model",
      scopeId: "dm1",
      provider: "claude",
      model: "claude-model",
    });
    const send = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/s-new/messages"));
    expect(JSON.parse(String((send?.[1] as RequestInit).body))).toMatchObject({
      text: "add audit columns",
      selection: { kind: "data_model", id: "dm1", itemIds: [first.id] },
    });
    expect(aiEditorRequests.isMyTurn("t9")).toBe(true);
    expect(buttonByText(container, "Open in chat")).toBeNull();
  });
});
