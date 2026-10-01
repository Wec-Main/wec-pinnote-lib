import { buildUrl, request, requestNoContent } from "./httpClient";
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
  return request<DataModel[]>(buildUrl(apiBaseUrl, "/data-models", { projectId }), authToken, {
    signal,
  });
}

export function createDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  input: DataModelDraft,
): Promise<DataModel> {
  return request<DataModel>(buildUrl(apiBaseUrl, "/data-models"), authToken, {
    method: "POST",
    body: JSON.stringify({ projectId, ...input, engine: input.engine ?? "na" }),
  });
}

export function fetchDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  signal?: AbortSignal,
): Promise<DataModel> {
  return request<DataModel>(buildUrl(apiBaseUrl, dataModelPath(dataModelId, "")), authToken, {
    signal,
  });
}

export function updateDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  input: { name?: string; description?: string; engine?: DataModelEngine },
): Promise<DataModel> {
  return request<DataModel>(buildUrl(apiBaseUrl, dataModelPath(dataModelId, "")), authToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
): Promise<void> {
  return requestNoContent(buildUrl(apiBaseUrl, dataModelPath(dataModelId, "")), authToken, {
    method: "DELETE",
  });
}

export function fetchDataModelDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  signal?: AbortSignal,
): Promise<DataModelDocumentRecord> {
  return request<DataModelDocumentRecord>(
    buildUrl(apiBaseUrl, dataModelPath(dataModelId, "/document")),
    authToken,
    { signal },
  );
}

export function saveDataModelDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  revision: number,
  document: ErdDocumentJSON,
): Promise<DataModelDocumentRecord> {
  return request<DataModelDocumentRecord>(
    buildUrl(apiBaseUrl, dataModelPath(dataModelId, "/document")),
    authToken,
    { method: "PUT", body: JSON.stringify({ revision, document }) },
  );
}

export function publishDataModel(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
): Promise<DataModelVersionRecord> {
  return request<DataModelVersionRecord>(
    buildUrl(apiBaseUrl, dataModelPath(dataModelId, "/versions")),
    authToken,
    { method: "POST" },
  );
}

export function listDataModelVersions(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  signal?: AbortSignal,
): Promise<DataModelVersionRecord[]> {
  return request<DataModelVersionRecord[]>(
    buildUrl(apiBaseUrl, dataModelPath(dataModelId, "/versions")),
    authToken,
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
  return request<DataModelVersionDetail>(
    buildUrl(apiBaseUrl, dataModelPath(dataModelId, `/versions/${version}`)),
    authToken,
    { signal },
  );
}
