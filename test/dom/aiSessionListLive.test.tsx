import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiSessionList } from "../../src/features/ai/components/AiSessionList";
import { SESSIONS_TIMEOUT_MS } from "../../src/hooks/useAiSessions";
import { clearResources } from "../../src/utils/resourceCache";
import { AiRuntimeContext } from "../../src/features/ai/AiRuntimeContext";
import { T0, fakeRuntime, flush, jsonResponse } from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

const row = (id: string, title: string) => ({
  aiSessionId: id,
  projectId: "p1",
  title,
  mode: "chat",
  scopeKind: "flow",
  scopeId: "f1",
  provider: "claude",
  model: "default",
  effort: null,
  createdById: "u1",
  createdByName: "Kavi",
  nativeSessionOwnerId: null,
  lastMessageAt: T0,
  createdAt: T0,
  updatedAt: T0,
  archivedAt: null,
  activeTurn: null,
});

beforeEach(() => {
  clearResources();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("AiSessionList with its own data", () => {
  it("loads and shows recent chats", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse([row("s1", "Checkout flow"), row("s2", "Orders model")]),
    );
    const runtime = fakeRuntime();
    await act(async () => {
      root.render(
        createElement(
          AiRuntimeContext.Provider,
          { value: runtime.value },
          createElement(AiSessionList, { selectedId: null, onSelect: vi.fn(), onNew: vi.fn() }),
        ),
      );
    });
    await flush(30);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("kind=all");
    const titles = [...container.querySelectorAll(".wpn-ai-session__text")].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual(["Checkout flow", "Orders model"]);
  });

  it("still loads when a live event arrives before the first response", async () => {
    let respond: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    );
    const runtime = fakeRuntime();
    await act(async () => {
      root.render(
        createElement(
          AiRuntimeContext.Provider,
          { value: runtime.value },
          createElement(AiSessionList, { selectedId: null, onSelect: vi.fn(), onNew: vi.fn() }),
        ),
      );
    });
    await flush(5);
    act(() => runtime.emit({ type: "ai_session.deleted", aiSessionId: "nope" }));
    await flush(5);
    await act(async () => {
      respond(jsonResponse([row("s1", "Checkout flow")]));
    });
    await flush(30);
    expect(container.querySelector(".wpn-ai-session__text")?.textContent).toBe("Checkout flow");
    expect(container.textContent).not.toContain("No chats yet");
  });

  it("gives up on a request that never answers and offers Retry", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
      const runtime = fakeRuntime();
      await act(async () => {
        root.render(
          createElement(
            AiRuntimeContext.Provider,
            { value: runtime.value },
            createElement(AiSessionList, { selectedId: null, onSelect: vi.fn(), onNew: vi.fn() }),
          ),
        );
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SESSIONS_TIMEOUT_MS * 3 + 20_000);
      });
      expect(container.querySelector('[role="alert"]')?.textContent).toContain("too long");
      expect(container.textContent).toContain("Retry");
    } finally {
      vi.useRealTimers();
    }
  });
});
