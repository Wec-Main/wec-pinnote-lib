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
  fire(type: string, data = "") {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ type, data } as MessageEvent<string>);
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

  it("reconnects with backoff and calls onReconnect after the second open", async () => {
    act(() => root.render(createElement(Probe)));
    await flush();
    const first = FakeEventSource.instances[0]!;
    act(() => first.fire("open"));
    act(() => first.fire("error"));
    expect(first.closed).toBe(true);
    expect(state).toBe("reconnecting");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await flush();
    const second = FakeEventSource.instances[1]!;
    act(() => second.fire("open"));
    expect(onReconnect).toHaveBeenCalledTimes(1);
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
