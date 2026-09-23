import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";
import { readErrorMessage, reportUnauthorized } from "./httpClient";
import type { AuditPage, AuditQuery } from "../types/audit.types";

export async function fetchAuditPage(
  apiBaseUrl: string,
  authToken: string | undefined,
  query: AuditQuery,
  signal?: AbortSignal,
): Promise<AuditPage> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/audit`, window.location.origin);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", ...actorHeaders(authToken) },
    signal,
  });

  if (!response.ok) {
    reportUnauthorized(response.status, authToken);
    const { message, text } = await readErrorMessage(
      response,
      `Unable to load audit history (${response.status})`,
    );
    throw new AnnotationApiError(message, response.status, text || null);
  }

  return (await response.json()) as AuditPage;
}
