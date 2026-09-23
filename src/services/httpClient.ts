import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";

export const UNAUTHORIZED_EVENT = "wpn:unauthorized";

const UNAUTHORIZED_STATUS = 401;

export interface UnauthorizedDetail {
  token: string;
}

/** Tells the session layer that the server rejected this token, so it can renew or drop it. */
export function reportUnauthorized(status: number, token: string | undefined): void {
  if (status !== UNAUTHORIZED_STATUS || !token || typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<UnauthorizedDetail>(UNAUTHORIZED_EVENT, { detail: { token } }),
  );
}

/** The server's own error text (`{ error }` or `{ message }`), else the raw body, else the fallback. */
export async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<{ message: string; text: string }> {
  const text = await response.text().catch(() => "");
  if (!text) {
    return { message: fallback, text };
  }
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const message = typeof parsed.error === "string" ? parsed.error : parsed.message;
    return { message: typeof message === "string" && message ? message : fallback, text };
  } catch {
    return { message: text, text };
  }
}

export function buildUrl(
  apiBaseUrl: string,
  path: string,
  query?: Record<string, string | undefined>,
): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

export async function request<T>(
  url: string,
  authToken: string | undefined,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...actorHeaders(authToken),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    reportUnauthorized(response.status, authToken);
    const { message, text } = await readErrorMessage(
      response,
      `Request failed (${response.status})`,
    );
    throw new AnnotationApiError(message, response.status, text || null);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
