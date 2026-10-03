import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeMessages, EMPTY_MESSAGE_STORE } from "../../src/ai/sessionReducer";
import { AiTranscript, type AiTranscriptProps } from "../../src/components/Ai/AiTranscript";
import type { AiSessionState } from "../../src/hooks/useAiSession";
import type { AiMessage, AiSession, AiTurn } from "../../src/types/ai.types";
import { AI_ERROR_TEXT } from "../../src/components/Ai/aiHelpers";
import { T0, buttonByText, click } from "./aiTestUtils";

const openMention = vi.hoisted(() => vi.fn());

vi.mock("../../src/components/Ai/useAiCardActions", () => ({
  useAiCardActions: () => ({
    openMention,
    previewBatch: vi.fn(),
    rejectBatch: vi.fn(),
    openBatch: vi.fn(),
    postDraft: vi.fn(),
    discardDraft: vi.fn(),
    openAnnotation: vi.fn(),
  }),
}));

const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();

function msg(id: string, seconds: number, overrides: Partial<AiMessage> = {}): AiMessage {
  return {
    aiMessageId: id,
    aiSessionId: "s1",
    aiTurnId: "t1",
    authorId: null,
    authorName: null,
    role: "assistant",
    content: { type: "text", text: `answer ${id}` },
    createdAt: at(seconds),
    updatedAt: at(seconds),
    ...overrides,
  };
}

function userMsg(id: string, seconds: number, text: string, turnId = "t1"): AiMessage {
  return msg(id, seconds, {
    role: "user",
    authorId: "u1",
    aiTurnId: turnId,
    content: { type: "text", text },
  });
}

function aTurn(overrides: Partial<AiTurn> = {}): AiTurn {
  return {
    aiTurnId: "t1",
    aiSessionId: "s1",
    userId: "u1",
    userName: null,
    provider: "claude",
    model: "m",
    effort: null,
    mode: "model",
    status: "completed",
    errorCode: null,
    errorMessage: null,
    usage: null,
    createdAt: T0,
    startedAt: at(0),
    finishedAt: at(3),
    ...overrides,
  };
}

function aSession(activeTurn: AiTurn | null = null): AiSession {
  return {
    aiSessionId: "s1",
    projectId: "p1",
    title: "Chat",
    mode: "model",
    scopeKind: "project",
    scopeId: null,
    provider: "claude",
    model: "m",
    effort: null,
    createdById: "u1",
    createdByName: null,
    nativeSessionOwnerId: null,
    lastMessageAt: T0,
    createdAt: T0,
    updatedAt: T0,
    archivedAt: null,
    activeTurn,
  };
}

function state(
  messages: AiMessage[],
  turns: Record<string, AiTurn> = {},
  activeTurn: AiTurn | null = null,
): AiSessionState {
  const store = mergeMessages(EMPTY_MESSAGE_STORE, messages);
  return {
    detail: {
      session: aSession(activeTurn),
      messages,
      hasMoreMessages: false,
      opBatches: [],
      commentDrafts: [],
    },
    messages: store,
    turns,
    draft: null,
    deleted: false,
    loading: false,
    error: null,
    errorStatus: null,
    loadingOlder: false,
    send: vi.fn(),
    interrupt: vi.fn(),
    update: vi.fn(),
    loadOlder: vi.fn(async () => undefined),
    reload: vi.fn(),
  };
}

let container: HTMLDivElement;
let root: Root;
const onRetry = vi.fn();
const onRetryWithProvider = vi.fn();
const onOpenIntegrations = vi.fn();
const onEditLast = vi.fn();

function render(session: AiSessionState, props: Partial<AiTranscriptProps> = {}) {
  act(() =>
    root.render(
      createElement(AiTranscript, {
        session,
        currentUserId: "u1",
        canApplyModelOps: true,
        canSwitchProvider: true,
        onRetry,
        onRetryWithProvider,
        onOpenIntegrations,
        onEditLast,
        ...props,
      }),
    ),
  );
}

const scroller = () => container.querySelector<HTMLElement>('[data-testid="ai-transcript"]')!;

