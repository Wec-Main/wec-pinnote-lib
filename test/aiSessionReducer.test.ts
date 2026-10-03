import { describe, expect, it } from "vitest";
import { reduceSessionList, sessionMatchesFilter } from "../src/ai/sessionReducer";
import type { AiSession } from "../src/types/ai.types";

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
