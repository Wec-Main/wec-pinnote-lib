import { describe, expect, it } from "vitest";
import {
  EMPTY_AI_SESSION_VIEW,
  isStaleTurn,
  reduceDraft,
  reduceSessionList,
  reduceSessionView,
  sessionMatchesFilter,
} from "../src/ai/sessionReducer";
import type { AiSession, AiStreamEvent, AiTurn } from "../src/types/ai.types";

const base = {
  aiSessionId: "s1",
  projectId: "p1",
  title: "Build a login flow",
  mode: "chat",
  scopeKind: "flow",
  scopeId: "f1",
  provider: "claude",
  model: "default",
  effort: null,
  createdById: "u1",
  createdByName: "Kavi",
  nativeSessionOwnerId: null,
  lastMessageAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
  activeTurn: null,
} as unknown as AiSession;

const editor = { ...base, kind: "actions" } as AiSession;

describe("editor AI sessions in the chat list", () => {
  it("hides them by default and includes them when asked", () => {
    expect(sessionMatchesFilter(editor, {})).toBe(false);
    expect(sessionMatchesFilter(editor, { includeActions: true })).toBe(true);
    expect(sessionMatchesFilter({ ...base, kind: "chat" } as AiSession, {})).toBe(true);
  });

  it("adds a newly created editor chat live only when included", () => {
    const event = { type: "ai_session.upserted", session: editor } as const;
    expect(reduceSessionList([], event, {})).toEqual([]);
    expect(reduceSessionList([], event, { includeActions: true })).toHaveLength(1);
  });
});

const turn = (status: AiTurn["status"], extra: Partial<AiTurn> = {}) =>
  ({
    aiTurnId: "t1",
    aiSessionId: "s1",
    status,
    finishedAt: null,
    ...extra,
  }) as AiTurn;

const delta = (seq: number, text: string, extra: Record<string, unknown> = {}) =>
  ({
    type: "ai_delta",
    aiSessionId: "s1",
    aiTurnId: "t1",
    kind: "text",
    seq,
    text,
    ...extra,
  }) as AiStreamEvent;

describe("ai_delta duplicate guard", () => {
  it("ignores a repeated seq", () => {
    let draft = reduceDraft(null, delta(1, "a"));
    draft = reduceDraft(draft, delta(1, "a"));
    expect(draft?.text).toBe("a");
    draft = reduceDraft(draft, delta(2, "b"));
    expect(draft?.text).toBe("ab");
  });

  it("accepts successive parts that share a seq", () => {
    let draft = reduceDraft(null, delta(3, "x", { part: 0, parts: 3 }));
    draft = reduceDraft(draft, delta(3, "y", { part: 1, parts: 3 }));
    draft = reduceDraft(draft, delta(3, "y", { part: 1, parts: 3 }));
    draft = reduceDraft(draft, delta(3, "z", { part: 2, parts: 3 }));
    expect(draft?.text).toBe("xyz");
  });
});

describe("stale turn upserts", () => {
  it("ranks terminal above running", () => {
    expect(isStaleTurn(turn("completed"), turn("running"))).toBe(true);
    expect(isStaleTurn(turn("running"), turn("completed"))).toBe(false);
    expect(isStaleTurn(turn("queued"), turn("running"))).toBe(false);
    expect(
      isStaleTurn(
        turn("failed", { finishedAt: "2026-01-02T00:00:00.000Z" }),
        turn("failed", { finishedAt: "2026-01-01T00:00:00.000Z" }),
      ),
    ).toBe(true);
  });

  it("does not revive a finished turn in the session view", () => {
    const done = { type: "ai_turn.upserted", turn: turn("completed") } as AiStreamEvent;
    const late = { type: "ai_turn.upserted", turn: turn("running") } as AiStreamEvent;
    const state = reduceSessionView(
      reduceSessionView(EMPTY_AI_SESSION_VIEW, "s1", done),
      "s1",
      late,
    );
    expect(state.turns.t1?.status).toBe("completed");
  });

  it("does not revive a finished turn in the list", () => {
    const list = [{ ...base, activeTurn: turn("completed") } as AiSession];
    const late = { type: "ai_turn.upserted", turn: turn("running") } as AiStreamEvent;
    expect(reduceSessionList(list, late, {})[0]?.activeTurn?.status).toBe("completed");
  });
});
