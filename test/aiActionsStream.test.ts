import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiActionRequestError,
  createSseParser,
  resetAiWarmThrottle,
  runAiAction,
  toAiActionEvent,
  toRunActionBody,
  toWarmBody,
  warmAi,
  type SseFrame,
} from "../src/services/aiActionsStream";
import type { AiActionEvent } from "../src/types/ai.types";

function collect(chunks: string[]): SseFrame[] {
  const frames: SseFrame[] = [];
  const parser = createSseParser((frame) => frames.push(frame));
  for (const chunk of chunks) parser.push(chunk);
  parser.flush();
  return frames;
}

function streamResponse(chunks: (string | Uint8Array)[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
}

describe("createSseParser", () => {
  it("parses frames split at arbitrary chunk boundaries", () => {
    const stream =
      'event: step\ndata: {"id":"s1","label":"Reading","status":"running"}\n\n' +
      'event: delta\ndata: {"text":"Hel"}\n\nevent: delta\ndata: {"text":"lo"}\n\n';
    const whole = collect([stream]);
    expect(whole.map((frame) => frame.event)).toEqual(["step", "delta", "delta"]);
    for (let cut = 1; cut < stream.length; cut++) {
      expect(collect([stream.slice(0, cut), stream.slice(cut)])).toEqual(whole);
    }
    expect(collect(stream.split(""))).toEqual(whole);
  });

  it("ignores comments such as `: ping` and frames without data", () => {
    expect(
      collect([": ping\n\n", 'event: delta\n: keep-alive\ndata: {"text":"a"}\n\n', "event: x\n\n"]),
    ).toEqual([{ event: "delta", data: '{"text":"a"}' }]);
  });

  it("joins multi-line data with newlines and handles CRLF / CR endings", () => {
    expect(collect(["data: line 1\r\ndata: line 2\r", "\n\r\n"])).toEqual([
      { event: "message", data: "line 1\nline 2" },
    ]);
    expect(collect(["event: a\rdata: x\r\r"])).toEqual([{ event: "a", data: "x" }]);
    expect(collect(["data:no-space\ndata:  two\n\n"])).toEqual([
      { event: "message", data: "no-space\n two" },
    ]);
  });

  it("flushes a final frame missing its blank line", () => {
    expect(collect(["event: done\ndata: {}"])).toEqual([{ event: "done", data: "{}" }]);
  });
});

describe("toAiActionEvent", () => {
  it("takes the type from the event name, else from the payload", () => {
    expect(toAiActionEvent({ event: "delta", data: '{"text":"x"}' })).toEqual({
      type: "delta",
      text: "x",
    });
    expect(toAiActionEvent({ event: "message", data: '{"type":"progress","ops":3}' })).toEqual({
      type: "progress",
      ops: 3,
    });
  });

  it("drops unknown and malformed frames", () => {
    expect(toAiActionEvent({ event: "mystery", data: "{}" })).toBeNull();
    expect(toAiActionEvent({ event: "delta", data: "{not json" })).toBeNull();
    expect(toAiActionEvent({ event: "delta", data: "[1]" })).toBeNull();
  });
});

describe("runAiAction", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails with stream_interrupted when the stream ends without done or result", async () => {
    fetchMock.mockResolvedValue(streamResponse(['event: delta\ndata: {"text":"a"}\n\n']));
    const error = await runAiAction({
      apiBaseUrl: "https://api.example.com",
      authToken: "tok",
      projectId: "p1",
      actionKey: "erd.explain",
      body: {},
      onEvent: () => undefined,
    }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AiActionRequestError);
    expect((error as AiActionRequestError).code).toBe("stream_interrupted");
  });

  it("aborts and fails when the stream goes idle", async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
        },
      });
      return new Response(body, { status: 200 });
    });
    const error = await runAiAction({
      apiBaseUrl: "https://api.example.com",
      authToken: "tok",
      projectId: "p1",
      actionKey: "erd.explain",
      body: {},
      idleTimeoutMs: 20,
      onEvent: () => undefined,
    }).catch((err: unknown) => err);
    expect((error as AiActionRequestError).code).toBe("stream_interrupted");
  });

  it("posts to the action route with auth headers and streams typed events", async () => {
    const encoder = new TextEncoder();
    const euro = encoder.encode('event: delta\ndata: {"text":"€"}\n\n');
    fetchMock.mockResolvedValue(
      streamResponse([
        ': ping\n\nevent: run.started\ndata: {"runId":"r1","actionKey":"erd.explain",',
        '"provider":"claude","model":"m","transport":"bridge"}\n\n',
        euro.slice(0, euro.length - 5),
        euro.slice(euro.length - 5),
        'event: done\ndata: {"runId":"r1","status":"completed"}\n\n',
      ]),
    );
    const events: AiActionEvent[] = [];
    await runAiAction({
      apiBaseUrl: "https://api.example.com",
      authToken: "tok",
      projectId: "p1",
      actionKey: "erd.explain",
      body: { targetId: "dm1", prompt: "why", selection: [], model: "" },
      onEvent: (event) => events.push(event),
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.example.com/api/v1/pinnote/ai/actions/erd.explain/run?projectId=p1",
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer tok",
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({ targetId: "dm1", prompt: "why" });
    expect(events).toEqual([
      {
        type: "run.started",
        runId: "r1",
        actionKey: "erd.explain",
        provider: "claude",
        model: "m",
        transport: "bridge",
      },
      { type: "delta", text: "€" },
      { type: "done", runId: "r1", status: "completed" },
    ]);
  });

  it("throws the top-level error code on a non-2xx JSON answer", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Connect an agent", code: "connector_required" }), {
        status: 409,
      }),
    );
    const error = await runAiAction({
      apiBaseUrl: "https://api.example.com",
      authToken: "tok",
      projectId: "p1",
      actionKey: "chat",
      body: {},
      onEvent: () => undefined,
    }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AiActionRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "connector_required",
      message: "Connect an agent",
    });
  });

  it.each([
    [422, "no_context", "Mark comments with 'Add to AI context' to use this action"],
    [429, "rate_limited", "You already have several AI actions running; wait for one to finish"],
    [503, "runtime_busy", "The AI runtime is busy; try again shortly"],
    [404, "unknown_action", "Unknown AI action nope"],
    [400, "target_required", "targetId is required for this action"],
  ])("surfaces the API error %s %s before the stream starts", async (status, code, error) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error, details: { code }, code }), { status }),
    );
    await expect(
      runAiAction({
        apiBaseUrl: "https://api.example.com",
        authToken: "tok",
        projectId: "p1",
        actionKey: "erd.explain",
        body: { targetId: "dm1" },
        onEvent: () => undefined,
      }),
    ).rejects.toMatchObject({ status, code, message: error });
  });

  it("falls back to details.code", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Busy", details: { code: "runtime_busy" } }), {
        status: 429,
      }),
    );
    await expect(
      runAiAction({
        apiBaseUrl: "https://api.example.com",
        authToken: undefined,
        projectId: "p1",
        actionKey: "chat",
        body: {},
        onEvent: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "runtime_busy", status: 429 });
  });
});

