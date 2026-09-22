import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";
import type {
  Organization,
  OrganizationDraft,
  Project,
  ProjectDraft,
} from "../types/organization.types";

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

async function request<T>(url: string, actorId: string | undefined, init?: RequestInit): Promise<T> {
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

export async function fetchOrganizations(
  apiBaseUrl: string,
  actorId: string | undefined,
  signal?: AbortSignal,
): Promise<Organization[]> {
  const payload = await request<{ organizations: Organization[] }>(
    buildUrl(apiBaseUrl, "/organizations"),
    actorId,
    { signal },
  );
  return payload.organizations;
}

export function createOrganization(
  apiBaseUrl: string,
  actorId: string | undefined,
  draft: OrganizationDraft,
  signal?: AbortSignal,
): Promise<Organization> {
  return request<Organization>(buildUrl(apiBaseUrl, "/organizations"), actorId, {
    method: "POST",
    body: JSON.stringify(draft),
    signal,
  });
}

export function updateOrganization(
  apiBaseUrl: string,
  actorId: string | undefined,
  organizationId: string,
  draft: OrganizationDraft,
  signal?: AbortSignal,
): Promise<Organization> {
  return request<Organization>(
    buildUrl(apiBaseUrl, `/organizations/${encodeURIComponent(organizationId)}`),
    actorId,
    { method: "PUT", body: JSON.stringify(draft), signal },
  );
}

export function deleteOrganization(
  apiBaseUrl: string,
  actorId: string | undefined,
  organizationId: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(
    buildUrl(apiBaseUrl, `/organizations/${encodeURIComponent(organizationId)}`),
    actorId,
    { method: "DELETE", signal },
  );
}

export async function fetchProjects(
  apiBaseUrl: string,
  actorId: string | undefined,
  organizationId?: string,
  signal?: AbortSignal,
): Promise<Project[]> {
  const payload = await request<{ projects: Project[] }>(
    buildUrl(apiBaseUrl, "/projects", { organizationId }),
    actorId,
    { signal },
  );
  return payload.projects;
}

export function fetchProject(
  apiBaseUrl: string,
  actorId: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<Project> {
  return request<Project>(buildUrl(apiBaseUrl, `/projects/${encodeURIComponent(projectId)}`), actorId, {
    signal,
  });
}

export function createProject(
  apiBaseUrl: string,
  actorId: string | undefined,
  draft: ProjectDraft,
  signal?: AbortSignal,
): Promise<Project> {
  return request<Project>(buildUrl(apiBaseUrl, "/projects"), actorId, {
    method: "POST",
    body: JSON.stringify(draft),
    signal,
  });
}

export function updateProject(
  apiBaseUrl: string,
  actorId: string | undefined,
  projectId: string,
  draft: Omit<ProjectDraft, "projectId">,
  signal?: AbortSignal,
): Promise<Project> {
  return request<Project>(buildUrl(apiBaseUrl, `/projects/${encodeURIComponent(projectId)}`), actorId, {
    method: "PUT",
    body: JSON.stringify(draft),
    signal,
  });
}

export function deleteProject(
  apiBaseUrl: string,
  actorId: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(buildUrl(apiBaseUrl, `/projects/${encodeURIComponent(projectId)}`), actorId, {
    method: "DELETE",
    signal,
  });
}
