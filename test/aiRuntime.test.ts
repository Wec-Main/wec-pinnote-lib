import { describe, expect, it, vi } from "vitest";
import { AiStreamHub } from "../src/ai/AiStreamHub";
import { createAiPreviewStore } from "../src/ai/aiPreviewStore";
import {
  NO_APPLIED_BATCHES,
  applyBatchToDocument,
  buildPreviewOverlay,
  canTransitionOpBatch,
  describeOpErrors,
  withAccepted,
  withPreview,
  withRejected,
} from "../src/ai/opBatchApplier";
import {
  EMPTY_AI_SESSION_VIEW,
  loadSessionDetail,
  prependMessages,
  reduceDraft,
  reduceSessionList,
  reduceSessionView,
  sessionMatchesFilter,
  selectDetail,
  markDraftStale,
  isSeqGap,
} from "../src/ai/sessionReducer";
import type {
  AiMessage,
  AiOpBatch,
  AiSession,
  AiSessionDetail,
  AiStreamEvent,
  AiTurn,
} from "../src/types/ai.types";
import { parseAiStreamEvent } from "../src/utils/aiStreamGuards";
import { canApplyAiModelOps, canManageAiTemplates, canUseAi } from "../src/utils/permissions";
import type { UserManagementRole } from "../src/types/userManagement.types";
import { blogDocument } from "./erdFixtures";

const T0 = "2026-01-01T00:00:00.000Z";
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();

function turn(overrides: Partial<AiTurn> = {}): AiTurn {
  return {
    aiTurnId: "t1",
    aiSessionId: "s1",
    userId: "u1",
    userName: "U",
    provider: "claude",
    model: "m",
    effort: null,
    mode: "model",
    status: "running",
    errorCode: null,
    errorMessage: null,
    usage: null,
    createdAt: T0,
    startedAt: T0,
    finishedAt: null,
    ...overrides,
  };
}

function session(overrides: Partial<AiSession> = {}): AiSession {
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
    visibility: "project",
    createdById: "u1",
    createdByName: "U",
    nativeSessionOwnerId: null,
    lastMessageAt: T0,
    createdAt: T0,
    updatedAt: T0,
    archivedAt: null,
    activeTurn: null,
    ...overrides,
  };
}

function message(id: string, seconds: number, overrides: Partial<AiMessage> = {}): AiMessage {
  return {
    aiMessageId: id,
    aiSessionId: "s1",
    aiTurnId: "t1",
    authorId: null,
    authorName: null,
    role: "assistant",
    content: { type: "text", text: id },
    createdAt: at(seconds),
    updatedAt: at(seconds),
    ...overrides,
  };
}

function detail(overrides: Partial<AiSessionDetail> = {}): AiSessionDetail {
  return {
    session: session({ activeTurn: turn() }),
    messages: [message("m2", 2), message("m1", 1)],
    hasMoreMessages: true,
    opBatches: [],
    commentDrafts: [],
    ...overrides,
  };
}

const delta = (
  kind: "text" | "reasoning" | "status",
  text: string,
  seq: number,
): AiStreamEvent => ({
  type: "ai_delta",
  aiSessionId: "s1",
  aiTurnId: "t1",
  kind,
  text,
  seq,
});

