import { createApiClient } from "./apiClientFactory";
import type { ProjectTag, TagDraft } from "../types/tag.types";

export async function fetchTags(
  apiBaseUrl: string,
  authToken: string | undefined,
  filters?: { organizationId?: string; projectId?: string; status?: string },
  signal?: AbortSignal,
): Promise<ProjectTag[]> {
  const payload = await createApiClient(apiBaseUrl, authToken).call<{ tags: ProjectTag[] }>(
    "/tags",
    { query: filters, signal },
  );
  return payload.tags;
}

export async function createTag(
  apiBaseUrl: string,
  authToken: string | undefined,
  draft: TagDraft,
  signal?: AbortSignal,
): Promise<ProjectTag[]> {
  const payload = await createApiClient(apiBaseUrl, authToken).call<{ tags: ProjectTag[] }>(
    "/tags",
    { method: "POST", body: draft, signal },
  );
  return payload.tags;
}

export function updateTag(
  apiBaseUrl: string,
  authToken: string | undefined,
  tagId: string,
  draft: Omit<TagDraft, "projectIds">,
  signal?: AbortSignal,
): Promise<ProjectTag> {
  return createApiClient(apiBaseUrl, authToken).call<ProjectTag>(
    `/tags/${encodeURIComponent(tagId)}`,
    { method: "PUT", body: draft, signal },
  );
}

export function deleteTag(
  apiBaseUrl: string,
  authToken: string | undefined,
  tagId: string,
  signal?: AbortSignal,
): Promise<void> {
  return createApiClient(apiBaseUrl, authToken).callNoContent(
    `/tags/${encodeURIComponent(tagId)}`,
    { method: "DELETE", signal },
  );
}
