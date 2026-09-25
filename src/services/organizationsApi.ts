import { buildUrl, request, requestNoContent } from "./httpClient";
import type {
  Organization,
  OrganizationDraft,
  Project,
  ProjectDraft,
} from "../types/organization.types";

export async function fetchOrganizations(
  apiBaseUrl: string,
  authToken: string | undefined,
  signal?: AbortSignal,
): Promise<Organization[]> {
  const payload = await request<{ organizations: Organization[] }>(
    buildUrl(apiBaseUrl, "/organizations"),
    authToken,
    { signal },
  );
  return payload.organizations;
}

export function createOrganization(
  apiBaseUrl: string,
  authToken: string | undefined,
  draft: OrganizationDraft,
  signal?: AbortSignal,
): Promise<Organization> {
  return request<Organization>(buildUrl(apiBaseUrl, "/organizations"), authToken, {
    method: "POST",
    body: JSON.stringify(draft),
    signal,
  });
}

export function updateOrganization(
  apiBaseUrl: string,
  authToken: string | undefined,
  organizationId: string,
  draft: OrganizationDraft,
  signal?: AbortSignal,
): Promise<Organization> {
  return request<Organization>(
    buildUrl(apiBaseUrl, `/organizations/${encodeURIComponent(organizationId)}`),
    authToken,
    { method: "PUT", body: JSON.stringify(draft), signal },
  );
}

export function deleteOrganization(
  apiBaseUrl: string,
  authToken: string | undefined,
  organizationId: string,
  signal?: AbortSignal,
): Promise<void> {
  return requestNoContent(
    buildUrl(apiBaseUrl, `/organizations/${encodeURIComponent(organizationId)}`),
    authToken,
    { method: "DELETE", signal },
  );
}

export async function fetchProjects(
  apiBaseUrl: string,
  authToken: string | undefined,
  organizationId?: string,
  signal?: AbortSignal,
): Promise<Project[]> {
  const payload = await request<{ projects: Project[] }>(
    buildUrl(apiBaseUrl, "/projects", { organizationId }),
    authToken,
    { signal },
  );
  return payload.projects;
}

export function fetchProject(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<Project> {
  return request<Project>(
    buildUrl(apiBaseUrl, `/projects/${encodeURIComponent(projectId)}`),
    authToken,
    {
      signal,
    },
  );
}

export function createProject(
  apiBaseUrl: string,
  authToken: string | undefined,
  draft: ProjectDraft,
  signal?: AbortSignal,
): Promise<Project> {
  return request<Project>(buildUrl(apiBaseUrl, "/projects"), authToken, {
    method: "POST",
    body: JSON.stringify(draft),
    signal,
  });
}

export function updateProject(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  draft: ProjectDraft,
  signal?: AbortSignal,
): Promise<Project> {
  return request<Project>(
    buildUrl(apiBaseUrl, `/projects/${encodeURIComponent(projectId)}`),
    authToken,
    {
      method: "PUT",
      body: JSON.stringify(draft),
      signal,
    },
  );
}

export function deleteProject(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<void> {
  return requestNoContent(
    buildUrl(apiBaseUrl, `/projects/${encodeURIComponent(projectId)}`),
    authToken,
    {
      method: "DELETE",
      signal,
    },
  );
}
