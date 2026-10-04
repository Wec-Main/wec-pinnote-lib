import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiSessionList,
  SLOW_LOAD_MS,
  filterSessions,
} from "../../src/features/ai/components/AiSessionList";
import type { AiSessionsState } from "../../src/hooks/useAiSessions";
import type { AiSession } from "../../src/types/ai.types";
import { AiRuntimeContext } from "../../src/features/ai/AiRuntimeContext";
import { T0, buttonByText, click, fakeRuntime } from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;

function session(id: string, title: string): AiSession {
  return {
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
  } as AiSession;
}

function state(overrides: Partial<AiSessionsState> = {}): AiSessionsState {
  return {
    sessions: [session("s1", "Checkout flow"), session("s2", "Orders model")],
    loading: false,
    error: null,
    hasMore: false,
    reload: vi.fn(),
    loadMore: vi.fn(),
    rename: vi.fn(async () => null),
    archive: vi.fn(async () => null),
    ...overrides,
  };
}

async function render(value: AiSessionsState) {
  await act(async () => {
    root.render(
      createElement(
        AiRuntimeContext.Provider,
        { value: fakeRuntime().value },
        createElement(
          "div",
          { className: "wpn-ai-panel" },
          createElement(AiSessionList, {
            selectedId: "s1",
            onSelect: vi.fn(),
            onNew: vi.fn(),
            state: value,
          }),
        ),
      ),
    );
  });
}

const menu = () => document.body.querySelector(".wpn-ai-session__menu-panel");

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AiSessionList", () => {
  it("shows the title with a meta line and no inline action buttons", async () => {
    await render(state());
    const row = container.querySelector(".wpn-ai-session-row");
    expect(row?.querySelector(".wpn-ai-session__text")?.textContent).toBe("Checkout flow");
    expect(row?.querySelector(".wpn-ai-session__meta")?.textContent).toContain("Flow");
    expect(row?.querySelector('[aria-label^="Archive"]')).toBeNull();
  });

  it("opens the three-dot menu outside the list so the panel cannot clip it", async () => {
    const value = state();
    await render(value);
    act(() => click(container.querySelector('[aria-label="More options for Orders model"]')));
    const panel = menu();
    expect(panel).not.toBeNull();
    expect(container.contains(panel)).toBe(false);
    expect(panel?.textContent).toContain("Rename");
    expect(panel?.textContent).toContain("Pin");
    await act(async () => click(buttonByText(document.body, "Archive")));
    expect(value.archive).toHaveBeenCalledWith("s2");
    expect(menu()).toBeNull();
  });

  it("lists editor AI chats with a label and an Editor AI filter", async () => {
    const editor = { ...session("s3", "Build a login flow"), kind: "actions" as const };
    await render(state({ sessions: [session("s1", "Checkout flow"), editor] }));
    const rows = [...container.querySelectorAll(".wpn-ai-session-row")];
    expect(rows).toHaveLength(2);
    expect(rows[1]?.querySelector(".wpn-ai-session__kind")).not.toBeNull();
    expect(rows[1]?.querySelector(".wpn-ai-session__meta")?.textContent).toContain("Flow editor");
    expect(rows[0]?.querySelector(".wpn-ai-session__kind")).toBeNull();
    expect(
      filterSessions([session("s1", "A"), editor], "", "editor").map((x) => x.aiSessionId),
    ).toEqual(["s3"]);
  });

  it("explains a slow load and offers Retry", async () => {
    vi.useFakeTimers();
    try {
      const value = state({ sessions: [], loading: true });
      await render(value);
      expect(container.textContent).not.toContain("Still loading");
      await act(async () => {
        vi.advanceTimersByTime(SLOW_LOAD_MS + 50);
      });
      expect(container.textContent).toContain("Still loading your chats");
      act(() => click(buttonByText(container, "Retry")));
      expect(value.reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the error with a Retry button", async () => {
    const value = state({ sessions: [], loading: false, error: "Could not load AI sessions" });
    await render(value);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not load AI sessions",
    );
    act(() => click(buttonByText(container, "Retry")));
    expect(value.reload).toHaveBeenCalledTimes(1);
  });

  it("closes the menu on an outside click", async () => {
    await render(state());
    act(() => click(container.querySelector('[aria-label="More options for Checkout flow"]')));
    expect(menu()).not.toBeNull();
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(menu()).toBeNull();
  });
});
