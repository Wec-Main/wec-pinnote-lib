import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationsTab } from "../../src/components/Settings/IntegrationsTab";
import { AiRuntimeContext } from "../../src/context/AiRuntimeContext";
import {
  AnnotationUiContext,
  type AnnotationUiContextValue,
} from "../../src/context/AnnotationContext";
import { useAiSessions, type AiSessionsState } from "../../src/hooks/useAiSessions";
import type { AiMe, AiSession } from "../../src/types/ai.types";
import { aiMe, fakeRuntime } from "./aiTestUtils";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

function renderIntegrations(me: AiMe | null, meLoading: boolean) {
  const runtime = fakeRuntime({ me, meLoading });
  const ui = { setUserManagementOpen: vi.fn() } as unknown as AnnotationUiContextValue;
  act(() =>
    root.render(
      createElement(
        AnnotationUiContext.Provider,
        { value: ui },
        createElement(
          AiRuntimeContext.Provider,
          { value: runtime.value },
          createElement(IntegrationsTab),
        ),
      ),
    ),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { status: 200 })),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Integrations loading", () => {
  it("delays the skeleton, holds it, then fades the content in without changing the shell", () => {
    renderIntegrations(null, true);
    const shell = container.querySelector(".wpn-settings-tab");
    expect(shell).not.toBeNull();
    const shellClass = shell?.className;
    expect(container.querySelector("[data-wpn-loading='skeleton']")).toBeNull();
    expect(container.querySelector("[data-wpn-loading='pending']")).not.toBeNull();

    act(() => void vi.advanceTimersByTime(130));
    expect(container.querySelector("[data-wpn-loading='skeleton']")).not.toBeNull();
    expect(container.querySelectorAll(".wpn-skeleton").length).toBeGreaterThan(0);
    expect(container.querySelector(".wpn-settings-tab")?.className).toBe(shellClass);

    act(() => void vi.advanceTimersByTime(50));
    renderIntegrations(aiMe(), false);
    expect(container.querySelector("[data-wpn-loading='skeleton']")).not.toBeNull();

    act(() => void vi.advanceTimersByTime(400));
    expect(container.querySelector("[data-wpn-loading='skeleton']")).toBeNull();
    const content = container.querySelector(".wpn-settings-tab");
    expect(content?.className).toContain("wpn-settings-tab");
    expect(content?.className).toContain("wpn-reveal");
    expect(container.querySelector(".wpn-ai-subtabs")).not.toBeNull();
    expect(container.querySelectorAll(".wpn-settings-tab")).toHaveLength(1);
  });

  it("shows content immediately when me is already available", () => {
    renderIntegrations(aiMe(), false);
    expect(container.querySelector("[data-wpn-loading='skeleton']")).toBeNull();
    expect(container.querySelector(".wpn-ai-subtabs")).not.toBeNull();
  });
});

function session(id: string, title: string): AiSession {
  return {
    aiSessionId: id,
    title,
    scopeKind: "project",
    scopeId: null,
    archivedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as AiSession;
}

describe("useAiSessions", () => {
  it("keeps the previous list while a new page loads and while revalidating", async () => {
    let resolveSecond: (value: AiSession[]) => void = () => undefined;
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (!String(url).includes("/ai/sessions")) return new Response("[]");
        call += 1;
        if (call === 1) {
          return new Response(JSON.stringify([session("s1", "First")]), { status: 200 });
        }
        const list = await new Promise<AiSession[]>((resolve) => {
          resolveSecond = resolve;
        });
        return new Response(JSON.stringify(list), { status: 200 });
      }),
    );
    let state: AiSessionsState | null = null;
    function Probe() {
      state = useAiSessions({ limit: 1 });
      return null;
    }
    const runtime = fakeRuntime();
    act(() =>
      root.render(
        createElement(AiRuntimeContext.Provider, { value: runtime.value }, createElement(Probe)),
      ),
    );
    await settle();
    expect(state!.sessions.map((s) => s.aiSessionId)).toEqual(["s1"]);
    expect(state!.loading).toBe(false);

    act(() => state!.loadMore());
    await settle();
    expect(state!.sessions.map((s) => s.aiSessionId)).toEqual(["s1"]);
    expect(state!.loading).toBe(false);
    expect(state!.refreshing).toBe(true);

    await act(async () => {
      resolveSecond([session("s1", "First"), session("s2", "Second")]);
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    expect(state!.sessions.map((s) => s.aiSessionId).sort()).toEqual(["s1", "s2"]);
    expect(state!.refreshing).toBe(false);
  });
});
