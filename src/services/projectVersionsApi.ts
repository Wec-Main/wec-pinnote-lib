import { AnnotationApiError, type AnnotationConfig } from "../types/annotation.types";
import type {
  CreateProjectVersionRequest,
  ProjectVersion,
  ProjectVersionApiClient,
  UpdateProjectVersionRequest,
} from "../types/projectVersion.types";
import { buildUrl, request, withUnauthorizedRetry } from "./httpClient";

const PATHS = {
  versions: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/versions`,
  version: (projectId: string, projectVersionId: string) =>
    `/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(projectVersionId)}`,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isProjectVersion(value: unknown): value is ProjectVersion {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.projectId) &&
    typeof value.versionNumber === "number" &&
    typeof value.status === "string" &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

function parseListPayload(payload: unknown): ProjectVersion[] {
  const rawList = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { projectVersions?: unknown }).projectVersions)
      ? (payload as { projectVersions: unknown[] }).projectVersions
      : null;

  if (!rawList) {
    throw new AnnotationApiError("Unexpected project versions list response", 500);
  }

  return rawList.map((item) => {
    if (!isProjectVersion(item)) {
      throw new AnnotationApiError("Unexpected project version shape in list response", 500);
    }
    return item;
  });
}

export function createProjectVersionsApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken">,
): ProjectVersionApiClient {
  async function call<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    options: { body?: unknown; signal?: AbortSignal } = {},
  ): Promise<T> {
    const url = buildUrl(config.apiBaseUrl, path);
    return withUnauthorizedRetry(config.getAuthToken, (token) =>
      request<T>(url, token, {
        method,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      }),
    );
  }

  return {
    async listProjectVersions(projectId, signal) {
      const payload = await call<unknown>("GET", PATHS.versions(projectId), { signal });
      return parseListPayload(payload);
    },

    getProjectVersion(projectId, projectVersionId, signal) {
      return call<ProjectVersion>("GET", PATHS.version(projectId, projectVersionId), { signal });
    },

    createProjectVersion(projectId, requestBody: CreateProjectVersionRequest, signal) {
      return call<ProjectVersion>("POST", PATHS.versions(projectId), {
        body: requestBody,
        signal,
      });
    },

    updateProjectVersion(
      projectId,
      projectVersionId,
      requestBody: UpdateProjectVersionRequest,
      signal,
    ) {
      return call<ProjectVersion>("PATCH", PATHS.version(projectId, projectVersionId), {
        body: requestBody,
        signal,
      });
    },
  };
}
