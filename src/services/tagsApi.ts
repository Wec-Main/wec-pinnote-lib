import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";
import type { ProjectTag, TagDraft } from "../types/tag.types";

function buildUrl(apiBaseUrl: string, path: string, query?: Record<string, string | undefined>) {
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

async function request<T>(
  url: string,
  actorId: string | undefined,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...actorHeaders(actorId),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = `Request failed (${response.status})`;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? message;
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new AnnotationApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function fetchTags(
  apiBaseUrl: string,
  actorId: string | undefined,
  filters?: { organizationId?: string; projectId?: string; status?: string },
  signal?: AbortSignal,
): Promise<ProjectTag[]> {
  const payload = await request<{ tags: ProjectTag[] }>(
    buildUrl(apiBaseUrl, "/tags", filters),
    actorId,
    { signal },
  );
  return payload.tags;
}

export function createTag(
  apiBaseUrl: string,
  actorId: string | undefined,
  draft: TagDraft,
  signal?: AbortSignal,
): Promise<ProjectTag> {
  return request<ProjectTag>(buildUrl(apiBaseUrl, "/tags"), actorId, {
    method: "POST",
    body: JSON.stringify(draft),
    signal,
  });
}

export function updateTag(
  apiBaseUrl: string,
  actorId: string | undefined,
  tagId: string,
  draft: Omit<TagDraft, "projectId">,
  signal?: AbortSignal,
): Promise<ProjectTag> {
  return request<ProjectTag>(buildUrl(apiBaseUrl, `/tags/${encodeURIComponent(tagId)}`), actorId, {
    method: "PUT",
    body: JSON.stringify(draft),
    signal,
  });
}

export function deleteTag(
  apiBaseUrl: string,
  actorId: string | undefined,
  tagId: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(buildUrl(apiBaseUrl, `/tags/${encodeURIComponent(tagId)}`), actorId, {
    method: "DELETE",
    signal,
  });
}
