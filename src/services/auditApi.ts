import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";
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
    const text = await response.text().catch(() => "");
    let message = `Unable to load audit history (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      message = parsed.error ?? parsed.message ?? message;
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new AnnotationApiError(message, response.status, text || null);
  }

  return (await response.json()) as AuditPage;
}
