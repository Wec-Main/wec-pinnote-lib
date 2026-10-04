import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiFloatingButton } from "../../src/features/ai/components/AiFloatingButton";
import { resetAiWarmThrottle } from "../../src/services/aiActionsStreamService";
import {
  AnnotationAuthContext,
  AnnotationUiContext,
  type AnnotationAuthContextValue,
  type AnnotationUiContextValue,
} from "../../src/context/AnnotationContext";
import {
  AiRuntimeContext,
  type AiRuntimeContextValue,
} from "../../src/features/ai/AiRuntimeContext";
import { aiMe, connector, fakeRuntime, flush, jsonResponse, press } from "./aiTestUtils";

vi.mock("../../src/features/ai/components/useAiMentionCandidates", () => ({
  useAiMentionCandidates: () => ({ candidates: [], request: () => undefined }),
}));

vi.mock("../../src/features/ai/components/useAiCardActions", () => ({
  useAiCardActions: () => ({}),
}));

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

function render(
  overrides: Partial<AiRuntimeContextValue> = {},
  ui: Partial<AnnotationUiContextValue> = {},
) {
  const runtime = fakeRuntime({
    me: aiMe({ connectors: [connector("claude"), connector("codex")] }),
    ...overrides,
  });
  act(() =>
    root.render(
      createElement(
        AiRuntimeContext.Provider,
        { value: runtime.value },
        createElement(
          AnnotationAuthContext.Provider,
          { value: { authenticated: true } as unknown as AnnotationAuthContextValue },
          createElement(
            AnnotationUiContext.Provider,
            {
              value: {
                dataModelOpen: false,
                flowOpen: false,
                ...ui,
              } as unknown as AnnotationUiContextValue,
            },
            createElement(AiFloatingButton),
          ),
        ),
      ),
    ),
  );
}

const fab = () => document.body.querySelector<HTMLButtonElement>(".wpn-ai-fab")!;
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

async function openDialog() {
  act(() => fab().click());
  await flush();
}

beforeEach(() => {
  resetAiWarmThrottle();
  fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/ai/sessions")) return jsonResponse([]);
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  window.localStorage.clear();
  window.sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  await flush();
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("AI floating dialog", () => {
  it("opens a modal dialog, warms the AI and shows suggestions for the surface", async () => {
    render({}, { dataModelOpen: true });
    await flush();
    expect(fab().getAttribute("data-state")).toBe("idle");
    await openDialog();
    const box = dialog()!;
    expect(box.getAttribute("role")).toBe("dialog");
    expect(box.contains(document.activeElement)).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/ai/warm"))).toBe(true);
    expect(box.textContent).toContain("Review this data model");
    expect(box.textContent).toContain("New chat");
    expect(box.querySelector('[aria-label="Expand AI chat"]')).not.toBeNull();
  });

  it("traps Tab inside, closes on Esc and returns focus to the button", async () => {
    render();
    await flush();
    await openDialog();
    const box = dialog()!;
    const focusables = [
      ...box.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea:not([disabled]), input:not([disabled])",
      ),
    ].filter((element) => !element.closest("[hidden]"));
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    act(() => last.focus());
    press(last, "Tab");
    expect(document.activeElement).toBe(first);
    press(first, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(last);

    press(document.body, "Escape");
    await flush();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(fab());
  });

  it("shows a Reconnecting banner while the stream is down", async () => {
    render({ connection: "reconnecting" });
    await flush();
    await openDialog();
    expect(dialog()?.textContent).toContain("Reconnecting…");
  });

  it("becomes a full-screen sheet on narrow screens", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });
    render();
    await flush();
    await openDialog();
    expect(dialog()?.classList.contains("wpn-ai-dialog--sheet")).toBe(true);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  });
});
