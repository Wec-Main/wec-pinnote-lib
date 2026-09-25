import { buildUrl, request, requestNoContent } from "./httpClient";
import type { AnnotationAnchor } from "../types/annotation.types";
import type {
  Flow,
  FlowDocumentRecord,
  FlowPin,
  FlowSummary,
  FlowVersionRecord,
} from "../types/flowPin.types";
import type { FlowJSON } from "../types/flowchart.types";

function flowPath(flowId: string, suffix: string): string {
  return `/flows/${encodeURIComponent(flowId)}${suffix}`;
}

export function resolveDefaultFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<FlowSummary> {
  return request<FlowSummary>(buildUrl(apiBaseUrl, "/flows/default"), authToken, {
    method: "POST",
    body: JSON.stringify({ projectId }),
    signal,
  });
}

export function listFlows(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<Flow[]> {
  return request<Flow[]>(buildUrl(apiBaseUrl, "/flows", { projectId }), authToken, { signal });
}

export function createFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  input: { projectId: string; name: string; description?: string },
): Promise<Flow> {
  return request<Flow>(buildUrl(apiBaseUrl, "/flows"), authToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  input: { name?: string; description?: string },
): Promise<Flow> {
  return request<Flow>(buildUrl(apiBaseUrl, flowPath(flowId, "")), authToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
): Promise<void> {
  return requestNoContent(buildUrl(apiBaseUrl, flowPath(flowId, "")), authToken, {
    method: "DELETE",
  });
}

export function fetchFlowDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  signal?: AbortSignal,
): Promise<FlowDocumentRecord> {
  return request<FlowDocumentRecord>(
    buildUrl(apiBaseUrl, flowPath(flowId, "/document")),
    authToken,
    {
      signal,
    },
  );
}

export function saveFlowDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  revision: number,
  document: FlowJSON,
): Promise<FlowDocumentRecord> {
  return request<FlowDocumentRecord>(
    buildUrl(apiBaseUrl, flowPath(flowId, "/document")),
    authToken,
    {
      method: "PUT",
      body: JSON.stringify({ revision, document }),
    },
  );
}

export function publishFlow(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
): Promise<FlowVersionRecord> {
  return request<FlowVersionRecord>(
    buildUrl(apiBaseUrl, flowPath(flowId, "/versions")),
    authToken,
    {
      method: "POST",
    },
  );
}

export function fetchFlowPins(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  pageKey: string,
  signal?: AbortSignal,
): Promise<FlowPin[]> {
  return request<FlowPin[]>(buildUrl(apiBaseUrl, "/flow-pins", { projectId, pageKey }), authToken, {
    signal,
  });
}

export function createFlowPin(
  apiBaseUrl: string,
  authToken: string | undefined,
  input: { projectId: string; pageKey: string; name: string; anchor: AnnotationAnchor },
): Promise<FlowPin> {
  const { anchor, ...rest } = input;
  return request<FlowPin>(buildUrl(apiBaseUrl, "/flow-pins"), authToken, {
    method: "POST",
    body: JSON.stringify({ ...rest, ...anchor }),
  });
}

export function deleteFlowPin(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowPinId: string,
): Promise<void> {
  return requestNoContent(
    buildUrl(apiBaseUrl, `/flow-pins/${encodeURIComponent(flowPinId)}`),
    authToken,
    { method: "DELETE" },
  );
}
