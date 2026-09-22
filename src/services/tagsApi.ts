import { buildUrl, request } from "./httpClient";
import type { ProjectTag, TagDraft } from "../types/tag.types";

export async function fetchTags(
  apiBaseUrl: string,
  authToken: string | undefined,
  filters?: { organizationId?: string; projectId?: string; status?: string },
  signal?: AbortSignal,
): Promise<ProjectTag[]> {
  const payload = await request<{ tags: ProjectTag[] }>(
    buildUrl(apiBaseUrl, "/tags", filters),
    authToken,
    { signal },
  );
  return payload.tags;
}

export function createTag(
  apiBaseUrl: string,
  authToken: string | undefined,
  draft: TagDraft,
  signal?: AbortSignal,
): Promise<ProjectTag> {
  return request<ProjectTag>(buildUrl(apiBaseUrl, "/tags"), authToken, {
    method: "POST",
    body: JSON.stringify(draft),
    signal,
  });
}

export function updateTag(
  apiBaseUrl: string,
  authToken: string | undefined,
  tagId: string,
  draft: Omit<TagDraft, "projectId">,
  signal?: AbortSignal,
): Promise<ProjectTag> {
  return request<ProjectTag>(
    buildUrl(apiBaseUrl, `/tags/${encodeURIComponent(tagId)}`),
    authToken,
    {
      method: "PUT",
      body: JSON.stringify(draft),
      signal,
    },
  );
}

export function deleteTag(
  apiBaseUrl: string,
  authToken: string | undefined,
  tagId: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(buildUrl(apiBaseUrl, `/tags/${encodeURIComponent(tagId)}`), authToken, {
    method: "DELETE",
    signal,
  });
}