describe("warmAi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetAiWarmThrottle();
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts once a minute per provider with a body the API accepts", () => {
    warmAi("https://api.example.com", "tok", "p1", { provider: "claude", model: "m" }, 1_000);
    warmAi("https://api.example.com", "tok", "p1", { provider: "claude" }, 30_000);
    warmAi("https://api.example.com", "tok", "p1", { provider: "codex" }, 30_000);
    warmAi("https://api.example.com", "tok", "p1", null, 30_000);
    warmAi("https://api.example.com", "tok", "p1", { provider: "claude" }, 61_001);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/v1/pinnote/ai/warm?projectId=p1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ provider: "claude", model: "m" });
    expect(
      JSON.parse((fetchMock.mock.calls[2] as [string, RequestInit])[1].body as string),
    ).toEqual({});
  });
});

describe("request bodies", () => {
  it("keeps only the run fields the API schema allows", () => {
    expect(
      toRunActionBody({
        targetId: "dm1",
        prompt: "  ",
        selection: ["e1", "", "e1", "e2"],
        inputs: { draft: "hi" },
        provider: "claude",
        model: " ",
        effort: null,
      }),
    ).toEqual({
      targetId: "dm1",
      selection: ["e1", "e2"],
      inputs: { draft: "hi" },
      provider: "claude",
      effort: null,
    });
    expect(toRunActionBody({})).toEqual({});
  });

  it("sends the chat to continue, or a new chat, so the server uses the one the user picked", () => {
    expect(toRunActionBody({ targetId: "f1", sessionId: "s-1" })).toEqual({
      targetId: "f1",
      sessionId: "s-1",
    });
    expect(toRunActionBody({ targetId: "f1", newChat: true })).toEqual({
      targetId: "f1",
      newChat: true,
    });
    expect(toRunActionBody({ sessionId: "s-1", newChat: true })).toEqual({ newChat: true });
  });

  it("drops empty warm fields", () => {
    expect(toWarmBody({ provider: "codex", model: "", effort: "" })).toEqual({ provider: "codex" });
    expect(toWarmBody(undefined)).toEqual({});
  });
});
