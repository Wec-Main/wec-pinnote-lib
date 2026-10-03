import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiRuntimeProvider } from "../../src/context/AiRuntimeContext";
import { useAiMe, type AiMeState } from "../../src/hooks/useAiMe";
import { useAiSession, type AiSessionState } from "../../src/hooks/useAiSession";
import { useAiSessions, type AiSessionsState } from "../../src/hooks/useAiSessions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {}
  emit(event: { type: string }) {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener({ type: event.type, data: JSON.stringify(event) } as MessageEvent<string>);
    }
  }
}

const T0 = "2026-01-01T00:00:00.000Z";
const turn = { aiTurnId: "t1", aiSessionId: "s1", status: "running" };
const session = {
  aiSessionId: "s1",
  projectId: "p1",
  scopeKind: "project",
  scopeId: null,
  createdById: "u1",
  archivedAt: null,
  lastMessageAt: T0,
  createdAt: T0,
  updatedAt: T0,
  activeTurn: turn,
};
const me = {
  providers: ["claude", "codex"],
  connectors: [
    { provider: "claude", status: "signed_out" },
    { provider: "codex", status: "signed_out" },
  ],
  canUseAi: true,
  canApplyModelOps: true,
};

let meState: AiMeState;
let sessionState: AiSessionState;
let listState: AiSessionsState;
let container: HTMLDivElement;
let root: Root;

function Probe() {
  meState = useAiMe();
  sessionState = useAiSession("s1");
  listState = useAiSessions({});
  return null;
}

function route(url: string, init?: RequestInit): unknown {
  const path = new URL(url).pathname.replace("/api/v1/pinnote", "");
  if (path === "/ai/stream/ticket") return { ticket: "tk", expiresInSeconds: 60 };
  if (path === "/ai/me") return me;
  if (path === "/ai/sessions") return [session];
  if (path === "/ai/sessions/s1") {
    return {
      session,
      messages: [],
      hasMoreMessages: false,
      opBatches: [],
      commentDrafts: [],
    };
  }
  if (path === "/ai/sessions/s1/messages" && init?.method === "POST") {
    return {
      message: {
        aiMessageId: "m1",
        aiSessionId: "s1",
        aiTurnId: "t2",
        role: "user",
        content: { type: "text", text: "hi" },
        createdAt: T0,
        updatedAt: T0,
      },
      turn: { aiTurnId: "t2", aiSessionId: "s1", status: "queued" },
    };
  }
  throw new Error(`unexpected ${path}`);
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string, init?: RequestInit) =>
        new Response(JSON.stringify(route(url, init)), { status: 200 }),
    ),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("AiRuntimeProvider", () => {
  it("shares one stream between hooks and keeps them live", async () => {
    act(() =>
      root.render(
        createElement(
          AiRuntimeProvider,
          {
            apiBaseUrl: "https://api.example.com",
            projectId: "p1",
            getAuthToken: () => "tok",
            enabled: true,
          },
          createElement(Probe),
        ),
      ),
    );
    await flush();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(meState.me?.canUseAi).toBe(true);
    expect(sessionState.detail?.session.aiSessionId).toBe("s1");
    expect(listState.sessions).toHaveLength(1);

    const source = FakeEventSource.instances[0]!;
    act(() => {
      source.emit({
        type: "ai_delta",
        aiSessionId: "s1",
        aiTurnId: "t1",
        kind: "text",
        text: "Hel",
        seq: 1,
      });
      source.emit({
        type: "ai_delta",
        aiSessionId: "s1",
        aiTurnId: "t1",
        kind: "text",
        text: "lo",
        seq: 2,
      });
      source.emit({
        type: "ai_connectors.updated",
        connectors: [{ provider: "codex", status: "connected" }],
      });
    });
    expect(sessionState.draft?.text).toBe("Hello");
    expect(meState.me?.connectors).toEqual([
      { provider: "claude", status: "signed_out" },
      { provider: "codex", status: "connected" },
    ]);

    act(() => source.emit({ type: "ai_turn.upserted", turn: { ...turn, status: "completed" } }));
    expect(sessionState.draft).toBeNull();
    expect(sessionState.detail?.session.activeTurn).toBeNull();

    await act(async () => {
      await sessionState.send({ text: "hi" });
    });
    expect(sessionState.detail?.messages.map((m) => m.aiMessageId)).toEqual(["m1"]);
    expect(sessionState.turns.t2?.status).toBe("queued");
  });
});
