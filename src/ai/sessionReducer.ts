import {
  AI_ACTIVE_TURN_STATUSES,
  type AiMessage,
  type AiScopeKind,
  type AiSession,
  type AiSessionDetail,
  type AiStreamEvent,
  type AiTurn,
} from "../types/ai.types";

export interface AiSessionFilter {
  scopeKind?: AiScopeKind;
  scopeId?: string | null;
  mine?: boolean;
  includeArchived?: boolean;
  includeActions?: boolean;
}

export interface AiStreamingDraft {
  aiTurnId: string;
  text: string;
  reasoning: string;
  status: string;
  seq: number;
  lastPart?: number;
  stale?: boolean;
  maybeMissed?: boolean;
}

export interface AiMessageStore {
  byId: Readonly<Record<string, AiMessage>>;
  order: readonly string[];
}

export type AiSessionMeta = Omit<AiSessionDetail, "messages">;

export interface AiSessionViewState {
  meta: AiSessionMeta | null;
  messages: AiMessageStore;
  turns: Readonly<Record<string, AiTurn>>;
  draft: AiStreamingDraft | null;
  deleted: boolean;
}

export const EMPTY_MESSAGE_STORE: AiMessageStore = { byId: {}, order: [] };

export const EMPTY_AI_SESSION_VIEW: AiSessionViewState = {
  meta: null,
  messages: EMPTY_MESSAGE_STORE,
  turns: {},
  draft: null,
  deleted: false,
};

const isActive = (turn: AiTurn) => AI_ACTIVE_TURN_STATUSES.includes(turn.status);

const TURN_RANK: Readonly<Record<AiTurn["status"], number>> = {
  queued: 0,
  dispatched: 1,
  running: 2,
  completed: 3,
  failed: 3,
  interrupted: 3,
  cancelled: 3,
};

export function isStaleTurn(existing: AiTurn | null | undefined, incoming: AiTurn): boolean {
  if (!existing || existing.aiTurnId !== incoming.aiTurnId) return false;
  const existingRank = TURN_RANK[existing.status];
  const incomingRank = TURN_RANK[incoming.status];
  if (incomingRank !== existingRank) return incomingRank < existingRank;
  if (existingRank === 3) return time(incoming.finishedAt) < time(existing.finishedAt);
  return false;
}

const time = (value: string | null | undefined) => (value ? Date.parse(value) || 0 : 0);

export function upsertByKey<T>(
  items: readonly T[],
  incoming: T,
  keyOf: (item: T) => string,
  updatedAtOf?: (item: T) => string | null | undefined,
): T[] {
  const key = keyOf(incoming);
  const index = items.findIndex((item) => keyOf(item) === key);
  if (index < 0) return [...items, incoming];
  const existing = items[index] as T;
  if (updatedAtOf && time(updatedAtOf(incoming)) < time(updatedAtOf(existing))) {
    return items as T[];
  }
  const next = [...items];
  next[index] = incoming;
  return next;
}

const sessionRecency = (session: AiSession) =>
  Math.max(time(session.lastMessageAt), time(session.updatedAt), time(session.createdAt));

export function sortSessions(sessions: readonly AiSession[]): AiSession[] {
  return [...sessions].sort((a, b) => sessionRecency(b) - sessionRecency(a));
}

export function sessionMatchesFilter(
  session: AiSession,
  filter: AiSessionFilter,
  currentUserId?: string | null,
): boolean {
  if (session.kind === "actions" && !filter.includeActions) return false;
  if (!filter.includeArchived && session.archivedAt) return false;
  if (filter.scopeKind && session.scopeKind !== filter.scopeKind) return false;
  if (
    filter.scopeId !== undefined &&
    filter.scopeId !== null &&
    session.scopeId !== filter.scopeId
  ) {
    return false;
  }
  if (filter.mine && currentUserId && session.createdById !== currentUserId) return false;
  return true;
}

export function reduceSessionList(
  sessions: readonly AiSession[],
  event: AiStreamEvent,
  filter: AiSessionFilter,
  currentUserId?: string | null,
): AiSession[] {
  if (event.type === "ai_session.deleted") {
    return sessions.some((s) => s.aiSessionId === event.aiSessionId)
      ? sessions.filter((s) => s.aiSessionId !== event.aiSessionId)
      : (sessions as AiSession[]);
  }
  if (event.type === "ai_session.upserted") {
    const { session } = event;
    const known = sessions.some((s) => s.aiSessionId === session.aiSessionId);
    const unknownOwner = filter.mine && !currentUserId && !known;
    if (!sessionMatchesFilter(session, filter, currentUserId) || unknownOwner) {
      return known
        ? sessions.filter((s) => s.aiSessionId !== session.aiSessionId)
        : (sessions as AiSession[]);
    }
    return sortSessions(
      upsertByKey(
        sessions,
        session,
        (s) => s.aiSessionId,
        (s) => s.updatedAt,
      ),
    );
  }
  if (event.type === "ai_turn.upserted") {
    const { turn } = event;
    if (!sessions.some((s) => s.aiSessionId === turn.aiSessionId)) return sessions as AiSession[];
    return sessions.map((s) =>
      s.aiSessionId === turn.aiSessionId && !isStaleTurn(s.activeTurn, turn)
        ? { ...s, activeTurn: nextActiveTurn(s.activeTurn, turn) }
        : s,
    );
  }
  return sessions as AiSession[];
}

