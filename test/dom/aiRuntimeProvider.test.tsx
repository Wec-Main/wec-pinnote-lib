import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiRuntimeProvider } from "../../src/features/ai/AiRuntimeContext";
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
  fire(type: string, data = "", lastEventId = "") {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ type, data, lastEventId } as MessageEvent<string>);
    }
  }
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

function render() {
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
}

function detailLoads() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith("/ai/sessions/s1")).length;
}

function loadsOf(suffix: string) {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith(suffix)).length;
}

async function settleFrames() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
}

async function reconnectWith(source: FakeEventSource, resumed: boolean): Promise<FakeEventSource> {
  const count = FakeEventSource.instances.length;
  act(() => source.fire("error"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  await flush();
  const next = FakeEventSource.instances[count]!;
  act(() => next.fire("open"));
  act(() => next.fire("ready", JSON.stringify({ projectId: "p1", resumed })));
  await flush();
  return next;
}

describe("AiRuntimeProvider", () => {
  it("opens the stream without waiting for /ai/me", async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (new URL(String(url)).pathname.endsWith("/ai/me")) return new Promise<Response>(() => {});
      return new Response(JSON.stringify(route(String(url), init)), { status: 200 });
    });
    render();
    await flush();
    expect(meState.me).toBeNull();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("reloads the session on ai_resync only while a turn is in flight", async () => {
    render();
    await flush();
    const source = FakeEventSource.instances[0]!;
    act(() => source.emit({ type: "ai_turn.upserted", turn: { ...turn, status: "completed" } }));
    expect(sessionState.draft).toBeNull();
    const loads = detailLoads();

    act(() => source.emit({ type: "ai_resync" }));
    await flush();
    expect(detailLoads()).toBe(loads);

    act(() =>
      source.emit({
        type: "ai_turn.upserted",
        turn: { ...turn, aiTurnId: "t3", status: "running" },
      }),
    );
    act(() => source.emit({ type: "ai_resync" }));
    await flush();
    expect(detailLoads()).toBe(loads + 1);
  });

  it("keeps sessions on a resumed reconnect and reloads them otherwise", async () => {
    vi.useFakeTimers();
    try {
      render();
      await flush();
      const first = FakeEventSource.instances[0]!;
      act(() => first.fire("open"));
      act(() => first.fire("ready", JSON.stringify({ projectId: "p1", resumed: false })));
      act(() =>
        first.fire("ai_turn.upserted", JSON.stringify({ type: "ai_turn.upserted", turn }), "40"),
      );
      act(() =>
        first.emit({
          type: "ai_delta",
          aiSessionId: "s1",
          aiTurnId: "t1",
          kind: "text",
          text: "Hel",
          seq: 1,
          fromSeq: 1,
        }),
      );
      await settleFrames();
      expect(sessionState.draft?.text).toBe("Hel");
      const before = {
        detail: detailLoads(),
        list: loadsOf("/ai/sessions"),
        me: loadsOf("/ai/me"),
      };

      const second = await reconnectWith(first, true);
      expect(new URL(second.url).searchParams.get("lastEventId")).toBe("40");
      expect(detailLoads()).toBe(before.detail);
      expect(loadsOf("/ai/sessions")).toBe(before.list);
      expect(loadsOf("/ai/me")).toBe(before.me + 1);
      expect(sessionState.draftStore.getDraft()?.text).toBe("Hel");
      expect(sessionState.draftStore.getDraft()?.maybeMissed).toBeUndefined();

      act(() => {
        second.emit({
          type: "ai_snapshot",
          aiSessionId: "s1",
          aiTurnId: "t1",
          kind: "text",
          seq: 5,
          offset: 0,
          length: 9,
          text: "Hello wor",
        });
        second.emit({
          type: "ai_delta",
          aiSessionId: "s1",
          aiTurnId: "t1",
          kind: "text",
          text: "lo w",
          seq: 4,
          fromSeq: 3,
        });
        second.emit({
          type: "ai_delta",
          aiSessionId: "s1",
          aiTurnId: "t1",
          kind: "text",
          text: "ld",
          seq: 6,
          fromSeq: 6,
        });
      });
      await settleFrames();
      expect(sessionState.draftStore.getDraft()?.text).toBe("Hello world");
      expect(sessionState.draftStore.getDraft()?.seq).toBe(6);

      await reconnectWith(second, false);
      expect(detailLoads()).toBe(before.detail + 1);
      expect(loadsOf("/ai/sessions")).toBe(before.list + 1);
      expect(loadsOf("/ai/me")).toBe(before.me + 2);
    } finally {
      vi.useRealTimers();
    }
  });

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
