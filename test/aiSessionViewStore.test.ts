import { describe, expect, it, vi } from "vitest";
import { EMPTY_AI_SESSION_VIEW } from "../src/ai/sessionReducer";
import { AiSessionViewStore } from "../src/ai/sessionViewStore";
import { buildTranscriptRows } from "../src/components/Ai/AiTranscript";
import { createClientMessageId, parseAiStreamEvent } from "../src/utils/aiStreamGuards";
import type { AiMessage, AiStreamEvent } from "../src/types/ai.types";

function manualScheduler() {
  let pending: (() => void) | null = null;
  return {
    scheduler: {
      request: (run: () => void) => {
        pending = run;
        return 1;
      },
      cancel: () => {
        pending = null;
      },
    },
    runFrame: () => {
      const run = pending;
      pending = null;
      run?.();
    },
  };
}

const delta = (seq: number, text: string): AiStreamEvent => ({
  type: "ai_delta",
  aiSessionId: "s1",
  aiTurnId: "t1",
  kind: "text",
  seq,
  text,
});

describe("AiSessionViewStore", () => {
  it("batches deltas into one draft update per frame without touching the view", () => {
    const { scheduler, runFrame } = manualScheduler();
    const store = new AiSessionViewStore(EMPTY_AI_SESSION_VIEW, "s1", scheduler);
    const draftListener = vi.fn();
    const viewListener = vi.fn();
    store.subscribe(draftListener);
    store.subscribeView(viewListener);
    store.dispatch(delta(1, "a"));
    store.dispatch(delta(2, "b"));
    store.dispatch(delta(3, "c"));
    expect(draftListener).not.toHaveBeenCalled();
    runFrame();
    expect(draftListener).toHaveBeenCalledTimes(1);
    expect(store.getDraft()?.text).toBe("abc");
    expect(viewListener).toHaveBeenCalledTimes(1);
    store.dispatch(delta(4, "d"));
    runFrame();
    expect(viewListener).toHaveBeenCalledTimes(1);
    expect(store.getDraft()?.text).toBe("abcd");
  });

  it("flushes buffered deltas before other events", () => {
    const { scheduler } = manualScheduler();
    const store = new AiSessionViewStore(EMPTY_AI_SESSION_VIEW, "s1", scheduler);
    store.dispatch(delta(1, "a"));
    store.dispatch({
      type: "ai_snapshot",
      aiSessionId: "s1",
      aiTurnId: "t1",
      kind: "text",
      seq: 2,
      offset: 0,
      length: 2,
      text: "ab",
    });
    expect(store.getDraft()?.text).toBe("ab");
    expect(store.pendingDeltas).toBe(0);
  });

  it("ignores events for other sessions", () => {
    const { scheduler, runFrame } = manualScheduler();
    const store = new AiSessionViewStore(EMPTY_AI_SESSION_VIEW, "s2", scheduler);
    store.dispatch(delta(1, "a"));
    runFrame();
    expect(store.getDraft()).toBeNull();
  });
});

describe("stream helpers", () => {
  it("parses ai_resync with empty data", () => {
    expect(parseAiStreamEvent("ai_resync", "")).toEqual({ type: "ai_resync" });
  });

  it("creates uuid-shaped client message ids", () => {
    expect(createClientMessageId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(createClientMessageId()).not.toBe(createClientMessageId());
  });
});

describe("buildTranscriptRows", () => {
  const message = (id: string, role: "user" | "assistant", turn: string | null): AiMessage =>
    ({
      aiMessageId: id,
      aiSessionId: "s1",
      aiTurnId: turn,
      role,
      content: { type: "text", text: id },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }) as AiMessage;

  it("precomputes last indexes and preceding user ids", () => {
    const messages = [
      message("u1", "user", null),
      message("a1", "assistant", "t1"),
      message("a2", "assistant", "t1"),
      message("u2", "user", null),
    ];
    const byId = Object.fromEntries(messages.map((m) => [m.aiMessageId, m]));
    const result = buildTranscriptRows(
      messages.map((m) => m.aiMessageId),
      byId,
    );
    expect(result.rows).toHaveLength(3);
    expect(result.lastTurnRowIndex).toBe(1);
    expect(result.lastUserIndex).toBe(2);
    const turn = result.rows[1];
    expect(turn?.kind === "turn" && turn.precedingUserId).toBe("u1");
  });
});