function nextActiveTurn(current: AiTurn | null, turn: AiTurn): AiTurn | null {
  if (isActive(turn)) {
    if (
      current &&
      current.aiTurnId !== turn.aiTurnId &&
      isActive(current) &&
      turn.status === "queued"
    ) {
      return current;
    }
    return turn;
  }
  return current?.aiTurnId === turn.aiTurnId ? null : current;
}

function compareMessages(a: AiMessage, b: AiMessage): number {
  return time(a.createdAt) - time(b.createdAt) || a.aiMessageId.localeCompare(b.aiMessageId);
}

function insertionIndex(store: AiMessageStore, message: AiMessage): number {
  let low = 0;
  let high = store.order.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const other = store.byId[store.order[mid] as string] as AiMessage;
    if (compareMessages(other, message) <= 0) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function upsertMessage(store: AiMessageStore, message: AiMessage): AiMessageStore {
  const existing = store.byId[message.aiMessageId];
  if (existing) {
    if (existing === message) return store;
    if (time(message.updatedAt) < time(existing.updatedAt)) return store;
    const byId = { ...store.byId, [message.aiMessageId]: message };
    if (existing.createdAt === message.createdAt) return { byId, order: store.order };
    const without = store.order.filter((id) => id !== message.aiMessageId);
    const interim: AiMessageStore = { byId, order: without };
    const index = insertionIndex(interim, message);
    return {
      byId,
      order: [...without.slice(0, index), message.aiMessageId, ...without.slice(index)],
    };
  }
  const index = insertionIndex(store, message);
  return {
    byId: { ...store.byId, [message.aiMessageId]: message },
    order: [...store.order.slice(0, index), message.aiMessageId, ...store.order.slice(index)],
  };
}

export function mergeMessages(
  store: AiMessageStore,
  messages: readonly AiMessage[],
): AiMessageStore {
  let next = store;
  for (const message of messages) next = upsertMessage(next, message);
  return next;
}

export function messageList(store: AiMessageStore): AiMessage[] {
  return store.order.map((id) => store.byId[id] as AiMessage);
}

export function selectDetail(state: AiSessionViewState): AiSessionDetail | null {
  return state.meta ? { ...state.meta, messages: messageList(state.messages) } : null;
}

function splitDetail(detail: AiSessionDetail): AiSessionMeta {
  const { messages: _messages, ...meta } = detail;
  return meta;
}

export function loadSessionDetail(
  state: AiSessionViewState,
  detail: AiSessionDetail,
): AiSessionViewState {
  const active = detail.session.activeTurn;
  const turns = active ? { ...state.turns, [active.aiTurnId]: active } : state.turns;
  const sameSession = state.meta?.session.aiSessionId === detail.session.aiSessionId;
  const base = sameSession ? state.messages : EMPTY_MESSAGE_STORE;
  const messages = mergeMessages(base, detail.messages);
  const incomingOldest = detail.messages.reduce<AiMessage | null>(
    (oldest, message) => (!oldest || compareMessages(message, oldest) < 0 ? message : oldest),
    null,
  );
  const knownOldest = base.order[0] ? base.byId[base.order[0]] : undefined;
  const keepsOlder =
    sameSession &&
    Boolean(knownOldest) &&
    (!incomingOldest || compareMessages(knownOldest as AiMessage, incomingOldest) < 0);
  const hasMoreMessages =
    keepsOlder && state.meta ? state.meta.hasMoreMessages : detail.hasMoreMessages;
  let draft = state.draft && active?.aiTurnId === state.draft.aiTurnId ? state.draft : null;
  if (draft?.stale) {
    const { maybeMissed: _maybeMissed, ...rest } = draft;
    draft = { ...rest, text: "", reasoning: "", stale: false };
  }
  return {
    meta: { ...splitDetail(detail), hasMoreMessages },
    messages,
    turns,
    draft,
    deleted: false,
  };
}

export function prependMessages(
  state: AiSessionViewState,
  messages: readonly AiMessage[],
  hasMore: boolean,
): AiSessionViewState {
  if (!state.meta) return state;
  return {
    ...state,
    messages: mergeMessages(state.messages, messages),
    meta: { ...state.meta, hasMoreMessages: hasMore },
  };
}

export function markDraftStale(state: AiSessionViewState): AiSessionViewState {
  if (!state.draft || state.draft.maybeMissed) return state;
  return { ...state, draft: { ...state.draft, maybeMissed: true } };
}

export function isSeqGap(previousSeq: number, fromSeq: number | undefined): boolean {
  return previousSeq >= 0 && typeof fromSeq === "number" && fromSeq > previousSeq + 1;
}

export function reduceDraft(
  draft: AiStreamingDraft | null,
  event: AiStreamEvent,
): AiStreamingDraft | null {
  switch (event.type) {
    case "ai_delta": {
      const base: AiStreamingDraft =
        draft && draft.aiTurnId === event.aiTurnId
          ? draft
          : { aiTurnId: event.aiTurnId, text: "", reasoning: "", status: "", seq: -1 };
      const multipart = typeof event.parts === "number" && event.parts > 1;
      const part = typeof event.part === "number" ? event.part : undefined;
      if (event.seq < base.seq) return draft;
      if (event.seq === base.seq) {
        if (!multipart || part === undefined || part <= (base.lastPart ?? -1)) return draft;
      }
      const maybeMissed =
        base.maybeMissed ||
        (event.seq > base.seq && isSeqGap(base.seq, event.fromSeq)) ||
        undefined;
      const withSeq: AiStreamingDraft = { ...base, seq: event.seq };
      if (maybeMissed) withSeq.maybeMissed = maybeMissed;
      if (multipart && part !== undefined) withSeq.lastPart = part;
      else delete withSeq.lastPart;
      if (event.kind === "status") return { ...withSeq, status: event.text };
      if (event.kind === "reasoning") {
        return { ...withSeq, reasoning: base.reasoning + event.text };
      }
      return { ...withSeq, text: base.text + event.text };
    }
    case "ai_snapshot": {
      const base: AiStreamingDraft =
        draft && draft.aiTurnId === event.aiTurnId
          ? draft
          : { aiTurnId: event.aiTurnId, text: "", reasoning: "", status: "", seq: -1 };
      if (event.seq < base.seq) return draft;
      if (event.offset > base.text.length) return { ...base, stale: true };
      const text = base.text.slice(0, event.offset) + event.text;
      const next: AiStreamingDraft = { ...base, text, seq: event.seq };
      if (event.offset + event.text.length >= event.length && next.maybeMissed) {
        delete next.maybeMissed;
      }
      return next;
    }
    case "ai_message.upserted": {
      const { message } = event;
      if (!draft || message.aiTurnId !== draft.aiTurnId) return draft;
      if (message.role === "assistant" && message.content.type === "text") {
        const { maybeMissed: _maybeMissed, ...rest } = draft;
        return { ...rest, text: "", reasoning: "" };
      }
      return draft;
    }
    case "ai_turn.upserted":
      return draft && event.turn.aiTurnId === draft.aiTurnId && !isActive(event.turn)
        ? null
        : draft;
    default:
      return draft;
  }
}

export function sessionOfEvent(event: AiStreamEvent): string | null {
  switch (event.type) {
    case "ai_session.upserted":
      return event.session.aiSessionId;
    case "ai_session.deleted":
    case "ai_delta":
    case "ai_snapshot":
    case "ai_open_in_editor":
      return event.aiSessionId;
    case "ai_message.upserted":
      return event.message.aiSessionId;
    case "ai_turn.upserted":
      return event.turn.aiSessionId;
    case "ai_op_batch.upserted":
      return event.batch.aiSessionId;
    case "ai_comment_draft.upserted":
      return event.draft.aiSessionId;
    case "ai_resync":
    case "ai_connectors.updated":
    case "ai_connector_login.updated":
      return null;
  }
}

export function reduceSessionView(
  state: AiSessionViewState,
  aiSessionId: string,
  event: AiStreamEvent,
): AiSessionViewState {
  if (sessionOfEvent(event) !== aiSessionId) return state;
  if (event.type === "ai_session.deleted") {
    return { ...EMPTY_AI_SESSION_VIEW, deleted: true };
  }
  const draft = reduceDraft(state.draft, event);
  const withDraft = draft === state.draft ? state : { ...state, draft };
  if (event.type === "ai_turn.upserted") {
    if (isStaleTurn(withDraft.turns[event.turn.aiTurnId], event.turn)) return withDraft;
    const turns = { ...withDraft.turns, [event.turn.aiTurnId]: event.turn };
    const meta = withDraft.meta && {
      ...withDraft.meta,
      session: {
        ...withDraft.meta.session,
        activeTurn: nextActiveTurn(withDraft.meta.session.activeTurn, event.turn),
      },
    };
    return { ...withDraft, turns, meta };
  }
  const { meta } = withDraft;
  if (!meta) return withDraft;
  switch (event.type) {
    case "ai_session.upserted":
      if (time(event.session.updatedAt) < time(meta.session.updatedAt)) return withDraft;
      return { ...withDraft, meta: { ...meta, session: event.session } };
    case "ai_message.upserted": {
      const messages = upsertMessage(withDraft.messages, event.message);
      return messages === withDraft.messages ? withDraft : { ...withDraft, messages };
    }
    case "ai_op_batch.upserted":
      return {
        ...withDraft,
        meta: {
          ...meta,
          opBatches: upsertByKey(
            meta.opBatches,
            event.batch,
            (b) => b.aiOpBatchId,
            (b) => b.updatedAt,
          ),
        },
      };
    case "ai_comment_draft.upserted":
      return {
        ...withDraft,
        meta: {
          ...meta,
          commentDrafts: upsertByKey(
            meta.commentDrafts,
            event.draft,
            (d) => d.aiCommentDraftId,
            (d) => d.updatedAt,
          ),
        },
      };
    default:
      return withDraft;
  }
}
