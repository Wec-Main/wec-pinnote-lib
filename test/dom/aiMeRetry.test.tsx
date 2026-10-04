import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiRuntimeProvider,
  isRetryableAiMeError,
  useOptionalAiRuntime,
  type AiRuntimeContextValue,
} from "../../src/features/ai/AiRuntimeContext";
import { AnnotationApiError } from "../../src/types/annotation.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class FakeEventSource {
  addEventListener() {}
  close() {}
}

const me = {
  policy: {},
  connectors: [],
  canUseAi: true,
  canApplyModelOps: false,
  canManagePolicy: false,
};

let runtime: AiRuntimeContextValue | null;
let container: HTMLDivElement;
let root: Root;
let meResponses: number[];

function Probe() {
  runtime = useOptionalAiRuntime();
  return null;
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

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

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname.replace("/api/v1/pinnote", "");
      if (path === "/ai/stream/ticket") {
        return new Response(JSON.stringify({ ticket: "tk", expiresInSeconds: 60 }));
      }
      const status = meResponses.shift() ?? 200;
      return status === 200
        ? new Response(JSON.stringify(me), { status })
        : new Response(JSON.stringify({ error: "Service unavailable" }), { status });
    }),
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

describe("AiRuntimeProvider /ai/me retry", () => {
  it("recovers on its own after a temporary failure", async () => {
    meResponses = [503];
    render();
    await flush();
    expect(runtime?.me).toBeNull();
    expect(runtime?.meError).toBeTruthy();
    expect(runtime?.meRetrying).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    await flush();
    expect(runtime?.me?.canUseAi).toBe(true);
    expect(runtime?.meError).toBeNull();
    expect(runtime?.meRetrying).toBe(false);
  });

  it("does not retry a permanent failure", async () => {
    meResponses = [403];
    render();
    await flush();
    expect(runtime?.meError).toBeTruthy();
    expect(runtime?.meRetrying).toBe(false);
    const calls = vi.mocked(fetch).mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
  });

  it("classifies errors", () => {
    expect(isRetryableAiMeError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableAiMeError(new AnnotationApiError("x", 503))).toBe(true);
    expect(isRetryableAiMeError(new AnnotationApiError("x", 429))).toBe(true);
    expect(isRetryableAiMeError(new AnnotationApiError("x", 401))).toBe(false);
    expect(isRetryableAiMeError(new AnnotationApiError("x", 404))).toBe(false);
  });
});
