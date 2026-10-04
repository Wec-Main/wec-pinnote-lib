import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IDLE_AI_ACTION,
  aiActionReducer,
  useAiAction,
  type UseAiActionResult,
} from "../../src/features/ai/components/useAiAction";
import type { AiActionRunState } from "../../src/types/ai.types";
import { flush } from "./aiTestUtils";

describe("aiActionReducer", () => {
  const started = aiActionReducer(IDLE_AI_ACTION, {
    type: "start",
    actionKey: "erd.edit",
    at: 100,
  });
  const ev = (state: AiActionRunState, event: Parameters<typeof aiActionReducer>[1]) =>
    aiActionReducer(state, event);

  it("keeps a result that arrives before a persistence error and surfaces the error", () => {
    let state = ev(started, {
      type: "batch",
      events: [{ type: "step", id: "read", label: "Reading", status: "running", detail: "3s" }],
      text: "",
      reasoning: "",
      at: 101,
    });
    expect(state.steps).toEqual([
      { id: "read", label: "Reading", status: "running", detail: "3s" },
    ]);
    state = ev(state, {
      type: "event",
      event: { type: "result", kind: "markdown", text: "Answer" },
      at: 102,
    });
    state = ev(state, {
      type: "event",
      event: { type: "error", code: "persist_failed", message: "Could not save", retryable: true },
      at: 103,
    });
    state = ev(state, {
      type: "event",
      event: { type: "done", runId: "r1", status: "failed", aiSessionId: null },
      at: 104,
    });
    expect(state.status).toBe("error");
    expect(state.result).toMatchObject({ kind: "markdown", text: "Answer" });
    expect(state.error).toMatchObject({ code: "persist_failed", message: "Could not save" });
  });

  it("folds a full run into state", () => {
    let state = started;
    expect(state).toMatchObject({ status: "running", actionKey: "erd.edit", startedAt: 100 });
    state = ev(state, {
      type: "event",
      at: 101,
      event: {
        type: "run.started",
        runId: "r1",
        actionKey: "erd.edit",
        provider: "claude",
        model: "m1",
        transport: "bridge",
      },
    });
    state = ev(state, {
      type: "event",
      at: 102,
      event: { type: "step", id: "s1", label: "Reading model", status: "running" },
    });
    state = ev(state, {
      type: "event",
      at: 103,
      event: {
        type: "step",
        id: "s1",
        label: "Reading model",
        status: "done",
        detail: "12 entities",
      },
    });
    state = ev(state, {
      type: "event",
      at: 104,
      event: { type: "step", id: "s2", label: "Planning", status: "running" },
    });
    state = ev(state, { type: "append", text: "Hel", reasoning: "hmm" });
    state = ev(state, { type: "event", at: 105, event: { type: "delta", text: "lo" } });
    state = ev(state, {
      type: "event",
      at: 106,
      event: { type: "progress", ops: 2, from: 0, newOps: [{ op: "a" }, { op: "b" }] },
    });
    state = ev(state, {
      type: "event",
      at: 106,
      event: { type: "progress", ops: 3, from: 2, newOps: [{ op: "c" }] },
    });
    expect(state.partialOps).toEqual([{ op: "a" }, { op: "b" }, { op: "c" }]);
    state = ev(state, {
      type: "event",
      at: 106,
      event: { type: "progress", ops: 1, from: 0, newOps: [{ op: "x" }] },
    });
    expect(state.partialOps).toEqual([{ op: "x" }]);
    state = ev(state, { type: "event", at: 106, event: { type: "progress", ops: 4 } });
    state = ev(state, {
      type: "event",
      at: 107,
      event: { type: "result", kind: "markdown", text: "Hello" },
    });
    state = ev(state, {
      type: "event",
      at: 108,
      event: { type: "usage", inputTokens: 10, outputTokens: 5, ttftMs: 300, durationMs: 900 },
    });
    state = ev(state, {
      type: "event",
      at: 109,
      event: { type: "done", runId: "r1", status: "completed", aiSessionId: "chat-1" },
    });
    expect(state).toEqual({
      status: "done",
      runId: "r1",
      actionKey: "erd.edit",
      provider: "claude",
      model: "m1",
      steps: [
        { id: "s1", label: "Reading model", status: "done", detail: "12 entities" },
        { id: "s2", label: "Planning", status: "done" },
      ],
      text: "Hello",
      reasoning: "hmm",
      progress: 4,
      partialOps: [{ op: "x" }],
      result: { kind: "markdown", text: "Hello" },
      usage: { inputTokens: 10, outputTokens: 5, ttftMs: 300, durationMs: 900 },
      error: null,
      aiSessionId: "chat-1",
      startedAt: 100,
      finishedAt: 109,
    });
  });

  it("ends in error after an error event, and ignores events once settled", () => {
    let state = ev(started, {
      type: "event",
      at: 1,
      event: { type: "error", code: "runtime_busy", message: "Busy", retryable: true },
    });
    state = ev(state, {
      type: "event",
      at: 2,
      event: { type: "done", runId: "r", status: "failed" },
    });
    expect(state.status).toBe("error");
    expect(state.error).toEqual({ code: "runtime_busy", message: "Busy", retryable: true });
    expect(ev(state, { type: "event", at: 3, event: { type: "delta", text: "late" } })).toBe(state);
    expect(ev(state, { type: "cancel", at: 3 })).toBe(state);
  });

  it("cancels a running run and settles a stream that closed without done", () => {
    const withStep = ev(started, {
      type: "event",
      at: 1,
      event: { type: "step", id: "s", label: "x", status: "running" },
    });
    expect(ev(withStep, { type: "cancel", at: 5 })).toMatchObject({
      status: "cancelled",
      finishedAt: 5,
      steps: [{ id: "s", status: "failed" }],
    });
    expect(ev(withStep, { type: "settle", at: 6 })).toMatchObject({
      status: "done",
      steps: [{ id: "s", status: "done" }],
    });
    expect(ev(withStep, { type: "reset" })).toBe(IDLE_AI_ACTION);
  });
});

