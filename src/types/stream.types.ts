import type { Annotation, AnnotationComment, PageStatusRecord } from "./annotation.types";
import type { Epic, UserStory } from "./epicFlow.types";

export type StreamEventType =
  | "annotation.created"
  | "annotation.updated"
  | "annotation.deleted"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "page-status.updated"
  | "epic.created"
  | "epic.updated"
  | "epic.deleted"
  | "user_story.created"
  | "user_story.updated"
  | "user_story.deleted";

export type StreamConnectionState =
  "connecting" | "open" | "reconnecting" | "closed" | "unauthenticated";

export interface StreamEventPayloads {
  "annotation.created": { annotation: Annotation };
  "annotation.updated": { annotation: Annotation };
  "annotation.deleted": { annotationId: string };
  "comment.created": { annotationId: string; comment: AnnotationComment };
  "comment.updated": { annotationId: string; comment: AnnotationComment };
  "comment.deleted": { annotationId: string; commentId: string };
  "page-status.updated": { pageStatus: PageStatusRecord };
  "epic.created": { epic: Epic };
  "epic.updated": { epic: Epic };
  "epic.deleted": { epicId: string };
  "user_story.created": { userStory: UserStory };
  "user_story.updated": { userStory: UserStory };
  "user_story.deleted": { userStoryId: string };
}

interface StreamEventBase {
  eventId: string;
  projectId: string;
  pageKey: string;
  annotationId: string | null;
  commentId: string | null;
  actorUserId: string | null;
  createdAt: string;
  truncated?: boolean;
}

export type StreamEvent = {
  [K in StreamEventType]: StreamEventBase & {
    eventType: K;
    payload: StreamEventPayloads[K];
  };
}[StreamEventType];
