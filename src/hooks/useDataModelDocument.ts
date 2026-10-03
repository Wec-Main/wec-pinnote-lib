import {
  fetchDataModelDocument,
  publishDataModel,
  saveDataModelDocument,
} from "../services/dataModelApi";
import type { ErdDocumentJSON } from "../types/dataModel.types";
import { parseErdDocument } from "../utils/erd/erdSerialization";
import {
  useRevisionedDocument,
  type DocumentSaveState,
  type DocumentStatus,
  type RevisionedDocumentAdapter,
  type RevisionedDocumentState,
} from "./useRevisionedDocument";

export type DataModelDocumentStatus = DocumentStatus;
export type DataModelSaveState = DocumentSaveState;
export type DataModelDocumentState = RevisionedDocumentState<ErdDocumentJSON>;

interface UseDataModelDocumentOptions {
  apiBaseUrl: string;
  getAuthToken: (() => string | Promise<string>) | undefined;
  sessionKey: string | null;
  dataModelId: string | null;
  onSaved?: (dataModelName: string) => void;
  onSaveFailed?: (dataModelId: string, message: string) => void;
  holdAutosave?: boolean;
}

const dataModelAdapter: RevisionedDocumentAdapter<ErdDocumentJSON> = {
  load: (apiBaseUrl, authToken, dataModelId, signal) =>
    fetchDataModelDocument(apiBaseUrl, authToken, dataModelId, signal),
  save: async (apiBaseUrl, authToken, dataModelId, revision, document) => {
    const saved = await saveDataModelDocument(
      apiBaseUrl,
      authToken,
      dataModelId,
      revision,
      document,
    );
    return { revision: saved.revision, name: saved.dataModel.name };
  },
  publish: publishDataModel,
  parse: parseErdDocument,
  conflictMessage: "This data model was changed elsewhere. Reload to get the latest version.",
};

export function useDataModelDocument(options: UseDataModelDocumentOptions): DataModelDocumentState {
  const { dataModelId, ...rest } = options;
  return useRevisionedDocument({ ...rest, documentId: dataModelId, adapter: dataModelAdapter });
}
