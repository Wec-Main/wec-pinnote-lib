import { buildUrl, request } from "./httpClient";

export interface SseTicket {
  ticket: string;
  expiresInSeconds: number;
}

export function fetchSseTicket(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  pageKey: string,
  signal?: AbortSignal,
): Promise<SseTicket> {
  return request<SseTicket>(
    buildUrl(apiBaseUrl, "/events/ticket", { projectId, pageKey }),
    authToken,
    { method: "POST", signal },
  );
}