describe("parseAiStreamEvent", () => {
  it("accepts well-formed events whose type matches the SSE event name", () => {
    const event = { type: "ai_turn.upserted", turn: turn() };
    expect(parseAiStreamEvent("ai_turn.upserted", JSON.stringify(event))).toEqual(event);
    expect(parseAiStreamEvent("ai_delta", JSON.stringify(delta("text", "x", 1)))).toMatchObject({
      seq: 1,
    });
    expect(
      parseAiStreamEvent(
        "ai_connectors.updated",
        JSON.stringify({ type: "ai_connectors.updated", connectors: [{ provider: "claude" }] }),
      ),
    ).not.toBeNull();
    expect(
      parseAiStreamEvent(
        "ai_connectors.updated",
        JSON.stringify({ type: "ai_connectors.updated", connectors: [{}] }),
      ),
    ).toBeNull();
    expect(
      parseAiStreamEvent(
        "ai_bridges.updated",
        JSON.stringify({ type: "ai_bridges.updated", bridges: [] }),
      ),
    ).toBeNull();
  });

  it("rejects malformed, mismatched and unknown events", () => {
    expect(parseAiStreamEvent("ai_delta", "{not json")).toBeNull();
    expect(parseAiStreamEvent("ai_turn.upserted", JSON.stringify({ type: "ai_delta" }))).toBeNull();
    expect(parseAiStreamEvent("ready", JSON.stringify({ type: "ready" }))).toBeNull();
    expect(
      parseAiStreamEvent(
        "ai_turn.upserted",
        JSON.stringify({ type: "ai_turn.upserted", turn: {} }),
      ),
    ).toBeNull();
    expect(
      parseAiStreamEvent("ai_delta", JSON.stringify({ ...delta("text", "x", 1), kind: "other" })),
    ).toBeNull();
    expect(
      parseAiStreamEvent(
        "ai_open_in_editor",
        JSON.stringify({
          type: "ai_open_in_editor",
          aiSessionId: "s",
          aiTurnId: "t",
          target: { kind: "page", id: "x" },
        }),
      ),
    ).toBeNull();
  });
});

describe("ai_snapshot", () => {
  const snap = (seq: number, offset: number, length: number, text: string): AiStreamEvent => ({
    type: "ai_snapshot",
    aiSessionId: "s1",
    aiTurnId: "t1",
    kind: "text",
    seq,
    offset,
    length,
    text,
  });

  it("validates the event", () => {
    const ok = JSON.stringify(snap(3, 0, 2, "hi"));
    expect(parseAiStreamEvent("ai_snapshot", ok)).toMatchObject({ offset: 0, length: 2 });
    expect(
      parseAiStreamEvent(
        "ai_snapshot",
        JSON.stringify({ ...snap(3, 0, 2, "hi"), kind: "reasoning" }),
      ),
    ).toBeNull();
    expect(
      parseAiStreamEvent("ai_snapshot", JSON.stringify({ ...snap(3, -1, 2, "hi") })),
    ).toBeNull();
    expect(
      parseAiStreamEvent("ai_delta", JSON.stringify({ ...delta("text", "x", 1), part: "a" })),
    ).toBeNull();
  });

  it("heals the draft in order, including chunked snapshots", () => {
    let draft = reduceDraft(null, delta("text", "Helo", 1));
    draft = reduceDraft(draft, snap(1, 0, 5, "Hel"));
    draft = reduceDraft(draft, snap(1, 3, 5, "lo"));
    expect(draft).toMatchObject({ text: "Hello", seq: 1 });
    draft = reduceDraft(draft, snap(0, 0, 1, "x"));
    expect(draft?.text).toBe("Hello");
  });

  it("starts a draft from a snapshot and flags unappliable ones as stale", () => {
    const draft = reduceDraft(null, snap(4, 0, 3, "abc"));
    expect(draft).toMatchObject({ text: "abc", seq: 4 });
    expect(reduceDraft(draft, snap(5, 9, 12, "z"))).toMatchObject({ text: "abc", stale: true });
  });
});

