import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiDockControl } from "../../src/features/ai/aiDockState";
import { aiPreviewStore } from "../../src/features/ai/aiPreviewStore";
import { useStoreSelector } from "../../src/hooks/useStoreSelector";
import { useAiOpBatchApplier } from "../../src/features/ai/useAiOpBatchApplier";
import { AiEditorDock, type AiMentionSource } from "../../src/features/ai/components/AiEditorDock";
import { AskAiButton } from "../../src/features/ai/components/ErdAiIntegration";
import { aiEditorRequests } from "../../src/features/ai/components/aiEditorRequests";
import { AiRuntimeContext } from "../../src/features/ai/AiRuntimeContext";
import type { RevisionedDocumentState } from "../../src/hooks/useRevisionedDocument";
import { resetAiWarmThrottle } from "../../src/services/aiActionsStreamService";
import type { AiOpBatch } from "../../src/types/ai.types";
import type { ErdDocumentJSON } from "../../src/types/dataModel.types";
import { ErdEngine } from "../../src/utils/erd/erdEngine";
import { blogDocument } from "../erdFixtures";
import {
  T0,
  aiMe,
  buttonByText,
  click,
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
let results: (AiOpBatch | { raw: Record<string, unknown> })[];
let startOpen = true;
let onSnapshot: (() => Promise<void>) | undefined;
let mentionSource: AiMentionSource | undefined;
let runs: { actionKey: string; body: Record<string, unknown> }[];
const fetchMock = vi.fn();
let hold: ReadableStream<Uint8Array> | null = null;
const onModelDescription = vi.fn();

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

function batch(id: string, name: string): AiOpBatch {
  return {
    aiOpBatchId: id,
    aiSessionId: "s1",
    aiTurnId: null,
    targetKind: "data_model",
    targetId: "dm1",
    baseRevision: 3,
    title: `Add ${name}`,
    rationale: "Because.",
    summary: { added: 1, changed: 0, removed: 0 },
    status: "proposed",
    statusDetail: null,
    savedRevision: null,
    createdAt: T0,
    updatedAt: T0,
    ops: [{ op: "addEntity", name }],
  } as AiOpBatch;
}

const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function sse(actionKey: string): Response {
  const next = results.shift();
  const body =
    frame("run.started", {
      runId: "r1",
      actionKey,
      provider: "claude",
      model: "claude-model",
      transport: "bridge",
    }) +
    frame("step", { id: "s1", label: "Reading data model", status: "done" }) +
    (next && "raw" in next
      ? frame("result", next.raw)
      : next
        ? frame("result", {
            kind: "op_batch",
            batch: next,
            value: { title: next.title, rationale: next.rationale, ops: next.ops },
          })
        : frame("result", { kind: "markdown", text: "It is a blog." })) +
    frame("done", { runId: "r1", status: "completed" });
  return new Response(body, { status: 200 });
}

function path(url: string) {
  return new URL(url).pathname.replace("/api/v1/pinnote", "");
}

function Harness() {
  const control = useAiDockControl(startOpen);
  const applier = useAiOpBatchApplier({
    kind: "data_model",
    targetId: "dm1",
    engine,
    documentState: docState,
    onModelDescription,
  });
  const readOnly = useStoreSelector(engine.store, (state) => state.readOnly);
  return createElement(
    Fragment,
    null,
    createElement("div", { className: "canvas", "data-testid": "canvas" }),
    createElement(AskAiButton, { control }),
    createElement(AiEditorDock, {
      control,
      kind: "data_model",
      targetId: "dm1",
      applier,
      editable: !readOnly || applier.locked,
      getSelectedIds: () => [...engine.getState().selection.entityIds],
      selectedCount: engine.getState().selection.entityIds.size,
      itemNoun: ["entity", "entities"] as const,
      wholeLabel: "Whole model",
      isEmpty: engine.getState().entities.length === 0,
      getDocument: () => engine.toJSON(),
      subscribeChanges: (listener: () => void) => engine.on("change", listener),
      onSnapshot,
      mentionSource,
    }),
  );
}

const names = () => engine.getState().entities.map((entity) => entity.name);
const input = () => container.querySelector<HTMLTextAreaElement>(".wpn-ai-dock__input")!;
const dock = () => container.querySelector<HTMLElement>(".wpn-ai-dock")!;
const askButton = () => container.querySelector<HTMLButtonElement>(".wpn-ai-ask-btn")!;
const warmCalls = () =>
  fetchMock.mock.calls.filter(([url]) => path(String(url)) === "/ai/warm").length;
const canvas = () => container.querySelector<HTMLDivElement>(".canvas")!;
const patches = (id: string) =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).includes(`/ai/op-batches/${id}`))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)).status);

