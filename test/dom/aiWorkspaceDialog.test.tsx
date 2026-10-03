import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceApplyResult } from "../../src/ai/ops/workspaceOps";
import { AiWorkspaceDialog } from "../../src/components/Ai/AiWorkspaceDialog";
import { AiRuntimeContext } from "../../src/context/AiRuntimeContext";
import { resetAiWarmThrottle } from "../../src/services/aiActionsStream";
import type { AiOpBatch } from "../../src/types/ai.types";
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
  typeInto,
  type FakeRuntime,
} from "./aiTestUtils";

const apply = vi.fn();
const discard = vi.fn();
const openReference = vi.fn();

vi.mock("../../src/components/Ai/useAiWorkspaceApplier", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/components/Ai/useAiWorkspaceApplier")>();
  return { ...original, useAiWorkspaceApplier: () => ({ apply, discard }) };
});

vi.mock("../../src/components/Ai/useAiMentionCandidates", () => ({
  useAiMentionCandidates: () => ({ candidates: [], request: () => undefined }),
}));

vi.mock("../../src/context/AnnotationContext", () => ({
  useAnnotationUi: () => ({ openReference }),
  useAnnotationData: () => ({
    config: { apiBaseUrl: "https://api.example.com", projectId: "p1" },
  }),
  useAnnotationAuth: () => ({}),
}));

let container: HTMLDivElement;
let root: Root;
let runtime: FakeRuntime;
let runs: { actionKey: string; body: Record<string, unknown> }[];
let result: Record<string, unknown>;
const fetchMock = vi.fn();
const onClose = vi.fn();

const workspaceBatch = (status: AiOpBatch["status"] = "proposed"): AiOpBatch =>
  ({
    aiOpBatchId: "wb1",
    aiSessionId: "s1",
    aiTurnId: null,
    targetKind: "workspace",
    targetId: "s1",
    baseRevision: 0,
    title: "Checkout epic",
    rationale: "One epic with two stories.",
    summary: { added: 3, changed: 0, removed: 0 },
    status,
    statusDetail: null,
    savedRevision: null,
    createdAt: T0,
    updatedAt: T0,
    ops: [
      { op: "createEpic", tempId: "$e", title: "Checkout", description: "Goal" },
      { op: "createUserStory", epic: "$e", title: "Add to cart", description: "As a buyer" },
      { op: "createFlow", name: "Checkout flow", ops: [{ op: "addNode", type: "start", label: "S" }] },
    ],
  }) as AiOpBatch;

const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function sse(): Response {
  const batch = workspaceBatch();
  return new Response(
    frame("run.started", { runId: "r1", actionKey: "workspace.assist", provider: "claude" }) +
      frame("step", { id: "s1", label: "Reading your workspace", status: "done" }) +
      frame("progress", { ops: 1, from: 0, newOps: [batch.ops[0]] }) +
      frame("result", result.kind ? result : { kind: "op_batch", batch, value: {} }) +
      frame("done", { runId: "r1", status: "completed" }),
    { status: 200 },
  );
}

const path = (url: string) => new URL(url).pathname.replace("/api/v1/pinnote", "");
const field = () => document.querySelector<HTMLTextAreaElement>(".wpn-ai-composer__field")!;

async function mount(request: Partial<Parameters<typeof AiWorkspaceDialog>[0]["request"]> = {}) {
  act(() =>
    root.render(
      createElement(
        AiRuntimeContext.Provider,
        { value: runtime.value },
        createElement(AiWorkspaceDialog, {
          request: { nonce: 1, ...request },
          onClose,
        }),
      ),
    ),
  );
  await flush();
}

async function ask(text: string) {
  typeInto(field(), text);
  press(field(), "Enter");
  await flush(30);
}

const doneResult: WorkspaceApplyResult = {
  items: [
    { index: 0, op: "createEpic", kind: "epic", action: "created", label: "Checkout", status: "done", id: "e1" },
    { index: 1, op: "createUserStory", kind: "user_story", action: "created", label: "Add to cart", status: "done", id: "s1" },
    { index: 2, op: "createFlow", kind: "flow", action: "created", label: "Checkout flow", status: "done", id: "f1" },
  ],
  done: 3,
  failed: 0,
};

