import type { StreamConnectionState, StreamEvent, StreamEventType } from "../types/stream.types";
import { useSseStream, type StreamTokenGetter } from "./useSseStream";

const EPICFLOW_PAGE_KEY = "__epicflow__";

const EVENT_TYPES: readonly StreamEventType[] = [
  "epic.created",
  "epic.updated",
  "epic.deleted",
  "user_story.created",
  "user_story.updated",
  "user_story.deleted",
];

export interface EpicFlowStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  getAuthToken: StreamTokenGetter | undefined;
  sessionKey: string;
  enabled: boolean;
  onEvent: (event: StreamEvent) => void;
  onResync: () => void;
}

export function useEpicFlowStream(options: EpicFlowStreamOptions): StreamConnectionState {
  return useSseStream({ ...options, pageKey: EPICFLOW_PAGE_KEY, eventTypes: EVENT_TYPES });
}
