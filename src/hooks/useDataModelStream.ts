import type { StreamConnectionState, StreamEvent, StreamEventType } from "../types/stream.types";
import { useSseStream, type StreamTokenGetter } from "./useSseStream";

const DATA_MODEL_PAGE_KEY = "__data_model__";

const EVENT_TYPES: readonly StreamEventType[] = [
  "data_model.created",
  "data_model.updated",
  "data_model.deleted",
  "data_model.published",
  "data_model_document.saved",
];

export interface DataModelStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  getAuthToken: StreamTokenGetter | undefined;
  sessionKey: string;
  enabled: boolean;
  onEvent: (event: StreamEvent) => void;
  onResync: () => void;
}

export function useDataModelStream(options: DataModelStreamOptions): StreamConnectionState {
  return useSseStream({ ...options, pageKey: DATA_MODEL_PAGE_KEY, eventTypes: EVENT_TYPES });
}
