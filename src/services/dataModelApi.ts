import { createApiClient } from "./apiClientFactory";
import type {
  DataModel,
  DataModelDocumentRecord,
  DataModelDraft,
  DataModelVersionDetail,
  DataModelVersionRecord,
  DataModelEngine,
  ErdDocumentJSON,
} from "../types/dataModel.types";

function dataModelPath(dataModelId: string, suffix: string): string {
  return `/data-models/${encodeURIComponent(dataModelId)}${suffix}`;
}

export function listDataModels(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<DataModel[]> {
  return createApiClient(apiBaseUrl, authToken).call<DataModel[]>("/data-models", {
    query: { projectId },
    signal,
  });
}

export function createDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  input: DataModelDraft,
  signal?: AbortSignal,
): Promise<DataModel> {
  return createApiClient(apiBaseUrl, authToken).call<DataModel>("/data-models", {
    method: "POST",
    body: { projectId, ...input, engine: input.engine ?? "na" },
    signal,
  });
}

export function fetchDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  signal?: AbortSignal,
): Promise<DataModel> {
  return createApiClient(apiBaseUrl, authToken).call<DataModel>(dataModelPath(dataModelId, ""), {
    signal,
  });
}

export function updateDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  input: { name?: string; description?: string; engine?: DataModelEngine },
  signal?: AbortSignal,
): Promise<DataModel> {
  return createApiClient(apiBaseUrl, authToken).call<DataModel>(dataModelPath(dataModelId, ""), {
    method: "PATCH",
    body: input,
    signal,
  });
}

export function deleteDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  signal?: AbortSignal,
): Promise<void> {
  return createApiClient(apiBaseUrl, authToken).callNoContent(dataModelPath(dataModelId, ""), {
    method: "DELETE",
    signal,
  });
}

export function fetchDataModelDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  signal?: AbortSignal,
): Promise<DataModelDocumentRecord> {
  return createApiClient(apiBaseUrl, authToken).call<DataModelDocumentRecord>(
    dataModelPath(dataModelId, "/document"),
    { signal },
  );
}

export function saveDataModelDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  revision: number,
  document: ErdDocumentJSON,
  signal?: AbortSignal,
): Promise<DataModelDocumentRecord> {
  return createApiClient(apiBaseUrl, authToken).call<DataModelDocumentRecord>(
    dataModelPath(dataModelId, "/document"),
    { method: "PUT", body: { revision, document }, signal },
  );
}

export function publishDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  signal?: AbortSignal,
): Promise<DataModelVersionRecord> {
  return createApiClient(apiBaseUrl, authToken).call<DataModelVersionRecord>(
    dataModelPath(dataModelId, "/versions"),
    { method: "POST", signal },
  );
}

export function listDataModelVersions(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  signal?: AbortSignal,
): Promise<DataModelVersionRecord[]> {
  return createApiClient(apiBaseUrl, authToken).call<DataModelVersionRecord[]>(
    dataModelPath(dataModelId, "/versions"),
    { signal },
  );
}

export function fetchDataModelVersion(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  version: number,
  signal?: AbortSignal,
): Promise<DataModelVersionDetail> {
  return createApiClient(apiBaseUrl, authToken).call<DataModelVersionDetail>(
    dataModelPath(dataModelId, `/versions/${version}`),
    { signal },
  );
}
