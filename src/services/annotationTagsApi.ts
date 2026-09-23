import { buildUrl, request, requestNoContent } from "./httpClient";
import type {
  AnnotationTag,
  CreateAnnotationTagInput,
  UserPreferences,
} from "../types/annotationTag.types";

export function fetchAnnotationTags(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  pageKey: string,
  signal?: AbortSignal,
): Promise<AnnotationTag[]> {
  return request<AnnotationTag[]>(
    buildUrl(apiBaseUrl, "/annotation-tags", { projectId, pageKey }),
    authToken,
    { signal },
  );
}

export function createAnnotationTag(
  apiBaseUrl: string,
  authToken: string | undefined,
  input: CreateAnnotationTagInput,
  signal?: AbortSignal,
): Promise<AnnotationTag> {
  const { anchor, ...rest } = input;
  return request<AnnotationTag>(buildUrl(apiBaseUrl, "/annotation-tags"), authToken, {
    method: "POST",
    body: JSON.stringify({ ...rest, ...anchor }),
    signal,
  });
}

export function deleteAnnotationTag(
  apiBaseUrl: string,
  authToken: string | undefined,
  annotationTagId: string,
  signal?: AbortSignal,
): Promise<void> {
  return requestNoContent(
    buildUrl(apiBaseUrl, `/annotation-tags/${encodeURIComponent(annotationTagId)}`),
    authToken,
    { method: "DELETE", signal },
  );
}

export function fetchPreferences(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<UserPreferences> {
  return request<UserPreferences>(buildUrl(apiBaseUrl, "/preferences", { projectId }), authToken, {
    signal,
  });
}

export function saveTagsVisible(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  tagsVisible: boolean,
  signal?: AbortSignal,
): Promise<UserPreferences> {
  return request<UserPreferences>(buildUrl(apiBaseUrl, "/preferences"), authToken, {
    method: "PUT",
    body: JSON.stringify({ projectId, tagsVisible }),
    signal,
  });
}
