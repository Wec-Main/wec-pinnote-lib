import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStream } from "../../src/hooks/useAiStream";
import type { AiStreamEvent } from "../../src/types/ai.types";
import type { StreamConnectionState } from "../../src/types/stream.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
  }
  fire(type: string, data = "", lastEventId = "") {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ type, data, lastEventId } as MessageEvent<string>);
    }
  }
}

let state: StreamConnectionState;
let container: HTMLDivElement;
let root: Root;
const onEvent = vi.fn();
const onReconnect = vi.fn();

function Probe() {
  state = useAiStream({
    apiBaseUrl: "https://api.example.com",
    projectId: "p1",
    getAuthToken: () => "tok",
    enabled: true,
    onEvent,
    onReconnect,
  });
  return null;
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  onEvent.mockReset();
  onReconnect.mockReset();
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ ticket: "tk", expiresInSeconds: 60 }), { status: 200 }),
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
  vi.useRealTimers();
});

describe("useAiStream", () => {
  it("opens /ai/stream with a ticket and forwards parsed events", async () => {
    act(() => root.render(createElement(Probe)));
    await flush();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/api/v1/pinnote/ai/stream/ticket?projectId=p1",
    );
    const source = FakeEventSource.instances[0]!;
    expect(source.url).toBe("https://api.example.com/api/v1/pinnote/ai/stream?ticket=tk");
    act(() => source.fire("open"));
    expect(state).toBe("open");
    const event: AiStreamEvent = { type: "ai_connectors.updated", connectors: [] };
    act(() => source.fire("ai_connectors.updated", JSON.stringify(event)));
    act(() => source.fire("ai_delta", "{broken"));
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  async function dropAndReconnect(source: FakeEventSource): Promise<FakeEventSource> {
    const count = FakeEventSource.instances.length;
    act(() => source.fire("error"));
    expect(source.closed).toBe(true);
    expect(state).toBe("reconnecting");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await flush();
    expect(FakeEventSource.instances).toHaveLength(count + 1);
    return FakeEventSource.instances[count]!;
  }

  it("reconnects with backoff and calls onReconnect once the second stream is ready", async () => {
    act(() => root.render(createElement(Probe)));
    await flush();
    const first = FakeEventSource.instances[0]!;
    act(() => first.fire("open"));
    act(() => first.fire("ready", JSON.stringify({ projectId: "p1", resumed: false })));
    expect(onReconnect).not.toHaveBeenCalled();
    const second = await dropAndReconnect(first);
    act(() => second.fire("open"));
    expect(onReconnect).not.toHaveBeenCalled();
    act(() => second.fire("ready", JSON.stringify({ projectId: "p1", resumed: false })));
    act(() => second.fire("ready", JSON.stringify({ projectId: "p1", resumed: false })));
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(onReconnect).toHaveBeenCalledWith({ resumed: false });
  });

  it("resumes from the last event id it saw", async () => {
    act(() => root.render(createElement(Probe)));
    await flush();
    const first = FakeEventSource.instances[0]!;
    expect(first.url).not.toContain("lastEventId");
    act(() => first.fire("open"));
    const message = {
      type: "ai_session.deleted",
      aiSessionId: "s1",
    } satisfies AiStreamEvent;
    act(() => first.fire("ai_session.deleted", JSON.stringify(message), "41"));
    act(() => first.fire("ai_session.deleted", JSON.stringify(message), "42"));
    act(() =>
      first.fire(
        "ai_delta",
        JSON.stringify({
          type: "ai_delta",
          aiSessionId: "s1",
          aiTurnId: "t1",
          kind: "text",
          text: "x",
          seq: 1,
          fromSeq: 1,
        }),
      ),
    );
    const second = await dropAndReconnect(first);
    expect(new URL(second.url).searchParams.get("lastEventId")).toBe("42");
    expect(new URL(second.url).searchParams.get("ticket")).toBe("tk");
    act(() => second.fire("open"));
    act(() => second.fire("ready", JSON.stringify({ projectId: "p1", resumed: true })));
    expect(onReconnect).toHaveBeenCalledWith({ resumed: true });
  });

  it("drops a fallback ai_resync that precedes a non-resumed ready", async () => {
    act(() => root.render(createElement(Probe)));
    await flush();
    const first = FakeEventSource.instances[0]!;
    act(() => first.fire("open"));
    act(() =>
      first.fire(
        "ai_session.deleted",
        JSON.stringify({ type: "ai_session.deleted", aiSessionId: "s1" }),
        "7",
      ),
    );
    onEvent.mockReset();
    const second = await dropAndReconnect(first);
    act(() => second.fire("open"));
    act(() => second.fire("ai_resync", "{}"));
    act(() => second.fire("ready", JSON.stringify({ projectId: "p1", resumed: false })));
    expect(onEvent).not.toHaveBeenCalled();
    expect(onReconnect).toHaveBeenCalledWith({ resumed: false });
    act(() => second.fire("ai_resync", "{}"));
    expect(onEvent).toHaveBeenCalledWith({ type: "ai_resync" });
  });

  it("reports unauthenticated when the ticket is forbidden", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "no" }), { status: 403 })),
    );
    act(() => root.render(createElement(Probe)));
    await flush();
    expect(state).toBe("unauthenticated");
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
