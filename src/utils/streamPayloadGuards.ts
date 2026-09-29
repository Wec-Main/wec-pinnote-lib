import type {
  Annotation,
  AnnotationAnchor,
  AnnotationComment,
  AnnotationUser,
} from "../types/annotation.types";
import type { Epic, UserStory } from "../types/epicFlow.types";
import type { FlowPin } from "../types/flowPin.types";
import type { StreamEvent } from "../types/stream.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isAnnotationUser(value: unknown): value is AnnotationUser {
  return isRecord(value) && isNonEmptyString(value.id) && typeof value.name === "string";
}

export function isFlowPin(value: unknown): value is FlowPin {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.flowId) &&
    isNonEmptyString(value.pageKey) &&
    typeof value.name === "string" &&
    isAnchor(value.anchor) &&
    isNonEmptyString(value.updatedAt)
  );
}

export function isComment(value: unknown): value is AnnotationComment {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.message === "string" &&
    isAnnotationUser(value.createdBy) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

export function normalizeAnnotation(value: Record<string, unknown>): Record<string, unknown> {
  return value.comments === undefined ? { ...value, comments: [] } : value;
}

function isAnchor(value: unknown): value is AnnotationAnchor {
  return (
    isRecord(value) &&
    isNonEmptyString(value.selector) &&
    isNonEmptyString(value.elementIdentifier) &&
    Number.isFinite(value.relativeX) &&
    Number.isFinite(value.relativeY) &&
    Number.isFinite(value.fallbackX) &&
    Number.isFinite(value.fallbackY) &&
    Number.isFinite(value.viewportWidth) &&
    Number.isFinite(value.viewportHeight)
  );
}

export function isAnnotation(value: unknown): value is Annotation {
  if (!isRecord(value)) {
    return false;
  }
  const normalized = normalizeAnnotation(value);
  return (
    isNonEmptyString(normalized.id) &&
    isNonEmptyString(normalized.projectId) &&
    isNonEmptyString(normalized.pageKey) &&
    typeof normalized.number === "number" &&
    isAnchor(normalized.anchor) &&
    typeof normalized.status === "string" &&
    isAnnotationUser(normalized.createdBy) &&
    isNonEmptyString(normalized.createdAt) &&
    isNonEmptyString(normalized.updatedAt) &&
    Array.isArray(normalized.comments) &&
    normalized.comments.every(isComment)
  );
}

export function toAnnotation(value: unknown): Annotation | null {
  if (!isRecord(value)) {
    return null;
  }
  const normalized = normalizeAnnotation(value);
  return isAnnotation(normalized) ? normalized : null;
}

export function isEpic(value: unknown): value is Epic {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.organizationId) &&
    isNonEmptyString(value.projectId) &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    typeof value.position === "number" &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

export function isUserStory(value: unknown): value is UserStory {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.organizationId) &&
    isNonEmptyString(value.projectId) &&
    isNonEmptyString(value.epicId) &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    typeof value.position === "number" &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

export function parseStreamEnvelope(data: string): StreamEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (
    !isRecord(parsed) ||
    !isNonEmptyString(parsed.eventId) ||
    !isNonEmptyString(parsed.projectId) ||
    !isNonEmptyString(parsed.pageKey) ||
    !isNonEmptyString(parsed.eventType) ||
    !isNonEmptyString(parsed.createdAt)
  ) {
    return null;
  }
  return parsed as unknown as StreamEvent;
}

export function isNewer(incoming: string, existing: string): boolean {
  return new Date(incoming).getTime() > new Date(existing).getTime();
}

export function upsertById<T extends { id: string; updatedAt: string }>(
  items: T[],
  incoming: T,
): T[] {
  const existing = items.find((item) => item.id === incoming.id);
  if (!existing) {
    return [...items, incoming];
  }
  if (!isNewer(incoming.updatedAt, existing.updatedAt)) {
    return items;
  }
  return items.map((item) => (item.id === incoming.id ? incoming : item));
}
