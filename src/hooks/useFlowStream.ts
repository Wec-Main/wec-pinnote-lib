import type { StreamConnectionState, StreamEvent, StreamEventType } from "../types/stream.types";
import { useSseStream, type StreamTokenGetter } from "./useSseStream";

const FLOW_PAGE_KEY = "__flow__";

const EVENT_TYPES: readonly StreamEventType[] = [
  "flow.created",
  "flow.updated",
  "flow.deleted",
  "flow.published",
  "flow_document.saved",
];

export interface FlowStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  getAuthToken: StreamTokenGetter | undefined;
  sessionKey: string;
  enabled: boolean;
  onEvent: (event: StreamEvent) => void;
  onResync: () => void;
}

export function useFlowStream(options: FlowStreamOptions): StreamConnectionState {
  return useSseStream({ ...options, pageKey: FLOW_PAGE_KEY, eventTypes: EVENT_TYPES });
}