function metrics(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => clientHeight });
}

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AiTranscript", () => {
  it("renders user bubbles with their line breaks and the assistant full width", () => {
    render(state([userMsg("u", 0, "line one\nline two"), msg("a", 1)], { t1: aTurn() }));
    const bubble = container.querySelector(".wpn-ai-msg--user .wpn-ai-msg__text")!;
    expect(bubble.textContent).toBe("line one\nline two");
    expect(container.querySelector(".wpn-ai-row--assistant .wpn-ai-msg--assistant")).not.toBeNull();
    expect(buttonByText(container, "Copy")).not.toBeNull();
    expect(buttonByText(container, "Good response")).not.toBeNull();
    click(buttonByText(container, "Edit and resend"));
    expect(onEditLast).toHaveBeenCalledWith(expect.objectContaining({ aiMessageId: "u" }));
    click(buttonByText(container, "Bad response"));
    expect(buttonByText(container, "Bad response")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("collapses tool steps into Worked for … and resolves running chips once the turn ended", () => {
    const tool = (id: string, status: "running" | "ok") =>
      msg(id, 1, {
        role: "tool",
        content: { type: "tool", toolCallId: id, name: "read", status, summary: `Read ${id}` },
      });
    render(
      state([userMsg("u", 0, "go"), tool("x1", "ok"), tool("x2", "running"), msg("a", 2)], {
        t1: aTurn({ status: "interrupted" }),
      }),
    );
    const toggle = buttonByText(container, /Worked for 3\.0s · 2 steps/)!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    click(toggle);
    const steps = [...container.querySelectorAll(".wpn-ai-turn__steps .wpn-ai-step")];
    expect(steps.map((step) => step.getAttribute("data-status"))).toEqual(["done", "stopped"]);
  });

  it("offers actions that fit the error code", () => {
    const failed = (errorCode: string) =>
      state([userMsg("u", 0, "go"), msg("a", 1)], {
        t1: aTurn({ status: "failed", errorCode, errorMessage: "raw" }),
      });

    render(failed("rate_limited"));
    expect(container.textContent).toContain(AI_ERROR_TEXT.rate_limited);
    click(buttonByText(container, "Retry"));
    expect(onRetry).toHaveBeenCalled();
    click(buttonByText(container, "Retry with other provider"));
    expect(onRetryWithProvider).toHaveBeenCalled();
    expect(buttonByText(container, "Open Integrations")).toBeNull();

    render(failed("auth_expired"));
    expect(buttonByText(container, "Retry")).toBeNull();
    click(buttonByText(container, "Open Integrations"));
    expect(onOpenIntegrations).toHaveBeenCalled();

    render(failed("forbidden"));
    expect(container.querySelector(".wpn-ai-failure__actions")).toBeNull();

    for (const code of [
      "provider_error",
      "internal",
      "session_reset",
      "session_not_found",
      "runner_lost",
    ]) {
      render(failed(code));
      expect(container.textContent).toContain(AI_ERROR_TEXT[code]);
    }

    render(failed("internal"), { canSwitchProvider: false });
    expect(buttonByText(container, "Retry with other provider")).toBeNull();
  });

  it("auto-scrolls near the bottom, otherwise shows Jump to latest", () => {
    const base = [userMsg("u", 0, "go"), msg("a", 1)];
    render(state(base, { t1: aTurn() }));
    const el = scroller();
    metrics(el, 1000, 300);
    render(state([...base, msg("b", 2)], { t1: aTurn() }));
    expect(el.scrollTop).toBe(1000);
    expect(buttonByText(container, "Jump to latest")).toBeNull();

    el.scrollTop = 100;
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    metrics(el, 1400, 300);
    render(state([...base, msg("b", 2), msg("c", 3)], { t1: aTurn() }));
    expect(el.scrollTop).toBe(100);
    const jump = buttonByText(container, "Jump to latest");
    expect(jump).not.toBeNull();
    click(jump);
    expect(buttonByText(container, "Jump to latest")).toBeNull();

    el.scrollTop = 1100;
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    metrics(el, 1800, 300);
    render(state([...base, msg("b", 2), msg("c", 3), msg("d", 4)], { t1: aTurn() }));
    expect(el.scrollTop).toBe(1800);
  });

  it("keeps the scroll position when older messages load", () => {
    const base = [userMsg("u", 10, "go"), msg("a", 11)];
    const first = state(base, { t1: aTurn() });
    first.detail!.hasMoreMessages = true;
    render(first);
    const el = scroller();
    metrics(el, 1000, 300);
    el.scrollTop = 0;
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    click(buttonByText(container, "Load earlier messages"));
    expect(first.loadOlder).toHaveBeenCalled();
    metrics(el, 1600, 300);
    render(state([msg("old", 1, { aiTurnId: "t0" }), ...base], { t1: aTurn() }));
    expect(el.scrollTop).toBe(600);
  });

  it("announces status through one small live region", () => {
    const live = aTurn({ status: "running", finishedAt: null });
    render(state([userMsg("u", 0, "go")], { t1: live }, live));
    const regions = container.querySelectorAll("[aria-live]");
    expect(regions).toHaveLength(1);
    expect(regions[0]?.textContent).toBe("AI is responding");
    expect(scroller().getAttribute("aria-live")).toBeNull();
  });

  it("opens a tagged flow when its chip in a user message is clicked", () => {
    openMention.mockReset();
    const mention = { kind: "flow" as const, id: "f1", label: "Checkout flow" };
    const tagged = userMsg("m1", 1, "add a refund step");
    tagged.content = { type: "text", text: "add a refund step", mentions: [mention] };
    render(state([tagged]));
    const chip = container.querySelector<HTMLButtonElement>(".wpn-ai-mention__open");
    expect(chip?.getAttribute("aria-label")).toBe("Open flow: Checkout flow");
    act(() => click(chip));
    expect(openMention).toHaveBeenCalledWith(mention);
  });
});
