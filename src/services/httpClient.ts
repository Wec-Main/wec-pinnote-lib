import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";

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
    const text = await response.text().catch(() => "");
    let message = `Request failed (${response.status})`;
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

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
