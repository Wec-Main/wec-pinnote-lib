import { createApiClient } from "./apiClientFactory";
import type { AnnotationAnchor } from "../types/annotation.types";
import type {
  Flow,
  FlowDocumentRecord,
  FlowPin,
  FlowSummary,
  FlowVersionRecord,
  FlowVersionWithDocument,
} from "../types/flowPin.types";
import type { FlowJSON } from "../types/flowchart.types";

function flowPath(flowId: string, suffix: string): string {
  return `/flows/${encodeURIComponent(flowId)}${suffix}`;
}

export function resolveDefaultFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  projectVersionId?: string,
  signal?: AbortSignal,
): Promise<FlowSummary> {
  return createApiClient(apiBaseUrl, authToken).call<FlowSummary>("/flows/default", {
    method: "POST",
    body: { projectId, projectVersionId },
    signal,
  });
}

export function createFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  input: { name: string; description?: string; projectVersionId?: string },
  signal?: AbortSignal,
): Promise<Flow> {
  return createApiClient(apiBaseUrl, authToken).call<Flow>("/flows", {
    method: "POST",
    body: { projectId, ...input },
    signal,
  });
}

export function listFlows(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  projectVersionId?: string,
  signal?: AbortSignal,
): Promise<Flow[]> {
  return createApiClient(apiBaseUrl, authToken).call<Flow[]>("/flows", {
    query: { projectId, projectVersionId },
    signal,
  });
}

export function updateFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  input: { name: string },
  signal?: AbortSignal,
): Promise<Flow> {
  return createApiClient(apiBaseUrl, authToken).call<Flow>(flowPath(flowId, ""), {
    method: "PATCH",
    body: input,
    signal,
  });
}

export function deleteFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  signal?: AbortSignal,
): Promise<void> {
  return createApiClient(apiBaseUrl, authToken).callNoContent(flowPath(flowId, ""), {
    method: "DELETE",
    signal,
  });
}

export function fetchFlowDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  signal?: AbortSignal,
): Promise<FlowDocumentRecord> {
  return createApiClient(apiBaseUrl, authToken).call<FlowDocumentRecord>(
    flowPath(flowId, "/document"),
    { signal },
  );
}

export function saveFlowDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  revision: number,
  document: FlowJSON,
  signal?: AbortSignal,
): Promise<FlowDocumentRecord> {
  return createApiClient(apiBaseUrl, authToken).call<FlowDocumentRecord>(
    flowPath(flowId, "/document"),
    { method: "PUT", body: { revision, document }, signal },
  );
}

export function publishFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  signal?: AbortSignal,
): Promise<FlowVersionRecord> {
  return createApiClient(apiBaseUrl, authToken).call<FlowVersionRecord>(
    flowPath(flowId, "/versions"),
    { method: "POST", signal },
  );
}

export function listFlowVersions(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  signal?: AbortSignal,
): Promise<FlowVersionRecord[]> {
  return createApiClient(apiBaseUrl, authToken).call<FlowVersionRecord[]>(
    flowPath(flowId, "/versions"),
    { signal },
  );
}

export function fetchFlowVersionDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<FlowVersionWithDocument> {
  return createApiClient(apiBaseUrl, authToken).call<FlowVersionWithDocument>(
    flowPath(flowId, `/versions/${encodeURIComponent(versionId)}`),
    { signal },
  );
}

export function fetchFlowPins(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  pageKey: string,
  projectVersionId?: string,
  signal?: AbortSignal,
): Promise<FlowPin[]> {
  return createApiClient(apiBaseUrl, authToken).call<FlowPin[]>("/flow-pins", {
    query: { projectId, pageKey, projectVersionId },
    signal,
  });
}

export function createFlowPin(
  apiBaseUrl: string,
  authToken: string | undefined,
  input: {
    projectId: string;
    projectVersionId?: string;
    pageKey: string;
    name: string;
    anchor: AnnotationAnchor;
  },
  signal?: AbortSignal,
): Promise<FlowPin> {
  const { anchor, ...rest } = input;
  return createApiClient(apiBaseUrl, authToken).call<FlowPin>("/flow-pins", {
    method: "POST",
    body: { ...rest, ...anchor },
    signal,
  });
}

export function deleteFlowPin(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowPinId: string,
  signal?: AbortSignal,
): Promise<void> {
  return createApiClient(apiBaseUrl, authToken).callNoContent(
    `/flow-pins/${encodeURIComponent(flowPinId)}`,
    { method: "DELETE", signal },
  );
}