describe("session reducer", () => {
  it("streams text (append) and status (replace), ignoring stale seqs", () => {
    let draft = reduceDraft(null, delta("text", "Hel", 1));
    draft = reduceDraft(draft, delta("text", "lo", 2));
    draft = reduceDraft(draft, delta("status", "Reading…", 3));
    draft = reduceDraft(draft, delta("status", "Proposing…", 4));
    draft = reduceDraft(draft, delta("text", "stale", 2));
    draft = reduceDraft(draft, delta("reasoning", "hmm", 5));
    expect(draft).toEqual({
      aiTurnId: "t1",
      text: "Hello",
      reasoning: "hmm",
      status: "Proposing…",
      seq: 5,
    });
  });

  it("appends every chunk of a delta the API split under one seq", () => {
    let draft = reduceDraft(null, delta("text", "Hel", 7));
    draft = reduceDraft(draft, delta("text", "lo", 7));
    expect(draft).toMatchObject({ text: "Hello", seq: 7 });
  });

  it("drops the streamed text when the assistant message lands, and the draft when the turn ends", () => {
    let draft = reduceDraft(null, delta("text", "Hello", 1));
    draft = reduceDraft(draft, delta("status", "s", 2));
    draft = reduceDraft(draft, { type: "ai_message.upserted", message: message("m3", 3) });
    expect(draft).toMatchObject({ text: "", status: "s" });
    draft = reduceDraft(draft, {
      type: "ai_message.upserted",
      message: message("m4", 4, {
        role: "tool",
        content: { type: "tool", toolCallId: "c", name: "n", status: "ok", summary: "" },
      }),
    });
    expect(draft).not.toBeNull();
    expect(
      reduceDraft(draft, { type: "ai_turn.upserted", turn: turn({ status: "completed" }) }),
    ).toBeNull();
  });

  it("starts a fresh draft for a new turn", () => {
    const draft = reduceDraft(reduceDraft(null, delta("text", "a", 9)), {
      ...delta("text", "b", 1),
      aiTurnId: "t2",
    } as AiStreamEvent);
    expect(draft).toMatchObject({ aiTurnId: "t2", text: "b" });
  });

  it("loads detail sorted and upserts messages, batches and turns", () => {
    let state = loadSessionDetail(EMPTY_AI_SESSION_VIEW, detail());
    expect(selectDetail(state)?.messages.map((m) => m.aiMessageId)).toEqual(["m1", "m2"]);
    state = reduceSessionView(state, "s1", {
      type: "ai_message.upserted",
      message: message("m0", 0),
    });
    state = reduceSessionView(state, "s1", {
      type: "ai_message.upserted",
      message: { ...message("m2", 2), content: { type: "text", text: "edited" }, updatedAt: at(5) },
    });
    expect(selectDetail(state)?.messages.map((m) => m.aiMessageId)).toEqual(["m0", "m1", "m2"]);
    expect(selectDetail(state)?.messages[2]?.content).toEqual({ type: "text", text: "edited" });
    state = reduceSessionView(state, "s1", {
      type: "ai_message.upserted",
      message: message("m2", 1),
    });
    expect(selectDetail(state)?.messages[2]?.content).toEqual({ type: "text", text: "edited" });
    const batch = {
      aiOpBatchId: "ob1",
      aiSessionId: "s1",
      updatedAt: T0,
      status: "proposed",
      ops: [],
    } as unknown as AiOpBatch;
    state = reduceSessionView(state, "s1", { type: "ai_op_batch.upserted", batch });
    state = reduceSessionView(state, "s1", {
      type: "ai_op_batch.upserted",
      batch: { ...batch, status: "applied", updatedAt: at(1) } as AiOpBatch,
    });
    expect(state.meta?.opBatches).toHaveLength(1);
    expect(state.meta?.opBatches[0]?.status).toBe("applied");
    state = reduceSessionView(state, "s1", {
      type: "ai_turn.upserted",
      turn: turn({ status: "completed" }),
    });
    expect(state.meta?.session.activeTurn).toBeNull();
    expect(state.turns.t1?.status).toBe("completed");
  });

  it("ignores events of other sessions and handles deletion", () => {
    const state = loadSessionDetail(EMPTY_AI_SESSION_VIEW, detail());
    expect(
      reduceSessionView(state, "s1", {
        type: "ai_message.upserted",
        message: { ...message("x", 9), aiSessionId: "s2" },
      }),
    ).toBe(state);
    expect(
      reduceSessionView(state, "s1", { type: "ai_session.deleted", aiSessionId: "s1" }).deleted,
    ).toBe(true);
  });

  it("prepends older pages", () => {
    const state = prependMessages(
      loadSessionDetail(EMPTY_AI_SESSION_VIEW, detail()),
      [message("old", -5)],
      false,
    );
    expect(selectDetail(state)?.messages[0]?.aiMessageId).toBe("old");
    expect(state.meta?.hasMoreMessages).toBe(false);
  });

  it("stores messages as an id map plus an order array and keeps unchanged rows by reference", () => {
    let state = loadSessionDetail(EMPTY_AI_SESSION_VIEW, detail());
    expect(state.messages.order).toEqual(["m1", "m2"]);
    expect(Object.keys(state.messages.byId).sort()).toEqual(["m1", "m2"]);
    const m1 = state.messages.byId.m1;
    state = reduceSessionView(state, "s1", {
      type: "ai_message.upserted",
      message: message("m3", 3),
    });
    expect(state.messages.order).toEqual(["m1", "m2", "m3"]);
    expect(state.messages.byId.m1).toBe(m1);
    const before = state.messages;
    const same = reduceSessionView(state, "s1", {
      type: "ai_message.upserted",
      message: state.messages.byId.m2 as AiMessage,
    });
    expect(same.messages).toBe(before);
  });

  it("merges a refetch instead of replacing what is already loaded", () => {
    let state = loadSessionDetail(EMPTY_AI_SESSION_VIEW, detail());
    state = prependMessages(state, [message("old", -5)], false);
    state = reduceSessionView(state, "s1", {
      type: "ai_message.upserted",
      message: message("live", 9),
    });
    state = loadSessionDetail(
      state,
      detail({ messages: [message("m2", 2), message("m4", 4)], hasMoreMessages: true }),
    );
    expect(state.messages.order).toEqual(["old", "m1", "m2", "m4", "live"]);
    expect(state.meta?.hasMoreMessages).toBe(false);
    const other = loadSessionDetail(
      state,
      detail({ session: session({ aiSessionId: "s2" }), messages: [message("x", 1)] }),
    );
    expect(other.messages.order).toEqual(["x"]);
  });

  it("marks the draft stale on a seq gap, and a refetch clears the stale text", () => {
    expect(isSeqGap(-1, 9)).toBe(false);
    expect(isSeqGap(4, 5)).toBe(false);
    expect(isSeqGap(4, undefined)).toBe(false);
    expect(isSeqGap(4, 7)).toBe(true);
    let state = loadSessionDetail(EMPTY_AI_SESSION_VIEW, detail());
    state = reduceSessionView(state, "s1", delta("text", "Hel", 4));
    state = reduceSessionView(state, "s1", {
      ...delta("text", "lo", 6),
      fromSeq: 5,
    } as AiStreamEvent);
    expect(state.draft?.stale).toBeUndefined();
    state = reduceSessionView(state, "s1", {
      ...delta("text", "!!", 12),
      fromSeq: 10,
    } as AiStreamEvent);
    expect(state.draft).toMatchObject({ text: "Hello!!", maybeMissed: true, seq: 12 });
    expect(state.draft?.stale).toBeUndefined();
    state = reduceSessionView(state, "s1", {
      type: "ai_snapshot",
      aiSessionId: "s1",
      aiTurnId: "t1",
      kind: "text",
      seq: 12,
      offset: 0,
      length: 9,
      text: "Hello big",
    });
    expect(state.draft).toMatchObject({ text: "Hello big", seq: 12 });
    expect(state.draft?.maybeMissed).toBeUndefined();
    state = reduceSessionView(state, "s1", {
      type: "ai_snapshot",
      aiSessionId: "s1",
      aiTurnId: "t1",
      kind: "text",
      seq: 13,
      offset: 50,
      length: 60,
      text: "x",
    });
    expect(state.draft).toMatchObject({ text: "Hello big", stale: true });
    state = loadSessionDetail(state, detail());
    expect(state.draft).toMatchObject({ text: "", stale: false });
    const fresh = reduceSessionView(
      loadSessionDetail(EMPTY_AI_SESSION_VIEW, detail()),
      "s1",
      delta("text", "a", 1),
    );
    expect(markDraftStale(fresh).draft?.stale).toBe(true);
  });

  it("tolerates seq jumps from coalesced deltas when fromSeq is absent", () => {
    let state = loadSessionDetail(EMPTY_AI_SESSION_VIEW, detail());
    state = reduceSessionView(state, "s1", delta("text", "Hel", 3));
    state = reduceSessionView(state, "s1", delta("text", "lo", 9));
    state = reduceSessionView(state, "s1", delta("text", " wor", 15));
    state = reduceSessionView(state, "s1", delta("text", "ld", 15));
    expect(state.draft).toMatchObject({ text: "Hello world", seq: 15 });
    expect(state.draft?.stale).toBeUndefined();
    state = reduceSessionView(state, "s1", delta("text", "old", 2));
    expect(state.draft?.text).toBe("Hello world");
    state = reduceSessionView(state, "s1", {
      ...delta("text", "!", 18),
      fromSeq: 16,
    } as AiStreamEvent);
    expect(state.draft).toMatchObject({ text: "Hello world!", seq: 18 });
    expect(state.draft?.stale).toBeUndefined();
  });

  it("keeps a session list filtered and newest first", () => {
    const filter = { scopeKind: "flow" as const, scopeId: "f1" };
    let list: AiSession[] = [];
    list = reduceSessionList(
      list,
      {
        type: "ai_session.upserted",
        session: session({
          aiSessionId: "a",
          scopeKind: "flow",
          scopeId: "f1",
          lastMessageAt: at(1),
        }),
      },
      filter,
    );
    list = reduceSessionList(
      list,
      {
        type: "ai_session.upserted",
        session: session({
          aiSessionId: "b",
          scopeKind: "flow",
          scopeId: "f1",
          lastMessageAt: at(5),
        }),
      },
      filter,
    );
    list = reduceSessionList(
      list,
      { type: "ai_session.upserted", session: session({ aiSessionId: "c" }) },
      filter,
    );
    expect(list.map((s) => s.aiSessionId)).toEqual(["b", "a"]);
    list = reduceSessionList(
      list,
      {
        type: "ai_session.upserted",
        session: session({
          aiSessionId: "a",
          scopeKind: "flow",
          scopeId: "f1",
          archivedAt: at(9),
          updatedAt: at(9),
        }),
      },
      filter,
    );
    expect(list.map((s) => s.aiSessionId)).toEqual(["b"]);
    list = reduceSessionList(
      list,
      { type: "ai_turn.upserted", turn: turn({ aiSessionId: "b" }) },
      filter,
    );
    expect(list[0]?.activeTurn?.aiTurnId).toBe("t1");
    list = reduceSessionList(list, { type: "ai_session.deleted", aiSessionId: "b" }, filter);
    expect(list).toEqual([]);
  });

  it("applies the mine filter only when the user is known", () => {
    expect(sessionMatchesFilter(session({ createdById: "u2" }), { mine: true }, "u1")).toBe(false);
    expect(
      reduceSessionList([], { type: "ai_session.upserted", session: session() }, { mine: true }),
    ).toEqual([]);
    expect(
      reduceSessionList(
        [],
        { type: "ai_session.upserted", session: session() },
        { mine: true },
        "u1",
      ),
    ).toHaveLength(1);
  });
});