interface ControlledStream {
  response: Response;
  push: (text: string) => void;
  close: () => void;
}

function controlledStream(signal: AbortSignal | undefined): ControlledStream {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  signal?.addEventListener("abort", () => {
    try {
      controller.error(new DOMException("Aborted", "AbortError"));
    } catch {}
  });
  return {
    response: new Response(body, { status: 200 }),
    push: (text) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

let container: HTMLDivElement;
let root: Root;
let hook: UseAiActionResult;
let streams: ControlledStream[];
let signals: AbortSignal[];
let frames: FrameRequestCallback[];
let renders: number;
let liveText = false;

function Probe() {
  renders++;
  hook = useAiAction({
    apiBaseUrl: "https://api.example.com",
    projectId: "p1",
    getToken: async () => "tok",
    liveText,
  });
  return null;
}

function runFrames() {
  act(() => {
    const pending = frames;
    frames = [];
    for (const callback of pending) callback(0);
  });
}

beforeEach(() => {
  streams = [];
  signals = [];
  frames = [];
  renders = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      const stream = controlledStream(init.signal ?? undefined);
      streams.push(stream);
      return stream.response;
    }),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(Probe)));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  liveText = false;
});

describe("useAiAction", () => {
  it("in live text mode streams text through the store and commits it when the run ends", async () => {
    liveText = true;
    act(() => root.render(createElement(Probe)));
    let done!: Promise<void>;
    act(() => {
      done = hook.run("erd.ask", { prompt: "why" });
    });
    await flush();
    const stream = streams[0]!;
    const notified = vi.fn();
    const off = hook.live.subscribe(notified);
    stream.push(frame("delta", { text: "Hel" }));
    await flush();
    runFrames();
    expect(hook.state.text).toBe("Hel");
    const before = renders;
    stream.push(frame("delta", { text: "lo " }) + frame("reasoning", { text: "r" }));
    await flush();
    runFrames();
    stream.push(frame("delta", { text: "world" }));
    await flush();
    runFrames();
    expect(hook.live.get()).toEqual({ text: "Hello world", reasoning: "r" });
    expect(hook.state.text).toBe("Hel");
    expect(hook.state.reasoning).toBe("r");
    expect(renders - before).toBeLessThanOrEqual(1);
    expect(notified).toHaveBeenCalledTimes(3);
    stream.push(frame("done", { runId: "r1", status: "completed" }));
    stream.close();
    await act(async () => {
      await done;
    });
    off();
    expect(hook.state).toMatchObject({ status: "done", text: "Hello world", reasoning: "r" });
  });

  it("streams a run, batching text deltas, steps and progress into one render per frame", async () => {
    let done!: Promise<void>;
    act(() => {
      done = hook.run("erd.explain", { target: { kind: "data_model", id: "dm1" } });
    });
    await flush();
    expect(hook.state.status).toBe("running");
    const stream = streams[0]!;

    stream.push(frame("step", { id: "s1", label: "Reading", status: "running" }));
    await flush();
    expect(hook.state.steps).toEqual([]);
    runFrames();
    expect(hook.state.steps).toEqual([{ id: "s1", label: "Reading", status: "running" }]);

    const before = renders;
    stream.push(frame("delta", { text: "a" }) + frame("delta", { text: "b" }));
    await flush();
    stream.push(frame("delta", { text: "c" }) + frame("reasoning", { text: "r" }));
    await flush();
    expect(hook.state.text).toBe("");
    expect(renders).toBe(before);
    expect(frames).toHaveLength(1);
    runFrames();
    expect(hook.state.text).toBe("abc");
    expect(hook.state.reasoning).toBe("r");
    expect(renders).toBe(before + 1);

    const beforeProgress = renders;
    stream.push(frame("delta", { text: "d" }) + frame("progress", { ops: 2 }));
    await flush();
    expect(hook.state).toMatchObject({ text: "abc", progress: 0 });
    runFrames();
    expect(hook.state).toMatchObject({ text: "abcd", progress: 2 });
    expect(renders).toBe(beforeProgress + 1);

    stream.push(frame("done", { runId: "r1", status: "completed" }));
    stream.close();
    await act(async () => {
      await done;
    });
    expect(hook.state.status).toBe("done");
    expect(hook.state.finishedAt).not.toBeNull();
  });

  it("stop() aborts the request and marks the run cancelled", async () => {
    let done!: Promise<void>;
    act(() => {
      done = hook.run("chat", { prompt: "hi" });
    });
    await flush();
    streams[0]!.push(frame("delta", { text: "partial" }));
    await flush();
    act(() => hook.stop());
    await act(async () => {
      await done;
    });
    expect(signals[0]!.aborted).toBe(true);
    expect(hook.state.status).toBe("cancelled");
    expect(hook.state.text).toBe("partial");
    expect(hook.state.error).toBeNull();
  });

  it("a new run aborts the previous one and ignores its events", async () => {
    act(() => {
      void hook.run("chat", { prompt: "one" });
    });
    await flush();
    act(() => {
      void hook.run("chat", { prompt: "two" });
    });
    await flush();
    expect(signals[0]!.aborted).toBe(true);
    streams[1]!.push(frame("delta", { text: "second" }));
    await flush();
    runFrames();
    expect(hook.state.text).toBe("second");
    expect(hook.state.status).toBe("running");
  });

  it("reports request errors with their code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "No agent", code: "connector_required" }), {
            status: 409,
          }),
      ),
    );
    await act(async () => {
      await hook.run("comment.summarize", { target: { kind: "annotation", id: "a1" } });
    });
    expect(hook.state.status).toBe("error");
    expect(hook.state.error).toEqual({
      code: "connector_required",
      message: "No agent",
      retryable: false,
    });
  });

  it("aborts the request on unmount", async () => {
    act(() => {
      void hook.run("chat", {});
    });
    await flush();
    act(() => root.unmount());
    expect(signals[0]!.aborted).toBe(true);
    root = createRoot(container);
    act(() => root.render(createElement(Probe)));
  });
});
