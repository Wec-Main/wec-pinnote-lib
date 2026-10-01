import type { Annotation, AnnotationComment } from "./annotation.types";
import type { Epic, UserStory } from "./epicFlow.types";
import type { Flow, FlowPin } from "./flowPin.types";
import type { DataModel } from "./dataModel.types";

export type StreamEventType =
  | "annotation.created"
  | "annotation.updated"
  | "annotation.deleted"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted"
  | "epic.created"
  | "epic.updated"
  | "epic.deleted"
  | "user_story.created"
  | "user_story.updated"
  | "user_story.deleted"
  | "flow.created"
  | "flow.updated"
  | "flow.deleted"
  | "flow.published"
  | "flow_document.saved"
  | "flow_pin.created"
  | "flow_pin.updated"
  | "flow_pin.deleted"
  | "data_model.created"
  | "data_model.updated"
  | "data_model.deleted"
  | "data_model.published"
  | "data_model_document.saved";

export type StreamConnectionState =
  "connecting" | "open" | "reconnecting" | "closed" | "unauthenticated";

export interface StreamEventPayloads {
  "annotation.created": { annotation: Annotation };
  "annotation.updated": { annotation: Annotation };
  "annotation.deleted": { annotationId: string };
  "comment.created": { annotationId: string; comment: AnnotationComment };
  "comment.updated": { annotationId: string; comment: AnnotationComment };
  "comment.deleted": { annotationId: string; commentId: string };
  "epic.created": { epic: Epic };
  "epic.updated": { epic: Epic };
  "epic.deleted": { epicId: string };
  "user_story.created": { userStory: UserStory };
  "user_story.updated": { userStory: UserStory };
  "user_story.deleted": { userStoryId: string };
  "flow.created": { flow: Flow };
  "flow.updated": { flow: Flow };
  "flow.deleted": { flowId: string };
  "flow.published": { flowId: string; version: unknown };
  "flow_document.saved": { flowId: string; revision: number };
  "flow_pin.created": { flowPin: FlowPin };
  "flow_pin.updated": { flowPin: FlowPin };
  "flow_pin.deleted": { flowPinId: string };
  "data_model.created": { dataModel: DataModel };
  "data_model.updated": { dataModel: DataModel };
  "data_model.deleted": { dataModelId: string };
  "data_model.published": { dataModelId: string; version: unknown };
  "data_model_document.saved": { dataModelId: string; revision: number };
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
