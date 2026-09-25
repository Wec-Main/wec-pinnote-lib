import { AnnotationApiError } from "../types/annotation.types";
import type { IngestBatch } from "../types/pageVisit.types";
import { buildUrl, request, requestNoContent } from "./httpClient";

export interface IngestToken {
  token: string;
  expiresAt: string;
}

export type VisitSendMode = "beacon" | "fetch";

const INGEST_CONTENT_TYPE = "text/plain;charset=UTF-8";
const BEACON_BYTE_LIMIT = 65536;

function isIngestToken(payload: unknown): payload is IngestToken {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.expiresAt === "string" &&
    Number.isFinite(Date.parse(candidate.expiresAt))
  );
}

export async function mintIngestToken(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<IngestToken> {
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/analytics/ingest-token"),
    authToken,
    { method: "POST", body: JSON.stringify({ projectId }), signal },
    { fallbackMessage: (status) => `Unable to start page-visit tracking (${status})` },
  );
  if (!isIngestToken(payload)) {
    throw new AnnotationApiError("Unexpected ingest token response", 500, JSON.stringify(payload));
  }
  return payload;
}

function sendBeaconIfPossible(url: string, body: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  const blob = new Blob([body], { type: INGEST_CONTENT_TYPE });
  if (blob.size > BEACON_BYTE_LIMIT) {
    return false;
  }
  try {
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}

export async function sendVisitBatch(
  apiBaseUrl: string,
  batch: IngestBatch,
  mode: VisitSendMode,
): Promise<void> {
  const url = buildUrl(apiBaseUrl, "/analytics/visits");
  const body = JSON.stringify(batch);
  if (mode === "beacon" && sendBeaconIfPossible(url, body)) {
    return;
  }
  await requestNoContent(
    url,
    undefined,
    {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": INGEST_CONTENT_TYPE },
    },
    {
      fallbackMessage: (status) => `Unable to send page visits (${status})`,
      reportUnauthorized: false,
    },
  );
}
