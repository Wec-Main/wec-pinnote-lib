import type { StreamConnectionState, StreamEvent, StreamEventType } from "../types/stream.types";
import { useSseStream, type StreamTokenGetter } from "./useSseStream";

const EVENT_TYPES: readonly StreamEventType[] = [
  "annotation.created",
  "annotation.updated",
  "annotation.deleted",
  "comment.created",
  "comment.updated",
  "comment.deleted",
  "page-status.updated",
];

export interface AnnotationStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  pageKey: string;
  getAuthToken: StreamTokenGetter | undefined;
  sessionKey: string;
  enabled: boolean;
  onEvent: (event: StreamEvent) => void;
  onResync: () => void;
}

export function useAnnotationStream(options: AnnotationStreamOptions): StreamConnectionState {
  return useSseStream({ ...options, eventTypes: EVENT_TYPES });
}
