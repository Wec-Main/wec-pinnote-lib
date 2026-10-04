import { AnnotationApiError } from "../types/annotation.types";
import { buildUrl, request } from "./httpClient";
import { isRecord } from "../utils/valueGuards";
import type { AuditPage, AuditQuery } from "../types/audit.types";

function isAuditPage(payload: unknown): payload is AuditPage {
  if (!isRecord(payload)) {
    return false;
  }
  return (
    Array.isArray(payload.entries) &&
    (typeof payload.total === "number" || payload.total === null) &&
    typeof payload.limit === "number" &&
    typeof payload.offset === "number"
  );
}

export async function fetchAuditPage(
  apiBaseUrl: string,
  authToken: string | undefined,
  query: AuditQuery,
  signal?: AbortSignal,
): Promise<AuditPage> {
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/audit", { ...query }),
    authToken,
    { signal },
    { fallbackMessage: (status) => `Unable to load audit history (${status})` },
  );
  if (!isAuditPage(payload)) {
    throw new AnnotationApiError("Unexpected audit history response", 500, JSON.stringify(payload));
  }
  return payload;
}