beforeEach(() => {
  resetAiWarmThrottle();
  runs = [];
  result = {};
  apply.mockReset().mockResolvedValue(doneResult);
  discard.mockReset().mockResolvedValue(undefined);
  openReference.mockReset();
  onClose.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  runtime = fakeRuntime({ me: aiMe({ connectors: [connector("claude")] }) });
  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    const route = path(url);
    if (route === "/ai/warm") return jsonResponse({}, 202);
    if (route === "/ai/actions/chats") return jsonResponse([]);
    if (route === "/ai/actions/history") return jsonResponse({ aiSessionId: null, messages: [], hasMore: false });
    const match = /^\/ai\/actions\/([^/]+)\/run$/.exec(route);
    if (match) {
      runs.push({ actionKey: decodeURIComponent(match[1]!), body: JSON.parse(String(init?.body)) });
      return sse();
    }
    throw new Error(`unexpected ${init?.method ?? "GET"} ${route}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("AiWorkspaceDialog", () => {
  it("sends the request to workspace.assist with the tagged epic and a new chat", async () => {
    await mount({
      mentions: [{ kind: "epic", id: "e9", label: "Checkout" }],
      selection: ["e9"],
    });
    await ask("Add user stories");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      actionKey: "workspace.assist",
      body: {
        prompt: "Add user stories",
        targetId: "p1",
        newChat: true,
        selection: ["e9"],
        mentions: [{ kind: "epic", id: "e9", label: "Checkout" }],
        provider: "claude",
      },
    });
  });

  it("lists the proposed changes and creates nothing until approved", async () => {
    await mount();
    await ask("Create a checkout epic");
    const card = document.querySelector(".wpn-ai-ws__proposal")!;
    expect(card.textContent).toContain("Checkout epic");
    expect(card.textContent).toContain("1 epic");
    expect(card.textContent).toContain("1 user story");
    expect(card.textContent).toContain("Checkout flow");
    expect(card.textContent).not.toContain("As a buyer");
    click(buttonByText(card as HTMLElement, "Expand all"));
    expect(card.textContent).toContain("Add to cart");
    expect(card.textContent).toContain("Goal");
    expect(card.textContent).toContain("As a buyer");
    expect(apply).not.toHaveBeenCalled();
  });

  it("creates everything on Approve and offers to open what was made", async () => {
    await mount();
    await ask("Create a checkout epic");
    click(buttonByText(document.body, "Approve & create"));
    await flush(20);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[0]).toMatchObject({ aiOpBatchId: "wb1", targetKind: "workspace" });
    const card = document.querySelector(".wpn-ai-ws__proposal")!;
    expect(card.textContent).toContain("1 epic created, 1 user story created, 1 flow created");
    expect(buttonByText(document.body, "Approve & create")).toBeNull();
    click(buttonByText(card as HTMLElement, "Open"));
    expect(openReference).toHaveBeenCalledWith({ kind: "epic", id: "e1" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows what failed and keeps the rest when some changes are skipped", async () => {
    apply.mockResolvedValue({
      items: [
        doneResult.items[0],
        { index: 1, op: "createUserStory", kind: "user_story", action: "created", label: "Add to cart", status: "failed", error: "Title is too long" },
        { index: 2, op: "createFlow", kind: "flow", action: "created", label: "Checkout flow", status: "done", id: "f1" },
      ],
      done: 2,
      failed: 1,
    });
    await mount();
    await ask("Create a checkout epic");
    click(buttonByText(document.body, "Approve & create"));
    await flush(20);
    const card = document.querySelector(".wpn-ai-ws__proposal")!;
    expect(card.textContent).toContain("Title is too long");
    expect(card.textContent).toContain("1 change was skipped");
    expect(card.textContent).toContain("1 epic created");
  });

  it("discards a proposal without creating anything", async () => {
    await mount();
    await ask("Create a checkout epic");
    click(buttonByText(document.body, "Discard"));
    await flush(10);
    expect(discard).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    expect(document.querySelector(".wpn-ai-ws__proposal")!.textContent).toContain("Discarded");
  });

  it("shows the AI's questions when it has nothing to create", async () => {
    result = {
      kind: "json",
      value: { title: "Need more detail", rationale: "", questions: ["Which payment providers?"] },
    };
    await mount();
    await ask("Create something");
    expect(document.querySelector(".wpn-ai-ws__note")!.textContent).toContain(
      "Which payment providers?",
    );
    expect(document.querySelector(".wpn-ai-ws__proposal")).toBeNull();
  });

  it("offers starters for a tagged epic and seeds the composer when one is chosen", async () => {
    await mount({ mentions: [{ kind: "epic", id: "e9", label: "Checkout" }] });
    click(buttonByText(document.body, "Add user stories"));
    await flush(5);
    expect(field().value).toContain("user stories");
  });
});
