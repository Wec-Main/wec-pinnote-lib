import { fetchFlowDocument, publishFlow, saveFlowDocument } from "../services/flowApi";
import type { FlowJSON } from "../types/flowchart.types";
import { parseFlow } from "../utils/flowchart/serialization";
import {
  useRevisionedDocument,
  type DocumentSaveState,
  type DocumentStatus,
  type RevisionedDocumentAdapter,
  type RevisionedDocumentState,
} from "./useRevisionedDocument";

export type FlowDocumentStatus = DocumentStatus;
export type FlowSaveState = DocumentSaveState;

interface UseFlowDocumentOptions {
  apiBaseUrl: string;
  getAuthToken: (() => string | Promise<string>) | undefined;
  sessionKey: string | null;
  flowId: string | null;
  onSaved?: (flowName: string) => void;
  onSaveFailed?: (flowId: string, message: string) => void;
}

export type FlowDocumentState = RevisionedDocumentState<FlowJSON>;

const flowAdapter: RevisionedDocumentAdapter<FlowJSON> = {
  load: (apiBaseUrl, authToken, flowId, signal) =>
    fetchFlowDocument(apiBaseUrl, authToken, flowId, signal),
  save: async (apiBaseUrl, authToken, flowId, revision, flow) => {
    const saved = await saveFlowDocument(apiBaseUrl, authToken, flowId, revision, flow);
    return { revision: saved.revision, name: saved.flow.name };
  },
  publish: publishFlow,
  parse: parseFlow,
  conflictMessage: "This flow was changed elsewhere. Reload to get the latest version.",
};

export function useFlowDocument(options: UseFlowDocumentOptions): FlowDocumentState {
  const { flowId, ...rest } = options;
  return useRevisionedDocument({ ...rest, documentId: flowId, adapter: flowAdapter });
}
