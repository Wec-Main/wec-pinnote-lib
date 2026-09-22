import type { Annotation, AnnotationComment, PageStatusRecord } from "./annotation.types";

export type StreamEventType =
  | "annotation.created"
  | "annotation.updated"
  | "annotation.deleted"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "page-status.updated";

export type StreamConnectionState = "connecting" | "open" | "reconnecting" | "closed";

export interface StreamEventPayloads {
  "annotation.created": { annotation: Annotation };
  "annotation.updated": { annotation: Annotation };
  "annotation.deleted": { annotationId: string };
  "comment.created": { annotationId: string; comment: AnnotationComment };
  "comment.updated": { annotationId: string; comment: AnnotationComment };
  "comment.deleted": { annotationId: string; commentId: string };
  "page-status.updated": { pageStatus: PageStatusRecord };
}

export interface StreamEvent {
  eventId: string;
  projectId: string;
  pageKey: string;
  eventType: StreamEventType;
  annotationId: string | null;
  commentId: string | null;
  actorUserId: string | null;
  payload: unknown;
  createdAt: string;
  truncated?: boolean;
}