async function mount(doc: ErdDocumentJSON = blogDocument()) {
  engine = new ErdEngine({ initialDocument: doc });
  act(() =>
    root.render(
      createElement(AiRuntimeContext.Provider, { value: runtime.value }, createElement(Harness)),
    ),
  );
  await flush();
}

async function settleDraft() {
  // Flush microtasks first so the dock's draft-throttle effect actually runs
  // and registers its setTimeout before we start the real-time wait below —
  // otherwise the two can race and the wait can elapse (and flush(40) can
  // finish, which only drains microtasks) before that timer ever fires.
  await flush(10);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 260));
  });
  await flush(40);
}

async function ask(text: string) {
  typeInto(input(), text);
  press(input(), "Enter");
  await flush(30);
}

beforeEach(() => {
  aiEditorRequests.reset();
  resetAiWarmThrottle();
  startOpen = true;
  onSnapshot = undefined;
  mentionSource = undefined;
  results = [];
  runs = [];
  window.localStorage.clear();
  runtime = fakeRuntime({ me: aiMe({ connectors: [connector("claude"), signedOut("codex")] }) });
  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    const route = path(url);
    if (route === "/ai/warm") return jsonResponse({}, 202);
    const match = /^\/ai\/actions\/([^/]+)\/run$/.exec(route);
    if (match) {
      const actionKey = decodeURIComponent(match[1]!);
      runs.push({ actionKey, body: JSON.parse(String(init?.body)) });
      if (hold) return new Response(hold, { status: 200 });
      return sse(actionKey);
    }
    if (route.startsWith("/ai/op-batches/")) {
      const body = JSON.parse(String(init?.body)) as { status: string };
      return jsonResponse({ ...batch(route.split("/").at(-1)!, "x"), status: body.status });
    }
    throw new Error(`unexpected ${init?.method ?? "GET"} ${route}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  container.className = "wpn-flow-stage";
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  hold = null;
  onModelDescription.mockReset();
  act(() => root.unmount());
  container.remove();
  aiPreviewStore.clear("data_model", "dm1");
  vi.unstubAllGlobals();
});

describe("AiEditorDock", () => {
  it("warms the AI on mount, picks ask by default, and offers only Ask and Edit", async () => {
    await mount();
    const warmCall = fetchMock.mock.calls.find(([url]) => path(String(url)) === "/ai/warm");
    expect(warmCall).toBeDefined();
    expect(JSON.parse(String((warmCall![1] as RequestInit).body))).toMatchObject({
      provider: "claude",
    });
    expect(JSON.parse(String((warmCall![1] as RequestInit).body))).not.toHaveProperty("surface");
    await ask("Add a tags table");
    expect(runs[0]).toMatchObject({
      actionKey: "erd.ask",
      body: { prompt: "Add a tags table", targetId: "dm1", provider: "claude" },
    });
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    const modes = [...document.querySelectorAll(".wpn-menu__item-label")].map(
      (el) => el.textContent,
    );
    expect(modes).toEqual(["Ask", "Edit"]);
    click(buttonByText(container, "Edit"));
    await ask("Add a tags table");
    expect(runs[1]).toMatchObject({
      actionKey: "erd.edit",
      body: { prompt: "Add a tags table", targetId: "dm1", provider: "claude" },
    });
    expect(runs[0]?.body).not.toHaveProperty("target");
    expect(
      Object.keys(runs[0]!.body).every((key) =>
        [
          "prompt",
          "targetId",
          "selection",
          "inputs",
          "provider",
          "model",
          "effort",
          "newChat",
          "sessionId",
        ].includes(key),
      ),
    ).toBe(true);
  });

  it("sends selected entity ids as a flat selection list", async () => {
    await mount();
    const ids = engine.getState().entities.map((entity) => entity.id);
    act(() => engine.setSelection({ entityIds: [ids[0]!] }));
    act(() =>
      root.render(
        createElement(AiRuntimeContext.Provider, { value: runtime.value }, createElement(Harness)),
      ),
    );
    await ask("Rename it");
    expect(runs[0]?.body.selection).toEqual([ids[0]]);
  });

  it("shows the rationale as a note when a json result has no ops", async () => {
    await mount();
    results.push({
      raw: {
        kind: "json",
        value: { title: "Nothing to change", rationale: "Already normalised", ops: [] },
      },
    });
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    click(buttonByText(container, "Edit"));
    await ask("Tidy it");
    expect(container.querySelector(".wpn-ai-dock__note")?.textContent).toContain(
      "Already normalised",
    );
    expect(container.querySelector(".wpn-ai-dock__json")).toBeNull();
  });

  it("picks ask by default even for an empty model, and honours the quick chips", async () => {
    await mount({ ...blogDocument(), entities: [], relationships: [] });
    await ask("A shop");
    expect(runs[0]?.actionKey).toBe("erd.ask");
    expect(container.textContent).toContain("It is a blog.");
    expect(buttonByText(container, /Retry/)).not.toBeNull();
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    click(buttonByText(container, "Generate"));
    await ask("A shop");
    expect(runs[1]?.actionKey).toBe("erd.generate");
  });

  it("edits a non-empty model in place, scoped to the selection when there is one", async () => {
    onSnapshot = vi.fn(async () => undefined);
    await mount();
    const original = names();
    results.push(batch("ob9", "products"));
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    click(buttonByText(container, "Edit"));
    await ask("Add products");
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(runs[0]).toMatchObject({ actionKey: "erd.edit" });
    expect(runs[0]?.body.fresh).toBeUndefined();
    expect(runs[0]?.body).not.toHaveProperty("selection");
    expect(names()).toEqual([...original, "products"]);
    const ids = engine.getState().entities.map((entity) => entity.id);
    act(() => engine.setSelection({ entityIds: [ids[0]!] }));
    act(() =>
      root.render(
        createElement(AiRuntimeContext.Provider, { value: runtime.value }, createElement(Harness)),
      ),
    );
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    click(buttonByText(container, "Edit"));
    await ask("Rename it");
    expect(runs[1]).toMatchObject({ actionKey: "erd.edit", body: { selection: [ids[0]] } });
  });

  it("shows a waiting shimmer on an empty canvas until the AI finishes", async () => {
    await mount({ ...blogDocument(), entities: [], relationships: [] });
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    click(buttonByText(container, "Generate"));
    typeInto(input(), "A shop");
    press(input(), "Enter");
    expect(container.classList.contains("wpn-ai-waiting")).toBe(true);
    expect(container.getAttribute("data-ai-waiting")).toBe("Designing your data model…");
    await flush(30);
    expect(container.classList.contains("wpn-ai-waiting")).toBe(false);
    expect(container.hasAttribute("data-ai-waiting")).toBe(false);
  });

  it("draws live while the AI streams, locks editing, then keeps the result for approval", async () => {
    await mount({ ...blogDocument(), entities: [], relationships: [] });
    const encoder = new TextEncoder();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    hold = new ReadableStream<Uint8Array>({
      start(controller) {
        stream = controller;
      },
    });
    typeInto(input(), "A shop");
    press(input(), "Enter");
    await flush(10);
    stream.enqueue(
      encoder.encode(
        frame("run.started", { runId: "r1", actionKey: "erd.generate", provider: "claude" }) +
          frame("progress", {
            ops: 1,
            from: 0,
            newOps: [{ op: "addEntity", tempId: "$a", name: "shop_items" }],
          }),
      ),
    );
    await settleDraft();
    expect(names()).toContain("shop_items");
    expect(engine.getState().readOnly).toBe(true);
    act(() => engine.setViewport({ x: 40, y: 25, zoom: 0.8 }));
    stream.enqueue(
      encoder.encode(
        frame("progress", {
          ops: 2,
          from: 1,
          newOps: [{ op: "addEntity", tempId: "$b", name: "shop_orders" }],
        }),
      ),
    );
    await settleDraft();
    expect(names()).toEqual(expect.arrayContaining(["shop_items", "shop_orders"]));
    const done = batch("ob9", "shop_items");
    stream.enqueue(
      encoder.encode(
        frame("result", {
          kind: "op_batch",
          batch: done,
          value: { title: done.title, rationale: "", ops: done.ops },
        }) + frame("done", { runId: "r1", status: "completed" }),
      ),
    );
    stream.close();
    await flush(40);
    expect(engine.getState().readOnly).toBe(true);
    expect(names()).toContain("shop_items");
    expect(aiPreviewStore.get("data_model", "dm1")).not.toBeNull();
    click(buttonByText(container, "Discard"));
    await flush(20);
    expect(engine.getState().readOnly).toBe(false);
    expect(names()).not.toContain("shop_items");
    expect(names()).not.toContain("shop_orders");
  });

  it("saves the AI's model description only after Apply", async () => {
    await mount();
    const described = batch("ob8", "stickers");
    described.ops = [
      ...described.ops,
      { op: "setModelDescription", description: "A sticker shop." },
    ] as AiOpBatch["ops"];
    results.push(described);
    await ask("Add stickers");
    expect(names()).toContain("stickers");
    expect(onModelDescription).not.toHaveBeenCalled();
    click(buttonByText(container, "Apply"));
    await flush(20);
    expect(onModelDescription).toHaveBeenCalledWith("A sticker shop.");
    expect(engine.toJSON().meta.description).toBeUndefined();
  });

  it("drops the AI's model description when the proposal is discarded", async () => {
    await mount();
    const described = batch("ob9b", "stickers");
    described.ops = [
      ...described.ops,
      { op: "setModelDescription", description: "A sticker shop." },
    ] as AiOpBatch["ops"];
    results.push(described);
    await ask("Add stickers");
    click(buttonByText(container, "Discard"));
    await flush(20);
    expect(onModelDescription).not.toHaveBeenCalled();
  });

  it("stays view only while previewing and becomes editable once applied", async () => {
    await mount();
    results.push(batch("ob7", "stickers"));
    await ask("Add stickers");
    expect(names()).toContain("stickers");
    expect(engine.getState().readOnly).toBe(true);
    click(buttonByText(container, "Apply"));
    await flush(20);
    expect(engine.getState().readOnly).toBe(false);
    expect(names()).toContain("stickers");
  });

  it("still draws live when an earlier proposal is waiting for approval", async () => {
    await mount();
    results.push(batch("ob1", "stickers"));
    await ask("Add stickers");
    expect(names()).toContain("stickers");
    expect(aiPreviewStore.get("data_model", "dm1")).not.toBeNull();
    const encoder = new TextEncoder();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    hold = new ReadableStream<Uint8Array>({
      start(controller) {
        stream = controller;
      },
    });
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    click(buttonByText(container, "Edit"));
    typeInto(input(), "Add coupons");
    press(input(), "Enter");
    await flush(10);
    stream.enqueue(
      encoder.encode(
        frame("run.started", { runId: "r2", actionKey: "erd.edit", provider: "claude" }) +
          frame("progress", {
            ops: 1,
            from: 0,
            newOps: [{ op: "addEntity", tempId: "$c", name: "coupons" }],
          }),
      ),
    );
    await settleDraft();
    expect(names()).toContain("coupons");
    expect(names()).toContain("stickers");
    stream.close();
    await flush(20);
  });

  it("supports # references: picker, chip, and mentions sent with the run", async () => {
    const request = vi.fn();
    mentionSource = {
      request,
      candidates: [
        {
          trigger: "#",
          mention: { kind: "flow", id: "f1", label: "Checkout flow" },
          description: "Flow",
        },
        {
          trigger: "#",
          mention: { kind: "annotation", id: "a1", label: "#4" },
          description: "Login heading",
        },
      ],
    };
    await mount();
    act(() => input().focus());
    typeInto(input(), "Match #");
    expect(request).toHaveBeenCalledWith("#");
    expect(container.querySelector(".wpn-ai-mention-menu")).not.toBeNull();
    const searchBox = container.querySelector<HTMLInputElement>(
      ".wpn-ai-mention-menu__search input",
    )!;
    act(() => searchBox.focus());
    typeInto(searchBox, "check");
    press(searchBox, "Enter");
    await flush();
    expect(container.querySelector(".wpn-ai-dock__chips-row")?.textContent).toContain(
      "Checkout flow",
    );
    expect(input().value).toBe("Match ");
    typeInto(input(), "Match the checkout steps");
    press(input(), "Enter");
    await flush(30);
    expect(runs.at(-1)?.body.mentions).toEqual([
      { kind: "flow", id: "f1", label: "Checkout flow" },
    ]);
    expect(container.querySelector(".wpn-ai-dock__chips-row")).toBeNull();
    expect(container.querySelector(".wpn-ai-dock__prompt-chips")?.textContent).toContain(
      "Checkout flow",
    );
  });

  it("keeps the proposal Applied, not Apply again, when the document is saved while previewing", async () => {
    await mount();
    results.push(batch("ob5", "labels"));
    await ask("Add labels");
    expect(buttonByText(container, "Apply")).not.toBeNull();
    docState.savedCount = 1;
    act(() =>
      root.render(
        createElement(AiRuntimeContext.Provider, { value: runtime.value }, createElement(Harness)),
      ),
    );
    await flush();
    expect(buttonByText(container, "Apply")).toBeNull();
    expect(container.querySelector(".wpn-ai-dock__result--applied")).not.toBeNull();
    expect(names().filter((name) => name === "labels")).toHaveLength(1);
    docState.savedCount = 0;
  });

  it("auto-previews when idle, Enter in the dock applies, and Undo reverts it", async () => {
    await mount();
    results.push(batch("ob1", "labels"));
    await ask("Add labels");
    expect(names()).toContain("labels");
    expect(aiPreviewStore.get("data_model", "dm1")).not.toBeNull();
    expect(container.querySelector(".wpn-ai-dock__changes")).toBeNull();
    expect(container.querySelector(".wpn-ai-dock__preview")).toBeNull();
    expect(container.querySelector(".wpn-ai-dock__result .wpn-ai-batch__added")?.textContent).toBe(
      "+1",
    );
    expect(
      container.querySelector(".wpn-ai-dock__result--previewing .wpn-ai-dock__result-actions"),
    ).not.toBeNull();

    press(canvas(), "Enter");
    await flush();
    expect(aiPreviewStore.get("data_model", "dm1")).not.toBeNull();

    press(input(), "Enter");
    await flush();
    expect(aiPreviewStore.get("data_model", "dm1")).toBeNull();
    expect(names()).toContain("labels");
    const undo = buttonByText(container, "Undo AI change");
    expect(undo).not.toBeNull();

    click(undo);
    await flush();
    expect(names()).not.toContain("labels");
    expect(patches("ob1")).toEqual(["applied", "rejected"]);
    expect(buttonByText(container, "Undo AI change")).toBeNull();
  });

  it("keeps the undo toast until the next edit", async () => {
    await mount();
    results.push(batch("ob1", "labels"));
    await ask("Add labels");
    vi.useFakeTimers();
    try {
      press(input(), "Enter");
      expect(buttonByText(container, "Undo AI change")).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(buttonByText(container, "Undo AI change")).not.toBeNull();
      act(() => {
        engine.applyDocument({ ...engine.toJSON(), notes: [] }, { recordHistory: true });
      });
      expect(buttonByText(container, "Undo AI change")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never auto-previews while the user is interacting with the canvas", async () => {
    await mount();
    results.push(batch("ob2", "badges"));
    typeInto(input(), "Add badges");
    act(() => {
      canvas().dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    press(input(), "Enter");
    await flush(30);
    expect(names()).not.toContain("badges");
    expect(aiPreviewStore.get("data_model", "dm1")).toBeNull();
    const previewButton = buttonByText(container, "Preview proposal");
    expect(previewButton).not.toBeNull();

    act(() => {
      document.dispatchEvent(new Event("pointerup", { bubbles: true }));
    });
    click(previewButton);
    await flush();
    expect(names()).toContain("badges");
  });

  it("keeps an earlier proposal and builds the next one on top of it", async () => {
    await mount();
    results.push(batch("ob3", "first"), batch("ob4", "second"));
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    click(buttonByText(container, "Edit"));
    await ask("first");
    expect(names()).toContain("first");
    click(container.querySelector(".wpn-ai-dock__action-trigger"));
    click(buttonByText(container, "Edit"));
    await ask("second");
    expect(names()).toContain("first");
    expect(names()).toContain("second");
    expect(patches("ob3")).toEqual(["applied"]);
    expect(patches("ob4")).toEqual(["applied"]);
  });

  it("remembers prompts per document", async () => {
    await mount();
    await ask("Explain the posts table");
    act(() => root.unmount());
    root = createRoot(container);
    await mount();
    press(input(), "ArrowUp");
    expect(input().value).toBe("Explain the posts table");
  });

  describe("visibility", () => {
    it("stays hidden and cold until Ask AI is clicked, then warms and focuses the input", async () => {
      startOpen = false;
      await mount();
      expect(dock().getAttribute("data-open")).toBe("false");
      expect(dock().getAttribute("aria-hidden")).toBe("true");
      expect(dock().hasAttribute("inert")).toBe(true);
      expect(askButton().getAttribute("aria-pressed")).toBe("false");
      expect(warmCalls()).toBe(0);
      click(askButton());
      await flush();
      expect(dock().getAttribute("data-open")).toBe("true");
      expect(dock().hasAttribute("inert")).toBe(false);
      expect(askButton().getAttribute("aria-pressed")).toBe("true");
      expect(document.activeElement).toBe(input());
      expect(warmCalls()).toBe(1);
    });

    it("opens on the keyboard shortcut", async () => {
      startOpen = false;
      await mount();
      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key: "i", metaKey: true, bubbles: true }),
        );
      });
      await flush();
      expect(dock().getAttribute("data-open")).toBe("true");
      expect(document.activeElement).toBe(input());
    });

    it("closes with the toggle and the close button without losing the thread", async () => {
      await mount();
      await ask("Explain the posts table");
      expect(container.textContent).toContain("It is a blog.");
      click(askButton());
      await flush();
      expect(dock().getAttribute("data-open")).toBe("false");
      expect(container.textContent).toContain("It is a blog.");
      click(askButton());
      await flush();
      expect(dock().getAttribute("data-open")).toBe("true");
      click(container.querySelector('button[aria-label="Close AI"]'));
      await flush();
      expect(dock().getAttribute("data-open")).toBe("false");
      click(askButton());
      await flush();
      expect(container.querySelectorAll(".wpn-ai-dock__run")).toHaveLength(1);
    });

    it("closes on Escape unless a preview is active", async () => {
      await mount();
      input().focus();
      press(input(), "Escape");
      await flush();
      expect(dock().getAttribute("data-open")).toBe("false");

      click(askButton());
      await flush();
      results.push(batch("ob1", "labels"));
      await ask("Add labels");
      expect(aiPreviewStore.get("data_model", "dm1")).not.toBeNull();
      press(input(), "Escape");
      await flush();
      expect(aiPreviewStore.get("data_model", "dm1")).toBeNull();
      expect(dock().getAttribute("data-open")).toBe("true");
      press(input(), "Escape");
      await flush();
      expect(dock().getAttribute("data-open")).toBe("false");
    });

    it("keeps running while hidden, then opens itself and previews the result", async () => {
      await mount();
      results.push(batch("ob5", "stickers"));
      click(container.querySelector(".wpn-ai-dock__action-trigger"));
      click(buttonByText(container, "Edit"));
      typeInto(input(), "Add stickers");
      press(input(), "Enter");
      act(() => {
        askButton().click();
      });
      expect(dock().getAttribute("data-open")).toBe("false");
      expect(askButton().querySelector(".wpn-ai-ask-btn__dot--running")).not.toBeNull();
      await flush(30);
      expect(dock().getAttribute("data-open")).toBe("true");
      expect(askButton().querySelector(".wpn-ai-ask-btn__dot")).toBeNull();
      expect(aiPreviewStore.get("data_model", "dm1")).not.toBeNull();
      expect(names()).toContain("stickers");
    });
  });

  describe("size", () => {
    const handle = () => container.querySelector<HTMLElement>(".wpn-ai-dock__resize")!;
    const layoutKey = "wpn-ai-dock-layout-v3:data_model";

    it("is compact by default and switches size modes, persisting the choice", async () => {
      await mount();
      expect(dock().getAttribute("data-mode")).toBe("compact");
      click(buttonByText(container, "Expanded"));
      expect(dock().getAttribute("data-mode")).toBe("expanded");
      expect(dock().style.height).toBe("50%");
      click(buttonByText(container, "Maximized"));
      expect(dock().style.height).toContain("100%");
      expect(JSON.parse(window.localStorage.getItem(layoutKey)!)).toMatchObject({
        mode: "maximized",
      });
      act(() => root.unmount());
      root = createRoot(container);
      await mount();
      expect(dock().getAttribute("data-mode")).toBe("maximized");
    });

    it("exposes a keyboard accessible resize separator", async () => {
      await mount();
      expect(handle().getAttribute("role")).toBe("separator");
      expect(handle().getAttribute("aria-orientation")).toBe("horizontal");
      press(handle(), "ArrowUp");
      const first = Number(handle().getAttribute("aria-valuenow"));
      expect(dock().getAttribute("data-mode")).toBe("custom");
      expect(first).toBeGreaterThan(0);
      expect(dock().style.height).toBe(`${first}px`);
      press(handle(), "ArrowUp");
      expect(JSON.parse(window.localStorage.getItem(layoutKey)!).height).toBeGreaterThan(0);
      press(handle(), "Home");
      expect(JSON.parse(window.localStorage.getItem(layoutKey)!).mode).toBe("custom");
    });

    it("resizes by dragging the handle", async () => {
      await mount();
      act(() => {
        handle().dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true, button: 0, clientY: 500 }),
        );
      });
      act(() => {
        handle().dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientY: 100 }));
      });
      expect(dock().getAttribute("data-mode")).toBe("custom");
      act(() => {
        handle().dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
      });
      expect(JSON.parse(window.localStorage.getItem(layoutKey)!).mode).toBe("custom");
    });

    it("renders as a child of the canvas container", async () => {
      await mount();
      expect(dock().parentElement).toBe(container);
      expect(dock().classList.contains("wpn-ai-dock")).toBe(true);
    });
  });
});
