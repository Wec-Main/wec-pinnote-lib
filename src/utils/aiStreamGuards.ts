import type { AiStreamEvent, AiStreamEventType } from "../types/ai.types";

export const AI_STREAM_EVENT_TYPES: readonly AiStreamEventType[] = [
  "ai_session.upserted",
  "ai_session.deleted",
  "ai_message.upserted",
  "ai_turn.upserted",
  "ai_op_batch.upserted",
  "ai_comment_draft.upserted",
  "ai_delta",
  "ai_snapshot",
  "ai_open_in_editor",
  "ai_connectors.updated",
  "ai_connector_login.updated",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasId(value: unknown, key: string): boolean {
  return isRecord(value) && isNonEmptyString(value[key]);
}

const CHECKS: Record<AiStreamEventType, (event: Record<string, unknown>) => boolean> = {
  "ai_session.upserted": (e) => hasId(e.session, "aiSessionId"),
  "ai_session.deleted": (e) => isNonEmptyString(e.aiSessionId),
  "ai_message.upserted": (e) =>
    hasId(e.message, "aiMessageId") &&
    hasId(e.message, "aiSessionId") &&
    isRecord((e.message as Record<string, unknown>).content),
  "ai_turn.upserted": (e) => hasId(e.turn, "aiTurnId") && hasId(e.turn, "aiSessionId"),
  "ai_op_batch.upserted": (e) =>
    hasId(e.batch, "aiOpBatchId") && Array.isArray((e.batch as Record<string, unknown>).ops),
  "ai_comment_draft.upserted": (e) => hasId(e.draft, "aiCommentDraftId"),
  ai_delta: (e) =>
    isNonEmptyString(e.aiSessionId) &&
    isNonEmptyString(e.aiTurnId) &&
    (e.kind === "text" || e.kind === "reasoning" || e.kind === "status") &&
    typeof e.text === "string" &&
    typeof e.seq === "number" &&
    (e.fromSeq === undefined || typeof e.fromSeq === "number") &&
    (e.part === undefined || typeof e.part === "number") &&
    (e.parts === undefined || typeof e.parts === "number"),
  ai_snapshot: (e) =>
    isNonEmptyString(e.aiSessionId) &&
    isNonEmptyString(e.aiTurnId) &&
    e.kind === "text" &&
    typeof e.text === "string" &&
    typeof e.seq === "number" &&
    typeof e.offset === "number" &&
    Number.isInteger(e.offset) &&
    e.offset >= 0 &&
    typeof e.length === "number" &&
    Number.isInteger(e.length) &&
    e.length >= 0,
  ai_open_in_editor: (e) =>
    isNonEmptyString(e.aiSessionId) &&
    isNonEmptyString(e.aiTurnId) &&
    isRecord(e.target) &&
    (e.target.kind === "data_model" || e.target.kind === "flow") &&
    isNonEmptyString(e.target.id),
  "ai_connectors.updated": (e) =>
    Array.isArray(e.connectors) && e.connectors.every((c) => hasId(c, "provider")),
  "ai_connector_login.updated": (e) =>
    isNonEmptyString(e.loginId) &&
    isNonEmptyString(e.provider) &&
    isNonEmptyString(e.state) &&
    (e.connector === null || e.connector === undefined || hasId(e.connector, "provider")),
};

export function isAiStreamEventType(value: unknown): value is AiStreamEventType {
  return typeof value === "string" && (AI_STREAM_EVENT_TYPES as readonly string[]).includes(value);
}

export function parseAiStreamEvent(eventName: string, data: string): AiStreamEvent | null {
  if (!isAiStreamEventType(eventName)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.type !== eventName || !CHECKS[eventName](parsed)) {
    return null;
  }
  return parsed as unknown as AiStreamEvent;
}
