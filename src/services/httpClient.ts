import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";

export const UNAUTHORIZED_EVENT = "wpn:unauthorized";

const UNAUTHORIZED_STATUS = 401;
const NO_CONTENT_STATUS = 204;
const ABSOLUTE_URL = /^https?:\/\//i;
const PLACEHOLDER_ORIGIN = "http://local.invalid";

export interface UnauthorizedDetail {
  token: string;
}

export type QueryValue = string | number | boolean | undefined;

export type ApiErrorFactory = (
  message: string,
  status: number,
  body: string | null,
) => AnnotationApiError;

export interface RequestPolicy {
  fallbackMessage?: (status: number) => string;
  createError?: ApiErrorFactory;
  reportUnauthorized?: boolean;
}

export function reportUnauthorized(status: number, token: string | undefined): void {
  if (status !== UNAUTHORIZED_STATUS || !token || typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<UnauthorizedDetail>(UNAUTHORIZED_EVENT, { detail: { token } }),
  );
}

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
  query?: Record<string, QueryValue>,
): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}${path}`, PLACEHOLDER_ORIGIN);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return ABSOLUTE_URL.test(base) ? url.toString() : `${url.pathname}${url.search}`;
}

function defaultFallbackMessage(status: number): string {
  return `Request failed (${status})`;
}

function defaultCreateError(message: string, status: number, body: string | null) {
  return new AnnotationApiError(message, status, body);
}

async function send(
  url: string,
  authToken: string | undefined,
  init: RequestInit | undefined,
  policy: RequestPolicy,
): Promise<Response> {
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
    if (policy.reportUnauthorized !== false) {
      reportUnauthorized(response.status, authToken);
    }
    const fallback = (policy.fallbackMessage ?? defaultFallbackMessage)(response.status);
    const { message, text } = await readErrorMessage(response, fallback);
    throw (policy.createError ?? defaultCreateError)(message, response.status, text || null);
  }
  return response;
}

export async function request<T>(
  url: string,
  authToken: string | undefined,
  init?: RequestInit,
  policy: RequestPolicy = {},
): Promise<T> {
  const response = await send(url, authToken, init, policy);
  const createError = policy.createError ?? defaultCreateError;
  const text = response.status === NO_CONTENT_STATUS ? "" : await response.text();
  if (!text.trim()) {
    throw createError("Expected a response body but received none", response.status, null);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw createError("Response body is not valid JSON", response.status, text);
  }
}

export async function requestNoContent(
  url: string,
  authToken: string | undefined,
  init?: RequestInit,
  policy: RequestPolicy = {},
): Promise<void> {
  const response = await send(url, authToken, init, policy);
  await response.text().catch(() => "");
}

export async function requestBlob(
  url: string,
  authToken: string | undefined,
  init?: RequestInit,
  policy: RequestPolicy = {},
): Promise<Blob> {
  const response = await send(url, authToken, init, policy);
  return response.blob();
}