describe("AiStreamHub", () => {
  it("fans events and reconnects out to subscribers until they unsubscribe", () => {
    const hub = new AiStreamHub();
    const onEvent = vi.fn();
    const onReconnect = vi.fn();
    const stop = hub.subscribe(onEvent, onReconnect);
    hub.emit(delta("text", "a", 1));
    hub.reconnected();
    stop();
    hub.emit(delta("text", "b", 2));
    hub.reconnected();
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(hub.size).toBe(0);
  });
});

describe("op batch applier logic", () => {
  const batch = (ops: unknown[]): AiOpBatch =>
    ({
      aiOpBatchId: "ob1",
      aiSessionId: "s1",
      aiTurnId: "t1",
      targetKind: "data_model",
      targetId: "dm1",
      baseRevision: 1,
      title: "",
      rationale: "",
      summary: { added: 0, changed: 0, removed: 0 },
      status: "proposed",
      statusDetail: null,
      savedRevision: null,
      createdAt: T0,
      updatedAt: T0,
      ops,
    }) as AiOpBatch;

  it("follows the protocol's status transitions", () => {
    expect(canTransitionOpBatch("proposed", "applied")).toBe(true);
    expect(canTransitionOpBatch("applied", "saved")).toBe(true);
    expect(canTransitionOpBatch("conflict", "applied")).toBe(true);
    expect(canTransitionOpBatch("conflict", "saved")).toBe(false);
    expect(canTransitionOpBatch("saved", "discarded")).toBe(false);
    expect(canTransitionOpBatch("proposed", "saved")).toBe(false);
  });

  it("applies to the current local document and builds the overlay with ghosts", () => {
    const before = blogDocument();
    const result = applyBatchToDocument(
      batch([
        { op: "removeEntity", entity: "tags" },
        { op: "addEntity", name: "labels" },
      ]),
      before,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const overlay = buildPreviewOverlay(batch([]), before, result.diff);
    expect(overlay.removed.has("tags")).toBe(true);
    expect(overlay.added.size).toBe(1);
    expect(overlay.ghosts.entities.map((e) => e.id)).toEqual(["tags"]);
    expect(overlay.ghosts.relationships.map((r) => r.id)).toEqual(["r2"]);
  });

  it("reports a conflict when a ref no longer resolves locally", () => {
    const result = applyBatchToDocument(
      batch([{ op: "removeEntity", entity: "gone" }]),
      blogDocument(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("#0 removeEntity");
    expect(
      describeOpErrors([{ index: -1, op: "", code: "limit_exceeded", message: "too big" }]),
    ).toBe("too big");
  });

  it("tracks previewing and applied batches", () => {
    let state = withPreview(NO_APPLIED_BATCHES, "a");
    state = withAccepted(state);
    state = withPreview(state, "b");
    expect(state).toEqual({ previewing: "b", applied: ["a", "b"] });
    expect(withRejected(state, "b")).toEqual({ previewing: null, applied: ["a"] });
  });

  it("preview store notifies subscribers per document", () => {
    const store = createAiPreviewStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const overlay = buildPreviewOverlay(batch([]), blogDocument(), {
      added: ["x"],
      changed: [],
      removed: [],
    });
    store.set(overlay);
    expect(store.get("data_model", "dm1")).toBe(overlay);
    expect(store.get("flow", "dm1")).toBeNull();
    const snapshot = store.getSnapshot();
    store.clear("data_model", "dm1");
    store.clear("data_model", "dm1");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).not.toBe(snapshot);
  });
});

describe("AI permissions", () => {
  const roles: UserManagementRole[] = [
    "super_admin",
    "admin",
    "contributor",
    "reviewer",
    "developer",
  ];
  it.each(roles)("%s", (role) => {
    expect(canUseAi(role)).toBe(true);
    expect(canApplyAiModelOps(role)).toBe(role !== "reviewer");
    expect(canManageAiTemplates(role)).toBe(role === "admin" || role === "super_admin");
  });
});
